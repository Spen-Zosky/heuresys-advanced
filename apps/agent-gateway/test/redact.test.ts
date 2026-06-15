/**
 * Unit tests for redact.ts (#9 WI-B, M-2 audit-redaction).
 * SDK-free + no IO. Asserts PII/secret values are masked, sensitive KEY names are masked
 * regardless of value shape, structure is preserved, cycles do not throw, and non-PII
 * scalars pass through unchanged.
 */
import { describe, it, expect } from "vitest";
import { redact, REDACTED } from "../src/redact.js";

describe("redact — value-shape PII masking", () => {
  it("masks an email value", () => {
    expect(redact("mario.rossi@rtl-bank.org")).toBe(REDACTED);
  });
  it("masks an Italian codice fiscale value", () => {
    expect(redact("RSSMRA80A01H501U")).toBe(REDACTED);
  });
  it("masks an IBAN value", () => {
    expect(redact("IT60X0542811101000000123456")).toBe(REDACTED);
  });
  it("masks a JWT-looking token value", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    expect(redact(jwt)).toBe(REDACTED);
  });
  it("masks a long opaque bearer token value", () => {
    expect(redact("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBe(REDACTED);
  });
  it("passes a non-PII string through unchanged", () => {
    expect(redact("organization-units")).toBe("organization-units");
    expect(redact("RTL_BANK")).toBe("RTL_BANK");
  });
  it("passes numbers and booleans through unchanged", () => {
    expect(redact(42)).toBe(42);
    expect(redact(true)).toBe(true);
  });
});

describe("redact — key-name masking (regardless of value shape)", () => {
  it("masks a sensitive key even when its value is innocuous", () => {
    const out = redact({ password: "abc", api_key: "short", name: "Org A" }) as Record<string, unknown>;
    expect(out["password"]).toBe(REDACTED);
    expect(out["api_key"]).toBe(REDACTED);
    expect(out["name"]).toBe("Org A"); // non-sensitive key, non-PII value → through
  });
  it("masks PII-ish key names (email, first_name, iban, codice_fiscale, address)", () => {
    const out = redact({
      email: "x", // even though value alone wouldn't trip the email regex
      first_name: "Mario",
      iban: "n/a",
      codice_fiscale: "n/a",
      address: "Via Roma 1",
      tenant: "RTL_BANK",
    }) as Record<string, unknown>;
    expect(out["email"]).toBe(REDACTED);
    expect(out["first_name"]).toBe(REDACTED);
    expect(out["iban"]).toBe(REDACTED);
    expect(out["codice_fiscale"]).toBe(REDACTED);
    expect(out["address"]).toBe(REDACTED);
    expect(out["tenant"]).toBe("RTL_BANK"); // not sensitive
  });
});

describe("redact — nested structures", () => {
  it("recurses into nested objects and arrays", () => {
    const out = redact({
      level1: {
        users: [
          { name: "A", email: "a@b.co" },
          { name: "B", secret: "s" },
        ],
      },
    }) as Record<string, Record<string, Array<Record<string, unknown>>>>;
    const users = out["level1"]!["users"]!;
    expect(users[0]!["name"]).toBe("A");
    expect(users[0]!["email"]).toBe(REDACTED);
    expect(users[1]!["secret"]).toBe(REDACTED);
  });
  it("masks a PII value found inside an array of strings", () => {
    const out = redact(["ok", "mario@x.io", 1]) as unknown[];
    expect(out[0]).toBe("ok");
    expect(out[1]).toBe(REDACTED);
    expect(out[2]).toBe(1);
  });
});

describe("redact — cycle safety", () => {
  it("does not throw on a self-referential object", () => {
    const a: Record<string, unknown> = { name: "x" };
    a["self"] = a;
    expect(() => redact(a)).not.toThrow();
    const out = redact(a) as Record<string, unknown>;
    expect(out["self"]).toBe("«cycle»");
  });
  it("does not throw on a cyclic array", () => {
    const arr: unknown[] = [1];
    arr.push(arr);
    expect(() => redact(arr)).not.toThrow();
  });
});

describe("redact — non-serializable", () => {
  it("replaces functions with a stable marker", () => {
    const out = redact({ fn: () => 1, ok: "y" }) as Record<string, unknown>;
    expect(out["fn"]).toBe("«unserializable»");
    expect(out["ok"]).toBe("y");
  });
  it("passes null and undefined through", () => {
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
  });
});
