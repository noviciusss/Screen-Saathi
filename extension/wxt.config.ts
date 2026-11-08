import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "Screen Saathi",
    version: "0.1.0",
    description: "A safe voice helper for understanding web pages.",
    permissions: ["activeTab", "scripting", "sidePanel", "storage"],
    host_permissions: ["http://127.0.0.1/*", "http://localhost/*", "https://*/*", "http://*/*", "file:///*"],
    action: {
      default_title: "Open Screen Saathi",
    },
    side_panel: {
      default_path: "sidepanel.html",
    },
    options_ui: {
      page: "options.html",
      open_in_tab: true,
    },
  },
});
