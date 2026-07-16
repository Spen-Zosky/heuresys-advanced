/**
 * apps/api/src/modules/evidence/service.ts — #27 (S1018) evidence layer.
 *
 * SENSITIVE (EVALUATION/SKILL): reads of another user's evidence are gated by
 * the organizational axis (canReadOrgTarget → 404 no-leak, peer isolation I19).
 * Self reads (/v1/me/evidence) are I17-floored. Private continuous feedback is
 * included only for tenant-wide readers (HR mandate / platform), never for
 * subtree managers or the subject themselves.
 */
import { pool } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";
import { NotFoundError } from "../../errors/index.js";
import type {
  EvidenceKind, EvidenceScoreType, EvidenceForScoreResponse,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { resolveOrgReadScope, canReadOrgTarget } from "../../lib/scope/resolver.js";

function parseKinds(types?: string): EvidenceKind[] {
  if (!types) return [];
  return types.split(",").map((s) => s.trim()).filter(Boolean) as EvidenceKind[];
}

async function includePrivateFor(a: ActorContext): Promise<boolean> {
  const scope = await resolveOrgReadScope(pool, a);
  return scope.kind === "all" || scope.kind === "tenant";
}

export const evidenceService = {
  /** Per-subject evidence — org-gated; 404 across the boundary (I19). */
  async listForSubject(a: ActorContext, subjectUserId: string, types: string | undefined, limit: number, offset: number) {
    const subjTenant = await repo.userTenant(pool, subjectUserId);
    if (!subjTenant || !(await canReadOrgTarget(pool, a, subjectUserId, subjTenant))) {
      throw new NotFoundError("Evidence");
    }
    return repo.listEvidenceForSubject(pool, subjectUserId, parseKinds(types), await includePrivateFor(a), limit, offset);
  },

  /** Self view (I17) — own evidence; private feedback excluded (safe default). */
  async listForSelf(a: ActorContext, types: string | undefined, limit: number, offset: number) {
    return repo.listEvidenceForSubject(pool, a.userId, parseKinds(types), false, limit, offset);
  },

  /** "Why this score" — resolve the score, org-gate its subject, return the explaining evidence. */
  async forScore(a: ActorContext, scoreType: EvidenceScoreType, scoreId: string): Promise<EvidenceForScoreResponse> {
    const score = await repo.resolveScore(pool, scoreType, scoreId);
    if (!score) throw new NotFoundError("Score");
    if (!(await canReadOrgTarget(pool, a, score.subjectUserId, score.tenantId))) {
      throw new NotFoundError("Score");
    }
    const kinds = repo.SCORE_EVIDENCE_KINDS[scoreType];
    const { items } = await repo.listEvidenceForSubject(
      pool, score.subjectUserId, kinds, await includePrivateFor(a), 200, 0);
    return {
      score: {
        type: scoreType, id: scoreId, subjectUserId: score.subjectUserId,
        value: score.value, band: score.band, modelVersion: score.modelVersion,
        derivation: score.derivation, computedAt: score.computedAt,
      },
      items,
    };
  },
};
