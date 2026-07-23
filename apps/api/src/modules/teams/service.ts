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
import { pool, withTransaction } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../errors/index.js";
import type { RoleCode } from "../../config/constants.js";
import type {
  Team,
  TeamCreateBody,
  TeamDetail,
  TeamListQuery,
  TeamMemberUpsertBody,
  TeamUpdateBody,
  MyTeamsResponse,
} from "@heuresys/shared";
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

  /* --- #75 lifecycle (S1028, ex D-71) ------------------------------------ */

  /** POST /v1/teams (team:manage). Tenant = actor's own; PLATFORM_ADMIN may
   *  target any tenant via body.tenantId. The lead (optional) must be an
   *  ACTIVE user of the same tenant and is mirrored as a LEAD membership row
   *  (invariant "lead team = LEAD member"). */
  async create(actor: ActorContext, body: TeamCreateBody): Promise<TeamDetail> {
    const tenantId = isPlatform(actor) && body.tenantId ? body.tenantId : requireOwnTenant(actor);
    if (!isPlatform(actor) && body.tenantId && body.tenantId !== actor.tenantId) {
      throw new ForbiddenError("Cannot create a team in another tenant", "PERMISSION_DENIED");
    }
    const teamId = await withTransaction(async (tx) => {
      const dup = await repo.findTeamByCode(tx, tenantId, body.code);
      if (dup) throw new ConflictError(`Team code ${body.code} already exists in tenant`, "TEAM_CODE_CONFLICT");
      const leadUserId = body.leadUserId ?? null;
      if (leadUserId) await assertSameTenantUser(tx, leadUserId, tenantId, "lead");
      const id = await repo.insertTeam(tx, {
        tenantId,
        code: body.code,
        name: body.name,
        organizationUnitId: body.organizationUnitId ?? null,
        leadUserId,
        isActive: body.isActive ?? true,
        actorUserId: actor.userId,
      });
      if (leadUserId) await repo.upsertMember(tx, id, leadUserId, "LEAD", true, actor.userId);
      return id;
    });
    return this.getById(actor, teamId);
  },

  /** PATCH /v1/teams/:id (team:manage). Lead changes keep the LEAD membership
   *  row in sync (single-lead model); `leadUserId: null` clears both. */
  async update(actor: ActorContext, teamId: string, body: TeamUpdateBody): Promise<TeamDetail> {
    const team = await loadManagedTeam(actor, teamId);
    await withTransaction(async (tx) => {
      if (body.leadUserId !== undefined && body.leadUserId !== null) {
        await assertSameTenantUser(tx, body.leadUserId, team.tenantId, "lead");
      }
      await repo.updateTeam(tx, teamId, { ...body, actorUserId: actor.userId });
      if (body.leadUserId !== undefined) {
        await repo.demoteOtherLeads(tx, teamId, body.leadUserId, actor.userId);
        if (body.leadUserId !== null) {
          await repo.upsertMember(tx, teamId, body.leadUserId, "LEAD", true, actor.userId);
        }
      }
    });
    return this.getById(actor, teamId);
  },

  /** PUT /v1/teams/:id/members/:userId (team:manage) — membership upsert.
   *  Promoting to LEAD also moves the team lead pointer (single-lead). */
  async upsertMember(
    actor: ActorContext,
    teamId: string,
    userId: string,
    body: TeamMemberUpsertBody,
  ): Promise<TeamDetail> {
    const team = await loadManagedTeam(actor, teamId);
    const role = body.role ?? "MEMBER";
    await withTransaction(async (tx) => {
      await assertSameTenantUser(tx, userId, team.tenantId, "member");
      await repo.upsertMember(tx, teamId, userId, role, body.isActive ?? true, actor.userId);
      if (role === "LEAD") {
        await repo.demoteOtherLeads(tx, teamId, userId, actor.userId);
        await repo.updateTeam(tx, teamId, { leadUserId: userId, actorUserId: actor.userId });
      } else if (team.leadUserId === userId) {
        // demoted the current lead → clear the pointer too
        await repo.updateTeam(tx, teamId, { leadUserId: null, actorUserId: actor.userId });
      }
    });
    return this.getById(actor, teamId);
  },

  /** DELETE /v1/teams/:id/members/:userId (team:manage). Removing the lead
   *  clears the team lead pointer. */
  async removeMember(actor: ActorContext, teamId: string, userId: string): Promise<TeamDetail> {
    const team = await loadManagedTeam(actor, teamId);
    await withTransaction(async (tx) => {
      const removed = await repo.removeMember(tx, teamId, userId);
      if (!removed) throw new NotFoundError("TeamMember");
      if (team.leadUserId === userId) await repo.clearLeadIfUser(tx, teamId, userId, actor.userId);
    });
    return this.getById(actor, teamId);
  },
};

/** Loads a team enforcing I5 for mutations: platform = any; others = own tenant
 *  only (404 outside the boundary — no existence leak, same as getById). */
async function loadManagedTeam(actor: ActorContext, teamId: string): Promise<Team> {
  const team = await repo.findTeamById(pool, teamId);
  if (!team) throw new NotFoundError("Team");
  if (!isPlatform(actor) && team.tenantId !== actor.tenantId) throw new NotFoundError("Team");
  return team;
}

/** Lead/member targets must be ACTIVE users of the team's tenant (I5). */
async function assertSameTenantUser(
  db: Parameters<typeof repo.findUserTenant>[0],
  userId: string,
  tenantId: string,
  what: "lead" | "member",
): Promise<void> {
  const userTenant = await repo.findUserTenant(db, userId);
  if (!userTenant) throw new NotFoundError("User");
  if (userTenant !== tenantId) {
    throw new ValidationError(
      { userId, tenantId },
      `Team ${what} must belong to the team's tenant`,
    );
  }
}
