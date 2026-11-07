# Submission notes

## Product

Screen Saathi is a Chrome MV3 side-panel voice assistant. It explains the page
in Hindi, Hinglish, or English, highlights referenced controls, checks synthetic
messages for scam signals, and fills only safe fields after explicit
confirmation. It never submits forms.

## Models and APIs

- Gnani Prisma: speech-to-text.
- Gnani Timbre: text-to-speech.
- Reasoner: the configured OpenAI-compatible provider from `LLM_PROVIDER`,
  `LLM_MODEL`, `LLM_BASE_URL`, and backend-only `LLM_API_KEY`.
- Browser APIs: MV3 side panel, active-tab scripting, storage, microphone.

The exact provider model and endpoint must be filled from the local S5 result;
no credential belongs in this document.

## Safety and limitations

See `docs/safety.md`. The current implementation supports synthetic forms and
content. It does not support payments, banking actions, submit clicks, password,
OTP, or card values. Real Chrome microphone/TTS, deployment, and provider
latency still require a host-machine check.

## Evidence checklist

- [x] `make test` green locally.
- [x] Synthetic scam corpus and offline runner in `eval/`.
- [x] Safety report in `docs/safety.md`.
- [ ] S5 provider validity and latency result.
- [ ] Public WSS deployment.
- [ ] Clean Chrome-profile install.
- [ ] 60-second demo recording and public post.
- [ ] Final Gnani dashboard reconciliation.
