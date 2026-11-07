import {
  PROTOCOL_VERSION,
  SUPPORTED_LANGUAGES,
  type Action,
  type AssistantMessage,
  type AudioEndMessage,
  type AudioStartMessage,
  type ClientMessage,
  type ContextUpdateMessage,
  type ErrorMessage,
  type HelloMessage,
  type ServerMessage,
  type TtsStartMessage,
  type TtsEndMessage,
  type TranscriptMessage,
} from "./types";

export class ProtocolParseError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ProtocolParseError";
  }
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ProtocolParseError("Protocol message must be a JSON object");
  }
  return value as JsonRecord;
}

function requiredString(record: JsonRecord, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new ProtocolParseError(`${key} must be a non-empty string`);
  }
  return value;
}

function requiredNumber(record: JsonRecord, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new ProtocolParseError(`${key} must be a non-negative number`);
  }
  return value;
}

function requiredBoolean(record: JsonRecord, key: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") {
    throw new ProtocolParseError(`${key} must be a boolean`);
  }
  return value;
}

function requiredType(record: JsonRecord): string {
  return requiredString(record, "type");
}

function parseHello(record: JsonRecord): HelloMessage {
  if (record.protocol_version !== PROTOCOL_VERSION) {
    throw new ProtocolParseError("Unsupported protocol_version");
  }
  const language = requiredString(record, "language");
  if (!SUPPORTED_LANGUAGES.includes(language as (typeof SUPPORTED_LANGUAGES)[number])) {
    throw new ProtocolParseError("Unsupported language");
  }
  if (record.mode !== "echo" && record.mode !== "assistant") {
    throw new ProtocolParseError("Unsupported mode");
  }
  return {
    type: "hello",
    protocol_version: PROTOCOL_VERSION,
    session_token: requiredString(record, "session_token"),
    language: language as HelloMessage["language"],
    mode: record.mode,
  };
}

function parseContextUpdate(record: JsonRecord): ContextUpdateMessage {
  if (typeof record.snapshot !== "object" || record.snapshot === null || Array.isArray(record.snapshot)) {
    throw new ProtocolParseError("snapshot must be an object");
  }
  const selection = record.selection;
  if (selection !== undefined && selection !== null && typeof selection !== "string") {
    throw new ProtocolParseError("selection must be a string or null");
  }
  const guidedFieldId = record.guided_field_id;
  const guidedFieldName = record.guided_field_name;
  if (guidedFieldId !== undefined && guidedFieldId !== null && typeof guidedFieldId !== "string") {
    throw new ProtocolParseError("guided_field_id must be a string or null");
  }
  if (guidedFieldName !== undefined && guidedFieldName !== null && typeof guidedFieldName !== "string") {
    throw new ProtocolParseError("guided_field_name must be a string or null");
  }
  return {
    type: "context_update",
    snapshot: record.snapshot as ContextUpdateMessage["snapshot"],
    selection: selection as string | null | undefined,
    guided_field_id: guidedFieldId as string | null | undefined,
    guided_field_name: guidedFieldName as string | null | undefined,
  };
}

function parseTurnMessage<T extends AudioStartMessage | AudioEndMessage>(
  record: JsonRecord,
  type: T["type"],
): T {
  return { type, turn_id: requiredString(record, "turn_id") } as T;
}

export function parseClientMessage(input: string): ClientMessage {
  let value: unknown;
  try {
    value = JSON.parse(input) as unknown;
  } catch {
    throw new ProtocolParseError("Protocol message is not valid JSON");
  }
  const record = asRecord(value);
  switch (requiredType(record)) {
    case "hello":
      return parseHello(record);
    case "audio_start":
      return parseTurnMessage<AudioStartMessage>(record, "audio_start");
    case "audio_end":
      return parseTurnMessage<AudioEndMessage>(record, "audio_end");
    case "context_update":
      return parseContextUpdate(record);
    default:
      throw new ProtocolParseError("Unknown client message type");
  }
}

function nullableString(record: JsonRecord, key: string): string | null {
  const value = record[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new ProtocolParseError(`${key} must be a string or null`);
  return value;
}

function requiredConfidence(record: JsonRecord, key: string): AssistantMessage["confidence"] {
  const value = requiredString(record, key);
  if (value !== "high" && value !== "medium" && value !== "low") {
    throw new ProtocolParseError("confidence must be high, medium, or low");
  }
  return value;
}

function nullableAction(record: JsonRecord, key: string): Action | null {
  const value = record[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ProtocolParseError(`${key} must be an object or null`);
  }
  const action = value as Record<string, unknown>;
  const type = action.type;
  if (type !== "fill" && type !== "select" && type !== "check" && type !== "focus") {
    throw new ProtocolParseError("Unsupported action type");
  }
  return {
    type,
    target_id: requiredString(action, "target_id"),
    value: typeof action.value === "string" || action.value === null ? action.value : undefined,
    option: typeof action.option === "string" || action.option === null ? action.option : undefined,
    checked: typeof action.checked === "boolean" || action.checked === null ? action.checked : undefined,
  };
}

function nullableScamVerdict(record: JsonRecord, key: string): AssistantMessage["scam_verdict"] {
  const value = record[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ProtocolParseError(`${key} must be an object or null`);
  }
  const verdict = value as Record<string, unknown>;
  const level = verdict.level;
  const reasons = verdict.reasons;
  if (level !== "likely_scam" && level !== "suspicious" && level !== "looks_ok") {
    throw new ProtocolParseError("Unsupported scam verdict");
  }
  if (!Array.isArray(reasons) || !reasons.every((reason) => typeof reason === "string")) {
    throw new ProtocolParseError("Scam reasons must be strings");
  }
  return { level, reasons };
}

function parseServerRecord(record: JsonRecord): ServerMessage {
  switch (requiredType(record)) {
    case "ready":
      return { type: "ready", session_id: requiredString(record, "session_id") };
    case "transcript":
      return {
        type: "transcript",
        turn_id: requiredString(record, "turn_id"),
        text: requiredString(record, "text"),
        final: requiredBoolean(record, "final"),
        latency_ms: requiredNumber(record, "latency_ms"),
      } satisfies TranscriptMessage;
    case "assistant":
      return {
        type: "assistant",
        turn_id: requiredString(record, "turn_id"),
        speak: requiredString(record, "speak"),
        highlight_id: nullableString(record, "highlight_id"),
        action: nullableAction(record, "action"),
        scam_verdict: nullableScamVerdict(record, "scam_verdict"),
        confidence: requiredConfidence(record, "confidence"),
        followup: nullableString(record, "followup"),
      } satisfies AssistantMessage;
    case "tts_start": {
      const sampleRate = record.sample_rate;
      if (
        typeof sampleRate !== "number" ||
        !Number.isInteger(sampleRate) ||
        sampleRate < 8_000 ||
        sampleRate > 48_000
      ) {
        throw new ProtocolParseError("sample_rate must be an integer between 8000 and 48000");
      }
      if (record.encoding !== "linear_pcm") {
        throw new ProtocolParseError("Only linear_pcm TTS is supported");
      }
      return {
        type: "tts_start",
        turn_id: requiredString(record, "turn_id"),
        sample_rate: sampleRate,
        encoding: "linear_pcm",
      } satisfies TtsStartMessage;
    }
    case "tts_end":
      return {
        type: "tts_end",
        turn_id: requiredString(record, "turn_id"),
      } satisfies TtsEndMessage;
    case "error":
      return {
        type: "error",
        code: requiredString(record, "code"),
        message: requiredString(record, "message"),
      } satisfies ErrorMessage;
    default:
      throw new ProtocolParseError("Unknown server message type");
  }
}

export function parseServerMessage(input: string): ServerMessage {
  let value: unknown;
  try {
    value = JSON.parse(input) as unknown;
  } catch {
    throw new ProtocolParseError("Protocol message is not valid JSON");
  }
  return parseServerRecord(asRecord(value));
}

export function serializeClientMessage(message: ClientMessage): string {
  return JSON.stringify(message);
}
