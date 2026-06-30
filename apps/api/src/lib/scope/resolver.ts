/**
 * apps/api/src/lib/scope/resolver.ts — F1 of the two-axis authorization model (ADR-0027).
 *
 * THE single place that decides an actor's ORGANIZATIONAL read scope — "whose person /
 * sensitive records may this actor read". It replaces the per-module ad-hoc role ladders
 * (each service used to re-derive `MANAGER → team`, `USER → self`, …). It traverses the
 * org chart TRANSITIVELY via the F0 helpers, so an operational manager now sees their whole
 * sub-tree, not just direct reports.
 *
 * The FUNCTIONAL/activity axis (team/process) is a separate resolver added at F4; this one is
 * the organizational axis that gates sensitive personal data (I18/I20). They compose with RBAC
 * (the permission says whether the action is allowed at all; the scope says on whose data).
 */

import type { ActorContext } from "../actor.js";
import type { RoleCode } from "../../config/constants.js";
import { ForbiddenError } from "../../errors/index.js";
import { orgSubtreeUserIds, isInOrgSubtree, isOrgUnitManager, type DbConnector } from "./org.js";

/**
 * Roles with an explicit HR mandate to read sensitive personal data tenant-wide (ADR-0027 §2.5,
 * default confirmed at F1). `PLATFORM_ADMIN` is cross-tenant and handled separately. Every other
 * role is axis-scoped (organizational sub-tree). Change this set, not scattered role checks.
 */
export const HR_MANDATED_ROLES: ReadonlySet<RoleCode> = new Set<RoleCode>([
  "TENANT_ADMIN",
  "HRMS_MANAGER",
]);

/** The organizational read scope. `userIdAllowList` (when present) is the exact set of subject
 *  user ids the actor may read; `all` = cross-tenant; `tenant` = the whole tenant. */
export type OrgReadScope =
  | { kind: "all" }
  | { kind: "tenant"; tenantId: string }
  | { kind: "subtree"; tenantId: string; userIdAllowList: string[] }
  | { kind: "self"; tenantId: string; userIdAllowList: string[] };

/**
 * RBAC roles that are explicit managerial roles ("manager/capo") for the organizational axis
 * (ADR-0027 F1, Enzo's constraint). Being the manager of an org unit (isOrgUnitManager) is the
 * other signal — together they cover responsabile di Divisione / Direzione / centro di costo / OU.
 */
export const MANAGERIAL_ROLES: ReadonlySet<RoleCode> = new Set<RoleCode>(["MANAGER", "CEO"]);

/**
 * Whether the actor holds an EXPLICIT managerial role — an RBAC managerial role OR the manager of
 * at least one org unit. Only such actors get the organizational sub-tree; everyone else sees self
 * only, EVEN IF their org-chart position happens to have reports (Enzo's F1 constraint: the org
 * sub-tree must not apply to any employee who merely has someone under them in the chart).
 */
async function isManagerial(q: DbConnector, actor: ActorContext): Promise<boolean> {
  if (actor.roles.some((r) => MANAGERIAL_ROLES.has(r))) return true;
  return isOrgUnitManager(q, actor.userId);
}

/** Resolve the actor's organizational read scope (ADR-0027 F1). See module header. */
export async function resolveOrgReadScope(q: DbConnector, actor: ActorContext): Promise<OrgReadScope> {
  if (actor.roles.includes("PLATFORM_ADMIN")) return { kind: "all" };
  const tenantId = actor.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required", "TENANT_REQUIRED");
  if (actor.roles.some((r) => HR_MANDATED_ROLES.has(r))) return { kind: "tenant", tenantId };
  // Org sub-tree ONLY for explicit managerial roles — not for any employee who merely has reports
  // in the chart (Enzo's F1 constraint). Non-managerial actors see self only.
  if (await isManagerial(q, actor)) {
    const subtree = await orgSubtreeUserIds(q, actor.userId);
    if (subtree.length > 1) return { kind: "subtree", tenantId, userIdAllowList: subtree };
  }
  return { kind: "self", tenantId, userIdAllowList: [actor.userId] };
}

/**
 * True iff `actor` may read the organizationally-gated record of `targetUserId` — self,
 * HR-mandate, or the actor's transitive org sub-tree. The single per-target predicate for
 * sensitive/person reads (used by the users module and the F3 sensitive-data gates).
 */
export async function canReadOrgTarget(
  q: DbConnector,
  actor: ActorContext,
  targetUserId: string,
  targetTenantId: string | null,
): Promise<boolean> {
  if (actor.roles.includes("PLATFORM_ADMIN")) return true;
  if (!actor.tenantId || targetTenantId !== actor.tenantId) return false;
  if (actor.userId === targetUserId) return true; // self (I17)
  if (actor.roles.some((r) => HR_MANDATED_ROLES.has(r))) return true; // HR mandate (I20)
  if (!(await isManagerial(q, actor))) return false; // non-managerial → self only (F1 constraint)
  return isInOrgSubtree(q, actor.userId, targetUserId); // org sub-tree (I18) — transitive
}
