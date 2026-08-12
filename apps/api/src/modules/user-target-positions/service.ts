/**
 * apps/api/src/modules/user-target-positions/service.ts
 *
 * Tenant-scoped. Lettura filtrata sull'asse organizzativo (ADR-0027 F3), come
 * per i piani di carriera: l'obiettivo di carriera è un dato personale, quindi
 * si vede solo di sé stessi o della propria catena organizzativa.
 *
 * Validazione FK:
 *   - userId: deve esistere ed essere del tenant → 403 USER_NOT_IN_TENANT
 *   - positionId: deve esistere ed essere dello stesso tenant → 403 POSITION_NOT_IN_TENANT
 */

import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";
import { masksUnderPlatformMandate, maskFields } from "../../lib/scope/mask.js";

export type { ActorContext };
import { NotFoundError, ForbiddenError, ConflictError } from "../../errors/index.js";
import type {
  UserTargetPosition,
  UserTargetPositionListQuery,
  CreateUserTargetPositionBody,
  UpdateUserTargetPositionBody,
  ReviewUserTargetPositionBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { resolveOrgReadScope, canReadOrgTarget } from "../../lib/scope/resolver.js";

async function validateFks(
  body: { userId: string; positionId: string },
  tenantId: string,
): Promise<void> {
  const u = await repo.getUserTenant(pool, body.userId);
  if (!u) throw new NotFoundError("User");
  if (u.tenantId !== tenantId) {
    throw new ForbiddenError(
      "Target subject user does not belong to the resolved tenant",
      "USER_NOT_IN_TENANT",
    );
  }
  const p = await repo.positionInTenant(pool, body.positionId, tenantId);
  if (!p.exists) throw new NotFoundError("Position");
  if (!p.sameTenant) {
    throw new ForbiddenError(
      "Target position does not belong to the resolved tenant",
      "POSITION_NOT_IN_TENANT",
    );
  }
}

export const userTargetPositionsService = {
  async list(actor: ActorContext, query: UserTargetPositionListQuery) {
    const scope = await resolveOrgReadScope(pool, actor);
    const tenantId = scope.kind === "all" ? undefined : scope.tenantId;
    const userIdAllowList =
      scope.kind === "subtree" || scope.kind === "self" ? scope.userIdAllowList : undefined;
    const page = await repo.listTargets(pool, { tenantId, userIdAllowList, query });
    // #124 (S1055) — `reviewNotes` e' il testo che un revisore scrive SU una
    // persona a proposito del suo obiettivo di carriera: giudizio, classe
    // EVALUATION. L'obiettivo in se' (quale posizione, con che stato) resta
    // visibile: si nega il commento, non l'aspirazione.
    return {
      ...page,
      items: page.items.map((r) =>
        masksUnderPlatformMandate(actor, "EVALUATION", r.userId)
          ? maskFields(r, ["reviewNotes"])
          : r,
      ),
    };
  },

  async getById(actor: ActorContext, id: string): Promise<UserTargetPosition> {
    const target = await repo.findTargetById(pool, id);
    if (!target) throw new NotFoundError("UserTargetPosition");
    // 404 e non 403: negare l'esistenza evita di enumerare le persone
    if (!(await canReadOrgTarget(pool, actor, target.userId, target.tenantId))) {
      throw new NotFoundError("UserTargetPosition");
    }
    return masksUnderPlatformMandate(actor, "EVALUATION", target.userId)
      ? maskFields(target, ["reviewNotes"])
      : target;
  },

  async create(actor: ActorContext, body: CreateUserTargetPositionBody): Promise<UserTargetPosition> {
    let tenantId: string;
    if (isPlatform(actor)) {
      const candidate = body.tenantId ?? actor.tenantId;
      if (!candidate) {
        throw new ForbiddenError(
          "PLATFORM_ADMIN must supply body.tenantId for user target positions",
          "TENANT_ID_REQUIRED",
        );
      }
      tenantId = candidate;
    } else {
      if (!actor.tenantId) throw new ForbiddenError("Tenant context required");
      tenantId = actor.tenantId;
    }
    await validateFks(body, tenantId);
    return repo.insertTarget(pool, tenantId, body, actor.userId);
  },

  async update(
    actor: ActorContext,
    id: string,
    patch: UpdateUserTargetPositionBody,
  ): Promise<UserTargetPosition> {
    const target = await repo.findTargetById(pool, id);
    if (!target) throw new NotFoundError("UserTargetPosition");
    if (!isPlatform(actor)) {
      if (!actor.tenantId || target.tenantId !== actor.tenantId) {
        throw new NotFoundError("UserTargetPosition");
      }
    }
    if (patch.positionId !== undefined) {
      const p = await repo.positionInTenant(pool, patch.positionId, target.tenantId);
      if (!p.exists) throw new NotFoundError("Position");
      if (!p.sameTenant) {
        throw new ForbiddenError(
          "Target position does not belong to the target's tenant",
          "POSITION_NOT_IN_TENANT",
        );
      }
    }
    const updated = await repo.updateTargetPartial(pool, id, patch, actor.userId);
    if (!updated) throw new NotFoundError("UserTargetPosition");
    return updated;
  },

  /**
   * La revisione dell'obiettivo. Il revisore è l'attore, mai un id passato dal
   * chiamante: chi approva è chi sta compiendo l'azione.
   * Nessuno rivede il proprio obiettivo, e un obiettivo ritirato non si rivede.
   */
  async review(
    actor: ActorContext,
    id: string,
    body: ReviewUserTargetPositionBody,
  ): Promise<UserTargetPosition> {
    const target = await repo.findTargetById(pool, id);
    if (!target) throw new NotFoundError("UserTargetPosition");
    if (!isPlatform(actor)) {
      if (!actor.tenantId || target.tenantId !== actor.tenantId) {
        throw new NotFoundError("UserTargetPosition");
      }
    }
    if (target.userId === actor.userId) {
      throw new ForbiddenError(
        "A career target cannot be reviewed by its own subject",
        "SELF_REVIEW_FORBIDDEN",
      );
    }
    if (target.reviewStatus === "WITHDRAWN") {
      throw new ConflictError(
        "A withdrawn career target cannot be reviewed",
        "TARGET_WITHDRAWN",
      );
    }
    const reviewed = await repo.reviewTarget(
      pool, id, body.decision, body.notes ?? null, actor.userId,
    );
    if (!reviewed) throw new NotFoundError("UserTargetPosition");
    return reviewed;
  },

  async delete(actor: ActorContext, id: string): Promise<void> {
    const target = await repo.findTargetById(pool, id);
    if (!target) throw new NotFoundError("UserTargetPosition");
    if (!isPlatform(actor)) {
      if (!actor.tenantId || target.tenantId !== actor.tenantId) {
        throw new NotFoundError("UserTargetPosition");
      }
    }
    const ok = await repo.deleteTarget(pool, id);
    if (!ok) throw new NotFoundError("UserTargetPosition");
  },
};
