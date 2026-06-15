/**
 * PII / secret redaction for the Agent SDK write-gate audit path (#9 WI-B, M-2).
 *
 * Before a write-tool's args are logged or audited, any PII / special-category /
 * secret-ish value is masked (GDPR Art. 9 + the plugin's compliance-guard doctrine:
 * "no raw PII in the audit record"). SDK-free + pure → unit-testable.
 *
 * Strategy = key-name heuristic (deny-list of sensitive key fragments) + value-shape
 * heuristic (emails, Italian tax codes / IBANs, bearer/JWT-looking tokens). We mask,
 * never drop, so the audit record keeps the SHAPE of the call (auditable) without the
 * sensitive payload. Recurses into nested objects/arrays; cycle-safe.
 */

/** Key fragments whose VALUE must always be masked regardless of shape. */
const SENSITIVE_KEY = new RegExp(
  [
    "password",
    "passwd",
    "secret",
    "token",
    "api[_-]?key",
    "apikey",
    "authorization",
    "auth[_-]?token",
    "hash",
    "salt",
    "credential",
    "private[_-]?key",
    "cookie",
    "csrf",
    "ssn",
    "tax[_-]?code",
    "codice[_-]?fiscale",
    "fiscal",
    "iban",
    "email",
    "e[_-]?mail",
    "phone",
    "tel",
    "first[_-]?name",
    "last[_-]?name",
    "full[_-]?name",
    "given[_-]?name",
    "family[_-]?name",
    "birth",
    "dob",
    "address",
    "postal",
    "zip",
  ].join("|"),
  "i",
);

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
/** Italian codice fiscale (16 alphanumerics) — close enough for redaction heuristics. */
const CF_RE = /\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/i;
const IBAN_RE = /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/;
/** JWT-looking 3-segment dot token, or a long opaque bearer-ish token. */
const TOKEN_RE = /\b([A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}|[A-Za-z0-9_-]{40,})\b/;

export const REDACTED = "«REDACTED»";

function redactScalar(value: string): string {
  if (
    EMAIL_RE.test(value) ||
    CF_RE.test(value) ||
    IBAN_RE.test(value) ||
    TOKEN_RE.test(value)
  ) {
    return REDACTED;
  }
  return value;
}

/**
 * Returns a deep clone of `input` with PII/secret-ish fields masked. Never mutates
 * the original. Cycles are replaced with "«cycle»" so the result is always JSON-safe.
 */
export function redact(input: unknown, _seen: WeakSet<object> = new WeakSet()): unknown {
  if (input === null || input === undefined) return input;

  if (typeof input === "string") return redactScalar(input);
  if (typeof input === "number" || typeof input === "boolean") return input;

  if (Array.isArray(input)) {
    if (_seen.has(input)) return "«cycle»";
    _seen.add(input);
    return input.map((v) => redact(v, _seen));
  }

  if (typeof input === "object") {
    const obj = input as Record<string, unknown>;
    if (_seen.has(obj)) return "«cycle»";
    _seen.add(obj);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (SENSITIVE_KEY.test(k)) {
        out[k] = REDACTED; // mask by key name regardless of value shape
      } else {
        out[k] = redact(v, _seen);
      }
    }
    return out;
  }

  // functions, symbols, bigint → drop to a stable marker (never audited raw)
  return "«unserializable»";
}
