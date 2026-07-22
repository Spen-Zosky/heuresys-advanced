/**
 * apps/web/src/lib/landing.ts
 *
 * Applies FRONTEND_IMPLEMENTATION_PLAN §11.2 routing:
 *   - pure self-service roles → /me
 *   - anything else (management/functional/custodian) → /dashboard with "switch to my HR".
 *
 * D-68 fix: the set is INVERTED vs the original ADMIN_ROLES allowlist — we
 * enumerate the closed set of pure self-service roles (ESS floor, I17) and
 * default every other role to the admin landing. A new management/functional
 * role (e.g. ORG_DIRECTOR, CEO, TEAM_LEADER, WHISTLEBLOWING_CUSTODIAN, or a
 * future holderless role) lands on /dashboard automatically instead of
 * silently falling through to /me.
 */

const SELF_SERVICE_ROLES = new Set([
  "USER",
  "READ_ONLY",
  "TEAM_MEMBER",
]);

export function landingForRoles(roles: readonly string[]): string {
  const hasAdminRole = roles.some((r) => !SELF_SERVICE_ROLES.has(r));
  return hasAdminRole ? "/dashboard" : "/me";
}
