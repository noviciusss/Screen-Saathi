# GNANI_API_NOTES.md

Facts gathered on 14 Oct 2026 from Gnani's public docs and challenge pages. Treat `docs.gnani.ai` as the source of truth and **re-verify each item with a real call in spike S1/S2** before relying on it. Anything marked CONFLICT or UNKNOWN must be resolved and recorded in `docs/DECISIONS.md`.

Sources:
- Challenge page and blog: gnani.ai/internship, gnani.ai/resources/blogs/great-indian-ai-internship-challenge-2026
- Docs index: docs.gnani.ai/llms.txt (page list with `.md` versions of every doc page)
- Intro: docs.gnani.ai/api/introduction/introduction.md (marked "Last verified: 5 August 2026")
- STT realtime: docs.gnani.ai/api/STT/stt-websocket.md
- TTS realtime: docs.gnani.ai/api/TTS/tts-websocket.md
- Evon model card: huggingface.co/gnani/gnani-evon-v3.3-30B-A3B
- Console/dashboard for keys and credit usage: app.gnani.ai/voice

## 1. Challenge rules (summary)

- Opens 1 Oct 2026; **final submission 11:59 PM IST, 10 Nov 2026, fixed, no extensions**.
- Solo or team of two. Free entry. **5,000 programme credits** per registrant (team credits go to the primary registrant). Unit cost per call is not stated in what we read: UNKNOWN, measure in the dashboard.
- Project must use Gnani models/APIs and the submission must name them and each member's role.
- Public demo on LinkedIn or X with `#GreatIndianAIInternshipChallenge #GnaniAI` is the entry point; engagement is verified; purchased engagement is banned.
- Use synthetic data only (no real phone, Aadhaar, PAN, account numbers, or recorded calls).
- Up to 100 paid 6-month internships from 1 Jan 2027; ten awards of INR 50,000 (one per person/team max). Award list includes Real Deal, Mixed Vibes, Small Town Big Build, Demo Day Drop, Crowd Favourite.
- Registration form: gnani.ai/great-indian-ai-internship-registration-form (project details can be edited until final submission).
- Participant email (received by the owner, Oct 2026) adds: models offered are Prisma (STT), Timbre (TTS, beta), Evon (30B reasoning model on Hugging Face); next steps are (1) describe the project in the participant workspace (problem, Gnani models/APIs, users, member contributions), (2) build and record a demo, (3) submit demo, written explanation, models/APIs used, and LinkedIn/X links; selection is on engagement on nominated public posts, then review, interviews, written offers; stipends up to INR 1 lakh per month per intern; internships start 1 Jan 2027 (scheduled); Gnani may change rules at any time. Support is via Discord or email.
- Docs re-checked 16 Oct 2026 (intro page "Last verified: 5 August 2026"): base URL `https://api.vachana.ai`, header `X-API-Key-ID`, Timbre v2.5 is the recommended TTS model and v2.0 is deprecated. So use `timbre-v2.5`; the `vachana-voice-v3` string seen in older material is treated as legacy until a live call proves otherwise.
- The docs do not state a credit price per call. Gnani's pages that we could reach contain no credit-to-usage conversion either. Treat it as UNKNOWN until S1/S2 measure it.

## 2. Common

- Base URL: `https://api.vachana.ai`
- Auth: header `X-API-Key-ID: <api key>` (header names are case-insensitive over HTTP; docs use both `X-API-Key-ID` and `x-api-key-id`).
- CONFLICT: an older PyPI page for `gnani-vachana` describes three credentials (organization id, API key, user id). Current docs show only the API key header. Verify in S1. Keep optional env vars `GNANI_ORGANIZATION_ID`, `GNANI_USER_ID` unused unless a call demands them.
- Browser `WebSocket` cannot set custom headers (stated in the docs). All Gnani connections go through our backend.
- Python SDK: `pip install gnani-vachana` (Python 3.10+). It does **not** expose STT VAD tuning. Use raw `websockets` for STT. The SDK is fine for quick REST checks.
- Languages (STT): bn-IN, en-IN, gu-IN, hi-IN, kn-IN, ml-IN, mr-IN, pa-IN, ta-IN, te-IN. English accepts Hindi-English mixed audio and outputs Latin script.

## 3. STT: Prisma v2.5 realtime

- Endpoint: `wss://api.vachana.ai/stt/v3/stream`. (A `/stt/v4/stream` route is mentioned in passing for word boosting; UNKNOWN whether it is the newer default. Use v3 as documented, and check v4 in S1.)
- Config is passed as **WebSocket upgrade headers**, fixed for the connection, except substitution and word-boosting which can be changed with `update_settings` frames.
- Required headers: `x-api-key-id`, `lang_code`.
- Useful headers: `x-sample-rate` (8000/16000/44100/48000, default 16000), `x-format` (`verbatim` default, or `transcribe` for inverse text normalization), `itn_native_numerals`, VAD: `x-vad-threshold` (default 0.7), `x-min-silence-ms` (500), `x-min-speech-ms` (100), `x-min-segment-ms` (120), `x-max-speech-s` (disabled). Word boosting: `x-bias-list` (up to 100 single words, letters only) + `x-bias-score` (0.0, 0.5, 1.0, 1.5, 2.0). Substitution: up to 10 rules.
- Audio: **raw PCM binary frames, exactly 1,024 bytes each** (512 samples of int16 LE mono). Send at real-time cadence: one frame per 32 ms at 16 kHz, 64 ms at 8 kHz. Do not buffer and burst. For 44.1/48 kHz sources the server resamples, but frames are still 1,024 bytes at the matching cadence. Our plan: resample to 16 kHz in the AudioWorklet.
- Server messages (JSON text): `connected`, `processing`, `transcript` (`text`, `audio_duration_ms`, `segment_id`, `segment_index`, `latency` in ms), `error`, `settings_updated`.
- Session cap: **15 minutes**. Reconnect transparently.
- Mentioned but not documented in what we read: `x-partials` header and `partial_transcript` messages. UNKNOWN, test in S1; useful for live captions.
- Latency claims: Gnani states P95 around 200 ms for STT (their benchmark). Measure ours end to end.
- Short-answer risk: raising `x-min-segment-ms` too far silently drops one-word answers like "haan"/"nahi". Our yes/no confirmation depends on these, so test them explicitly.
- REST STT exists for clips up to 60 s (`/api/STT/speech-to-text`) and Batch STT for long files. Not needed for the MVP, but REST is a handy fallback for tests.

## 4. TTS: Timbre v2.5 (beta)

- Realtime endpoint: `wss://api.vachana.ai/api/v1/tts`. Header: `X-API-Key-ID`.
- Also: REST (`/api/TTS/tts-inference`) and SSE streaming. An SSE URL seen in Gnani's marketing page: `https://api.vachana.ai/api/v1/tts/sse` with body field `"model": "vachana-voice-v3"`.
- CONFLICT (model string): current docs say model `timbre-v2.5` (recommended; Timbre v2.0 deprecated). Marketing/older plugin material shows `vachana-voice-v3`. Use `timbre-v2.5` and verify in S2.
- Request (JSON text message after connect): `text`, `voice` (e.g. `Nalini` Hindi, `Kaveri` English, `Deepak` Hindi, `Poorvi` Hinglish), `model`, `language` (`auto`, `hi-IN`, `en-IN`, `ta-IN`, `te-IN`, `kn-IN`, `ml-IN`, `mr-IN`, `pa-IN`, `bn-IN`, `gu-IN`, `hi-en` for Hinglish), `speed` (0.85–1.15 or "slow"/"medium"/"fast"), `audio_config` (`sample_rate` 8000–48000, `num_channels` 1, `sample_width` 2, `encoding` `linear_pcm`, `container` `wav`/`raw`/`mp3`/`ogg`/`mulaw`/`alaw`).
- Server messages: `start` (with `request_id`), `audio` (base64 in `data.audio`, `chunk_index`, `is_final`), `complete` (`is_final: true`, empty audio), `error`.
- **One synthesis request at a time per connection.** For parallelism, open a second connection.
- With `container=ogg`/`oggopus`, audio arrives as one chunk after synthesis completes, so it is not streaming. Use `linear_pcm` with `container=raw` or `wav` for streaming playback. CAUTION: with `container=wav`, check whether each chunk carries a WAV header or only the first; handle in S2. Prefer `raw` to avoid header handling.
- 42 voices, 10 Indian languages + English + Hinglish. Catalog: docs.gnani.ai/api/TTS/available-voices.md. Pick 2 voices per language in S2 (one female, one male) and record them.
- Gnani claims p95 TTS latency under 250 ms and MOS 4.23 (their numbers).
- CONFLICT (number handling): the realtime TTS page says to pass numbers, IDs, dates, currency as **spoken words** to avoid mispronunciation; the docs index describes a normalization guide saying the API converts them automatically. Test both in S2 with: a phone number, an amount like "2,50,000", a date, a PIN code. Keep a `tts_prep()` function behind a flag.
- Cache TTS: key = hash(text, voice, model, language, speed, audio_config). Pre-generate all static UI phrases once.

## 5. Evon v3.3 (reasoning, open weights, optional)

- `gnani/gnani-evon-v3.3-30B-A3B` on Hugging Face. Apache 2.0. 30B total, about 3.5B active, 128K context, BF16, hybrid Mamba2-Transformer MoE (`nemotron_h`). Needs `trust_remote_code=True` for Transformers.
- Input/output: **text only** (no images).
- Serving: vLLM >= 0.12.0 or SGLang. Example flags from the model card: `--max-model-len 131072 --trust-remote-code --enable-auto-tool-choice --tool-call-parser qwen3_coder --reasoning-parser nano_v3`. Listed hardware: H100 80GB, H200, A100.
- Recommended sampling: `temperature=0.6`, `top_p=0.95`. Disable thinking for latency with `chat_template_kwargs: {"enable_thinking": false}`. Keep a system instruction naming the target language and script.
- Limitation stated by Gnani: multi-step tool use is still being improved, so use strict JSON output, not tool calls.
- Not available on the Gnani API platform yet (per the challenge blog); run it yourself. Community quantizations are listed on the model page; whether they support this architecture in llama.cpp/Ollama is UNKNOWN.
- Practical status: needs GPU access. Treat as stretch (task T8).

## 6. Integrations that already exist

- Pipecat and LiveKit plugins for Gnani STT/TTS exist (`pipecat-gnani`, `livekit-plugins-gnani`). We do not use them in the extension flow, but they are useful references for correct frame pacing and message handling.

## 7. Credits and rate limits

- Total: **5,000 programme credits**, shared by everything. UNKNOWN: credits per second of STT audio, per character of TTS, concurrency and rate limits. (Credits are not LLM tokens; do not assume a conversion.)
- Action in S1/S2: read the dashboard balance, make a small measured batch (for example 10 STT clips of known length and 10 TTS requests of known character count), read the balance again, and write credits per STT second and per 100 TTS characters into `docs/DECISIONS.md` and the ledger in `docs/CHECKPOINT.md`. Then set `GNANI_DAILY_CALL_CAP`.
- Per-phase caps (adjust after measuring, but never exceed the total):

| Bucket | Credits | Notes |
|---|---|---|
| Phase 0 spikes (S1, S2) | 250 | Short clips only; stop early if a finding is clear |
| Build phases 1–4 | 1,500 | Live calls only for manual checks and recording fixtures |
| Eval (Phase 5) | 1,000 | ASR on a small clip set; TTS only for demo phrases; reuse cached audio |
| Demo recording and retakes | 750 | Pre-generate and cache the demo phrases once |
| Public/judge use of the live backend | 500 | Backend returns a polite "demo credits finished" reply at the cap |
| Reserve | 1,000 | Untouchable until Phase 6 |

- Enforcement: the 5,000 is a total across the whole project, and it covers only Gnani API calls (not your LLM tokens, not GPU rental; self-hosted Evon uses no Gnani credits). After S1/S2, the backend converts measured unit costs into a credit estimate per call and refuses calls past `GNANI_TOTAL_CREDIT_CAP` (default 4,000). Estimates drift, so reconcile with the dashboard after each live batch.
- Rules: automated tests never call Gnani (fake transports + recorded fixtures); every TTS output is cached; static UI phrases are generated once; the public backend has a hard daily cap and a kill-switch; the demo **video** is the primary evidence for judges, so the product must not depend on live credits at judging time.

## 8. Resolve-first checklist (spikes)

1. Does `X-API-Key-ID` alone authenticate STT and TTS?
2. TTS model string: `timbre-v2.5` works?
3. `/stt/v3/stream` vs `/stt/v4/stream`: which, and does `x-partials` exist?
4. WAV header handling in streamed TTS chunks.
5. Number/date/currency pronunciation: raw vs spoken-word input.
6. Hindi, Hinglish, and one more language: transcript quality on your own voice and on one older speaker (synthetic content only).
7. Short utterances ("haan", "nahi", "yes", "no") survive VAD settings.
8. Measured credit cost per call.
