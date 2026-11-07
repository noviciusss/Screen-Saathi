"""Run the guarded Gnani Prisma realtime STT spike.

The script is intentionally not part of automated tests. It accepts only
local synthetic WAV files, uses one connection per clip with no retries, and
never prints the API key. Use ``--dry-run`` to inspect the request plan
without making a network call.
"""

from __future__ import annotations

import argparse
import asyncio
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

BASE_URL = "wss://api.vachana.ai"
DEFAULT_AUDIO_DIR = Path(__file__).with_name("audio")
CALIBRATION_MARKER = Path(__file__).with_name("artifacts") / "s1-calibration-complete.json"
FRAME_BYTES = 1_024
SAMPLE_RATE = 16_000
FRAME_SECONDS = FRAME_BYTES / 2 / SAMPLE_RATE
TRAILING_SILENCE_FRAMES = 32


@dataclass(frozen=True)
class SttRequest:
    language: str
    clip: Path
    api_version: str = "v3"
    partials: bool = False

    @property
    def endpoint(self) -> str:
        return f"{BASE_URL}/stt/{self.api_version}/stream"

    def headers(self, api_key: str) -> dict[str, str]:
        headers = {
            "x-api-key-id": api_key,
            "lang_code": self.language,
            "x-sample-rate": str(SAMPLE_RATE),
            "x-format": "transcribe",
            "x-vad-threshold": "0.6",
            "x-min-silence-ms": "600",
            "x-min-speech-ms": "150",
            "x-min-segment-ms": "120",
        }
        if self.partials:
            headers["x-partials"] = "true"
        return headers


def parse_clip(value: str) -> SttRequest:
    language, separator, raw_path = value.partition("=")
    if not separator or not language or not raw_path:
        raise argparse.ArgumentTypeError("clips must use LANG=PATH")
    return SttRequest(language=language, clip=Path(raw_path))


def read_frames(path: Path) -> list[bytes]:
    with wave.open(str(path), "rb") as wav:
        if wav.getnchannels() != 1 or wav.getsampwidth() != 2 or wav.getframerate() != SAMPLE_RATE:
            raise ValueError(f"{path}: expected mono 16-bit PCM WAV at 16 kHz")
        frames = []
        while chunk := wav.readframes(FRAME_BYTES // 2):
            if len(chunk) != FRAME_BYTES:
                raise ValueError(f"{path}: final audio frame is not exactly {FRAME_BYTES} bytes")
            frames.append(chunk)
    if not frames:
        raise ValueError(f"{path}: audio file contains no frames")
    return frames


def default_requests(audio_dir: Path) -> list[SttRequest]:
    return [
        SttRequest("hi-IN", audio_dir / "hi-sentence.wav"),
        SttRequest("en-IN", audio_dir / "en-sentence.wav"),
        SttRequest("en-IN", audio_dir / "hinglish-sentence.wav"),
        SttRequest("hi-IN", audio_dir / "haan.wav"),
        SttRequest("hi-IN", audio_dir / "nahi.wav"),
    ]


def print_plan(requests: list[SttRequest]) -> None:
    print("S1 request plan (no calls made):")
    for index, request in enumerate(requests, start=1):
        print(
            f"  {index}. language={request.language} endpoint={request.endpoint} "
            f"clip={request.clip} partials={request.partials}"
        )


def append_usage(record: dict[str, Any], project_root: Path) -> None:
    log_path = project_root / "backend" / "logs" / "usage.jsonl"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as log:
        log.write(json.dumps(record, ensure_ascii=False) + "\n")


async def send_realtime_frames(socket: Any, frames: list[bytes]) -> None:
    next_frame_at = time.perf_counter()
    for frame in frames:
        await socket.send(frame)
        next_frame_at += FRAME_SECONDS
        await asyncio.sleep(max(0.0, next_frame_at - time.perf_counter()))


async def run_request(request: SttRequest, api_key: str, project_root: Path) -> None:
    frames = read_frames(request.clip)
    trailing_silence = [bytes(FRAME_BYTES)] * TRAILING_SILENCE_FRAMES
    started = time.perf_counter()
    transcript_count = 0
    partial_count = 0
    print(f"S1 starting language={request.language} clip={request.clip} frames={len(frames)}")
    async with websockets.connect(
        request.endpoint, additional_headers=request.headers(api_key)
    ) as socket:
        receiver = asyncio.create_task(receive_messages(socket, request, started))
        await send_realtime_frames(socket, frames)
        await send_realtime_frames(socket, trailing_silence)
        await asyncio.sleep(1.0)
        receiver.cancel()
        try:
            transcript_count, partial_count = await receiver
        except asyncio.CancelledError:
            pass
    elapsed_ms = round((time.perf_counter() - started) * 1_000, 2)
    append_usage(
        {
            "kind": "gnani_spike",
            "spike": "s1_stt",
            "language": request.language,
            "clip": request.clip.name,
            "speech_audio_bytes": len(frames) * FRAME_BYTES,
            "trailing_silence_bytes": len(trailing_silence) * FRAME_BYTES,
            "audio_bytes_sent": (len(frames) + len(trailing_silence)) * FRAME_BYTES,
            "duration_ms": elapsed_ms,
            "transcript_messages": transcript_count,
            "partial_transcript_messages": partial_count,
        },
        project_root,
    )
    print(
        f"S1 complete duration_ms={elapsed_ms} transcript_messages={transcript_count} "
        f"partial_transcript_messages={partial_count}"
    )


async def receive_messages(socket: Any, request: SttRequest, started: float) -> tuple[int, int]:
    transcript_count = 0
    partial_count = 0
    try:
        async for raw_message in socket:
            if not isinstance(raw_message, str):
                continue
            try:
                message = json.loads(raw_message)
            except json.JSONDecodeError:
                print("S1 server message was not JSON; ignored")
                continue
            if not isinstance(message, dict):
                continue
            kind = message.get("type", message.get("event", "unknown"))
            if kind in {"transcript", "final_transcript", "partial_transcript"}:
                if kind == "partial_transcript":
                    partial_count += 1
                else:
                    transcript_count += 1
                latency = message.get("latency")
                elapsed_ms = round((time.perf_counter() - started) * 1_000, 2)
                print(
                    f"S1 {kind} language={request.language} text={message.get('text', '')!r} "
                    f"latency={latency!r} observed_ms={elapsed_ms}"
                )
            elif kind == "error":
                print(f"S1 server error: {message}")
            else:
                print(f"S1 server event: {kind}")
    except asyncio.CancelledError:
        return transcript_count, partial_count
    except websockets.exceptions.ConnectionClosed:
        return transcript_count, partial_count
    return transcript_count, partial_count


async def run(args: argparse.Namespace) -> int:
    project_root = Path(__file__).resolve().parents[2]
    load_dotenv(project_root / ".env")
    requests = args.clip or default_requests(args.audio_dir)
    if args.calibration:
        requests = requests[:1]
    if args.partials:
        requests = [SttRequest(r.language, r.clip, args.api_version, True) for r in requests]
    elif args.api_version != "v3":
        requests = [SttRequest(r.language, r.clip, args.api_version, r.partials) for r in requests]
    print_plan(requests)
    if args.dry_run:
        return 0
    if not args.confirm_live:
        print("S1 blocked: add --confirm-live to make network calls")
        return 2
    api_key = os.getenv("GNANI_API_KEY", "").strip()
    if not api_key:
        print("S1 blocked: GNANI_API_KEY is required locally")
        return 2
    for request in requests:
        if not request.clip.is_file():
            print(f"S1 blocked: clip does not exist: {request.clip}")
            return 2
    if not args.calibration and not CALIBRATION_MARKER.is_file():
        print("S1 blocked: run the single --calibration call first and record its dashboard cost")
        return 2
    for request in requests:
        try:
            await run_request(request, api_key, project_root)
        except (OSError, ValueError, websockets.WebSocketException) as error:
            print(f"S1 failed without retry: {error}")
            return 1
    if args.calibration:
        CALIBRATION_MARKER.parent.mkdir(parents=True, exist_ok=True)
        CALIBRATION_MARKER.write_text(
            json.dumps(
                {"clip": requests[0].clip.name, "audio_seconds": 5.12, "recorded_at": time.time()},
                indent=2,
            ),
            encoding="utf-8",
        )
        print(
            "S1 calibration complete; stop and record the dashboard balance "
            "before any full batch."
        )
    return 0


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--audio-dir", type=Path, default=DEFAULT_AUDIO_DIR)
    result.add_argument("--clip", type=parse_clip, action="append", help="LANG=PATH; repeatable")
    result.add_argument("--api-version", choices=("v3", "v4"), default="v3")
    result.add_argument("--partials", action="store_true")
    result.add_argument(
        "--calibration", action="store_true", help="run only the first calibration clip"
    )
    result.add_argument("--dry-run", action="store_true")
    result.add_argument("--confirm-live", action="store_true")
    return result


if __name__ == "__main__":
    sys.exit(asyncio.run(run(parser().parse_args())))
