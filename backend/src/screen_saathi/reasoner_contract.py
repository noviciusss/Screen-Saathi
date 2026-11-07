"""Shared Phase 0 reasoner request/response contract."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Action(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["fill", "select", "check", "focus"]
    target_id: str
    value: str | None = None
    option: str | None = None
    checked: bool | None = None


class ScamVerdict(BaseModel):
    model_config = ConfigDict(extra="forbid")

    level: Literal["likely_scam", "suspicious", "looks_ok"]
    reasons: list[str] = Field(min_length=1, max_length=3)


class ReasonerResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    speak: str
    highlight_id: str | None = None
    action: Action | None = None
    scam_verdict: ScamVerdict | None = None
    confidence: Literal["high", "medium", "low"]
    followup: str | None = None
