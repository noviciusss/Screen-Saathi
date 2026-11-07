import {
  PCM_CHANNELS,
  PCM_SAMPLE_RATE,
  isPcm16Frame,
} from "./frame-contract";

export interface MicCapture {
  stop: () => Promise<void>;
}

export type PcmFrameSink = (frame: ArrayBuffer) => void;

export async function startMicCapture(onFrame: PcmFrameSink): Promise<MicCapture> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: PCM_CHANNELS,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  const context = new AudioContext({ latencyHint: "interactive", sampleRate: PCM_SAMPLE_RATE });
  const workletUrl = chrome.runtime.getURL("audio/frame-processor.js");
  await context.audioWorklet.addModule(workletUrl);
  const source = context.createMediaStreamSource(stream);
  const processor = new AudioWorkletNode(context, "screen-saathi-frame-processor");
  const silentGain = context.createGain();
  silentGain.gain.value = 0;
  let stopped = false;
  processor.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
    if (isPcm16Frame(event.data)) onFrame(event.data);
  };
  source.connect(processor).connect(silentGain).connect(context.destination);
  await context.resume();
  return {
    stop: async () => {
      if (stopped) return;
      stopped = true;
      source.disconnect();
      processor.disconnect();
      silentGain.disconnect();
      for (const track of stream.getTracks()) track.stop();
      await context.close();
    },
  };
}
