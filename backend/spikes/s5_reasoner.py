"""Measure configured reasoner JSON validity and latency without Gnani calls."""

from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv

from screen_saathi.reasoner_contract import ReasonerResponse

RUNS = 20
TIMEOUT_SECONDS = 60.0
BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[2]


def endpoint(base_url: str) -> str:
    cleaned = base_url.rstrip("/")
    return cleaned if cleaned.endswith("/chat/completions") else f"{cleaned}/chat/completions"


def synthetic_messages() -> list[dict[str, str]]:
    snapshot = {
        "url_host": "synthetic.example",
        "title": "सेवा अनुरोध",
        "lang": "hi",
        "elements": [
            {"id": "e1", "tag": "input", "role": "textbox", "name": "नाम", "state": ["empty"]},
            {"id": "e2", "tag": "button", "role": "button", "name": "आगे बढ़ें", "state": []},
        ],
        "text_blocks": [{"id": "t1", "text": "कृत्रिम सेवा अनुरोध पृष्ठ"}],
    }
    system = (BACKEND_ROOT / "prompts" / "system.md").read_text(encoding="utf-8")
    user = (
        "भाषा: हिन्दी\n"
        "प्रश्न: यह पेज किस लिए है?\n"
        f"<page_data>{json.dumps(snapshot, ensure_ascii=False)}</page_data>"
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


async def stream_content(response: httpx.Response) -> AsyncIterator[str]:
    async for line in response.aiter_lines():
        if not line.startswith("data:"):
            continue
        payload = line.removeprefix("data:").strip()
        if payload == "[DONE]":
            return
        try:
            parsed: dict[str, Any] = json.loads(payload)
        except json.JSONDecodeError:
            continue
        choices = parsed.get("choices")
        if not isinstance(choices, list) or not choices:
            continue
        delta = choices[0].get("delta", {})
        if isinstance(delta, dict) and isinstance(delta.get("content"), str):
            yield delta["content"]


async def run() -> int:
    load_dotenv(PROJECT_ROOT / ".env")
    provider = (
        os.getenv("LLM_PROVIDER", "") or ("groq" if os.getenv("GROQ_API_KEY") else "")
    ).strip()
    model = (os.getenv("LLM_MODEL", "") or os.getenv("GROQ_MODEL", "")).strip()
    api_key = (os.getenv("LLM_API_KEY", "") or os.getenv("GROQ_API_KEY", "")).strip()
    base_url = (os.getenv("LLM_BASE_URL", "") or os.getenv("GROQ_BASE_URL", "")).strip()
    vision = os.getenv("REASONER_SUPPORTS_VISION", "unknown").strip() or "unknown"
    if not all((provider, model, api_key, base_url)):
        print("S5 blocked: LLM_PROVIDER, LLM_MODEL, LLM_API_KEY, and LLM_BASE_URL are required")
        return 2

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {
        "model": model,
        "messages": synthetic_messages(),
        "temperature": 0,
        "stream": True,
        "response_format": {"type": "json_object"},
    }
    valid = 0
    first_token_ms: list[float] = []
    total_ms: list[float] = []
    errors = 0

    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
        for _ in range(RUNS):
            started = time.perf_counter()
            first_token: float | None = None
            content_parts: list[str] = []
            try:
                async with client.stream(
                    "POST", endpoint(base_url), headers=headers, json=payload
                ) as response:
                    response.raise_for_status()
                    async for part in stream_content(response):
                        if first_token is None:
                            first_token = time.perf_counter()
                        content_parts.append(part)
            except (httpx.HTTPError, TimeoutError):
                errors += 1
                continue
            total_ms.append((time.perf_counter() - started) * 1000)
            if first_token is not None:
                first_token_ms.append((first_token - started) * 1000)
            try:
                ReasonerResponse.model_validate_json("".join(content_parts))
            except (ValueError, json.JSONDecodeError):
                continue
            valid += 1

    def median(values: list[float]) -> float | None:
        if not values:
            return None
        ordered = sorted(values)
        middle = len(ordered) // 2
        if len(ordered) % 2:
            return round(ordered[middle], 2)
        return round((ordered[middle - 1] + ordered[middle]) / 2, 2)

    print(f"provider={provider}")
    print(f"runs={RUNS} valid={valid} errors={errors} validity_rate={valid / RUNS:.3f}")
    print(f"time_to_first_token_p50_ms={median(first_token_ms)}")
    print(f"total_latency_p50_ms={median(total_ms)}")
    print(f"vision_support_flag={vision}")
    return 0 if valid == RUNS else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(run()))
