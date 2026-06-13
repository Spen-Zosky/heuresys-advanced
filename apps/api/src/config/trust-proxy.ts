/**
 * apps/api/src/config/trust-proxy.ts
 * Parse the TRUST_PROXY env into a Fastify `trustProxy` value (D-28, S-100X-A2 F-WS-H-1).
 *
 * z.coerce.boolean() must NOT be used here: Boolean("false") === true — the exact footgun
 * COOKIE_SECURE / SMTP_SECURE already avoid with an explicit string parse. Accepted forms:
 *   "false" / "" (default) → false  — no proxy; req.ip = the socket peer address.
 *   "true"                 → true   — trust the WHOLE X-Forwarded-For chain. SPOOFABLE: a
 *                                     client can forge a leftmost XFF entry, so avoid in prod.
 *   "<n>"  (e.g. "1")      → number — trust n proxy hops; req.ip = the address n hops back.
 *                                     PROD behind a single nginx TLS proxy = "1" → req.ip is
 *                                     the genuine client IP nginx appended, and forged leftmost
 *                                     XFF entries are ignored → per-IP rate limiting cannot be
 *                                     evaded with a spoofed header.
 *   "<ip|cidr>[,…]"        → string — proxy-addr trust-list of proxy addresses/subnets.
 *
 * Fastify `trustProxy` accepts boolean | number | string | string[] | fn; this returns the
 * boolean | number | string forms.
 */
export function parseTrustProxy(raw: string): boolean | number | string {
  const v = raw.trim();
  const s = v.toLowerCase();
  if (s === "" || s === "false") return false;
  if (s === "true") return true;
  if (/^\d+$/.test(s)) return Number.parseInt(s, 10);
  return v; // single IP / CIDR / comma-separated proxy list
}
