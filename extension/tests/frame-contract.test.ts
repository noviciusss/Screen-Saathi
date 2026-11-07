import { describe, expect, it } from "vitest";
import {
  PCM_FRAME_BYTES,
  PCM_FRAME_DURATION_MS,
  PCM_FRAME_SAMPLES,
  float32ToPcm16,
  isPcm16Frame,
} from "../src/audio/frame-contract";

describe("PCM frame contract", () => {
  it("defines 1024-byte, 32 ms frames at 16 kHz", () => {
    expect(PCM_FRAME_SAMPLES).toBe(512);
    expect(PCM_FRAME_BYTES).toBe(1024);
    expect(PCM_FRAME_DURATION_MS).toBe(32);
  });

  it("converts and validates PCM16 frames", () => {
    const pcm = float32ToPcm16(new Float32Array(PCM_FRAME_SAMPLES).fill(0.5));
    expect(isPcm16Frame(pcm.buffer)).toBe(true);
    expect(pcm[0]).toBe(16384);
    expect(isPcm16Frame(new ArrayBuffer(512))).toBe(false);
  });
});
