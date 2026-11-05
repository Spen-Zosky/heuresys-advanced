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
import type { ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { ROLE_CODES } from "../../config/constants.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../errors/index.js";
import type { MfaExemption, MfaPolicy } from "@heuresys/shared";
import { haMandatoPiattaforma } from "../../lib/scope/mandati.js";
import * as repo from "./repository.js";

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

function toExemptionApi(r: repo.MfaExemptionRecord): MfaExemption {
  return {
    exemptionId: r.exemptionId,
    tenantId: r.tenantId,
    userId: r.userId,
    userEmail: r.userEmail,
    userDisplayName: r.userDisplayName,
    userType: r.userType,
    reason: r.reason,
    state: !r.enabled ? "DISABLED" : r.expired ? "EXPIRED" : "ACTIVE",
    expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    authorDisplayName: r.authorDisplayName,
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

  /* ADR-0050 D3, parte visibile (S-14): le esenzioni, con autore, scadenza e stato. */
  async listExemptions(a: ActorContext): Promise<{ items: MfaExemption[]; total: number }> {
    const piattaforma = haMandatoPiattaforma(a);
    if (!piattaforma && a.tenantId === null) {
      throw new ForbiddenError("Tenant context required", "PERMISSION_DENIED");
    }
    const items = (await repo.listExemptions(pool, piattaforma ? null : a.tenantId)).map(toExemptionApi);
    return { items, total: items.length };
  },

  /** Spegne un'esenzione del proprio tenant (piattaforma: di ogni tenant). Fuori perimetro → 404. */
  async disableExemption(a: ActorContext, exemptionId: string): Promise<MfaExemption> {
    const found = await repo.findExemption(pool, exemptionId);
    if (!found || (!haMandatoPiattaforma(a) && found.tenantId !== a.tenantId)) {
      throw new NotFoundError("MFA exemption");
    }
    await repo.disableExemption(pool, exemptionId, a.userId);
    const after = await repo.findExemption(pool, exemptionId);
    return toExemptionApi(after!);
  },
};
