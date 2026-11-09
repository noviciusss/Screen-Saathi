"""FastAPI application for the fixed Screen Saathi voice-session contract."""

from __future__ import annotations

import asyncio
import contextlib
import hmac
import logging
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, ValidationError

from .action_gate import gate_response
from .context import PageContext, PageSnapshot
from .health import health_payload
from .hooks import (
    JsonlUsageLogger,
    TimestampHook,
    UsageEvent,
    UsageHook,
    invoke_timestamp_hook,
    invoke_usage_hook,
    utc_timestamp,
)
from .limits import LimitExceeded, UsageLimits
from .protocol import (
    AssistantMessage,
    AudioEndMessage,
    AudioStartMessage,
    ContextUpdateMessage,
    ErrorMessage,
    HelloMessage,
    PingMessage,
    ReadyMessage,
    SessionEndMessage,
    TranscriptMessage,
    TtsEndMessage,
    TtsRequest,
    TtsStartMessage,
    model_json,
    parse_client_message,
)
from .reasoner import (
    OpenAICompatibleReasoner,
    Reasoner,
    ReasonerError,
    ReasonRequest,
    UnavailableReasoner,
)
from .settings import Settings
from .stt import (
    FRAME_BYTES,
    GnaniSttTransport,
    SttProviderError,
    SttProxy,
    SttTransportFactory,
)
from .tts import GnaniTtsTransport, SentenceQueue, TtsProxy, TtsTransportFactory

LOGGER = logging.getLogger("uvicorn.error")

VOICE_BY_LANGUAGE = {
    "hi-IN": "Nalini",
    "en-IN": "Kaveri",
    "hi-en": "Poorvi",
}
STT_LANGUAGE_BY_SESSION_LANGUAGE = {
    "hi-IN": "hi-IN",
    "en-IN": "en-IN",
    # Prisma accepts en-IN for mixed Hindi-English speech; hi-en is Timbre-only.
    "hi-en": "en-IN",
}
STT_FINAL_WAIT_SECONDS = 2.0
STT_TASK_WAIT_SECONDS = 15.0
DISCLOSED_CLIENTS: set[str] = set()


def _client_identity(websocket: WebSocket) -> str:
    client = websocket.client
    return client.host if client is not None else "unknown"


def create_app(
    settings: Settings | None = None,
    *,
    stt_transport_factory: SttTransportFactory | None = None,
    tts_transport_factory: TtsTransportFactory | None = None,
    usage_hook: UsageHook | None = None,
    timestamp_hook: TimestampHook | None = None,
    limits: UsageLimits | None = None,
    reasoner: Reasoner | None = None,
) -> FastAPI:
    runtime = settings or Settings.from_env()
    service = FastAPI(title="Screen Saathi backend", version="0.1.0")
    service.state.settings = runtime
    service.state.limits = limits or UsageLimits(
        runtime.rate_limit_per_minute,
        runtime.daily_call_cap,
        runtime.total_credit_cap,
    )
    service.state.usage_hook = usage_hook or JsonlUsageLogger(runtime.usage_log_path)
    service.state.timestamp_hook = timestamp_hook
    service.state.disclosed_clients = set()
    if reasoner is not None:
        service.state.reasoner = reasoner
    elif all(
        (runtime.llm_provider, runtime.llm_model, runtime.llm_api_key, runtime.llm_base_url)
    ):
        service.state.reasoner = OpenAICompatibleReasoner(
            provider=runtime.llm_provider,
            model=runtime.llm_model,
            api_key=runtime.llm_api_key,
            base_url=runtime.llm_base_url,
            supports_vision=runtime.reasoner_supports_vision,
        )
    else:
        service.state.reasoner = UnavailableReasoner()
    service.state.stt_factory = stt_transport_factory or (
        lambda language: GnaniSttTransport(
            runtime.gnani_api_key, language, endpoint=runtime.stt_endpoint
        )
    )
    service.state.tts_factory = tts_transport_factory or (
        lambda: GnaniTtsTransport(runtime.gnani_api_key, endpoint=runtime.tts_endpoint)
    )

    @service.get("/health")
    async def health() -> dict[str, str]:
        return health_payload()

    @service.websocket("/v1/session")
    async def session(websocket: WebSocket) -> None:
        await _session(websocket, service)

    fixtures_dir = Path(__file__).resolve().parents[3] / "fixtures" / "pages"
    if fixtures_dir.is_dir():
        from starlette.staticfiles import StaticFiles

        service.mount("/fixtures", StaticFiles(directory=fixtures_dir, html=True), name="fixtures")

    return service


async def _send_error(websocket: WebSocket, code: str, message: str, close_code: int) -> None:
    LOGGER.warning("screen_saathi session_rejected code=%s close_code=%s", code, close_code)
    await websocket.send_text(model_json(ErrorMessage(code=code, message=message)))
    await websocket.close(code=close_code)


async def _session(websocket: WebSocket, service: FastAPI) -> None:
    settings: Settings = service.state.settings
    limits: UsageLimits = service.state.limits
    connection_id = uuid.uuid4().hex[:12]
    origin = websocket.headers.get("origin") or "<absent>"
    await websocket.accept()
    LOGGER.warning(
        "screen_saathi session_socket_accepted connection_id=%s origin=%s client=%s",
        connection_id,
        origin,
        _client_identity(websocket),
    )
    if not settings.origin_allowed(websocket.headers.get("origin")):
        await _send_error(
            websocket, "origin_rejected", "This browser origin is not allowed.", 4403
        )
        return

    try:
        hello = parse_client_message(await websocket.receive_text())
    except (WebSocketDisconnect, RuntimeError, ValidationError, ValueError):
        await _send_error(
            websocket, "invalid_hello", "The first message must be a valid hello.", 4400
        )
        return
    if not isinstance(hello, HelloMessage):
        await _send_error(
            websocket, "hello_required", "Send hello before using the voice session.", 4400
        )
        return
    LOGGER.warning("screen_saathi session_hello_received connection_id=%s", connection_id)
    if not settings.session_token or not hmac.compare_digest(
        hello.session_token, settings.session_token
    ):
        await _send_error(websocket, "unauthorized", "The session token is not valid.", 4401)
        return
    LOGGER.warning("screen_saathi session_token_accepted connection_id=%s", connection_id)

    try:
        limits.allow_connection(_client_identity(websocket))
    except LimitExceeded as error:
        await _send_error(websocket, error.code, error.message, 4429)
        return

    session_id = uuid.uuid4().hex
    await websocket.send_text(model_json(ReadyMessage(session_id=session_id)))
    LOGGER.warning("screen_saathi session_ready_sent connection_id=%s", connection_id)
    await invoke_timestamp_hook(service.state.timestamp_hook, "session_ready")

    tts = TtsProxy(
        service.state.tts_factory,
        usage_hook=service.state.usage_hook,
        timestamp_hook=service.state.timestamp_hook,
        credit_per_100_chars=settings.tts_credits_per_100_chars,
    )
    sentence_queue = SentenceQueue(tts)
    send_lock = asyncio.Lock()
    active_turn_id: str | None = None
    stt: SttProxy | None = None
    stt_task: asyncio.Task[None] | None = None
    stt_started = False
    stt_started_at: float | None = None
    stt_audio_bytes = 0
    final_transcript_event: asyncio.Event | None = None
    latest_context: PageContext | None = None
    client_key = f"{_client_identity(websocket)}:{hello.session_token}"
    client_already_disclosed = (
        client_key in DISCLOSED_CLIENTS
        or (
            hasattr(service.state, "disclosed_clients")
            and client_key in service.state.disclosed_clients
        )
    )
    ai_disclosed = client_already_disclosed
    stt_error_sent = False
    client_disconnected = False
    ended = False

    async def send_model(model: BaseModel) -> bool:
        nonlocal client_disconnected
        if client_disconnected:
            return False
        async with send_lock:
            try:
                await websocket.send_text(model_json(model))
            except (OSError, WebSocketDisconnect, RuntimeError) as error:
                client_disconnected = True
                LOGGER.warning(
                    "screen_saathi client_send_failed connection_id=%s error_type=%s",
                    connection_id,
                    type(error).__name__,
                )
                return False
        return True

    async def send_binary(chunk: bytes) -> bool:
        nonlocal client_disconnected
        if client_disconnected:
            return False
        async with send_lock:
            try:
                await websocket.send_bytes(chunk)
            except (OSError, WebSocketDisconnect, RuntimeError) as error:
                client_disconnected = True
                LOGGER.warning(
                    "screen_saathi client_send_failed connection_id=%s error_type=%s",
                    connection_id,
                    type(error).__name__,
                )
                return False
        return True

    async def record_stt_usage() -> None:
        if not stt_started:
            return
        await invoke_usage_hook(
            service.state.usage_hook,
            UsageEvent(
                operation="stt",
                request_id=None,
                duration_ms=(time.perf_counter() - stt_started_at) * 1_000
                if stt_started_at is not None
                else 0.0,
                estimated_credits=(stt_audio_bytes / 2 / 16_000)
                * settings.stt_credits_per_second,
                bytes_sent=stt_audio_bytes,
                bytes_received=0,
                cache_hit=False,
                timestamp=utc_timestamp(),
            ),
        )

    async def echo_transcript(transcript: TranscriptMessage) -> None:
        nonlocal active_turn_id
        voice = VOICE_BY_LANGUAGE[hello.language]
        request = TtsRequest(
            request_id=transcript.turn_id,
            text=transcript.text,
            voice=voice,
            language=hello.language,
        )
        sentence_requests = sentence_queue.requests(request)
        uncached_requests = [
            sentence for sentence in sentence_requests if not tts.cache.contains(sentence)
        ]
        credits = sum(
            len(sentence.text) * settings.tts_credits_per_100_chars / 100
            for sentence in uncached_requests
        )
        try:
            limits.reserve("tts", credits, call_count=len(uncached_requests))
        except LimitExceeded as error:
            await send_model(ErrorMessage(code=error.code, message=error.message))
            return

        if not await send_model(
            TtsStartMessage(
                turn_id=transcript.turn_id,
                sample_rate=request.audio_config.sample_rate,
                encoding="linear_pcm",
            )
        ):
            return
        LOGGER.warning("screen_saathi tts_start connection_id=%s", connection_id)
        async for _sentence_index, _chunk_index, chunk in sentence_queue.stream(request):
            if chunk:
                if not await send_binary(chunk):
                    return
        await send_model(TtsEndMessage(turn_id=transcript.turn_id))
        LOGGER.warning("screen_saathi tts_end connection_id=%s", connection_id)
        active_turn_id = None

    async def assistant_transcript(transcript: TranscriptMessage) -> None:
        nonlocal ai_disclosed
        try:
            response = await service.state.reasoner.respond(
                ReasonRequest(transcript.text, hello.language, latest_context)
            )
            snapshot: PageSnapshot | None = latest_context.snapshot if latest_context else None
            response = gate_response(response, snapshot)
            if not ai_disclosed:
                disclosure = (
                    "मैं स्क्रीन साथी हूँ, आपकी एआई सहायक। "
                    if hello.language != "en-IN"
                    else "I am Screen Saathi, your AI assistant. "
                )
                response = response.model_copy(update={"speak": disclosure + response.speak})
                ai_disclosed = True
                DISCLOSED_CLIENTS.add(client_key)
                if hasattr(service.state, "disclosed_clients"):
                    service.state.disclosed_clients.add(client_key)
        except ReasonerError as error:
            await send_model(ErrorMessage(code="reasoner_unavailable", message=str(error)))
            return
        except Exception:
            LOGGER.exception("screen_saathi reasoner_failed connection_id=%s", connection_id)
            await send_model(
                ErrorMessage(code="reasoner_unavailable", message="The page helper is unavailable.")
            )
            return

        await send_model(
            AssistantMessage(
                turn_id=transcript.turn_id,
                speak=response.speak,
                highlight_id=response.highlight_id,
                action=response.action,
                scam_verdict=response.scam_verdict,
                confidence=response.confidence,
                followup=response.followup,
            )
        )
        await echo_transcript(
            TranscriptMessage(
                turn_id=transcript.turn_id,
                text=response.speak,
                final=True,
                latency_ms=transcript.latency_ms,
            )
        )

    async def forward_transcripts(turn_id: str, turn_stt: SttProxy) -> None:
        nonlocal stt_error_sent
        try:
            async for transcript in turn_stt.events(turn_id):
                await invoke_timestamp_hook(service.state.timestamp_hook, "stt_transcript")
                LOGGER.warning(
                    "screen_saathi stt_transcript connection_id=%s final=%s text_chars=%s",
                    connection_id,
                    transcript.final,
                    len(transcript.text),
                )
                if not await send_model(transcript):
                    return
                if transcript.final:
                    if final_transcript_event is not None:
                        final_transcript_event.set()
                    if hello.mode == "echo":
                        await echo_transcript(transcript)
                    else:
                        await assistant_transcript(transcript)
        except (asyncio.CancelledError, WebSocketDisconnect):
            raise
        except Exception as error:
            if final_transcript_event is not None and final_transcript_event.is_set():
                LOGGER.info(
                    "screen_saathi stt_closed_after_final connection_id=%s error_type=%s",
                    connection_id,
                    type(error).__name__,
                )
                return
            stt_error_sent = True
            LOGGER.warning(
                "screen_saathi stt_failed connection_id=%s error_type=%s",
                connection_id,
                type(error).__name__,
            )
            await send_model(
                ErrorMessage(code="stt_unavailable", message="Speech recognition is unavailable.")
            )

    async def end_active_turn() -> None:
        nonlocal active_turn_id, stt, stt_task, stt_started, stt_started_at, stt_audio_bytes
        nonlocal final_transcript_event, stt_error_sent
        final_received = False
        if stt is None:
            await send_model(ErrorMessage(code="no_audio", message="No speech was recorded."))
        elif not stt_started:
            await send_model(
                ErrorMessage(
                    code="no_audio",
                    message="I did not receive audio. Please hold the button while speaking.",
                )
            )
        else:
            silence_bytes = FRAME_BYTES * 32
            try:
                limits.reserve(
                    "stt",
                    (silence_bytes / 2 / 16_000) * settings.stt_credits_per_second,
                    call_count=0,
                )
            except LimitExceeded as error:
                await send_model(ErrorMessage(code=error.code, message=error.message))
            else:
                stt_audio_bytes += silence_bytes
                try:
                    await stt.finish()
                    if final_transcript_event is not None:
                        try:
                            await asyncio.wait_for(
                                final_transcript_event.wait(), STT_FINAL_WAIT_SECONDS
                            )
                            final_received = True
                        except TimeoutError:
                            if not stt_error_sent:
                                LOGGER.warning(
                                    "screen_saathi stt_timeout connection_id=%s",
                                    connection_id,
                                )
                                await send_model(
                                    ErrorMessage(
                                        code="stt_timeout",
                                        message=(
                                            "I could not understand that. Please try again slowly."
                                        ),
                                    )
                                )
                except Exception as error:
                    LOGGER.warning(
                        "screen_saathi stt_finish_failed connection_id=%s error_type=%s",
                        connection_id,
                        type(error).__name__,
                    )
                    if not stt_error_sent and not final_received:
                        await send_model(
                            ErrorMessage(
                                code="stt_unavailable",
                                message="Speech recognition is unavailable.",
                            )
                        )

        if stt is not None:
            with contextlib.suppress(Exception):
                await stt.close()
        if stt_task is not None:
            if final_received:
                try:
                    await asyncio.wait_for(stt_task, STT_TASK_WAIT_SECONDS)
                except TimeoutError:
                    LOGGER.warning(
                        "screen_saathi stt_task_timeout connection_id=%s",
                        connection_id,
                    )
                    stt_task.cancel()
                    with contextlib.suppress(asyncio.CancelledError):
                        await stt_task
            else:
                stt_task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await stt_task
        await record_stt_usage()
        active_turn_id = None
        stt = None
        stt_task = None
        stt_started = False
        stt_started_at = None
        stt_audio_bytes = 0
        final_transcript_event = None
        stt_error_sent = False

    async def abort_active_turn(code: str, message: str) -> None:
        nonlocal active_turn_id, stt, stt_task, stt_started, stt_started_at, stt_audio_bytes
        nonlocal final_transcript_event, stt_error_sent
        await send_model(ErrorMessage(code=code, message=message))
        if stt_task is not None:
            stt_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await stt_task
        if stt is not None:
            with contextlib.suppress(Exception):
                await stt.close()
        await record_stt_usage()
        active_turn_id = None
        stt = None
        stt_task = None
        stt_started = False
        stt_started_at = None
        stt_audio_bytes = 0
        final_transcript_event = None
        stt_error_sent = False

    try:
        while not ended:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                LOGGER.warning(
                    "screen_saathi session_disconnected connection_id=%s code=%s",
                    connection_id,
                    message.get("code", "unknown"),
                )
                break
            binary = message.get("bytes")
            if binary is not None:
                if len(binary) != FRAME_BYTES:
                    await send_model(
                        ErrorMessage(
                            code="audio_frame_size",
                            message="Audio frames must be 1,024 bytes.",
                        )
                    )
                    continue
                if active_turn_id is None or stt is None:
                    await send_model(
                        ErrorMessage(
                            code="turn_required",
                            message="Send audio_start before audio frames.",
                        )
                    )
                    continue
                if not stt_started:
                    frame_credits = (
                        len(binary) / 2 / 16_000
                    ) * settings.stt_credits_per_second
                    try:
                        limits.reserve("stt", frame_credits)
                    except LimitExceeded as error:
                        await send_model(ErrorMessage(code=error.code, message=error.message))
                        continue
                    stt_started = True
                    stt_audio_bytes = len(binary)
                    stt_started_at = time.perf_counter()
                    LOGGER.warning(
                        "screen_saathi audio_frames_started connection_id=%s",
                        connection_id,
                    )
                    try:
                        await stt.start()
                        stt_task = asyncio.create_task(
                            forward_transcripts(active_turn_id, stt)
                        )
                    except SttProviderError as error:
                        LOGGER.warning(
                            "screen_saathi stt_provider_failed connection_id=%s code=%s",
                            connection_id,
                            error.code,
                        )
                        await abort_active_turn(error.code, error.user_message)
                        continue
                else:
                    new_bytes = stt_audio_bytes + len(binary)
                    delta_seconds = (new_bytes - stt_audio_bytes) / 2 / 16_000
                    try:
                        limits.reserve(
                            "stt",
                            delta_seconds * settings.stt_credits_per_second,
                            call_count=0,
                        )
                    except LimitExceeded as error:
                        await send_model(ErrorMessage(code=error.code, message=error.message))
                        continue
                    stt_audio_bytes = new_bytes
                try:
                    await stt.send_frame(binary)
                except SttProviderError as error:
                    LOGGER.warning(
                        "screen_saathi stt_provider_failed connection_id=%s code=%s",
                        connection_id,
                        error.code,
                    )
                    await abort_active_turn(error.code, error.user_message)
                continue

            text = message.get("text")
            if not isinstance(text, str):
                continue
            try:
                client_message = parse_client_message(text)
            except ValidationError:
                await send_model(
                    ErrorMessage(code="invalid_message", message="The message is not valid.")
                )
                continue
            if isinstance(client_message, AudioStartMessage):
                if active_turn_id is not None:
                    if stt is None:
                        LOGGER.warning("screen_saathi interrupting_turn connection_id=%s", connection_id)
                        if stt_task is not None:
                            stt_task.cancel()
                        active_turn_id = None
                    else:
                        await send_model(
                            ErrorMessage(code="turn_active", message="Finish the active turn first.")
                        )
                        continue
                active_turn_id = client_message.turn_id
                stt_language = STT_LANGUAGE_BY_SESSION_LANGUAGE[hello.language]
                LOGGER.warning(
                    "screen_saathi audio_start connection_id=%s language=%s stt_language=%s",
                    connection_id,
                    hello.language,
                    stt_language,
                )
                stt = SttProxy(
                    stt_language,
                    service.state.stt_factory,
                    max_seconds=settings.session_max_seconds,
                )
                final_transcript_event = asyncio.Event()
                stt_error_sent = False
            elif isinstance(client_message, AudioEndMessage):
                if active_turn_id != client_message.turn_id:
                    await send_model(
                        ErrorMessage(code="turn_id_mismatch", message="The turn id does not match.")
                    )
                    continue
                LOGGER.warning(
                    "screen_saathi audio_end connection_id=%s audio_bytes=%s",
                    connection_id,
                    stt_audio_bytes,
                )
                await end_active_turn()
                if client_disconnected:
                    break
            elif isinstance(client_message, ContextUpdateMessage):
                latest_context = PageContext(
                    snapshot=client_message.snapshot,
                    selection=client_message.selection,
                    guided_field_id=client_message.guided_field_id,
                    guided_field_name=client_message.guided_field_name,
                )
            elif isinstance(client_message, PingMessage):
                continue
            elif isinstance(client_message, SessionEndMessage):
                ended = True
    except WebSocketDisconnect as error:
        LOGGER.warning(
            "screen_saathi session_disconnected connection_id=%s code=%s",
            connection_id,
            error.code,
        )
    except Exception:
        LOGGER.exception("screen_saathi session_crashed connection_id=%s", connection_id)
    finally:
        if stt_task is not None:
            stt_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await stt_task
        if stt is not None:
            await stt.close()
        if stt_started:
            await record_stt_usage()
        await tts.close()
        await invoke_timestamp_hook(service.state.timestamp_hook, "session_end")
        LOGGER.warning("screen_saathi session_finished connection_id=%s", connection_id)


app = create_app()


__all__ = ["app", "create_app"]
