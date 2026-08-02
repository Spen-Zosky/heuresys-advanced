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

/**
 * The parent must belong to the SAME tenant as the unit being written (#87).
 *
 * The FK only guarantees the parent row exists — it says nothing about tenancy, so a
 * `parentId` from another tenant was accepted by both create and update, grafting one
 * tenant's tree onto another's. Isolation here is application-enforced (I5: FK + filter,
 * never RLS), so the check belongs in the service.
 *
 * The comparison is against `ownerTenantId` — the tenant of the unit itself, not of the
 * actor — so it still holds for a PLATFORM_ADMIN acting on a third tenant.
 *
 * Two shapes of the same refusal, on purpose: a tenant-scoped actor gets 404, identical to
 * the answer for a parent that does not exist, because a unit outside their tenant must not
 * become observable through an error code. A PLATFORM_ADMIN already sees across tenants, so
 * masking would cost diagnosis and hide nothing — they get an explicit 409.
 */
async function ensureParentInTenant(a: ActorContext, parentId: string, ownerTenantId: string): Promise<void> {
  const parent = await repo.findOuById(pool, parentId);
  if (parent && parent.tenantId === ownerTenantId) return;
  if (parent && isPlatform(a)) {
    throw new ConflictError(
      "The parent organization unit belongs to a different tenant",
      "OU_PARENT_TENANT_MISMATCH",
    );
  }
  throw new NotFoundError("Organization unit parent", "OU_PARENT_NOT_FOUND");
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
    if (body.parentId) await ensureParentInTenant(actor, body.parentId, tenantId);
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
      await ensureParentInTenant(actor, patch.parentId, target.tenantId);
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
