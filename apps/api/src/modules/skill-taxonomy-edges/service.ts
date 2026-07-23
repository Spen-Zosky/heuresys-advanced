/**
 * apps/api/src/modules/skill-taxonomy-edges/service.ts
 * Read open (filtered by visibility on both endpoints).
 * Mutations PLATFORM_ADMIN-only.
 * Edges are immutable — no update endpoint.
 */

import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ConflictError, ForbiddenError, ValidationError } from "../../errors/index.js";
import type {
  SkillTaxonomyEdge,
  SkillTaxonomyEdgeListQuery,
  CreateSkillTaxonomyEdgeBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

function ensurePlatformAdmin(actor: ActorContext): void {
  if (!isPlatform(actor)) {
    throw new ForbiddenError(
      "Only PLATFORM_ADMIN may manage skill taxonomy edges",
      "SKILL_TAXONOMY_ADMIN_ONLY",
    );
  }
}

function tenantFilterFor(actor: ActorContext): string | undefined {
  return isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
}

export const skillTaxonomyEdgesService = {
  async list(actor: ActorContext, query: SkillTaxonomyEdgeListQuery) {
    return repo.listEdges(pool, { tenantId: tenantFilterFor(actor), query });
  },

  async getById(actor: ActorContext, id: string): Promise<SkillTaxonomyEdge> {
    const target = await repo.findEdgeById(pool, id, tenantFilterFor(actor));
    if (!target) throw new NotFoundError("SkillTaxonomyEdge");
    return target;
  },

  async create(actor: ActorContext, body: CreateSkillTaxonomyEdgeBody): Promise<SkillTaxonomyEdge> {
    ensurePlatformAdmin(actor);
    if (body.parentSkillId === body.childSkillId) {
      throw new ValidationError(
        { parentSkillId: body.parentSkillId, childSkillId: body.childSkillId },
        "Skill taxonomy edge cannot be a self-loop",
      );
    }
    if (!(await repo.skillExists(pool, body.parentSkillId))) {
      throw new NotFoundError("Skill");
    }
    if (!(await repo.skillExists(pool, body.childSkillId))) {
      throw new NotFoundError("Skill");
    }
    const kind = body.kind ?? "IS_A";
    const dup = await repo.findEdgeByPairKind(pool, body.parentSkillId, body.childSkillId, kind);
    if (dup) {
      throw new ConflictError(
        `Edge ${body.parentSkillId} → ${body.childSkillId} (${kind}) already exists`,
        "SKILL_TAXONOMY_EDGE_CONFLICT",
      );
    }
    // #62 G3 — the self-loop guard above only blocked 1-cycles; longer cycles
    // (A→B→…→A) were creatable and would break every downward taxonomy walk.
    if (await repo.wouldCreateCycle(pool, body.parentSkillId, body.childSkillId, kind)) {
      throw new ConflictError(
        `Edge ${body.parentSkillId} → ${body.childSkillId} (${kind}) would create a cycle`,
        "SKILL_TAXONOMY_EDGE_CYCLE",
      );
    }
    return repo.insertEdge(pool, body);
  },

  async delete(actor: ActorContext, id: string): Promise<void> {
    ensurePlatformAdmin(actor);
    const target = await repo.findEdgeById(pool, id, undefined); // PLATFORM_ADMIN sees all
    if (!target) throw new NotFoundError("SkillTaxonomyEdge");
    const ok = await repo.deleteEdge(pool, id);
    if (!ok) throw new NotFoundError("SkillTaxonomyEdge");
  },
};
