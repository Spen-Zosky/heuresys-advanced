# ADR‑0011 — Employee Self‑Service Portal Inclusion & `self`‑Scope Enforcement

- **Status:** Accepted
- **Date:** 2026‑05‑16
- **Deciders:** Enzo Spenuso (supervisor) on Review #1 of `BOOTSTRAP_EXECUTION_PLAN.md`

## Context

The v5 Bootstrap Pack and the first draft of `BOOTSTRAP_EXECUTION_PLAN.md`/`FRONTEND_IMPLEMENTATION_PLAN.md` explicitly listed the **Employee Self‑Service Portal (ESS)** as out of scope for MVP‑2. The frontend would expose only the **Admin / Blueprint Console** (23 pages, manager‑oriented); the `USER` role would have no UI of its own.

During Review #1, the supervisor reversed the decision: the platform must serve the `USER` role from MVP‑2 onward, otherwise the `USER` permission grade is only theoretical and the platform cannot demonstrate end‑to‑end value (a real workforce platform must talk to its actual workforce, not only its managers).

This ADR records the inclusion, splits MVP‑2 into two sub‑phases, defines the hard `self`‑scope rule for ESS endpoints, and identifies the security guarantees required to prevent cross‑user data leakage.

## Decision

**Include the Employee Self‑Service Portal in MVP‑2 as a sequential sub‑phase named MVP‑2b**, with the following architectural commitments:

1. **MVP‑2 split.** MVP‑2 is now two sub‑phases:
   - **MVP‑2a** — Admin / Blueprint Console (23 pages, ~2‑3 weeks effort) — unchanged.
   - **MVP‑2b** — Employee Self‑Service Portal (13 pages under `/me/*`, ~2 weeks effort) — new.
2. **13 ESS pages** documented in `FRONTEND_IMPLEMENTATION_PLAN.md` §11.1, under the Next.js route group `(ess)` with a dedicated `layout.tsx`. The pages are: `/me`, `/me/profile`, `/me/positions`, `/me/skills`, `/me/skills/self-assessment`, `/me/learning`, `/me/learning/catalogue`, `/me/kpis`, `/me/gaps`, `/me/career`, `/me/certifications`, `/me/documents`, `/me/inbox`.
3. **18 ESS API endpoints** under `/v1/me/*` documented in `API_IMPLEMENTATION_PLAN.md` §5 (module `me`). Total endpoint count: 130 → 148.
4. **19 `self`‑scope permissions** documented in `AUTH_SECURITY_PLAN.md` §6.1. Seeded in migration `000005` alongside the ≈ 81 admin permissions (≈ 100 total); assigned to `USER` role (and `:read:self` subset to `READ_ONLY`).
5. **Hard `self`‑scope enforcement** at three levels:
   - **API routing**: routes under `/v1/me/*` declare no `:userId` URL param. The handler always derives the target user from `req.user.userId` (JWT claim).
   - **Repository pattern**: a `requireSelfScope()` Fastify pre‑handler validates that the effective target is `req.user.userId` before any DB call.
   - **Static analysis**: a custom ESLint rule `no-untenanted-or-cross-user-self-route` flags any handler under `apps/api/src/modules/me/` that calls a repository method with a userId argument other than `req.user.userId`.
6. **Audit table** `audit.user_self_service_actions(action_id, user_id, tenant_id, action_type, resource_id, payload_summary, created_at)` for every ESS mutation (reads are not audited — volume too high).
7. **Per‑role landing redirect**: a user holding only `USER` role lands on `/me`; `MANAGER`+ users land on `/dashboard` with a top‑bar switch to `/me`; `PLATFORM_ADMIN` always lands on `/dashboard`.
8. **MVP‑2b is strictly sequential** to MVP‑2a — admin module patterns (route registration, RBAC, repository tenant‑filter) are settled first; ESS reuses them with the additional `self`‑scope decorator.

## Alternatives Considered

| Option | Pros | Cons | Why rejected |
|--------|------|------|--------------|
| **Keep ESS out of MVP‑2 (original spec)** | Smaller scope; faster MVP‑2 delivery (≈ 2‑3 weeks vs 4‑5) | `USER` role purely theoretical; platform can't be tested with non‑admin user behaviour; demos require admin impersonation | Supervisor decision: ESS is essential for end‑to‑end value demonstration |
| **Separate app `apps/web-ess` (microfrontend split)** | Strict isolation between admin and ESS surfaces; could deploy independently | Duplicates layout, auth client, shared UI primitives; adds CI complexity; users with multiple roles must context‑switch between origins | Cost (duplication + UX friction) > benefit (isolation) |
| **ESS as admin "Impersonate user" mode** | Zero new pages; admin can preview a user's view | UX awful for end users (no real ESS); admins effectively pose as users; permission boundary becomes blurry | Doesn't solve the actual need; security model degraded |
| **ESS via thin reverse proxy to admin pages with role filter** | Reuses admin pages | Admin pages were not designed for self‑scope; filtering at proxy is fragile and leaks via query params | Anti‑pattern; security‑by‑filtering rejected |
| **ESS but only as read‑only (no mutations)** | Eliminates `self_assess`, `enroll`, `request_target` complexity | Removes the engagement value (users can't act on their plan); becomes glorified report viewer | Half‑measure; doesn't realize the goal |

## Consequences

**Positive:**

- The `USER` role becomes meaningfully different from `READ_ONLY` — there are pages and mutations it can actually invoke.
- The platform can be tested with non‑admin users from MVP‑2 onward (real coverage of the role hierarchy).
- Reuses 100% of the existing auth/CSRF/tenant pattern; ESS does **not** introduce new auth machinery, only adds permission rows.
- ESS endpoints under `/v1/me/*` are easier to write defensively (no userId in URL → no IDOR vulnerability surface).
- The audit table `audit.user_self_service_actions` gives a forensic trail of who self‑edited what, useful for both compliance and UX analytics.

**Negative:**

- MVP‑2 effort grows from ~2‑3 weeks to ~4‑5 weeks (R15 in `BOOTSTRAP_EXECUTION_PLAN.md` §8).
- 19 new permissions in `sys.sys_auth_permissions` + 19 rows in `sys.sys_auth_role_permissions` (USER) + ~10 rows for READ_ONLY (`:read:self` subset).
- New `audit.user_self_service_actions` table must be created (in migration 000026 or a new 000027 dedicated to ESS audit).
- ESLint custom rule `no-untenanted-or-cross-user-self-route` must be written and CI‑enforced.
- New ADR pattern emerges: future "self‑scope" expansions (e.g. team‑scope for `MANAGER`) will need similar tooling.

**Neutral:**

- The Next.js route group `(ess)` keeps the ESS bundle separable but co‑located; no architectural split.
- The top‑bar switch between admin and ESS views (for users with mixed roles) is a small UX feature easily added later if not in MVP‑2b first cut.
- The 13 ESS pages are mostly read‑heavy + light mutations; data layer is the same TanStack Query + shared Zod pattern as admin.

## Closure & Verification

This ADR is `Accepted`. The decision is reflected in:

- `BOOTSTRAP_EXECUTION_PLAN.md` §5.2 (MVP‑2 split) + §8 R15 (risk register) + §7 (Mermaid flow updated).
- `FRONTEND_IMPLEMENTATION_PLAN.md` §2 (route group) + §11.1 (13 pages) + §11.2 (redirect) + §12.1 (ESS boundaries).
- `AUTH_SECURITY_PLAN.md` §6.1 (19 `self`‑scope permissions + enforcement model).
- `API_IMPLEMENTATION_PLAN.md` §2 (module structure) + §5 (roster + 18 endpoints).
- `ADR_INDEX.md` (this ADR registered as 0011).

**Verification at MVP‑2b acceptance**: the 5.2.7 acceptance criterion in `BOOTSTRAP_EXECUTION_PLAN.md` includes the scope‑filter test: "user A cannot see user B's data via direct URL manipulation". This is the canonical proof that the ADR's security claim holds.

## References

- Consumed by: `BOOTSTRAP_EXECUTION_PLAN.md`, `FRONTEND_IMPLEMENTATION_PLAN.md`, `AUTH_SECURITY_PLAN.md`, `API_IMPLEMENTATION_PLAN.md`.
- See also: ADR‑0006 (auth strategy — JWT + cookie + CSRF), ADR‑0007 (frontend Next 15 + route groups).
