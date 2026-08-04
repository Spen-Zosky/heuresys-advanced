/**
 * apps/web/src/lib/landing.ts
 *
 * Where a session lands right after login.
 *
 * The rule itself lives in `@heuresys/shared` (schemas/auth), beside the login
 * response contract whose `permissions` field it consumes — that is the only
 * place both this app and the API-side regression test can read it from. This
 * module stays as the web-facing import path.
 *
 * #116 — no list of role names survives here on purpose: a new role lands
 * correctly the day it is created, because the answer comes from its grants.
 *
 * Product decision deliberately NOT taken here: whether a branch manager
 * *ought* to see the dashboard is a question about permissions, and if the
 * answer is yes the grant belongs in the RBAC map — not in a navigation rule
 * that presumes it.
 */

export { landingForPermissions, DASHBOARD_PERMISSION } from "@heuresys/shared";
