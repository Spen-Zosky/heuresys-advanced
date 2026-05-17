/**
 * apps/web/src/lib/api/csrf-store.ts
 *
 * Stores the live CSRF token (rotated by /v1/auth/refresh). Backed by:
 *   - an in-memory cache (set on login + refresh),
 *   - the readable `hrx_csrf` cookie (the API sets it as non-HttpOnly so JS
 *     can read it for the double-submit pattern),
 *   - a BroadcastChannel to keep all tabs in sync on rotation.
 *
 * Server-side (RSC, middleware) the token isn't needed because no mutation
 * happens there.
 */

const COOKIE_NAME = "hrx_csrf";
const CHANNEL_NAME = "hrx_csrf_rotation";

let inMemory: string | null = null;
let bc: BroadcastChannel | null = null;

function readFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  return m && m[1] ? decodeURIComponent(m[1]) : null;
}

function ensureChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null;
  }
  if (!bc) {
    bc = new BroadcastChannel(CHANNEL_NAME);
    bc.onmessage = (event) => {
      if (typeof event.data === "string") {
        inMemory = event.data;
      } else if (event.data === null) {
        inMemory = null;
      }
    };
  }
  return bc;
}

export const csrfStore = {
  get(): string | null {
    if (inMemory) return inMemory;
    const fromCookie = readFromCookie();
    if (fromCookie) inMemory = fromCookie;
    return inMemory;
  },

  set(token: string): void {
    inMemory = token;
    ensureChannel()?.postMessage(token);
  },

  clear(): void {
    inMemory = null;
    ensureChannel()?.postMessage(null);
  },
};
