"""Environment-backed settings for the voice session service."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


def _int_env(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None or not value.strip():
        return default
    parsed = int(value)
    if parsed < 0:
        raise ValueError(f"{name} must be non-negative")
    return parsed


def _float_env(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None or not value.strip():
        return default
    parsed = float(value)
    if parsed < 0:
        raise ValueError(f"{name} must be non-negative")
    return parsed


def _origins_env() -> frozenset[str]:
    raw = os.getenv("SAATHI_ALLOWED_ORIGINS", "")
    return frozenset(origin.strip() for origin in raw.split(",") if origin.strip())


@dataclass(frozen=True, slots=True)
class Settings:
    """Runtime configuration with measured Gnani cost defaults."""

    session_token: str = ""
    allowed_origins: frozenset[str] = frozenset()
    rate_limit_per_minute: int = 60
    daily_call_cap: int = 1_000
    total_credit_cap: float = 4_000.0
    stt_credits_per_second: float = 0.0091
    tts_credits_per_100_chars: float = 0.2777
    session_max_seconds: float = 900.0
    gnani_api_key: str = ""
    stt_endpoint: str = "wss://api.vachana.ai/stt/v4/stream"
    tts_endpoint: str = "wss://api.vachana.ai/api/v1/tts"
    usage_log_path: Path = Path("logs") / "usage.jsonl"
    llm_provider: str = ""
    llm_model: str = ""
    llm_api_key: str = ""
    llm_base_url: str = ""
    reasoner_supports_vision: bool = False

    @classmethod
    def from_env(cls) -> Settings:
        """Load settings without logging or otherwise exposing credentials."""

        project_root = Path(__file__).resolve().parents[3]
        load_dotenv(project_root / ".env")

        return cls(
            session_token=os.getenv("SAATHI_SESSION_TOKEN", ""),
            allowed_origins=_origins_env(),
            rate_limit_per_minute=_int_env("SAATHI_RATE_LIMIT_PER_MINUTE", 60),
            daily_call_cap=_int_env("GNANI_DAILY_CALL_CAP", 1_000),
            total_credit_cap=_float_env("GNANI_TOTAL_CREDIT_CAP", 4_000.0),
            stt_credits_per_second=_float_env("GNANI_STT_CREDITS_PER_SECOND", 0.0091),
            tts_credits_per_100_chars=_float_env(
                "GNANI_TTS_CREDITS_PER_100_CHARS", 0.2777
            ),
            session_max_seconds=_float_env("SAATHI_SESSION_MAX_SECONDS", 900.0),
            gnani_api_key=os.getenv("GNANI_API_KEY", ""),
            stt_endpoint=os.getenv(
                "GNANI_STT_ENDPOINT", "wss://api.vachana.ai/stt/v4/stream"
            ),
            tts_endpoint=os.getenv(
                "GNANI_TTS_ENDPOINT", "wss://api.vachana.ai/api/v1/tts"
            ),
            usage_log_path=Path(os.getenv("SAATHI_USAGE_LOG", "logs/usage.jsonl")),
            llm_provider=os.getenv("LLM_PROVIDER", "")
            or ("groq" if os.getenv("GROQ_API_KEY") else ""),
            llm_model=os.getenv("LLM_MODEL", "") or os.getenv("GROQ_MODEL", ""),
            llm_api_key=os.getenv("LLM_API_KEY", "") or os.getenv("GROQ_API_KEY", ""),
            llm_base_url=os.getenv("LLM_BASE_URL", "") or os.getenv("GROQ_BASE_URL", ""),
            reasoner_supports_vision=os.getenv("REASONER_SUPPORTS_VISION", "0") == "1",
        )

    def origin_allowed(self, origin: str | None) -> bool:
        """Allow absent origins for non-browser clients, but reject by default otherwise."""

        return not origin or origin in self.allowed_origins
