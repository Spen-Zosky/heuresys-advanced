/**
 * apps/api/src/modules/engagement-feedback/routes.ts
 * /v1/engagement-feedback/* — anonymous feedback (root) + action plans (nested) full CRUD.
 * Reads: requirePermission("engagement_feedback:read").
 * Writes: app.verifyCsrf + engagement_feedback:{create,update,delete}.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";

import {
  EngagementFeedbackSchema, EngagementFeedbackListQuerySchema, EngagementFeedbackListResponseSchema,
  CreateEngagementFeedbackBodySchema, UpdateEngagementFeedbackBodySchema,
  EngagementActionPlanSchema, EngagementActionPlanListQuerySchema, EngagementActionPlanListResponseSchema,
  CreateEngagementActionPlanBodySchema, UpdateEngagementActionPlanBodySchema,
  EngagementFeedbackIdParamSchema,
} from "@heuresys/shared";
import { engagementFeedbackService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const engagementFeedbackRoutes: FastifyPluginAsyncZod = async (app) => {
  // ── Action plans (nested static segment — declared before /:id so the radix router prefers it) ──
  app.get("/action-plans", {
    preHandler: [requirePermission("engagement_feedback:read")],
    schema: { querystring: EngagementActionPlanListQuerySchema, response: { 200: EngagementActionPlanListResponseSchema } },
  }, async (req) => engagementFeedbackService.listActionPlans(actor(req), req.query));

  app.get("/action-plans/:id", {
    preHandler: [requirePermission("engagement_feedback:read")],
    schema: { params: EngagementFeedbackIdParamSchema, response: { 200: EngagementActionPlanSchema } },
  }, async (req) => engagementFeedbackService.getActionPlan(actor(req), req.params.id));

  app.post("/action-plans", {
    preHandler: [app.verifyCsrf, requirePermission("engagement_feedback:create")],
    schema: { body: CreateEngagementActionPlanBodySchema, response: { 201: EngagementActionPlanSchema } },
  }, async (req, reply) => { reply.code(201).send(await engagementFeedbackService.createActionPlan(actor(req), req.body)); });

  app.patch("/action-plans/:id", {
    preHandler: [app.verifyCsrf, requirePermission("engagement_feedback:update")],
    schema: { params: EngagementFeedbackIdParamSchema, body: UpdateEngagementActionPlanBodySchema, response: { 200: EngagementActionPlanSchema } },
  }, async (req) => engagementFeedbackService.updateActionPlan(actor(req), req.params.id, req.body));

  app.delete("/action-plans/:id", {
    preHandler: [app.verifyCsrf, requirePermission("engagement_feedback:delete")],
    schema: { params: EngagementFeedbackIdParamSchema },
  }, async (req, reply) => { await engagementFeedbackService.deleteActionPlan(actor(req), req.params.id); reply.code(204).send(); });

  // ── Feedback (root) ──
  app.get("/", {
    preHandler: [requirePermission("engagement_feedback:read")],
    schema: { querystring: EngagementFeedbackListQuerySchema, response: { 200: EngagementFeedbackListResponseSchema } },
  }, async (req) => engagementFeedbackService.listFeedback(actor(req), req.query));

  app.get("/:id", {
    preHandler: [requirePermission("engagement_feedback:read")],
    schema: { params: EngagementFeedbackIdParamSchema, response: { 200: EngagementFeedbackSchema } },
  }, async (req) => engagementFeedbackService.getFeedback(actor(req), req.params.id));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("engagement_feedback:create")],
    schema: { body: CreateEngagementFeedbackBodySchema, response: { 201: EngagementFeedbackSchema } },
  }, async (req, reply) => { reply.code(201).send(await engagementFeedbackService.createFeedback(actor(req), req.body)); });

  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("engagement_feedback:update")],
    schema: { params: EngagementFeedbackIdParamSchema, body: UpdateEngagementFeedbackBodySchema, response: { 200: EngagementFeedbackSchema } },
  }, async (req) => engagementFeedbackService.updateFeedback(actor(req), req.params.id, req.body));

  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("engagement_feedback:delete")],
    schema: { params: EngagementFeedbackIdParamSchema },
  }, async (req, reply) => { await engagementFeedbackService.deleteFeedback(actor(req), req.params.id); reply.code(204).send(); });
};
