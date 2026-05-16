/**
 * apps/api/src/modules/kpi-definitions/service.ts
 * Mirrors skills service: global vs tenant visibility, PLATFORM_ADMIN
 * editable on globals only, code uniqueness per scope.
 */

import { pool } from "../../db/client.js";
import { NotFoundError, ConflictError, ForbiddenError } from "../../errors/index.js";
import type { RoleCode } from "../../config/constants.js";
import type {
  KpiDefinition,
  KpiDefinitionListQuery,
  CreateKpiDefinitionBody,
  UpdateKpiDefinitionBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

export interface ActorContext {
  userId: string;
  tenantId: string | null;
  roles: RoleCode[];
}

function isPlatform(a: ActorContext): boolean {
  return a.roles.includes("PLATFORM_ADMIN");
}
function visible(actor: ActorContext, k: KpiDefinition): boolean {
  if (k.isGlobal) return true;
  if (isPlatform(actor)) return true;
  return actor.tenantId !== null && k.tenantId === actor.tenantId;
}

export const kpiDefinitionsService = {
  async list(actor: ActorContext, query: KpiDefinitionListQuery) {
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    return repo.listKpiDefinitions(pool, { tenantId, query });
  },

  async getById(actor: ActorContext, id: string): Promise<KpiDefinition> {
    const target = await repo.findKpiById(pool, id);
    if (!target) throw new NotFoundError("KpiDefinition");
    if (!visible(actor, target)) throw new NotFoundError("KpiDefinition");
    return target;
  },

  async create(actor: ActorContext, body: CreateKpiDefinitionBody): Promise<KpiDefinition> {
    let tenantId: string | null;
    let isGlobal = body.isGlobal;
    if (isPlatform(actor)) {
      if (isGlobal) {
        tenantId = null;
      } else {
        tenantId = body.tenantId ?? actor.tenantId ?? null;
        if (!tenantId) {
          throw new ForbiddenError(
            "PLATFORM_ADMIN must supply body.tenantId for non-global definitions",
            "TENANT_ID_REQUIRED",
          );
        }
      }
    } else {
      if (!actor.tenantId) throw new ForbiddenError("Tenant context required");
      tenantId = actor.tenantId;
      isGlobal = false;
    }
    const dup = await repo.findKpiByCodeInScope(pool, tenantId, body.code);
    if (dup) {
      throw new ConflictError(
        `KPI definition code '${body.code}' already exists in this scope`,
        "KPI_CODE_CONFLICT",
      );
    }
    return repo.insertKpi(pool, tenantId, { ...body, isGlobal }, actor.userId);
  },

  async update(actor: ActorContext, id: string, patch: UpdateKpiDefinitionBody): Promise<KpiDefinition> {
    const target = await repo.findKpiById(pool, id);
    if (!target) throw new NotFoundError("KpiDefinition");
    if (target.isGlobal && !isPlatform(actor)) {
      throw new ForbiddenError(
        "Only PLATFORM_ADMIN may edit global KPI definitions",
        "GLOBAL_KPI_EDIT_FORBIDDEN",
      );
    }
    if (!target.isGlobal && !isPlatform(actor)) {
      if (!actor.tenantId || target.tenantId !== actor.tenantId) {
        throw new NotFoundError("KpiDefinition");
      }
    }
    const updated = await repo.updateKpiPartial(pool, id, patch, actor.userId);
    if (!updated) throw new NotFoundError("KpiDefinition");
    return updated;
  },

  async delete(actor: ActorContext, id: string): Promise<void> {
    const target = await repo.findKpiById(pool, id);
    if (!target) throw new NotFoundError("KpiDefinition");
    if (target.isGlobal && !isPlatform(actor)) {
      throw new ForbiddenError(
        "Only PLATFORM_ADMIN may delete global KPI definitions",
        "GLOBAL_KPI_DELETE_FORBIDDEN",
      );
    }
    if (!target.isGlobal && !isPlatform(actor)) {
      if (!actor.tenantId || target.tenantId !== actor.tenantId) {
        throw new NotFoundError("KpiDefinition");
      }
    }
    const ok = await repo.deleteKpi(pool, id);
    if (!ok) throw new NotFoundError("KpiDefinition");
  },
};
