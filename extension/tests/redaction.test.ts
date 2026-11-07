import { describe, expect, it } from "vitest";
import { isSensitiveField, redactText } from "../src/redaction/redact-text";

describe("page-data redaction", () => {
  it("redacts common PII types with typed placeholders", () => {
    const result = redactText(
      "Email test.user@example.com, PAN ABCDE1234F, Aadhaar 2345 6789 0123, phone +91 9876543210.",
    );
    expect(result).toBe(
      "Email [EMAIL_1], PAN [PAN_1], Aadhaar [AADHAAR_1], phone [PHONE_1].",
    );
  });

  it("redacts valid card-like numbers but preserves a non-card long number", () => {
    expect(redactText("Card 4111 1111 1111 1111; order 1234567890123456.")).toBe(
      "Card [CARD_1]; order 1234567890123456.",
    );
  });

  it("identifies password, OTP, and card fields without reading their values", () => {
    const field = (type = "", autocomplete = ""): Element =>
      ({
        getAttribute: (name: string) =>
          name === "type" ? type : name === "autocomplete" ? autocomplete : null,
      }) as unknown as Element;
    const password = field("password");
    const otp = field("text", "one-time-code");
    const card = field("text", "cc-number");
    const ordinary = field("text");

    expect(isSensitiveField(password)).toBe(true);
    expect(isSensitiveField(otp)).toBe(true);
    expect(isSensitiveField(card)).toBe(true);
    expect(isSensitiveField(ordinary)).toBe(false);
  });
});
