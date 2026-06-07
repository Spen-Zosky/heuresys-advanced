/**
 * apps/api/src/modules/content/repository.ts
 * Cap④ CMS — raw parameterized SQL for tenant-scoped content (P1).
 *
 * Tenant isolation = FK + this WHERE filter (I5, NEVER RLS): PLATFORM_ADMIN sees
 * all tenants; everyone else is pinned to their own tenant. Writes set tenant_id
 * from the actor. create = head + version 1 (one transaction); edit = append a new
 * version + repoint the head (one transaction); the version table is append-only.
 */
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "../../db/client.js";
import { withTransaction } from "../auth/repository.js";

export type DbConnector = typeof pool | PoolClient;

export interface ScopeFilter {
  tenantId: string | null;
  isPlatform: boolean;
}

export interface ActorRef {
  userId: string;
  tenantId: string | null;
}

export interface CategoryRow {
  categoryId: string;
  tenantId: string;
  naturalKey: string;
  name: string;
  slug: string | null;
  description: string | null;
  parentId: string | null;
  isSystem: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRow {
  documentId: string;
  tenantId: string;
  naturalKey: string;
  categoryId: string | null;
  title: string;
  slug: string | null;
  kind: string;
  status: string;
  body: string | null;
  bodyFormat: string;
  currentVersionId: string | null;
  authorUserId: string | null;
  publishedAt: string | null;
  publishedByUserId: string | null;
  effectiveDate: string | null;
  expiresDate: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface VersionRow {
  versionId: string;
  tenantId: string;
  documentId: string;
  versionNumber: number;
  title: string | null;
  body: string | null;
  bodyFormat: string;
  authorUserId: string | null;
  changeNote: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

const iso = (d: unknown): string => (d as Date).toISOString();
const isoN = (d: unknown): string | null => (d ? (d as Date).toISOString() : null);

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 200) || "untitled";
}

/* --- categories --------------------------------------------------------- */
const CAT_COLS = `category_id, category_tenant_id, category_natural_key, category_name, category_slug,
  category_description, category_parent_id, category_is_system, category_metadata, created_at, updated_at`;

function mapCategory(r: Record<string, unknown>): CategoryRow {
  return {
    categoryId: r.category_id as string,
    tenantId: r.category_tenant_id as string,
    naturalKey: r.category_natural_key as string,
    name: r.category_name as string,
    slug: (r.category_slug as string | null) ?? null,
    description: (r.category_description as string | null) ?? null,
    parentId: (r.category_parent_id as string | null) ?? null,
    isSystem: r.category_is_system as boolean,
    metadata: (r.category_metadata as Record<string, unknown>) ?? {},
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

export async function listCategories(q: DbConnector, scope: ScopeFilter): Promise<CategoryRow[]> {
  const params: unknown[] = [];
  let where = "TRUE";
  if (!scope.isPlatform) {
    params.push(scope.tenantId);
    where = `category_tenant_id = $1`;
  }
  const res = await q.query(`SELECT ${CAT_COLS} FROM sys.sys_content_categories WHERE ${where} ORDER BY category_name`, params);
  return res.rows.map(mapCategory);
}

export async function findCategoryById(q: DbConnector, scope: ScopeFilter, id: string): Promise<CategoryRow | null> {
  const params: unknown[] = [id];
  let tenant = "";
  if (!scope.isPlatform) {
    params.push(scope.tenantId);
    tenant = ` AND category_tenant_id = $2`;
  }
  const res = await q.query(`SELECT ${CAT_COLS} FROM sys.sys_content_categories WHERE category_id = $1${tenant}`, params);
  return res.rows[0] ? mapCategory(res.rows[0]) : null;
}

export async function insertCategory(
  q: DbConnector,
  actor: ActorRef,
  input: { name: string; slug?: string; description?: string; parentId?: string; metadata?: Record<string, unknown> },
): Promise<CategoryRow> {
  const res = await q.query(
    `INSERT INTO sys.sys_content_categories
       (category_tenant_id, category_natural_key, category_name, category_slug, category_description, category_parent_id, category_metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     RETURNING ${CAT_COLS}`,
    [actor.tenantId, randomUUID(), input.name, input.slug ?? slugify(input.name), input.description ?? null, input.parentId ?? null, JSON.stringify(input.metadata ?? {})],
  );
  return mapCategory(res.rows[0]!);
}

export async function updateCategory(
  q: DbConnector,
  scope: ScopeFilter,
  id: string,
  input: { name?: string; slug?: string; description?: string; parentId?: string; metadata?: Record<string, unknown> },
): Promise<CategoryRow | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const add = (col: string, val: unknown, cast = "") => { params.push(val); sets.push(`${col} = $${params.length}${cast}`); };
  if (input.name !== undefined) add("category_name", input.name);
  if (input.slug !== undefined) add("category_slug", input.slug);
  if (input.description !== undefined) add("category_description", input.description);
  if (input.parentId !== undefined) add("category_parent_id", input.parentId);
  if (input.metadata !== undefined) add("category_metadata", JSON.stringify(input.metadata), "::jsonb");
  if (sets.length === 0) return findCategoryById(q, scope, id);
  params.push(id);
  let tenant = "";
  if (!scope.isPlatform) { params.push(scope.tenantId); tenant = ` AND category_tenant_id = $${params.length}`; }
  const res = await q.query(
    `UPDATE sys.sys_content_categories SET ${sets.join(", ")} WHERE category_id = $${params.length - (tenant ? 1 : 0)}${tenant} RETURNING ${CAT_COLS}`,
    params,
  );
  return res.rows[0] ? mapCategory(res.rows[0]) : null;
}

export async function deleteCategory(q: DbConnector, scope: ScopeFilter, id: string): Promise<boolean> {
  const params: unknown[] = [id];
  let tenant = "";
  if (!scope.isPlatform) { params.push(scope.tenantId); tenant = ` AND category_tenant_id = $2`; }
  const res = await q.query(`DELETE FROM sys.sys_content_categories WHERE category_id = $1${tenant}`, params);
  return (res.rowCount ?? 0) > 0;
}

/* --- documents ---------------------------------------------------------- */
const DOC_COLS = `document_id, document_tenant_id, document_natural_key, document_category_id, document_title,
  document_slug, document_kind, document_status, document_body, document_body_format, document_current_version_id,
  document_author_user_id, document_published_at, document_published_by_user_id,
  document_effective_date::text AS document_effective_date, document_expires_date::text AS document_expires_date,
  document_metadata, created_at, updated_at`;

function mapDocument(r: Record<string, unknown>): DocumentRow {
  return {
    documentId: r.document_id as string,
    tenantId: r.document_tenant_id as string,
    naturalKey: r.document_natural_key as string,
    categoryId: (r.document_category_id as string | null) ?? null,
    title: r.document_title as string,
    slug: (r.document_slug as string | null) ?? null,
    kind: r.document_kind as string,
    status: r.document_status as string,
    body: (r.document_body as string | null) ?? null,
    bodyFormat: r.document_body_format as string,
    currentVersionId: (r.document_current_version_id as string | null) ?? null,
    authorUserId: (r.document_author_user_id as string | null) ?? null,
    publishedAt: isoN(r.document_published_at),
    publishedByUserId: (r.document_published_by_user_id as string | null) ?? null,
    effectiveDate: (r.document_effective_date as string | null) ?? null,
    expiresDate: (r.document_expires_date as string | null) ?? null,
    metadata: (r.document_metadata as Record<string, unknown>) ?? {},
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

const VER_COLS = `version_id, version_tenant_id, version_document_id, version_number, version_title, version_body,
  version_body_format, version_author_user_id, version_change_note, version_metadata, created_at`;

function mapVersion(r: Record<string, unknown>): VersionRow {
  return {
    versionId: r.version_id as string,
    tenantId: r.version_tenant_id as string,
    documentId: r.version_document_id as string,
    versionNumber: Number(r.version_number),
    title: (r.version_title as string | null) ?? null,
    body: (r.version_body as string | null) ?? null,
    bodyFormat: r.version_body_format as string,
    authorUserId: (r.version_author_user_id as string | null) ?? null,
    changeNote: (r.version_change_note as string | null) ?? null,
    metadata: (r.version_metadata as Record<string, unknown>) ?? {},
    createdAt: iso(r.created_at),
  };
}

export interface DocumentFilter {
  kind?: string | undefined;
  status?: string | undefined;
  categoryId?: string | undefined;
  q?: string | undefined;
  limit: number;
  offset: number;
}

export async function listDocuments(
  q: DbConnector,
  scope: ScopeFilter,
  f: DocumentFilter,
): Promise<{ items: DocumentRow[]; total: number }> {
  const params: unknown[] = [];
  const clauses: string[] = [];
  if (!scope.isPlatform) { params.push(scope.tenantId); clauses.push(`document_tenant_id = $${params.length}`); }
  if (f.kind) { params.push(f.kind); clauses.push(`document_kind = $${params.length}`); }
  if (f.status) { params.push(f.status); clauses.push(`document_status = $${params.length}`); }
  if (f.categoryId) { params.push(f.categoryId); clauses.push(`document_category_id = $${params.length}`); }
  if (f.q) { params.push(`%${f.q}%`); clauses.push(`document_title ILIKE $${params.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const totalRes = await q.query<{ n: string }>(`SELECT count(*)::text AS n FROM sys.sys_content_documents ${where}`, params);
  params.push(f.limit, f.offset);
  const res = await q.query(
    `SELECT ${DOC_COLS} FROM sys.sys_content_documents ${where} ORDER BY updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return { items: res.rows.map(mapDocument), total: Number(totalRes.rows[0]!.n) };
}

export async function findDocumentById(q: DbConnector, scope: ScopeFilter, id: string): Promise<DocumentRow | null> {
  const params: unknown[] = [id];
  let tenant = "";
  if (!scope.isPlatform) { params.push(scope.tenantId); tenant = ` AND document_tenant_id = $2`; }
  const res = await q.query(`SELECT ${DOC_COLS} FROM sys.sys_content_documents WHERE document_id = $1${tenant}`, params);
  return res.rows[0] ? mapDocument(res.rows[0]) : null;
}

export async function findVersionById(q: DbConnector, id: string): Promise<VersionRow | null> {
  const res = await q.query(`SELECT ${VER_COLS} FROM sys.sys_content_versions WHERE version_id = $1`, [id]);
  return res.rows[0] ? mapVersion(res.rows[0]) : null;
}

export async function listVersions(q: DbConnector, documentId: string): Promise<VersionRow[]> {
  const res = await q.query(
    `SELECT ${VER_COLS} FROM sys.sys_content_versions WHERE version_document_id = $1 ORDER BY version_number DESC`,
    [documentId],
  );
  return res.rows.map(mapVersion);
}

export interface DocCreateInput {
  title: string;
  kind: string;
  body?: string | undefined;
  bodyFormat: string;
  categoryId?: string | undefined;
  slug?: string | undefined;
  effectiveDate?: string | undefined;
  expiresDate?: string | undefined;
  changeNote?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

/** Create head + version 1 (one transaction), repoint current_version_id. */
export async function createDocument(actor: ActorRef, input: DocCreateInput): Promise<DocumentRow> {
  return withTransaction(async (client) => {
    const docRes = await client.query(
      `INSERT INTO sys.sys_content_documents
         (document_tenant_id, document_natural_key, document_category_id, document_title, document_slug,
          document_kind, document_status, document_body, document_body_format, document_author_user_id,
          document_effective_date, document_expires_date, document_metadata)
       VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8, $9, $10, $11, $12::jsonb)
       RETURNING ${DOC_COLS}`,
      [
        actor.tenantId, randomUUID(), input.categoryId ?? null, input.title, input.slug ?? slugify(input.title),
        input.kind, input.body ?? null, input.bodyFormat, actor.userId,
        input.effectiveDate ?? null, input.expiresDate ?? null, JSON.stringify(input.metadata ?? {}),
      ],
    );
    const doc = mapDocument(docRes.rows[0]!);
    const verRes = await client.query<{ version_id: string }>(
      `INSERT INTO sys.sys_content_versions
         (version_tenant_id, version_document_id, version_number, version_title, version_body, version_body_format, version_author_user_id, version_change_note)
       VALUES ($1, $2, 1, $3, $4, $5, $6, $7)
       RETURNING version_id`,
      [doc.tenantId, doc.documentId, input.title, input.body ?? null, input.bodyFormat, actor.userId, input.changeNote ?? "Initial version"],
    );
    const versionId = verRes.rows[0]!.version_id;
    const updated = await client.query(
      `UPDATE sys.sys_content_documents SET document_current_version_id = $1 WHERE document_id = $2 RETURNING ${DOC_COLS}`,
      [versionId, doc.documentId],
    );
    return mapDocument(updated.rows[0]!);
  });
}

export interface DocUpdateInput {
  title?: string | undefined;
  body?: string | undefined;
  bodyFormat?: string | undefined;
  kind?: string | undefined;
  slug?: string | undefined;
  categoryId?: string | null | undefined;
  effectiveDate?: string | null | undefined;
  expiresDate?: string | null | undefined;
  changeNote?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

/** Edit = append a new version (title/body snapshot) + repoint + update head fields. */
export async function updateDocumentAppendVersion(
  scope: ScopeFilter,
  actor: ActorRef,
  id: string,
  input: DocUpdateInput,
): Promise<DocumentRow | null> {
  return withTransaction(async (client) => {
    // Lock + scope-check the head.
    const cur = await findDocumentById(client, scope, id);
    if (!cur) return null;
    const nextNum = await client.query<{ n: number }>(
      `SELECT COALESCE(max(version_number), 0) + 1 AS n FROM sys.sys_content_versions WHERE version_document_id = $1`,
      [id],
    );
    const newTitle = input.title ?? cur.title;
    const newBody = input.body !== undefined ? input.body : cur.body;
    const newFormat = input.bodyFormat ?? cur.bodyFormat;
    const verRes = await client.query<{ version_id: string }>(
      `INSERT INTO sys.sys_content_versions
         (version_tenant_id, version_document_id, version_number, version_title, version_body, version_body_format, version_author_user_id, version_change_note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING version_id`,
      [cur.tenantId, id, nextNum.rows[0]!.n, newTitle, newBody, newFormat, actor.userId, input.changeNote ?? null],
    );
    const versionId = verRes.rows[0]!.version_id;

    const sets: string[] = ["document_current_version_id = $1"];
    const params: unknown[] = [versionId];
    const add = (col: string, val: unknown, cast = "") => { params.push(val); sets.push(`${col} = $${params.length}${cast}`); };
    if (input.title !== undefined) add("document_title", input.title);
    if (input.body !== undefined) add("document_body", input.body);
    if (input.bodyFormat !== undefined) add("document_body_format", input.bodyFormat);
    if (input.kind !== undefined) add("document_kind", input.kind);
    if (input.slug !== undefined) add("document_slug", input.slug);
    if (input.categoryId !== undefined) add("document_category_id", input.categoryId);
    if (input.effectiveDate !== undefined) add("document_effective_date", input.effectiveDate);
    if (input.expiresDate !== undefined) add("document_expires_date", input.expiresDate);
    if (input.metadata !== undefined) add("document_metadata", JSON.stringify(input.metadata), "::jsonb");
    params.push(id);
    const res = await client.query(
      `UPDATE sys.sys_content_documents SET ${sets.join(", ")} WHERE document_id = $${params.length} RETURNING ${DOC_COLS}`,
      params,
    );
    return mapDocument(res.rows[0]!);
  });
}

/**
 * D-5 delete semantics: published content is soft-deleted (status='archived');
 * non-published (draft/in_review/archived) is hard-deleted (CASCADE versions).
 * Returns 'archived' | 'deleted' | null (not found / out of scope).
 */
export async function deleteDocument(scope: ScopeFilter, id: string): Promise<"archived" | "deleted" | null> {
  return withTransaction(async (client) => {
    const cur = await findDocumentById(client, scope, id);
    if (!cur) return null;
    if (cur.status === "published") {
      await client.query(`UPDATE sys.sys_content_documents SET document_status = 'archived' WHERE document_id = $1`, [id]);
      return "archived";
    }
    await client.query(`DELETE FROM sys.sys_content_documents WHERE document_id = $1`, [id]);
    return "deleted";
  });
}
