/**
 * apps/api/src/modules/tenant-blueprints/routes.ts
 * #131 Tenant Builder P1, T5 — le quindici rotte del fascicolo (§7).
 *
 * Ogni rotta porta `requirePermission`; ogni mutazione porta anche
 * `app.verifyCsrf`. L'ordine nel `preHandler` non e' indifferente: il CSRF
 * prima, il permesso dopo, come in tutti gli altri moduli.
 */
import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import { requirePermission } from "../../middleware/rbac.js";
import {
  TenantBlueprintSchema,
  TenantBlueprintDetailSchema,
  TenantBlueprintVersionSchema,
  TenantBlueprintListQuerySchema,
  TenantBlueprintListResponseSchema,
  CreateTenantBlueprintBodySchema,
  UpdateTenantBlueprintBodySchema,
  LinkTenantBodySchema,
  PatchIdentityBodySchema,
  PinModelBodySchema,
  PutProcessDecisionBodySchema,
  ProcessDecisionListResponseSchema,
  ModelProposalResponseSchema,
  BlueprintDiffResponseSchema,
  SubmitVersionResponseSchema,
  TenantBlueprintIdParamSchema,
  VersionParamSchema,
  ProcessParamSchema,
  DiffQuerySchema,
  BuildPlanPreviewSchema,
  ApplyVersionResponseSchema,
  AvviaRicercaBodySchema,
  CorsaRicercaSchema,
  DominiRicercabiliResponseSchema,
  ApplicaRicercaResponseSchema,
} from "@heuresys/shared";
import { researchService } from "../research/service.js";
import { tenantBlueprintsService as svc } from "./service.js";

const READ = "tenant_blueprint:read";
const WRITE = "tenant_blueprint:write";

export const tenantBlueprintsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/",
    {
      preHandler: [requirePermission(READ)],
      schema: {
        querystring: TenantBlueprintListQuerySchema,
        response: { 200: TenantBlueprintListResponseSchema },
      },
    },
    async (req) => svc.list(actor(req), req.query),
  );

  app.post(
    "/",
    {
      preHandler: [app.verifyCsrf, requirePermission(WRITE)],
      schema: {
        body: CreateTenantBlueprintBodySchema,
        response: { 201: TenantBlueprintSchema },
      },
    },
    async (req, reply) => {
      const b = await svc.create(actor(req), req.body);
      reply.code(201).send(b);
    },
  );

  app.get(
    "/:id",
    {
      preHandler: [requirePermission(READ)],
      schema: {
        params: TenantBlueprintIdParamSchema,
        response: { 200: TenantBlueprintDetailSchema },
      },
    },
    async (req) => svc.getById(actor(req), req.params.id),
  );

  app.patch(
    "/:id",
    {
      preHandler: [app.verifyCsrf, requirePermission(WRITE)],
      schema: {
        params: TenantBlueprintIdParamSchema,
        body: UpdateTenantBlueprintBodySchema,
        response: { 200: TenantBlueprintSchema },
      },
    },
    async (req) => svc.update(actor(req), req.params.id, req.body),
  );

  app.post(
    "/:id/link-tenant",
    {
      preHandler: [app.verifyCsrf, requirePermission(WRITE)],
      schema: {
        params: TenantBlueprintIdParamSchema,
        body: LinkTenantBodySchema,
        response: { 200: TenantBlueprintSchema },
      },
    },
    async (req) => svc.linkTenant(actor(req), req.params.id, req.body.tenantId),
  );

  app.get(
    "/:id/versions/:number",
    {
      preHandler: [requirePermission(READ)],
      schema: { params: VersionParamSchema, response: { 200: TenantBlueprintVersionSchema } },
    },
    async (req) => svc.getVersion(actor(req), req.params.id, req.params.number),
  );

  app.post(
    "/:id/versions",
    {
      preHandler: [app.verifyCsrf, requirePermission(WRITE)],
      schema: {
        params: TenantBlueprintIdParamSchema,
        response: { 201: TenantBlueprintVersionSchema },
      },
    },
    async (req, reply) => {
      const v = await svc.openVersion(actor(req), req.params.id);
      reply.code(201).send(v);
    },
  );

  app.patch(
    "/:id/versions/:number/identity",
    {
      preHandler: [app.verifyCsrf, requirePermission(WRITE)],
      schema: {
        params: VersionParamSchema,
        body: PatchIdentityBodySchema,
        response: { 200: TenantBlueprintVersionSchema },
      },
    },
    async (req) => svc.patchIdentity(actor(req), req.params.id, req.params.number, req.body),
  );

  app.get(
    "/:id/versions/:number/model-proposal",
    {
      preHandler: [requirePermission(READ)],
      schema: { params: VersionParamSchema, response: { 200: ModelProposalResponseSchema } },
    },
    async (req) => svc.modelProposal(actor(req), req.params.id, req.params.number),
  );

  app.put(
    "/:id/versions/:number/model",
    {
      preHandler: [app.verifyCsrf, requirePermission(WRITE)],
      schema: {
        params: VersionParamSchema,
        body: PinModelBodySchema,
        response: { 200: TenantBlueprintVersionSchema },
      },
    },
    async (req) =>
      svc.pinModel(actor(req), req.params.id, req.params.number, req.body.variantVersionId),
  );

  app.get(
    "/:id/versions/:number/processes",
    {
      preHandler: [requirePermission(READ)],
      schema: { params: VersionParamSchema, response: { 200: ProcessDecisionListResponseSchema } },
    },
    async (req) => svc.listProcesses(actor(req), req.params.id, req.params.number),
  );

  app.put(
    "/:id/versions/:number/processes/:processId",
    {
      preHandler: [app.verifyCsrf, requirePermission(WRITE)],
      schema: {
        params: ProcessParamSchema,
        body: PutProcessDecisionBodySchema,
        response: { 204: z.null() },
      },
    },
    async (req, reply) => {
      await svc.putDecision(
        actor(req),
        req.params.id,
        req.params.number,
        req.params.processId,
        req.body,
      );
      reply.code(204).send(null);
    },
  );

  app.delete(
    "/:id/versions/:number/processes/:processId",
    {
      preHandler: [app.verifyCsrf, requirePermission(WRITE)],
      schema: { params: ProcessParamSchema, response: { 204: z.null() } },
    },
    async (req, reply) => {
      await svc.deleteDecision(
        actor(req),
        req.params.id,
        req.params.number,
        req.params.processId,
      );
      reply.code(204).send(null);
    },
  );

  // #198 T6 — IL PIANO, SENZA SCRIVERE. Permesso di sola lettura: guardare cosa
  // nascerebbe non e' un atto, e pretendere `write` per una simulazione insegnerebbe a
  // chiedere il permesso piu' alto per l'operazione piu' innocua.
  app.post(
    "/:id/versions/:number/build-plan",
    {
      preHandler: [app.verifyCsrf, requirePermission(READ)],
      schema: { params: VersionParamSchema, response: { 200: BuildPlanPreviewSchema } },
    },
    async (req) => svc.buildPlan(actor(req), req.params.id, req.params.number),
  );

  // #198 T6 — L'APPLICAZIONE. NON costruisce: apre la richiesta di approvazione, e la
  // costruzione avviene quando quella viene firmata. La risposta non porta conteggi di
  // righe apposta — vederli qui farebbe credere che sia gia' successo qualcosa.
  app.post(
    "/:id/versions/:number/apply",
    {
      preHandler: [app.verifyCsrf, requirePermission(WRITE)],
      schema: { params: VersionParamSchema, response: { 200: ApplyVersionResponseSchema } },
    },
    async (req) => svc.applyVersion(actor(req), req.params.id, req.params.number),
  );

  app.post(
    "/:id/versions/:number/submit",
    {
      preHandler: [app.verifyCsrf, requirePermission(WRITE)],
      schema: { params: VersionParamSchema, response: { 200: SubmitVersionResponseSchema } },
    },
    async (req) => svc.submit(actor(req), req.params.id, req.params.number),
  );

  app.get(
    "/:id/versions/:number/diff",
    {
      preHandler: [requirePermission(READ)],
      schema: {
        params: VersionParamSchema,
        querystring: DiffQuerySchema,
        response: { 200: BlueprintDiffResponseSchema },
      },
    },
    async (req) => svc.diff(actor(req), req.params.id, req.params.number, req.query.against),
  );

  /**
   * #132 F4g — la ricerca che genera il contenuto del modello (epica P2a §6).
   *
   * `tenant_blueprint:write`, come ogni scrittura sul fascicolo: una corsa scrive proposte,
   * e le proposte sono materiale di quel fascicolo. Il permesso di DECIDERE e' un altro
   * (`seed_acquisition:approve`), e la separazione e' voluta: proporre e approvare non sono
   * lo stesso atto, e non devono poterli fare le stesse mani per distrazione.
   */
  app.get(
    "/research-domains",
    {
      preHandler: [requirePermission(READ)],
      schema: { response: { 200: DominiRicercabiliResponseSchema } },
    },
    async () => researchService.domini(),
  );

  app.post(
    "/:id/versions/:number/research",
    {
      preHandler: [app.verifyCsrf, requirePermission(WRITE)],
      schema: {
        params: VersionParamSchema,
        body: AvviaRicercaBodySchema,
        response: { 201: CorsaRicercaSchema },
      },
    },
    async (req, reply) => {
      const corsa = await researchService.avviaPerVersione(
        actor(req),
        req.params.id,
        req.params.number,
        req.body.dominio,
      );
      reply.code(201).send(corsa);
    },
  );

  /**
   * #132 F6 — il ponte: le proposte approvate diventano il contenuto del modello.
   * `tenant_blueprint:write` come l'avvio: e' una scrittura sul modello di quel fascicolo.
   */
  app.post(
    "/:id/versions/:number/apply-research",
    {
      preHandler: [app.verifyCsrf, requirePermission(WRITE)],
      schema: {
        params: VersionParamSchema,
        response: { 200: ApplicaRicercaResponseSchema },
      },
    },
    async (req) => researchService.applicaRicerca(actor(req), req.params.id, req.params.number),
  );
};
