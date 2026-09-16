/**
 * apps/api/src/middleware/tenantContext.ts
 * Sets req.tenantId from req.user.tenantId. PLATFORM_ADMIN may operate
 * cross-tenant — req.tenantId remains undefined for them on cross-tenant
 * endpoints; repository layer never substitutes a default.
 *
 * Mandato K, R-0 (D9=B): per un ruolo di piattaforma ASSEGNATO
 * (`PLATFORM_ASSIGNED_MANDATE_ROLES`, apps/api/src/lib/scope/mandati.ts — oggi vuoto: nessuna
 * richiesta esegue mai la query sotto) carica anche `req.assignedTenantIds`, letto da
 * `actorFromRequest` (apps/api/src/lib/actor.ts) per costruire `perimetroClienti(actor)`.
 *
 * Per AUTH_SECURITY_PLAN §7.
 */

import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { ForbiddenError } from "../errors/index.js";
import { pool } from "../db/client.js";
import { PLATFORM_ASSIGNED_MANDATE_ROLES } from "../lib/scope/mandati.js";

const plugin: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (req) => {
    if (!req.user) return; // public route — auth handled per-route

    if (req.user.roles.some((r) => PLATFORM_ASSIGNED_MANDATE_ROLES.has(r))) {
      const { rows } = await pool.query<{ tenant_id: string }>(
        `SELECT platform_user_tenant_assignment_tenant_id AS tenant_id
           FROM sys.sys_platform_user_tenant_assignments
          WHERE platform_user_tenant_assignment_user_id = $1
            AND platform_user_tenant_assignment_revoked_at IS NULL`,
        [req.user.userId],
      );
      req.assignedTenantIds = rows.map((r) => r.tenant_id);
    }

    if (req.user.tenantId) {
      req.tenantId = req.user.tenantId;
      return;
    }
    // No tenant on the JWT. Allowed only for PLATFORM_ADMIN; otherwise 403.
    if (!req.user.roles.includes("PLATFORM_ADMIN")) {
      throw new ForbiddenError("Tenant context required");
    }
  });
};

export const tenantContextPlugin = fp(plugin, { name: "tenantContext", dependencies: ["auth"] });
