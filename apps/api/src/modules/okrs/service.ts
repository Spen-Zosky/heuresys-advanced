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
import { masksUnderPlatformMandate, maskFields } from "../../lib/scope/mask.js";

/**
 * #124 D4 / ADR-0032 — cosa se ne va da un OKR letto sotto il solo mandato
 * piattaforma. Stesso confine di `goals`, che l'invariante detta: **gli STATI
 * restano visibili (I20)**, se ne va il QUANTO.
 *
 * Sul risultato-chiave la distinzione e' netta e vale la pena dirla: `startValue`
 * e `targetValue` RESTANO — sono la definizione di cosa ci si aspettava, cioe'
 * struttura — mentre `currentValue` e `progressPercent` se ne vanno, perche'
 * dicono dove la persona e' arrivata.
 *
 * Un OKR **senza proprietario** (`ownerUserId` null: gli OKR aziendali, `okrType`
 * COMPANY) non giudica nessuno e resta intatto. E' lo stesso criterio per cui i
 * modelli predittivi e le posizioni critiche non si mascherano.
 */
const OKR_JUDGMENT_FIELDS = ["overallProgress", "confidenceLevel"] as const;
const KEY_RESULT_JUDGMENT_FIELDS = ["currentValue", "progressPercent", "confidenceLevel"] as const;
const OKR_CHECKIN_JUDGMENT_FIELDS = [
  "previousValue", "newValue", "previousProgress", "newProgress", "overallProgress",
  "nextSteps", "confidenceLevel", "notes", "blockers",
] as const;

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
    const page = await repo.listOkrs(pool, listTenantFilter(a), query, userIdAllowList);
    if (!masksUnderPlatformMandate(a, "EVALUATION", null)) return page;
    return {
      ...page,
      items: page.items.map((o) =>
        o.ownerUserId && masksUnderPlatformMandate(a, "EVALUATION", o.ownerUserId)
          ? maskFields(o, OKR_JUDGMENT_FIELDS)
          : o,
      ),
    };
  },
  async getOkr(a: ActorContext, id: string) {
    const o = await loadReadableOkr(a, id);
    return o.ownerUserId && masksUnderPlatformMandate(a, "EVALUATION", o.ownerUserId)
      ? maskFields(o, OKR_JUDGMENT_FIELDS)
      : o;
  },
  async listKeyResults(a: ActorContext, okrId: string) {
    await loadReadableOkr(a, okrId);
    const page = await repo.listKeyResultsByOkr(pool, okrId);
    if (!masksUnderPlatformMandate(a, "EVALUATION", null)) return page;
    // Il risultato-chiave ha un proprio proprietario, che puo' differire da
    // quello dell'OKR padre: si guarda il suo, non quello del padre.
    return {
      ...page,
      items: page.items.map((k) =>
        k.ownerUserId && masksUnderPlatformMandate(a, "EVALUATION", k.ownerUserId)
          ? maskFields(k, KEY_RESULT_JUDGMENT_FIELDS)
          : k,
      ),
    };
  },
  // #26 (S1018): OKR check-in history — gated by the same centralized helper.
  async listCheckIns(a: ActorContext, okrId: string, q: { limit: number; offset: number }) {
    await loadReadableOkr(a, okrId);
    const page = await repo.listOkrCheckIns(pool, okrId, q.limit, q.offset);
    if (!masksUnderPlatformMandate(a, "EVALUATION", null)) return page;
    return {
      ...page,
      items: page.items.map((c) =>
        c.subjectUserId && masksUnderPlatformMandate(a, "EVALUATION", c.subjectUserId)
          ? maskFields(c, OKR_CHECKIN_JUDGMENT_FIELDS)
          : c,
      ),
    };
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
