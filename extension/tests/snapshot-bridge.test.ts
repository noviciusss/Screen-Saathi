import { describe, expect, it } from "vitest";
import {
  isSnapshotRequest,
  SNAPSHOT_REQUEST,
  SNAPSHOT_RESPONSE,
} from "../src/page/snapshot-bridge";

describe("active-tab snapshot bridge", () => {
  it("accepts only the fixed snapshot request message", () => {
    expect(isSnapshotRequest({ type: SNAPSHOT_REQUEST })).toBe(true);
    expect(isSnapshotRequest({ type: "other" })).toBe(false);
    expect(isSnapshotRequest(null)).toBe(false);
  });

  it("keeps the response discriminator stable", () => {
    expect(SNAPSHOT_RESPONSE).toBe("screen-saathi:snapshot-response");
  });
});
