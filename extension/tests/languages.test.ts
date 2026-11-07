import { describe, expect, it } from "vitest";
import { LANGUAGE_OPTIONS, languageFontClass, languageLabel } from "../src/protocol/languages";

describe("voice language mapping", () => {
  it("keeps the protocol language codes paired with native-facing labels", () => {
    expect(LANGUAGE_OPTIONS).toEqual([
      { code: "hi-IN", label: "हिन्दी" },
      { code: "hi-en", label: "हिंग्लिश" },
      { code: "en-IN", label: "English" },
    ]);
    expect(languageLabel("hi-IN")).toBe("हिन्दी");
    expect(languageLabel("hi-en")).toBe("हिंग्लिश");
    expect(languageLabel("en-IN")).toBe("English");
  });

  it("uses Indic typography for Hindi/Hinglish and English typography for English", () => {
    expect(languageFontClass("hi-IN")).toBe("indic");
    expect(languageFontClass("hi-en")).toBe("indic");
    expect(languageFontClass("en-IN")).toBe("english");
  });
});
