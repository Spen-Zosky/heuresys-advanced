/**
 * @heuresys/shared — content (cap④ CMS) schemas.
 * Backs /v1/content/* over sys.sys_content_{documents,categories,versions}.
 *
 * Tenant-scoped, versioned, publishable content (knowledge base / policy /
 * announcement / handbook). DISTINCT from sys_user_documents (person-owned files).
 * P1 = CRUD + categories + version-on-edit (publish-workflow/restore/ESS = P2).
 * Zod v4 API (z.uuid()/z.iso.datetime()).
 */
import { z } from "zod";

const META = z.record(z.string(), z.unknown());

export const ContentKindEnum = z.enum(["article", "policy", "announcement", "handbook", "process_doc"]);
export type ContentKind = z.infer<typeof ContentKindEnum>;
export const ContentStatusEnum = z.enum(["draft", "in_review", "published", "archived"]);
export type ContentStatus = z.infer<typeof ContentStatusEnum>;
export const ContentBodyFormatEnum = z.enum(["markdown", "html"]);
export type ContentBodyFormat = z.infer<typeof ContentBodyFormatEnum>;

// ─────────────────────────── Categories ───────────────────────────
export const ContentCategorySchema = z.object({
  categoryId: z.uuid(),
  tenantId: z.uuid(),
  naturalKey: z.string(),
  name: z.string(),
  slug: z.string().nullable(),
  description: z.string().nullable(),
  parentId: z.uuid().nullable(),
  isSystem: z.boolean(),
  metadata: META,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ContentCategory = z.infer<typeof ContentCategorySchema>;

export const ContentCategoryCreateSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  parentId: z.uuid().optional(),
  metadata: META.optional(),
});
export const ContentCategoryUpdateSchema = ContentCategoryCreateSchema.partial();
export const ContentCategoryListResponseSchema = z.object({
  items: z.array(ContentCategorySchema),
  total: z.number().int().min(0),
});
export type ContentCategoryListResponse = z.infer<typeof ContentCategoryListResponseSchema>;

// ─────────────────────────── Versions ───────────────────────────
export const ContentVersionSchema = z.object({
  versionId: z.uuid(),
  tenantId: z.uuid(),
  documentId: z.uuid(),
  versionNumber: z.number().int().min(1),
  title: z.string().nullable(),
  body: z.string().nullable(),
  bodyFormat: ContentBodyFormatEnum,
  authorUserId: z.uuid().nullable(),
  changeNote: z.string().nullable(),
  metadata: META,
  createdAt: z.iso.datetime(),
});
export type ContentVersion = z.infer<typeof ContentVersionSchema>;
export const ContentVersionListResponseSchema = z.object({
  items: z.array(ContentVersionSchema),
  total: z.number().int().min(0),
});
export type ContentVersionListResponse = z.infer<typeof ContentVersionListResponseSchema>;

// ─────────────────────────── Documents ───────────────────────────
export const ContentDocumentSchema = z.object({
  documentId: z.uuid(),
  tenantId: z.uuid(),
  naturalKey: z.string(),
  categoryId: z.uuid().nullable(),
  title: z.string(),
  slug: z.string().nullable(),
  kind: ContentKindEnum,
  status: ContentStatusEnum,
  body: z.string().nullable(),
  bodyFormat: ContentBodyFormatEnum,
  currentVersionId: z.uuid().nullable(),
  authorUserId: z.uuid().nullable(),
  publishedAt: z.iso.datetime().nullable(),
  publishedByUserId: z.uuid().nullable(),
  effectiveDate: z.string().nullable(),
  expiresDate: z.string().nullable(),
  metadata: META,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ContentDocument = z.infer<typeof ContentDocumentSchema>;

export const ContentDocumentCreateSchema = z.object({
  title: z.string().min(1).max(255),
  kind: ContentKindEnum.default("article"),
  body: z.string().optional(),
  bodyFormat: ContentBodyFormatEnum.default("markdown"),
  categoryId: z.uuid().optional(),
  slug: z.string().min(1).max(255).optional(),
  effectiveDate: z.iso.date().optional(),
  expiresDate: z.iso.date().optional(),
  changeNote: z.string().max(1000).optional(),
  metadata: META.optional(),
});

export const ContentDocumentUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  kind: ContentKindEnum.optional(),
  body: z.string().optional(),
  bodyFormat: ContentBodyFormatEnum.optional(),
  categoryId: z.uuid().nullable().optional(),
  slug: z.string().min(1).max(255).optional(),
  effectiveDate: z.iso.date().nullable().optional(),
  expiresDate: z.iso.date().nullable().optional(),
  changeNote: z.string().max(1000).optional(),
  metadata: META.optional(),
});

export const ContentDocumentFilterSchema = z.object({
  kind: ContentKindEnum.optional(),
  status: ContentStatusEnum.optional(),
  categoryId: z.uuid().optional(),
  q: z.string().min(1).max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type ContentDocumentFilter = z.infer<typeof ContentDocumentFilterSchema>;

export const ContentDocumentListResponseSchema = z.object({
  items: z.array(ContentDocumentSchema),
  total: z.number().int().min(0),
});
export type ContentDocumentListResponse = z.infer<typeof ContentDocumentListResponseSchema>;

/** GET /:id → head + its current version (null until the first version exists). */
export const ContentDocumentDetailResponseSchema = z.object({
  document: ContentDocumentSchema,
  currentVersion: ContentVersionSchema.nullable(),
});
export type ContentDocumentDetailResponse = z.infer<typeof ContentDocumentDetailResponseSchema>;

export const ContentIdParamSchema = z.object({ id: z.uuid() });
export const ContentCategoryIdParamSchema = z.object({ id: z.uuid() });
/** P2: restore an old version → append a copy + repoint head. */
export const ContentVersionRestoreParamSchema = z.object({ id: z.uuid(), versionId: z.uuid() });

/** P3: full-text search over title + body (tsvector/GIN, mig 000098). */
export const ContentSearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  status: z.enum(["draft", "in_review", "published", "archived"]).optional(),
});
export type ContentSearchQuery = z.infer<typeof ContentSearchQuerySchema>;

export const ContentSearchHitSchema = z.object({
  documentId: z.uuid(),
  tenantId: z.uuid(),
  title: z.string(),
  slug: z.string(),
  kind: z.string(),
  status: z.string(),
  categoryId: z.uuid().nullable(),
  rank: z.number(),
  snippet: z.string(),
});
export type ContentSearchHit = z.infer<typeof ContentSearchHitSchema>;

export const ContentSearchResponseSchema = z.object({
  query: z.string(),
  items: z.array(ContentSearchHitSchema),
  total: z.number().int(),
});
export type ContentSearchResponse = z.infer<typeof ContentSearchResponseSchema>;

/** P2 ESS read filter (/v1/me/content) — published-only is enforced server-side. */
export const MeContentFilterSchema = z.object({
  categoryId: z.uuid().optional(),
  q: z.string().min(1).max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type MeContentFilter = z.infer<typeof MeContentFilterSchema>;

/* --- P3: media attachments (object store, mig 000105) --------------------- */

export const ContentMediaItemSchema = z.object({
  mediaId: z.uuid(),
  documentId: z.uuid(),
  filename: z.string().min(1).max(255),
  mime: z.string().min(1).max(127),
  sizeBytes: z.number().int().positive(),
  sha256: z.string().length(64),
  uploadedBy: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
});
export type ContentMediaItem = z.infer<typeof ContentMediaItemSchema>;

export const ListContentMediaResponseSchema = z.object({
  items: z.array(ContentMediaItemSchema),
  total: z.number().int().min(0),
});
export type ListContentMediaResponse = z.infer<typeof ListContentMediaResponseSchema>;

export const ContentMediaDocParamSchema = z.object({ id: z.uuid() });
export const ContentMediaIdParamSchema = z.object({ mediaId: z.uuid() });
export const ContentMediaDeleteResponseSchema = z.object({ deleted: z.literal(true) });
