/**
 * apps/api/src/modules/delegations/routes.ts — #99 F6b.
 *
 * Quattro rotte: leggere, leggere una, conferire, revocare. **Non esiste una PATCH**: una
 * delega non si «modifica» — se le condizioni cambiano si revoca quella e se ne conferisce
 * un'altra, così la storia resta leggibile invece di essere sovrascritta.
 *
 * `orgGate: "service"` su tutte: il servizio governa l'esposizione (filtro tenant + mandato),
 * ed è la dichiarazione che ADR-0031 pretende da ogni rotta che tocchi persone.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import {
  CreateDelegationBodySchema,
  DelegationIdParamSchema,
  DelegationListQuerySchema,
  DelegationListResponseSchema,
  DelegationSchema,
  RevokeDelegationBodySchema,
} from "@heuresys/shared";
import { delegationsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const delegationsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    config: { orgGate: "service" },
    preHandler: [requirePermission("delegation:read")],
    schema: {
      querystring: DelegationListQuerySchema,
      response: { 200: DelegationListResponseSchema },
    },
  }, async (req) => delegationsService.list(actor(req), req.query));

  app.get("/:id", {
    config: { orgGate: "service" },
    preHandler: [requirePermission("delegation:read")],
    schema: { params: DelegationIdParamSchema, response: { 200: DelegationSchema } },
  }, async (req) => delegationsService.get(actor(req), req.params.id));

  app.post("/", {
    config: { orgGate: "service" },
    preHandler: [app.verifyCsrf, requirePermission("delegation:manage")],
    schema: { body: CreateDelegationBodySchema, response: { 201: DelegationSchema } },
  }, async (req, reply) => {
    const creata = await delegationsService.create(actor(req), req.body);
    return reply.code(201).send(creata);
  });

  // La revoca è una POST e non una DELETE: non si cancella una delega, si registra che è
  // stata revocata. L'atto avvenuto resta un fatto amministrativo.
  app.post("/:id/revoke", {
    config: { orgGate: "service" },
    preHandler: [app.verifyCsrf, requirePermission("delegation:manage")],
    schema: {
      params: DelegationIdParamSchema,
      body: RevokeDelegationBodySchema,
      response: { 200: DelegationSchema },
    },
  }, async (req) => delegationsService.revoke(actor(req), req.params.id, req.body.reason ?? null));
};
