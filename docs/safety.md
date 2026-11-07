# Safety verification

Screen Saathi keeps page-derived data separate from executable instructions and
requires confirmation before any field mutation.

| Invariant | Implementation | Automated evidence |
|---|---|---|
| Explain by default; act only after confirmation | The side panel calls `executePageAction` only from the visible yes button or the allowlisted spoken yes path. | `extension/src/forms/guided-form.ts`, `extension/tests/guided-form.test.ts` |
| Never submit/pay/send/confirm/delete/transfer | Backend action gate and page executor reject submit-like controls; no click executor exists. | `backend/tests/test_safety_invariants.py` |
| Never read password/OTP/card values | Snapshot values become `[hidden]`, sensitive elements are excluded from guided flows, and executor rejects them. | `backend/tests/test_reasoner_and_safety.py`, `backend/tests/test_safety_invariants.py`, redaction tests |
| Redact PII before off-device transport | Snapshot and selected-text bridges redact PAN, Aadhaar-like, phone, email, and Luhn-valid card values. | `extension/tests/redaction.test.ts` and snapshot Playwright tests |
| Ignore prompt injection | Provider prompt wraps snapshots in `<page_data>` and labels them untrusted data; only structured response actions reach the gate. | `backend/tests/test_reasoner_and_safety.py` |
| Do not store raw page/audio/transcripts | Usage records contain operation, timings, sizes, credits, and ids only. | `backend/tests/test_safety_invariants.py` |
| Be honest when uncertain | The prompt requires low confidence/uncertainty for empty or truncated snapshots; the structured response carries confidence. | `backend/prompts/system.md`, `reasoner_contract.py` |

Run the automated checks with:

```bash
make test
```

No live Gnani or LLM call is part of the safety suite.
