# Decisions — Screen Saathi

## D0.1 — Repository root

The repository root is `/mnt/d/voice_gnani`, the directory containing the planning documents. No nested `screen-saathi/` directory will be created.

## D0.2 — Canonical checkpoint path

The canonical checkpoint path is `docs/CHECKPOINT.md`. At setup time, the workspace contained both `CHECKPOINT.md` and `doc/CHECKPOINT.md`; the root-level checkpoint had the newer environment-name list because it included `GNANI_TOTAL_CREDIT_CAP`. The canonical file is created from that newer template. The legacy `doc/CHECKPOINT.md` is preserved and is not used for future updates.

## D0.3 — Phase 0 call boundary

Automated tests are offline and cannot call Gnani. Live Gnani calls are isolated to the S1 STT and S2 TTS spike scripts. S3, S4, and S5 use local or configured non-Gnani resources only.

## D0.4 — Snapshot budget

The page snapshot builder treats 5,000 approximate tokens as a hard aggregate text budget per snapshot. It reports the estimated count and `truncated` state. It does not use jsdom for visibility or layout measurements; S4 uses Playwright Chromium.

## D0.5 — Build artifacts and secrets

`.env*` files except `.env.example`, logs, spike audio, generated artifacts, node modules, Playwright browser downloads, and extension build output are ignored. The Gnani API key is never printed, logged, or committed.

## D0.6 — Deferred Dockerfile

The Dockerfile is deferred to T6.1 as required by `AGENTS.md`.
