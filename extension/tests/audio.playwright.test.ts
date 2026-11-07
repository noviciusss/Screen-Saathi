import { createServer, type Server } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PCM_FRAME_BYTES, PCM_FRAME_DURATION_MS, isPcm16Frame } from "../src/audio/frame-contract";

function syntheticWav(sampleRate: number, seconds: number): Buffer {
  const sampleCount = sampleRate * seconds;
  const data = Buffer.alloc(sampleCount * 2);
  for (let index = 0; index < sampleCount; index += 1) {
    const value = Math.round(Math.sin((2 * Math.PI * 440 * index) / sampleRate) * 0x1fff);
    data.writeInt16LE(value, index * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

describe("S3 Chromium fake-microphone frame contract", () => {
  let browser: Browser;
  let server: Server;
  let baseUrl: string;
  let tempDirectory: string;
  let wavPath: string;

  beforeAll(async () => {
    tempDirectory = await mkdtemp(join(tmpdir(), "screen-saathi-audio-"));
    wavPath = join(tempDirectory, "synthetic-tone.wav");
    await writeFile(wavPath, syntheticWav(16_000, 2));
    server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/html" });
      response.end("<!doctype html><html><body><h1>Screen Saathi audio test</h1></body></html>");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("Audio test server did not bind");
    baseUrl = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch({
      headless: true,
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        `--use-file-for-fake-audio-capture=${wavPath}`,
      ],
    });
  });

  afterAll(async () => {
    if (browser !== undefined) await browser.close();
    if (server !== undefined) {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
    if (tempDirectory !== undefined) await rm(tempDirectory, { recursive: true, force: true });
  });

  it("captures fake mic audio and emits exact PCM16 frames", async () => {
    const page = await browser.newPage({ permissions: ["microphone"] });
    await page.goto(baseUrl);
    const processorSource = await readFile(new URL("../public/audio/frame-processor.js", import.meta.url), "utf8");
    const result = await page.evaluate(async (source) => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const context = new AudioContext({ sampleRate: 16_000 });
      const moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
      await context.audioWorklet.addModule(moduleUrl);
      URL.revokeObjectURL(moduleUrl);
      const input = context.createMediaStreamSource(stream);
      const processor = new AudioWorkletNode(context, "screen-saathi-frame-processor");
      const gain = context.createGain();
      gain.gain.value = 0;
      input.connect(processor).connect(gain).connect(context.destination);
      await context.resume();
      const frames: number[] = [];
      const started = performance.now();
      const framePromise = new Promise<void>((resolve) => {
        processor.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
          frames.push(event.data.byteLength);
          if (frames.length >= 4) resolve();
        };
      });
      await framePromise;
      const elapsedMs = performance.now() - started;
      for (const track of stream.getTracks()) track.stop();
      input.disconnect();
      processor.disconnect();
      gain.disconnect();
      await context.close();
      return { frames, elapsedMs };
    }, processorSource);
    await page.close();

    expect(result.frames.length).toBeGreaterThanOrEqual(4);
    expect(result.frames.every((size) => size === PCM_FRAME_BYTES)).toBe(true);
    expect(isPcm16Frame(new ArrayBuffer(result.frames[0] ?? 0))).toBe(true);
    expect(result.elapsedMs).toBeGreaterThanOrEqual(PCM_FRAME_DURATION_MS);
  });
});
