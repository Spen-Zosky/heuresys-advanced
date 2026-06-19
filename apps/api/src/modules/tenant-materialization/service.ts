/**
 * apps/api/src/modules/tenant-materialization/service.ts
 * #4 WI-C — generate org-units + positions for a target tenant from a deterministic archetype.
 * PLATFORM_ADMIN-only (service-gate, like job-families — no granular permission in the seed; the
 * service user that drives this is a tenant-null PLATFORM_ADMIN). M-1 tenant isolation: the
 * tenantId comes from the INPUT (not the JWT), so it MUST be validated as existing + ACTIVE and
 * every write tagged with it (enforced in the repository, I5).
 */
import { pool, withTransaction } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import type { MaterializeRequestBody, MaterializeResult, ArchetypeListResponse } from "@heuresys/shared";
import { getArchetype, listArchetypes, archetypeUsers } from "./blueprints.js";
import * as repo from "./repository.js";

function ensurePlatformAdmin(actor: ActorContext): void {
  if (!actor.roles.includes("PLATFORM_ADMIN")) {
    throw new ForbiddenError("Only PLATFORM_ADMIN may materialize tenants", "TENANT_MATERIALIZE_ADMIN_ONLY");
  }
}

export const tenantMaterializationService = {
  listArchetypes(_actor: ActorContext): ArchetypeListResponse {
    return {
      items: listArchetypes().map((a) => ({
        key: a.key,
        label: a.label,
        orgUnitCount: a.orgUnits.length,
        positionCount: a.positions.length,
      })),
    };
  },

  async materialize(actor: ActorContext, body: MaterializeRequestBody): Promise<MaterializeResult> {
    ensurePlatformAdmin(actor);
    const archetype = getArchetype(body.archetypeKey);
    if (!archetype) throw new NotFoundError("Archetype");

    // M-1: the target tenant must exist and be ACTIVE (input-supplied tenant, not the JWT's).
    const status = await repo.findTenantStatus(pool, body.tenantId);
    if (status === null) throw new NotFoundError("Tenant");
    if (status !== "ACTIVE") {
      throw new ForbiddenError(`Tenant is not ACTIVE (status=${status})`, "TENANT_NOT_ACTIVE");
    }

    const userCount = archetypeUsers(archetype).length; // one PRIMARY ACTIVE assignment per synthetic incumbent
    const total = {
      orgUnits: archetype.orgUnits.length,
      positions: archetype.positions.length,
      users: userCount,
      assignments: userCount,
    };
    const created = await withTransaction((client) => repo.materialize(client, body.tenantId, archetype, body.mode));
    const skipped = {
      orgUnits: total.orgUnits - created.orgUnits,
      positions: total.positions - created.positions,
      users: total.users - created.users,
      assignments: total.assignments - created.assignments,
    };
    return { tenantId: body.tenantId, archetypeKey: archetype.key, mode: body.mode, created, skipped, total };
  },
};
