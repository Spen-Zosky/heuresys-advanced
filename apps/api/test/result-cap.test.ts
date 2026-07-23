/**
 * apps/api/test/result-cap.test.ts — #62 G3 unit guard.
 * The analytics reads fetch cap+1 rows and pass through guardResultCap: at or
 * under the cap the rows flow through untouched; over the cap the read fails
 * LOUD (RESULT_SET_TRUNCATION) instead of silently dropping rows.
 */
import { describe, it, expect } from "vitest";
import { ANALYTICS_ROW_CAP, guardResultCap } from "../src/lib/result-cap.js";

describe("#62 G3 — guardResultCap", () => {
  it("passes rows through at exactly the cap", () => {
    const rows = Array.from({ length: ANALYTICS_ROW_CAP }, (_, i) => i);
    expect(guardResultCap(rows, "test set")).toBe(rows);
  });

  it("throws RESULT_SET_TRUNCATION one row over the cap", () => {
    const rows = Array.from({ length: ANALYTICS_ROW_CAP + 1 }, (_, i) => i);
    expect(() => guardResultCap(rows, "test set")).toThrowError(/RESULT_SET_TRUNCATION/);
  });

  it("honours a custom cap", () => {
    expect(() => guardResultCap([1, 2, 3], "small set", 2)).toThrowError(/RESULT_SET_TRUNCATION/);
    expect(guardResultCap([1, 2], "small set", 2)).toEqual([1, 2]);
  });
});
