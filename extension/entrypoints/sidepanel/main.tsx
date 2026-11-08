import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { ReactElement } from "react";
import { startMicCapture } from "../../src/audio/capture";
import type { MicCapture } from "../../src/audio/capture";
import { PcmPlaybackQueue } from "../../src/audio/playback";
import { ConfigurationError, getClientConfigAsync } from "../../src/config";
import { requestActiveTabSnapshot, requestSelectedText } from "../../src/page/snapshot-bridge";
import { executePageAction, highlightPageElement } from "../../src/page/page-actions";
import { languageFontClass, LANGUAGE_OPTIONS } from "../../src/protocol/languages";
import type { Action, SupportedLanguage } from "../../src/protocol/types";
import type { PageSnapshot } from "../../src/snapshot/types";
import { CONSENT_STORAGE_KEY } from "../../src/privacy/policy";
import {
  actionMatchesGuidedField,
  currentGuidedField,
  firstGuidedForm,
  markGuidedFieldComplete,
  updateSnapshotAfterAction,
} from "../../src/forms/guided-form";
import type { GuidedFormState } from "../../src/forms/guided-form";
import { VoiceSessionClient } from "../../src/session/session-client";
import type { SessionState } from "../../src/session/session-client";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/noto-sans-devanagari/devanagari-400.css";
import "@fontsource/noto-sans-devanagari/devanagari-500.css";
import "@fontsource/noto-sans-devanagari/devanagari-600.css";
import "@fontsource/noto-sans-devanagari/devanagari-700.css";
import "./style.css";

function newTurnId(): string {
  return crypto.randomUUID();
}

interface UiCopy {
  readonly brand: string;
  readonly greeting: string;
  readonly disclosure: string;
  readonly languageKicker: string;
  readonly languageHeading: string;
  readonly talkIdle: string;
  readonly talkActive: string;
  readonly talkHint: string;
  readonly transcriptTitle: string;
  readonly emptyTranscript: string;
  readonly statusReady: string;
  readonly statusConnecting: string;
  readonly statusMic: string;
  readonly statusRecording: string;
  readonly statusEnding: string;
  readonly statusClosed: string;
  readonly responseTitle: string;
  readonly responseEmpty: string;
  readonly responseFinished: string;
  readonly pageAction: string;
  readonly pagePreparing: string;
  readonly pageReady: string;
  readonly pageUnavailable: string;
  readonly confirmTitle: string;
  readonly confirmYes: string;
  readonly confirmNo: string;
  readonly scamTitle: string;
  readonly guidedStart: string;
  readonly guidedNext: string;
  readonly guidedDone: string;
  readonly guidedMismatch: string;
}

function uiCopy(language: SupportedLanguage): UiCopy {
  if (language === "en-IN") {
    return {
      brand: "Screen Saathi",
      greeting: "A calmer way to use the web",
      disclosure: "I’m an AI voice assistant. Ask me in English and I’ll help you understand the page.",
      languageKicker: "LANGUAGE",
      languageHeading: "Choose your voice language",
      talkIdle: "Hold to speak",
      talkActive: "Listening… release when done",
      talkHint: "Press and hold, speak naturally, then release.",
      transcriptTitle: "You said",
      emptyTranscript: "Your words will appear here.",
      statusReady: "Ready when you are",
      statusConnecting: "Connecting…",
      statusMic: "Preparing microphone…",
      statusRecording: "Listening…",
      statusEnding: "Understanding…",
      statusClosed: "Connection closed. Press again to retry.",
      responseTitle: "Saathi’s reply",
      responseEmpty: "Your spoken reply will appear here.",
      responseFinished: "Reply complete. Hold the button for another question.",
      pageAction: "Prepare this page",
      pagePreparing: "Reading the page safely…",
      pageReady: "Page context is ready",
      pageUnavailable: "This page cannot be read. Try a normal website tab.",
      confirmTitle: "Confirm before I change the page",
      confirmYes: "Yes, fill it",
      confirmNo: "No",
      scamTitle: "Safety check",
      guidedStart: "Guide me through this form",
      guidedNext: "Tell me the value for",
      guidedDone: "All safe fields are filled. Please press Submit yourself.",
      guidedMismatch: "I will only fill the next field in order.",
    };
  }
  return {
    brand: "स्क्रीन साथी",
    greeting: "वेब इस्तेमाल करने का आसान तरीका",
    disclosure: "मैं एक AI voice assistant हूँ। बोलकर सवाल पूछें, मैं पेज समझने में आपकी मदद करूँगा।",
    languageKicker: "भाषा / LANGUAGE",
    languageHeading: "अपनी आवाज़ की भाषा चुनें",
    talkIdle: "बोलने के लिए दबाएँ",
    talkActive: "सुन रहा हूँ… बोलकर छोड़ें",
    talkHint: "दबाकर रखें, आराम से बोलें, फिर छोड़ दें।",
    transcriptTitle: "आपने कहा",
    emptyTranscript: "आपकी बात यहाँ दिखाई देगी।",
    statusReady: "आपके लिए तैयार हूँ",
    statusConnecting: "जुड़ रहा हूँ…",
    statusMic: "माइक्रोफ़ोन तैयार कर रहा हूँ…",
    statusRecording: "सुन रहा हूँ…",
    statusEnding: "समझ रहा हूँ…",
    statusClosed: "कनेक्शन बंद है। फिर दबाकर कोशिश करें।",
    responseTitle: "साथी का जवाब",
    responseEmpty: "आपका spoken reply यहाँ दिखाई देगा।",
    responseFinished: "जवाब पूरा हुआ। फिर सवाल पूछने के लिए दबाएँ।",
    pageAction: "इस पेज को तैयार करें",
    pagePreparing: "पेज को सुरक्षित तरीके से पढ़ रहा हूँ…",
    pageReady: "पेज की जानकारी तैयार है",
    pageUnavailable: "यह Chrome पेज पढ़ा नहीं जा सकता। किसी सामान्य website पर कोशिश करें।",
    confirmTitle: "पेज बदलने से पहले आपकी अनुमति चाहिए",
    confirmYes: "हाँ, भरें",
    confirmNo: "नहीं",
    scamTitle: "सुरक्षा जाँच",
    guidedStart: "इस form को भरने में मेरी मदद लें",
    guidedNext: "इस field की जानकारी बोलें",
    guidedDone: "सुरक्षित fields भर गए हैं। Submit आप खुद दबाएँ।",
    guidedMismatch: "मैं केवल अगला field क्रम से भरूँगा।",
  };
}

function friendlyError(code: string, fallback: string, language: SupportedLanguage): string {
  if (language === "en-IN") {
    const messages: Record<string, string> = {
      no_audio: "No voice was received. Hold the button while speaking.",
      stt_timeout: "I couldn’t understand that. Please try again slowly.",
      stt_unavailable: "Speech recognition is temporarily unavailable.",
      stt_provider_rejected: "The language or voice settings were rejected. Choose the right language and try again.",
      origin_rejected: "The extension cannot reach the backend. Check the extension ID.",
      unauthorized: "The session settings are not valid. Check the backend and extension configuration.",
      daily_cap: "Today’s voice limit has been reached. Please try again later.",
      credit_cap: "The voice service limit has been reached. Please try again later.",
      denylisted: "I will not read this sensitive page.",
    };
    return messages[code] ?? fallback;
  }
  const messages: Record<string, string> = {
    no_audio: "आवाज़ नहीं मिली। बोलते समय बटन दबाकर रखें।",
    stt_timeout: "मैं आपकी बात समझ नहीं पाया। धीरे बोलकर फिर कोशिश करें।",
    stt_unavailable: "आवाज़ समझने की सेवा अभी उपलब्ध नहीं है।",
    stt_provider_rejected: "भाषा या voice settings स्वीकार नहीं हुईं। सही भाषा चुनकर फिर कोशिश करें।",
    origin_rejected: "यह extension backend से जुड़ नहीं पा रहा है। Extension ID जाँचें।",
    unauthorized: "Session की जानकारी सही नहीं है। Backend और extension की settings जाँचें।",
    daily_cap: "आज की voice limit पूरी हो गई है। बाद में फिर कोशिश करें।",
    credit_cap: "Voice service की limit पूरी हो गई है। बाद में फिर कोशिश करें।",
    denylisted: "मैं इस संवेदनशील पेज को नहीं पढ़ूँगा।",
  };
  return messages[code] ?? fallback;
}

function microphoneError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "माइक्रोफ़ोन की अनुमति नहीं मिली। Chrome में इस extension के लिए Microphone को Allow करें।";
    }
    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return "माइक्रोफ़ोन नहीं मिला। कोई microphone जोड़कर फिर कोशिश करें।";
    }
    if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      return "माइक्रोफ़ोन किसी दूसरी app में चल रहा है। उसे बंद करके फिर कोशिश करें।";
    }
  }
  if (error instanceof Error) {
    return `माइक्रोफ़ोन तैयार नहीं हुआ: ${error.message}`;
  }
  return "माइक्रोफ़ोन तैयार नहीं हुआ। Chrome में microphone permission जाँचें।";
}

function SidePanel(): ReactElement {
  const captureRef = useRef<MicCapture | null>(null);
  const playbackRef = useRef(new PcmPlaybackQueue());
  const sessionRef = useRef<VoiceSessionClient | null>(null);
  const turnIdRef = useRef<string | null>(null);
  const releaseRequestedRef = useRef(false);
  const startingRef = useRef(false);
  const [language, setLanguage] = useState<SupportedLanguage>("hi-IN");
  const [status, setStatus] = useState("तैयार है");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [pageStatus, setPageStatus] = useState("");
  const [pageSnapshot, setPageSnapshot] = useState<PageSnapshot | null>(null);
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [scamVerdict, setScamVerdict] = useState<{ level: string; reasons: string[] } | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const [consentAccepted, setConsentAccepted] = useState<boolean | null>(null);
  const silencedTurnRef = useRef(false);
  const [guidedFlow, setGuidedFlow] = useState<GuidedFormState | null>(null);
  const pendingActionRef = useRef<Action | null>(null);

  useEffect(() => {
    void chrome.storage.local.get(CONSENT_STORAGE_KEY).then((stored) => {
      setConsentAccepted(stored[CONSENT_STORAGE_KEY] === true);
    });
  }, []);
  const copy = uiCopy(language);

  useEffect(() => {
    return () => {
      void captureRef.current?.stop();
      captureRef.current = null;
      playbackRef.current.stop();
      sessionRef.current?.close();
      sessionRef.current = null;
    };
  }, []);

  function onSessionState(state: SessionState): void {
    if (state === "connecting") setStatus(copy.statusConnecting);
    if (state === "ready") setStatus(copy.statusReady);
    if (state === "recording") setStatus(copy.statusRecording);
    if (state === "ending") setStatus(copy.statusEnding);
    if (state === "closed") setStatus(copy.statusClosed);
  }

  async function createSession(): Promise<VoiceSessionClient> {
    const config = await getClientConfigAsync();
    const session = new VoiceSessionClient(
      {
        ...config,
        language,
        mode: "assistant",
      },
      {
        onStateChange: onSessionState,
        onMessage: (message) => {
          if (message.type === "transcript") {
            setTranscript(message.text);
            let handledConfirmation = false;
            if (message.final && pendingActionRef.current !== null) {
              const normalized = message.text.trim().toLowerCase();
              const isAffirmative = /(?:^|\s|[।!?])(हाँ|हां|haan|ha|han|yes|y|yep|sure|भर दो|कर दो|भर दीजिए|कर दीजिए|भरिए|theek|ok|okay)(?:$|\s|[।!?])/i.test(normalized);
              const isNegative = /(?:^|\s|[।!?])(नहीं|नही|nahi|nahin|no|n|nope|cancel|रोक दो|मत करो)(?:$|\s|[।!?])/i.test(normalized);
              if (isAffirmative) {
                handledConfirmation = true;
                void confirmAction();
              } else if (isNegative) {
                handledConfirmation = true;
                pendingActionRef.current = null;
                setPendingAction(null);
                setStatus(language === "en-IN" ? "Okay, I did not change the page." : "ठीक है, मैंने पेज में कोई बदलाव नहीं किया।");
              }
            }
            if (message.final && !handledConfirmation) {
              setStatus(language === "en-IN" ? `You said: ${message.text}` : `आपने कहा: ${message.text}`);
            }
          } else if (message.type === "assistant") {
            setReply(message.speak);
            setScamVerdict(message.scam_verdict);
            pendingActionRef.current = message.action;
            setPendingAction(message.action);
            if (message.highlight_id !== null) void highlightPageElement(message.highlight_id);
          } else if (message.type === "tts_start") {
            if (silencedTurnRef.current) return;
            playbackRef.current.startStream(message.sample_rate);
            setStatus(language === "en-IN" ? "Listening to Saathi’s reply…" : "जवाब सुनिए…");
          } else if (message.type === "tts_end") {
            if (!silencedTurnRef.current) {
              setStatus(copy.responseFinished);
            }
          } else if (message.type === "error") {
            setStatus(friendlyError(message.code, `Service issue: ${message.message}`, language));
          }
        },
        onAudioChunk: (chunk) => {
          if (silencedTurnRef.current) return;
          try {
            playbackRef.current.enqueue(chunk);
            setReply(language === "en-IN" ? "Playing your reply…" : "आपका जवाब चल रहा है…");
          } catch (error) {
            setStatus(error instanceof Error ? error.message : "आवाज़ चल नहीं सकी।");
          }
        },
        onError: (error) => {
          const separator = error.message.indexOf(":");
          const code = separator > 0 ? error.message.slice(0, separator) : "";
          const fallback = error.message.includes("after ready")
            ? language === "en-IN"
              ? "The connection dropped. Press again to retry."
              : "कनेक्शन टूट गया। फिर दबाकर कोशिश करें।"
            : language === "en-IN"
              ? `Connection issue: ${error.message}`
              : `कनेक्शन में दिक्कत: ${error.message}`;
          setStatus(friendlyError(code, fallback, language));
        },
      },
    );
    sessionRef.current = session;
    return session;
  }

  async function getSession(): Promise<VoiceSessionClient> {
    const existing = sessionRef.current;
    if (existing !== null && (existing.state === "ready" || existing.state === "recording")) {
      return existing;
    }
    existing?.close();
    const session = await createSession();
    await session.connect();
    return session;
  }

  async function beginCapture(): Promise<void> {
    if (startingRef.current || captureRef.current !== null) return;
    startingRef.current = true;
    releaseRequestedRef.current = false;
    silencedTurnRef.current = false;
    playbackRef.current.clear();
    setIsCapturing(true);
    setStatus(copy.statusMic);

    let session: VoiceSessionClient | null = null;
    let capture: MicCapture | null = null;
    const turnId = newTurnId();
    try {
      capture = await startMicCapture((frame) => {
        if (releaseRequestedRef.current || session === null || session.state !== "recording") return;
        try {
          session.sendAudioFrame(frame);
        } catch (error) {
          setStatus(error instanceof Error ? error.message : "आवाज़ भेजी नहीं जा सकी।");
        }
      });
      captureRef.current = capture;
      if (releaseRequestedRef.current) {
        await capture.stop();
        captureRef.current = null;
        return;
      }

      setStatus(copy.statusConnecting);
      session = await getSession();
      if (releaseRequestedRef.current) {
        await capture.stop();
        captureRef.current = null;
        return;
      }
      try {
        const fresh = await requestActiveTabSnapshot();
        setPageSnapshot(fresh);
        const guidedField = currentGuidedField(fresh, guidedFlow);
        session.setContext(fresh, selectedText || null, guidedField);
      } catch {
        if (pageSnapshot !== null) {
          const guidedField = currentGuidedField(pageSnapshot, guidedFlow);
          session.setContext(pageSnapshot, selectedText || null, guidedField);
        }
      }
      turnIdRef.current = turnId;
      session.startTurn(turnId);
      if (releaseRequestedRef.current) {
        await capture.stop();
        captureRef.current = null;
        if (session.state === "recording") session.endTurn(turnId);
        turnIdRef.current = null;
        return;
      }
      setStatus(copy.statusRecording);
    } catch (error) {
      const activeSession = session ?? sessionRef.current;
      const activeTurnId = turnIdRef.current;
      captureRef.current = null;
      if (capture !== null) await capture.stop().catch(() => undefined);
      if (activeSession !== null && activeTurnId !== null && activeSession.state === "recording") {
        activeSession.endTurn(activeTurnId);
      }
      turnIdRef.current = null;
      const message = error instanceof ConfigurationError
        ? error.message
        : error instanceof DOMException
          ? microphoneError(error)
        : error instanceof Error
          ? error.message
          : "माइक्रोफ़ोन या कनेक्शन तैयार नहीं हो सका।";
      console.warn("Screen Saathi microphone/session setup failed", error);
      setStatus(message);
      setIsCapturing(false);
    } finally {
      startingRef.current = false;
      if (releaseRequestedRef.current && captureRef.current === null) setIsCapturing(false);
    }
  }

  async function endCapture(): Promise<void> {
    if (releaseRequestedRef.current) return;
    releaseRequestedRef.current = true;
    const capture = captureRef.current;
    captureRef.current = null;
    setIsCapturing(false);
    if (capture === null) return;
    setStatus(language === "en-IN" ? "Finishing…" : "रुक रहा हूँ…");
    await capture.stop();
    const session = sessionRef.current;
    const turnId = turnIdRef.current;
    if (session !== null && turnId !== null && session.state === "recording") {
      session.endTurn(turnId);
    }
    turnIdRef.current = null;
  }

  function selectLanguage(nextLanguage: SupportedLanguage): void {
    if (nextLanguage === language) return;
    playbackRef.current.clear();
    sessionRef.current?.close();
    sessionRef.current = null;
    setLanguage(nextLanguage);
    const label = LANGUAGE_OPTIONS.find((option) => option.code === nextLanguage)?.label ?? nextLanguage;
    setStatus(nextLanguage === "en-IN" ? `${label} selected. ${uiCopy(nextLanguage).talkIdle}.` : `${label} चुनी गई। ${uiCopy(nextLanguage).talkIdle}।`);
  }

  async function preparePage(): Promise<void> {
    setPageStatus(copy.pagePreparing);
    try {
      const snapshot = await requestActiveTabSnapshot();
      setPageSnapshot(snapshot);
      const selection = await requestSelectedText();
      setSelectedText(selection);
      setPageStatus(
        `${copy.pageReady}: ${snapshot.title || (language === "en-IN" ? "Untitled page" : "बिना नाम का पेज")} · ${snapshot.elements.length} ${language === "en-IN" ? "items" : "elements"}`,
      );
    } catch (error) {
      setPageStatus(error instanceof Error && error.message.includes("sensitive")
        ? friendlyError("denylisted", error.message, language)
        : copy.pageUnavailable);
    }
  }

  async function confirmAction(): Promise<void> {
    silencedTurnRef.current = true;
    playbackRef.current.clear();
    const action = pendingActionRef.current;
    if (action === null) return;
    const result = await executePageAction(action);
    pendingActionRef.current = null;
    setPendingAction(null);
    if (!result.ok) {
      setStatus(result.message ?? (language === "en-IN" ? "I could not change that field." : "मैं उस field को नहीं बदल पाया।"));
      return;
    }
    try {
      const fresh = await requestActiveTabSnapshot();
      setPageSnapshot(fresh);
      if (guidedFlow !== null) {
        const nextFlow = markGuidedFieldComplete(guidedFlow, action);
        setGuidedFlow(nextFlow);
        const nextField = currentGuidedField(fresh, nextFlow);
        setStatus(nextField === null ? copy.guidedDone : `${copy.guidedNext}: ${nextField.name}`);
      } else {
        setStatus(language === "en-IN" ? "Done. I did not press submit." : "हो गया। मैंने जानकारी भर दी। Submit आप खुद दबाएँ।");
      }
    } catch {
      if (guidedFlow !== null && pageSnapshot !== null) {
        const nextSnapshot = updateSnapshotAfterAction(pageSnapshot, action);
        const nextFlow = markGuidedFieldComplete(guidedFlow, action);
        setPageSnapshot(nextSnapshot);
        setGuidedFlow(nextFlow);
        setStatus(currentGuidedField(nextSnapshot, nextFlow) === null ? copy.guidedDone : copy.guidedNext);
      } else {
        setStatus(language === "en-IN" ? "Done. I did not press submit." : "हो गया। मैंने जानकारी भर दी। Submit आप खुद दबाएँ।");
      }
    }
  }

  const actionTargetName = pendingAction === null
    ? ""
    : pageSnapshot?.elements.find((element) => element.id === pendingAction.target_id || element.name === pendingAction.target_id)?.name ?? pendingAction.target_id;

  async function acceptConsent(): Promise<void> {
    await chrome.storage.local.set({ [CONSENT_STORAGE_KEY]: true });
    setConsentAccepted(true);
  }

  function startGuidedForm(): void {
    if (pageSnapshot === null) return;
    const flow = firstGuidedForm(pageSnapshot);
    if (flow === null) {
      setStatus(language === "en-IN" ? "I could not find a safe form field." : "मुझे कोई सुरक्षित form field नहीं मिला।");
      return;
    }
    setGuidedFlow(flow);
    const field = currentGuidedField(pageSnapshot, flow);
    setStatus(field === null ? copy.guidedDone : `${copy.guidedNext}: ${field.name}`);
  }

  const guidedField = pageSnapshot === null ? null : currentGuidedField(pageSnapshot, guidedFlow);
  const hasGuidedForm = pageSnapshot !== null && firstGuidedForm(pageSnapshot) !== null;

  return (
    <main className={`panel panel--${languageFontClass(language)}`}>
      <header className="brand-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">{language === "en-IN" ? "S" : "स"}</span>
          <div>
            <p className="eyebrow">SCREEN SAATHI</p>
            <h1>{copy.brand}</h1>
          </div>
        </div>
        <span className="ai-badge">AI</span>
      </header>

      {consentAccepted === false ? (
        <section className="consent-card" role="dialog" aria-labelledby="consent-heading">
          <p className="section-kicker">AI / गोपनीयता</p>
          <h2 id="consent-heading">Before we begin</h2>
          <p className="message">Saathi reads the visible page only after you ask. Redacted page context may go to your configured helper. Passwords, OTPs, card fields, and sensitive pages are not read.</p>
          <button className="page-action" type="button" onClick={() => void acceptConsent()}>समझ गया / I understand</button>
        </section>
      ) : null}

      <section className="welcome-card">
        <p className="welcome-kicker">{copy.greeting}</p>
        <p className="message">{copy.disclosure}</p>
        <button className="page-action" type="button" disabled={consentAccepted !== true} onClick={() => void preparePage()}>
          {copy.pageAction}
        </button>
        {pageStatus !== "" ? <p className="page-status" role="status">{pageStatus}</p> : null}
        {hasGuidedForm && guidedFlow === null ? (
          <button className="page-action page-action--guided" type="button" onClick={startGuidedForm}>
            {copy.guidedStart}
          </button>
        ) : null}
        {guidedFlow !== null && guidedField !== null ? (
          <p className="guided-status" role="status">
            {copy.guidedNext}: <strong>{guidedField.name}</strong>
          </p>
        ) : null}
        {guidedFlow !== null && guidedField === null ? (
          <p className="guided-status" role="status">{copy.guidedDone}</p>
        ) : null}
      </section>

      {pendingAction !== null ? (
        <section className="confirmation-card" role="alert">
          <p className="section-kicker">{copy.confirmTitle}</p>
          <p className="message">
            {language === "en-IN"
              ? `Should I ${pendingAction.type === "fill" ? "fill" : "change"} “${actionTargetName}”?`
              : `क्या मैं “${actionTargetName}” में जानकारी भर दूँ?`}
          </p>
          <div className="confirmation-actions">
            <button className="confirm-button confirm-button--yes" type="button" onClick={() => void confirmAction()}>{copy.confirmYes}</button>
            <button className="confirm-button confirm-button--no" type="button" onClick={() => { silencedTurnRef.current = true; playbackRef.current.clear(); pendingActionRef.current = null; setPendingAction(null); }}>{copy.confirmNo}</button>
          </div>
        </section>
      ) : null}

      {scamVerdict !== null ? (
        <section className="scam-card" role="status">
          <p className="section-kicker">{copy.scamTitle}: {scamVerdict.level}</p>
          <ul>{scamVerdict.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
        </section>
      ) : null}

      <section className="language-section" aria-labelledby="language-heading">
        <div className="section-heading">
          <div>
            <p className="section-kicker">{copy.languageKicker}</p>
            <h2 id="language-heading">{copy.languageHeading}</h2>
          </div>
          <span className="selected-language">
            {LANGUAGE_OPTIONS.find((option) => option.code === language)?.label ?? language}
          </span>
        </div>
        <div className="language-list">
          {LANGUAGE_OPTIONS.map((option) => (
            <button
              className="language-button"
              key={option.code}
              type="button"
              aria-pressed={language === option.code}
              disabled={isCapturing}
              onClick={() => selectLanguage(option.code)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className={`talk-card${isCapturing ? " talk-card--active" : ""}`}>
        <div className="talk-card__status">
          <span className={`status-dot${isCapturing ? " status-dot--active" : ""}`} aria-hidden="true" />
          <span role="status">{status}</span>
        </div>
        <button
          className="talk-button"
          type="button"
          disabled={consentAccepted !== true}
          aria-pressed={isCapturing}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            void beginCapture();
          }}
          onPointerUp={() => void endCapture()}
          onPointerCancel={() => void endCapture()}
          onLostPointerCapture={() => void endCapture()}
        >
          <span className="talk-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M12 15.5a3.5 3.5 0 0 0 3.5-3.5V7a3.5 3.5 0 0 0-7 0v5a3.5 3.5 0 0 0 3.5 3.5Z" />
              <path d="M5 11.5a7 7 0 0 0 14 0M12 18.5V22M8.5 22h7" />
            </svg>
          </span>
          <span>{isCapturing ? copy.talkActive : copy.talkIdle}</span>
        </button>
        <p className="talk-hint">{copy.talkHint}</p>
      </section>

      <section className="conversation-grid" aria-live="polite">
        <article className="conversation-card conversation-card--heard">
          <div className="card-label">
            <span className="card-label__number">01</span>
            <h2>{copy.transcriptTitle}</h2>
          </div>
          <p>{transcript || copy.emptyTranscript}</p>
        </article>
        <article className="conversation-card conversation-card--reply">
          <div className="card-label">
            <span className="card-label__number">02</span>
            <h2>{copy.responseTitle}</h2>
          </div>
          <p>{reply || copy.responseEmpty}</p>
        </article>
      </section>
    </main>
  );
}

const root = document.querySelector<HTMLDivElement>("#root");

if (root === null) {
  throw new Error("Screen Saathi side-panel root was not found");
}

createRoot(root).render(
  <StrictMode>
    <SidePanel />
  </StrictMode>,
);
