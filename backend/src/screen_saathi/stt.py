"""Transport-injected Prisma STT proxy and event normalizer."""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import AsyncIterator, Callable, Mapping
from typing import Protocol

import websockets
from websockets.exceptions import ConnectionClosed

from .protocol import TranscriptMessage, parse_json_object

LOGGER = logging.getLogger("uvicorn.error")

FRAME_BYTES = 1_024
SAMPLE_RATE = 16_000
FRAME_SECONDS = FRAME_BYTES / 2 / SAMPLE_RATE
TRAILING_SILENCE_FRAMES = 32


class SttSocket(Protocol):
    async def send(self, data: bytes) -> None: ...

    def __aiter__(self) -> AsyncIterator[str | bytes]: ...

    async def close(self) -> None: ...


class SttTransport(Protocol):
    async def connect(self) -> None: ...

    async def send_frame(self, frame: bytes) -> None: ...

    def events(self) -> AsyncIterator[Mapping[str, object]]: ...

    async def close(self) -> None: ...


class SttTransportFactory(Protocol):
    def __call__(self, language: str) -> SttTransport: ...


class SttProviderError(RuntimeError):
    """An upstream Prisma connection was rejected or became unavailable."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.user_message = message


def _number(value: object) -> int | float | None:
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def normalize_stt_event(
    event: Mapping[str, object], turn_id: str
) -> TranscriptMessage | None:
    """Map Prisma's partial/transcript/final_transcript variants to one client type."""

    kind_value = event.get("type", event.get("event"))
    kind = kind_value if isinstance(kind_value, str) else ""
    if kind not in {"partial_transcript", "transcript", "final_transcript"}:
        return None
    text = event.get("text")
    if not isinstance(text, str) or not text:
        return None
    latency = _number(event.get("latency_ms", event.get("latency")))
    return TranscriptMessage(
        turn_id=turn_id,
        text=text,
        final=kind != "partial_transcript",
        latency_ms=float(latency) if latency is not None else 0.0,
    )


class GnaniSttTransport:
    """Raw Prisma v3 WebSocket transport; injected fakes avoid network calls in tests."""

    def __init__(
        self,
        api_key: str,
        language: str,
        endpoint: str = "wss://api.vachana.ai/stt/v3/stream",
    ) -> None:
        self.api_key = api_key
        self.language = language
        self.endpoint = endpoint
        self._socket: SttSocket | None = None

    async def connect(self) -> None:
        headers = {
            "x-api-key-id": self.api_key,
            "lang_code": self.language,
            "x-sample-rate": str(SAMPLE_RATE),
            "x-format": "transcribe",
            "x-vad-threshold": "0.6",
            "x-min-silence-ms": "600",
            "x-min-speech-ms": "150",
            "x-min-segment-ms": "120",
            "x-partials": "true",
        }
        try:
            self._socket = await websockets.connect(self.endpoint, additional_headers=headers)
        except websockets.WebSocketException as error:
            raise SttProviderError(
                "stt_provider_rejected",
                "Speech recognition rejected the language or session settings.",
            ) from error

    async def send_frame(self, frame: bytes) -> None:
        if self._socket is None:
            raise RuntimeError("STT transport is not connected")
        try:
            await self._socket.send(frame)
        except ConnectionClosed as error:
            self._socket = None
            if error.code == 1008:
                raise SttProviderError(
                    "stt_provider_rejected",
                    "Speech recognition rejected the language or session settings.",
                ) from error
            raise SttProviderError(
                "stt_unavailable",
                "Speech recognition is temporarily unavailable.",
            ) from error

    async def _raw_events(self) -> AsyncIterator[Mapping[str, object]]:
        if self._socket is None:
            raise RuntimeError("STT transport is not connected")
        async for raw in self._socket:
            if not isinstance(raw, (str, bytes)):
                continue
            event = parse_json_object(raw)
            if event is not None:
                kind = event.get("type", event.get("event"))
                if isinstance(kind, str):
                    LOGGER.warning(
                        "screen_saathi stt_provider_event kind=%s has_text=%s",
                        kind,
                        isinstance(event.get("text"), str),
                    )
                if kind == "error":
                    raise RuntimeError("STT provider returned an error")
                yield event

    def events(self) -> AsyncIterator[Mapping[str, object]]:
        return self._raw_events()

    async def close(self) -> None:
        if self._socket is not None:
            await self._socket.close()
            self._socket = None


class SttProxy:
    """Enforce frame size, normalize events, and reconnect at the 15-minute boundary."""

    def __init__(
        self,
        language: str,
        transport_factory: SttTransportFactory,
        *,
        max_seconds: float = 900.0,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.language = language
        self.transport_factory = transport_factory
        self.max_seconds = max_seconds
        self._clock = clock
        self._transport: SttTransport | None = None
        self._connected_at: float | None = None
        self._closed = False

    async def start(self) -> None:
        if self._transport is not None:
            return
        self._transport = self.transport_factory(self.language)
        await self._transport.connect()
        self._connected_at = self._clock()

    async def _reconnect_if_needed(self) -> None:
        if self._connected_at is None or self._clock() - self._connected_at < self.max_seconds:
            return
        if self._transport is not None:
            await self._transport.close()
        self._transport = None
        await self.start()

    async def send_frame(self, frame: bytes) -> None:
        if len(frame) != FRAME_BYTES:
            raise ValueError(f"audio frames must be exactly {FRAME_BYTES:,} bytes")
        await self.start()
        await self._reconnect_if_needed()
        if self._transport is None:
            raise RuntimeError("STT transport is unavailable")
        await self._transport.send_frame(frame)

    async def events(self, turn_id: str) -> AsyncIterator[TranscriptMessage]:
        await self.start()
        while not self._closed:
            if self._transport is None:
                await self.start()
            transport = self._transport
            if transport is None:
                return
            try:
                async for raw_event in transport.events():
                    normalized = normalize_stt_event(raw_event, turn_id)
                    if normalized is not None:
                        yield normalized
            except (ConnectionError, OSError, websockets.WebSocketException):
                pass
            if self._closed:
                return
            await self._reconnect_if_needed()
            if self._transport is transport:
                self._transport = None
                await self.start()

    async def finish(self) -> None:
        """Send paced VAD silence and leave the socket open for final events."""

        if self._transport is None:
            return
        silence = bytes(FRAME_BYTES)
        for _ in range(TRAILING_SILENCE_FRAMES):
            await self.send_frame(silence)
            await asyncio.sleep(FRAME_SECONDS)

    async def close(self) -> None:
        self._closed = True
        if self._transport is not None:
            await self._transport.close()
            self._transport = None


__all__ = [
    "FRAME_BYTES",
    "FRAME_SECONDS",
    "GnaniSttTransport",
    "SAMPLE_RATE",
    "SttProxy",
    "SttProviderError",
    "SttTransport",
    "TRAILING_SILENCE_FRAMES",
    "normalize_stt_event",
]
