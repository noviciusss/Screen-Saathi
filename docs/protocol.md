# Screen Saathi session protocol

The extension connects to `wss://<backend>/v1/session`. The wire contract is
protocol version `1`. JSON frames are text frames; audio input and output are
binary frames.

## Client messages

The first text frame must be exactly a hello message:

```json
{
  "type": "hello",
  "protocol_version": 1,
  "session_token": "per-install-token",
  "language": "hi-IN",
  "mode": "echo"
}
```

`language` is one of `hi-IN`, `en-IN`, or `hi-en`. `mode` is `echo` for the
voice transport smoke path or `assistant` for page understanding. The backend compares `session_token` with the backend-only
`SAATHI_SESSION_TOKEN`; it does not forward the token to Gnani.

In assistant mode, send the latest redacted page context after `ready` and
before `audio_start`:

```json
{"type":"context_update","snapshot":{...PageSnapshot...},"selection":null,"guided_field_id":"e4","guided_field_name":"Resident name"}
```

`guided_field_id` and `guided_field_name` are optional. When present, they tell
the reasoner which safe form field the extension is asking for next. The
extension rejects a proposed action for a different field while guided mode is
active.

After the hello, each turn is bracketed by:

```json
{"type":"audio_start","turn_id":"turn-1"}
```

followed by zero or more binary frames, then:

```json
{"type":"audio_end","turn_id":"turn-1"}
```

Input audio is raw mono PCM16 little-endian at 16 kHz. Every binary input
frame must be exactly **1,024 bytes** (512 samples, approximately 32 ms).
Binary input before `audio_start`, a wrong frame size, or a mismatched
`audio_end.turn_id` produces an `error` JSON message.

Optional `ping` and `session_end` JSON controls are accepted for health checks
and shutdown. They are not required by the extension and are not part of the
normal turn flow.

## Server messages

After successful authentication:

```json
{"type":"ready","session_id":"opaque-session-id"}
```

Prisma partial and final events are normalized to this exact message shape:

```json
{
  "type": "transcript",
  "turn_id": "turn-1",
  "text": "हाँ",
  "final": true,
  "latency_ms": 110
}
```

Both Gnani `transcript` and `final_transcript` events are emitted with
`final: true`; `partial_transcript` events use `final: false`. The backend
always includes the active `turn_id` and a non-negative numeric `latency_ms`.

In `echo` mode, every final transcript is synthesized using the selected
language and a matching Timbre voice:

| Language | Voice |
|---|---|
| `hi-IN` | `Nalini` |
| `en-IN` | `Kaveri` |
| `hi-en` | `Poorvi` |

In `assistant` mode, the backend sends an `assistant` message containing the
validated spoken answer, optional `highlight_id`, optional action, scam verdict,
and confidence, then synthesizes its `speak` value through the same TTS path.
The extension must display an action confirmation card and execute an action
only after an explicit user confirmation. Submit-like controls are never
executed.

Before the first raw TTS chunk, the backend sends:

```json
{
  "type": "tts_start",
  "turn_id": "turn-1",
  "sample_rate": 24000,
  "encoding": "linear_pcm"
}
```

It then sends raw mono PCM16 binary chunks. The chunks are not base64 encoded
and contain no JSON wrapper. After the final chunk:

```json
{"type":"tts_end","turn_id":"turn-1"}
```

Errors use this shape:

```json
{"type":"error","code":"turn_required","message":"Send audio_start before audio frames."}
```

## Authentication, origin, and limits

`Origin` is checked before hello authentication. `SAATHI_ALLOWED_ORIGINS` is a
comma-separated allowlist. With the default empty value, an absent Origin is
accepted for non-browser clients and every non-empty Origin is rejected.

The service also enforces a process-local per-identity connection rate limit,
a daily provider-call cap, and a lifetime credit cap. Credit estimates use the
measured defaults:

- STT: `0.0091` credits per audio second
- TTS: `0.2777` credits per 100 characters

The Phase 1 default STT endpoint is Prisma `/stt/v4/stream` because the live
Phase 0 comparison finalized Hindi and `हाँ` on v4, while the v3 Hindi
sentence did not finalize. Override `GNANI_STT_ENDPOINT` locally if a later
measurement selects another endpoint.

Configure those rates with `GNANI_STT_CREDITS_PER_SECOND` and
`GNANI_TTS_CREDITS_PER_100_CHARS`. Cached TTS sentences consume no provider
call or credit reservation.

## STT finalization and observability

STT is not connected at hello or `audio_start`. The first valid audio frame
starts the transport. At `audio_end`, the backend sends 32 zero PCM frames as
trailing VAD silence at 16 kHz frame cadence, then closes the STT transport so
the final event can be delivered. The transport also reconnects at the
15-minute provider-session boundary.

Timestamp hooks expose stage names such as `session_ready`, `stt_transcript`,
and `session_end`. Usage hooks contain only operation, request id, duration,
first-chunk timing, estimated credits, byte counts, cache status, and a
timestamp. The default JSONL logger never writes page text, transcript text,
 or TTS text.

## Active-tab page snapshot bridge

The Phase 2 page bridge uses the minimum temporary-access permission boundary:
the manifest declares `activeTab` and `scripting`, not persistent `http://*/*`
or `https://*/*` host access. Chrome grants `activeTab` after the user invokes
the extension action; the service worker then uses `chrome.scripting.executeScript`
to run the self-contained snapshot builder in the active tab.

The side panel sends the runtime request:

```json
{"type":"screen-saathi:request-snapshot"}
```

The service worker returns either a redacted `PageSnapshot` or a content-free
failure with one of `no_active_tab`, `restricted_page`, `denylisted`, or
`snapshot_failed`. A selected-text request is handled by the same active-tab
bridge and redacts PII before returning the text to the side panel.
Password, OTP, card values, and detected page PII are redacted before the
snapshot is returned. Chrome-restricted pages such as `chrome://` pages are
reported honestly and are not bypassed.
