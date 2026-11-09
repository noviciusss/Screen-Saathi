# Screen Saathi

> **An Accessible Voice Assistant for Bharat's Digital Web**  
> Built for the *Great Indian AI Internship Challenge* by Gnani.ai  
> 📄 **Official Solution Pitch:** [Read PITCH.md](PITCH.md)

Screen Saathi is a Chrome Manifest V3 voice assistant for explaining web pages in an Indian language and guiding users through synthetic forms without acting behind their back.

## Current status

The extension-first assistant flow is implemented through the redacted page
snapshot, structured reasoner response, highlight overlay, scam verdict card,
and confirmation-gated page actions. See [PITCH.md](PITCH.md) and `docs/safety.md`
for architecture, safety invariants, and evaluation details.

## Local setup

Requirements:

- Python 3.11.2
- Node 22.23.3 and npm
- uv for the backend environment
- Chrome/Chromium for manual extension checks

Playwright Chromium system packages required for the Phase 0 browser harness:

```text
libglib2.0-0 libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2
libdrm2 libdbus-1-3 libxcb1 libxkbcommon0 libx11-6 libxcomposite1
libxdamage1 libxext6 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0
libcairo2 libasound2
```

If Chromium reports a missing shared library such as `libnspr4.so`, install
the browser dependencies inside the current OmniRush box with:

```bash
npm --prefix extension exec -- playwright install-deps chromium
```

If that command is blocked by an unrelated stale CUDA apt source, install the
same Ubuntu libraries directly without running `apt update`:

```bash
sudo apt-get install -y --no-install-recommends \
  libglib2.0-0 libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
  libdrm2 libdbus-1-3 libxcb1 libxkbcommon0 libx11-6 libxcomposite1 \
  libxdamage1 libxext6 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
  libcairo2 libasound2t64
```

Copy `.env.example` to `.env` and fill values locally. Never commit `.env` or share its contents. Gnani and LLM credentials stay in the backend environment only.

Backend dependencies are managed by `backend/pyproject.toml` and `backend/uv.lock`. Extension dependencies are managed by `extension/package.json` and `extension/package-lock.json`.

## Checks

The offline project check is:

```bash
make test
```

It never calls Gnani. Live Gnani calls are isolated to the S1 and S2 spike scripts and are run manually with synthetic content only.

The browser-only Phase 0 checks are explicit because they require the local
Playwright Chromium download:

```bash
PLAYWRIGHT_BROWSERS_PATH="$PWD/extension/.playwright-browsers" npm --prefix extension run test:snapshot
PLAYWRIGHT_BROWSERS_PATH="$PWD/extension/.playwright-browsers" npm --prefix extension run test:audio
```

S3's automated test uses Chromium's `--use-fake-device-for-media-stream`,
`--use-fake-ui-for-media-stream`, and
`--use-file-for-fake-audio-capture=<synthetic wav>` flags. Host Chrome still
needs a manual permission-flow check.

The Gnani spike scripts are intentionally guarded. They use these local,
synthetic, frame-aligned inputs by default:

```text
backend/spikes/audio/hi-IN-synthetic-aligned.wav
backend/spikes/audio/en-IN-synthetic-aligned.wav
backend/spikes/audio/haan-nahi-synthetic-aligned.wav
```

Inspect plans without a network call:

```bash
uv run --project backend python backend/spikes/s1_stt.py --dry-run
uv run --project backend python backend/spikes/s2_tts.py --list-only
```

With `GNANI_API_KEY` available only in the local `.env`, run one calibration
per service, stop, and reconcile the dashboard before any full batch:

```bash
uv run --project backend python backend/spikes/s1_stt.py --calibration --confirm-live
uv run --project backend python backend/spikes/s2_tts.py --calibration --confirm-live
```

The full S2 plan contains exactly 12 requests and is blocked until its
calibration marker exists. The approved matrix covers Hindi, English,
Hinglish, and Tamil, using the official Timbre v2.5 voice catalog. No
automated test calls Gnani.

After the live S2 batch succeeds, create the five S1 inputs directly from the
returned Timbre WAV files, without a speech-generator dependency:

```bash
uv run --project backend python backend/spikes/make_s1_clips.py
```

This resamples the selected 24 kHz mono PCM16 outputs to 16 kHz mono PCM16 and
pads each file to exact 1,024-byte frames. The S1 sequence is then:

```bash
# v3 primary language clips
uv run --project backend python backend/spikes/s1_stt.py --clip hi-IN=backend/spikes/audio/hi-sentence.wav --clip en-IN=backend/spikes/audio/en-sentence.wav --clip en-IN=backend/spikes/audio/hinglish-sentence.wav --confirm-live

# v3 short-answer clips with x-partials
uv run --project backend python backend/spikes/s1_stt.py --clip hi-IN=backend/spikes/audio/haan.wav --clip hi-IN=backend/spikes/audio/nahi.wav --partials --confirm-live

# v4 comparison on Hindi and short-answer clips
uv run --project backend python backend/spikes/s1_stt.py --api-version v4 --clip hi-IN=backend/spikes/audio/hi-sentence.wav --clip hi-IN=backend/spikes/audio/haan.wav --confirm-live
```

Reconcile the Gnani dashboard after the S2 batch and after each S1 block;
these commands are live calls and must not be placed in `make test`.

## Project layout

```text
backend/    FastAPI service and spike scripts
extension/  Chrome MV3 TypeScript extension
fixtures/   Synthetic pages and forms
eval/       Evaluation data and results
docs/       Decisions, checkpoint, latency, demo, and submission notes
```

The Dockerfile is intentionally deferred to T6.1 as required by the project instructions.

## Phase 1 local voice-loop run

Phase 1 keeps the backend URL and session token out of the extension source.
For a local unpacked-extension smoke test, set these values in a local
`extension/.env.local` file (never commit it):

```text
VITE_SAATHI_BACKEND_URL=http://127.0.0.1:8000
VITE_SAATHI_SESSION_TOKEN=<same synthetic local token as backend .env>
```

Set the backend values in the root `.env`:

```text
SAATHI_SESSION_TOKEN=<same synthetic local token>
SAATHI_ALLOWED_ORIGINS=chrome-extension://<id-from-chrome>
```

For the page assistant, configure either the generic OpenAI-compatible names
or the Groq aliases in the backend `.env` (never in the extension):

```text
LLM_PROVIDER=groq
LLM_MODEL=<your selected model>
LLM_API_KEY=<your key>
LLM_BASE_URL=<your OpenAI-compatible chat base URL>
```

Equivalent `GROQ_API_KEY`, `GROQ_MODEL`, and `GROQ_BASE_URL` names are also
accepted. The local repository currently contains no such values; S5 reports
blocked until they are supplied locally.

Start the local backend from the repository root:

```bash
uv run --project backend uvicorn screen_saathi.app:app --app-dir backend/src --host 127.0.0.1 --port 8000
```

Build the extension and load `extension/.output/chrome-mv3` as an unpacked
extension in Chrome, or use the generated
`extension/dist/screen-saathi-extension-0.1.0-install.zip`. Open the extension
Options page and save the backend URL and session token; the extension's ID
must match the configured allowed origin. The automated tests use fake
transports and do not contact the backend or Gnani.

## Phase 2 page snapshot permission model

The page-understanding foundation uses Chrome's temporary `activeTab` plus
`scripting` permissions instead of permanent access to every HTTP/HTTPS page.
Invoke Screen Saathi from the extension action on a normal website, open the
side panel, and press **Prepare this page**. The service worker then runs the
redacting snapshot builder in the active tab. `chrome://` pages, the Chrome Web
Store, and other restricted pages are reported as unreadable rather than
bypassed. The generated snapshot contains redacted PII and `[hidden]` values
for password, OTP, and card fields.
