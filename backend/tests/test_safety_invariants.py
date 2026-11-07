from __future__ import annotations

import json

from screen_saathi.action_gate import validate_action
from screen_saathi.context import PageSnapshot, SnapshotElement
from screen_saathi.hooks import JsonlUsageLogger, UsageEvent
from screen_saathi.reasoner_contract import Action


def element(**updates: object) -> SnapshotElement:
    values: dict[str, object] = {
        "id": "e1",
        "tag": "input",
        "type": "text",
        "name": "Safe field",
        "rect": (0, 0, 100, 30),
    }
    values.update(updates)
    return SnapshotElement.model_validate(values)


def page(item: SnapshotElement) -> PageSnapshot:
    return PageSnapshot(elements=[item])


def test_every_submit_like_control_is_rejected() -> None:
    for name in ("Submit", "Pay now", "Send OTP", "Confirm transfer", "Delete record", "भुगतान"):
        allowed, reason = validate_action(
            Action(type="focus", target_id="e1"), page(element(name=name, type="button"))
        )
        assert not allowed
        assert reason


def test_password_otp_card_hidden_disabled_and_unknown_are_rejected() -> None:
    action = Action(type="fill", target_id="e1", value="Synthetic value")
    for updates in (
        {"sensitive": True},
        {"autocomplete": "one-time-code"},
        {"autocomplete": "cc-number"},
        {"state": ["hidden"]},
        {"state": ["disabled"]},
    ):
        allowed, _ = validate_action(action, page(element(**updates)))
        assert not allowed
    allowed, _ = validate_action(
        action.model_copy(update={"target_id": "missing"}), page(element())
    )
    assert not allowed


def test_usage_log_contains_timings_and_sizes_only(tmp_path) -> None:
    path = tmp_path / "usage.jsonl"
    JsonlUsageLogger(path)(
        UsageEvent(
            operation="stt",
            request_id="synthetic-request",
            duration_ms=12.5,
            estimated_credits=0.0,
            bytes_sent=1024,
            bytes_received=0,
            cache_hit=False,
            timestamp="2026-11-02T00:00:00Z",
        )
    )
    record = json.loads(path.read_text(encoding="utf-8"))
    assert "transcript" not in record
    assert "text" not in record
    assert record["bytes_sent"] == 1024
