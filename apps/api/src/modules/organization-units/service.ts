/**
 * apps/api/src/modules/organization-units/service.ts
 * CRUD service for org units. Tenant-scoped; PLATFORM_ADMIN cross-tenant.
 */

import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ConflictError, ForbiddenError } from "../../errors/index.js";
import type {
  OrganizationUnit,
  OrganizationUnitListQuery,
  CreateOrganizationUnitBody,
  UpdateOrganizationUnitBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

function requireOwnTenant(a: ActorContext): string {
  if (!a.tenantId) throw new ForbiddenError("Tenant context required");
  return a.tenantId;
}
async function ensureSameTenant(a: ActorContext, target: OrganizationUnit): Promise<void> {
  if (isPlatform(a)) return;
  if (!a.tenantId || target.tenantId !== a.tenantId) throw new NotFoundError("OrganizationUnit");
}

export const organizationUnitsService = {
  async list(actor: ActorContext, query: OrganizationUnitListQuery) {
    const tenantId = isPlatform(actor) ? undefined : requireOwnTenant(actor);
    return repo.listOus(pool, { tenantId, query });
  },

  async getById(actor: ActorContext, id: string): Promise<OrganizationUnit> {
    const target = await repo.findOuById(pool, id);
    if (!target) throw new NotFoundError("OrganizationUnit");
    await ensureSameTenant(actor, target);
    return target;
  },

  async create(actor: ActorContext, body: CreateOrganizationUnitBody): Promise<OrganizationUnit> {
    let tenantId: string;
    if (isPlatform(actor)) {
      tenantId = body.tenantId ?? actor.tenantId ?? "";
      if (!tenantId) throw new ForbiddenError("PLATFORM_ADMIN must supply body.tenantId", "TENANT_ID_REQUIRED");
    } else {
      tenantId = requireOwnTenant(actor);
    }
    const dup = await repo.findOuByCodeInTenant(pool, tenantId, body.code);
    if (dup) {
      throw new ConflictError(
        `Organization unit code '${body.code}' already in use in this tenant`,
        "OU_CODE_CONFLICT",
      );
    }
    return repo.insertOu(pool, tenantId, body, actor.userId);
  },

  async update(actor: ActorContext, id: string, patch: UpdateOrganizationUnitBody): Promise<OrganizationUnit> {
    const target = await repo.findOuById(pool, id);
    if (!target) throw new NotFoundError("OrganizationUnit");
    await ensureSameTenant(actor, target);
    if (patch.parentId) {
      const cycle = await repo.parentWouldCreateCycle(pool, id, patch.parentId);
      if (cycle) {
        throw new ConflictError(
          "An organization unit cannot be moved under itself or one of its descendants",
          "OU_PARENT_CYCLE",
        );
      }
    }
    const updated = await repo.updateOuPartial(pool, id, patch, actor.userId);
    if (!updated) throw new NotFoundError("OrganizationUnit");
    return updated;
  },

  async softDelete(actor: ActorContext, id: string): Promise<void> {
    const target = await repo.findOuById(pool, id);
    if (!target) throw new NotFoundError("OrganizationUnit");
    await ensureSameTenant(actor, target);
    const ok = await repo.softDeleteOu(pool, id);
    if (!ok) throw new ConflictError("Organization unit already inactive", "OU_ALREADY_INACTIVE");
  },
};
