/**
 * apps/api/src/modules/content/routes.ts
 * /v1/content/* — cap④ CMS (P1: CRUD + categories + version history).
 * Reads = content:read; writes = content:{create,update,delete} + CSRF.
 * Publish-workflow (/publish, /unpublish, /restore) + ESS (/me/content) = P2.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";
import { z } from "zod";

import {
  ContentDocumentSchema,
  ContentDocumentListResponseSchema,
  ContentDocumentDetailResponseSchema,
  ContentDocumentCreateSchema,
  ContentDocumentUpdateSchema,
  ContentDocumentFilterSchema,
  ContentVersionListResponseSchema,
  ContentCategorySchema,
  ContentCategoryListResponseSchema,
  ContentCategoryCreateSchema,
  ContentCategoryUpdateSchema,
  ContentIdParamSchema,
  ContentCategoryIdParamSchema,
  ContentVersionRestoreParamSchema,
  ContentSearchQuerySchema,
  ContentSearchResponseSchema,
} from "@heuresys/shared";
import { contentService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

const DeleteDocResponse = z.object({ outcome: z.enum(["archived", "deleted"]) });
const DeleteCatResponse = z.object({ deleted: z.literal(true) });

export const contentRoutes: FastifyPluginAsyncZod = async (app) => {
  /* --- categories (static path before /:id — radix router prioritizes static) --- */
  app.get(
    "/categories",
    { preHandler: [requirePermission("content:read")], schema: { response: { 200: ContentCategoryListResponseSchema } } },
    async (req) => contentService.listCategories(actor(req)),
  );
  app.post(
    "/categories",
    { preHandler: [app.verifyCsrf, requirePermission("content:create")], schema: { body: ContentCategoryCreateSchema, response: { 200: ContentCategorySchema } } },
    async (req) => contentService.createCategory(actor(req), req.body),
  );
  app.patch(
    "/categories/:id",
    { preHandler: [app.verifyCsrf, requirePermission("content:update")], schema: { params: ContentCategoryIdParamSchema, body: ContentCategoryUpdateSchema, response: { 200: ContentCategorySchema } } },
    async (req) => contentService.updateCategory(actor(req), req.params.id, req.body),
  );
  app.delete(
    "/categories/:id",
    { preHandler: [app.verifyCsrf, requirePermission("content:delete")], schema: { params: ContentCategoryIdParamSchema, response: { 200: DeleteCatResponse } } },
    async (req) => { await contentService.deleteCategory(actor(req), req.params.id); return { deleted: true as const }; },
  );

  /* --- P3: full-text search (static path; radix prioritizes over /:id) --- */
  app.get(
    "/search",
    { preHandler: [requirePermission("content:read")], schema: { querystring: ContentSearchQuerySchema, response: { 200: ContentSearchResponseSchema } } },
    async (req) => contentService.searchDocuments(actor(req), req.query.q, req.query.status),
  );

  /* --- documents --- */
  app.get(
    "/",
    { preHandler: [requirePermission("content:read")], schema: { querystring: ContentDocumentFilterSchema, response: { 200: ContentDocumentListResponseSchema } } },
    async (req) => contentService.listDocuments(actor(req), req.query),
  );
  app.get(
    "/:id",
    { preHandler: [requirePermission("content:read")], schema: { params: ContentIdParamSchema, response: { 200: ContentDocumentDetailResponseSchema } } },
    async (req) => contentService.getDocument(actor(req), req.params.id),
  );
  app.get(
    "/:id/versions",
    { preHandler: [requirePermission("content:read")], schema: { params: ContentIdParamSchema, response: { 200: ContentVersionListResponseSchema } } },
    async (req) => contentService.listVersions(actor(req), req.params.id),
  );
  app.post(
    "/",
    { preHandler: [app.verifyCsrf, requirePermission("content:create")], schema: { body: ContentDocumentCreateSchema, response: { 200: ContentDocumentSchema } } },
    async (req) => contentService.createDocument(actor(req), req.body),
  );
  app.patch(
    "/:id",
    { preHandler: [app.verifyCsrf, requirePermission("content:update")], schema: { params: ContentIdParamSchema, body: ContentDocumentUpdateSchema, response: { 200: ContentDocumentSchema } } },
    async (req) => contentService.updateDocument(actor(req), req.params.id, req.body),
  );
  app.delete(
    "/:id",
    { preHandler: [app.verifyCsrf, requirePermission("content:delete")], schema: { params: ContentIdParamSchema, response: { 200: DeleteDocResponse } } },
    async (req) => contentService.deleteDocument(actor(req), req.params.id),
  );

  /* --- P2: version restore + publish-workflow --- */
  app.post(
    "/:id/versions/:versionId/restore",
    { preHandler: [app.verifyCsrf, requirePermission("content:update")], schema: { params: ContentVersionRestoreParamSchema, response: { 200: ContentDocumentSchema } } },
    async (req) => contentService.restoreVersion(actor(req), req.params.id, req.params.versionId),
  );
  app.post(
    "/:id/submit-for-review",
    { preHandler: [app.verifyCsrf, requirePermission("content:update")], schema: { params: ContentIdParamSchema, response: { 200: ContentDocumentSchema } } },
    async (req) => contentService.submitForReview(actor(req), req.params.id),
  );
  app.post(
    "/:id/return-to-draft",
    { preHandler: [app.verifyCsrf, requirePermission("content:publish")], schema: { params: ContentIdParamSchema, response: { 200: ContentDocumentSchema } } },
    async (req) => contentService.returnToDraft(actor(req), req.params.id),
  );
  app.post(
    "/:id/publish",
    { preHandler: [app.verifyCsrf, requirePermission("content:publish")], schema: { params: ContentIdParamSchema, response: { 200: ContentDocumentSchema } } },
    async (req) => contentService.publishDocument(actor(req), req.params.id),
  );
  app.post(
    "/:id/unpublish",
    { preHandler: [app.verifyCsrf, requirePermission("content:publish")], schema: { params: ContentIdParamSchema, response: { 200: ContentDocumentSchema } } },
    async (req) => contentService.unpublishDocument(actor(req), req.params.id),
  );
};
