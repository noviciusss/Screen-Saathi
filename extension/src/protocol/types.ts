import type { PageSnapshot } from "../snapshot/types";

export const PROTOCOL_VERSION = 1 as const;

export const SUPPORTED_LANGUAGES = ["hi-IN", "en-IN", "hi-en"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export type ClientMode = "echo" | "assistant";
export type PcmEncoding = "linear_pcm";

export interface HelloMessage {
  readonly type: "hello";
  readonly protocol_version: typeof PROTOCOL_VERSION;
  readonly session_token: string;
  readonly language: SupportedLanguage;
  readonly mode: ClientMode;
}

export interface AudioStartMessage {
  readonly type: "audio_start";
  readonly turn_id: string;
}

export interface AudioEndMessage {
  readonly type: "audio_end";
  readonly turn_id: string;
}

export interface ContextUpdateMessage {
  readonly type: "context_update";
  readonly snapshot: PageSnapshot;
  readonly selection?: string | null;
  readonly guided_field_id?: string | null;
  readonly guided_field_name?: string | null;
}

export type ClientMessage = HelloMessage | AudioStartMessage | AudioEndMessage | ContextUpdateMessage;

export interface ReadyMessage {
  readonly type: "ready";
  readonly session_id: string;
}

export interface TranscriptMessage {
  readonly type: "transcript";
  readonly turn_id: string;
  readonly text: string;
  readonly final: boolean;
  readonly latency_ms: number;
}

export interface Action {
  readonly type: "fill" | "select" | "check" | "focus";
  readonly target_id: string;
  readonly value?: string | null;
  readonly option?: string | null;
  readonly checked?: boolean | null;
}

export interface ScamVerdict {
  readonly level: "likely_scam" | "suspicious" | "looks_ok";
  readonly reasons: string[];
}

export interface AssistantMessage {
  readonly type: "assistant";
  readonly turn_id: string;
  readonly speak: string;
  readonly highlight_id: string | null;
  readonly action: Action | null;
  readonly scam_verdict: ScamVerdict | null;
  readonly confidence: "high" | "medium" | "low";
  readonly followup: string | null;
}

export interface TtsStartMessage {
  readonly type: "tts_start";
  readonly turn_id: string;
  readonly sample_rate: number;
  readonly encoding: PcmEncoding;
}

export interface TtsEndMessage {
  readonly type: "tts_end";
  readonly turn_id: string;
}

export interface ErrorMessage {
  readonly type: "error";
  readonly code: string;
  readonly message: string;
}

export type ServerMessage =
  | ReadyMessage
  | TranscriptMessage
  | AssistantMessage
  | TtsStartMessage
  | TtsEndMessage
  | ErrorMessage;
