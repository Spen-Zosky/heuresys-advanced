/**
 * apps/api/src/modules/review-cycles/routes.ts — /v1/review-cycles/* (#92 passo 3/7).
 * Lettura: `performance-review:read` (chi legge le valutazioni vede il loro calendario).
 * [#92 F4] Scrittura: `review-cycle:manage`, il cui perimetro e' stato corretto dalla
 * 000309 — i mandati di CATALOGO non entrano nel ciclo di valutazione.
 * Nessuna riga-persona → orgGate "catalog".
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  ReviewCycleListQuerySchema, ReviewCycleListResponseSchema,
  ReviewCycleParamSchema, ReviewCycleSchema,
  CreateReviewCycleBodySchema, ReviewCycleTransitionBodySchema,
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

  /* ── #92 F4: le scritture ─────────────────────────────────────────────────── */

  app.post("/", {
    config: { orgGate: "catalog" },
    preHandler: [app.verifyCsrf, requirePermission("review-cycle:manage")],
    schema: {
      body: CreateReviewCycleBodySchema,
      response: { 201: ReviewCycleSchema },
    },
  }, async (req, reply) => {
    const creato = await reviewCyclesService.create(actor(req), req.body);
    reply.code(201);
    return creato;
  });

  /** Il passaggio di stato e' una rotta a se': non e' un PATCH generico sui campi, perche'
   *  cambiare stato non e' modificare un attributo — e' far avanzare un processo. */
  app.post("/:cycleId/transition", {
    config: { orgGate: "catalog" },
    preHandler: [app.verifyCsrf, requirePermission("review-cycle:manage")],
    schema: {
      params: ReviewCycleParamSchema,
      body: ReviewCycleTransitionBodySchema,
      response: { 200: ReviewCycleSchema },
    },
  }, async (req) => reviewCyclesService.transition(actor(req), req.params.cycleId, req.body.to));
};
