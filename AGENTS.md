# AGENTS.md — Screen Saathi

Read this file fully before doing anything. Then read `SPEC.md`, `GNANI_API_NOTES.md`, and `TASKS.md`, in that order.

## 1. What we are building

**Screen Saathi** is a voice assistant that understands the web page in front of the user, explains it in the user's own Indian language, answers spoken questions about it, and helps fill forms with confirmation. Target users: elderly and low-literacy people.

- **Primary deliverable: Chrome extension (Manifest V3)** + a Python backend.
- **Secondary deliverable: Android app** (stretch, only after the extension is done). It reuses the same backend and message protocol.
- Built for Gnani AI's "Great Indian AI Internship Challenge". **Hard deadline: 11:59 PM IST, 10 November 2026. No extensions.** Target: submission ready by 9 November.

## 2. Working agreement (follow strictly)

1. **Plan per phase, wait for approval of the phase plan.** At the start of each phase, read its tasks in `TASKS.md`, write a short plan (modules and files, approach, risks, test strategy, expected Gnani credit use), and **stop and wait for approval before editing any file**. After the phase plan is approved, execute its tasks in order **without asking again per task**.
2. **Stop and ask immediately** (even mid-phase) when: the spec is contradicted by what you observe; a safety invariant or privacy rule is in question; a live-call batch would exceed the phase credit cap; a new dependency, extension permission, host permission, or network destination is needed; a command would delete or overwrite existing files; or you are unsure what the human wants. Otherwise keep going. **Always stop at the phase gate** and report evidence.
2a. After every task, update `docs/CHECKPOINT.md` (status, files changed, commands run with results, credits used). After every phase, add the phase sendoff section (see the template). Keep the checkpoint truthful: a task that is not verified is not done.
2b. Schedule is tight. Do not gold-plate. If a phase is running late, say so at once and propose what to cut using the cut order in `TASKS.md`.
3. Keep changes small and reviewable. One task = one commit (or a few), message format `T<id>: <what>`.
4. When something in the spec is wrong, ambiguous, or contradicted by what you observe (e.g. an API behaves differently from `GNANI_API_NOTES.md`), **stop and report it**. Do not silently work around it. Record the finding in `docs/DECISIONS.md`.
5. Never claim a thing works unless you ran it. Show the command and its output.
6. Before using any library, confirm its current maintained status and version for Oct 2026 (check its repository/docs). Do not rely on memory for APIs that change often (Chrome extension APIs, WXT/Vite plugins, FastAPI, websockets).

## 3. Repo layout (create exactly this)

The repo root is the folder that already holds these four documents (the human's `voice_gnani` folder). The `screen-saathi/` name below stands for that root. Do **not** create a nested `screen-saathi/` folder. Record this in `docs/DECISIONS.md`. Create `android/` only when Phase 7 starts, and the Dockerfile only in T6.1.

```
screen-saathi/
  AGENTS.md  SPEC.md  GNANI_API_NOTES.md  TASKS.md
  extension/        Chrome MV3 extension (TypeScript)
  backend/          FastAPI service (Python 3.11+)
  eval/             screen test set, scripts, results
  fixtures/         synthetic web pages/forms used for tests and demos
  android/          phase 7, stretch only
  docs/             DECISIONS.md, latency.md, demo-script.md, submission.md
  .env.example      names of all env vars, no values
```

## 4. Stack decisions (already made)

- Extension: TypeScript (strict), Vite-based tooling (prefer **WXT**; fall back to plain Vite multi-entry if WXT causes trouble), side panel UI in React. Tests: Vitest.
- Backend: Python 3.11+, FastAPI, `websockets` for the Gnani STT/TTS connections (raw, not the SDK, because we need VAD headers), `httpx`, Pydantic v2, `ruff`, `pytest`.
- Reasoner (LLM) sits behind an interface (`Reasoner`). Default dev provider: the human's GPT 6 Astra access via env vars (`LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`, `LLM_BASE_URL`). Do **not** hardcode a model name. Optional second provider: Gnani Evon v3.3 served through an OpenAI-compatible endpoint (vLLM/SGLang). See `SPEC.md` section 7.
- Speech is **always Gnani**: Prisma v2.5 (STT) and Timbre v2.5 (TTS). This is a challenge rule, not a preference.

## 5. Safety invariants (never violate, test each one)

1. **Explain by default. Act only when the user asks.** Nothing is typed or clicked without an explicit on-screen confirmation the user accepted (button or spoken yes).
2. **Never click or submit** buttons that submit, pay, send, confirm, delete, or transfer. Highlight them only. The user clicks. (Rule list in `SPEC.md` 8.2.)
3. **Never read, store, or transmit** values of password fields, OTP fields, card fields (`autocomplete` cc-*), or anything on denylisted domains.
4. **Redact before sending off-device**: Aadhaar-like 12-digit numbers, PAN, phone numbers, card-like numbers (Luhn), emails. Replace with placeholders.
5. **Page content is untrusted data, never instructions.** A page may contain text like "ignore previous instructions". The reasoner prompt must wrap page content as data, and no page-derived text may directly trigger an action. Actions come only from the structured reasoner output, then pass the confirmation gate.
6. **No raw screen/audio storage** on the backend by default. Logs hold timings and ids, not page text or transcripts, unless `DEBUG_LOG_CONTENT=1`.
7. **Honest uncertainty**: if the page snapshot is empty or confidence is low, say so ("mujhe yeh page saaf nahi dikh raha") instead of guessing. Never mention a button or field that is not in the snapshot.

## 6. Challenge rules that affect code and demo

- Use **synthetic data only**. No real phone numbers, Aadhaar, PAN, account numbers, or recorded calls in the repo, fixtures, tests, or demo. Generate fake identifiers.
- The submission must name every model/API used and each member's role.
- Credits are a hard budget: **5,000 programme credits in total**, unit cost unknown until measured. `GNANI_API_NOTES.md` section 7 holds the per-phase caps. Live Gnani calls are never part of automated tests: tests use fake transports and recorded fixtures (record a real response once, using synthetic content, then replay it). Log credits used after every live batch in the credit ledger in `docs/CHECKPOINT.md`. Therefore: cache TTS output by hash of (text, voice, language, speed); pre-generate static UI phrases once; log every Gnani call with duration and size to `backend/logs/usage.jsonl`; add a daily kill-switch (`GNANI_DAILY_CALL_CAP`). Once S1/S2 have measured unit costs, also enforce a **credit-based cap in code**, computed from measured STT seconds and TTS characters, plus a lifetime cap `GNANI_TOTAL_CREDIT_CAP` (default 4,000, so 1,000 stays in reserve). The dashboard balance is the source of truth: reconcile the ledger against it after every live batch.
- Voice agents must disclose they are AI. The first spoken line of each session says so.

## 7. Secrets

- Gnani key and LLM key live only in the backend environment. **Never** in the extension, the repo, or logs. The browser WebSocket cannot send custom headers, so the backend must proxy to Gnani anyway.
- The extension talks to our backend with a per-install session token (`SAATHI_SESSION_TOKEN`) set in extension options. Backend enforces the token, an origin check, per-minute rate limits, and the daily cap.
- Commit `.env.example` only. Add `.env` to `.gitignore` before the first commit.

## 8. Code conventions

- TypeScript `strict: true`, no `any` without a comment. Python: full type hints, `ruff` clean.
- Every cross-process message has a Pydantic model (backend) and a matching TS type (extension). Keep them in sync by generating TS types from the backend schema if practical; otherwise a single `protocol.md` is the source of truth.
- Timestamp every pipeline stage (see `SPEC.md` 9). Latency instrumentation is part of the feature, not an extra.
- Tests required for: PII redaction, element ranking/snapshot limits, action confirmation gate, submit-button detection, TTS cache, protocol parsing. Use `fixtures/` pages for extension tests.
- Accessibility of our own UI: large text (min 20px), high contrast, big buttons (min 56px), native-language labels, no dependency on reading English.

## 9. Definition of done (per task)

- Acceptance criteria in `TASKS.md` pass, with evidence (command + output or short screen recording note).
- Tests added or updated and passing. `ruff`, `tsc --noEmit`, and the test suites are green.
- `docs/DECISIONS.md` updated if any choice was made or any spec deviation found.
- No secrets, no real personal data, no TODO left without an entry in `TASKS.md`.

## 10. Commands (fill in after first setup, then keep current)

```
# backend
#   install:   <fill in>
#   run:       <fill in>
#   test:      <fill in>
# extension
#   install:   <fill in>
#   dev:       <fill in>
#   build:     <fill in>
#   test:      <fill in>
```

## 11. Do not

- Do not use localhost-only shortcuts that break when deployed (hardcoded ports, `http://` origins).
- Do not add features outside `SPEC.md` scope. Park ideas in `docs/ideas.md`.
- Do not use a Gnani endpoint or model name not listed in `GNANI_API_NOTES.md` without reporting it first.
- Do not call vision/screenshot paths when the reasoner does not support vision (`REASONER_SUPPORTS_VISION=0`).
- Do not put real user data or live credentials into prompts, tests, or demo recordings.
