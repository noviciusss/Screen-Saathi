import { describe, expect, it } from "vitest";
import { DEFAULT_DENYLIST, isDenylisted } from "../src/privacy/policy";

describe("privacy page policy", () => {
  it("refuses configured sensitive page patterns", () => {
    expect(isDenylisted("https://synthetic-bank.example/account", DEFAULT_DENYLIST)).toBe(true);
    expect(isDenylisted("https://news.example/article", DEFAULT_DENYLIST)).toBe(false);
  });

  it("treats malformed URLs as unsafe", () => {
    expect(isDenylisted("not a url", DEFAULT_DENYLIST)).toBe(true);
  });
});
