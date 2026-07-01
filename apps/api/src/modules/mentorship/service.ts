/**
 * apps/api/src/modules/mentorship/service.ts
 * Mentorship CRUD with tenant-only visibility scope (no global rows).
 * PLATFORM_ADMIN: unfiltered. Others: limited to own tenant; not-visible rows surface as 404 (no leak).
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ForbiddenError, ValidationError } from "../../errors/index.js";
import type {
  MentorshipProgramListQuery, CreateMentorshipProgramBody, UpdateMentorshipProgramBody,
  MentorshipListQuery, CreateMentorshipBody, UpdateMentorshipBody,
  CreateMentorshipSessionBody, UpdateMentorshipSessionBody,
  MentorMatchScoreListQuery,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { resolveOrgReadScope, canReadOrgTarget } from "../../lib/scope/resolver.js";

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

/** List-scope filter: undefined = no filter (PLATFORM_ADMIN); else own tenant (zero-uuid if tenantless → 0 rows). */
function listTenantFilter(a: ActorContext): string | undefined {
  if (isPlatform(a)) return undefined;
  return a.tenantId ?? ZERO_UUID;
}

/** Throw 404 (not 403, to avoid tenant enumeration) when a row is outside the actor's scope. */
function assertVisible(a: ActorContext, rowTenantId: string, resource: string): void {
  if (isPlatform(a)) return;
  if (a.tenantId === null || rowTenantId !== a.tenantId) throw new NotFoundError(resource);
}

/** Resolve the tenant a write lands in. */
function resolveWriteTenant(a: ActorContext, bodyTenantId?: string): string {
  if (isPlatform(a)) {
    const t = bodyTenantId ?? a.tenantId;
    if (!t) throw new ForbiddenError("PLATFORM_ADMIN must supply tenantId", "TENANT_ID_REQUIRED");
    return t;
  }
  if (!a.tenantId) throw new ForbiddenError("Tenant context required", "TENANT_REQUIRED");
  return a.tenantId;
}

/**
 * The actor's ORGANIZATIONAL read allow-list for LIST filtering (ADR-0027 F1, D-50).
 * undefined = no per-user restriction (PLATFORM_ADMIN cross-tenant / HR-mandated tenant-wide);
 * else the exact set of subject user ids the actor may read (managerial sub-tree, or self).
 * The repo applies it as (mentor = ANY OR mentee = ANY): a row is visible when EITHER party is in scope.
 */
async function resolveReadAllowList(a: ActorContext): Promise<string[] | undefined> {
  const scope = await resolveOrgReadScope(pool, a);
  switch (scope.kind) {
    case "all":
    case "tenant":
      return undefined;
    case "subtree":
    case "self":
      return scope.userIdAllowList;
  }
}

export const mentorshipService = {
  // ── Programs ──
  async listPrograms(a: ActorContext, query: MentorshipProgramListQuery) {
    return repo.listPrograms(pool, listTenantFilter(a), query);
  },
  async getProgram(a: ActorContext, id: string) {
    const p = await repo.findProgramById(pool, id);
    if (!p) throw new NotFoundError("Mentorship program");
    assertVisible(a, p.tenantId, "Mentorship program");
    return p;
  },
  async createProgram(a: ActorContext, body: CreateMentorshipProgramBody) {
    const tenantId = resolveWriteTenant(a, body.tenantId);
    return repo.insertProgram(pool, tenantId, body);
  },
  async updateProgram(a: ActorContext, id: string, patch: UpdateMentorshipProgramBody) {
    const p = await repo.findProgramById(pool, id);
    if (!p) throw new NotFoundError("Mentorship program");
    assertVisible(a, p.tenantId, "Mentorship program");
    const updated = await repo.updateProgramPartial(pool, id, patch);
    if (!updated) throw new NotFoundError("Mentorship program");
    return updated;
  },
  async deleteProgram(a: ActorContext, id: string): Promise<void> {
    const p = await repo.findProgramById(pool, id);
    if (!p) throw new NotFoundError("Mentorship program");
    assertVisible(a, p.tenantId, "Mentorship program");
    await repo.deleteProgram(pool, id);
  },

  // ── Pairings ──
  async listMentorships(a: ActorContext, query: MentorshipListQuery) {
    return repo.listMentorships(pool, listTenantFilter(a), await resolveReadAllowList(a), query);
  },
  async getMentorship(a: ActorContext, id: string) {
    const m = await repo.findMentorshipById(pool, id);
    if (!m) throw new NotFoundError("Mentorship");
    assertVisible(a, m.tenantId, "Mentorship");
    // F3 org-axis gate (ADR-0027, D-50): BOTH parties must be in the actor's org read scope,
    // else 404 (not 403) — hides the pairing AND the unavailable counterpart.
    if (m.mentorUserId && !(await canReadOrgTarget(pool, a, m.mentorUserId, m.tenantId))) throw new NotFoundError("Mentorship");
    if (m.menteeUserId && !(await canReadOrgTarget(pool, a, m.menteeUserId, m.tenantId))) throw new NotFoundError("Mentorship");
    return m;
  },
  async createMentorship(a: ActorContext, body: CreateMentorshipBody) {
    if (body.mentorUserId && body.menteeUserId && body.mentorUserId === body.menteeUserId) {
      throw new ValidationError({ menteeUserId: "must differ from mentorUserId" }, "Mentor and mentee must be different");
    }
    const tenantId = resolveWriteTenant(a, body.tenantId);
    return repo.insertMentorship(pool, tenantId, body);
  },
  async updateMentorship(a: ActorContext, id: string, patch: UpdateMentorshipBody) {
    const m = await repo.findMentorshipById(pool, id);
    if (!m) throw new NotFoundError("Mentorship");
    assertVisible(a, m.tenantId, "Mentorship");
    const mentor = patch.mentorUserId !== undefined ? patch.mentorUserId : m.mentorUserId;
    const mentee = patch.menteeUserId !== undefined ? patch.menteeUserId : m.menteeUserId;
    if (mentor && mentee && mentor === mentee) {
      throw new ValidationError({ menteeUserId: "must differ from mentorUserId" }, "Mentor and mentee must be different");
    }
    const updated = await repo.updateMentorshipPartial(pool, id, patch);
    if (!updated) throw new NotFoundError("Mentorship");
    return updated;
  },
  async deleteMentorship(a: ActorContext, id: string): Promise<void> {
    const m = await repo.findMentorshipById(pool, id);
    if (!m) throw new NotFoundError("Mentorship");
    assertVisible(a, m.tenantId, "Mentorship");
    await repo.deleteMentorship(pool, id);
  },

  // ── Sessions (nested under a pairing) ──
  async listSessions(a: ActorContext, mentorshipId: string) {
    const m = await repo.findMentorshipById(pool, mentorshipId);
    if (!m) throw new NotFoundError("Mentorship");
    assertVisible(a, m.tenantId, "Mentorship");
    return repo.listSessionsByMentorship(pool, mentorshipId);
  },
  async getSession(a: ActorContext, id: string) {
    const s = await repo.findSessionById(pool, id);
    if (!s) throw new NotFoundError("Mentorship session");
    assertVisible(a, s.tenantId, "Mentorship session");
    return s;
  },
  async createSession(a: ActorContext, mentorshipId: string, body: CreateMentorshipSessionBody) {
    const m = await repo.findMentorshipById(pool, mentorshipId);
    if (!m) throw new NotFoundError("Mentorship");
    assertVisible(a, m.tenantId, "Mentorship");
    return repo.insertSession(pool, m.tenantId, mentorshipId, body);
  },
  async updateSession(a: ActorContext, id: string, patch: UpdateMentorshipSessionBody) {
    const s = await repo.findSessionById(pool, id);
    if (!s) throw new NotFoundError("Mentorship session");
    assertVisible(a, s.tenantId, "Mentorship session");
    const updated = await repo.updateSessionPartial(pool, id, patch);
    if (!updated) throw new NotFoundError("Mentorship session");
    return updated;
  },
  async deleteSession(a: ActorContext, id: string): Promise<void> {
    const s = await repo.findSessionById(pool, id);
    if (!s) throw new NotFoundError("Mentorship session");
    assertVisible(a, s.tenantId, "Mentorship session");
    await repo.deleteSession(pool, id);
  },

  // ── Match scores (read-only) ──
  async listMatchScores(a: ActorContext, query: MentorMatchScoreListQuery) {
    return repo.listMatchScores(pool, listTenantFilter(a), await resolveReadAllowList(a), query);
  },
  async getMatchScore(a: ActorContext, id: string) {
    const ms = await repo.findMatchScoreById(pool, id);
    if (!ms) throw new NotFoundError("Mentor match score");
    assertVisible(a, ms.tenantId, "Mentor match score");
    // F3 org-axis gate (ADR-0027, D-50): BOTH parties must be in the actor's org read scope.
    if (ms.mentorUserId && !(await canReadOrgTarget(pool, a, ms.mentorUserId, ms.tenantId))) throw new NotFoundError("Mentor match score");
    if (ms.menteeUserId && !(await canReadOrgTarget(pool, a, ms.menteeUserId, ms.tenantId))) throw new NotFoundError("Mentor match score");
    return ms;
  },
};
