"""Run the guarded Gnani Timbre realtime TTS spike.

The full spike has exactly twelve explicitly printed requests across Hindi,
English, Hinglish, and Tamil. Use ``--list-only`` to inspect them. A live run
requires
``--confirm-live`` and is intentionally separate from automated tests.
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import json
import os
import sys
import time
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import websockets
from dotenv import load_dotenv

ENDPOINT = "wss://api.vachana.ai/api/v1/tts"
MODEL = "timbre-v2.5"
SAMPLE_RATE = 24_000
DEFAULT_OUTPUT_DIR = Path(__file__).with_name("artifacts") / "s2-tts"
CALIBRATION_MARKER = Path(__file__).with_name("artifacts") / "s2-calibration-complete.json"


@dataclass(frozen=True)
class TtsRequest:
    language: str
    voice: str
    text: str
    label: str
    container: str = "raw"

    def payload(self) -> dict[str, Any]:
        return {
            "text": self.text,
            "voice": self.voice,
            "model": MODEL,
            "language": self.language,
            "speed": 1.0,
            "audio_config": {
                "sample_rate": SAMPLE_RATE,
                "num_channels": 1,
                "sample_width": 2,
                "encoding": "linear_pcm",
                "container": self.container,
            },
        }


HINDI_SENTENCE = "यह एक कृत्रिम हिंदी वाक्य है। स्क्रीन साथी पेज समझाने में मदद करता है।"
ENGLISH_SENTENCE = "This is a synthetic English sentence for the Screen Saathi test."
HINGLISH_SENTENCE = "Yeh ek synthetic Hinglish sentence hai, Screen Saathi page samjhaata hai."
TAMIL_SENTENCE = "இது ஒரு செயற்கை தமிழ் வாக்கியம். ஸ்கிரீன் சாத்தி பக்கத்தை புரிந்துகொள்ள உதவும்."
TAMIL_NUMBER_DATE = (
    "இது செயற்கை சோதனை. தொகை இரண்டு ஆயிரத்து ஐநூறு ரூபாய், தேதி பத்து நவம்பர் "
    "இரண்டாயிரத்து இருபத்தாறு."
)


def full_requests() -> list[TtsRequest]:
    requests = [
        TtsRequest("hi-IN", "Nalini", HINDI_SENTENCE, "hi-nalini-sentence"),
        TtsRequest("hi-IN", "Deepak", HINDI_SENTENCE, "hi-deepak-sentence"),
        TtsRequest("hi-IN", "Nalini", "हाँ", "hi-nalini-haan"),
        TtsRequest("hi-IN", "Deepak", "नहीं", "hi-deepak-nahi"),
        TtsRequest("en-IN", "Kaveri", ENGLISH_SENTENCE, "en-kaveri-sentence"),
        TtsRequest("en-IN", "Pranav", ENGLISH_SENTENCE, "en-pranav-sentence"),
        TtsRequest("hi-en", "Poorvi", HINGLISH_SENTENCE, "hinglish-poorvi-sentence"),
        TtsRequest("hi-en", "Poorvi", "Haan, yeh synthetic test hai.", "hinglish-poorvi-short"),
        TtsRequest("ta-IN", "Asmita", TAMIL_SENTENCE, "ta-asmita-sentence"),
        TtsRequest("ta-IN", "Trisha", TAMIL_SENTENCE, "ta-trisha-sentence"),
        TtsRequest("ta-IN", "Asmita", TAMIL_NUMBER_DATE, "ta-asmita-number-date"),
        TtsRequest("ta-IN", "Trisha", TAMIL_NUMBER_DATE, "ta-trisha-number-date"),
    ]
    assert len(requests) == 12
    return requests


def calibration_request() -> TtsRequest:
    text = (
        "यह लगभग एक सौ अक्षरों का कृत्रिम कैलिब्रेशन वाक्य है ताकि समय और क्रेडिट "
        "का सुरक्षित अनुमान लगाया जा सके।"
    )
    return TtsRequest("hi-IN", "Nalini", text, "calibration")


def print_plan(requests: list[TtsRequest]) -> None:
    print(f"S2 request plan ({len(requests)} requests; no calls made):")
    for index, request in enumerate(requests, start=1):
        print(
            f"  {index}. label={request.label} language={request.language} "
            f"voice={request.voice} chars={len(request.text)} container={request.container}"
        )


def write_wav(path: Path, pcm: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        output.writeframes(pcm)


def append_usage(record: dict[str, Any], project_root: Path) -> None:
    log_path = project_root / "backend" / "logs" / "usage.jsonl"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as log:
        log.write(json.dumps(record, ensure_ascii=False) + "\n")


def calibration_completed() -> bool:
    if not CALIBRATION_MARKER.is_file():
        return False
    try:
        marker = json.loads(CALIBRATION_MARKER.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return False
    return marker.get("success") is True


async def run_request(
    request: TtsRequest, api_key: str, output_dir: Path, project_root: Path
) -> None:
    started = time.perf_counter()
    first_chunk_ms: float | None = None
    pcm_parts: list[bytes] = []
    server_error: str | None = None
    print(f"S2 starting label={request.label}")
    async with websockets.connect(
        ENDPOINT, additional_headers={"X-API-Key-ID": api_key}
    ) as socket:
        await socket.send(json.dumps(request.payload(), ensure_ascii=False))
        async for raw_message in socket:
            if not isinstance(raw_message, str):
                continue
            try:
                message = json.loads(raw_message)
            except json.JSONDecodeError:
                print("S2 server message was not JSON; ignored")
                continue
            if not isinstance(message, dict):
                continue
            kind = message.get("type", message.get("event", "unknown"))
            if kind == "audio":
                data = message.get("data")
                encoded = data.get("audio") if isinstance(data, dict) else None
                if not isinstance(encoded, str):
                    print("S2 audio event had no base64 payload")
                    continue
                if first_chunk_ms is None:
                    first_chunk_ms = (time.perf_counter() - started) * 1_000
                pcm_parts.append(base64.b64decode(encoded))
            elif kind == "error":
                server_error = str(message.get("message", message))
                print(f"S2 server error: {server_error}")
                break
            elif kind in {"complete", "done"}:
                break
            else:
                print(f"S2 server event: {kind}")
    if server_error is not None:
        raise RuntimeError(server_error)
    pcm = b"".join(pcm_parts)
    if not pcm:
        raise RuntimeError("Gnani returned no audio chunks")
    wav_path = output_dir / f"{request.label}.wav"
    write_wav(wav_path, pcm)
    total_ms = round((time.perf_counter() - started) * 1_000, 2)
    first_chunk = round(first_chunk_ms, 2) if first_chunk_ms is not None else None
    append_usage(
        {
            "kind": "gnani_spike",
            "spike": "s2_tts",
            "label": request.label,
            "language": request.language,
            "voice": request.voice,
            "text_chars": len(request.text),
            "audio_bytes": len(pcm),
            "duration_ms": total_ms,
            "first_chunk_ms": first_chunk,
        },
        project_root,
    )
    print(f"S2 complete label={request.label} first_chunk_ms={first_chunk} wav={wav_path}")


async def run(args: argparse.Namespace) -> int:
    project_root = Path(__file__).resolve().parents[2]
    load_dotenv(project_root / ".env")
    requests = [calibration_request()] if args.calibration else full_requests()
    print_plan(requests)
    if args.list_only:
        return 0
    if not args.confirm_live:
        print("S2 blocked: add --confirm-live to make network calls")
        return 2
    api_key = os.getenv("GNANI_API_KEY", "").strip()
    if not api_key:
        print("S2 blocked: GNANI_API_KEY is required locally")
        return 2
    if not args.calibration and not calibration_completed():
        print("S2 blocked: run the single --calibration call first and record its dashboard cost")
        return 2
    for request in requests:
        try:
            await run_request(request, api_key, args.output_dir, project_root)
        except (OSError, RuntimeError, ValueError, websockets.WebSocketException) as error:
            print(f"S2 failed without retry: {error}")
            return 1
    if args.calibration:
        CALIBRATION_MARKER.parent.mkdir(parents=True, exist_ok=True)
        CALIBRATION_MARKER.write_text(
            json.dumps(
                {
                    "success": True,
                    "text_chars": len(requests[0].text),
                    "recorded_at": time.time(),
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        print(
            "S2 calibration complete; stop and record the dashboard balance "
            "before any full batch."
        )
    return 0


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    result.add_argument(
        "--calibration", action="store_true", help="run only the single calibration request"
    )
    result.add_argument("--list-only", action="store_true")
    result.add_argument("--confirm-live", action="store_true")
    return result


if __name__ == "__main__":
    sys.exit(asyncio.run(run(parser().parse_args())))
