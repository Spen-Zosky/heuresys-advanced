/**
 * apps/api/src/modules/tenants/service.ts
 * Business logic for the tenants module. Enforces scope filters per AUTH §6
 * matrix: PLATFORM_ADMIN operates cross-tenant; all other authenticated
 * roles see/operate only on their own tenant.
 *
 * Per API_IMPLEMENTATION_PLAN §6.2.
 */

import { pool } from "../../db/client.js";
import { NotFoundError, ConflictError, ForbiddenError } from "../../errors/index.js";
import type { RoleCode } from "../../config/constants.js";
import type {
  Tenant,
  TenantListQuery,
  TenantListResponse,
  CreateTenantBody,
  UpdateTenantBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

export interface ActorContext {
  userId: string;
  tenantId: string | null;
  roles: RoleCode[];
}

function isPlatformAdmin(actor: ActorContext): boolean {
  return actor.roles.includes("PLATFORM_ADMIN");
}

/**
 * For non-platform actors a tenantId is required to enforce ownership; if
 * the JWT carries no tenantId the operation is rejected (the tenantContext
 * middleware should have caught this already, but we double-check here).
 */
function requireOwnTenant(actor: ActorContext): string {
  if (!actor.tenantId) {
    throw new ForbiddenError("Tenant context required");
  }
  return actor.tenantId;
}

export const tenantsService = {
  async list(actor: ActorContext, query: TenantListQuery): Promise<TenantListResponse> {
    const ownTenantOnly = isPlatformAdmin(actor) ? undefined : requireOwnTenant(actor);
    return repo.listTenants(pool, { ownTenantOnly, query });
  },

  async getById(actor: ActorContext, id: string): Promise<Tenant> {
    if (!isPlatformAdmin(actor) && requireOwnTenant(actor) !== id) {
      // 404 (not 403) to avoid tenant-existence enumeration (AUTH §7.3 /
      // TenantBoundaryViolation envelope).
      throw new NotFoundError("Tenant");
    }
    const tenant = await repo.findTenantById(pool, id);
    if (!tenant) throw new NotFoundError("Tenant");
    return tenant;
  },

  async create(_actor: ActorContext, body: CreateTenantBody): Promise<Tenant> {
    // Route preHandler gates on tenant:create permission (PLATFORM_ADMIN only
    // per matrix). Still defensive: check code uniqueness for a clean 409
    // instead of a Postgres unique-violation surfacing as 500.
    const existing = await repo.findTenantByCode(pool, body.tenantCode);
    if (existing) {
      throw new ConflictError(
        `Tenant code '${body.tenantCode}' already in use`,
        "TENANT_CODE_CONFLICT",
      );
    }
    return repo.insertTenant(pool, body);
  },

  async update(actor: ActorContext, id: string, patch: UpdateTenantBody): Promise<Tenant> {
    if (!isPlatformAdmin(actor) && requireOwnTenant(actor) !== id) {
      throw new NotFoundError("Tenant");
    }
    const updated = await repo.updateTenantPartial(pool, id, patch);
    if (!updated) throw new NotFoundError("Tenant");
    return updated;
  },

  async archive(_actor: ActorContext, id: string): Promise<void> {
    // Route preHandler gates on tenant:delete permission (PLATFORM_ADMIN only).
    // Existence + already-archived state both throw NotFoundError → 404 on
    // either case keeps the semantic simple for the client (the row is no
    // longer "deletable").
    const existing = await repo.findTenantById(pool, id);
    if (!existing) throw new NotFoundError("Tenant");
    const archived = await repo.archiveTenant(pool, id);
    if (!archived) {
      throw new ConflictError(
        "Tenant is already archived",
        "TENANT_ALREADY_ARCHIVED",
      );
    }
  },
};

export type TenantsService = typeof tenantsService;
