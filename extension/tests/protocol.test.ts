import { describe, expect, it } from "vitest";
import { parseClientMessage, parseServerMessage, ProtocolParseError, serializeClientMessage } from "../src/protocol/parser";

describe("voice protocol parser", () => {
  it("parses the fixed hello and serializes it without changing fields", () => {
    const hello = {
      type: "hello",
      protocol_version: 1,
      session_token: "synthetic-session-token",
      language: "hi-en",
      mode: "echo",
    } as const;

    expect(parseClientMessage(JSON.stringify(hello))).toEqual(hello);
    expect(serializeClientMessage(hello)).toBe(JSON.stringify(hello));
  });

  it("parses ready, transcript, TTS, and error messages", () => {
    expect(parseServerMessage('{"type":"ready","session_id":"session-1"}')).toEqual({
      type: "ready",
      session_id: "session-1",
    });
    expect(parseServerMessage('{"type":"transcript","turn_id":"turn-1","text":"नमस्ते","final":true,"latency_ms":42}')).toEqual({
      type: "transcript",
      turn_id: "turn-1",
      text: "नमस्ते",
      final: true,
      latency_ms: 42,
    });
    expect(parseServerMessage('{"type":"tts_start","turn_id":"turn-1","sample_rate":24000,"encoding":"linear_pcm"}')).toEqual({
      type: "tts_start",
      turn_id: "turn-1",
      sample_rate: 24000,
      encoding: "linear_pcm",
    });
    expect(parseServerMessage('{"type":"tts_end","turn_id":"turn-1"}')).toEqual({
      type: "tts_end",
      turn_id: "turn-1",
    });
    expect(parseServerMessage('{"type":"error","code":"rate_limited","message":"Try again later"}')).toEqual({
      type: "error",
      code: "rate_limited",
      message: "Try again later",
    });
    expect(parseServerMessage('{"type":"assistant","turn_id":"turn-1","speak":"यह पेज है","highlight_id":"e1","action":{"type":"fill","target_id":"e1","value":"Synthetic User"},"scam_verdict":null,"confidence":"high","followup":null}')).toEqual({
      type: "assistant",
      turn_id: "turn-1",
      speak: "यह पेज है",
      highlight_id: "e1",
      action: { type: "fill", target_id: "e1", value: "Synthetic User" },
      scam_verdict: null,
      confidence: "high",
      followup: null,
    });
  });

  it("accepts a redacted page context update", () => {
    const parsed = parseClientMessage(JSON.stringify({
      type: "context_update",
      snapshot: { title: "Synthetic page", elements: [] },
      selection: null,
    }));
    expect(parsed.type).toBe("context_update");
  });

  it("rejects malformed or unsupported messages", () => {
    expect(() => parseServerMessage("not-json")).toThrow(ProtocolParseError);
    expect(() => parseServerMessage('{"type":"unknown"}')).toThrow(ProtocolParseError);
    expect(() => parseServerMessage('{"type":"tts_start","turn_id":"turn-1","sample_rate":24000,"encoding":"wav"}')).toThrow(
      "Only linear_pcm TTS is supported",
    );
    expect(() => parseClientMessage('{"type":"hello","protocol_version":2,"session_token":"token","language":"hi-IN","mode":"echo"}')).toThrow(
      "Unsupported protocol_version",
    );
  });
});
