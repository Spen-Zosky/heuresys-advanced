/**
 * apps/api/src/modules/content/media-repository.ts
 * Raw parameterised SQL against sys.sys_content_media (cap④ CMS P3).
 */

import type { Pool, PoolClient } from "pg";

export type DbConnector = Pool | PoolClient;

export interface MediaRow {
  mediaId: string;
  tenantId: string;
  documentId: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  sha256: string;
  storageKey: string;
  uploadedBy: string | null;
  createdAt: Date;
}

interface RawRow {
  media_id: string;
  tenant_id: string;
  document_id: string;
  filename: string;
  mime: string;
  size_bytes: string; // bigint comes back as string from pg
  sha256: string;
  storage_key: string;
  uploaded_by: string | null;
  created_at: Date;
}

const COLS = `
  media_id          AS media_id,
  media_tenant_id   AS tenant_id,
  media_document_id AS document_id,
  media_filename    AS filename,
  media_mime        AS mime,
  media_size_bytes  AS size_bytes,
  media_sha256      AS sha256,
  media_storage_key AS storage_key,
  media_uploaded_by AS uploaded_by,
  created_at
`;

function toRow(r: RawRow): MediaRow {
  return {
    mediaId: r.media_id,
    tenantId: r.tenant_id,
    documentId: r.document_id,
    filename: r.filename,
    mime: r.mime,
    sizeBytes: Number(r.size_bytes),
    sha256: r.sha256,
    storageKey: r.storage_key,
    uploadedBy: r.uploaded_by,
    createdAt: r.created_at,
  };
}

export async function insertMedia(
  db: DbConnector,
  input: {
    mediaId: string;
    tenantId: string;
    documentId: string;
    filename: string;
    mime: string;
    sizeBytes: number;
    sha256: string;
    storageKey: string;
    uploadedBy: string;
  },
): Promise<MediaRow> {
  const result = await db.query<RawRow>(
    `INSERT INTO sys.sys_content_media
       (media_id, media_tenant_id, media_document_id, media_filename, media_mime,
        media_size_bytes, media_sha256, media_storage_key, media_uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${COLS}`,
    [
      input.mediaId,
      input.tenantId,
      input.documentId,
      input.filename,
      input.mime,
      input.sizeBytes,
      input.sha256,
      input.storageKey,
      input.uploadedBy,
    ],
  );
  return toRow(result.rows[0]!);
}

export async function listMediaForDocument(
  db: DbConnector,
  documentId: string,
): Promise<MediaRow[]> {
  const result = await db.query<RawRow>(
    `SELECT ${COLS} FROM sys.sys_content_media
      WHERE media_document_id = $1 ORDER BY created_at DESC`,
    [documentId],
  );
  return result.rows.map(toRow);
}

export async function findMediaById(
  db: DbConnector,
  mediaId: string,
): Promise<MediaRow | null> {
  const result = await db.query<RawRow>(
    `SELECT ${COLS} FROM sys.sys_content_media WHERE media_id = $1`,
    [mediaId],
  );
  const row = result.rows[0];
  return row ? toRow(row) : null;
}

export async function deleteMedia(db: DbConnector, mediaId: string): Promise<boolean> {
  const result = await db.query(`DELETE FROM sys.sys_content_media WHERE media_id = $1`, [mediaId]);
  return (result.rowCount ?? 0) > 0;
}
