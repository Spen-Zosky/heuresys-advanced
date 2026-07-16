/**
 * apps/api/src/modules/provenance/routes.ts — /v1/provenance/* (#28, S1018).
 * READ-only Trust Ledger over the ingestion lineage (AI-Act / GDPR art.22
 * audit surface: what was imported from where, with what confidence, AI-assist
 * and human-approval marks).
 *
 * D-51 note: `provenance` is deliberately NOT in RESOURCE_DATA_CLASS — lineage
 * rows are record-provenance metadata (table names, ids, hashes, confidence),
 * not person-level content; access control is RBAC-only (provenance:read →
 * PLATFORM_ADMIN + TENANT_ADMIN, mig 000171) + tenant filter in the service.
 */
import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import {
  ProvenanceListQuerySchema, ProvenanceListResponseSchema,
  ProvenanceSummaryResponseSchema,
} from "@heuresys/shared";
import { provenanceService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const provenanceRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("provenance:read")],
    schema: { querystring: ProvenanceListQuerySchema, response: { 200: ProvenanceListResponseSchema } },
  }, async (req) => provenanceService.list(actor(req), req.query));

  app.get("/summary", {
    preHandler: [requirePermission("provenance:read")],
    schema: {
      querystring: z.object({ runId: z.uuid().optional() }),
      response: { 200: ProvenanceSummaryResponseSchema },
    },
  }, async (req) => provenanceService.summary(actor(req), req.query.runId));
};
