/**
 * apps/api/src/modules/user-position-assignments/routes.ts — /v1/user-position-assignments/*
 * Mandato K, G-1 (D4=B, F6). Le scritture creano SOLO una proposta (approvals); la decisione
 * si prende in /v1/approvals come ogni altra. Nessuna rotta DELETE (I1: mai una cancellazione).
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  UserPositionAssignmentListQuerySchema,
  UserPositionAssignmentListResponseSchema,
  UserPositionAssignmentSchema,
  UserPositionAssignmentIdParamSchema,
  AssignPositionBodySchema,
  TerminatePositionAssignmentBodySchema,
  TransferPositionAssignmentBodySchema,
  PositionAssignmentProposalSubmittedSchema,
} from "@heuresys/shared";
import { actorFromRequest as actor } from "../../lib/actor.js";
import { requirePermission } from "../../middleware/rbac.js";
import { userPositionAssignmentsService as svc } from "./service.js";

export const userPositionAssignmentsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("user_position_assignment:list")],
    schema: { querystring: UserPositionAssignmentListQuerySchema, response: { 200: UserPositionAssignmentListResponseSchema } },
  }, async (req) => svc.list(actor(req), req.query));

  app.get("/:id", {
    preHandler: [requirePermission("user_position_assignment:read")],
    schema: { params: UserPositionAssignmentIdParamSchema, response: { 200: UserPositionAssignmentSchema } },
  }, async (req) => svc.get(actor(req), req.params.id));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("user_position_assignment:create")],
    schema: { body: AssignPositionBodySchema, response: { 201: PositionAssignmentProposalSubmittedSchema } },
  }, async (req, reply) => {
    const r = await svc.proposeAssign(actor(req), req.body);
    reply.code(201).send(r);
  });

  app.post("/:id/terminate", {
    preHandler: [app.verifyCsrf, requirePermission("user_position_assignment:update")],
    schema: {
      params: UserPositionAssignmentIdParamSchema,
      body: TerminatePositionAssignmentBodySchema,
      response: { 201: PositionAssignmentProposalSubmittedSchema },
    },
  }, async (req, reply) => {
    const r = await svc.proposeTerminate(actor(req), req.params.id, req.body);
    reply.code(201).send(r);
  });

  app.post("/:id/transfer", {
    preHandler: [app.verifyCsrf, requirePermission("user_position_assignment:update")],
    schema: {
      params: UserPositionAssignmentIdParamSchema,
      body: TransferPositionAssignmentBodySchema,
      response: { 201: PositionAssignmentProposalSubmittedSchema },
    },
  }, async (req, reply) => {
    const r = await svc.proposeTransfer(actor(req), req.params.id, req.body);
    reply.code(201).send(r);
  });
};
