/**
 * apps/api/src/modules/content-blueprint-links/service.ts
 * cap④ CMS P3 — content↔blueprint cross-link service.
 *
 * Authorization = the document scope-check (I5): a writer may only attach a document
 * that is in their tenant scope, and the link inherits the DOCUMENT's tenant. The
 * blueprint catalog is global, so the process is validated for existence only. Reads
 * are tenant-filtered on link_tenant_id (PLATFORM_ADMIN cross-tenant).
 */
import { pool } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ConflictError } from "../../errors/index.js";
import type {
  ContentBlueprintLink,
  ContentBlueprintLinkRole,
  LinksForDocumentResponse,
  LinksForProcessResponse,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { findDocumentById, type ScopeFilter } from "../content/repository.js";

function buildScope(a: ActorContext): ScopeFilter {
  const isPlatform = a.roles.includes("PLATFORM_ADMIN");
  return { isPlatform, tenantId: isPlatform ? null : a.tenantId };
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "23505";
}

const toLink = (r: repo.LinkRow): ContentBlueprintLink => ({
  ...r,
  role: r.role as ContentBlueprintLinkRole,
});

export const contentBlueprintLinkService = {
  async createLink(a: ActorContext, input: { documentId: string; blueprintProcessId: string; role: ContentBlueprintLinkRole; note?: string }): Promise<ContentBlueprintLink> {
    // The doc must be in the actor's scope (I5) — its tenant owns the link.
    const doc = await findDocumentById(pool, buildScope(a), input.documentId);
    if (!doc) throw new NotFoundError("Content document");
    const proc = await repo.findProcessById(pool, input.blueprintProcessId);
    if (!proc) throw new NotFoundError("Blueprint process");
    try {
      const row = await repo.insertLink(pool, {
        tenantId: doc.tenantId,
        createdBy: a.userId,
        documentId: input.documentId,
        blueprintProcessId: input.blueprintProcessId,
        role: input.role,
        note: input.note,
      });
      return toLink(row);
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictError("This document is already linked to that process step", "DUPLICATE_LINK");
      throw e;
    }
  },

  async deleteLink(a: ActorContext, id: string): Promise<void> {
    const ok = await repo.deleteLink(pool, buildScope(a), id);
    if (!ok) throw new NotFoundError("Content↔blueprint link");
  },

  async listForDocument(a: ActorContext, documentId: string): Promise<LinksForDocumentResponse> {
    // Scope-check the parent doc → 404 cross-tenant (no existence leak).
    const doc = await findDocumentById(pool, buildScope(a), documentId);
    if (!doc) throw new NotFoundError("Content document");
    const items = await repo.listLinksForDocument(pool, buildScope(a), documentId);
    return {
      items: items.map((r) => ({ ...r, role: r.role as ContentBlueprintLinkRole })),
      total: items.length,
    };
  },

  async listForProcess(a: ActorContext, blueprintProcessId: string): Promise<LinksForProcessResponse> {
    const items = await repo.listContentForProcess(pool, buildScope(a), blueprintProcessId);
    return { items: items.map((r) => ({ ...r, role: r.role as ContentBlueprintLinkRole })), total: items.length };
  },

  async listForVariant(a: ActorContext, variantId: string): Promise<LinksForProcessResponse> {
    const items = await repo.listContentForVariant(pool, buildScope(a), variantId);
    return { items: items.map((r) => ({ ...r, role: r.role as ContentBlueprintLinkRole })), total: items.length };
  },
};
