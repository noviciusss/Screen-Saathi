import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildSnapshot } from "../src/snapshot/build-snapshot";
import type { PageSnapshot } from "../src/snapshot/types";

const fixtureDirectory = new URL("../../fixtures/pages/", import.meta.url);

describe("S4 Chromium snapshot spike", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    if (browser !== undefined) await browser.close();
  });

  for (const fixture of ["form.html", "news.html", "table.html", "iframe.html", "hindi.html"]) {
    it(`keeps ${fixture} within the snapshot budget`, async () => {
      const page = await browser.newPage({ viewport: { width: 1024, height: 720 } });
      await page.goto(new URL(fixture, fixtureDirectory).href);
      await page.waitForLoadState("domcontentloaded");
      const snapshot = await page.evaluate(buildSnapshot);
      await page.close();

      expect(snapshot.elements.length).toBeLessThanOrEqual(250);
      expect(snapshot.estimated_tokens).toBeLessThanOrEqual(5000);
      expect(snapshot.flags.truncated).toBe(false);
      expect(snapshot.title.length).toBeGreaterThan(0);
      expect(snapshot.elements.every((element) => element.rect[2] >= 0 && element.rect[3] >= 0)).toBe(true);
      console.info(
        `S4 ${fixture}: elements=${snapshot.elements.length} estimated_tokens=${snapshot.estimated_tokens}`,
      );
    });
  }

  it("reports government-form accessible-name correctness as correct/total", async () => {
    const page = await browser.newPage({ viewport: { width: 1024, height: 720 } });
    await page.goto(new URL("government-form.html", fixtureDirectory).href);
    const expectedNames = await page.locator("form input, form select, form textarea").evaluateAll((fields) =>
      fields.map((field) => {
        const id = field.getAttribute("id") ?? "";
        return document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(id)}"]`)?.textContent?.trim() ?? "";
      }),
    );
    const snapshot: PageSnapshot = await page.evaluate(buildSnapshot);
    await page.close();

    const snapshotNames = new Set(snapshot.elements.map((element) => element.name));
    const correct = expectedNames.filter((name) => snapshotNames.has(name)).length;
    console.info(`S4 government-form accessible names: ${correct}/${expectedNames.length}`);
    expect(correct).toBe(expectedNames.length);
    expect(snapshot.elements.some((element) => element.name === "Applicant full name")).toBe(true);
    expect(snapshot.elements.some((element) => element.name === "Applicant declaration")).toBe(true);
  });

  it("truncates the ad-heavy page at the element budget", async () => {
    const page = await browser.newPage({ viewport: { width: 1024, height: 720 } });
    await page.goto(new URL("ad-heavy.html", fixtureDirectory).href);
    const totalInteractive = await page.locator("a, button, input, select, textarea, iframe, [role], [tabindex]").count();
    const snapshot: PageSnapshot = await page.evaluate(buildSnapshot);
    await page.close();

    console.info(`S4 ad-heavy truncation: kept=${snapshot.elements.length} total_interactive=${totalInteractive}`);
    expect(totalInteractive).toBeGreaterThan(500);
    expect(snapshot.elements.length).toBe(250);
    expect(snapshot.flags.truncated).toBe(true);
  });

  it("captures actual visibility, layout, accessible names, and same-origin frame content", async () => {
    const page = await browser.newPage({ viewport: { width: 1024, height: 720 } });
    await page.goto(new URL("iframe.html", fixtureDirectory).href);
    const childFrame = page.locator("iframe").contentFrame();
    await childFrame.locator("button").waitFor();
    const snapshot: PageSnapshot = await page.evaluate(buildSnapshot);
    await page.close();

    expect(snapshot.elements.some((element) => element.name === "More information")).toBe(true);
    expect(snapshot.elements.some((element) => element.name === "Show details")).toBe(true);
    expect(snapshot.elements.every((element) => element.rect[2] > 0 && element.rect[3] > 0)).toBe(true);
  });

  it("prioritizes in-viewport interactive elements", async () => {
    const page = await browser.newPage({ viewport: { width: 1024, height: 720 } });
    await page.goto(new URL("form.html", fixtureDirectory).href);
    await page.evaluate(() => {
      const spacer = document.createElement("div");
      spacer.style.height = "2000px";
      document.body.prepend(spacer);
    });
    const snapshot: PageSnapshot = await page.evaluate(buildSnapshot);
    await page.close();

    expect(snapshot.elements[0]?.in_view).toBe(false);
  });

  it("redacts page PII and sensitive field values before snapshot export", async () => {
    const page = await browser.newPage({ viewport: { width: 1024, height: 720 } });
    await page.setContent(`
      <h1>Account contact test.user@example.com</h1>
      <p>PAN ABCDE1234F and phone +91 9876543210.</p>
      <label for="password">Password</label><input id="password" type="password" value="secret-value">
      <label for="card">Card</label><input id="card" autocomplete="cc-number" value="4111 1111 1111 1111">
      <label for="name">Name</label><input id="name" value="Sample user">
    `);
    const snapshot: PageSnapshot = await page.evaluate(buildSnapshot);
    await page.close();

    const serialized = JSON.stringify(snapshot);
    expect(serialized).toContain("[EMAIL_1]");
    expect(serialized).toContain("[PAN_1]");
    expect(serialized).toContain("[PHONE_1]");
    expect(serialized).toContain('"value":"[hidden]"');
    expect(serialized).not.toContain("secret-value");
    expect(serialized).not.toContain("4111 1111 1111 1111");
    expect(serialized).toContain("Sample user");
  });
});
