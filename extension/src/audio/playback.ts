interface PcmAudioBuffer {
  getChannelData(channel: number): Float32Array;
}

interface PcmAudioSource {
  buffer: PcmAudioBuffer | null;
  connect(destination: unknown): void;
  disconnect(): void;
  start(when?: number): void;
  stop(): void;
  onended: (() => void) | null;
}

export interface PcmAudioContext {
  readonly currentTime: number;
  readonly destination: unknown;
  createBuffer(channels: number, length: number, sampleRate: number): PcmAudioBuffer;
  createBufferSource(): PcmAudioSource;
  resume(): Promise<void>;
}

export type PcmAudioContextFactory = () => PcmAudioContext;

const browserAudioContextFactory: PcmAudioContextFactory = () =>
  new AudioContext({ latencyHint: "interactive" }) as unknown as PcmAudioContext;

export class PcmPlaybackQueue {
  private readonly contextFactory: PcmAudioContextFactory;
  private context: PcmAudioContext | null = null;
  private sampleRate: number | null = null;
  private nextStartTime = 0;
  private readonly activeSources = new Set<PcmAudioSource>();

  public constructor(contextFactory: PcmAudioContextFactory = browserAudioContextFactory) {
    this.contextFactory = contextFactory;
  }

  public get activeChunkCount(): number {
    return this.activeSources.size;
  }

  public startStream(sampleRate: number): void {
    if (!Number.isInteger(sampleRate) || sampleRate < 8_000 || sampleRate > 48_000) {
      throw new Error("TTS sample rate must be an integer between 8000 and 48000");
    }
    this.ensureContext();
    this.clear();
    this.sampleRate = sampleRate;
    void this.context?.resume();
  }

  public enqueue(chunk: ArrayBuffer): void {
    if (this.sampleRate === null) throw new Error("TTS stream has not started");
    if (chunk.byteLength === 0 || chunk.byteLength % 2 !== 0) {
      throw new Error("PCM16 chunks must contain an even, non-zero number of bytes");
    }
    const context = this.ensureContext();
    const frameCount = chunk.byteLength / 2;
    const buffer = context.createBuffer(1, frameCount, this.sampleRate);
    const samples = buffer.getChannelData(0);
    const view = new DataView(chunk);
    for (let index = 0; index < frameCount; index += 1) {
      samples[index] = view.getInt16(index * 2, true) / 0x8000;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.onended = () => {
      this.activeSources.delete(source);
      source.disconnect();
    };
    const startTime = Math.max(this.nextStartTime, context.currentTime);
    source.start(startTime);
    this.nextStartTime = startTime + frameCount / this.sampleRate;
    this.activeSources.add(source);
  }

  public clear(): void {
    for (const source of this.activeSources) {
      try {
        source.stop();
      } catch {
        // A source that has already ended is safe to remove from the queue.
      }
      source.disconnect();
    }
    this.activeSources.clear();
    this.nextStartTime = this.context?.currentTime ?? 0;
  }

  public stop(): void {
    this.clear();
    this.sampleRate = null;
  }

  private ensureContext(): PcmAudioContext {
    if (this.context === null) this.context = this.contextFactory();
    return this.context;
  }
}
