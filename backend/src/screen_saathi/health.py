"""Minimal health response used by the scaffold check."""

from typing import Final

STATUS: Final[str] = "ok"


def health_payload() -> dict[str, str]:
    """Return a safe, content-free health payload."""

    return {"status": STATUS}
