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
import { functionalScopeUserIds } from "./functional.js";
import { recordScopeAccess, type ScopeAxis } from "./audit.js";

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
 * Ruoli RBAC che valgono come «capo» sull'asse organizzativo.
 *
 * [#99 F3 — decisione di Enzo, 2026-08-14] IL SEGNALE PRIMARIO È DIRIGERE UN'UNITÀ
 * (`isOrgUnitManager`): comanda l'organigramma. Questo elenco è un'AGGIUNTA — copre chi ha il
 * ruolo sulla carta senza dirigere un'unità — non una condizione alternativa di pari rango.
 * Prima del cambio i due segnali erano indipendenti perché il perimetro nasceva dall'albero
 * delle POSIZIONI; ora che nasce dall'albero delle unità, «avere riporti» e «dirigere un'unità»
 * sono la stessa cosa, e il secondo assorbe il primo.
 */
export const MANAGERIAL_ROLES: ReadonlySet<RoleCode> = new Set<RoleCode>(["MANAGER", "CEO"]);

/**
 * Se l'attore è un capo: dirige almeno un'unità organizzativa, oppure ha un ruolo RBAC
 * manageriale. Solo a costoro spetta il perimetro gerarchico; tutti gli altri vedono se stessi —
 * **anche se nell'albero delle POSIZIONI risultano riporti sotto di loro**. Quell'albero non è
 * più la fonte del perimetro (#99 F3), ed è esattamente il caso che il vincolo continua a negare.
 */
async function isManagerial(q: DbConnector, actor: ActorContext): Promise<boolean> {
  if (actor.roles.some((r) => MANAGERIAL_ROLES.has(r))) return true;
  return isOrgUnitManager(q, actor.userId);
}

/** Resolve the actor's organizational read scope (ADR-0027 F1). Records the authorizing axis (F6). */
export async function resolveOrgReadScope(q: DbConnector, actor: ActorContext): Promise<OrgReadScope> {
  const audit = (axis: ScopeAxis, tenantId: string | null) =>
    recordScopeAccess({ op: "resolve", actorUserId: actor.userId, tenantId, granted: true, axis });
  if (actor.roles.includes("PLATFORM_ADMIN")) {
    audit("platform", actor.tenantId);
    return { kind: "all" };
  }
  const tenantId = actor.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required", "TENANT_REQUIRED");
  if (actor.roles.some((r) => HR_MANDATED_ROLES.has(r))) {
    audit("hr_mandate", tenantId);
    return { kind: "tenant", tenantId };
  }
  // Org sub-tree ONLY for explicit managerial roles — not for any employee who merely has reports
  // in the chart (Enzo's F1 constraint). Non-managerial actors see self only.
  if (await isManagerial(q, actor)) {
    const subtree = await orgSubtreeUserIds(q, actor.userId);
    if (subtree.length > 1) {
      audit("org_subtree", tenantId);
      return { kind: "subtree", tenantId, userIdAllowList: subtree };
    }
  }
  audit("self", tenantId);
  return { kind: "self", tenantId, userIdAllowList: [actor.userId] };
}

/** The functional (activity) read scope — ADR-0027 F4. Same shape as {@link OrgReadScope}
 *  except the sub-tree kind is replaced by `functional`, so a caller can never mistake one
 *  axis's allow-list for the other's when reading a scope value. */
export type ActivityScope =
  | { kind: "all" }
  | { kind: "tenant"; tenantId: string }
  | { kind: "functional"; tenantId: string; userIdAllowList: string[] }
  | { kind: "self"; tenantId: string; userIdAllowList: string[] };

/**
 * Resolve the actor's FUNCTIONAL scope — "whose ACTIVITIES may this actor see/manage"
 * (ADR-0027 F4). Deliberately NOT interchangeable with {@link resolveOrgReadScope}:
 *
 *   - route a data class of ACTIVITY here;
 *   - route PERSONAL / COMPENSATION / SKILL / EVALUATION to the organizational resolver.
 *
 * Calling this one for sensitive data would hand a team leader their members' private
 * records — precisely the leak ADR-0027 exists to prevent (I18, cardinal rule). The
 * data-class taxonomy (`data-classes.ts`) makes the choice mechanical.
 *
 * HR-mandated roles keep tenant-wide reach here too: their mandate covers business data
 * generally, activities included (HRMS_MANAGER is plenipotentiary on business data).
 */
export async function resolveActivityScope(
  q: DbConnector,
  actor: ActorContext,
): Promise<ActivityScope> {
  const audit = (axis: ScopeAxis, tenantId: string | null) =>
    recordScopeAccess({ op: "resolve", actorUserId: actor.userId, tenantId, granted: true, axis });

  if (actor.roles.includes("PLATFORM_ADMIN")) {
    audit("platform", actor.tenantId);
    return { kind: "all" };
  }
  const tenantId = actor.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required", "TENANT_REQUIRED");
  if (actor.roles.some((r) => HR_MANDATED_ROLES.has(r))) {
    audit("hr_mandate", tenantId);
    return { kind: "tenant", tenantId };
  }

  // No managerial-role precondition here (unlike the org axis): leading a team or owning a
  // process IS the credential. That is the point of the second axis — a TEAM_LEADER with no
  // org-chart reports still runs their team's work.
  const scope = await functionalScopeUserIds(q, actor.userId);
  if (scope.length > 1) {
    audit("functional", tenantId);
    return { kind: "functional", tenantId, userIdAllowList: scope };
  }
  audit("self", tenantId);
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
  const audit = (granted: boolean, axis: ScopeAxis): boolean => {
    recordScopeAccess({ op: "target", actorUserId: actor.userId, tenantId: actor.tenantId, targetUserId, granted, axis });
    return granted;
  };
  if (actor.roles.includes("PLATFORM_ADMIN")) return audit(true, "platform");
  if (!actor.tenantId || targetTenantId !== actor.tenantId) return audit(false, "denied");
  if (actor.userId === targetUserId) return audit(true, "self"); // self (I17)
  if (actor.roles.some((r) => HR_MANDATED_ROLES.has(r))) return audit(true, "hr_mandate"); // HR mandate (I20)
  if (!(await isManagerial(q, actor))) return audit(false, "denied"); // non-managerial → self only (F1 constraint)
  const inTree = await isInOrgSubtree(q, actor.userId, targetUserId); // org sub-tree (I18) — transitive
  return audit(inTree, inTree ? "org_subtree" : "denied");
}
