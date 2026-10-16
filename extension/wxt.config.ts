import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "Screen Saathi",
    version: "0.1.0",
    description: "A safe voice helper for understanding web pages.",
    permissions: ["sidePanel", "storage"],
    action: {
      default_title: "Open Screen Saathi",
    },
    side_panel: {
      default_path: "sidepanel.html",
    },
  },
});
