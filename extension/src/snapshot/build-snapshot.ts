import type { PageSnapshot } from "./types";

/**
 * Browser-only Phase 0 snapshot builder.
 *
 * It is deliberately self-contained so Playwright can serialize it into a
 * real Chromium page for visibility and layout measurements. Phase 2 will add
 * production redaction, richer shadow-root traversal, and ranking refinements.
 */
export function buildSnapshot(): PageSnapshot {
  const MAX_ELEMENTS = 250;
  const MAX_TOKENS = 5000;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const viewportBottom = window.scrollY + viewportHeight;
  const elementIds = new WeakMap<Element, string>();
  let nextElementNumber = 1;
  let nextTextNumber = 1;
  let nextHeadingNumber = 1;
  let nextFormNumber = 1;

  const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
  const panPattern = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/gu;
  const aadhaarPattern = /\b[0-9]{4}(?:[ -]?[0-9]{4}){2}\b/gu;
  const phonePattern = /(?<![0-9])(?:\+?91[ -]?)?[6-9][0-9]{9}(?![0-9])/gu;
  const cardPattern = /(?<![0-9])(?:[0-9][ -]?){12,18}[0-9](?![0-9])/gu;
  const luhnValid = (candidate: string): boolean => {
    const digits = candidate.replace(/\D/gu, "");
    if (digits.length < 13 || digits.length > 19) return false;
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
    return sum % 10 === 0;
  };
  const redact = (value: string): string => {
    const counters = new Map<string, number>();
    const placeholder = (kind: string): string => {
      const next = (counters.get(kind) ?? 0) + 1;
      counters.set(kind, next);
      return `[${kind}_${next}]`;
    };
    let result = value.replace(panPattern, () => placeholder("PAN"));
    result = result.replace(emailPattern, () => placeholder("EMAIL"));
    result = result.replace(cardPattern, (candidate) =>
      luhnValid(candidate) ? placeholder("CARD") : candidate,
    );
    result = result.replace(aadhaarPattern, () => placeholder("AADHAAR"));
    result = result.replace(phonePattern, () => placeholder("PHONE"));
    return result;
  };
  const clean = (value: string): string => redact(value.replace(/\s+/gu, " ").trim());
  const estimateTokens = (value: string): number => Math.ceil(value.length / 4);
  const isVisible = (element: Element): boolean => {
    const htmlElement = element as HTMLElement;
    const ownerWindow = element.ownerDocument.defaultView ?? window;
    const style = ownerWindow.getComputedStyle(htmlElement);
    const rect = htmlElement.getBoundingClientRect();
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0" &&
      rect.width > 0 &&
      rect.height > 0
    );
  };
  const rectFor = (element: Element): [number, number, number, number] => {
    const rect = (element as HTMLElement).getBoundingClientRect();
    return [
      Math.round(rect.x),
      Math.round(rect.y),
      Math.round(rect.width),
      Math.round(rect.height),
    ];
  };
  const inView = (element: Element): boolean => {
    const rect = (element as HTMLElement).getBoundingClientRect();
    const ownerWindow = element.ownerDocument.defaultView ?? window;
    return (
      rect.bottom > 0 &&
      rect.top < ownerWindow.innerHeight &&
      rect.right > 0 &&
      rect.left < ownerWindow.innerWidth
    );
  };
  const idFor = (element: Element): string => {
    const existing = elementIds.get(element);
    if (existing !== undefined) return existing;
    const id = `e${nextElementNumber}`;
    nextElementNumber += 1;
    elementIds.set(element, id);
    element.setAttribute("data-saathi-id", id);
    return id;
  };
  const associatedLabel = (element: Element): string => {
    const input = element as HTMLInputElement;
    if (input.id !== "") {
      const ownerDocument = element.ownerDocument;
      const label = ownerDocument.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(input.id)}"]`);
      if (label !== null) return clean(label.textContent ?? "");
    }
    const parentLabel = element.closest("label");
    return parentLabel === null ? "" : clean(parentLabel.textContent ?? "");
  };
  const accessibleName = (element: Element): string => {
    const ariaLabel = element.getAttribute("aria-label");
    if (ariaLabel !== null && clean(ariaLabel) !== "") return clean(ariaLabel);
    const labelledBy = element.getAttribute("aria-labelledby");
    if (labelledBy !== null) {
      const labelledText = labelledBy
        .split(/\s+/u)
        .map((id) => element.ownerDocument.getElementById(id)?.textContent ?? "")
        .join(" ");
      if (clean(labelledText) !== "") return clean(labelledText);
    }
    const label = associatedLabel(element);
    if (label !== "") return label;
    const placeholder = element.getAttribute("placeholder");
    if (placeholder !== null && clean(placeholder) !== "") return clean(placeholder);
    const title = element.getAttribute("title");
    if (title !== null && clean(title) !== "") return clean(title);
    return clean(element.textContent ?? "");
  };
  const isInteractive = (element: Element): boolean => {
    const tag = element.tagName.toLowerCase();
    return (
      ["a", "button", "input", "select", "textarea", "option", "iframe"].includes(tag) ||
      element.getAttribute("role") !== null ||
      element.hasAttribute("tabindex")
    );
  };
  const fieldValue = (element: Element): string => {
    const htmlElement = element as HTMLInputElement;
    const type = (htmlElement.getAttribute("type") ?? "").toLowerCase();
    const autocomplete = (htmlElement.getAttribute("autocomplete") ?? "").toLowerCase();
    if (
      type === "password" ||
      autocomplete === "one-time-code" ||
      autocomplete.startsWith("cc-") ||
      autocomplete.includes("cc-number")
    ) return "[hidden]";
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      return clean(element.value);
    }
    if (element instanceof HTMLSelectElement) return clean(element.value);
    return "";
  };
  const sensitiveField = (element: Element): boolean => {
    const input = element as HTMLInputElement;
    const type = (input.getAttribute("type") ?? "").toLowerCase();
    const autocomplete = (input.getAttribute("autocomplete") ?? "").toLowerCase();
    return (
      type === "password" ||
      autocomplete === "one-time-code" ||
      autocomplete.startsWith("cc-") ||
      autocomplete.includes("cc-number")
    );
  };
  const fieldState = (element: Element): string[] => {
    const state: string[] = [];
    const htmlElement = element as HTMLInputElement;
    if (htmlElement.disabled) state.push("disabled");
    if (htmlElement.hidden || !isVisible(element)) state.push("hidden");
    if (htmlElement.required) state.push("required");
    if (fieldValue(element) === "") state.push("empty");
    return state;
  };
  const allElements: Element[] = [];
  const allTextRoots: Element[] = [];
  const visitRoot = (root: Document | ShadowRoot): void => {
    for (const element of Array.from(root.querySelectorAll("*"))) {
      allElements.push(element);
      if (element.shadowRoot !== null) visitRoot(element.shadowRoot);
      if (element.tagName.toLowerCase() === "iframe") {
        const frame = element as HTMLIFrameElement;
        try {
          if (frame.contentDocument !== null) visitRoot(frame.contentDocument);
        } catch {
          // Cross-origin frames are represented by their iframe element.
        }
      }
    }
  };
  visitRoot(document);

  const visibleElements = allElements.filter(isVisible);
  const interactive = visibleElements.filter(isInteractive);
  interactive.sort((left, right) => {
    const leftInView = inView(left) ? 0 : 1;
    const rightInView = inView(right) ? 0 : 1;
    return leftInView - rightInView;
  });
  const selectedInteractive = interactive.slice(0, MAX_ELEMENTS);
  const selectedSet = new Set(selectedInteractive);
  const elements = selectedInteractive.map((element): PageSnapshot["elements"][number] => {
    const form = element.closest("form");
    const type = element.getAttribute("type");
    const hint = element.getAttribute("placeholder") ?? element.getAttribute("title");
    let crossOriginFrame = false;
    if (element.tagName.toLowerCase() === "iframe") {
      try {
        crossOriginFrame = (element as HTMLIFrameElement).contentDocument === null;
      } catch {
        crossOriginFrame = true;
      }
    }
    return {
      id: idFor(element),
      tag: element.tagName.toLowerCase(),
      role: element.getAttribute("role"),
      type,
      name: accessibleName(element),
      hint: hint === null ? null : clean(hint),
      required: (element as HTMLInputElement).required === true,
      value: fieldValue(element),
      state: fieldState(element),
      rect: rectFor(element),
      in_view: inView(element),
      form: form === null ? null : idFor(form),
      sensitive: sensitiveField(element),
      autocomplete: element.getAttribute("autocomplete"),
      ...(element.tagName.toLowerCase() === "iframe" ? { cross_origin_frame: crossOriginFrame } : {}),
    };
  });

  const headings = visibleElements
    .filter((element) => /^H[1-6]$/u.test(element.tagName))
    .map((element) => ({
      id: `h${nextHeadingNumber++}`,
      level: Number(element.tagName.slice(1)),
      text: clean(element.textContent ?? ""),
    }))
    .filter((heading) => heading.text !== "");

  const candidateTextBlocks = visibleElements
    .filter((element) => !selectedSet.has(element) && !isInteractive(element))
    .map((element) => ({
      id: `t${nextTextNumber++}`,
      text: clean(element.textContent ?? ""),
      in_view: inView(element),
    }))
    .filter((block) => block.text.length >= 12)
    .filter((block, index, blocks) => blocks.findIndex((candidate) => candidate.text === block.text) === index)
    .slice(0, 100);

  const baseText = [
    document.title,
    ...headings.map((heading) => heading.text),
    ...elements.flatMap((element) => [element.name, element.hint ?? ""]),
  ].join(" ");
  let textBudget = estimateTokens(baseText);
  let textWasTruncated = false;
  const textBlocks = candidateTextBlocks.filter((block) => {
    const blockTokens = estimateTokens(block.text);
    if (textBudget + blockTokens > MAX_TOKENS) {
      textWasTruncated = true;
      return false;
    }
    textBudget += blockTokens;
    return true;
  });

  const forms = Array.from(document.forms).map((form) => {
    const formId = idFor(form);
    const fields = Array.from(form.elements)
      .filter((element) => selectedSet.has(element))
      .map((element) => idFor(element));
    const submit = Array.from(form.elements).find((element) => {
      const input = element as HTMLInputElement;
      return input.type === "submit" || input.type === "button";
    });
    return {
      id: formId === "" ? `f${nextFormNumber++}` : formId,
      fields,
      submit: submit === undefined ? null : idFor(submit),
    };
  });

  const text = [baseText, ...textBlocks.map((block) => block.text)].join(" ");
  const estimatedTokens = estimateTokens(text);
  const truncated = textWasTruncated || interactive.length > MAX_ELEMENTS;
  return {
    url_host: window.location.host,
    title: clean(document.title),
    lang: document.documentElement.lang || "unknown",
    viewport: {
      w: viewportWidth,
      h: viewportHeight,
      scrollY: Math.round(window.scrollY),
      scrollMax: Math.max(0, document.documentElement.scrollHeight - viewportHeight),
    },
    headings,
    elements,
    text_blocks: textBlocks,
    forms,
    flags: {
      has_canvas_content: document.querySelector("canvas") !== null,
      is_pdf_viewer: window.location.pathname.toLowerCase().endsWith(".pdf"),
      truncated,
    },
    estimated_tokens: estimatedTokens,
  };
}
