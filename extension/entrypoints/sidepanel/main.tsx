import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { ReactElement } from "react";
import "./style.css";

function SidePanel(): ReactElement {
  return (
    <main className="panel">
      <p className="eyebrow">Screen Saathi</p>
      <h1>नमस्ते</h1>
      <p className="message">मैं एक AI सहायक हूँ। मैं पेज समझाने में मदद करूँगा।</p>
      <button className="talk-button" type="button">
        बोलने के लिए दबाएँ
      </button>
      <p className="status" role="status">
        Phase 0 scaffold
      </p>
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
