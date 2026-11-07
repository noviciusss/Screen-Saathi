# Latency report

This report separates automated offline checks from real provider measurements.
The repository currently has no configured `LLM_*`/`GROQ_*` environment values,
so no live reasoner latency is claimed here.

## Reproduce

```bash
time make test
uv run --project backend python backend/spikes/s5_reasoner.py
```

The S5 command records provider validity and latency only after credentials are
configured locally. Gnani usage remains outside automated tests; reconcile the
dashboard and add the live batch numbers to `docs/CHECKPOINT.md`.

## Required release measurements

| Stage | p50 | p95 | Evidence |
|---|---:|---:|---|
| microphone release → final STT | pending Chrome check | pending | host Chrome run |
| final STT → reasoner response | pending provider check | pending | S5/Chrome run |
| response → first TTS audio | pending Chrome check | pending | host Chrome run |
| end-to-end release → first audio | pending Chrome check | pending | host Chrome run |
