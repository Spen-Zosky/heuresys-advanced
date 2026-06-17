/**
 * apps/api/src/modules/content-blueprint-links/routes.ts
 * /v1/content-blueprint-links/* — cap④ CMS P3 content↔blueprint cross-link.
 * Writes = content:update + CSRF (attaching documentation is an edit to the content
 * side). Doc-side read = content:read; blueprint-side reads = blueprint:read.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import { z } from "zod";

import {
  ContentBlueprintLinkSchema,
  ContentBlueprintLinkCreateSchema,
  ContentBlueprintLinkIdParamSchema,
  LinksByDocumentQuerySchema,
  LinksByProcessQuerySchema,
  LinksByVariantQuerySchema,
  LinksForDocumentResponseSchema,
  LinksForProcessResponseSchema,
} from "@heuresys/shared";
import { contentBlueprintLinkService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

const DeleteResponse = z.object({ deleted: z.literal(true) });

export const contentBlueprintLinksRoutes: FastifyPluginAsyncZod = async (app) => {
  /* --- writes (content:update + CSRF) --- */
  app.post(
    "/",
    { preHandler: [app.verifyCsrf, requirePermission("content:update")], schema: { body: ContentBlueprintLinkCreateSchema, response: { 200: ContentBlueprintLinkSchema } } },
    async (req) => contentBlueprintLinkService.createLink(actor(req), req.body),
  );
  app.delete(
    "/:id",
    { preHandler: [app.verifyCsrf, requirePermission("content:update")], schema: { params: ContentBlueprintLinkIdParamSchema, response: { 200: DeleteResponse } } },
    async (req) => { await contentBlueprintLinkService.deleteLink(actor(req), req.params.id); return { deleted: true as const }; },
  );

  /* --- doc-side read (content:read) --- */
  app.get(
    "/by-document",
    { preHandler: [requirePermission("content:read")], schema: { querystring: LinksByDocumentQuerySchema, response: { 200: LinksForDocumentResponseSchema } } },
    async (req) => contentBlueprintLinkService.listForDocument(actor(req), req.query.documentId),
  );

  /* --- blueprint-side reads (blueprint:read) --- */
  app.get(
    "/by-process",
    { preHandler: [requirePermission("blueprint:read")], schema: { querystring: LinksByProcessQuerySchema, response: { 200: LinksForProcessResponseSchema } } },
    async (req) => contentBlueprintLinkService.listForProcess(actor(req), req.query.blueprintProcessId),
  );
  app.get(
    "/by-variant",
    { preHandler: [requirePermission("blueprint:read")], schema: { querystring: LinksByVariantQuerySchema, response: { 200: LinksForProcessResponseSchema } } },
    async (req) => contentBlueprintLinkService.listForVariant(actor(req), req.query.variantId),
  );
};
