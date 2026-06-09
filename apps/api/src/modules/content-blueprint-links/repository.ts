/**
 * apps/api/src/modules/content-blueprint-links/repository.ts
 * cap④ CMS P3 — raw parameterized SQL for the content↔blueprint cross-link.
 *
 * Tenant isolation is pinned on link_tenant_id ONLY (I5, NEVER RLS): the blueprint
 * catalog (sys_blueprint_*) is GLOBAL and carries no tenant_id. PLATFORM_ADMIN sees
 * all tenants' links; everyone else is pinned to their own. The link row's tenant is
 * inherited from the linked document (set by the service from the scope-checked doc).
 */
import type { PoolClient } from "pg";
import { pool } from "../../db/client.js";
import type { ScopeFilter } from "../content/repository.js";

export type DbConnector = typeof pool | PoolClient;

export interface LinkRow {
  linkId: string;
  tenantId: string;
  documentId: string;
  blueprintProcessId: string;
  role: string;
  note: string | null;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LinkForDocumentRow {
  linkId: string;
  role: string;
  note: string | null;
  blueprintProcessId: string;
  blueprintProcessCode: string;
  blueprintProcessName: string;
  blueprintProcessOrdinal: number;
  blueprintVariantId: string;
  blueprintVariantName: string;
  createdAt: string;
}

export interface LinkForProcessRow {
  linkId: string;
  role: string;
  note: string | null;
  documentId: string;
  documentTitle: string;
  documentKind: string;
  documentStatus: string;
  blueprintProcessId: string;
  blueprintProcessName: string;
  createdAt: string;
}

const iso = (d: unknown): string => (d as Date).toISOString();
const LINK_COLS = `link_id, link_tenant_id, link_document_id, link_blueprint_process_id,
  link_role, link_note, link_metadata, link_created_by, created_at, updated_at`;

function mapLink(r: Record<string, unknown>): LinkRow {
  return {
    linkId: r.link_id as string,
    tenantId: r.link_tenant_id as string,
    documentId: r.link_document_id as string,
    blueprintProcessId: r.link_blueprint_process_id as string,
    role: r.link_role as string,
    note: (r.link_note as string | null) ?? null,
    metadata: (r.link_metadata as Record<string, unknown>) ?? {},
    createdBy: (r.link_created_by as string | null) ?? null,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

/** Confirm a global blueprint process exists; return its variant for navigation. */
export async function findProcessById(q: DbConnector, processId: string): Promise<{ processId: string; variantId: string } | null> {
  const res = await q.query(
    `SELECT blueprint_process_id, blueprint_process_variant_id
       FROM sys.sys_blueprint_process_registry WHERE blueprint_process_id = $1`,
    [processId],
  );
  const row = res.rows[0];
  return row ? { processId: row.blueprint_process_id as string, variantId: row.blueprint_process_variant_id as string } : null;
}

export interface InsertLinkInput {
  tenantId: string;
  createdBy: string;
  documentId: string;
  blueprintProcessId: string;
  role: string;
  note?: string | undefined;
}

export async function insertLink(q: DbConnector, input: InsertLinkInput): Promise<LinkRow> {
  const res = await q.query(
    `INSERT INTO sys.sys_content_blueprint_links
       (link_tenant_id, link_document_id, link_blueprint_process_id, link_role, link_note, link_created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${LINK_COLS}`,
    [input.tenantId, input.documentId, input.blueprintProcessId, input.role, input.note ?? null, input.createdBy],
  );
  return mapLink(res.rows[0]!);
}

export async function deleteLink(q: DbConnector, scope: ScopeFilter, id: string): Promise<boolean> {
  const params: unknown[] = [id];
  let tenant = "";
  if (!scope.isPlatform) { params.push(scope.tenantId); tenant = ` AND link_tenant_id = $2`; }
  const res = await q.query(`DELETE FROM sys.sys_content_blueprint_links WHERE link_id = $1${tenant}`, params);
  return (res.rowCount ?? 0) > 0;
}

/** Links attached to a document, with the blueprint process/variant denormalized. */
export async function listLinksForDocument(q: DbConnector, scope: ScopeFilter, documentId: string): Promise<LinkForDocumentRow[]> {
  const params: unknown[] = [documentId];
  let tenant = "";
  if (!scope.isPlatform) { params.push(scope.tenantId); tenant = ` AND l.link_tenant_id = $2`; }
  const res = await q.query(
    `SELECT l.link_id, l.link_role, l.link_note,
            l.link_blueprint_process_id, r.blueprint_process_code, r.blueprint_process_name,
            r.blueprint_process_ordinal, r.blueprint_process_variant_id, v.blueprint_variant_name, l.created_at
       FROM sys.sys_content_blueprint_links l
       JOIN sys.sys_blueprint_process_registry r ON r.blueprint_process_id = l.link_blueprint_process_id
       JOIN sys.sys_blueprint_variants v ON v.blueprint_variant_id = r.blueprint_process_variant_id
      WHERE l.link_document_id = $1${tenant}
      ORDER BY r.blueprint_process_ordinal, r.blueprint_process_name`,
    params,
  );
  return res.rows.map((r: Record<string, unknown>) => ({
    linkId: r.link_id as string,
    role: r.link_role as string,
    note: (r.link_note as string | null) ?? null,
    blueprintProcessId: r.link_blueprint_process_id as string,
    blueprintProcessCode: r.blueprint_process_code as string,
    blueprintProcessName: r.blueprint_process_name as string,
    blueprintProcessOrdinal: Number(r.blueprint_process_ordinal),
    blueprintVariantId: r.blueprint_process_variant_id as string,
    blueprintVariantName: r.blueprint_variant_name as string,
    createdAt: iso(r.created_at),
  }));
}

function mapLinkForProcess(r: Record<string, unknown>): LinkForProcessRow {
  return {
    linkId: r.link_id as string,
    role: r.link_role as string,
    note: (r.link_note as string | null) ?? null,
    documentId: r.link_document_id as string,
    documentTitle: r.document_title as string,
    documentKind: r.document_kind as string,
    documentStatus: r.document_status as string,
    blueprintProcessId: r.link_blueprint_process_id as string,
    blueprintProcessName: r.blueprint_process_name as string,
    createdAt: iso(r.created_at),
  };
}

/** Content documents attached to a single process step (tenant-filtered, I5). */
export async function listContentForProcess(q: DbConnector, scope: ScopeFilter, blueprintProcessId: string): Promise<LinkForProcessRow[]> {
  const params: unknown[] = [blueprintProcessId];
  let tenant = "";
  if (!scope.isPlatform) { params.push(scope.tenantId); tenant = ` AND l.link_tenant_id = $2`; }
  const res = await q.query(
    `SELECT l.link_id, l.link_role, l.link_note, l.link_document_id, d.document_title,
            d.document_kind, d.document_status, l.link_blueprint_process_id, r.blueprint_process_name, l.created_at
       FROM sys.sys_content_blueprint_links l
       JOIN sys.sys_content_documents d ON d.document_id = l.link_document_id
       JOIN sys.sys_blueprint_process_registry r ON r.blueprint_process_id = l.link_blueprint_process_id
      WHERE l.link_blueprint_process_id = $1${tenant}
      ORDER BY d.document_title`,
    params,
  );
  return res.rows.map(mapLinkForProcess);
}

/** Content documents attached to ANY process of a variant (powers the variant panel). */
export async function listContentForVariant(q: DbConnector, scope: ScopeFilter, variantId: string): Promise<LinkForProcessRow[]> {
  const params: unknown[] = [variantId];
  let tenant = "";
  if (!scope.isPlatform) { params.push(scope.tenantId); tenant = ` AND l.link_tenant_id = $2`; }
  const res = await q.query(
    `SELECT l.link_id, l.link_role, l.link_note, l.link_document_id, d.document_title,
            d.document_kind, d.document_status, l.link_blueprint_process_id, r.blueprint_process_name, l.created_at
       FROM sys.sys_content_blueprint_links l
       JOIN sys.sys_content_documents d ON d.document_id = l.link_document_id
       JOIN sys.sys_blueprint_process_registry r ON r.blueprint_process_id = l.link_blueprint_process_id
      WHERE r.blueprint_process_variant_id = $1${tenant}
      ORDER BY r.blueprint_process_ordinal, d.document_title`,
    params,
  );
  return res.rows.map(mapLinkForProcess);
}
