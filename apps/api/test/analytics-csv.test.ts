/**
 * apps/api/test/analytics-csv.test.ts
 * Unit tests for the generic JSON→CSV flattener (no DB). Covers RFC-4180 escaping,
 * dot-notation summary flattening, per-array sections and empty/scalar arrays.
 */
import { describe, it, expect } from "vitest";
import { toCsv, csvCell } from "../src/modules/analytics/csv.js";

describe("csvCell (RFC-4180 escaping)", () => {
  it("leaves plain values unquoted", () => {
    expect(csvCell("DIR-AML")).toBe("DIR-AML");
    expect(csvCell(162)).toBe("162");
    expect(csvCell(true)).toBe("true");
  });
  it("renders null/undefined as empty string", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });
  it("quotes and doubles embedded quotes / commas / newlines", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('he said "hi"')).toBe('"he said ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });
});

describe("toCsv (multi-section flattener)", () => {
  it("flattens scalars + nested objects into the summary section (dot-notation)", () => {
    const csv = toCsv({
      scope: { kind: "PLATFORM", tenantId: null },
      totalHeadcount: 162,
      generatedAt: "2026-06-16T10:00:00.000Z",
    });
    expect(csv).toContain("# summary");
    expect(csv).toContain("key,value");
    expect(csv).toContain("scope.kind,PLATFORM");
    expect(csv).toContain("scope.tenantId,"); // null → empty
    expect(csv).toContain("totalHeadcount,162");
  });

  it("emits one section per array-of-objects with the key union as header", () => {
    const csv = toCsv({
      total: 2,
      byOrgUnit: [
        { dimension: "DIR-AML", headcount: 12 },
        { dimension: "DIR-CORP", headcount: 8 },
      ],
    });
    expect(csv).toContain("# byOrgUnit");
    expect(csv).toContain("dimension,headcount");
    expect(csv).toContain("DIR-AML,12");
    expect(csv).toContain("DIR-CORP,8");
  });

  it("renders empty arrays as an (empty) marker section", () => {
    const csv = toCsv({ total: 0, rows: [] });
    expect(csv).toContain("# rows");
    expect(csv).toContain("(empty)");
  });

  it("renders arrays of scalars under a single 'value' column", () => {
    const csv = toCsv({ levels: ["JUNIOR", "MID", "SENIOR"] });
    expect(csv).toContain("# levels");
    expect(csv).toContain("value");
    expect(csv).toContain("JUNIOR");
    expect(csv).toContain("SENIOR");
  });

  it("escapes commas inside cell values within a section", () => {
    const csv = toCsv({ rows: [{ label: "Back Office, Payments", n: 5 }] });
    expect(csv).toContain('"Back Office, Payments",5');
  });
});
