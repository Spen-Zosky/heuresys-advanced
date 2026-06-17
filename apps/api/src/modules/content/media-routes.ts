/**
 * apps/api/src/modules/content/media-routes.ts
 * cap④ CMS P3 — media attachments under /v1/content:
 *   POST   /:id/media          upload (multipart, content:update + CSRF)
 *   GET    /:id/media          list   (content:read)
 *   GET    /media/:mediaId     download stream (content:read, attachment)
 *   DELETE /media/:mediaId     remove (content:update + CSRF)
 * Registered as a second plugin on the /v1/content prefix (app.ts step 13).
 * No new permissions: media is part of the document resource.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import multipart from "@fastify/multipart";

import {
  ContentMediaItemSchema,
  ListContentMediaResponseSchema,
  ContentMediaDocParamSchema,
  ContentMediaIdParamSchema,
  ContentMediaDeleteResponseSchema,
} from "@heuresys/shared";
import { env } from "../../config/env.js";
import { requirePermission } from "../../middleware/rbac.js";
import { ValidationError } from "../../errors/index.js";
import { createMediaService, MEDIA_MAX_BYTES } from "./media-service.js";
import { LocalDiskStore, type ObjectStore } from "./media-store.js";

export interface ContentMediaRoutesOptions {
  /** Override the blob store (tests use a temp dir). */
  store?: ObjectStore;
}

export const contentMediaRoutes: FastifyPluginAsyncZod<ContentMediaRoutesOptions> = async (
  app,
  opts,
) => {
  const store = opts.store ?? new LocalDiskStore(env.MEDIA_STORAGE_DIR);
  const service = createMediaService(store);

  // Scoped to this plugin only; one file per request, hard byte cap.
  await app.register(multipart, {
    limits: { files: 1, fileSize: MEDIA_MAX_BYTES },
  });

  /* --- POST /:id/media — upload -------------------------------------- */
  app.post(
    "/:id/media",
    {
      preHandler: [app.verifyCsrf, requirePermission("content:update")],
      schema: {
        params: ContentMediaDocParamSchema,
        response: { 201: ContentMediaItemSchema },
      },
      config: { rateLimit: { max: 60, timeWindow: 60 * 60 * 1000 } },
    },
    async (req, reply) => {
      const file = await req.file();
      if (!file) {
        throw new ValidationError({ field: "file" }, "Multipart file field required");
      }
      // toBuffer() throws if the stream exceeded the multipart fileSize limit.
      const data = await file.toBuffer();
      const out = await service.upload(actor(req), req.params.id, {
        filename: file.filename || "upload",
        mime: file.mimetype,
        data,
      });
      reply.code(201).send(out);
    },
  );

  /* --- GET /:id/media — list ------------------------------------------ */
  app.get(
    "/:id/media",
    {
      preHandler: [requirePermission("content:read")],
      schema: {
        params: ContentMediaDocParamSchema,
        response: { 200: ListContentMediaResponseSchema },
      },
    },
    async (req) => service.list(actor(req), req.params.id),
  );

  /* --- GET /media/:mediaId — download stream --------------------------- */
  // Response is a binary stream — no zod response schema (passthrough).
  app.get(
    "/media/:mediaId",
    {
      preHandler: [requirePermission("content:read")],
      schema: { params: ContentMediaIdParamSchema },
    },
    async (req, reply) => {
      const { row, stream } = await service.resolveForDownload(actor(req), req.params.mediaId);
      // Attachment semantics (download), never inline: keeps any future
      // content-type quirk from executing in the app origin.
      const safeName = row.filename.replace(/[^\w.\- ]+/g, "_");
      reply
        .header("content-type", row.mime)
        .header("content-length", String(row.sizeBytes))
        .header("content-disposition", `attachment; filename="${safeName}"`)
        .header("x-content-type-options", "nosniff");
      return reply.send(stream);
    },
  );

  /* --- DELETE /media/:mediaId ------------------------------------------ */
  app.delete(
    "/media/:mediaId",
    {
      preHandler: [app.verifyCsrf, requirePermission("content:update")],
      schema: {
        params: ContentMediaIdParamSchema,
        response: { 200: ContentMediaDeleteResponseSchema },
      },
    },
    async (req) => {
      await service.remove(actor(req), req.params.mediaId);
      return { deleted: true as const };
    },
  );
};
