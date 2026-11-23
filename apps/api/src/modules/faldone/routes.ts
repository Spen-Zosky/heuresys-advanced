/**
 * apps/api/src/modules/faldone/routes.ts — il Faldone dell'Utente.
 *
 * Due porte, la stessa lettura:
 *   /v1/faldone/:userId/...  — chi ha titolo legge un'altra persona (permesso `user:read`, cancello
 *                              organizzativo nel servizio, come il dossier: I18, 404 fuori portata);
 *   /v1/me/faldone/...       — ognuno legge il proprio (permesso `user_profile:read:self`, I17).
 *
 * Per ciascuna: l'indice (`/`), una sezione a pagine (`/sezioni/:sezione`), il faldone completo
 * (`/completo`, pensato per gli agenti: una chiamata sola, righe per sezione dichiarate e troncatura
 * dichiarata).
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest } from "../../lib/actor.js";
import { requirePermission } from "../../middleware/rbac.js";
import {
  FaldoneParamSchema, FaldoneIndiceQuerySchema, FaldoneSezioneParamSchema, FaldoneSezioneSelfParamSchema,
  FaldonePaginaQuerySchema, FaldoneCompletoQuerySchema,
  FaldoneIndiceSchema, FaldoneRigheSchema, FaldoneCompletoSchema,
} from "@heuresys/shared";
import { faldoneService } from "./service.js";

export const faldoneRoutes: FastifyPluginAsyncZod = async (app) => {
  const cfg = { orgGate: "service" as const, tenantGate: "service" as const };

  app.get("/:userId", {
    config: cfg,
    preHandler: [requirePermission("user:read")],
    schema: { params: FaldoneParamSchema, querystring: FaldoneIndiceQuerySchema, response: { 200: FaldoneIndiceSchema } },
  }, async (req) => faldoneService.indice(actorFromRequest(req), req.params.userId, req.query.lingua));

  app.get("/:userId/sezioni/:sezione", {
    config: cfg,
    preHandler: [requirePermission("user:read")],
    schema: { params: FaldoneSezioneParamSchema, querystring: FaldonePaginaQuerySchema, response: { 200: FaldoneRigheSchema } },
  }, async (req) => faldoneService.sezione(actorFromRequest(req), req.params.userId, req.params.sezione, req.query));

  app.get("/:userId/completo", {
    config: cfg,
    preHandler: [requirePermission("user:read")],
    schema: { params: FaldoneParamSchema, querystring: FaldoneCompletoQuerySchema, response: { 200: FaldoneCompletoSchema } },
  }, async (req) => faldoneService.completo(actorFromRequest(req), req.params.userId, req.query));
};

export const faldoneSelfRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("user_profile:read:self")],
    schema: { querystring: FaldoneIndiceQuerySchema, response: { 200: FaldoneIndiceSchema } },
  }, async (req) => {
    const a = actorFromRequest(req);
    return faldoneService.indice(a, a.userId, req.query.lingua);
  });

  app.get("/sezioni/:sezione", {
    preHandler: [requirePermission("user_profile:read:self")],
    schema: { params: FaldoneSezioneSelfParamSchema, querystring: FaldonePaginaQuerySchema, response: { 200: FaldoneRigheSchema } },
  }, async (req) => {
    const a = actorFromRequest(req);
    return faldoneService.sezione(a, a.userId, req.params.sezione, req.query);
  });

  app.get("/completo", {
    preHandler: [requirePermission("user_profile:read:self")],
    schema: { querystring: FaldoneCompletoQuerySchema, response: { 200: FaldoneCompletoSchema } },
  }, async (req) => {
    const a = actorFromRequest(req);
    return faldoneService.completo(a, a.userId, req.query);
  });
};
