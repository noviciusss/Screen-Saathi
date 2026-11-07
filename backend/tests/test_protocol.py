import pytest
from pydantic import ValidationError

from screen_saathi.protocol import (
    AudioEndMessage,
    AudioStartMessage,
    HelloMessage,
    ReadyMessage,
    TranscriptMessage,
    TtsEndMessage,
    TtsStartMessage,
    parse_client_message,
)


def test_fixed_client_protocol_models_parse_exact_messages() -> None:
    hello = parse_client_message(
        '{"type":"hello","protocol_version":1,"session_token":"synthetic-token",'
        '"language":"hi-IN","mode":"echo"}'
    )
    audio_start = parse_client_message('{"type":"audio_start","turn_id":"turn-1"}')
    audio_end = parse_client_message('{"type":"audio_end","turn_id":"turn-1"}')

    assert isinstance(hello, HelloMessage)
    assert isinstance(audio_start, AudioStartMessage)
    assert isinstance(audio_end, AudioEndMessage)


def test_fixed_server_models_have_no_base64_audio_message() -> None:
    ready = ReadyMessage(session_id="session-1")
    transcript = TranscriptMessage(
        turn_id="turn-1", text="नमस्ते", final=True, latency_ms=42
    )
    tts_start = TtsStartMessage(
        turn_id="turn-1", sample_rate=24_000, encoding="linear_pcm"
    )
    tts_end = TtsEndMessage(turn_id="turn-1")

    assert ready.type == "ready"
    assert transcript.model_dump() == {
        "type": "transcript",
        "turn_id": "turn-1",
        "text": "नमस्ते",
        "final": True,
        "latency_ms": 42.0,
    }
    assert tts_start.encoding == "linear_pcm"
    assert tts_end.type == "tts_end"


@pytest.mark.parametrize(
    "message",
    [
        '{"type":"hello","protocol_version":2,"session_token":"token",'
        '"language":"hi-IN","mode":"echo"}',
        '{"type":"hello","protocol_version":1,"session_token":"token",'
        '"language":"ta-IN","mode":"echo"}',
        '{"type":"hello","protocol_version":1,"session_token":"token",'
        '"language":"hi-IN","mode":"fill"}',
        '{"type":"audio_start","turn_id":""}',
    ],
)
def test_fixed_protocol_rejects_invalid_version_language_mode_or_turn(message: str) -> None:
    with pytest.raises(ValidationError):
        parse_client_message(message)
