# Screen Saathi — Solution Pitch

> **An Accessible Voice Assistant for Bharat's Digital Web**
> Built for the *Great Indian AI Internship Challenge* by Gnani.ai

---

## 1. Problem Statement
Over 300 million Indian citizens are either elderly, digitally hesitant, or possess limited formal literacy. While India's digital public infrastructure (Aadhaar, UPI, DigiLocker, IRCTC) has rapidly expanded, web interfaces remain overwhelmingly visual, text-heavy, dense, and predominantly written in complex English or formal bureaucratic Hindi. Users frequently fall victim to urgent digital scams, abandon essential public welfare forms, or rely on intermediaries who risk exposing sensitive personal identifiers (PAN, Aadhaar, OTPs).

## 2. Solution Overview
**Screen Saathi** is an AI-powered voice assistant embedded directly into Chrome as a Manifest V3 side panel. Acting as a patient digital companion, Screen Saathi:
* **Explains Any Web Page Aloud:** Summarizes complex pages into 2–3 clear, everyday sentences in native Indian languages (Hindi, Hinglish, English).
* **Visual Grounding & Element Highlighting:** Scrolls to and highlights referenced buttons, inputs, and sections with a glowing outline while speaking.
* **Safety-First Guided Form Assistance:** Guides users step-by-step through multi-field forms, asking for values aloud and reading them back for confirmation.
* **Zero Trust & Hard Safety Gates:** Strictly prohibits clicking destructive or financial actions (Submit, Pay, Delete, Transfer) and masks all sensitive data.
* **On-Device Scam Detection:** Audits suspicious pages and urgent text for phishing patterns, unverified APK downloads, and fake KYC demands.

## 3. System Architecture & Tech Stack
Screen Saathi combines high-performance streaming speech infrastructure with an injection-resilient reasoning engine:

* **Speech-to-Text (STT):** **Gnani Prisma v4** realtime streaming WebSocket with Voice Activity Detection (VAD) delivering low-latency transcription for `hi-IN` and `en-IN`.
* **Text-to-Speech (TTS):** **Gnani Timbre v2.5** streaming synthesis in expressive Indic voices (*Nalini*, *Kaveri*, *Poorvi*), cached deterministically by text hash to preserve credits.
* **Cognitive Reasoner:** Structured OpenAI-compatible LLM operating in strict JSON mode with a lightweight DOM serializer reducing 250+ DOM nodes down to essential semantic landmarks (<1,500 tokens).
* **Chrome Extension (MV3):** Built with TypeScript, React, and Vite/WXT. Features an accessible high-contrast UI, large touch targets (min 56px), and native typography (Noto Sans Devanagari & Inter).
* **Audio Pipeline:** `AudioWorklet` capturing 16 kHz 16-bit mono PCM frames (1,024 bytes at ~32ms cadence) with a sample-accurate `PcmPlaybackQueue` for real-time streaming playback.

## 4. Key Safety & Privacy Guardrails
1. **Explain by Default, Act Only on Confirmation:** No field is ever populated without explicit visual (*"हाँ, भरें"*) or spoken affirmative confirmation (*"Haan" / "Yes"*).
2. **Never Click Submit or Pay:** Form inputs can be pre-filled after approval, but the user must click Submit themselves.
3. **Local PII Redaction:** Credit card numbers (Luhn-checked), Aadhaar numbers, PAN, phone numbers, and emails are redacted before off-device transit. Passwords and OTP inputs are replaced with `[hidden]` on-device.
4. **Untrusted Page Boundary:** Web DOM content is treated strictly as data within `<page_data>` delimiters, immunizing the system against prompt injection.

## 5. Summary & Impact
Screen Saathi bridges Bharat’s digital divide, transforming the open web into an approachable, voice-guided experience that empowers every citizen to use online services independently, safely, and with dignity.
