/**
 * apps/api/test/export-serializers.test.ts
 * Unit tests for the 3.5 flat-list serializers (no DB). CSV escaping + header,
 * XLSX zip magic bytes, PDF %PDF magic, union-key header order.
 */
import { describe, it, expect } from "vitest";
import { listToCsv, listToXlsx, listToPdf, unionKeys } from "../src/lib/export/serializers.js";

const ROWS = [
  { id: "u1", name: "Mario", role: "USER" },
  { id: "u2", name: "Anna, B", role: "MANAGER", extra: 3 },
];

describe("unionKeys", () => {
  it("collects keys across rows in first-seen order", () => {
    expect(unionKeys(ROWS)).toEqual(["id", "name", "role", "extra"]);
  });
});

describe("listToCsv", () => {
  it("renders a header row + one row per item, RFC-4180 escaped", () => {
    const csv = listToCsv(ROWS);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe("id,name,role,extra");
    expect(lines[1]).toBe("u1,Mario,USER,");
    expect(lines[2]).toBe('u2,"Anna, B",MANAGER,3'); // comma quoted, missing key empty
  });
  it("serializes object/array cells as JSON", () => {
    const csv = listToCsv([{ tags: ["a", "b"], meta: { x: 1 } }]);
    expect(csv).toContain('"[""a"",""b""]"');
    expect(csv).toContain('"{""x"":1}"');
  });
});

describe("listToXlsx", () => {
  it("produces a non-empty xlsx (zip 'PK' magic)", async () => {
    const buf = await listToXlsx(ROWS, "users");
    expect(buf.length).toBeGreaterThan(0);
    expect(buf[0]).toBe(0x50); // 'P'
    expect(buf[1]).toBe(0x4b); // 'K'
  });
});

describe("listToPdf", () => {
  it("produces a non-empty pdf ('%PDF' magic)", async () => {
    const buf = await listToPdf(ROWS, "Users");
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });
  it("handles wide rows without throwing (column overflow path)", async () => {
    const wide = [Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`col${i}`, `v${i}`]))];
    const buf = await listToPdf(wide, "Wide");
    expect(buf.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });
});
