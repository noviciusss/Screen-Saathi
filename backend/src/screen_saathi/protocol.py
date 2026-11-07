"""Pydantic models for the fixed extension/backend WebSocket contract."""

from __future__ import annotations

import json
from typing import Annotated, Literal, TypeAlias

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter

from .context import PageSnapshot
from .reasoner_contract import Action, ScamVerdict

PROTOCOL_VERSION = 1
SupportedLanguage = Literal["hi-IN", "en-IN", "hi-en"]


class ProtocolModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class HelloMessage(ProtocolModel):
    type: Literal["hello"]
    protocol_version: Literal[1]
    session_token: str = Field(min_length=1)
    language: SupportedLanguage
    mode: Literal["echo", "assistant"]


class AudioStartMessage(ProtocolModel):
    type: Literal["audio_start"]
    turn_id: str = Field(min_length=1)


class AudioEndMessage(ProtocolModel):
    type: Literal["audio_end"]
    turn_id: str = Field(min_length=1)


class PingMessage(ProtocolModel):
    """Optional health control retained for harmless non-extension clients."""

    type: Literal["ping"]


class SessionEndMessage(ProtocolModel):
    """Optional shutdown control; it is never required by the extension."""

    type: Literal["session_end"]


class ContextUpdateMessage(ProtocolModel):
    type: Literal["context_update"]
    snapshot: PageSnapshot
    selection: str | None = Field(default=None, max_length=20_000)
    guided_field_id: str | None = None
    guided_field_name: str | None = None


ClientMessage: TypeAlias = Annotated[
    HelloMessage
    | AudioStartMessage
    | AudioEndMessage
    | ContextUpdateMessage
    | PingMessage
    | SessionEndMessage,
    Field(discriminator="type"),
]
_CLIENT_MESSAGE_ADAPTER = TypeAdapter(ClientMessage)


class ReadyMessage(ProtocolModel):
    type: Literal["ready"] = "ready"
    session_id: str


class TranscriptMessage(ProtocolModel):
    type: Literal["transcript"] = "transcript"
    turn_id: str
    text: str = Field(min_length=1)
    final: bool
    latency_ms: float = Field(ge=0)


class TtsStartMessage(ProtocolModel):
    type: Literal["tts_start"] = "tts_start"
    turn_id: str
    sample_rate: int = Field(ge=8_000, le=48_000)
    encoding: Literal["linear_pcm"]


class TtsEndMessage(ProtocolModel):
    type: Literal["tts_end"] = "tts_end"
    turn_id: str


class AssistantMessage(ProtocolModel):
    type: Literal["assistant"] = "assistant"
    turn_id: str
    speak: str
    highlight_id: str | None = None
    action: Action | None = None
    scam_verdict: ScamVerdict | None = None
    confidence: Literal["high", "medium", "low"]
    followup: str | None = None


class ErrorMessage(ProtocolModel):
    type: Literal["error"] = "error"
    code: str
    message: str


ServerMessage: TypeAlias = Annotated[
    ReadyMessage
    | TranscriptMessage
    | AssistantMessage
    | TtsStartMessage
    | TtsEndMessage
    | ErrorMessage,
    Field(discriminator="type"),
]


class AudioConfig(ProtocolModel):
    sample_rate: int = Field(default=24_000, ge=8_000, le=48_000)
    num_channels: Literal[1] = 1
    sample_width: Literal[2] = 2
    encoding: Literal["linear_pcm"] = "linear_pcm"
    container: Literal["raw"] = "raw"


class TtsRequest(ProtocolModel):
    """Internal Timbre request; it is not a client wire message."""

    request_id: str = Field(min_length=1, max_length=100)
    text: str = Field(min_length=1, max_length=10_000)
    voice: str = Field(min_length=1, max_length=100)
    model: str = Field(default="timbre-v2.5", min_length=1, max_length=100)
    language: str = Field(min_length=2, max_length=20)
    speed: float = Field(default=1.0, gt=0.0, le=4.0)
    audio_config: AudioConfig = Field(default_factory=AudioConfig)

    def gnani_payload(self) -> dict[str, object]:
        return {
            "text": self.text,
            "voice": self.voice,
            "model": self.model,
            "language": self.language,
            "speed": self.speed,
            "audio_config": self.audio_config.model_dump(mode="json"),
        }


def parse_client_message(raw: str) -> ClientMessage:
    """Parse fixed-contract JSON and reject unknown fields or message types."""

    return _CLIENT_MESSAGE_ADAPTER.validate_json(raw)


def model_json(model: BaseModel) -> str:
    return model.model_dump_json(exclude_none=True)


def parse_json_object(raw: str | bytes) -> dict[str, object] | None:
    try:
        value = json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        return None
    return value if isinstance(value, dict) else None


__all__ = [
    "AudioConfig",
    "AudioEndMessage",
    "AudioStartMessage",
    "AssistantMessage",
    "ClientMessage",
    "ContextUpdateMessage",
    "ErrorMessage",
    "HelloMessage",
    "PingMessage",
    "PROTOCOL_VERSION",
    "ProtocolModel",
    "ReadyMessage",
    "ServerMessage",
    "SessionEndMessage",
    "SupportedLanguage",
    "TranscriptMessage",
    "TtsEndMessage",
    "TtsRequest",
    "TtsStartMessage",
    "model_json",
    "parse_client_message",
    "parse_json_object",
]
