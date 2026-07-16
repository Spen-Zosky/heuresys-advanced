/**
 * apps/api/src/modules/okrs/service.ts — OKR CRUD + key-results read. Tenant-only visibility.
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";
export type { ActorContext };
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import type { OkrListQuery, CreateOkrBody, UpdateOkrBody } from "@heuresys/shared";
import * as repo from "./repository.js";
import { resolveOrgReadScope, canReadOrgTarget } from "../../lib/scope/resolver.js";

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
function listTenantFilter(a: ActorContext): string | undefined { return isPlatform(a) ? undefined : (a.tenantId ?? ZERO_UUID); }
function assertVisible(a: ActorContext, rowTenantId: string, resource: string): void {
  if (isPlatform(a)) return;
  if (a.tenantId === null || rowTenantId !== a.tenantId) throw new NotFoundError(resource);
}
function resolveWriteTenant(a: ActorContext, bodyTenantId?: string): string {
  if (isPlatform(a)) { const t = bodyTenantId ?? a.tenantId; if (!t) throw new ForbiddenError("PLATFORM_ADMIN must supply tenantId", "TENANT_ID_REQUIRED"); return t; }
  if (!a.tenantId) throw new ForbiddenError("Tenant context required", "TENANT_REQUIRED");
  return a.tenantId;
}

/**
 * ADR-0027 F3 + F4-contract (S1018 #26): per-OKR read authorization centralized —
 * every sub-resource read flows through here (same doctrine as goals/canReadGoal;
 * W9/F4 extends the body for team-bound OKRs without touching routes).
 */
async function loadReadableOkr(a: ActorContext, id: string) {
  const o = await repo.findOkrById(pool, id);
  if (!o) throw new NotFoundError("OKR");
  assertVisible(a, o.tenantId, "OKR");
  if (o.ownerUserId && !(await canReadOrgTarget(pool, a, o.ownerUserId, o.tenantId))) {
    throw new NotFoundError("OKR");
  }
  return o;
}

export const okrsService = {
  async listOkrs(a: ActorContext, query: OkrListQuery) {
    const scope = await resolveOrgReadScope(pool, a);
    const userIdAllowList = scope.kind === "subtree" || scope.kind === "self" ? scope.userIdAllowList : undefined;
    return repo.listOkrs(pool, listTenantFilter(a), query, userIdAllowList);
  },
  async getOkr(a: ActorContext, id: string) {
    return loadReadableOkr(a, id);
  },
  async listKeyResults(a: ActorContext, okrId: string) {
    await loadReadableOkr(a, okrId);
    return repo.listKeyResultsByOkr(pool, okrId);
  },
  // #26 (S1018): OKR check-in history — gated by the same centralized helper.
  async listCheckIns(a: ActorContext, okrId: string, q: { limit: number; offset: number }) {
    await loadReadableOkr(a, okrId);
    return repo.listOkrCheckIns(pool, okrId, q.limit, q.offset);
  },
  async createOkr(a: ActorContext, body: CreateOkrBody) { return repo.insertOkr(pool, resolveWriteTenant(a, body.tenantId), body); },
  async updateOkr(a: ActorContext, id: string, patch: UpdateOkrBody) {
    const o = await repo.findOkrById(pool, id); if (!o) throw new NotFoundError("OKR");
    assertVisible(a, o.tenantId, "OKR");
    const u = await repo.updateOkrPartial(pool, id, patch); if (!u) throw new NotFoundError("OKR"); return u;
  },
  async deleteOkr(a: ActorContext, id: string): Promise<void> {
    const o = await repo.findOkrById(pool, id); if (!o) throw new NotFoundError("OKR");
    assertVisible(a, o.tenantId, "OKR"); await repo.deleteOkr(pool, id);
  },
};
