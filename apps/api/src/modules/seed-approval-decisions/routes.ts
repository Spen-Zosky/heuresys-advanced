/**
 * apps/api/src/modules/seed-approval-decisions/routes.ts
 * 3 endpoints: list/get/create.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import {
  SeedApprovalDecisionSchema, SeedApprovalDecisionListQuerySchema,
  SeedApprovalDecisionListResponseSchema, CreateSeedApprovalDecisionBodySchema,
  SeedApprovalDecisionIdParamSchema,
} from "@heuresys/shared";
import { seedApprovalDecisionsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const seedApprovalDecisionsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("seed_acquisition:read")],
    schema: { querystring: SeedApprovalDecisionListQuerySchema, response: { 200: SeedApprovalDecisionListResponseSchema } },
  }, async (req) => seedApprovalDecisionsService.list(actor(req), req.query));
  app.get("/:id", {
    preHandler: [requirePermission("seed_acquisition:read")],
    schema: { params: SeedApprovalDecisionIdParamSchema, response: { 200: SeedApprovalDecisionSchema } },
  }, async (req) => seedApprovalDecisionsService.getById(actor(req), req.params.id));
  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("seed_acquisition:approve")],
    schema: { body: CreateSeedApprovalDecisionBodySchema, response: { 201: SeedApprovalDecisionSchema } },
  }, async (req, reply) => {
    const d = await seedApprovalDecisionsService.create(actor(req), req.body);
    reply.code(201).send(d);
  });
};
