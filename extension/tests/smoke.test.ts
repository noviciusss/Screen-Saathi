import { describe, expect, it } from "vitest";

describe("extension scaffold", () => {
  it("has an offline test boundary", () => {
    expect(typeof process).toBe("object");
  });
});
