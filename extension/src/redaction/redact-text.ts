const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const PAN_PATTERN = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/gu;
const AADHAAR_PATTERN = /\b[0-9]{4}(?:[ -]?[0-9]{4}){2}\b/gu;
const PHONE_PATTERN = /(?<![0-9])(?:\+?91[ -]?)?[6-9][0-9]{9}(?![0-9])/gu;
const CARD_PATTERN = /(?<![0-9])(?:[0-9][ -]?){12,18}[0-9](?![0-9])/gu;

function luhnValid(value: string): boolean {
  const digits = value.replace(/\D/gu, "");
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
}

/** Redact page-derived PII before a snapshot can leave the browser. */
export function redactText(value: string): string {
  const counters = new Map<string, number>();
  const placeholder = (kind: string): string => {
    const next = (counters.get(kind) ?? 0) + 1;
    counters.set(kind, next);
    return `[${kind}_${next}]`;
  };

  let redacted = value.replace(PAN_PATTERN, () => placeholder("PAN"));
  redacted = redacted.replace(EMAIL_PATTERN, () => placeholder("EMAIL"));
  redacted = redacted.replace(CARD_PATTERN, (candidate) =>
    luhnValid(candidate) ? placeholder("CARD") : candidate,
  );
  redacted = redacted.replace(AADHAAR_PATTERN, () => placeholder("AADHAAR"));
  redacted = redacted.replace(PHONE_PATTERN, () => placeholder("PHONE"));
  return redacted;
}

export function isSensitiveField(element: Element): boolean {
  const input = element as HTMLInputElement;
  const type = (input.getAttribute("type") ?? "").toLowerCase();
  const autocomplete = (input.getAttribute("autocomplete") ?? "").toLowerCase();
  return (
    type === "password" ||
    autocomplete === "one-time-code" ||
    autocomplete.startsWith("cc-") ||
    autocomplete.includes("cc-number")
  );
}
