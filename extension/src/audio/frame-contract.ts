export const PCM_SAMPLE_RATE = 16_000;
export const PCM_CHANNELS = 1;
export const PCM_BYTES_PER_SAMPLE = 2;
export const PCM_FRAME_SAMPLES = 512;
export const PCM_FRAME_BYTES = PCM_FRAME_SAMPLES * PCM_BYTES_PER_SAMPLE;
export const PCM_FRAME_DURATION_MS = 32;

export function isPcm16Frame(value: ArrayBufferLike | Uint8Array): boolean {
  return value.byteLength === PCM_FRAME_BYTES;
}

export function float32ToPcm16(samples: Float32Array): Int16Array {
  const pcm = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index] ?? 0));
    pcm[index] = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
  }
  return pcm;
}
