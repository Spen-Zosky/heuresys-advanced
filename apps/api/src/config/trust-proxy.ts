/**
 * apps/api/src/config/trust-proxy.ts
 * Parse the TRUST_PROXY env into a Fastify `trustProxy` value (D-28, S-100X-A2 F-WS-H-1).
 *
 * z.coerce.boolean() must NOT be used here: Boolean("false") === true — the exact footgun
 * COOKIE_SECURE / SMTP_SECURE already avoid with an explicit string parse. Accepted forms:
 *   "false" / "" (default) → false  — no proxy; req.ip = the socket peer address.
 *   "true"                 → true   — trust the WHOLE X-Forwarded-For chain. SPOOFABLE: a
 *                                     client can forge a leftmost XFF entry, so avoid in prod.
 *   "<ip|cidr>[,…]"        → string — proxy-addr trust-list of proxy addresses/subnets.
 *                                     PROD behind the nginx TLS proxy = "127.0.0.1,::1" →
 *                                     req.ip is the genuine client IP nginx appended, and a
 *                                     forged leftmost XFF entry is ignored, so per-IP rate
 *                                     limiting cannot be evaded with a spoofed header.
 *
 * ⛔ THE HOP-COUNT FORM IS REJECTED (#242 F3, 2026-09-05). It is not deprecated — since
 * fastify 5.12 it means "trust NOTHING", and silently: `lib/request.js` returns a predicate
 * that is always false, because hop-count trust cannot validate the immediate peer. Accepting
 * "1" would therefore keep parsing, keep booting, and quietly collapse every request's req.ip
 * onto the proxy address — the whole per-IP rate limit into a single bucket, with no error, no
 * log and no red test. A config that has become dangerous must fail loudly at boot, not decay
 * into a wrong default. PROD ran "1" until 2026-09-05 and was migrated to "127.0.0.1,::1",
 * measured equivalent on both properties that matter (see #242 F2).
 *
 * Fastify `trustProxy` accepts boolean | string | string[] | fn; this returns boolean | string.
 */
export function parseTrustProxy(raw: string): boolean | string {
  const v = raw.trim();
  const s = v.toLowerCase();
  if (s === "" || s === "false") return false;
  if (s === "true") return true;
  if (/^\d+$/.test(s)) {
    throw new Error(
      `TRUST_PROXY="${v}" is the hop-count form, which fastify >= 5.12 treats as "trust nothing" ` +
        `— req.ip would silently become the proxy address and per-IP rate limiting would collapse ` +
        `into a single bucket. Use the address form instead: TRUST_PROXY=127.0.0.1,::1 ` +
        `(the addresses of the proxies you actually sit behind), or TRUST_PROXY=false if there is no proxy.`,
    );
  }
  return v; // single IP / CIDR / comma-separated proxy list
}
