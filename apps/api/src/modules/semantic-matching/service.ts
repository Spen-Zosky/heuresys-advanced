/**
 * apps/api/src/modules/semantic-matching/service.ts
 * Read-only semantic matching. Self-scope (me) + admin scope (any in-tenant user).
 * Skills catalog is largely global → similar-skills is matching:read for any actor.
 */
import { pool } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import { env } from "../../config/env.js";
import type { RoleCode } from "../../config/constants.js";
import type { MatchQuery, FreeTextQuery } from "@heuresys/shared";
import * as repo from "./repository.js";
import { canReadOrgTarget } from "../../lib/scope/resolver.js";
import { runBackfill, type BackfillSummary } from "./backfill.js";
import { makeEmbedder, type Embedder } from "./voyage-client.js";

const isPlatform = (a: ActorContext): boolean => a.roles.includes("PLATFORM_ADMIN");
// A non-platform actor with no tenant sees only global skills → match no real tenant.
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
/**
 * BROWSE capability only — NOT target access (Z-203, ADR-0027 §F1-bis).
 *
 * This set governs one question: may the actor *browse* "people similar to X" at all? That is a
 * leadership tool, not an ESS surface, so a rank-and-file actor gets 403 even on its own profile.
 *
 * It must NOT be used to decide whether a peer's data is readable. That decision belongs to
 * `canReadOrgTarget` alone (self I17 · HR mandate I20 · managerial + org sub-tree I18 · tenant),
 * and duplicating it here produced a real divergence: an actor whose only RBAC role is `USER` but
 * who *manages an org unit* is managerial for the resolver, while this list called it self-only —
 * so peer reads that every other F3 module grants were 404 here. Measured 2026-07-26: 5 real
 * org-unit managers were in that state, of whom 1 actually had reports (7) — for the other 4 the
 * denial was inert, not absent. Removing the list cannot widen access: it was an EXTRA filter in
 * front of a gate that ran anyway, so dropping it can only remove denials, never add one.
 */
const BROWSE_SELF_ONLY_ROLES: ReadonlySet<RoleCode> = new Set<RoleCode>(["USER", "TEAM_MEMBER", "READ_ONLY"]);
/** May the actor browse peer-similarity at all? Capability gate, not a per-target gate. */
const canBrowsePeers = (a: ActorContext): boolean => a.roles.some((r) => !BROWSE_SELF_ONLY_ROLES.has(r));

/**
 * Free-text feature is OFF → 404 with the precise code MATCHING_FREETEXT_DISABLED (the route is
 * effectively absent for the caller). Subclasses NotFoundError so the errorHandler maps it to 404,
 * but carries its own stable code instead of the generic NOT_FOUND.
 */
class FreeTextDisabledError extends NotFoundError {
  constructor() {
    super("Free-text matching");
    this.code = "MATCHING_FREETEXT_DISABLED";
    this.message = "Free-text matching is disabled";
  }
}

/** Injectable seams (DI) so the integration suite can stub the destructive backfill + the embedder. */
export interface SemanticMatchingDeps {
  /** Defaults to the real backfill (Voyage). Tests inject a no-op stub → non-destructive. */
  backfill: (embedder?: Embedder) => Promise<BackfillSummary>;
  /** Builds the request-time embedder for free-text. Defaults to the real (Voyage) embedder. */
  makeEmbedder: () => Embedder;
}
export const defaultDeps: SemanticMatchingDeps = { backfill: runBackfill, makeEmbedder };

export const semanticMatchingService = {
  /** Caller's own person-profile → top-N ESCO occupations. */
  async myOccupations(a: ActorContext, q: MatchQuery) {
    return repo.knnOccupationsForUser(pool, a.userId, q.limit);
  },

  /**
   * Any user in the actor's scope → top-N occupations (admin/manager surface). 404 outside scope.
   * Who may read a peer is decided by `canReadOrgTarget` and by nothing else (Z-203): self (I17),
   * HR mandate (I20), managerial role OR org-unit manager + org sub-tree (I18), same tenant (I5).
   * 404 (not 403) avoids an enumeration oracle. The ESS self path stays /me/occupations.
   */
  async userOccupations(a: ActorContext, userId: string, q: MatchQuery) {
    const tenant = await repo.findUserTenant(pool, userId);
    if (tenant === null) throw new NotFoundError("User");
    if (!isPlatform(a) && (a.tenantId === null || tenant !== a.tenantId)) throw new NotFoundError("User");
    if (!(await canReadOrgTarget(pool, a, userId, tenant))) throw new NotFoundError("User");
    return repo.knnOccupationsForUser(pool, userId, q.limit);
  },

  /** A skill → top-N similar skills (catalog dedup/discovery), tenant-scoped (I5). */
  async similarSkills(a: ActorContext, skillId: string, q: MatchQuery) {
    const tenantId = isPlatform(a) ? undefined : (a.tenantId ?? ZERO_UUID);
    const items = await repo.knnSimilarSkills(pool, skillId, tenantId, q.limit);
    return { items, total: items.length };
  },

  /**
   * Caller's own person-profile → top-N best-matching POSITIONS (AI ②·Fase 3, "option C").
   * Tenant-scoped (I5): a non-platform actor only sees positions in its own tenant; a no-tenant
   * non-platform actor matches no real tenant (ZERO_UUID). PLATFORM_ADMIN sees all positions.
   */
  async myPositions(a: ActorContext, q: MatchQuery) {
    const tenantId = isPlatform(a) ? undefined : (a.tenantId ?? ZERO_UUID);
    return repo.knnPositionsForUser(pool, a.userId, tenantId, q.limit);
  },

  /**
   * Any user in the actor's scope → top-N position matches (admin/manager surface). 404 outside scope.
   * Same gating as userOccupations: `canReadOrgTarget` is the only authority on peer access, and a
   * cross-tenant or out-of-scope target is a 404 (no enumeration oracle). Positions are scoped to the
   * TARGET user's tenant (I5), so a manager sees the peer's matches within that tenant.
   */
  async userPositions(a: ActorContext, userId: string, q: MatchQuery) {
    const tenant = await repo.findUserTenant(pool, userId);
    if (tenant === null) throw new NotFoundError("User");
    if (!isPlatform(a) && (a.tenantId === null || tenant !== a.tenantId)) throw new NotFoundError("User");
    if (!(await canReadOrgTarget(pool, a, userId, tenant))) throw new NotFoundError("User");
    const tenantId = isPlatform(a) ? undefined : tenant;
    return repo.knnPositionsForUser(pool, userId, tenantId, q.limit);
  },

  // ── AI ②·Fase 2 ──────────────────────────────────────────────────────────

  /** Caller's own person-profile → top-N best-matching JOB_ROLES (ESS self). Tenant-scoped (I5). */
  async myJobRoles(a: ActorContext, q: MatchQuery) {
    const tenantId = isPlatform(a) ? undefined : (a.tenantId ?? ZERO_UUID);
    return repo.knnJobRolesForUser(pool, a.userId, tenantId, q.limit);
  },

  /**
   * Any user in the actor's scope → top-N job-role matches (admin/manager surface). 404 outside scope.
   * Same gating as occupations/positions: `canReadOrgTarget` decides peer access; a cross-tenant or
   * out-of-scope target is a 404 (no enumeration oracle). Roles scoped to the TARGET user's tenant (I5).
   */
  async userJobRoles(a: ActorContext, userId: string, q: MatchQuery) {
    const tenant = await repo.findUserTenant(pool, userId);
    if (tenant === null) throw new NotFoundError("User");
    if (!isPlatform(a) && (a.tenantId === null || tenant !== a.tenantId)) throw new NotFoundError("User");
    if (!(await canReadOrgTarget(pool, a, userId, tenant))) throw new NotFoundError("User");
    const tenantId = isPlatform(a) ? undefined : tenant;
    return repo.knnJobRolesForUser(pool, userId, tenantId, q.limit);
  },

  /**
   * Person ↔ person: top-N users most similar to `userId`'s profile (manager/admin discovery tool).
   * ELEVATED-ROLE ONLY — a plain USER/TEAM_MEMBER/READ_ONLY is FORBIDDEN (403, not self-only): browsing
   * "people similar to me" is a leadership tool, not an ESS self surface. The target user must be in the
   * actor's scope (cross-tenant → 404). Results are self-excluded + tenant-scoped (I5).
   */
  async similarPeople(a: ActorContext, userId: string, q: MatchQuery) {
    if (!canBrowsePeers(a)) throw new ForbiddenError("Browsing similar people requires an elevated role", "PERMISSION_DENIED");
    const tenant = await repo.findUserTenant(pool, userId);
    if (tenant === null) throw new NotFoundError("User");
    if (!isPlatform(a) && (a.tenantId === null || tenant !== a.tenantId)) throw new NotFoundError("User");
    if (!(await canReadOrgTarget(pool, a, userId, tenant))) throw new NotFoundError("User");
    const tenantId = isPlatform(a) ? undefined : tenant;
    const items = await repo.knnSimilarUsers(pool, userId, tenantId, q.limit);
    return { items, total: items.length };
  },

  /**
   * Free-text search (behind MATCHING_FREETEXT_ENABLED, default OFF). When OFF → 404
   * MATCHING_FREETEXT_DISABLED (the route does not exist for the caller). When ON, the query is
   * embedded AT REQUEST TIME via the injectable Embedder seam (Voyage in prod, Fake in tests),
   * then kNN over occupations (global) + skills (tenant-scoped I5). matching:read.
   */
  async freeTextSearch(a: ActorContext, q: FreeTextQuery, deps: SemanticMatchingDeps = defaultDeps) {
    if (!env.MATCHING_FREETEXT_ENABLED) {
      throw new FreeTextDisabledError();
    }
    const embedder = deps.makeEmbedder();
    const [vec] = await embedder.embed([q.q], "query");
    if (!vec) throw new FreeTextDisabledError();
    const skillTenant = isPlatform(a) ? undefined : (a.tenantId ?? ZERO_UUID);
    const [occupations, skills] = await Promise.all([
      repo.knnOccupationsByVector(pool, vec, q.limit),
      repo.knnSkillsByVector(pool, vec, skillTenant, q.limit),
    ]);
    return { occupations, skills };
  },

  /**
   * POST /v1/matching/reindex (matching:admin) — trigger the embedding backfill. The backfill is
   * hash-skip idempotent so a real Voyage re-run on populated tables is a cheap no-op (no destructive
   * overwrite). `deps.backfill` is injected so the integration suite stubs it to a no-op summary,
   * NEVER touching the real embedding tables. Returns the per-corpus counts.
   */
  async reindex(_a: ActorContext, deps: SemanticMatchingDeps = defaultDeps) {
    const summary = await deps.backfill();
    return { accepted: true, ...summary };
  },
};
