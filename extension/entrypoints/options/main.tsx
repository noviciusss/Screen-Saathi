import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { CONSENT_STORAGE_KEY, DEFAULT_DENYLIST, DENYLIST_STORAGE_KEY } from "../../src/privacy/policy";
import { BACKEND_URL_STORAGE_KEY, SESSION_TOKEN_STORAGE_KEY } from "../../src/config";

import "./style.css";

function Options(): ReactElement {
  const [patterns, setPatterns] = useState<string[]>([...DEFAULT_DENYLIST]);
  const [newPattern, setNewPattern] = useState("");
  const [saved, setSaved] = useState(false);
  const [backendUrl, setBackendUrl] = useState("");
  const [sessionToken, setSessionToken] = useState("");

  useEffect(() => {
    void chrome.storage.local.get(DENYLIST_STORAGE_KEY).then((stored) => {
      const value = stored[DENYLIST_STORAGE_KEY];
      if (Array.isArray(value) && value.every((item) => typeof item === "string")) setPatterns(value);
    });
    void chrome.storage.local.get([BACKEND_URL_STORAGE_KEY, SESSION_TOKEN_STORAGE_KEY]).then((stored) => {
      if (typeof stored[BACKEND_URL_STORAGE_KEY] === "string") setBackendUrl(stored[BACKEND_URL_STORAGE_KEY]);
      if (typeof stored[SESSION_TOKEN_STORAGE_KEY] === "string") setSessionToken(stored[SESSION_TOKEN_STORAGE_KEY]);
    });
  }, []);

  async function save(): Promise<void> {
    await chrome.storage.local.set({ [DENYLIST_STORAGE_KEY]: patterns });
    await chrome.storage.local.set({
      [BACKEND_URL_STORAGE_KEY]: backendUrl.trim(),
      [SESSION_TOKEN_STORAGE_KEY]: sessionToken.trim(),
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  function addPattern(): void {
    const trimmed = newPattern.trim().toLowerCase();
    if (trimmed === "" || patterns.includes(trimmed)) return;
    setPatterns([...patterns, trimmed]);
    setNewPattern("");
  }

  async function resetConsent(): Promise<void> {
    await chrome.storage.local.remove(CONSENT_STORAGE_KEY);
  }

  return (
    <main className="options">
      <h1>Screen Saathi settings</h1>
      <p className="lead">इन websites पर Saathi page नहीं पढ़ेगा। आप अपनी list में शब्द जोड़ सकते हैं।</p>
      <section className="card">
        <h2>Backend connection</h2>
        <p>These values stay in this browser profile and are sent only to your configured backend.</p>
        <label>Backend URL<input aria-label="Backend URL" value={backendUrl} onChange={(event) => setBackendUrl(event.target.value)} placeholder="https://your-host.example" /></label>
        <label>Session token<input aria-label="Session token" type="password" value={sessionToken} onChange={(event) => setSessionToken(event.target.value)} placeholder="SAATHI_SESSION_TOKEN" /></label>
        <button className="save" type="button" onClick={() => void save()}>Save connection</button>
        {saved ? <p role="status">Saved.</p> : null}
      </section>
      <section className="card">
        <h2>Sensitive page denylist</h2>
        <div className="add-row">
          <input aria-label="Add blocked word" value={newPattern} onChange={(event) => setNewPattern(event.target.value)} placeholder="example: wallet" />
          <button type="button" onClick={addPattern}>Add</button>
        </div>
        <ul>{patterns.map((pattern) => <li key={pattern}><span>{pattern}</span><button type="button" onClick={() => setPatterns(patterns.filter((item) => item !== pattern))}>Remove</button></li>)}</ul>
        <button className="save" type="button" onClick={() => void save()}>Save list</button>
        {saved ? <p role="status">Saved.</p> : null}
      </section>
      <section className="card">
        <h2>Consent</h2>
        <p>Reset this to show the first-use privacy explanation again.</p>
        <button type="button" onClick={() => void resetConsent()}>Show consent next time</button>
      </section>
    </main>
  );
}

createRoot(document.querySelector("#root") as HTMLElement).render(<Options />);
