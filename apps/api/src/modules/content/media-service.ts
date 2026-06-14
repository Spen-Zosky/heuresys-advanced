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
import { findDocumentById, findPublishedByIdForTenant, type ScopeFilter } from "./repository.js";
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

/**
 * Magic-byte sniff (QW-H2 / F-WS-H1-6). The declared Content-Type (file.mime) is
 * client-controlled; the ALLOWED_MIME allowlist alone trusts that header. We
 * verify the REAL leading bytes against the 5 allowlisted signatures and persist
 * the SNIFFED mime so the stored/echoed content-type can't be spoofed (the ESS
 * path serves images inline). Hand-rolled (conservative) — returns the canonical
 * mime or null if the bytes match none of the allowlisted types.
 */
function sniffMime(buf: Buffer): string | null {
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return "image/png";
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (buf.length >= 4 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    return "image/gif"; // "GIF8" (87a/89a)
  }
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && // "RIFF"
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50 // "WEBP"
  ) {
    return "image/webp";
  }
  if (buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
    return "application/pdf"; // "%PDF"
  }
  return null;
}

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
      // QW-H2 (F-WS-H1-6): verify the real bytes match the declared (allowlisted)
      // type — a client cannot pass a non-image body as image/png. Persist the
      // sniffed mime below so the stored content-type is trustworthy.
      const sniffedMime = sniffMime(file.data);
      if (sniffedMime === null || sniffedMime !== file.mime) {
        throw new ValidationError(
          { declaredMime: file.mime, detectedMime: sniffedMime },
          "Media content does not match its declared type",
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
        mime: sniffedMime, // sniffed == declared here, but store the trusted value
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

    /* --- ESS (published-only) surface — S982 cap④ close ---------------- */
    /** List the media of a PUBLISHED document in the caller's tenant (draft /
     *  cross-tenant -> 404, no existence leak — mirrors getPublishedForMe). */
    async listForPublishedDocument(
      tenantId: string,
      documentId: string,
    ): Promise<{ items: MediaItem[]; total: number }> {
      const doc = await findPublishedByIdForTenant(pool, tenantId, documentId);
      if (!doc) throw new NotFoundError("Content document");
      const items = (await mediaRepo.listMediaForDocument(pool, documentId)).map(toApi);
      return { items, total: items.length };
    },

    /** Resolve a media row whose owning document is PUBLISHED in the caller's
     *  tenant; the route streams the blob (inline for images — the upload
     *  mime-allowlist excludes SVG, so inline render is safe). */
    async resolveForDownloadPublished(tenantId: string, mediaId: string) {
      const row = await mediaRepo.findMediaById(pool, mediaId);
      if (!row) throw new NotFoundError("Media");
      const doc = await findPublishedByIdForTenant(pool, tenantId, row.documentId);
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
