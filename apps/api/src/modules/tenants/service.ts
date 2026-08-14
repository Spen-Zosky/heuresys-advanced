/**
 * apps/api/src/modules/tenants/service.ts
 * Business logic for the tenants module. Enforces scope filters per AUTH §6
 * matrix: PLATFORM_ADMIN operates cross-tenant; all other authenticated
 * roles see/operate only on their own tenant.
 *
 * Per API_IMPLEMENTATION_PLAN §6.2.
 */

import { pool } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
  ValidationError,
} from "../../errors/index.js";
import type {
  Tenant,
  TenantListQuery,
  TenantListResponse,
  CreateTenantBody,
  UpdateTenantBody,
  IndustryCode,
} from "@heuresys/shared";
import * as repo from "./repository.js";

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

/**
 * Il settore è NOT NULL + FK verso `sys.sys_industry_codes` dalla mig 000305 (I21).
 * Lo schema Zod garantisce che ci sia e che sia della lunghezza giusta, non che
 * esista nel catalogo: senza questo controllo un codice inventato uscirebbe come 500
 * (violazione di FK) invece che come 400 leggibile. D-83.
 */
export async function assertIndustryCode(
  code: string,
  q: repo.DbConnector = pool,
): Promise<void> {
  if (await repo.industryCodeExists(q, code)) return;
  const known = await repo.listIndustryCodes(q);
  throw new ValidationError(
    { field: "tenantIndustryCode", value: code, allowed: known.map((i) => i.industryCode) },
    `Unknown industry code '${code}' — see GET /v1/tenants/industry-codes`,
  );
}

export const tenantsService = {
  async industryCodes(): Promise<IndustryCode[]> {
    return repo.listIndustryCodes(pool);
  },

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
    await assertIndustryCode(body.tenantIndustryCode);
    return repo.insertTenant(pool, body);
  },

  async update(actor: ActorContext, id: string, patch: UpdateTenantBody): Promise<Tenant> {
    if (!isPlatformAdmin(actor) && requireOwnTenant(actor) !== id) {
      throw new NotFoundError("Tenant");
    }
    if (patch.tenantIndustryCode !== undefined) {
      await assertIndustryCode(patch.tenantIndustryCode);
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
