/**
 * apps/api/src/modules/generated-origins/routes.ts — `/v1/generated-origins/*` (#198 T6).
 * SOLA LETTURA sul registro dell'origine: cosa, di questa azienda, è stato generato da un
 * fascicolo e non è ancora un dato vero.
 *
 * Il permesso è `provenance:read` e **non ne serve uno nuovo**: è già di `PLATFORM_ADMIN` e
 * `TENANT_ADMIN` (mig `000171`), ed è il diritto giusto — sapere quanto della propria
 * azienda è ancora provvisorio è informazione del cliente, non un segreto della piattaforma.
 * Un permesso nuovo duplicherebbe uno esistente sulla stessa materia.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import {
  GeneratedOriginListQuerySchema,
  GeneratedOriginListResponseSchema,
  GeneratedOriginSummaryQuerySchema,
  GeneratedOriginSummaryResponseSchema,
} from "@heuresys/shared";
import { generatedOriginsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const generatedOriginsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("provenance:read")],
    schema: {
      querystring: GeneratedOriginListQuerySchema,
      response: { 200: GeneratedOriginListResponseSchema },
    },
  }, async (req) => generatedOriginsService.list(actor(req), req.query));

  app.get("/summary", {
    preHandler: [requirePermission("provenance:read")],
    schema: {
      querystring: GeneratedOriginSummaryQuerySchema,
      response: { 200: GeneratedOriginSummaryResponseSchema },
    },
  }, async (req) => generatedOriginsService.summary(actor(req), req.query.tenantId, req.query.blueprintVersionId));
};
