# Screen Saathi

Screen Saathi is a Chrome Manifest V3 voice assistant for explaining web pages in an Indian language and guiding users through synthetic forms without acting behind their back.

## Phase 0 status

The project is being built phase by phase. The current phase is setup and spikes. See `docs/CHECKPOINT.md` for verified commands, decisions, credits, and the next approved step.

## Local setup

Requirements:

- Python 3.11.2
- Node 22.23.3 and npm
- uv for the backend environment
- Chrome/Chromium for manual extension checks

Copy `.env.example` to `.env` and fill values locally. Never commit `.env` or share its contents. Gnani and LLM credentials stay in the backend environment only.

Backend dependencies are managed by `backend/pyproject.toml` and `backend/uv.lock`. Extension dependencies are managed by `extension/package.json` and `extension/package-lock.json`.

## Checks

The offline project check is:

```bash
make test
```

It never calls Gnani. Live Gnani calls are isolated to the S1 and S2 spike scripts and are run manually with synthetic content only.

## Project layout

```text
backend/    FastAPI service and spike scripts
extension/  Chrome MV3 TypeScript extension
fixtures/   Synthetic pages and forms
eval/       Evaluation data and results
docs/       Decisions, checkpoint, latency, demo, and submission notes
```

The Dockerfile is intentionally deferred to T6.1 as required by the project instructions.
