import { describe, expect, it } from "vitest";
import { PCM_FRAME_BYTES } from "../src/audio/frame-contract";
import { VoiceSessionClient } from "../src/session/session-client";
import type { SessionSocket } from "../src/session/session-client";

class FakeSocket implements SessionSocket {
  public readyState = 0;
  public binaryType = "";
  public onopen: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public readonly sent: Array<string | ArrayBuffer | Blob> = [];

  public open(): void {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }

  public send(data: string | ArrayBuffer | Blob): void {
    this.sent.push(data);
  }

  public close(code = 1000, reason = ""): void {
    this.readyState = 3;
    this.onclose?.({ code, reason, type: "close" } as CloseEvent);
  }

  public receiveJson(message: string): void {
    this.onmessage?.(new MessageEvent("message", { data: message }));
  }

  public receiveAudio(chunk: ArrayBuffer): void {
    this.onmessage?.(new MessageEvent("message", { data: chunk }));
  }
}

describe("voice session client", () => {
  it("sends hello, controls turn state, and forwards exact PCM frames", async () => {
    const socket = new FakeSocket();
    const states: string[] = [];
    const audioChunks: ArrayBuffer[] = [];
    const client = new VoiceSessionClient(
      {
        sessionUrl: "wss://example.test/v1/session",
        sessionToken: "synthetic-session-token",
        language: "hi-IN",
      },
      {
        onStateChange: (state) => states.push(state),
        onAudioChunk: (chunk) => audioChunks.push(chunk),
      },
      () => socket,
    );

    const connected = client.connect();
    socket.open();
    expect(socket.sent[0]).toBe(
      '{"type":"hello","protocol_version":1,"session_token":"synthetic-session-token","language":"hi-IN","mode":"echo"}',
    );
    socket.receiveJson('{"type":"ready","session_id":"session-1"}');
    await connected;
    expect(client.state).toBe("ready");

    client.startTurn("turn-1");
    const frame = new ArrayBuffer(PCM_FRAME_BYTES);
    client.sendAudioFrame(frame);
    expect(socket.sent[1]).toEqual('{"type":"audio_start","turn_id":"turn-1"}');
    expect(socket.sent[2]).toBe(frame);
    expect(() => client.sendAudioFrame(new ArrayBuffer(2))).toThrow("exactly 1024 bytes");

    client.endTurn("turn-1");
    expect(client.state).toBe("ending");
    socket.receiveJson('{"type":"transcript","turn_id":"turn-1","text":"hello","final":true,"latency_ms":12}');
    expect(client.state).toBe("ready");

    const ttsChunk = new ArrayBuffer(4);
    socket.receiveJson('{"type":"tts_start","turn_id":"turn-1","sample_rate":24000,"encoding":"linear_pcm"}');
    socket.receiveAudio(ttsChunk);
    await Promise.resolve();
    expect(audioChunks).toEqual([ttsChunk]);
    expect(states).toEqual(["connecting", "ready", "recording", "ending", "ready"]);
  });

  it("reports an unexpected close after ready accurately", async () => {
    const socket = new FakeSocket();
    const errors: string[] = [];
    const client = new VoiceSessionClient(
      {
        sessionUrl: "wss://example.test/v1/session",
        sessionToken: "synthetic-session-token",
        language: "hi-IN",
      },
      { onError: (error) => errors.push(error.message) },
      () => socket,
    );

    const connected = client.connect();
    socket.open();
    socket.receiveJson('{"type":"ready","session_id":"session-1"}');
    await connected;
    socket.close(1006);

    expect(errors).toEqual(["WebSocket closed after ready (code 1006)"]);
    expect(client.state).toBe("error");
  });

  it("does not report an intentional close as a connection error", async () => {
    const socket = new FakeSocket();
    const errors: string[] = [];
    const client = new VoiceSessionClient(
      {
        sessionUrl: "wss://example.test/v1/session",
        sessionToken: "synthetic-session-token",
        language: "hi-IN",
      },
      { onError: (error) => errors.push(error.message) },
      () => socket,
    );

    const connected = client.connect();
    socket.open();
    socket.receiveJson('{"type":"ready","session_id":"session-1"}');
    await connected;
    client.close();

    expect(errors).toEqual([]);
    expect(client.state).toBe("closed");
  });

  it("recovers the session after a turn-level server error", async () => {
    const socket = new FakeSocket();
    const errors: string[] = [];
    const client = new VoiceSessionClient(
      {
        sessionUrl: "wss://example.test/v1/session",
        sessionToken: "synthetic-session-token",
        language: "hi-IN",
      },
      { onError: (error) => errors.push(error.message) },
      () => socket,
    );

    const connected = client.connect();
    socket.open();
    socket.receiveJson('{"type":"ready","session_id":"session-1"}');
    await connected;
    client.startTurn("turn-1");
    socket.receiveJson('{"type":"error","code":"stt_timeout","message":"Try again"}');

    expect(errors).toEqual([]);
    expect(client.state).toBe("ready");
  });
});
