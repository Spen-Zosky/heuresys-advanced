/**
 * apps/api/test/csv-formula-injection.test.ts
 * F-004: csvCell must neutralize spreadsheet formula / DDE triggers so an exported cell
 * beginning with `= + - @` (or a leading TAB/CR) can never execute as a live formula in
 * Excel/Sheets/LibreOffice. Plain numbers (including negatives) pass through unchanged.
 * Pure unit — no DB, no app.
 */

import { describe, it, expect } from "vitest";
import { csvCell } from "../src/modules/analytics/csv.js";

describe("csvCell — formula-injection neutralization (F-004)", () => {
  it("prefixes formula-trigger cells with a single quote", () => {
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("=cmd|'/c calc'!A1")).toBe("'=cmd|'/c calc'!A1"); // neutralized; no comma/dquote/newline → not wrapped
    expect(csvCell("\t=danger")).toBe("'\t=danger");
  });

  it("neutralizes a leading '-' only when the cell is NOT a plain number", () => {
    expect(csvCell("-1+cmd")).toBe("'-1+cmd"); // formula, not a number → neutralized
    expect(csvCell("-5")).toBe("-5"); // plain negative number → untouched
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell("-3.14")).toBe("-3.14");
  });

  it("leaves ordinary values and numbers intact", () => {
    expect(csvCell("hello")).toBe("hello");
    expect(csvCell(42)).toBe("42");
    expect(csvCell(0)).toBe("0");
    expect(csvCell("")).toBe("");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("still applies RFC-4180 quoting (comma/quote/newline) around neutralized cells", () => {
    expect(csvCell("a,b")).toBe(`"a,b"`);
    expect(csvCell('=1,2')).toBe(`"'=1,2"`); // neutralized AND comma-quoted
    expect(csvCell('say "hi"')).toBe(`"say ""hi"""`);
  });
});
