/**
 * apps/api/src/modules/compensation/routes.ts
 * 4 endpoints under /v1/compensation.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";

import {
  CompensationProfileSchema,
  CompensationProfilePositionParamSchema,
  RewardGatesListQuerySchema,
  RewardGatesListResponseSchema,
  CompensationRecommendationSchema,
  CreateCompensationRecommendationBodySchema,
  PayrollHandoffRecordSchema,
  CreatePayrollHandoffRecordBodySchema,
} from "@heuresys/shared";
import { compensationService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const compensationRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/profiles/:positionId", {
    preHandler: [requirePermission("compensation_intelligence:read")],
    schema: { params: CompensationProfilePositionParamSchema, response: { 200: CompensationProfileSchema } },
  }, async (req) => compensationService.getProfileByPosition(actor(req), req.params.positionId));

  app.get("/reward-gates", {
    preHandler: [requirePermission("compensation_intelligence:read")],
    schema: { querystring: RewardGatesListQuerySchema, response: { 200: RewardGatesListResponseSchema } },
  }, async (req) => compensationService.listRewardGates(actor(req), req.query));

  app.post("/recommendations", {
    preHandler: [app.verifyCsrf, requirePermission("compensation_intelligence:update")],
    schema: { body: CreateCompensationRecommendationBodySchema, response: { 201: CompensationRecommendationSchema } },
  }, async (req, reply) => {
    const rec = await compensationService.createRecommendation(actor(req), req.body);
    reply.code(201).send(rec);
  });

  app.post("/handoff-records", {
    preHandler: [app.verifyCsrf, requirePermission("compensation_intelligence:update")],
    schema: { body: CreatePayrollHandoffRecordBodySchema, response: { 201: PayrollHandoffRecordSchema } },
  }, async (req, reply) => {
    const h = await compensationService.createHandoffRecord(actor(req), req.body);
    reply.code(201).send(h);
  });
};
