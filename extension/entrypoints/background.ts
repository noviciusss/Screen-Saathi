import { defineBackground } from "wxt/utils/define-background";

export default defineBackground(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: unknown) => {
      console.warn("Screen Saathi side-panel setup failed", error);
    });
});
