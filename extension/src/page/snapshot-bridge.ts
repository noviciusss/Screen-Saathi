import type { PageSnapshot } from "../snapshot/types";

export const SNAPSHOT_REQUEST = "screen-saathi:request-snapshot" as const;
export const SNAPSHOT_RESPONSE = "screen-saathi:snapshot-response" as const;
export const SELECTION_REQUEST = "screen-saathi:selection" as const;

export interface SnapshotRequest {
  readonly type: typeof SNAPSHOT_REQUEST;
}

export interface SnapshotSuccess {
  readonly type: typeof SNAPSHOT_RESPONSE;
  readonly ok: true;
  readonly snapshot: PageSnapshot;
}

export interface SnapshotFailure {
  readonly type: typeof SNAPSHOT_RESPONSE;
  readonly ok: false;
  readonly code: "no_active_tab" | "restricted_page" | "snapshot_failed" | "denylisted";
  readonly message: string;
}

export type SnapshotResponse = SnapshotSuccess | SnapshotFailure;

export function isSnapshotRequest(value: unknown): value is SnapshotRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === SNAPSHOT_REQUEST
  );
}

export function requestActiveTabSnapshot(): Promise<PageSnapshot> {
  return new Promise<PageSnapshot>((resolve, reject) => {
    chrome.runtime.sendMessage<SnapshotRequest, SnapshotResponse>(
      { type: SNAPSHOT_REQUEST },
      (response) => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError !== undefined) {
          reject(new Error(runtimeError.message));
          return;
        }
        if (response?.ok === true) {
          resolve(response.snapshot);
          return;
        }
        reject(new Error(response?.message ?? "The page snapshot could not be created."));
      },
    );
  });
}

export function requestSelectedText(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    chrome.runtime.sendMessage({ type: SELECTION_REQUEST }, (response: { text?: unknown } | undefined) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError !== undefined) {
        reject(new Error(runtimeError.message));
        return;
      }
      resolve(typeof response?.text === "string" ? response.text : "");
    });
  });
}
