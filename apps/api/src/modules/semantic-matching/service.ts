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
// Rank-and-file roles see only their OWN occupation matches via /users/:id (ESS self = /me).
// Any leadership/HR/admin/process role may view in-tenant peers. (Enzo option (b), S971.)
const SELF_ONLY_ROLES: ReadonlySet<RoleCode> = new Set<RoleCode>(["USER", "TEAM_MEMBER", "READ_ONLY"]);

export const semanticMatchingService = {
  /** Caller's own person-profile → top-N ESCO occupations. */
  async myOccupations(a: ActorContext, q: MatchQuery) {
    return repo.knnOccupationsForUser(pool, a.userId, q.limit);
  },

  /**
   * Any user in the actor's scope → top-N occupations (admin/manager surface). 404 outside scope.
   * A plain USER (no role beyond USER) may only target itself — the ESS self path is /me/occupations;
   * viewing a peer's occupation-fit requires a manager/HR/admin role. 404 (not 403) avoids enumeration.
   */
  async userOccupations(a: ActorContext, userId: string, q: MatchQuery) {
    const canViewOthers = a.roles.some((r) => !SELF_ONLY_ROLES.has(r));
    if (!canViewOthers && userId !== a.userId) throw new NotFoundError("User");
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
