"""Convert selected Timbre WAV outputs into exact-frame S1 STT inputs.

This uses only Python's standard library. Timbre raw PCM is wrapped as a WAV
by ``s2_tts.py`` at 24 kHz; this tool linearly resamples those outputs to
16 kHz mono PCM16 and pads the final byte stream to 1,024-byte boundaries.
"""

from __future__ import annotations

import argparse
import struct
import wave
from pathlib import Path

FRAME_BYTES = 1_024
TARGET_RATE = 16_000
SOURCE_RATE = 24_000

CLIP_SOURCES = {
    "hi-sentence.wav": "hi-nalini-sentence.wav",
    "en-sentence.wav": "en-kaveri-sentence.wav",
    "haan.wav": "hi-nalini-haan.wav",
    "nahi.wav": "hi-deepak-nahi.wav",
    "hinglish-sentence.wav": "hinglish-poorvi-sentence.wav",
}


def resample_pcm16(samples: tuple[int, ...], source_rate: int, target_rate: int) -> tuple[int, ...]:
    if not samples:
        raise ValueError("source audio contains no PCM samples")
    output_count = round(len(samples) * target_rate / source_rate)
    result: list[int] = []
    for index in range(output_count):
        source_position = index * source_rate / target_rate
        left_index = min(int(source_position), len(samples) - 1)
        right_index = min(left_index + 1, len(samples) - 1)
        fraction = source_position - left_index
        value = round(
            samples[left_index] + (samples[right_index] - samples[left_index]) * fraction
        )
        result.append(max(-32_768, min(32_767, value)))
    return tuple(result)


def read_wav(path: Path) -> tuple[tuple[int, ...], int]:
    with wave.open(str(path), "rb") as audio:
        if audio.getnchannels() != 1 or audio.getsampwidth() != 2:
            raise ValueError(f"{path}: expected mono PCM16 WAV")
        rate = audio.getframerate()
        raw = audio.readframes(audio.getnframes())
    if len(raw) % 2:
        raise ValueError(f"{path}: PCM data has an odd byte count")
    return tuple(struct.unpack(f"<{len(raw) // 2}h", raw)), rate


def write_aligned_wav(path: Path, samples: tuple[int, ...]) -> int:
    raw = struct.pack(f"<{len(samples)}h", *samples)
    padding = (-len(raw)) % FRAME_BYTES
    raw += b"\x00" * padding
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(TARGET_RATE)
        audio.writeframes(raw)
    return len(raw)


def convert(source_dir: Path, output_dir: Path) -> None:
    for output_name, source_name in CLIP_SOURCES.items():
        source = source_dir / source_name
        if not source.is_file():
            raise FileNotFoundError(
                f"missing S2 output {source}; run the approved 12-request S2 batch first"
            )
        samples, source_rate = read_wav(source)
        if source_rate != SOURCE_RATE:
            raise ValueError(
                f"{source}: expected Timbre output at {SOURCE_RATE} Hz, got {source_rate}"
            )
        resampled = resample_pcm16(samples, source_rate, TARGET_RATE)
        raw_bytes = write_aligned_wav(output_dir / output_name, resampled)
        print(
            f"created {output_dir / output_name}: {raw_bytes} PCM bytes, "
            f"{raw_bytes // FRAME_BYTES} exact frames"
        )


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument(
        "--source-dir",
        type=Path,
        default=Path(__file__).with_name("artifacts") / "s2-tts",
    )
    result.add_argument("--output-dir", type=Path, default=Path(__file__).with_name("audio"))
    return result


if __name__ == "__main__":
    convert(**vars(parser().parse_args()))
