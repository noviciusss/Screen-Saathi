"""Transport-injected Timbre TTS proxy, cache, and sequential sentence queue."""

from __future__ import annotations

import base64
import hashlib
import json
import re
import time
from collections.abc import AsyncIterator, Callable
from typing import Protocol

import websockets

from .hooks import (
    TimestampHook,
    UsageEvent,
    UsageHook,
    invoke_timestamp_hook,
    invoke_usage_hook,
    utc_timestamp,
)
from .protocol import TtsRequest, parse_json_object


class TtsSocket(Protocol):
    async def send(self, data: str) -> None: ...

    def __aiter__(self) -> AsyncIterator[str | bytes]: ...

    async def close(self) -> None: ...


class TtsTransport(Protocol):
    async def connect(self) -> None: ...

    def stream(self, request: TtsRequest) -> AsyncIterator[bytes]: ...

    async def close(self) -> None: ...


class TtsTransportFactory(Protocol):
    def __call__(self) -> TtsTransport: ...


class GnaniTtsTransport:
    """Raw Timbre v2.5 WebSocket transport."""

    def __init__(
        self,
        api_key: str,
        endpoint: str = "wss://api.vachana.ai/api/v1/tts",
    ) -> None:
        self.api_key = api_key
        self.endpoint = endpoint
        self._socket: TtsSocket | None = None

    async def connect(self) -> None:
        pass

    async def _stream(self, request: TtsRequest) -> AsyncIterator[bytes]:
        async with websockets.connect(
            self.endpoint, additional_headers={"X-API-Key-ID": self.api_key}
        ) as socket:
            self._socket = socket
            payload = json.dumps(request.gnani_payload(), ensure_ascii=False)
            await socket.send(payload)
            async for raw in socket:
                if not isinstance(raw, (str, bytes)):
                    continue
                message = parse_json_object(raw)
                if message is None:
                    continue
                kind = message.get("type", message.get("event"))
                if kind == "audio":
                    data = message.get("data")
                    encoded = data.get("audio") if isinstance(data, dict) else None
                    if isinstance(encoded, str):
                        yield base64.b64decode(encoded)
                elif kind in {"complete", "done"}:
                    return
                elif kind == "error":
                    raise RuntimeError("TTS provider returned an error")

    def stream(self, request: TtsRequest) -> AsyncIterator[bytes]:
        return self._stream(request)

    async def close(self) -> None:
        socket = self._socket
        if socket is not None:
            self._socket = None
            try:
                await socket.close()
            except Exception:
                pass


class TtsCache:
    """Deterministic memory cache keyed by all provider-affecting request fields."""

    def __init__(self) -> None:
        self._entries: dict[str, tuple[bytes, ...]] = {}

    @staticmethod
    def key(request: TtsRequest) -> str:
        payload = {
            "text": request.text,
            "voice": request.voice,
            "model": request.model,
            "language": request.language,
            "speed": request.speed,
            "audio_config": request.audio_config.model_dump(mode="json"),
        }
        canonical = json.dumps(
            payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")
        )
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    def get(self, key: str) -> tuple[bytes, ...] | None:
        return self._entries.get(key)

    def put(self, key: str, chunks: tuple[bytes, ...]) -> None:
        self._entries[key] = chunks

    def contains(self, request: TtsRequest) -> bool:
        return self.key(request) in self._entries


def split_sentences(text: str) -> list[str]:
    """Split common Indic/Latin sentence endings while retaining short text."""

    parts = [part.strip() for part in re.split(r"(?<=[.!?।॥])\s+", text.strip())]
    return [part for part in parts if part] or [text.strip()]


class TtsProxy:
    def __init__(
        self,
        transport_factory: TtsTransportFactory,
        *,
        cache: TtsCache | None = None,
        usage_hook: UsageHook | None = None,
        timestamp_hook: TimestampHook | None = None,
        credit_per_100_chars: float = 0.2777,
        clock: Callable[[], float] = time.perf_counter,
    ) -> None:
        self.transport_factory = transport_factory
        self.cache = cache or TtsCache()
        self.usage_hook = usage_hook
        self.timestamp_hook = timestamp_hook
        self.credit_per_100_chars = credit_per_100_chars
        self._clock = clock
        self._transport: TtsTransport | None = None

    async def _get_transport(self) -> TtsTransport:
        if self._transport is None:
            self._transport = self.transport_factory()
            await self._transport.connect()
        return self._transport

    async def stream(self, request: TtsRequest) -> AsyncIterator[bytes]:
        key = self.cache.key(request)
        cached = self.cache.get(key)
        started = self._clock()
        if cached is not None:
            first_chunk_ms = 0.0 if cached else None
            for chunk in cached:
                yield chunk
            await invoke_timestamp_hook(self.timestamp_hook, "tts_first_chunk")
            await invoke_usage_hook(
                self.usage_hook,
                UsageEvent(
                    operation="tts",
                    request_id=request.request_id,
                    duration_ms=(self._clock() - started) * 1_000,
                    estimated_credits=0.0,
                    bytes_sent=0,
                    bytes_received=sum(map(len, cached)),
                    cache_hit=True,
                    timestamp=utc_timestamp(),
                    first_chunk_ms=first_chunk_ms,
                ),
            )
            return

        transport = await self._get_transport()
        chunks: list[bytes] = []
        first = True
        first_chunk_ms: float | None = None
        async for chunk in transport.stream(request):
            if first:
                first = False
                first_chunk_ms = (self._clock() - started) * 1_000
                await invoke_timestamp_hook(self.timestamp_hook, "tts_first_chunk")
            chunks.append(chunk)
            yield chunk
        cached_chunks = tuple(chunks)
        self.cache.put(key, cached_chunks)
        await invoke_usage_hook(
            self.usage_hook,
            UsageEvent(
                operation="tts",
                request_id=request.request_id,
                duration_ms=(self._clock() - started) * 1_000,
                estimated_credits=len(request.text) * self.credit_per_100_chars / 100,
                bytes_sent=len(request.text.encode("utf-8")),
                bytes_received=sum(map(len, cached_chunks)),
                cache_hit=False,
                timestamp=utc_timestamp(),
                first_chunk_ms=first_chunk_ms,
            ),
        )

    async def close(self) -> None:
        if self._transport is not None:
            await self._transport.close()
            self._transport = None


class SentenceQueue:
    """One-at-a-time sentence synthesis queue for a single Timbre connection."""

    def __init__(self, proxy: TtsProxy) -> None:
        self.proxy = proxy

    @staticmethod
    def sentences(request: TtsRequest) -> list[str]:
        return split_sentences(request.text)

    @staticmethod
    def requests(request: TtsRequest) -> list[TtsRequest]:
        return [
            request.model_copy(
                update={
                    "text": sentence,
                    "request_id": f"{request.request_id}:{sentence_index}",
                }
            )
            for sentence_index, sentence in enumerate(split_sentences(request.text))
        ]

    async def stream(self, request: TtsRequest) -> AsyncIterator[tuple[int, int, bytes]]:
        for sentence_index, sentence_request in enumerate(self.requests(request)):
            chunk_index = 0
            async for chunk in self.proxy.stream(sentence_request):
                yield sentence_index, chunk_index, chunk
                chunk_index += 1


__all__ = [
    "GnaniTtsTransport",
    "SentenceQueue",
    "TtsCache",
    "TtsProxy",
    "TtsTransport",
    "split_sentences",
]
