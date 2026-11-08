import { defineBackground } from "wxt/utils/define-background";
import { buildSnapshot } from "../src/snapshot/build-snapshot";
import { DEFAULT_DENYLIST, DENYLIST_STORAGE_KEY, isDenylisted } from "../src/privacy/policy";
import {
  EXECUTE_ACTION_REQUEST,
  HIGHLIGHT_REQUEST,
  type ActionResponse,
} from "../src/page/page-actions";
import type { Action } from "../src/protocol/types";
import {
  isSnapshotRequest,
  SNAPSHOT_RESPONSE,
  type SnapshotFailure,
  type SnapshotResponse,
  } from "../src/page/snapshot-bridge";

export default defineBackground(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: unknown) => {
      console.warn("Screen Saathi side-panel setup failed", error);
    });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (isSnapshotRequest(message)) {
      void snapshotActiveTab().then(
      (response) => sendResponse(response),
      (error: unknown) =>
        sendResponse({
          type: SNAPSHOT_RESPONSE,
          ok: false,
          code: "snapshot_failed",
          message: error instanceof Error ? error.message : "The page snapshot failed.",
        } satisfies SnapshotFailure),
      );
      return true;
    }
    if (isSelectionRequest(message)) {
      void selectedTextActiveTab().then(sendResponse);
      return true;
    }
    if (isHighlightRequest(message)) {
      void runOnActiveTab(highlightElement, message.targetId).then(sendResponse);
      return true;
    }
    if (isExecuteActionRequest(message)) {
      void runOnActiveTab(executeAction, message.action).then(sendResponse);
      return true;
    }
    return false;
  });
});

function isSelectionRequest(value: unknown): boolean {
  return typeof value === "object" && value !== null &&
    (value as { type?: unknown }).type === "screen-saathi:selection";
}

function isHighlightRequest(value: unknown): value is { type: typeof HIGHLIGHT_REQUEST; targetId: string } {
  return typeof value === "object" && value !== null &&
    (value as { type?: unknown }).type === HIGHLIGHT_REQUEST &&
    typeof (value as { targetId?: unknown }).targetId === "string";
}

function isExecuteActionRequest(value: unknown): value is { type: typeof EXECUTE_ACTION_REQUEST; action: Action } {
  return typeof value === "object" && value !== null &&
    (value as { type?: unknown }).type === EXECUTE_ACTION_REQUEST &&
    typeof (value as { action?: unknown }).action === "object";
}

async function runOnActiveTab<T, R>(fn: (value: T) => R, value: T): Promise<ActionResponse> {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const tab = tabs[0];
  if (tab?.id === undefined) return { ok: false, message: "No active browser tab was found." };
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fn,
      args: [value],
    });
    const response = results[0]?.result as ActionResponse | undefined;
    return response ?? { ok: false, message: "The page did not respond." };
  } catch (error) {
    console.warn("Screen Saathi runOnActiveTab failed", error);
    return {
      ok: false,
      message: error instanceof Error ? error.message : "This page cannot be changed.",
    };
  }
}

function highlightElement(targetId: string): ActionResponse {
  const findTarget = (id: string): HTMLElement | null => {
    try {
      const bySaathi = document.querySelector<HTMLElement>(`[data-saathi-id="${CSS.escape(id)}"]`);
      if (bySaathi !== null) return bySaathi;
    } catch {}
    const byId = document.getElementById(id);
    if (byId !== null) return byId;
    try {
      const byName = document.querySelector<HTMLElement>(`[name="${CSS.escape(id)}"]`);
      if (byName !== null) return byName;
      const byLabel = document.querySelector<HTMLElement>(`[aria-label="${CSS.escape(id)}"]`);
      if (byLabel !== null) return byLabel;
    } catch {}
    return null;
  };

  const element = findTarget(targetId);
  if (element === null) return { ok: false, message: "The highlighted item is no longer on the page." };
  element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  const oldOutline = element.style.outline;
  const oldOffset = element.style.outlineOffset;
  element.style.outline = "4px solid #f59e0b";
  element.style.outlineOffset = "4px";
  window.setTimeout(() => {
    element.style.outline = oldOutline;
    element.style.outlineOffset = oldOffset;
  }, 3500);
  return { ok: true };
}

function executeAction(action: Action): ActionResponse {
  const findTarget = (id: string): HTMLElement | null => {
    try {
      const bySaathi = document.querySelector<HTMLElement>(`[data-saathi-id="${CSS.escape(id)}"]`);
      if (bySaathi !== null) return bySaathi;
    } catch {}
    const byId = document.getElementById(id);
    if (byId !== null) return byId;
    try {
      const byName = document.querySelector<HTMLElement>(`[name="${CSS.escape(id)}"]`);
      if (byName !== null) return byName;
      const byLabel = document.querySelector<HTMLElement>(`[aria-label="${CSS.escape(id)}"]`);
      if (byLabel !== null) return byLabel;
    } catch {}
    return null;
  };

  const element = findTarget(action.target_id);
  if (element === null) return { ok: false, message: "That field is no longer on the page." };
  const input = element as HTMLInputElement;
  const label = `${element.textContent ?? ""} ${element.getAttribute("aria-label") ?? ""} ${input.type}`;
  if (
    input.disabled ||
    input.type === "password" ||
    input.autocomplete === "one-time-code" ||
    input.autocomplete.startsWith("cc-") ||
    input.type === "submit" ||
    input.type === "button" ||
    /submit|pay|send|confirm|delete|transfer|जमा|भुगतान|भेजें|पुष्टि|हटाएं|हटाएँ/i.test(label)
  ) {
    return { ok: false, message: "This protected field cannot be changed." };
  }
  if (action.type === "focus") {
    element.focus();
    return { ok: true };
  }
  if (action.type === "fill") {
    if (action.value === null || action.value === undefined) return { ok: false, message: "No value was provided." };
    input.value = action.value;
    try {
      const proto = Object.getPrototypeOf(input);
      const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
      descriptor?.set?.call(input, action.value);
    } catch {}
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("blur", { bubbles: true }));
    return { ok: true };
  }
  if (action.type === "select") {
    const select = element as HTMLSelectElement;
    const option = Array.from(select.options).find((candidate) => candidate.textContent?.trim() === action.option || candidate.value === action.option);
    if (option === undefined) return { ok: false, message: "That option is not available." };
    select.value = option.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true };
  }
  if (action.type === "check") {
    const checkbox = element as HTMLInputElement;
    if (checkbox.type !== "checkbox" && checkbox.type !== "radio") return { ok: false, message: "That is not a checkbox." };
    checkbox.checked = action.checked === true;
    checkbox.dispatchEvent(new Event("input", { bubbles: true }));
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true };
  }
  return { ok: false, message: "This action is not supported." };
}

async function snapshotActiveTab(): Promise<SnapshotResponse> {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const tab = tabs[0];
  if (tab?.id === undefined) {
    return {
      type: SNAPSHOT_RESPONSE,
      ok: false,
      code: "no_active_tab",
      message: "No active browser tab was found.",
    };
  }

  const stored = await chrome.storage.local.get(DENYLIST_STORAGE_KEY);
  const configured = stored[DENYLIST_STORAGE_KEY];
  const patterns = Array.isArray(configured) && configured.every((item) => typeof item === "string")
    ? configured
    : DEFAULT_DENYLIST;
  if (typeof tab.url === "string" && isDenylisted(tab.url, patterns)) {
    return {
      type: SNAPSHOT_RESPONSE,
      ok: false,
      code: "denylisted",
      message: "Screen Saathi will not read this sensitive page.",
    } as SnapshotFailure;
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: buildSnapshot,
    });
    const snapshot = results[0]?.result;
    if (snapshot === undefined) throw new Error("The page returned no snapshot.");
    return { type: SNAPSHOT_RESPONSE, ok: true, snapshot };
  } catch {
    return {
      type: SNAPSHOT_RESPONSE,
      ok: false,
      code: "restricted_page",
      message: "This Chrome page cannot be read. Try a normal website tab.",
    };
  }
}

async function selectedTextActiveTab(): Promise<{ text: string }> {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const tab = tabs[0];
  if (tab?.id === undefined) return { text: "" };
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: readSelectionRedacted,
    });
    const text = results[0]?.result;
    return { text: typeof text === "string" ? text.slice(0, 20_000) : "" };
  } catch {
    return { text: "" };
  }
}

function readSelectionRedacted(): string {
  const raw = window.getSelection()?.toString() ?? "";
  const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
  const pan = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/gu;
  const aadhaar = /\b[0-9]{4}(?:[ -]?[0-9]{4}){2}\b/gu;
  const phone = /(?<![0-9])(?:\+?91[ -]?)?[6-9][0-9]{9}(?![0-9])/gu;
  const card = /(?<![0-9])(?:[0-9][ -]?){12,18}[0-9](?![0-9])/gu;
  const luhn = (value: string): boolean => {
    const digits = value.replace(/\D/gu, "");
    let sum = 0;
    let double = false;
    for (let index = digits.length - 1; index >= 0; index -= 1) {
      let digit = Number(digits[index]);
      if (double) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      double = !double;
    }
    return digits.length >= 13 && digits.length <= 19 && sum % 10 === 0;
  };
  const counters = new Map<string, number>();
  const placeholder = (kind: string): string => {
    const next = (counters.get(kind) ?? 0) + 1;
    counters.set(kind, next);
    return `[${kind}_${next}]`;
  };
  let result = raw.replace(pan, () => placeholder("PAN"));
  result = result.replace(email, () => placeholder("EMAIL"));
  result = result.replace(card, (candidate) => luhn(candidate) ? placeholder("CARD") : candidate);
  result = result.replace(aadhaar, () => placeholder("AADHAAR"));
  return result.replace(phone, () => placeholder("PHONE")).slice(0, 20_000);
}
