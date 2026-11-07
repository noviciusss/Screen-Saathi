class ScreenSaathiFrameProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = [];
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel === undefined) return true;
    for (const sample of channel) this.samples.push(sample);
    while (this.samples.length >= 512) {
      const pcm = new Int16Array(512);
      for (let index = 0; index < 512; index += 1) {
        const sample = Math.max(-1, Math.min(1, this.samples[index] ?? 0));
        pcm[index] = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
      }
      this.port.postMessage(pcm.buffer, [pcm.buffer]);
      this.samples.splice(0, 512);
    }
    return true;
  }
}

registerProcessor("screen-saathi-frame-processor", ScreenSaathiFrameProcessor);
