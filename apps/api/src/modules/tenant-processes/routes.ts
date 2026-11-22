/**
 * apps/api/src/modules/tenant-processes/routes.ts — 6 rotte: lettura di un processo del tenant e
 * cambio del suo responsabile (ADR-0060, piano delle applet, voce P3); vocabolario delle faccette,
 * faccette di un processo e loro scrittura (ADR-0061 D4, passo 2); tipo di corrispondenza di
 * un'attività con APQC (ADR-0061 D7, passo 4).
 */
import { actorFromRequest as actor } from "../../lib/actor.js";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  TenantProcessIdParamSchema, TenantProcessSchema,
  ProcessFacetVocabularyResponseSchema, TenantProcessFacetsResponseSchema, TenantProcessFacetParamSchema,
  PutTenantProcessFacetBodySchema, StepApqcParamSchema, PutStepApqcBodySchema, PutStepApqcResponseSchema,
  UpdateTenantProcessOwnerBodySchema, UpdateTenantProcessOwnerResponseSchema,
} from "@heuresys/shared";
import { presidiaIlProcesso, tenantProcessesService } from "./service.js";
import { requirePermission, requirePermissionOr } from "../../middleware/rbac.js";
import type { FastifyRequest } from "fastify";

/** Classificare un processo: il permesso, oppure esserne il responsabile in carica (Enzo, 2026-11-22). */
const presidia = (req: FastifyRequest) => presidiaIlProcesso(actor(req), (req.params as { id: string }).id);

export const tenantProcessesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/:id", {
    preHandler: [requirePermission("bpm_process:read")],
    schema: { params: TenantProcessIdParamSchema, response: { 200: TenantProcessSchema } },
  }, async (req) => tenantProcessesService.getById(actor(req), req.params.id));

  app.patch("/:id/owner", {
    preHandler: [app.verifyCsrf, requirePermission("bpm_process:update")],
    schema: {
      params: TenantProcessIdParamSchema,
      body: UpdateTenantProcessOwnerBodySchema,
      response: { 200: UpdateTenantProcessOwnerResponseSchema },
    },
  }, async (req) => tenantProcessesService.updateOwner(actor(req), req.params.id, req.body));

  app.get("/faccette/vocabolario", {
    preHandler: [requirePermission("bpm_process:read")],
    schema: { response: { 200: ProcessFacetVocabularyResponseSchema } },
  }, async () => tenantProcessesService.facetVocabulary());

  app.get("/:id/faccette", {
    preHandler: [requirePermission("bpm_process:read")],
    schema: { params: TenantProcessIdParamSchema, response: { 200: TenantProcessFacetsResponseSchema } },
  }, async (req) => tenantProcessesService.facets(actor(req), req.params.id));

  app.put("/:id/faccette/:facet", {
    preHandler: [app.verifyCsrf, requirePermissionOr("bpm_process:update", presidia)],
    schema: { params: TenantProcessFacetParamSchema, body: PutTenantProcessFacetBodySchema, response: { 200: TenantProcessFacetsResponseSchema } },
  }, async (req) => tenantProcessesService.putFacet(actor(req), req.params.id, req.params.facet, req.body));

  app.put("/:id/attivita/:stepId/apqc", {
    preHandler: [app.verifyCsrf, requirePermissionOr("bpm_process:update", presidia)],
    schema: { params: StepApqcParamSchema, body: PutStepApqcBodySchema, response: { 200: PutStepApqcResponseSchema } },
  }, async (req) => tenantProcessesService.putActivityMapping(actor(req), req.params, req.body));
};
