/**
 * apps/api/src/modules/tenants/provisioning.ts
 * D-14 FASE 1+2 — provision-engine: takes an organisation from zero to
 * operational in ONE transaction. Admin-gated (tenant:create = PLATFORM_ADMIN).
 * Composes the existing PoolClient-compatible repos so it inherits their
 * SQL/validation: tenant + first TENANT_ADMIN (identity + Argon2id credential,
 * must-rotate) + role floor (TENANT_ADMIN + USER, I17 as practiced: 160/162
 * live users carry an explicit USER grant) + a per-tenant MFA policy + (F2) an
 * OPTIONAL org archetype materialized in the SAME transaction. Any failure
 * rolls the whole thing back — no half-provisioned tenant can exist.
 *
 * F2 idempotency contract: a duplicate tenantCode is a clean 409
 * TENANT_CODE_EXISTS (pre-checked in-tx; the unique index
 * sys_tenancies_tenant_code_uq backs it against races via the 23505 map).
 */
import { withTransaction } from "../../db/client.js";
import { hashPassword } from "../auth/password.js";
import { insertIdentity, insertCredential } from "../auth/repository.js";
import { insertTenant, findTenantByCode } from "./repository.js";
import { insertUser, findRoleByCode, insertRoleGrant } from "../users/repository.js";
import { upsertPolicy } from "../mfa-policy/repository.js";
import { getArchetype } from "../tenant-materialization/blueprints.js";
import { materialize as materializeArchetype } from "../tenant-materialization/repository.js";
import { NotFoundError, ConflictError } from "../../errors/index.js";
import type { ActorContext } from "../../lib/actor.js";
import type { ProvisionTenantBody, ProvisionTenantResponse } from "@heuresys/shared";

/** Postgres unique-violation (race on the tenant_code unique index). */
function is23505(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "23505";
}

export async function provisionTenant(
  actor: ActorContext,
  body: ProvisionTenantBody,
): Promise<ProvisionTenantResponse> {
  // F2: validate the archetype BEFORE any write — a typo'd key must not leave
  // a provisioned-but-empty tenant behind.
  const archetype = body.archetypeKey ? getArchetype(body.archetypeKey) : null;
  if (body.archetypeKey && !archetype) {
    throw new NotFoundError(`Archetype '${body.archetypeKey}' not found`, "ARCHETYPE_NOT_FOUND");
  }

  // Hash outside the transaction (Argon2id is CPU-heavy; keep the tx short).
  const hash = await hashPassword(body.adminPassword);

  try {
    return await withTransaction(async (client) => {
      // F2 idempotency: clean 409 instead of a raw unique-violation 500.
      const existing = await findTenantByCode(client, body.tenantCode);
      if (existing) {
        throw new ConflictError(`Tenant code '${body.tenantCode}' already exists`, "TENANT_CODE_EXISTS");
      }

      const tenant = await insertTenant(client, {
        tenantCode: body.tenantCode,
        tenantName: body.tenantName,
        tenantLegalName: body.tenantLegalName,
        tenantCountryCode: body.tenantCountryCode,
        tenantIndustryCode: body.tenantIndustryCode,
        tenantSizeBand: body.tenantSizeBand,
        tenantStatus: "ACTIVE",
        tenantMetadata: { provisionedBy: actor.userId, provisionedVia: "D-14-provision-engine" },
      });

      const admin = await insertUser(client, tenant.tenantId, {
        email: body.adminEmail,
        displayName: body.adminDisplayName,
        status: "ACTIVE",
        type: "STANDARD",
        metadata: {},
      });

      const identityId = await insertIdentity(client, admin.userId);
      await insertCredential(client, { identityId, hash, mustRotate: true });

      // Role floor: TENANT_ADMIN + USER (I17 — the ESS floor is a REAL grant in
      // this platform's practice, not an implicit rule). Fail loud if either
      // role is missing from the seed (rolls back).
      const grantedRoles: string[] = [];
      for (const roleCode of ["TENANT_ADMIN", "USER"] as const) {
        const role = await findRoleByCode(client, roleCode);
        if (!role) {
          throw new NotFoundError(`${roleCode} role not found`, "ROLE_NOT_FOUND");
        }
        await insertRoleGrant(client, {
          userId: admin.userId,
          roleId: role.id,
          tenantId: tenant.tenantId,
          grantedBy: actor.userId,
        });
        grantedRoles.push(roleCode);
      }

      // Per-tenant MFA policy row, disabled by default (platform MFA is OFF, S1006).
      await upsertPolicy(client, {
        tenantId: tenant.tenantId,
        enabled: false,
        roleCodes: null,
        actorUserId: actor.userId,
      });

      // F2: optional archetype — org-units, positions, incumbents materialized
      // atomically with the tenant (same client → same transaction).
      let archetypeOut: ProvisionTenantResponse["archetype"];
      if (archetype) {
        const created = await materializeArchetype(client, tenant.tenantId, archetype, "apply");
        archetypeOut = { key: archetype.key, created };
      }

      return {
        tenant: { id: tenant.tenantId, code: tenant.tenantCode, name: tenant.tenantName },
        admin: {
          userId: admin.userId,
          email: admin.email,
          mustRotatePassword: true,
          roles: grantedRoles,
        },
        ...(archetypeOut ? { archetype: archetypeOut } : {}),
      };
    });
  } catch (e) {
    // Race safety: two concurrent provisions of the same code — the loser hits
    // the unique index instead of the pre-check.
    if (is23505(e)) {
      throw new ConflictError(`Tenant code '${body.tenantCode}' already exists`, "TENANT_CODE_EXISTS");
    }
    throw e;
  }
}
