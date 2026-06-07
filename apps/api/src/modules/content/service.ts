/**
 * apps/api/src/modules/content/service.ts
 * Cap④ CMS — tenant-scoped content service (P1).
 * Visibility model = tenant-only (mirror surveys/predictions): PLATFORM_ADMIN sees
 * all tenants; everyone else is pinned to their own tenant (I5, FK + middleware).
 * Writes are owned by the actor's tenant. Publish-workflow / restore / ESS = P2.
 */
import { pool } from "../../db/client.js";
import type { RoleCode } from "../../config/constants.js";
import { NotFoundError } from "../../errors/index.js";
import type {
  ContentBodyFormat,
  ContentCategory,
  ContentCategoryListResponse,
  ContentDocument,
  ContentDocumentDetailResponse,
  ContentDocumentFilter,
  ContentDocumentListResponse,
  ContentKind,
  ContentStatus,
  ContentVersion,
  ContentVersionListResponse,
} from "@heuresys/shared";
import * as repo from "./repository.js";

export interface ActorContext {
  userId: string;
  tenantId: string | null;
  roles: RoleCode[];
}

function buildScope(a: ActorContext): repo.ScopeFilter {
  const isPlatform = a.roles.includes("PLATFORM_ADMIN");
  return { isPlatform, tenantId: isPlatform ? null : a.tenantId };
}
const actorRef = (a: ActorContext): repo.ActorRef => ({ userId: a.userId, tenantId: a.tenantId });

const toDoc = (r: repo.DocumentRow): ContentDocument => ({
  ...r,
  kind: r.kind as ContentKind,
  status: r.status as ContentStatus,
  bodyFormat: r.bodyFormat as ContentBodyFormat,
});
const toVer = (r: repo.VersionRow): ContentVersion => ({ ...r, bodyFormat: r.bodyFormat as ContentBodyFormat });
const toCat = (r: repo.CategoryRow): ContentCategory => r;

export const contentService = {
  /* --- documents --- */
  async listDocuments(a: ActorContext, filter: ContentDocumentFilter): Promise<ContentDocumentListResponse> {
    const { items, total } = await repo.listDocuments(pool, buildScope(a), filter);
    return { items: items.map(toDoc), total };
  },

  async getDocument(a: ActorContext, id: string): Promise<ContentDocumentDetailResponse> {
    const doc = await repo.findDocumentById(pool, buildScope(a), id);
    if (!doc) throw new NotFoundError("Content document");
    const currentVersion = doc.currentVersionId ? await repo.findVersionById(pool, doc.currentVersionId) : null;
    return { document: toDoc(doc), currentVersion: currentVersion ? toVer(currentVersion) : null };
  },

  async createDocument(a: ActorContext, input: {
    title: string; kind: ContentKind; body?: string; bodyFormat: ContentBodyFormat;
    categoryId?: string; slug?: string; effectiveDate?: string; expiresDate?: string;
    changeNote?: string; metadata?: Record<string, unknown>;
  }): Promise<ContentDocument> {
    const doc = await repo.createDocument(actorRef(a), input);
    return toDoc(doc);
  },

  async updateDocument(a: ActorContext, id: string, input: repo.DocUpdateInput): Promise<ContentDocument> {
    const doc = await repo.updateDocumentAppendVersion(buildScope(a), actorRef(a), id, input);
    if (!doc) throw new NotFoundError("Content document");
    return toDoc(doc);
  },

  async deleteDocument(a: ActorContext, id: string): Promise<{ outcome: "archived" | "deleted" }> {
    const r = await repo.deleteDocument(buildScope(a), id);
    if (!r) throw new NotFoundError("Content document");
    return { outcome: r };
  },

  async listVersions(a: ActorContext, id: string): Promise<ContentVersionListResponse> {
    // scope-check the parent first (404 cross-tenant, no leak)
    const doc = await repo.findDocumentById(pool, buildScope(a), id);
    if (!doc) throw new NotFoundError("Content document");
    const items = (await repo.listVersions(pool, id)).map(toVer);
    return { items, total: items.length };
  },

  /* --- categories --- */
  async listCategories(a: ActorContext): Promise<ContentCategoryListResponse> {
    const items = (await repo.listCategories(pool, buildScope(a))).map(toCat);
    return { items, total: items.length };
  },

  async createCategory(a: ActorContext, input: { name: string; slug?: string; description?: string; parentId?: string; metadata?: Record<string, unknown> }): Promise<ContentCategory> {
    return toCat(await repo.insertCategory(pool, actorRef(a), input));
  },

  async updateCategory(a: ActorContext, id: string, input: { name?: string; slug?: string; description?: string; parentId?: string; metadata?: Record<string, unknown> }): Promise<ContentCategory> {
    const cat = await repo.updateCategory(pool, buildScope(a), id, input);
    if (!cat) throw new NotFoundError("Content category");
    return toCat(cat);
  },

  async deleteCategory(a: ActorContext, id: string): Promise<void> {
    const ok = await repo.deleteCategory(pool, buildScope(a), id);
    if (!ok) throw new NotFoundError("Content category");
  },
};
