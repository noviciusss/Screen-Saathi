import { PCM_FRAME_BYTES, isPcm16Frame } from "../audio/frame-contract";
import { parseServerMessage, serializeClientMessage } from "../protocol/parser";
import type {
  AudioEndMessage,
  AudioStartMessage,
  ClientMessage,
  HelloMessage,
  ContextUpdateMessage,
  ServerMessage,
  SupportedLanguage,
} from "../protocol/types";
import type { PageSnapshot } from "../snapshot/types";

export type SessionState = "idle" | "connecting" | "ready" | "recording" | "ending" | "closed" | "error";

export interface SessionSocket {
  readyState: number;
  binaryType: string;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  send(data: string | ArrayBuffer | Blob): void;
  close(): void;
}

export type SessionSocketFactory = (url: string) => SessionSocket;

export interface VoiceSessionOptions {
  readonly sessionUrl: string;
  readonly sessionToken: string;
  readonly language: SupportedLanguage;
  readonly mode?: "echo" | "assistant";
}

export interface VoiceSessionHandlers {
  readonly onStateChange?: (state: SessionState) => void;
  readonly onMessage?: (message: ServerMessage) => void;
  readonly onAudioChunk?: (chunk: ArrayBuffer) => void;
  readonly onError?: (error: Error) => void;
}

const OPEN_STATE = 1;

const browserSocketFactory: SessionSocketFactory = (url) => {
  const socket = new WebSocket(url);
  socket.binaryType = "arraybuffer";
  return socket;
};

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export class VoiceSessionClient {
  private readonly handlers: VoiceSessionHandlers;
  private readonly socketFactory: SessionSocketFactory;
  private readonly options: VoiceSessionOptions;
  private socket: SessionSocket | null = null;
  private stateValue: SessionState = "idle";
  private connectResolve: (() => void) | null = null;
  private connectReject: ((error: Error) => void) | null = null;
  private activeTurnId: string | null = null;
  private ttsTurnId: string | null = null;
  private serverErrorReceived = false;
  private socketGeneration = 0;

  public constructor(
    options: VoiceSessionOptions,
    handlers: VoiceSessionHandlers = {},
    socketFactory: SessionSocketFactory = browserSocketFactory,
  ) {
    this.options = options;
    this.handlers = handlers;
    this.socketFactory = socketFactory;
  }

  public get state(): SessionState {
    return this.stateValue;
  }

  public get isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === OPEN_STATE && this.stateValue !== "closed" && this.stateValue !== "error";
  }

  public resetToReady(): void {
    this.activeTurnId = null;
    this.ttsTurnId = null;
    if (this.stateValue !== "ready" && this.isConnected) {
      this.setState("ready");
    }
  }

  public async connect(): Promise<void> {
    if (this.stateValue === "ready") return;
    if (this.stateValue === "connecting") {
      return new Promise<void>((resolve, reject) => {
        this.connectResolve = resolve;
        this.connectReject = reject;
      });
    }
    if (this.stateValue !== "idle" && this.stateValue !== "closed" && this.stateValue !== "error") {
      throw new Error(`Cannot connect from ${this.stateValue}`);
    }

    const previousSocket = this.socket;
    this.socket = null;
    previousSocket?.close();
    const generation = ++this.socketGeneration;
    this.setState("connecting");
    this.serverErrorReceived = false;
    return new Promise<void>((resolve, reject) => {
      this.connectResolve = resolve;
      this.connectReject = reject;
      try {
        const socket = this.socketFactory(this.options.sessionUrl);
        this.socket = socket;
        socket.binaryType = "arraybuffer";
        socket.onopen = () => {
          if (this.isCurrentSocket(socket, generation)) this.handleOpen();
        };
        socket.onmessage = (event) => {
          if (this.isCurrentSocket(socket, generation)) void this.handleMessage(event.data);
        };
        socket.onerror = (_event: Event) => {
          // Browsers often emit `error` immediately before `close`, including
          // when the server has sent a useful protocol error. Wait for close
          // so the close code or server error is not replaced by a generic UI
          // message.
        };
        socket.onclose = (event: CloseEvent) => {
          if (this.isCurrentSocket(socket, generation)) this.handleClose(event);
        };
      } catch (error) {
        this.fail(asError(error));
      }
    });
  }

  public close(): void {
    if (this.stateValue === "closed") return;
    const socket = this.socket;
    this.socket = null;
    this.activeTurnId = null;
    this.ttsTurnId = null;
    this.rejectConnect(new Error("Session closed"));
    this.setState("closed");
    socket?.close();
  }

  public startTurn(turnId: string): void {
    if (this.stateValue !== "ready") throw new Error(`Cannot start a turn from ${this.stateValue}`);
    const message: AudioStartMessage = { type: "audio_start", turn_id: requireTurnId(turnId) };
    this.sendJson(message);
    this.activeTurnId = message.turn_id;
    this.setState("recording");
  }

  public setContext(
    snapshot: PageSnapshot,
    selection?: string | null,
    guidedField?: { id: string; name: string } | null,
  ): void {
    if (this.stateValue !== "ready") throw new Error(`Cannot set context from ${this.stateValue}`);
    const message: ContextUpdateMessage = {
      type: "context_update",
      snapshot,
      selection,
      guided_field_id: guidedField?.id ?? null,
      guided_field_name: guidedField?.name ?? null,
    };
    this.sendJson(message);
  }

  public sendAudioFrame(frame: ArrayBuffer | Uint8Array): void {
    if (this.stateValue !== "recording") throw new Error(`Cannot send audio from ${this.stateValue}`);
    if (!isPcm16Frame(frame)) {
      throw new Error(`Audio frames must be exactly ${PCM_FRAME_BYTES} bytes`);
    }
    const socket = this.requireOpenSocket();
    if (frame instanceof ArrayBuffer) {
      socket.send(frame);
      return;
    }
    const copy = new ArrayBuffer(frame.byteLength);
    new Uint8Array(copy).set(frame);
    socket.send(copy);
  }

  public endTurn(turnId: string): void {
    if (this.stateValue !== "recording") throw new Error(`Cannot end a turn from ${this.stateValue}`);
    if (this.activeTurnId !== turnId) throw new Error("Turn id does not match the active turn");
    const message: AudioEndMessage = { type: "audio_end", turn_id: requireTurnId(turnId) };
    this.sendJson(message);
    this.setState("ending");
  }

  private handleOpen(): void {
    const hello: HelloMessage = {
      type: "hello",
      protocol_version: 1,
      session_token: this.options.sessionToken,
      language: this.options.language,
      mode: this.options.mode ?? "echo",
    };
    this.sendJson(hello);
  }

  private handleClose(event: CloseEvent): void {
    this.socket = null;
    if (this.serverErrorReceived || this.stateValue === "error" || this.stateValue === "closed") return;
    const phase = this.stateValue === "connecting" ? "before ready" : "after ready";
    const reason = event.reason.trim();
    const detail = reason.length > 0 ? `: ${reason}` : "";
    this.fail(new Error(`WebSocket closed ${phase} (code ${event.code}${detail})`));
  }

  private isCurrentSocket(socket: SessionSocket, generation: number): boolean {
    return this.socket === socket && this.socketGeneration === generation;
  }

  private async handleMessage(data: string | ArrayBuffer | Blob): Promise<void> {
    try {
      if (typeof data === "string") {
        this.handleServerMessage(parseServerMessage(data));
        return;
      }
      const chunk = data instanceof ArrayBuffer ? data : await data.arrayBuffer();
      if (this.ttsTurnId === null) {
        this.fail(new Error("Received TTS audio before tts_start"));
        return;
      }
      if (chunk.byteLength === 0 || chunk.byteLength % 2 !== 0) {
        this.fail(new Error("TTS PCM chunks must contain an even, non-zero number of bytes"));
        return;
      }
      this.handlers.onAudioChunk?.(chunk);
    } catch (error) {
      this.fail(asError(error));
    }
  }

  private handleServerMessage(message: ServerMessage): void {
    if (message.type === "error") {
      if (this.stateValue === "connecting") {
        this.serverErrorReceived = true;
        this.fail(new Error(`${message.code}: ${message.message}`));
      } else {
        this.serverErrorReceived = false;
        this.activeTurnId = null;
        this.ttsTurnId = null;
        this.setState("ready");
        this.handlers.onMessage?.(message);
      }
      return;
    }

    this.handlers.onMessage?.(message);
    if (message.type === "ready") {
      if (this.stateValue !== "connecting") {
        this.fail(new Error("Unexpected ready message"));
        return;
      }
      this.setState("ready");
      this.resolveConnect();
    } else if (message.type === "transcript" && message.final && message.turn_id === this.activeTurnId) {
      if (this.stateValue === "ending") this.setState("ready");
    } else if (message.type === "tts_start") {
      this.ttsTurnId = message.turn_id;
    } else if (message.type === "tts_end") {
      this.ttsTurnId = null;
      this.activeTurnId = null;
      if (this.stateValue === "ending" || this.stateValue === "recording") {
        this.setState("ready");
      }
    }
  }

  private sendJson(message: ClientMessage): void {
    const socket = this.requireOpenSocket();
    socket.send(serializeClientMessage(message));
  }

  private requireOpenSocket(): SessionSocket {
    if (this.socket === null || this.socket.readyState !== OPEN_STATE) {
      throw new Error("WebSocket is not open");
    }
    return this.socket;
  }

  private setState(state: SessionState): void {
    this.stateValue = state;
    this.handlers.onStateChange?.(state);
  }

  private resolveConnect(): void {
    const resolve = this.connectResolve;
    this.connectResolve = null;
    this.connectReject = null;
    resolve?.();
  }

  private rejectConnect(error: Error): void {
    const reject = this.connectReject;
    this.connectResolve = null;
    this.connectReject = null;
    reject?.(error);
  }

  private fail(error: Error): void {
    this.setState("error");
    this.handlers.onError?.(error);
    this.rejectConnect(error);
  }
}

function requireTurnId(turnId: string): string {
  if (turnId.trim().length === 0) throw new Error("turn_id must be a non-empty string");
  return turnId;
}
