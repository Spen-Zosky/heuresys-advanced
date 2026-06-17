/**
 * apps/api/src/modules/enterprise-typing-profiles/service.ts
 * 1:1 with tenant. Tenant-scoped read; PUT/upsert from tenant_admin+.
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import type {
  EnterpriseTypingProfile, EnterpriseTypingProfileListQuery,
  UpsertEnterpriseTypingProfileBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

function visible(a: ActorContext, p: EnterpriseTypingProfile): boolean {
  if (isPlatform(a)) return true;
  return a.tenantId !== null && p.tenantId === a.tenantId;
}

export const enterpriseTypingProfilesService = {
  async list(actor: ActorContext, query: EnterpriseTypingProfileListQuery) {
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    return repo.listProfiles(pool, { tenantId, query });
  },
  async getById(actor: ActorContext, id: string): Promise<EnterpriseTypingProfile> {
    const t = await repo.findProfileById(pool, id);
    if (!t || !visible(actor, t)) throw new NotFoundError("EnterpriseTypingProfile");
    return t;
  },
  async upsert(actor: ActorContext, body: UpsertEnterpriseTypingProfileBody): Promise<EnterpriseTypingProfile> {
    let tenantId: string;
    if (isPlatform(actor)) {
      const c = body.tenantId ?? actor.tenantId;
      if (!c) throw new ForbiddenError("PLATFORM_ADMIN must supply body.tenantId", "TENANT_ID_REQUIRED");
      tenantId = c;
    } else {
      if (!actor.tenantId) throw new ForbiddenError("Tenant context required");
      tenantId = actor.tenantId;
    }
    return repo.upsertProfile(pool, tenantId, body, actor.userId);
  },
  async delete(actor: ActorContext, id: string): Promise<void> {
    const t = await repo.findProfileById(pool, id);
    if (!t || !visible(actor, t)) throw new NotFoundError("EnterpriseTypingProfile");
    const ok = await repo.deleteProfile(pool, id);
    if (!ok) throw new NotFoundError("EnterpriseTypingProfile");
  },
};
