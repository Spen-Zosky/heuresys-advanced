/**
 * apps/api/test/unit/locale.unit.test.ts — D-64 unit layer.
 * normalizeLocale (ADR-0029): closed set {'it','en'}, fallback SEMPRE 'it'
 * (la lingua canonica in-row) — mai vuoto, mai locale non supportato.
 */

import { describe, it, expect } from "vitest";
import { normalizeLocale, DEFAULT_LOCALE } from "../../src/middleware/locale.js";

describe("normalizeLocale (unit)", () => {
  it("locale supportati passano (case-insensitive)", () => {
    expect(normalizeLocale("it")).toBe("it");
    expect(normalizeLocale("en")).toBe("en");
    expect(normalizeLocale("EN")).toBe("en");
    expect(normalizeLocale(" It ")).toBe("it");
  });

  it("region tag tollerati (en-US → en, it-IT → it)", () => {
    expect(normalizeLocale("en-US")).toBe("en");
    expect(normalizeLocale("it-IT")).toBe("it");
    expect(normalizeLocale("en-GB")).toBe("en");
  });

  it("tutto il resto → default 'it' (canonico in-row, mai vuoto)", () => {
    expect(DEFAULT_LOCALE).toBe("it");
    expect(normalizeLocale(undefined)).toBe("it");
    expect(normalizeLocale(null)).toBe("it");
    expect(normalizeLocale("")).toBe("it");
    expect(normalizeLocale("fr")).toBe("it");
    expect(normalizeLocale("de-DE")).toBe("it");
    expect(normalizeLocale("xx-YY-zz")).toBe("it");
  });
});
