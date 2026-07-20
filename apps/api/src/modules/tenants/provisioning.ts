/**
 * apps/api/src/modules/tenants/provisioning.ts
 * D-14 FASE 1 — provision-engine: takes an organisation from zero to operational
 * in ONE transaction. Admin-gated (tenant:create = PLATFORM_ADMIN). Composes the
 * existing PoolClient-compatible repos so it inherits their SQL/validation:
 * tenant + first TENANT_ADMIN (identity + Argon2id credential, must-rotate) +
 * role grant + a per-tenant MFA policy (disabled by default). Any failure rolls
 * the whole thing back — no half-provisioned tenant can exist.
 */
import { withTransaction } from "../../db/client.js";
import { hashPassword } from "../auth/password.js";
import { insertIdentity, insertCredential } from "../auth/repository.js";
import { insertTenant } from "./repository.js";
import { insertUser, findRoleByCode, insertRoleGrant } from "../users/repository.js";
import { upsertPolicy } from "../mfa-policy/repository.js";
import { NotFoundError } from "../../errors/index.js";
import type { ActorContext } from "../../lib/actor.js";
import type { ProvisionTenantBody, ProvisionTenantResponse } from "@heuresys/shared";

export async function provisionTenant(
  actor: ActorContext,
  body: ProvisionTenantBody,
): Promise<ProvisionTenantResponse> {
  // Hash outside the transaction (Argon2id is CPU-heavy; keep the tx short).
  const hash = await hashPassword(body.adminPassword);

  return withTransaction(async (client) => {
    const tenant = await insertTenant(client, {
      tenantCode: body.tenantCode,
      tenantName: body.tenantName,
      tenantLegalName: body.tenantLegalName,
      tenantCountryCode: body.tenantCountryCode,
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

    const role = await findRoleByCode(client, "TENANT_ADMIN");
    if (!role) {
      // A seeded platform must always have TENANT_ADMIN; if missing, fail loud (rolls back).
      throw new NotFoundError("TENANT_ADMIN role not found", "ROLE_NOT_FOUND");
    }
    await insertRoleGrant(client, {
      userId: admin.userId,
      roleId: role.id,
      tenantId: tenant.tenantId,
      grantedBy: actor.userId,
    });

    // Per-tenant MFA policy row, disabled by default (platform MFA is OFF, S1006).
    await upsertPolicy(client, {
      tenantId: tenant.tenantId,
      enabled: false,
      roleCodes: null,
      actorUserId: actor.userId,
    });

    return {
      tenant: { id: tenant.tenantId, code: tenant.tenantCode, name: tenant.tenantName },
      admin: { userId: admin.userId, email: admin.email, mustRotatePassword: true },
    };
  });
}
