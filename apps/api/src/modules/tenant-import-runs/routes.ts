/**
 * apps/api/src/modules/tenant-import-runs/routes.ts
 * #206 T8 — la superficie della corsa di importazione (Tenant Builder P4).
 *
 * NESSUN PERMESSO NUOVO, ed e' verificato sul codice: le rotte usano solo
 * `seed_acquisition:read` e `seed_acquisition:trigger`, che i cinque moduli dell'acquisizione
 * usano gia'. La FIRMA non passa da qui: e' una richiesta di approvazione, e si decide in
 * `/v1/approvals` come ogni altra (E26) — chi non detiene `seed_acquisition:approve` non e' fra
 * gli approvatori, quindi non ha un passo da decidere.
 */
import { actorFromRequest as actor } from "../../lib/actor.js";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  CreateTenantImportRunBodySchema,
  RegisterTenantImportSourceBodySchema,
  RegisterTenantImportSourceResponseSchema,
  SubmitTenantImportRunResponseSchema,
  TenantImportRunDetailSchema,
  TenantImportRunIdParamSchema,
  TenantImportRunListQuerySchema,
  TenantImportRunListResponseSchema,
} from "@heuresys/shared";
import { requirePermission } from "../../middleware/rbac.js";
import { tenantImportRunsService } from "./service.js";

export const tenantImportRunsRoutes: FastifyPluginAsyncZod = async (app) => {
  /** T2+T3: l'estrazione del cliente diventa una fonte con impronta; le righe atterrano senza tipi. */
  app.post("/sources", {
    preHandler: [app.verifyCsrf, requirePermission("seed_acquisition:trigger")],
    schema: { body: RegisterTenantImportSourceBodySchema, response: { 201: RegisterTenantImportSourceResponseSchema } },
  }, async (req, reply) => {
    const r = await tenantImportRunsService.registraFonte(actor(req), req.body);
    reply.code(201).send(r);
  });

  app.get("/", {
    preHandler: [requirePermission("seed_acquisition:read")],
    schema: { querystring: TenantImportRunListQuerySchema, response: { 200: TenantImportRunListResponseSchema } },
  }, async (req) => tenantImportRunsService.list(actor(req), req.query));

  app.get("/:id", {
    preHandler: [requirePermission("seed_acquisition:read")],
    schema: { params: TenantImportRunIdParamSchema, response: { 200: TenantImportRunDetailSchema } },
  }, async (req) => tenantImportRunsService.dettaglio(actor(req), req.params.id));

  /** T4: la corsa, con ogni persona validata contro il profilo atteso (E19). */
  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("seed_acquisition:trigger")],
    schema: { body: CreateTenantImportRunBodySchema, response: { 201: TenantImportRunDetailSchema } },
  }, async (req, reply) => {
    const r = await tenantImportRunsService.apriCorsa(actor(req), req.body);
    reply.code(201).send(r);
  });

  /** E26: la corsa va alla firma. */
  app.post("/:id/submit", {
    preHandler: [app.verifyCsrf, requirePermission("seed_acquisition:trigger")],
    schema: { params: TenantImportRunIdParamSchema, response: { 201: SubmitTenantImportRunResponseSchema } },
  }, async (req, reply) => {
    const r = await tenantImportRunsService.sottometti(actor(req), req.params.id);
    reply.code(201).send(r);
  });
};
