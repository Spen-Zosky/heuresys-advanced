/**
 * apps/api/src/modules/okrs/service.ts — OKR CRUD + key-results read. Tenant-only visibility.
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";
export type { ActorContext };
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import type { OkrListQuery, CreateOkrBody, UpdateOkrBody } from "@heuresys/shared";
import * as repo from "./repository.js";

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

export const okrsService = {
  async listOkrs(a: ActorContext, query: OkrListQuery) { return repo.listOkrs(pool, listTenantFilter(a), query); },
  async getOkr(a: ActorContext, id: string) {
    const o = await repo.findOkrById(pool, id); if (!o) throw new NotFoundError("OKR");
    assertVisible(a, o.tenantId, "OKR"); return o;
  },
  async listKeyResults(a: ActorContext, okrId: string) {
    const o = await repo.findOkrById(pool, okrId); if (!o) throw new NotFoundError("OKR");
    assertVisible(a, o.tenantId, "OKR");
    return repo.listKeyResultsByOkr(pool, okrId);
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
