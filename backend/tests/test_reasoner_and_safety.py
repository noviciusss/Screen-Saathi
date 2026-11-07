from __future__ import annotations

import json

import httpx
import pytest

from screen_saathi.action_gate import gate_response, validate_action
from screen_saathi.context import PageSnapshot, SnapshotElement
from screen_saathi.reasoner import OpenAICompatibleReasoner, ReasonRequest
from screen_saathi.reasoner_contract import Action, ReasonerResponse


def snapshot(element: SnapshotElement) -> PageSnapshot:
    return PageSnapshot(elements=[element])


def element(**overrides: object) -> SnapshotElement:
    values: dict[str, object] = {
        "id": "e1",
        "tag": "input",
        "type": "text",
        "name": "Name",
        "rect": (0, 0, 100, 30),
    }
    values.update(overrides)
    return SnapshotElement.model_validate(values)


def test_action_gate_rejects_protected_unknown_and_submit_controls() -> None:
    protected = Action(type="fill", target_id="e1", value="synthetic")
    assert not validate_action(protected, snapshot(element(sensitive=True)))[0]
    assert not validate_action(protected, snapshot(element(state=["disabled"])))[0]
    assert not validate_action(protected, snapshot(element(name="Pay now", type="button")))[0]
    assert not validate_action(
        Action(type="fill", target_id="missing", value="x"), snapshot(element())
    )[0]


def test_action_gate_preserves_safe_fill_and_removes_unsafe_model_action() -> None:
    response = ReasonerResponse(
        speak="मैं नाम भर दूँ?",
        confidence="high",
        action=Action(type="fill", target_id="e1", value="Synthetic User"),
    )
    safe = gate_response(response, snapshot(element()))
    assert safe.action is not None

    unsafe = gate_response(
        response.model_copy(update={"action": Action(type="fill", target_id="e1", value="x")}),
        snapshot(element(sensitive=True)),
    )
    assert unsafe.action is None
    assert "hidden" in unsafe.speak.lower()


@pytest.mark.asyncio
async def test_openai_compatible_reasoner_repairs_invalid_json_once() -> None:
    calls = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        assert request.url.path == "/openai/v1/chat/completions"
        payload = json.loads(request.content)
        assert payload["model"] == "synthetic-groq-model"
        assert "<page_data>" in payload["messages"][1]["content"]
        content = "not-json" if calls == 1 else json.dumps(
            {"speak": "यह कृत्रिम पेज है।", "confidence": "high", "highlight_id": None,
             "action": None, "scam_verdict": None, "followup": None},
            ensure_ascii=False,
        )
        return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    reasoner = OpenAICompatibleReasoner(
        provider="groq",
        model="synthetic-groq-model",
        api_key="synthetic-key",
        base_url="https://api.groq.com/openai/v1",
        client=client,
    )
    result = await reasoner.respond(ReasonRequest("यह पेज क्या है?", "hi-IN", None))
    await client.aclose()

    assert calls == 2
    assert result.speak == "यह कृत्रिम पेज है।"
