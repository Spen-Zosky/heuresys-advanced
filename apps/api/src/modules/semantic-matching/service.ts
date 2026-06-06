/**
 * apps/api/src/modules/semantic-matching/service.ts
 * Read-only semantic matching. Self-scope (me) + admin scope (any in-tenant user).
 * Skills catalog is largely global → similar-skills is matching:read for any actor.
 */
import { pool } from "../../db/client.js";
import { NotFoundError } from "../../errors/index.js";
import type { RoleCode } from "../../config/constants.js";
import type { MatchQuery } from "@heuresys/shared";
import * as repo from "./repository.js";

export interface ActorContext {
  userId: string;
  tenantId: string | null;
  roles: RoleCode[];
}
const isPlatform = (a: ActorContext): boolean => a.roles.includes("PLATFORM_ADMIN");
// A non-platform actor with no tenant sees only global skills → match no real tenant.
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

export const semanticMatchingService = {
  /** Caller's own person-profile → top-N ESCO occupations. */
  async myOccupations(a: ActorContext, q: MatchQuery) {
    return repo.knnOccupationsForUser(pool, a.userId, q.limit);
  },

  /** Any user in the actor's scope → top-N occupations (admin surface). 404 outside scope. */
  async userOccupations(a: ActorContext, userId: string, q: MatchQuery) {
    const tenant = await repo.findUserTenant(pool, userId);
    if (tenant === null) throw new NotFoundError("User");
    if (!isPlatform(a) && (a.tenantId === null || tenant !== a.tenantId)) throw new NotFoundError("User");
    return repo.knnOccupationsForUser(pool, userId, q.limit);
  },

  /** A skill → top-N similar skills (catalog dedup/discovery), tenant-scoped (I5). */
  async similarSkills(a: ActorContext, skillId: string, q: MatchQuery) {
    const tenantId = isPlatform(a) ? undefined : (a.tenantId ?? ZERO_UUID);
    const items = await repo.knnSimilarSkills(pool, skillId, tenantId, q.limit);
    return { items, total: items.length };
  },
};
