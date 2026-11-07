from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Mapping
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from screen_saathi.app import create_app
from screen_saathi.protocol import TtsRequest
from screen_saathi.reasoner_contract import Action, ReasonerResponse
from screen_saathi.settings import Settings
from screen_saathi.stt import SttProviderError, SttProxy, normalize_stt_event
from screen_saathi.tts import SentenceQueue, TtsProxy


class FakeSttTransport:
    def __init__(self) -> None:
        self.frames: list[bytes] = []
        self.events_queue: asyncio.Queue[Mapping[str, object] | None] = asyncio.Queue()
        self.connected = False

    async def connect(self) -> None:
        self.connected = True

    async def send_frame(self, frame: bytes) -> None:
        self.frames.append(frame)
        if len(self.frames) != 1:
            return
        await self.events_queue.put(
            {"type": "partial_transcript", "text": "हाँ", "segment_id": "s1"}
        )
        await self.events_queue.put(
            {
                "type": "final_transcript",
                "text": "हाँ",
                "segment_id": "s1",
                "segment_index": 0,
                "audio_duration_ms": 32,
                "latency": 110,
            }
        )

    async def events(self) -> AsyncIterator[Mapping[str, object]]:
        while True:
            event = await self.events_queue.get()
            if event is None:
                return
            yield event

    async def close(self) -> None:
        await self.events_queue.put(None)


class SilentSttTransport(FakeSttTransport):
    async def send_frame(self, frame: bytes) -> None:
        self.frames.append(frame)


class PolicySttTransport(FakeSttTransport):
    async def send_frame(self, frame: bytes) -> None:
        raise SttProviderError(
            "stt_provider_rejected",
            "Speech recognition rejected the language or session settings.",
        )


class FakeTtsTransport:
    def __init__(self, calls: list[str]) -> None:
        self.calls = calls

    async def connect(self) -> None:
        return None

    async def stream(self, request: TtsRequest) -> AsyncIterator[bytes]:
        self.calls.append(request.text)
        yield b"\x01\x00"

    async def close(self) -> None:
        return None


class FakeAssistantReasoner:
    supports_vision = False

    async def respond(self, request: object) -> ReasonerResponse:
        return ReasonerResponse(
            speak="यह कृत्रिम फॉर्म है। नाम भरना अगला कदम है।",
            highlight_id="e1",
            action=Action(type="fill", target_id="e1", value="Synthetic User"),
            confidence="high",
        )


def settings(tmp_path: Path, **overrides: object) -> Settings:
    values: dict[str, object] = {
        "session_token": "test-token",
        "allowed_origins": frozenset({"https://extension.test"}),
        "usage_log_path": tmp_path / "usage.jsonl",
    }
    values.update(overrides)
    return Settings(**values)


def test_stt_event_normalization_and_frame_contract() -> None:
    partial = normalize_stt_event(
        {"event": "partial_transcript", "text": "he"}, "turn-1"
    )
    final = normalize_stt_event(
        {"type": "final_transcript", "text": "hello", "latency": 12}, "turn-1"
    )

    assert partial is not None
    assert partial.model_dump() == {
        "type": "transcript",
        "turn_id": "turn-1",
        "text": "he",
        "final": False,
        "latency_ms": 0.0,
    }
    assert final is not None and final.final and final.latency_ms == 12

    async def check_frame() -> None:
        proxy = SttProxy("en-IN", lambda: FakeSttTransport())
        with pytest.raises(ValueError, match="1,024"):
            await proxy.send_frame(b"too short")

    asyncio.run(check_frame())


@pytest.mark.asyncio
async def test_tts_cache_hit_does_not_call_transport() -> None:
    calls: list[str] = []
    proxy = TtsProxy(lambda: FakeTtsTransport(calls))
    request = TtsRequest(
        request_id="one", text="Synthetic sentence.", voice="Nalini", language="hi-IN"
    )
    same_text_new_id = request.model_copy(update={"request_id": "two"})
    different_voice = request.model_copy(update={"request_id": "three", "voice": "Deepak"})

    first = [chunk async for chunk in proxy.stream(request)]
    second = [chunk async for chunk in proxy.stream(same_text_new_id)]
    third = [chunk async for chunk in proxy.stream(different_voice)]

    assert first == second == third == [b"\x01\x00"]
    assert calls == ["Synthetic sentence.", "Synthetic sentence."]
    await proxy.close()


@pytest.mark.asyncio
async def test_sentence_queue_is_sequential() -> None:
    calls: list[str] = []
    proxy = TtsProxy(lambda: FakeTtsTransport(calls))
    queue = SentenceQueue(proxy)
    request = TtsRequest(
        request_id="one", text="First. Second?", voice="Nalini", language="hi-IN"
    )

    chunks = [item async for item in queue.stream(request)]

    assert [item[0] for item in chunks] == [0, 1]
    assert calls == ["First.", "Second?"]
    await proxy.close()


def test_fake_fixed_contract_echo_session_and_origin_auth(tmp_path: Path) -> None:
    stt_transports: list[FakeSttTransport] = []
    tts_calls: list[str] = []

    def make_stt(_language: str) -> FakeSttTransport:
        transport = FakeSttTransport()
        stt_transports.append(transport)
        return transport

    app = create_app(
        settings(tmp_path),
        stt_transport_factory=make_stt,
        tts_transport_factory=lambda: FakeTtsTransport(tts_calls),
    )
    with TestClient(app) as client:
        with client.websocket_connect(
            "/v1/session", headers={"origin": "https://extension.test"}
        ) as socket:
            socket.send_json(
                {
                    "type": "hello",
                    "protocol_version": 1,
                    "session_token": "test-token",
                    "language": "hi-IN",
                    "mode": "echo",
                }
            )
            assert socket.receive_json()["type"] == "ready"
            socket.send_json({"type": "audio_start", "turn_id": "turn-1"})
            assert stt_transports == []
            socket.send_bytes(bytes(1_024))

            partial = socket.receive_json()
            final = socket.receive_json()
            tts_start = socket.receive_json()
            audio = socket.receive_bytes()
            tts_end = socket.receive_json()
            assert partial == {
                "type": "transcript",
                "turn_id": "turn-1",
                "text": "हाँ",
                "final": False,
                "latency_ms": 0.0,
            }
            assert final["final"] is True and final["turn_id"] == "turn-1"
            assert tts_start == {
                "type": "tts_start",
                "turn_id": "turn-1",
                "sample_rate": 24_000,
                "encoding": "linear_pcm",
            }
            assert audio == b"\x01\x00"
            assert tts_end == {"type": "tts_end", "turn_id": "turn-1"}
            assert stt_transports[0].connected
            assert len(stt_transports[0].frames) == 1

            socket.send_json({"type": "audio_end", "turn_id": "turn-1"})
            socket.send_json({"type": "session_end"})
            assert tts_calls == ["हाँ"]

        with client.websocket_connect(
            "/v1/session", headers={"origin": "https://not-allowed.test"}
        ) as socket:
            assert socket.receive_json()["code"] == "origin_rejected"

    default_origin_app = create_app(
        settings(tmp_path / "default-origin", allowed_origins=frozenset()),
        stt_transport_factory=make_stt,
        tts_transport_factory=lambda: FakeTtsTransport([]),
    )
    with TestClient(default_origin_app) as client:
        with client.websocket_connect(
            "/v1/session", headers={"origin": "https://extension.test"}
        ) as socket:
            assert socket.receive_json()["code"] == "origin_rejected"


def test_hinglish_session_uses_prisma_english_locale(tmp_path: Path) -> None:
    stt_languages: list[str] = []

    def make_stt(language: str) -> FakeSttTransport:
        stt_languages.append(language)
        return FakeSttTransport()

    app = create_app(
        settings(tmp_path),
        stt_transport_factory=make_stt,
        tts_transport_factory=lambda: FakeTtsTransport([]),
    )
    with TestClient(app) as client:
        with client.websocket_connect(
            "/v1/session", headers={"origin": "https://extension.test"}
        ) as socket:
            socket.send_json(
                {
                    "type": "hello",
                    "protocol_version": 1,
                    "session_token": "test-token",
                    "language": "hi-en",
                    "mode": "echo",
                }
            )
            assert socket.receive_json()["type"] == "ready"
            socket.send_json({"type": "audio_start", "turn_id": "turn-hinglish"})
            socket.send_bytes(bytes(1_024))
            assert socket.receive_json()["type"] == "transcript"
            assert socket.receive_json()["type"] == "transcript"
            assert socket.receive_json()["type"] == "tts_start"
            assert socket.receive_bytes() == b"\x01\x00"
            assert socket.receive_json()["type"] == "tts_end"

    assert stt_languages == ["en-IN"]


def test_assistant_mode_uses_context_reasoner_and_emits_safe_action(tmp_path: Path) -> None:
    tts_calls: list[str] = []
    app = create_app(
        settings(tmp_path),
        stt_transport_factory=lambda _language: FakeSttTransport(),
        tts_transport_factory=lambda: FakeTtsTransport(tts_calls),
        reasoner=FakeAssistantReasoner(),
    )
    with TestClient(app) as client:
        with client.websocket_connect(
            "/v1/session", headers={"origin": "https://extension.test"}
        ) as socket:
            socket.send_json(
                {
                    "type": "hello",
                    "protocol_version": 1,
                    "session_token": "test-token",
                    "language": "hi-IN",
                    "mode": "assistant",
                }
            )
            assert socket.receive_json()["type"] == "ready"
            socket.send_json(
                {
                    "type": "context_update",
                    "snapshot": {
                        "url_host": "synthetic.example",
                        "title": "Synthetic form",
                        "lang": "hi",
                        "viewport": {"w": 800, "h": 600, "scrollY": 0, "scrollMax": 0},
                        "elements": [
                            {
                                "id": "e1",
                                "tag": "input",
                                "type": "text",
                                "name": "Name",
                                "rect": [0, 0, 100, 30],
                                "state": ["empty"],
                                "value": "",
                                "in_view": True,
                                "required": True,
                                "sensitive": False,
                            }
                        ],
                        "headings": [],
                        "text_blocks": [],
                        "forms": [],
                        "flags": {"truncated": False},
                        "estimated_tokens": 20,
                    },
                }
            )
            socket.send_json({"type": "audio_start", "turn_id": "assistant-turn"})
            socket.send_bytes(bytes(1_024))
            assert socket.receive_json()["type"] == "transcript"
            assert socket.receive_json()["type"] == "transcript"
            assistant = socket.receive_json()
            assert assistant["type"] == "assistant"
            assert assistant["highlight_id"] == "e1"
            assert assistant["action"]["type"] == "fill"
            assert socket.receive_json()["type"] == "tts_start"
            assert socket.receive_bytes() == b"\x01\x00"
            assert socket.receive_bytes() == b"\x01\x00"
            assert socket.receive_bytes() == b"\x01\x00"
            assert socket.receive_json()["type"] == "tts_end"



def test_stt_provider_rejection_is_a_turn_error(tmp_path: Path) -> None:
    app = create_app(
        settings(tmp_path),
        stt_transport_factory=lambda _language: PolicySttTransport(),
        tts_transport_factory=lambda: FakeTtsTransport([]),
    )
    with TestClient(app) as client:
        with client.websocket_connect(
            "/v1/session", headers={"origin": "https://extension.test"}
        ) as socket:
            socket.send_json(
                {
                    "type": "hello",
                    "protocol_version": 1,
                    "session_token": "test-token",
                    "language": "hi-IN",
                    "mode": "echo",
                }
            )
            assert socket.receive_json()["type"] == "ready"
            socket.send_json({"type": "audio_start", "turn_id": "turn-policy"})
            socket.send_bytes(bytes(1_024))
            assert socket.receive_json() == {
                "type": "error",
                "code": "stt_provider_rejected",
                "message": "Speech recognition rejected the language or session settings.",
            }
            socket.send_json({"type": "audio_start", "turn_id": "turn-next"})
            socket.send_bytes(bytes(1_024))
            assert socket.receive_json()["code"] == "stt_provider_rejected"


@pytest.mark.asyncio
async def test_stt_without_final_transcript_returns_bounded_error(tmp_path: Path) -> None:
    transport = SilentSttTransport()
    app = create_app(
        settings(tmp_path),
        stt_transport_factory=lambda _language: transport,
        tts_transport_factory=lambda: FakeTtsTransport([]),
    )
    with TestClient(app) as client:
        with client.websocket_connect(
            "/v1/session", headers={"origin": "https://extension.test"}
        ) as socket:
            socket.send_json(
                {
                    "type": "hello",
                    "protocol_version": 1,
                    "session_token": "test-token",
                    "language": "hi-IN",
                    "mode": "echo",
                }
            )
            assert socket.receive_json()["type"] == "ready"
            socket.send_json({"type": "audio_start", "turn_id": "turn-timeout"})
            socket.send_bytes(bytes(1_024))
            socket.send_json({"type": "audio_end", "turn_id": "turn-timeout"})

            error = socket.receive_json()
            assert error == {
                "type": "error",
                "code": "stt_timeout",
                "message": "I could not understand that. Please try again slowly.",
            }
            assert len(transport.frames) == 33

def test_auth_rate_daily_and_credit_limits(tmp_path: Path) -> None:
    base_kwargs = {
        "stt_transport_factory": lambda _language: FakeSttTransport(),
        "tts_transport_factory": lambda: FakeTtsTransport([]),
    }
    with TestClient(create_app(settings(tmp_path / "auth"), **base_kwargs)) as client:
        with client.websocket_connect(
            "/v1/session", headers={"origin": "https://extension.test"}
        ) as socket:
            socket.send_json(
                {
                    "type": "hello",
                    "protocol_version": 1,
                    "session_token": "wrong",
                    "language": "hi-IN",
                    "mode": "echo",
                }
            )
            assert socket.receive_json()["code"] == "unauthorized"

    rate_app = create_app(
        settings(tmp_path / "rate", rate_limit_per_minute=1), **base_kwargs
    )
    with TestClient(rate_app) as client:
        with client.websocket_connect(
            "/v1/session", headers={"origin": "https://extension.test"}
        ) as first:
            first.send_json(
                {
                    "type": "hello",
                    "protocol_version": 1,
                    "session_token": "test-token",
                    "language": "hi-IN",
                    "mode": "echo",
                }
            )
            assert first.receive_json()["type"] == "ready"
        with client.websocket_connect(
            "/v1/session", headers={"origin": "https://extension.test"}
        ) as second:
            second.send_json(
                {
                    "type": "hello",
                    "protocol_version": 1,
                    "session_token": "test-token",
                    "language": "hi-IN",
                    "mode": "echo",
                }
            )
            assert second.receive_json()["code"] == "rate_limited"

    hello = {
        "type": "hello",
        "protocol_version": 1,
        "session_token": "test-token",
        "language": "hi-IN",
        "mode": "echo",
    }
    for name, limit_field, expected in (
        ("daily", {"daily_call_cap": 0}, "daily_cap"),
        ("credit", {"total_credit_cap": 0.00001}, "credit_cap"),
    ):
        limited_app = create_app(settings(tmp_path / name, **limit_field), **base_kwargs)
        with TestClient(limited_app) as client:
            with client.websocket_connect(
                "/v1/session", headers={"origin": "https://extension.test"}
            ) as socket:
                socket.send_json(hello)
                assert socket.receive_json()["type"] == "ready"
                socket.send_json({"type": "audio_start", "turn_id": "turn-1"})
                socket.send_bytes(bytes(1_024))
                assert socket.receive_json()["code"] == expected
