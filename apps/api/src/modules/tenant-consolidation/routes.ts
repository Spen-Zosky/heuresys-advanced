/**
 * apps/api/src/modules/tenant-consolidation/routes.ts — AC-9.
 *
 * Le rotte del consolidamento del tenant. Lettura e decisione ammettono due strade: il permesso
 * del ruolo (`consolidation:read`/`consolidation:decide`) oppure una delega `CONSOLIDATION` in
 * vigore (mig 000465), che il delegato riceve dal Direttore HR senza cambiare ruolo. Il
 * servizio poi limita il delegato ai gruppi della sua delega. Avviare una sessione resta del
 * ruolo (`consolidation:run`); approvare il vocabolario comune è della piattaforma.
 *
 * Il vocabolario comune ha un prefisso suo (`/v1/consolidation-vocabulary`) perché non è di un
 * tenant: è la tabella delle equivalenze che la piattaforma approva per tutti (disegno §4).
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from "fastify";
import { z } from "zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import { pool } from "../../db/client.js";
import { requirePermission, userHasPermission } from "../../middleware/rbac.js";
import { ForbiddenError, UnauthorizedError } from "../../errors/index.js";
import {
  ConfirmCertainBodySchema,
  ApprovalPreviewSchema,
  CascadeResponseSchema,
  DiscardResultSchema,
  PendingApprovalSchema,
  ConfirmCertainResponseSchema,
  ConsolidationAccessSchema,
  ConsolidationGroupSchema,
  ApplyChangesResultSchema,
  AvailableDeliveryListResponseSchema,
  BlueprintRunIdParamSchema,
  BlueprintRunListResponseSchema,
  BlueprintRunSchema,
  ReceiveDeliveryBodySchema,
  PendingChangesSchema,
  ConsolidationProposalSchema,
  ConsolidationIdParamSchema,
  ConsolidationListResponseSchema,
  ConsolidationProgressResponseSchema,
  ConsolidationProposalListQuerySchema,
  ConsolidationProposalListResponseSchema,
  ConsolidationRunStartedSchema,
  DecideProposalBodySchema,
  StartConsolidationBodySchema,
  TenantConsolidationSchema,
  VocabularyDecideBodySchema,
  VocabularyEquivalenceSchema,
  VocabularyListResponseSchema,
} from "@heuresys/shared";
import { tenantConsolidationService as svc } from "./service.js";
import { activeConsolidationDelegations } from "./repository.js";

/**
 * Il permesso del ruolo, oppure una delega di consolidamento in vigore. Il controllo del ruolo
 * è quello di sempre (`requirePermission`); la delega si guarda solo quando il ruolo non basta.
 */
function ruoloODelega(code: string, perRuolo: preHandlerAsyncHookHandler): preHandlerAsyncHookHandler {
  const handler: preHandlerAsyncHookHandler = async function (this: unknown, req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    if (userHasPermission(req.user, code) || !req.user.tenantId) {
      return perRuolo.call(this as never, req, reply);
    }
    const deleghe = await activeConsolidationDelegations(pool, req.user.tenantId, req.user.userId);
    if (deleghe.length === 0) throw new ForbiddenError(`Missing permission: ${code}`);
  };
  return Object.assign(handler, { permissionCode: code });
}

const LEGGE = ruoloODelega("consolidation:read", requirePermission("consolidation:read"));
const DECIDE = ruoloODelega("consolidation:decide", requirePermission("consolidation:decide"));
const PROPOSTA = z.object({ proposalId: z.uuid() });
const GRUPPO = z.object({ id: z.uuid(), group: ConsolidationGroupSchema });

export const tenantConsolidationRoutes: FastifyPluginAsyncZod = async (app) => {
  const conf = { orgGate: "service", tenantGate: "service" } as const;

  // Che cosa può fare chi chiama: la pagina mostra i gruppi e i bottoni da qui, non da ipotesi.
  app.get("/access", {
    config: conf,
    preHandler: [LEGGE],
    schema: { response: { 200: ConsolidationAccessSchema } },
  }, async (req) => svc.access(actor(req)));

  app.get("/", {
    config: conf,
    preHandler: [LEGGE],
    schema: { response: { 200: ConsolidationListResponseSchema } },
  }, async (req) => ({ items: await svc.list(actor(req)) }));

  app.get("/:id", {
    config: conf,
    preHandler: [LEGGE],
    schema: { params: ConsolidationIdParamSchema, response: { 200: TenantConsolidationSchema } },
  }, async (req) => svc.get(actor(req), req.params.id));

  app.post("/", {
    config: conf,
    preHandler: [app.verifyCsrf, requirePermission("consolidation:run")],
    schema: { body: StartConsolidationBodySchema, response: { 201: TenantConsolidationSchema } },
  }, async (req, reply) => reply.code(201).send(await svc.start(actor(req), req.body)));

  app.get("/:id/proposals", {
    config: conf,
    preHandler: [LEGGE],
    schema: {
      params: ConsolidationIdParamSchema,
      querystring: ConsolidationProposalListQuerySchema,
      response: { 200: ConsolidationProposalListResponseSchema },
    },
  }, async (req) => ({ items: await svc.proposals(actor(req), req.params.id, req.query.group) }));

  app.get("/:id/progress", {
    config: conf,
    preHandler: [LEGGE],
    schema: { params: ConsolidationIdParamSchema, response: { 200: ConsolidationProgressResponseSchema } },
  }, async (req) => ({ groups: await svc.progress(actor(req), req.params.id) }));

  // I giri del gruppo aperto: si avviano e la risposta torna subito (202); l'esito si legge dal registro.
  app.post("/:id/groups/:group/run", {
    config: conf,
    preHandler: [app.verifyCsrf, requirePermission("consolidation:run")],
    schema: { params: GRUPPO, response: { 202: ConsolidationRunStartedSchema } },
  }, async (req, reply) => reply.code(202).send(await svc.runGroup(actor(req), req.params.id, req.params.group)));

  app.post("/:id/groups/:group/close", {
    config: conf,
    preHandler: [app.verifyCsrf, requirePermission("consolidation:run")],
    schema: { params: GRUPPO, response: { 200: TenantConsolidationSchema } },
  }, async (req) => svc.closeGroup(actor(req), req.params.id, req.params.group));

  app.post("/proposals/:proposalId/decision", {
    config: conf,
    preHandler: [app.verifyCsrf, DECIDE],
    schema: { params: PROPOSTA, body: DecideProposalBodySchema, response: { 200: ConsolidationProposalSchema } },
  }, async (req) => svc.decide(actor(req), req.params.proposalId, req.body));

  app.get("/:id/pending-changes", {
    config: conf,
    preHandler: [LEGGE],
    schema: { params: ConsolidationIdParamSchema, response: { 200: PendingChangesSchema } },
  }, async (req) => svc.pendingChanges(actor(req), req.params.id));

  app.post("/:id/apply-changes", {
    config: conf,
    preHandler: [app.verifyCsrf, DECIDE],
    schema: { params: ConsolidationIdParamSchema, response: { 200: ApplyChangesResultSchema } },
  }, async (req) => svc.applyChanges(actor(req), req.params.id));

  // La bozza: anteprima dell'approvazione (transazione annullata) e scarto delle decisioni non approvate.
  app.post("/:id/preview-changes", {
    config: conf,
    preHandler: [app.verifyCsrf, DECIDE],
    schema: { params: ConsolidationIdParamSchema, response: { 200: ApprovalPreviewSchema } },
  }, async (req) => svc.previewChanges(actor(req), req.params.id));

  app.post("/:id/discard-changes", {
    config: conf,
    preHandler: [app.verifyCsrf, DECIDE],
    schema: { params: ConsolidationIdParamSchema, response: { 200: DiscardResultSchema } },
  }, async (req) => svc.discardChanges(actor(req), req.params.id));

  // L'avviso nell'intestazione: ci sono modifiche nella bozza non ancora approvate?
  app.get("/pending-approval", {
    config: conf,
    preHandler: [LEGGE],
    schema: { response: { 200: PendingApprovalSchema } },
  }, async (req) => svc.pendingApproval(actor(req)));

  app.get("/proposals/:proposalId/cascade", {
    config: conf,
    preHandler: [LEGGE],
    schema: { params: PROPOSTA, response: { 200: CascadeResponseSchema } },
  }, async (req) => svc.cascade(actor(req), req.params.proposalId));

  app.post("/proposals/confirm-certain", {
    config: conf,
    preHandler: [app.verifyCsrf, DECIDE],
    schema: { body: ConfirmCertainBodySchema, response: { 200: ConfirmCertainResponseSchema } },
  }, async (req) => svc.confirmCertain(actor(req), req.body.proposalIds));
};

export const consolidationVocabularyRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    config: { orgGate: "service", tenantGate: "service" },
    preHandler: [requirePermission("consolidation:read")],
    schema: { response: { 200: VocabularyListResponseSchema } },
  }, async () => ({ items: await svc.vocabulary() }));

  app.post("/:id/status", {
    config: { orgGate: "service", tenantGate: "service" },
    preHandler: [app.verifyCsrf, requirePermission("vocabulary:approve")],
    schema: {
      params: ConsolidationIdParamSchema,
      body: VocabularyDecideBodySchema,
      response: { 200: VocabularyEquivalenceSchema },
    },
  }, async (req) => svc.decideVocabulary(actor(req), req.params.id, req.body.status));
};

/**
 * Il registro delle corse del modello (000489): ha un prefisso suo (`/v1/consolidation-runs`) perché
 * le sue rotte statiche non si mescolano con `/:id` delle sessioni. Leggere segue il consolidamento
 * (ruolo o delega); accogliere una consegna è di chi avvia le sessioni; rendere definitiva una corsa è
 * del Direttore HR, e il servizio lo ricontrolla.
 */
export const consolidationRunRoutes: FastifyPluginAsyncZod = async (app) => {
  const conf = { orgGate: "service", tenantGate: "service" } as const;

  app.get("/", {
    config: conf,
    preHandler: [LEGGE],
    schema: { response: { 200: BlueprintRunListResponseSchema } },
  }, async (req) => ({ items: await svc.runs(actor(req)) }));

  app.get("/deliveries", {
    config: conf,
    // Le consegne sono il catalogo dei prototipi del datastore: le vede chi può accoglierle, non ogni lettore.
    preHandler: [requirePermission("consolidation:run")],
    schema: { response: { 200: AvailableDeliveryListResponseSchema } },
  }, async (req) => svc.deliveries(actor(req)));

  app.post("/receive", {
    config: conf,
    preHandler: [app.verifyCsrf, requirePermission("consolidation:run")],
    schema: { body: ReceiveDeliveryBodySchema, response: { 200: BlueprintRunSchema } },
  }, async (req) => svc.receive(actor(req), req.body));

  app.post("/:runId/definitive", {
    config: conf,
    preHandler: [app.verifyCsrf, DECIDE],
    schema: { params: BlueprintRunIdParamSchema, response: { 200: BlueprintRunSchema } },
  }, async (req) => svc.makeDefinitive(actor(req), req.params.runId));
};
