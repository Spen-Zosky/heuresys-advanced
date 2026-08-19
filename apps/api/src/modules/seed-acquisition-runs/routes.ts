/**
 * apps/api/src/modules/seed-acquisition-runs/routes.ts
 */
import { z } from "zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  SeedAcquisitionRunSchema, SeedAcquisitionRunListQuerySchema,
  SeedAcquisitionRunListResponseSchema, CreateSeedAcquisitionRunBodySchema,
  UpdateSeedAcquisitionRunBodySchema, SeedAcquisitionRunIdParamSchema,
  CandidatiRicercaResponseSchema,
} from "@heuresys/shared";
import { researchService } from "../research/service.js";
import { seedAcquisitionRunsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const seedAcquisitionRunsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("seed_acquisition:read")],
    schema: { querystring: SeedAcquisitionRunListQuerySchema, response: { 200: SeedAcquisitionRunListResponseSchema } },
  }, async (req) => seedAcquisitionRunsService.list(actor(req), req.query));
  app.get("/:id", {
    preHandler: [requirePermission("seed_acquisition:read")],
    schema: { params: SeedAcquisitionRunIdParamSchema, response: { 200: SeedAcquisitionRunSchema } },
  }, async (req) => seedAcquisitionRunsService.getById(actor(req), req.params.id));
  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("seed_acquisition:trigger")],
    schema: { body: CreateSeedAcquisitionRunBodySchema, response: { 201: SeedAcquisitionRunSchema } },
  }, async (req, reply) => {
    const r = await seedAcquisitionRunsService.trigger(actor(req), req.body);
    reply.code(201).send(r);
  });
  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("seed_acquisition:trigger")],
    schema: { params: SeedAcquisitionRunIdParamSchema, body: UpdateSeedAcquisitionRunBodySchema, response: { 200: SeedAcquisitionRunSchema } },
  }, async (req) => seedAcquisitionRunsService.update(actor(req), req.params.id, req.body));
  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("seed_acquisition:delete")],
    schema: { params: SeedAcquisitionRunIdParamSchema, response: { 204: z.null() } },
  }, async (req, reply) => {
    await seedAcquisitionRunsService.delete(actor(req), req.params.id);
    reply.code(204).send(null);
  });

  /**
   * #132 F4g — le proposte di una corsa, con lo stato, i controlli applicati (uno per uno,
   * col loro nome), le fonti con impronta, e la decisione umana se c'e' gia'.
   *
   * Torna anche le proposte RESPINTE, ed e' il punto: una proposta scartata in silenzio e'
   * una proposta che nessuno puo' contestare.
   */
  app.get("/:id/candidates", {
    preHandler: [requirePermission("seed_acquisition:read")],
    schema: { params: SeedAcquisitionRunIdParamSchema, response: { 200: CandidatiRicercaResponseSchema } },
  }, async (req) => researchService.proposte(actor(req), req.params.id));
};
