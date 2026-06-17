/**
 * apps/api/src/modules/teams/service.ts
 * Teams read service + the "my team" 3rd RBAC scope axis (WS-4 R1b).
 *
 * Scope model (I5 = FK + middleware filter, NEVER RLS):
 *   - PLATFORM_ADMIN            → all teams, cross-tenant.
 *   - admin-class (per tenant)  → all teams in the actor's tenant.
 *   - team-scoped (TEAM_LEADER / TEAM_MEMBER / plain USER) → only teams the actor leads or
 *     belongs to. This is the new 3rd axis, beyond tenant / self / reports-of-mine.
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { ForbiddenError, NotFoundError } from "../../errors/index.js";
import type { RoleCode } from "../../config/constants.js";
import type { Team, TeamDetail, TeamListQuery, MyTeamsResponse } from "@heuresys/shared";
import * as repo from "./repository.js";

/** Roles that browse ALL teams in their tenant (vs. the team-scoped "my team" axis). */
const TEAM_ADMIN_ROLES: ReadonlySet<RoleCode> = new Set<RoleCode>([
  "PLATFORM_ADMIN", "TENANT_ADMIN", "MANAGER", "CEO", "HRMS_MANAGER",
]);

function isTeamAdmin(a: ActorContext): boolean {
  return a.roles.some((r) => TEAM_ADMIN_ROLES.has(r));
}
function requireOwnTenant(a: ActorContext): string {
  if (!a.tenantId) throw new ForbiddenError("Tenant context required");
  return a.tenantId;
}

export const teamsService = {
  /** Scope-filtered team collection. Admin-class roles see all teams in their tenant; a
   *  team-scoped actor sees only the teams they lead or belong to (the 3rd scope axis). */
  async list(actor: ActorContext, query: TeamListQuery): Promise<{ items: Team[]; total: number }> {
    const tenantId = isPlatform(actor) ? undefined : requireOwnTenant(actor);
    const memberUserId = isTeamAdmin(actor) ? undefined : actor.userId;
    return repo.listTeams(pool, {
      ...(tenantId !== undefined ? { tenantId } : {}),
      ...(memberUserId !== undefined ? { memberUserId } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      limit: query.limit,
      offset: query.offset,
    });
  },

  /** Single team + members. Tenant isolation + the my-team axis are enforced; an out-of-scope
   *  id returns 404 (not 403) to avoid leaking existence across the boundary. */
  async getById(actor: ActorContext, teamId: string): Promise<TeamDetail> {
    const team = await repo.findTeamById(pool, teamId);
    if (!team) throw new NotFoundError("Team");
    if (!isPlatform(actor)) {
      if (!actor.tenantId || team.tenantId !== actor.tenantId) throw new NotFoundError("Team");
      if (!isTeamAdmin(actor)) {
        const inScope = await repo.userInTeam(pool, teamId, actor.userId);
        if (!inScope) throw new NotFoundError("Team");
      }
    }
    const members = await repo.loadTeamMembers(pool, teamId);
    return { ...team, members };
  },

  /** ESS self view — the caller's own teams (lead + member), with members. */
  async myTeams(actor: ActorContext): Promise<MyTeamsResponse> {
    const teams = await repo.findTeamsForUser(pool, actor.userId);
    return { teams };
  },
};
