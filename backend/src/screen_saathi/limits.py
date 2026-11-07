"""In-process connection, daily-call, and measured-credit limits."""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, date, datetime


class LimitExceeded(Exception):
    """A request cannot consume more configured service budget."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True, slots=True)
class LimitSnapshot:
    minute_connections: int
    daily_calls: int
    total_credits: float


class UsageLimits:
    """Small process-local limiter suitable for one backend worker."""

    def __init__(
        self,
        rate_limit_per_minute: int,
        daily_call_cap: int,
        total_credit_cap: float,
        *,
        clock: Callable[[], float] = time.monotonic,
        today: Callable[[], date] = lambda: datetime.now(UTC).date(),
    ) -> None:
        self.rate_limit_per_minute = rate_limit_per_minute
        self.daily_call_cap = daily_call_cap
        self.total_credit_cap = total_credit_cap
        self._clock = clock
        self._today = today
        self._minute_started = clock()
        self._connection_counts: dict[str, int] = {}
        self._daily_date: date = today()
        self._daily_calls = 0
        self._total_credits = 0.0

    def allow_connection(self, identity: str) -> None:
        now = self._clock()
        if now - self._minute_started >= 60:
            self._minute_started = now
            self._connection_counts.clear()
        count = self._connection_counts.get(identity, 0)
        if count >= self.rate_limit_per_minute:
            raise LimitExceeded("rate_limited", "Too many session connections; please wait.")
        self._connection_counts[identity] = count + 1

    def reserve(
        self,
        operation: str,
        credits: float,
        *,
        call_count: int = 1,
    ) -> None:
        if credits < 0 or call_count < 0:
            raise ValueError("usage reservations must be non-negative")
        current_day = self._today()
        if current_day != self._daily_date:
            self._daily_date = current_day
            self._daily_calls = 0
        if self._daily_calls + call_count > self.daily_call_cap:
            raise LimitExceeded("daily_cap", "Today’s voice-service limit has been reached.")
        if self._total_credits + credits > self.total_credit_cap + 1e-12:
            raise LimitExceeded("credit_cap", "The voice-service credit limit has been reached.")
        self._daily_calls += call_count
        self._total_credits += credits

    def snapshot(self) -> LimitSnapshot:
        return LimitSnapshot(
            minute_connections=sum(self._connection_counts.values()),
            daily_calls=self._daily_calls,
            total_credits=round(self._total_credits, 9),
        )
