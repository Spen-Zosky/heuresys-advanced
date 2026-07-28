/**
 * apps/api/src/modules/organization-unit-history/service.ts
 *
 * Tenant-scoped. La storia dell'organigramma non è un dato personale: si legge
 * con il permesso di lettura delle unità organizzative, senza filtro sull'asse
 * organizzativo (chi può vedere l'organigramma può vederne la storia).
 *
 * Append-only: nessun aggiornamento, nessuna cancellazione. Un evento sbagliato
 * si corregge aggiungendo l'evento che lo rettifica.
 */

import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ForbiddenError, ValidationError } from "../../errors/index.js";
import type {
  OrganizationUnitHistory,
  OrganizationUnitHistoryListQuery,
  CreateOrganizationUnitHistoryBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

export const organizationUnitHistoryService = {
  async list(actor: ActorContext, query: OrganizationUnitHistoryListQuery) {
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId;
    if (!isPlatform(actor) && !tenantId) throw new ForbiddenError("Tenant context required");
    return repo.listHistory(pool, { tenantId: tenantId ?? undefined, query });
  },

  async getById(actor: ActorContext, id: string): Promise<OrganizationUnitHistory> {
    const row = await repo.findHistoryById(pool, id);
    if (!row) throw new NotFoundError("OrganizationUnitHistory");
    if (!isPlatform(actor)) {
      if (!actor.tenantId || row.tenantId !== actor.tenantId) {
        throw new NotFoundError("OrganizationUnitHistory");
      }
    }
    return row;
  },

  async create(
    actor: ActorContext,
    body: CreateOrganizationUnitHistoryBody,
  ): Promise<OrganizationUnitHistory> {
    let tenantId: string;
    if (isPlatform(actor)) {
      const candidate = body.tenantId ?? actor.tenantId;
      if (!candidate) {
        throw new ForbiddenError(
          "PLATFORM_ADMIN must supply body.tenantId for organization unit history",
          "TENANT_ID_REQUIRED",
        );
      }
      tenantId = candidate;
    } else {
      if (!actor.tenantId) throw new ForbiddenError("Tenant context required");
      tenantId = actor.tenantId;
    }

    const u = await repo.unitInTenant(pool, body.unitId, tenantId);
    if (!u.exists) throw new NotFoundError("OrganizationUnit");
    if (!u.sameTenant) {
      throw new ForbiddenError(
        "Organization unit does not belong to the resolved tenant",
        "UNIT_NOT_IN_TENANT",
      );
    }
    // un «cambiamento» in cui il prima è identico al dopo non è storia, è rumore
    if (JSON.stringify(body.oldValue) === JSON.stringify(body.newValue)) {
      throw new ValidationError(
        { field: "newValue", reason: "EMPTY_CHANGE" },
        "The recorded change must differ from the previous state",
      );
    }
    return repo.insertHistory(pool, tenantId, body, actor.userId);
  },
};
