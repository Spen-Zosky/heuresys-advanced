/**
 * apps/web/src/lib/landing.ts
 *
 * Applies FRONTEND_IMPLEMENTATION_PLAN §11.2 routing:
 *   - pure USER / READ_ONLY → /me
 *   - any management role (MANAGER+) → /dashboard with "switch to my HR".
 */

const ADMIN_ROLES = new Set([
  "PLATFORM_ADMIN",
  "TENANT_ADMIN",
  "BLUEPRINT_MANAGER",
  "HRMS_MANAGER",
  "PROCESS_OWNER",
  "MANAGER",
]);

export function landingForRoles(roles: readonly string[]): string {
  const hasAdminRole = roles.some((r) => ADMIN_ROLES.has(r));
  return hasAdminRole ? "/dashboard" : "/me";
}
