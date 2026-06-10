/**
 * apps/api/src/modules/mfa-policy/service.ts
 * Mandatory-MFA policy admin surface (MVP-4 par.2.5 #4).
 *
 * Visibility model: PLATFORM_ADMIN sees/manages every tenant's policy;
 * TENANT_ADMIN only their own tenant (cross-tenant -> 404, mirror of the
 * tenant-only modules). Role codes in the scope list are validated against
 * the 8 canonical RoleCode values so a typo cannot silently neuter the gate.
 */

import { pool } from "../../db/client.js";
import { ROLE_CODES, type RoleCode } from "../../config/constants.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../errors/index.js";
import type { MfaPolicy } from "@heuresys/shared";
import * as repo from "./repository.js";

export interface ActorContext {
  userId: string;
  tenantId: string | null;
  roles: RoleCode[];
}

const KNOWN_ROLES = new Set<string>(ROLE_CODES);

function toApi(r: repo.MfaPolicyRecord): MfaPolicy {
  return {
    policyId: r.policyId,
    tenantId: r.tenantId,
    enabled: r.enabled,
    roleCodes: r.roleCodes,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export const mfaPolicyService = {
  async list(a: ActorContext): Promise<{ items: MfaPolicy[]; total: number }> {
    const isPlatform = a.roles.includes("PLATFORM_ADMIN");
    if (!isPlatform && a.tenantId === null) {
      throw new ForbiddenError("Tenant context required", "PERMISSION_DENIED");
    }
    const items = (await repo.listPolicies(pool, isPlatform ? null : a.tenantId)).map(toApi);
    return { items, total: items.length };
  },

  async upsert(
    a: ActorContext,
    tenantId: string,
    input: { enabled: boolean; roleCodes?: string[] | null | undefined },
  ): Promise<MfaPolicy> {
    const isPlatform = a.roles.includes("PLATFORM_ADMIN");
    if (!isPlatform) {
      // Tenant admins manage ONLY their own tenant; a foreign tenantId is
      // indistinguishable from a missing one (404, no existence leak).
      if (a.tenantId === null || a.tenantId !== tenantId) {
        throw new NotFoundError("Tenant");
      }
    }
    if (!(await repo.tenantExists(pool, tenantId))) {
      throw new NotFoundError("Tenant");
    }
    const roleCodes = input.roleCodes ?? null;
    if (roleCodes !== null) {
      const unknown = roleCodes.filter((r) => !KNOWN_ROLES.has(r));
      if (unknown.length > 0) {
        throw new ValidationError({ unknown }, "Unknown role code(s) in MFA policy scope");
      }
    }
    const row = await repo.upsertPolicy(pool, {
      tenantId,
      enabled: input.enabled,
      roleCodes,
      actorUserId: a.userId,
    });
    return toApi(row);
  },
};
