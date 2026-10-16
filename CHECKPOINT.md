# CHECKPOINT.md — Screen Saathi

Live status file and handoff record. The agent updates it after **every task** and writes a sendoff section after **every phase**. A task that is not verified is not marked done. Keep entries short and factual: commands, results, numbers.

## 1. Current status (rewrite this block each time)

- Date/time (IST):
- Phase:
- Task:
- Status: not started | in progress | blocked | awaiting phase-gate approval | done
- Last verified command and result:
- Next approved step:
- Days to deadline (close: 10 Nov 2026, 11:59 PM IST):
- Credits remaining (from dashboard):

## 2. Credit ledger (5,000 total)

Update after every batch of live Gnani calls. Read the dashboard balance before and after the batch.

| Date | Phase/Task | What was called (STT sec / TTS chars) | Balance before | Balance after | Used | Notes |
|---|---|---|---|---|---|---|

Measured unit costs (fill after S1/S2):
- STT: ___ credits per second of audio
- TTS: ___ credits per 100 characters
- Concurrency / rate limits observed: ___

Phase caps: spikes 250, build 1,500, eval 1,000, demo 750, public use 500, reserve 1,000.

## 3. Social log (selection is by engagement on nominated posts)

| # | Platform | Date | Topic (announce / voice loop / form-fill / final 60 s demo) | Link | Notes on reach |
|---|---|---|---|---|---|

Final post due by 4 Nov. Hashtags: `#GnaniAI #GreatIndianAIInternshipChallenge`. No purchased or fake engagement.

## 4. Task log (newest first)

### <Task id> — <title> — <status>
- Files changed:
- Acceptance criteria checked (with evidence):
- Commands run and results:
- Credits used:
- Decisions made (also in `docs/DECISIONS.md`):
- Known issues / follow-ups:

## 5. Phase sendoffs (newest first)

### Phase <n> sendoff — <date>
- Gate result: pass | pass with exceptions | fail
- What now works (one paragraph, plain language):
- Evidence (test counts, measured numbers, recordings or screenshots):
- Verification run: `ruff check`, `pytest`, `tsc --noEmit`, `vitest`, extension build, `make test` — results:
- Known limitations carried forward:
- Credits used this phase vs cap:
- Social: post due or done:
- Cut-order status (anything dropped or at risk):
- **How to resume:** exact commands to start backend and extension, env var names required (never values), where the key lives:
- **Pending human actions:**
- **Exact next command / next task:**

## 6. Risks and blockers

| Item | Owner (human/agent) | Needed to resolve | Status |
|---|---|---|---|

## 7. Environment (names only, never values)

`GNANI_API_KEY`, `LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`, `LLM_BASE_URL`, `REASONER_SUPPORTS_VISION`, `SAATHI_SESSION_TOKEN`, `GNANI_DAILY_CALL_CAP`, `GNANI_TOTAL_CREDIT_CAP`, `DEBUG_LOG_CONTENT`. Copy `.env.example`, fill locally, never commit.
