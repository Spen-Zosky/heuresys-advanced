/**
 * apps/api/src/modules/user-target-positions/routes.ts
 * 6 endpoint sotto /v1/user-target-positions.
 * Permessi: career_succession:read/create/update/delete (la revisione usa :update).
 */

import { z } from "zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import {
  UserTargetPositionSchema,
  UserTargetPositionListQuerySchema,
  UserTargetPositionListResponseSchema,
  CreateUserTargetPositionBodySchema,
  UpdateUserTargetPositionBodySchema,
  ReviewUserTargetPositionBodySchema,
  UserTargetPositionIdParamSchema,
} from "@heuresys/shared";
import { userTargetPositionsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const userTargetPositionsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    config: { orgGate: "service" },
    preHandler: [requirePermission("career_succession:read")],
    schema: {
      querystring: UserTargetPositionListQuerySchema,
      response: { 200: UserTargetPositionListResponseSchema },
    },
  }, async (req) => userTargetPositionsService.list(actor(req), req.query));

  app.get("/:id", {
    config: { orgGate: "service" },
    preHandler: [requirePermission("career_succession:read")],
    schema: {
      params: UserTargetPositionIdParamSchema,
      response: { 200: UserTargetPositionSchema },
    },
  }, async (req) => userTargetPositionsService.getById(actor(req), req.params.id));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("career_succession:create")],
    schema: {
      body: CreateUserTargetPositionBodySchema,
      response: { 201: UserTargetPositionSchema },
    },
  }, async (req, reply) => {
    const t = await userTargetPositionsService.create(actor(req), req.body);
    reply.code(201).send(t);
  });

  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("career_succession:update")],
    schema: {
      params: UserTargetPositionIdParamSchema,
      body: UpdateUserTargetPositionBodySchema,
      response: { 200: UserTargetPositionSchema },
    },
  }, async (req) => userTargetPositionsService.update(actor(req), req.params.id, req.body));

  // L'ATTO DI REVISIONE (rilievo #40 della coda C5): lo stato di revisione
  // esisteva da sempre sul dato e nessuna API poteva scriverlo. Endpoint
  // dedicato e non semplice PATCH del campo, perché il revisore è l'attore.
  app.post("/:id/review", {
    preHandler: [app.verifyCsrf, requirePermission("career_succession:update")],
    schema: {
      params: UserTargetPositionIdParamSchema,
      body: ReviewUserTargetPositionBodySchema,
      response: { 200: UserTargetPositionSchema },
    },
  }, async (req) => userTargetPositionsService.review(actor(req), req.params.id, req.body));

  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("career_succession:delete")],
    schema: {
      params: UserTargetPositionIdParamSchema,
      response: { 204: z.null() },
    },
  }, async (req, reply) => {
    await userTargetPositionsService.delete(actor(req), req.params.id);
    reply.code(204).send(null);
  });
};
