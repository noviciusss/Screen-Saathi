"""Content-free timing and usage hooks used by the session pipeline."""

from __future__ import annotations

import inspect
import json
import threading
import time
from collections.abc import Awaitable, Callable
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path

UsageHook = Callable[["UsageEvent"], None | Awaitable[None]]
TimestampHook = Callable[[str, float], None | Awaitable[None]]


@dataclass(frozen=True, slots=True)
class UsageEvent:
    operation: str
    request_id: str | None
    duration_ms: float
    estimated_credits: float
    bytes_sent: int
    bytes_received: int
    cache_hit: bool
    timestamp: str
    first_chunk_ms: float | None = None


async def invoke_usage_hook(hook: UsageHook | None, event: UsageEvent) -> None:
    if hook is None:
        return
    result = hook(event)
    if inspect.isawaitable(result):
        await result


async def invoke_timestamp_hook(
    hook: TimestampHook | None, stage: str, timestamp: float | None = None
) -> None:
    if hook is None:
        return
    result = hook(stage, time.time() if timestamp is None else timestamp)
    if inspect.isawaitable(result):
        await result


class JsonlUsageLogger:
    """Append only timing/size records; transcript and TTS text never enter the log."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self._lock = threading.Lock()

    def __call__(self, event: UsageEvent) -> None:
        record = asdict(event)
        record["kind"] = "usage"
        with self._lock:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with self.path.open("a", encoding="utf-8") as output:
                output.write(json.dumps(record, separators=(",", ":")) + "\n")


def utc_timestamp() -> str:
    return datetime.now(UTC).isoformat()
