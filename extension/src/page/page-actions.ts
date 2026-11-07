import type { Action } from "../protocol/types";

export const HIGHLIGHT_REQUEST = "screen-saathi:highlight" as const;
export const EXECUTE_ACTION_REQUEST = "screen-saathi:execute-action" as const;

export interface HighlightRequest {
  readonly type: typeof HIGHLIGHT_REQUEST;
  readonly targetId: string;
}

export interface ExecuteActionRequest {
  readonly type: typeof EXECUTE_ACTION_REQUEST;
  readonly action: Action;
}

export interface ActionResponse {
  readonly ok: boolean;
  readonly message?: string;
}

function send<T>(message: unknown): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: T) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError !== undefined) {
        reject(new Error(runtimeError.message));
        return;
      }
      resolve(response);
    });
  });
}

export function highlightPageElement(targetId: string): Promise<ActionResponse> {
  return send<ActionResponse>({ type: HIGHLIGHT_REQUEST, targetId });
}

export function executePageAction(action: Action): Promise<ActionResponse> {
  return send<ActionResponse>({ type: EXECUTE_ACTION_REQUEST, action });
}
