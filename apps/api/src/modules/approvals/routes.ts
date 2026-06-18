/**
 * apps/api/src/modules/approvals/routes.ts
 * /v1/approvals/* — 3.3 slice-D generic approval runtime.
 * Writes (create/decide/apply) = approval:create / approval:decide + CSRF.
 * Reads (list / detail) = approval:read. Decision authority is doubly gated:
 * the approval:decide permission here PLUS a data-layer check (own step only).
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";

import {
  ApprovalRequestSchema,
  ApprovalRequestDetailSchema,
  ApprovalStepSchema,
  ApprovalListResponseSchema,
  CreateApprovalRequestBodySchema,
  DecideApprovalStepBodySchema,
  ApprovalIdParamSchema,
  ApprovalDecideParamsSchema,
  ApprovalListQuerySchema,
} from "@heuresys/shared";
import { approvalService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const approvalsRoutes: FastifyPluginAsyncZod = async (app) => {
  /* --- create (approval:create + CSRF) --- */
  app.post(
    "/",
    { preHandler: [app.verifyCsrf, requirePermission("approval:create")], schema: { body: CreateApprovalRequestBodySchema, response: { 200: ApprovalRequestSchema } } },
    async (req) => approvalService.createRequest(actor(req), req.body),
  );

  /* --- track (approval:read) --- */
  app.get(
    "/",
    { preHandler: [requirePermission("approval:read")], schema: { querystring: ApprovalListQuerySchema, response: { 200: ApprovalListResponseSchema } } },
    async (req) => approvalService.listRequests(actor(req), req.query),
  );
  app.get(
    "/:id",
    { preHandler: [requirePermission("approval:read")], schema: { params: ApprovalIdParamSchema, response: { 200: ApprovalRequestDetailSchema } } },
    async (req) => approvalService.getRequest(actor(req), req.params.id),
  );

  /* --- decide a step (approval:decide + CSRF; data-layer pins to own step) --- */
  app.post(
    "/:id/steps/:stepId/decide",
    { preHandler: [app.verifyCsrf, requirePermission("approval:decide")], schema: { params: ApprovalDecideParamsSchema, body: DecideApprovalStepBodySchema, response: { 200: ApprovalStepSchema } } },
    async (req) => approvalService.decideStep(actor(req), req.params.id, req.params.stepId, req.body),
  );

  /* --- apply an APPROVED request (approval:create + CSRF) --- */
  app.post(
    "/:id/apply",
    { preHandler: [app.verifyCsrf, requirePermission("approval:create")], schema: { params: ApprovalIdParamSchema, response: { 200: ApprovalRequestSchema } } },
    async (req) => approvalService.applyRequest(actor(req), req.params.id),
  );
};
