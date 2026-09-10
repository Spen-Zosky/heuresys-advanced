/**
 * apps/api/src/modules/branches/routes.ts
 * B14 (2026-09-10) — 2 endpoint sotto /v1/branches, sola lettura.
 *
 * LE DICHIARAZIONI DI CANCELLO, verificate in `lib/scope/gate.ts` PRIMA di scrivere queste
 * rotte e non dopo:
 *   · `orgGate`/`tenantGate` raccolgono le rotte di lettura su risorse SENSIBILI della
 *     tassonomia (`data-classes.ts`). `branch` non è sensibile — una filiale è un luogo:
 *     codice, indirizzo, orari, zona regolamentare, e le uniche colonne verso `sys_users` sono
 *     `created_by`/`updated_by`, che sono attori. È dichiarata in
 *     `RESOURCE_SENZA_DATI_DI_PERSONA`, che è un'AFFERMAZIONE e non un'esenzione: se un domani
 *     questa tabella portasse un dato di persona, quella riga diventerebbe una bugia scritta
 *     col proprio nome.
 *   · `catalogGate` raccoglie le rotte su un CATALOGO di piattaforma (`RISORSE_DI_CATALOGO`).
 *     `branch` non lo è: porta `branch_tenant_id`, è dato di cliente.
 * Quindi nessuna delle tre dichiarazioni si applica, e il confine che conta — quello fra
 * clienti — è nel servizio, dove I5 lo vuole (FK più filtro, mai RLS).
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";

import {
  BranchSchema,
  BranchListQuerySchema,
  BranchListResponseSchema,
  BranchIdParamSchema,
} from "@heuresys/shared";
import { branchesService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const branchesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("branch:list")],
    schema: { querystring: BranchListQuerySchema, response: { 200: BranchListResponseSchema } },
  }, async (req) => branchesService.list(actor(req), req.query));

  app.get("/:id", {
    preHandler: [requirePermission("branch:read")],
    schema: { params: BranchIdParamSchema, response: { 200: BranchSchema } },
  }, async (req) => branchesService.getById(actor(req), req.params.id));
};
