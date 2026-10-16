# TASKS.md — Screen Saathi

Dates are IST. **Rebaselined on 16 Oct 2026** (the earlier version assumed 14 Oct). Hard deadline 10 Nov 11:59 PM; internal submission target 8–9 Nov. Follow `AGENTS.md`: plan per phase, wait for approval, then execute the phase's tasks, stop at the phase gate, evidence for every acceptance criterion.

### Rebaselined schedule

| Phase | Dates | Gate output |
|---|---|---|
| 0 Setup + spikes | 16–18 Oct | Gnani behaviors and credit costs measured; scaffold green |
| 1 Voice loop | 19–22 Oct | Hold-to-talk echo works in Chrome; **teaser post 2** |
| 2 Page understanding | 23–27 Oct | Explain-this-page on 10 pages |
| 3 Guided actions | 28–30 Oct | Two forms filled with confirmation; **teaser post 3** |
| 4 Scam check + safety | 31 Oct – 2 Nov | Seven safety tests green |
| 5 Eval (lean) + 60 s demo | 2–4 Nov | Numbers published; demo video recorded 3 Nov |
| Final public post | **by 4 Nov** | Leaves about 6 days of engagement before close |
| 6 Packaging + submit | 4–8 Nov | Submitted 8–9 Nov, 10 Nov is emergency buffer only |
| 8 Evon (Gnani-only mode) | smoke 24–26 Oct, full 1–3 Nov | See Phase 8 |
| 7 Android | only if ahead | Otherwise roadmap + spike video |

### Cut order if behind
1. Human-rating depth (Phase 5). 2. Scam-check corpus size. 3. Iframe support. 4. Extra languages beyond Hindi/Hinglish + one. 5. Android (already last). **Never cut:** safety tests, confirmation gate, the 60 s demo video, the public post, credit ledger.

### Credit budget (5,000 total; see `GNANI_API_NOTES.md` section 7)
Spikes 250, build phases 1500, eval 1000, demo recording 750, public/judge usage 500, reserve 1000.

Legend: [H] = human action required, [A] = agent does it.

## Phase 0 — Setup and spikes (16–18 Oct)

**T0.1 [H] Account setup.** Registration is done and the API key exists (never paste it into chat or commit it). Remaining: note the starting credit balance from the dashboard; decide solo vs pair; in the **participant workspace** describe the project (problem, Gnani models/APIs planned, who uses it, member contributions); ask on the challenge Discord whether a non-Gnani LLM is acceptable alongside Prisma/Timbre, and whether Evon is expected in the stack.
Accept: key in local `.env` only; balance and workspace submission recorded in `docs/CHECKPOINT.md`.

**T0.3 [H] Social track starts now.** Selection is by engagement on nominated LinkedIn/X posts. Follow `ENGAGEMENT_PLAN.md` (seven posts; nominate the strongest one or two). Minimum four posts: (1) project announcement + the problem (by 18 Oct); (2) hold-to-talk Hindi voice loop clip (about 22 Oct); (3) form-fill with confirmation clip (about 30 Oct); (4) final 60 s demo (by 4 Nov). Use `#GnaniAI #GreatIndianAIInternshipChallenge`. No purchased or fake engagement. Keep a log (post, date, link, reach) in `docs/CHECKPOINT.md`.

**T0.2 [A] Repo scaffold.** Create layout from `AGENTS.md` section 3, `.gitignore` (with `.env`), `.env.example`, lint/test configs, empty `docs/DECISIONS.md`.
Accept: `ruff`, `tsc --noEmit`, `pytest`, `vitest` all run (even with zero tests).

**S1 [A] Gnani STT spike (Python script, no extension).** Stream a 16 kHz PCM sample file to the realtime STT endpoint at real-time cadence with the VAD headers from `SPEC.md` 9.1. Try `hi-IN`, `en-IN`, and a short "haan/nahi" clip. Check `x-partials`, v3 vs v4, `x-format: transcribe`.
Accept: transcripts printed with per-segment `latency`; findings for checklist items 1, 3, 6, 7 written to `docs/DECISIONS.md`.

**S2 [A] Gnani TTS spike.** Realtime WS synthesis in Hindi, Hinglish (`hi-en`), and one more language, with `linear_pcm`/`raw`. Test chunk format, a phone number, an amount, a date. Measure time to first chunk. Pick 2 voices per language.
Accept: playable audio files saved; checklist items 2, 4, 5, 8 resolved in `docs/DECISIONS.md`; chosen voices recorded.

**S3 [A] Extension audio spike.** Minimal MV3 extension: side panel with a hold-to-talk button, microphone permission flow (test a dedicated permission tab and direct side-panel `getUserMedia`), AudioWorklet producing 16 kHz int16 frames of exactly 1,024 bytes, and TTS playback of a canned PCM clip.
Accept: console shows frames of exactly 1,024 bytes at about 32 ms cadence; mic permission flow that works reliably is documented; audio playback works.

**S4 [A] Snapshot spike.** Content script that builds the section 5.1 snapshot on 5 fixture/real pages (a form, a news page, a table-heavy page, a page with an iframe, a Hindi-language page). Print token counts.
Accept: each snapshot under budget, correct names for at least 90 percent of interactive elements by manual spot check.

**S5 [A] Reasoner spike.** Call the dev reasoner (env-configured) with a snapshot plus a Hindi question, forcing the JSON schema in `SPEC.md` 6.3. Measure time to first token and validity rate over 20 runs. If Evon is reachable, run the same.
Accept: validity rate and latency written to `docs/DECISIONS.md`; vision support flag decided.

## Phase 1 — Voice loop MVP (19–22 Oct)

**T1.1 [A] Backend session service.** FastAPI `/v1/session` WebSocket: token auth, origin check, rate limit, daily call cap, usage log, protocol models (Pydantic).
Accept: unit tests for auth failure, rate limit, cap; protocol documented in `docs/protocol.md`.

**T1.2 [A] STT proxy.** Backend relays 1,024-byte frames to Gnani STT, emits `transcript` messages to the client; handles the 15-minute cap and reconnects.
Accept: end-to-end test with a prerecorded file through the backend; segments arrive with latency logged.

**T1.3 [A] TTS proxy with cache and sentence queue.** Streaming audio chunks to the client; cache by hash; pre-generated static phrases.
Accept: second request for the same text served from cache with no Gnani call; first-chunk time logged.

**T1.4 [A] Extension voice loop (echo mode).** Hold-to-talk → transcript shown → spoken echo reply in the chosen language. Barge-in stops playback. Language picker (large native-name buttons).
Accept: works in Chrome on a normal page with a real mic; release-to-first-audio measured and recorded; VAD settings tuned and noted.

## Phase 2 — Page understanding (23–27 Oct)

**T2.1 [A] Production snapshot builder.** From S4, add shadow DOM, same-origin iframes, budgets, `truncated`, hidden-value rules, element ids.
Accept: vitest suites on `fixtures/` pass; budget enforced.

**T2.2 [A] PII redaction.** Section 8.3 rules, with tests including near-miss strings (long order numbers must not be treated as Aadhaar unless they validate).
Accept: test table of at least 40 positive/negative cases passes.

**T2.3 [A] Reasoner service and prompt.** Provider interface, system prompt, injection-safe wrapping, JSON validation with one repair retry.
Accept: 20 fixture questions produce valid JSON at 95 percent or better; hostile fixtures are ignored.

**T2.4 [A] Streaming spoken reply.** Decide JSON-streaming vs two-phase output by measuring time to first spoken sentence. Sentences flow into the TTS queue as they complete.
Accept: time to first sentence under 1.5 s p50 on the tree path; decision recorded.

**T2.5 [A] Highlight overlay.** Scroll into view, outline the element, pulse, auto-clear; works over iframes where possible; never intercepts clicks.
Accept: visible on 5 fixture pages; screenshot evidence.

**T2.6 [A] "Explain this page" end to end (U1, U2).**
Accept: 10 pages, correct explanation and highlight on at least 8 by manual review; latency logged.

## Phase 3 — Guided actions (28–30 Oct)

**T3.1 [A] Action gate (backend).** Validate proposed actions against the latest snapshot and safety rules (8.2).
Accept: tests for password/OTP/card/hidden/disabled/unknown-id/submit-like targets all rejected.

**T3.2 [A] Fill executor (content script).** Set values using the native value setter plus `input`/`change`/`blur` events so React/Vue controlled inputs update; support text, textarea, select, radio, checkbox, date input fallback. Never submit.
Accept: works on fixture forms built with plain HTML, React, and a styled custom select; value visible and form state updated.

**T3.3 [A] Confirmation card (visual + voice).** Big yes/no buttons; spoken yes/no recognition allowlist for hi/en; read-back before each fill.
Accept: both button and spoken confirmation work; decline leaves the page untouched.

**T3.4 [A] Guided form flow (U3).** Ask each field in order, accept spoken value, propose fill, confirm, move on; final line tells the user to press submit themselves.
Accept: 2 synthetic forms completed end to end, no auto-submit, evidence recorded.

## Phase 4 — Scam check, safety, polish (31 Oct – 2 Nov)

**T4.1 [A] Selection and context menu.** "Ask Saathi" on selected text; read-aloud of a selection or section (U5).
Accept: works on a long Hindi paragraph and a short message.

**T4.2 [A] Scam check (U4).** Verdict plus 2 plain-language reasons; urgency, link mismatch, OTP/KYC requests as signals; low-confidence honesty.
Accept: results on the 60-message synthetic set recorded in `eval/results/`.

**T4.3 [A] Consent, disclosure, denylist, options page.** First-run consent read aloud, AI disclosure line, denylist UI, session token entry.
Accept: denylisted domain produces the refusal line and no snapshot is built.

**T4.4 [A] Safety test suite.** One automated test per invariant in `AGENTS.md` section 5, including prompt-injection fixtures.
Accept: all green; summarized in `docs/safety.md`.

## Phase 5 — Evaluation and latency (2–4 Nov)

**T5.1 [A] Build the 40-screen test set** with labeled targets (use large token budget: generate pages in bulk, then human-review at least 15).
**T5.2 [A] Eval runner** computing the section 10 metrics, outputting CSV and a README table.
**T5.3 [H+A] Human ratings.** At least 2 raters on explanation correctness for at least 25 of the 40 items; calibrate the LLM judge against them and report agreement.
**T5.4 [A] Latency report** p50/p95 per stage in `docs/latency.md`.
Accept: numbers exist, are honest, and are in the README.

## Phase 6 — Packaging and submission (4–9 Nov)

**T6.1 [A] Deploy backend** to a host with public WSS in a region near India; confirm it does not sleep during the demo window. Configure token, origin, cap.
**T6.2 [A] Package the extension** (unpacked zip + install steps, version, icons, store-style description). Test a clean install on a second Chrome profile.
**T6.3 [H] Demo video (60 s) and fuller walkthrough.** Script in `docs/demo-script.md`. Use synthetic data only; with consent, include a short session with an older relative using a fake form.
**T6.4 [H] Final public post on LinkedIn or X** with `#GreatIndianAIInternshipChallenge #GnaniAI`, posted **by 4 Nov** and nominated in the submission; share in relevant communities; no purchased engagement. Earlier teaser posts are tracked in T0.3.
**T6.5 [A] README and written explanation** (problem, users, models used and why, architecture, eval, limits, roles). `docs/submission.md` collects all submission fields.
**T6.6 [H] Submit** by 9 Nov; keep 10 Nov as emergency buffer only.

## Phase 7 — Android app (stretch, only if T6 is done or clearly ahead by ~1 Nov)

**T7.1 [A] Kotlin spike:** overlay bubble + `AccessibilityService` dumping the UI tree in the same snapshot schema.
**T7.2 [A] Voice loop in the app** against the same backend/protocol.
**T7.3 [A] Explain + highlight only** on 3 apps. Banking apps excluded; password fields excluded.
Accept: short screen recording; honest limitations in the README. If not finished, ship the spike video and a roadmap section instead.

## Phase 8 — Evon, Gnani-only mode (promoted from stretch; needs rented GPU)

Why promoted: the participant email says to start building on Gnani's own speech **and LLM** models. The product must keep working on the dev reasoner, but the demo video should show a **Gnani-only mode** (Prisma + Timbre + Evon). Decision 16 Oct.

**T8.0 [H+A] Early Evon smoke window (about 2 hours, 24–26 Oct).** Rent a GPU briefly, serve Evon, run the S5 prompt set (JSON validity, Hindi quality, time to first token, non-thinking mode). If Evon fails the validity bar, find out now, not on 2 Nov. Budget about 2 hours of rental.

**T8.1 [H] Get GPU time** for Evon v3.3. Decision (14 Oct): the owner's RTX 4060 (8 GB VRAM) and free Colab cannot hold a 30B-parameter model, so rent a single GPU for one bounded window (about 6–8 hours total), only after T5 has produced the eval set. Order of preference: (a) first check the Evon model page for a 4-bit quantized build that works with vLLM/llama.cpp; if one exists, a 24 GB GPU (RTX 4090 class) is far cheaper; (b) otherwise one 80 GB A100 or H100 (the model card's listed hardware) on a provider with per-second or per-minute billing. Use a provider tier that does not share hosts, and never put the Gnani key or the LLM key on the rented machine: it only serves the model. Stop the instance as soon as the eval run finishes. Record the actual cost in `docs/DECISIONS.md`.
**T8.2 [A] Serve with vLLM/SGLang**, add `EvonReasoner`, non-thinking mode, strict JSON.
**T8.3 [A] Run the full eval for both reasoners** and publish a side-by-side table (quality, latency, cost). Frame as "sovereign mode vs frontier mode".

## Parking lot (do not build now)

Click automation, multi-page journeys, payments/banking help, always-on listening, voice cloning, iOS, other browsers.
