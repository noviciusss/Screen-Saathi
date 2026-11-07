import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.playwright.test.ts"],
    environment: "node",
  },
});
