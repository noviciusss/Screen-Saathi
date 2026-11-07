from __future__ import annotations

import json
import wave
from pathlib import Path

from spikes import s1_stt, s2_tts
from spikes.make_s1_clips import (
    FRAME_BYTES,
    TARGET_RATE,
    read_wav,
    resample_pcm16,
    write_aligned_wav,
)

AUDIO_DIR = Path(__file__).parents[1] / "spikes" / "audio"


def test_s1_fixture_is_exact_frame_aligned() -> None:
    frames = s1_stt.read_frames(AUDIO_DIR / "hi-IN-synthetic-aligned.wav")

    assert len(frames) == 160
    assert all(len(frame) == FRAME_BYTES for frame in frames)


def test_s1_headers_match_spec_without_optional_partial_header() -> None:
    request = s1_stt.SttRequest("hi-IN", Path("clip.wav"))

    headers = request.headers("synthetic-key-placeholder")

    assert headers["lang_code"] == "hi-IN"
    assert headers["x-sample-rate"] == "16000"
    assert headers["x-format"] == "transcribe"
    assert "x-partials" not in headers


def test_s1_accepts_final_transcript_event_name() -> None:
    assert {"transcript", "final_transcript", "partial_transcript"} >= {
        "final_transcript"
    }


def test_s1_default_hinglish_clip_uses_stt_supported_en_in() -> None:
    requests = s1_stt.default_requests(AUDIO_DIR)

    assert requests[2].language == "en-IN"
    assert s1_stt.TRAILING_SILENCE_FRAMES == 32


def test_s2_lists_exactly_twelve_requests_and_required_cases() -> None:
    requests = s2_tts.full_requests()
    payloads = [request.payload() for request in requests]

    assert len(requests) == 12
    assert {(request.language, request.voice) for request in requests} == {
        ("hi-IN", "Nalini"),
        ("hi-IN", "Deepak"),
        ("en-IN", "Kaveri"),
        ("en-IN", "Pranav"),
        ("hi-en", "Poorvi"),
        ("ta-IN", "Asmita"),
        ("ta-IN", "Trisha"),
    }
    assert all(payload["model"] == "timbre-v2.5" for payload in payloads)
    assert all(payload["speed"] == 1.0 for payload in payloads)
    assert all(payload["audio_config"]["container"] == "raw" for payload in payloads)
    combined = " ".join(request.text for request in requests)
    assert "कृत्रिम" in combined
    assert "synthetic" in combined
    assert "செயற்கை" in combined


def test_s2_calibration_is_separate_from_full_batch() -> None:
    calibration = s2_tts.calibration_request()

    assert calibration.label == "calibration"
    assert 80 <= len(calibration.text) <= 140
    assert json.loads(json.dumps(calibration.payload(), ensure_ascii=False))["voice"] == "Nalini"


def test_timbre_resampler_writes_mono_16khz_exact_frames(tmp_path: Path) -> None:
    source = tmp_path / "source.wav"
    with wave.open(str(source), "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(24_000)
        audio.writeframes((0).to_bytes(2, "little", signed=True) * 3_600)
    samples, rate = read_wav(source)
    output = tmp_path / "converted.wav"
    raw_bytes = write_aligned_wav(output, resample_pcm16(samples, rate, TARGET_RATE))

    assert raw_bytes % FRAME_BYTES == 0
    with wave.open(str(output), "rb") as audio:
        assert audio.getframerate() == TARGET_RATE
        assert audio.getnchannels() == 1
        assert audio.getsampwidth() == 2
