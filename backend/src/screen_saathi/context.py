"""Validated page context shared by the reasoner and action safety gate."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class SnapshotRect(BaseModel):
    model_config = ConfigDict(extra="forbid")

    values: tuple[float, float, float, float]


class SnapshotElement(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    tag: str
    role: str | None = None
    type: str | None = None
    name: str
    hint: str | None = None
    required: bool = False
    value: str = ""
    state: list[str] = Field(default_factory=list)
    rect: tuple[float, float, float, float]
    in_view: bool = False
    form: str | None = None
    cross_origin_frame: bool = False
    sensitive: bool = False
    autocomplete: str | None = None
    options: list[str] | None = None


class SnapshotHeading(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    level: int
    text: str


class SnapshotTextBlock(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    text: str
    in_view: bool = False


class SnapshotForm(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    fields: list[str] = Field(default_factory=list)
    submit: str | None = None


class PageSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    url_host: str = ""
    title: str = ""
    lang: str = "unknown"
    viewport: dict[str, int] = Field(default_factory=dict)
    headings: list[SnapshotHeading] = Field(default_factory=list)
    elements: list[SnapshotElement] = Field(default_factory=list, max_length=250)
    text_blocks: list[SnapshotTextBlock] = Field(default_factory=list)
    forms: list[SnapshotForm] = Field(default_factory=list)
    flags: dict[str, bool] = Field(default_factory=dict)
    estimated_tokens: int = 0


class PageContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    snapshot: PageSnapshot
    selection: str | None = Field(default=None, max_length=20_000)
    guided_field_id: str | None = None
    guided_field_name: str | None = None
