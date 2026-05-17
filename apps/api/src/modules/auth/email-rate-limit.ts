/**
 * apps/api/src/modules/auth/email-rate-limit.ts
 *
 * In-memory per-email rate limiter for /v1/auth/login, layered ON TOP OF the
 * existing per-IP rate limit (10 attempts / 5 min, see routes.ts).
 *
 * Rationale (AUTH_SECURITY_PLAN §3 threat row "Credential stuffing /
 * brute force"): per-IP alone is bypassable by an attacker who controls many
 * IPs (botnet, residential proxies). Per-email rate limit caps attempts on a
 * single account regardless of source, defending against targeted password
 * spraying.
 *
 * Semantics:
 *   - Counter is reset on successful login (recordSuccess).
 *   - Counter is incremented on every failed login (recordFailure).
 *   - When counter exceeds MAX_FAILURES in the rolling window, every subsequent
 *     attempt (success or fail) is rejected with TooManyRequestsError for the
 *     remainder of the window.
 *   - Email keys are normalized (lowercase + trim) so casing variants share
 *     the same bucket.
 *
 * Storage:
 *   - Plain Map<email, {count, firstFailureAt}>; sufficient for single-process
 *     API. When we move to multi-process (e.g. PM2 cluster, k8s replicas),
 *     replace with Redis. The interface (`EmailRateLimiter`) is stable so the
 *     swap is local.
 */

import { TooManyRequestsError } from "../../errors/index.js";

const MAX_FAILURES = 5;
const WINDOW_MS = 5 * 60 * 1000;

interface Bucket {
  count: number;
  firstFailureAt: number;
}

export interface EmailRateLimiter {
  /** Throws TooManyRequestsError if email is currently locked. */
  check(email: string, now?: number): void;
  /** Reset the counter for this email (e.g. on successful login). */
  recordSuccess(email: string): void;
  /** Increment the counter for this email; auto-expires after WINDOW_MS. */
  recordFailure(email: string, now?: number): void;
  /** Test-only: clear all buckets. */
  reset(): void;
}

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

export function createEmailRateLimiter(): EmailRateLimiter {
  const buckets = new Map<string, Bucket>();

  function getBucket(email: string, now: number): Bucket | null {
    const b = buckets.get(email);
    if (!b) return null;
    if (now - b.firstFailureAt >= WINDOW_MS) {
      buckets.delete(email);
      return null;
    }
    return b;
  }

  return {
    check(email, now = Date.now()) {
      const key = normalize(email);
      const b = getBucket(key, now);
      if (!b) return;
      if (b.count >= MAX_FAILURES) {
        const retryAfter = Math.ceil((WINDOW_MS - (now - b.firstFailureAt)) / 1000);
        throw new TooManyRequestsError(
          "Too many failed attempts for this account. Try again later.",
          "LOGIN_TOO_MANY_ATTEMPTS_FOR_EMAIL",
          retryAfter,
        );
      }
    },
    recordSuccess(email) {
      buckets.delete(normalize(email));
    },
    recordFailure(email, now = Date.now()) {
      const key = normalize(email);
      const b = getBucket(key, now);
      if (b) {
        b.count += 1;
      } else {
        buckets.set(key, { count: 1, firstFailureAt: now });
      }
    },
    reset() {
      buckets.clear();
    },
  };
}

/** Singleton used by the production auth service. Tests can build their own. */
export const sharedEmailRateLimiter: EmailRateLimiter = createEmailRateLimiter();

/** Exposed constants so tests can assert against the production policy. */
export const EMAIL_RATE_LIMIT_POLICY = {
  MAX_FAILURES,
  WINDOW_MS,
} as const;
