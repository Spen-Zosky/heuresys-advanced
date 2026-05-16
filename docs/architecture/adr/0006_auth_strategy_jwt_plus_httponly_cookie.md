# ADR‑0006 — Auth Strategy: Short JWT + Rotated Refresh + HttpOnly Cookie + CSRF

- **Status:** Accepted
- **Date:** 2026‑05‑16

## Context

The admin frontend (`apps/web`) is a same‑site SPA served by Next.js. It must authenticate against `apps/api` with:

1. Stateless validation of every API request (no server session lookup on hot path).
2. Revocability on logout and on security incident.
3. Protection against XSS (don't let JS steal credentials).
4. Protection against CSRF (don't let third‑party sites trigger state‑changing requests).
5. Mobile‑readiness (future iOS/Android admin tools can reuse the same model).

## Decision

Hybrid scheme:

- **Access token:** JWT (RS256), 15‑minute TTL, carries `userId`, `tenantId`, `roles[]`. Stored in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie.
- **Refresh token:** opaque 32‑byte random string, 30‑day TTL. Stored hashed (SHA‑256) in `sys.sys_auth_refresh_tokens` with `token_family_id` for rotation chain. Sent only to `/auth/refresh`, also via `HttpOnly` cookie.
- **CSRF protection:** double‑submit cookie. A non‑`HttpOnly` `XSRF-TOKEN` cookie is set on login; client includes its value in an `X-CSRF-Token` header on every `POST/PATCH/DELETE`. Server validates header == cookie. `GET/HEAD` exempt. Origin/Referer is also validated.
- **Refresh rotation:** every successful refresh invalidates the presented token and issues a new one in the same family. If a token already invalidated is presented again, the whole family is revoked and a `REFRESH_REPLAY_DETECTED` event is logged.
- **Revocation:** logout invalidates the current family; admin endpoint revokes all families for a user.

## Alternatives Considered

| Option | Pros | Cons | Why rejected |
|--------|------|------|--------------|
| **JWT in `Authorization` header (no cookie)** | Simpler; no CSRF concern | XSS that exfiltrates `localStorage` token = full compromise; rotation harder | Admin UI is targeted; XSS risk too high |
| **Pure server sessions** | Easy revocation, simple revocation list | Stateful API; lookup on every request; harder horizontal scale | We want statelessness on hot path |
| **Long‑lived JWT, no refresh** | Simplest | No granular revocation; stolen JWT valid until expiry | Unacceptable security posture |
| **Refresh tokens stored as plain text in DB** | Simpler implementation | DB dump = all sessions stolen | Hash refresh tokens at rest |
| **Single refresh token, no rotation** | Simpler client | No replay detection; stolen refresh token usable until expiry | Rotation is the OWASP 2024 baseline |

## Consequences

**Positive:**

- XSS: cookie is `HttpOnly`, so a successful XSS cannot read the access token directly.
- CSRF: double‑submit cookie + same‑site default block cross‑origin POSTs.
- Refresh replay detection catches credential theft within the rotation window.
- Stateless validation on hot path (verify JWT signature + decode claims, no DB hit).
- Mobile clients can use the same endpoints, swapping cookie auth for header‑based bearer if needed.

**Negative:**

- Implementation complexity is higher than a single‑token scheme. Mitigated by detailed pseudocode in `AUTH_SECURITY_PLAN.md`.
- CSRF token rotation must be reliable across tabs; we use a `BroadcastChannel` listener in `apps/web/src/lib/auth/csrf.ts`.

**Neutral:**

- For local dev (`NODE_ENV !== 'production'`), `Secure=false` to permit HTTP; production strictly requires HTTPS.

## References

- Consumed by: `AUTH_SECURITY_PLAN.md`, `API_IMPLEMENTATION_PLAN.md`, `FRONTEND_IMPLEMENTATION_PLAN.md`.
- See also: ADR‑0005 (password hashing), ADR‑0002 (Fastify).
