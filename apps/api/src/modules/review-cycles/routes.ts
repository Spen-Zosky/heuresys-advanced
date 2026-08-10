/**
 * apps/api/src/modules/review-cycles/routes.ts — /v1/review-cycles/* (#92 passo 3/7).
 * READ-only: catalogo dei cicli di valutazione. Il permesso e'
 * `performance-review:read` (chi legge le valutazioni vede il loro calendario);
 * `review-cycle:manage` restera' il permesso delle scritture (passo 4).
 * Nessuna riga-persona → orgGate "catalog".
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  ReviewCycleListQuerySchema, ReviewCycleListResponseSchema,
  ReviewCycleParamSchema, ReviewCycleSchema,
} from "@heuresys/shared";
import { actorFromRequest as actor } from "../../lib/actor.js";
import { reviewCyclesService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const reviewCyclesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    config: { orgGate: "catalog" },
    preHandler: [requirePermission("performance-review:read")],
    schema: {
      querystring: ReviewCycleListQuerySchema,
      response: { 200: ReviewCycleListResponseSchema },
    },
  }, async (req) => reviewCyclesService.list(actor(req), req.query));

  app.get("/:cycleId", {
    config: { orgGate: "catalog" },
    preHandler: [requirePermission("performance-review:read")],
    schema: {
      params: ReviewCycleParamSchema,
      response: { 200: ReviewCycleSchema },
    },
  }, async (req) => reviewCyclesService.getById(actor(req), req.params.cycleId));
};
