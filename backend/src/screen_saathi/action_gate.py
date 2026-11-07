"""Server-side validation for all model-proposed page actions."""

from __future__ import annotations

import re

from .context import PageSnapshot, SnapshotElement
from .reasoner_contract import Action, ReasonerResponse

SUBMIT_LIKE = re.compile(
    r"(?:submit|pay|send|confirm|delete|transfer|जमा|भुगतान|भेजें|पुष्टि|हटाएं|हटाएँ)",
    re.IGNORECASE,
)


def _submit_like(element: SnapshotElement) -> bool:
    text = " ".join(filter(None, (element.name, element.hint, element.role, element.type)))
    return element.type in {"submit", "button"} or SUBMIT_LIKE.search(text) is not None


def validate_action(action: Action, snapshot: PageSnapshot) -> tuple[bool, str]:
    element = next((item for item in snapshot.elements if item.id == action.target_id), None)
    if element is None:
        return False, "That page control is no longer available."
    autocomplete = (element.autocomplete or "").lower()
    protected = (
        element.sensitive
        or (element.type or "").lower() == "password"
        or autocomplete == "one-time-code"
        or autocomplete.startswith("cc-")
        or "hidden" in element.state
        or "disabled" in element.state
    )
    if protected:
        return False, "I will not use a hidden, disabled, password, OTP, or card field."
    if _submit_like(element):
        return False, "Please press that submit or payment button yourself."
    if action.type == "fill" and action.value is None:
        return False, "The requested field value was empty."
    if action.type == "select" and action.option is None:
        return False, "The requested option was empty."
    if action.type == "check" and action.checked is None:
        return False, "The requested checkbox state was empty."
    return True, ""


def gate_response(response: ReasonerResponse, snapshot: PageSnapshot | None) -> ReasonerResponse:
    if response.action is None or snapshot is None:
        return response
    valid, reason = validate_action(response.action, snapshot)
    if valid:
        return response
    return response.model_copy(
        update={"action": None, "speak": f"{reason} {response.speak}".strip()}
    )


__all__ = ["gate_response", "validate_action"]
