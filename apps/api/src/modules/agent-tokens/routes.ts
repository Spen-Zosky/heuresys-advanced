/**
 * apps/api/src/modules/agent-tokens/routes.ts — piano interfacce L9, A-1/A-2/A-3
 * (ADR-0050 D6, ADR-0040).
 *
 * `POST /v1/auth/agent-tokens`: la persona, con la propria sessione, chiede un gettone per un
 * agente e un compito. Il gettone:
 *  - porta la persona (`sub`), l'agente e il compito (`agt`): A-1, l'API distingue l'agente
 *    dalla persona, e il registro delle scritture li conserva tutti e due;
 *  - porta i ruoli della persona SENZA i mandati (ADR-0050 D6: un agente non porta mai un
 *    ruolo di `MANDATE_ROLES`) e, se il compito lo dice, solo alcuni permessi (`scp`): A-2;
 *  - dura `AGENT_TOKEN_TTL_SECONDS` e non si rinnova; resta legato alla sessione della persona
 *    (`fam`), e quando quella si chiude smette di valere subito (middleware/auth.ts): A-3.
 *
 * Nessun permesso proprio: ogni persona autenticata può prestare il proprio perimetro a un
 * agente, mai più di quello. Un gettone d'agente non ne chiede un altro (middleware/auth.ts).
 */
import { randomUUID } from "node:crypto";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  AGENT_TOKEN_ERRORS,
  AGENT_TOKEN_TTL_SECONDS,
  AgentTokenResponseSchema,
  CreateAgentTokenBodySchema,
} from "@heuresys/shared";
import type { RoleCode } from "../../config/constants.js";
import { pool } from "../../db/client.js";
import { ForbiddenError, UnauthorizedError } from "../../errors/index.js";
import { MANDATE_ROLES } from "../../lib/scope/mandati.js";
import { isRolePermissionCacheLoaded, userHasPermission } from "../../middleware/rbac.js";

/** ADR-0050 D6: i ruoli che una persona può prestare a un agente. */
export function ruoliPerAgente(roles: readonly RoleCode[]): RoleCode[] {
  return roles.filter((r) => !MANDATE_ROLES.has(r));
}

export const agentTokensRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    "/",
    {
      preHandler: [app.verifyCsrf],
      schema: { body: CreateAgentTokenBodySchema, response: { 201: AgentTokenResponseSchema } },
      config: { rateLimit: { max: 30, timeWindow: 60 * 1000 } },
    },
    async (req, reply) => {
      const persona = req.user;
      if (!persona) throw new UnauthorizedError("Authentication required");
      if (!persona.familyId || persona.enrollmentOnly) {
        throw new UnauthorizedError("A full session of the person is required", AGENT_TOKEN_ERRORS.AGENT_SESSION_REQUIRED);
      }
      if (!isRolePermissionCacheLoaded()) {
        throw new ForbiddenError("RBAC permission cache not loaded — server bootstrap incomplete", "RBAC_NOT_LOADED");
      }

      const roles = ruoliPerAgente(persona.roles);
      if (roles.length === 0) {
        throw new ForbiddenError(
          "Without its mandates the person has no role to lend to an agent (ADR-0050 D6)",
          AGENT_TOKEN_ERRORS.AGENT_NO_ROLES,
        );
      }
      const chiesti = req.body.permissions ? [...new Set(req.body.permissions)].sort() : null;
      if (chiesti) {
        const fuori = chiesti.filter((p) => !userHasPermission({ roles }, p));
        if (fuori.length > 0) {
          throw new ForbiddenError(
            `The task asks for permissions the person does not hold without mandates: ${fuori.join(", ")}`,
            AGENT_TOKEN_ERRORS.AGENT_SCOPE_EXCEEDS_PERSON,
          );
        }
      }

      // La sessione della persona deve essere viva adesso: un gettone nato da una sessione
      // chiusa non avrebbe da chi ripassare (A-3).
      const { rowCount } = await pool.query(
        `SELECT 1 FROM sys.sys_auth_refresh_tokens
          WHERE auth_refresh_token_family_id = $1 AND auth_refresh_token_user_id = $2
            AND auth_refresh_token_revoked_at IS NULL AND auth_refresh_token_expires_at > now()
          LIMIT 1`,
        [persona.familyId, persona.userId],
      );
      if (!rowCount) {
        throw new UnauthorizedError("Session no longer active", AGENT_TOKEN_ERRORS.AGENT_SESSION_REQUIRED);
      }

      const jti = randomUUID();
      const token = await app.jwt.sign(
        {
          sub: persona.userId,
          tenant_id: persona.tenantId,
          roles,
          jti,
          fam: persona.familyId,
          agt: { cod: req.body.agentCode, cmp: req.body.task },
          ...(chiesti ? { scp: chiesti } : {}),
        },
        // fast-jwt legge un numero come millisecondi: la durata si scrive in secondi, come testo.
        { expiresIn: `${AGENT_TOKEN_TTL_SECONDS}s` },
      );
      const expiresAt = new Date(Date.now() + AGENT_TOKEN_TTL_SECONDS * 1000).toISOString();

      // A-1: l'emissione stessa è una scrittura della persona, e il registro dice per chi e cosa.
      req.dettaglioScrittura = {
        gettoneAgente: { jti, agente: req.body.agentCode, compito: req.body.task, permessi: chiesti, scade: expiresAt },
      };
      reply.code(201);
      return { token, expiresAt, agentCode: req.body.agentCode, task: req.body.task, permissions: chiesti, roles };
    },
  );
};
