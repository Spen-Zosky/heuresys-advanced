/**
 * apps/api/src/modules/kpi-definitions/service.ts
 * Mirrors skills service: global vs tenant visibility, PLATFORM_ADMIN
 * editable on globals only, code uniqueness per scope.
 */

import { pool, withTransaction } from "../../db/client.js";
import { deleteInboxNotificationsForResource } from "../../lib/notifications/cleanup.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";
import { localize, localizeOne } from "../../lib/i18n/localize.js";
import type { Locale } from "../../middleware/locale.js";

export type { ActorContext };

// i18n overlay: swap name/description to the requested locale (fallback = IT in-row).
const KPI_DEF_I18N = {
  name: (k: KpiDefinition, t: string) => { k.name = t; },
  description: (k: KpiDefinition, t: string) => { k.description = t; },
};
import { NotFoundError, ConflictError, ForbiddenError } from "../../errors/index.js";
import type {
  KpiDefinition,
  KpiDefinitionListQuery,
  CreateKpiDefinitionBody,
  UpdateKpiDefinitionBody,
  KpiMeasurementListQuery,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { resolveOrgReadScope } from "../../lib/scope/resolver.js";

function visible(actor: ActorContext, k: KpiDefinition): boolean {
  if (k.isGlobal) return true;
  if (isPlatform(actor)) return true;
  return actor.tenantId !== null && k.tenantId === actor.tenantId;
}

export const kpiDefinitionsService = {
  async list(actor: ActorContext, query: KpiDefinitionListQuery, locale: Locale = "it") {
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    const res = await repo.listKpiDefinitions(pool, { tenantId, query });
    await localize(pool, locale, "sys_kpi_definitions", res.items, (k) => k.kpiDefinitionId, KPI_DEF_I18N);
    return res;
  },

  async getById(actor: ActorContext, id: string, locale: Locale = "it"): Promise<KpiDefinition> {
    const target = await repo.findKpiById(pool, id);
    if (!target) throw new NotFoundError("KpiDefinition");
    if (!visible(actor, target)) throw new NotFoundError("KpiDefinition");
    await localizeOne(pool, locale, "sys_kpi_definitions", target, (k) => k.kpiDefinitionId, KPI_DEF_I18N);
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
    // D-54: hard delete → purge the polymorphic inbox notifications pointing at this
    // KPI IN the same transaction (no FK exists; see lib/notifications/cleanup.ts).
    const ok = await withTransaction(async (client) => {
      await deleteInboxNotificationsForResource(client, "KPI", id);
      return repo.deleteKpi(client, id);
    });
    if (!ok) throw new NotFoundError("KpiDefinition");
  },

  // ── #31 (S1018): KPI metrology reads ──
  async listMetrics(actor: ActorContext, kpiId: string) {
    await this.getById(actor, kpiId); // 404 across visibility boundaries (no leak)
    return repo.listMetricsByKpi(pool, kpiId);
  },
  /** Global catalog (no tenant column, 000015 §7) — readable by any kpi:read holder. */
  async listAssessmentMethods() {
    return repo.listAssessmentMethods(pool);
  },
  /** Global catalog (no tenant column, 000015 §8) — readable by any kpi:read holder. */
  async listWeightingRules() {
    return repo.listWeightingRules(pool);
  },
  /**
   * Measurements carry person-level rows (kpi = EVALUATION class): org axis applies —
   * subtree/self scopes see only allow-listed users' rows + NULL-user (org-level) rows.
   */
  async listMeasurements(actor: ActorContext, kpiId: string, query: KpiMeasurementListQuery) {
    await this.getById(actor, kpiId);
    const scope = await resolveOrgReadScope(pool, actor);
    const userIdAllowList =
      scope.kind === "subtree" || scope.kind === "self" ? scope.userIdAllowList : undefined;
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    return repo.listMeasurements(pool, kpiId, tenantId, query, userIdAllowList);
  },
};
