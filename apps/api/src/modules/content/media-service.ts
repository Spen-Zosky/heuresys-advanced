/**
 * apps/api/src/modules/content/media-service.ts
 * cap④ CMS P3 — content media attachments. Authorization = the DOCUMENT
 * scope-check (I5): upload/delete require the document to be writable in the
 * actor's scope (mirrors content edits), reads require it to be readable.
 * Blobs live behind the ObjectStore seam (local-disk default, S980 decision).
 */

import { createHash, randomUUID } from "node:crypto";
import { pool } from "../../db/client.js";
import type { RoleCode } from "../../config/constants.js";
import { NotFoundError, ValidationError } from "../../errors/index.js";
import { findDocumentById, type ScopeFilter } from "./repository.js";
import * as mediaRepo from "./media-repository.js";
import type { ObjectStore } from "./media-store.js";

export interface ActorContext {
  userId: string;
  tenantId: string | null;
  roles: RoleCode[];
}

function buildScope(a: ActorContext): ScopeFilter {
  const isPlatform = a.roles.includes("PLATFORM_ADMIN");
  return { isPlatform, tenantId: isPlatform ? null : a.tenantId };
}

/** Download semantics only (attachment disposition); inline render is a P3
 *  follow-up — so the list stays deliberately tight. SVG excluded (XSS). */
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

export const MEDIA_MAX_BYTES = 10 * 1024 * 1024; // 10 MiB

export interface MediaItem {
  mediaId: string;
  documentId: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  sha256: string;
  uploadedBy: string | null;
  createdAt: string;
}

const toApi = (r: mediaRepo.MediaRow): MediaItem => ({
  mediaId: r.mediaId,
  documentId: r.documentId,
  filename: r.filename,
  mime: r.mime,
  sizeBytes: r.sizeBytes,
  sha256: r.sha256,
  uploadedBy: r.uploadedBy,
  createdAt: r.createdAt.toISOString(),
});

export function createMediaService(store: ObjectStore) {
  return {
    async upload(
      a: ActorContext,
      documentId: string,
      file: { filename: string; mime: string; data: Buffer },
    ): Promise<MediaItem> {
      const doc = await findDocumentById(pool, buildScope(a), documentId);
      if (!doc) throw new NotFoundError("Content document");
      if (!ALLOWED_MIME.has(file.mime)) {
        throw new ValidationError({ mime: file.mime }, "Unsupported media type");
      }
      if (file.data.length === 0 || file.data.length > MEDIA_MAX_BYTES) {
        throw new ValidationError(
          { sizeBytes: file.data.length, max: MEDIA_MAX_BYTES },
          "Media exceeds the size limit",
        );
      }
      const mediaId = randomUUID();
      const storageKey = `${doc.tenantId}/${mediaId}`;
      // Blob first, row second: a crash in between leaves an orphan FILE
      // (harmless, unreachable, reapable) — never a row pointing at nothing.
      await store.put(storageKey, file.data);
      const row = await mediaRepo.insertMedia(pool, {
        mediaId,
        tenantId: doc.tenantId,
        documentId,
        filename: file.filename.slice(0, 255),
        mime: file.mime,
        sizeBytes: file.data.length,
        sha256: createHash("sha256").update(file.data).digest("hex"),
        storageKey,
        uploadedBy: a.userId,
      });
      return toApi(row);
    },

    async list(a: ActorContext, documentId: string): Promise<{ items: MediaItem[]; total: number }> {
      const doc = await findDocumentById(pool, buildScope(a), documentId);
      if (!doc) throw new NotFoundError("Content document");
      const items = (await mediaRepo.listMediaForDocument(pool, documentId)).map(toApi);
      return { items, total: items.length };
    },

    /** Resolve a media row the actor may read; the route streams the blob. */
    async resolveForDownload(a: ActorContext, mediaId: string) {
      const row = await mediaRepo.findMediaById(pool, mediaId);
      if (!row) throw new NotFoundError("Media");
      // Scope via the owning document (cross-tenant -> 404, no existence leak).
      const doc = await findDocumentById(pool, buildScope(a), row.documentId);
      if (!doc) throw new NotFoundError("Media");
      return { row, stream: store.createReadStream(row.storageKey) };
    },

    async remove(a: ActorContext, mediaId: string): Promise<void> {
      const row = await mediaRepo.findMediaById(pool, mediaId);
      if (!row) throw new NotFoundError("Media");
      const doc = await findDocumentById(pool, buildScope(a), row.documentId);
      if (!doc) throw new NotFoundError("Media");
      // Row first (authorization anchor gone), then the blob (idempotent).
      await mediaRepo.deleteMedia(pool, mediaId);
      await store.delete(row.storageKey);
    },
  };
}

export type MediaService = ReturnType<typeof createMediaService>;
