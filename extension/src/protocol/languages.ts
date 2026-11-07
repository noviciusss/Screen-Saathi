import type { SupportedLanguage } from "./types";

export const LANGUAGE_OPTIONS = [
  { code: "hi-IN", label: "हिन्दी" },
  { code: "hi-en", label: "हिंग्लिश" },
  { code: "en-IN", label: "English" },
] as const satisfies ReadonlyArray<{ code: SupportedLanguage; label: string }>;

export function languageLabel(language: SupportedLanguage): string {
  return LANGUAGE_OPTIONS.find((option) => option.code === language)?.label ?? language;
}

export function languageFontClass(language: SupportedLanguage): "indic" | "english" {
  return language === "en-IN" ? "english" : "indic";
}
