/**
 * @heuresys/shared — content↔blueprint cross-link (cap④ CMS P3) schemas.
 * Backs /v1/content-blueprint-links/* over sys.sys_content_blueprint_links.
 *
 * Associates a tenant-scoped content document (sys_content_documents) with a GLOBAL
 * blueprint process step (sys_blueprint_process_registry). The link is OWNED by the
 * document's tenant (I5 = FK + middleware filter, never RLS): two tenants can each
 * link THEIR doc to the SAME global process; the blueprint panel is tenant-filtered.
 * One symmetric row surfaces on both sides; link role describes what the doc IS.
 * Zod v4 API (z.uuid()/z.iso.datetime()).
 */
import { z } from "zod";

const META = z.record(z.string(), z.unknown());

export const ContentBlueprintLinkRoleEnum = z.enum(["documentation", "policy", "procedure", "reference"]);
export type ContentBlueprintLinkRole = z.infer<typeof ContentBlueprintLinkRoleEnum>;

/** The base link row (returned by create). */
export const ContentBlueprintLinkSchema = z.object({
  linkId: z.uuid(),
  tenantId: z.uuid(),
  documentId: z.uuid(),
  blueprintProcessId: z.uuid(),
  role: ContentBlueprintLinkRoleEnum,
  note: z.string().nullable(),
  metadata: META,
  createdBy: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ContentBlueprintLink = z.infer<typeof ContentBlueprintLinkSchema>;

export const ContentBlueprintLinkCreateSchema = z.object({
  documentId: z.uuid(),
  blueprintProcessId: z.uuid(),
  role: ContentBlueprintLinkRoleEnum.default("documentation"),
  note: z.string().max(1000).optional(),
});
export type ContentBlueprintLinkCreate = z.infer<typeof ContentBlueprintLinkCreateSchema>;

export const ContentBlueprintLinkIdParamSchema = z.object({ id: z.uuid() });

export const LinksByDocumentQuerySchema = z.object({ documentId: z.uuid() });
export const LinksByProcessQuerySchema = z.object({ blueprintProcessId: z.uuid() });
export const LinksByVariantQuerySchema = z.object({ variantId: z.uuid() });

/** Doc-panel row: the link + the blueprint process/variant it points at. */
export const ContentLinkForDocumentSchema = z.object({
  linkId: z.uuid(),
  role: ContentBlueprintLinkRoleEnum,
  note: z.string().nullable(),
  blueprintProcessId: z.uuid(),
  blueprintProcessCode: z.string(),
  blueprintProcessName: z.string(),
  blueprintProcessOrdinal: z.number().int(),
  blueprintVariantId: z.uuid(),
  blueprintVariantName: z.string(),
  createdAt: z.iso.datetime(),
});
export type ContentLinkForDocument = z.infer<typeof ContentLinkForDocumentSchema>;
export const LinksForDocumentResponseSchema = z.object({
  items: z.array(ContentLinkForDocumentSchema),
  total: z.number().int().min(0),
});
export type LinksForDocumentResponse = z.infer<typeof LinksForDocumentResponseSchema>;

/** Blueprint-panel row: the link + the content document it attaches. */
export const ContentLinkForProcessSchema = z.object({
  linkId: z.uuid(),
  role: ContentBlueprintLinkRoleEnum,
  note: z.string().nullable(),
  documentId: z.uuid(),
  documentTitle: z.string(),
  documentKind: z.string(),
  documentStatus: z.string(),
  blueprintProcessId: z.uuid(),
  blueprintProcessName: z.string(),
  createdAt: z.iso.datetime(),
});
export type ContentLinkForProcess = z.infer<typeof ContentLinkForProcessSchema>;
export const LinksForProcessResponseSchema = z.object({
  items: z.array(ContentLinkForProcessSchema),
  total: z.number().int().min(0),
});
export type LinksForProcessResponse = z.infer<typeof LinksForProcessResponseSchema>;
