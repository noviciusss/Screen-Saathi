import { describe, expect, it } from "vitest";
import { PcmPlaybackQueue } from "../src/audio/playback";
import type { PcmAudioContext } from "../src/audio/playback";

class FakeSource {
  public buffer: { getChannelData: (channel: number) => Float32Array } | null = null;
  public onended: (() => void) | null = null;
  public startedAt: number | undefined;
  public stopped = false;
  public disconnected = false;

  public connect(_destination: unknown): void {}

  public disconnect(): void {
    this.disconnected = true;
  }

  public start(when?: number): void {
    this.startedAt = when;
  }

  public stop(): void {
    this.stopped = true;
  }
}

class FakeContext implements PcmAudioContext {
  public currentTime = 10;
  public readonly destination = {};
  public readonly sources: FakeSource[] = [];

  public createBuffer(_channels: number, length: number, _sampleRate: number): { getChannelData: () => Float32Array } {
    const samples = new Float32Array(length);
    return { getChannelData: () => samples };
  }

  public createBufferSource(): FakeSource {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }

  public resume(): Promise<void> {
    return Promise.resolve();
  }
}

describe("PCM playback queue", () => {
  it("schedules PCM chunks in order and clears queued audio for barge-in", () => {
    const context = new FakeContext();
    const playback = new PcmPlaybackQueue(() => context);
    playback.startStream(24_000);

    playback.enqueue(new ArrayBuffer(4));
    playback.enqueue(new ArrayBuffer(4));
    expect(playback.activeChunkCount).toBe(2);
    expect(context.sources[0]?.startedAt).toBe(10);
    expect(context.sources[1]?.startedAt).toBeCloseTo(10 + 2 / 24_000);

    playback.clear();
    expect(playback.activeChunkCount).toBe(0);
    expect(context.sources.every((source) => source.stopped && source.disconnected)).toBe(true);
  });

  it("rejects chunks outside the raw PCM16 contract", () => {
    const playback = new PcmPlaybackQueue(() => new FakeContext());
    playback.startStream(24_000);
    expect(() => playback.enqueue(new ArrayBuffer(3))).toThrow("even, non-zero");
  });
});
