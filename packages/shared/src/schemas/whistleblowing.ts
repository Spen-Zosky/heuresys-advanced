/**
 * packages/shared/src/schemas/whistleblowing.ts — #51 E/E1.
 *
 * Whistleblowing channel, mandatory under D.Lgs 24/2023 for organizations >50 employees.
 * MAXIMUM-sensitivity domain with two hard requirements that shape this contract:
 *
 *  1. ANONYMITY. A report is submitted through a PUBLIC channel, outside ordinary auth
 *     (like /v1/leads): no user id, no IP stored. The reporter receives a tracking CODE and
 *     follows the case with that code alone — never by logging in. Leaving a contact is
 *     optional and explicit.
 *
 *  2. CUSTODIAN ISOLATION (explicit derogation from ADR-0027). Reports are NOT visible via
 *     the org hierarchy and NOT via the usual admin plenipotence: neither a manager, nor
 *     TENANT_ADMIN, nor HRMS_MANAGER, nor PLATFORM_ADMIN may read them. Only the dedicated
 *     WHISTLEBLOWING_CUSTODIAN role can. The law requires the reporter's identity and the
 *     content to reach the designated handler and no one else — including IT admins.
 */
import { z } from "zod";

export const WHISTLEBLOWING_STATUSES = [
  "NEW",
  "UNDER_REVIEW",
  "MORE_INFO_REQUESTED",
  "SUBSTANTIATED",
  "UNSUBSTANTIATED",
  "CLOSED",
] as const;
export const WhistleblowingStatusSchema = z.enum(WHISTLEBLOWING_STATUSES);
export type WhistleblowingStatus = z.infer<typeof WhistleblowingStatusSchema>;

export const WHISTLEBLOWING_CATEGORIES = [
  "CORRUPTION",
  "FRAUD",
  "HARASSMENT",
  "SAFETY",
  "DISCRIMINATION",
  "DATA_PRIVACY",
  "OTHER",
] as const;
export const WhistleblowingCategorySchema = z.enum(WHISTLEBLOWING_CATEGORIES);

/* --- PUBLIC submit (no auth) --- */
export const WhistleblowingSubmitSchema = z.object({
  category: WhistleblowingCategorySchema,
  subject: z.string().min(3).max(255),
  body: z.string().min(10).max(20000),
  // optional, explicit — the reporter may stay fully anonymous by omitting it
  contact: z.string().max(255).optional(),
  // honeypot: a hidden field a human never fills; a bot does (mirrors /v1/leads `website`)
  website: z.string().max(0).optional().or(z.string().optional()),
});
export type WhistleblowingSubmit = z.infer<typeof WhistleblowingSubmitSchema>;

/** The submit returns ONLY the tracking code — never a stored-row echo. */
export const WhistleblowingSubmitResponseSchema = z.object({
  trackingCode: z.string(),
});
export type WhistleblowingSubmitResponse = z.infer<typeof WhistleblowingSubmitResponseSchema>;

/* --- PUBLIC status-by-code (no auth): the reporter follows the case anonymously --- */
export const WhistleblowingStatusResponseSchema = z.object({
  trackingCode: z.string(),
  status: WhistleblowingStatusSchema,
  category: WhistleblowingCategorySchema,
  submittedAt: z.iso.datetime(),
  lastUpdateAt: z.iso.datetime(),
  // handler's public note to the reporter (NOT the internal case notes)
  publicMessage: z.string().nullable(),
});
export type WhistleblowingStatusResponse = z.infer<typeof WhistleblowingStatusResponseSchema>;

/* --- CUSTODIAN console (whistleblowing:manage — custodian role ONLY) --- */
export const WhistleblowingReportSchema = z.object({
  reportId: z.uuid(),
  trackingCode: z.string(),
  status: WhistleblowingStatusSchema,
  category: WhistleblowingCategorySchema,
  subject: z.string(),
  body: z.string(),
  contact: z.string().nullable(),
  assigneeUserId: z.uuid().nullable(),
  publicMessage: z.string().nullable(),
  internalNotes: z.string().nullable(),
  submittedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type WhistleblowingReport = z.infer<typeof WhistleblowingReportSchema>;

export const WhistleblowingListItemSchema = WhistleblowingReportSchema.omit({
  body: true,
  contact: true,
  internalNotes: true,
});
export type WhistleblowingListItem = z.infer<typeof WhistleblowingListItemSchema>;
export const WhistleblowingListResponseSchema = z.object({
  items: z.array(WhistleblowingListItemSchema),
  total: z.number().int().min(0),
});
export type WhistleblowingListResponse = z.infer<typeof WhistleblowingListResponseSchema>;

export const WhistleblowingUpdateSchema = z
  .object({
    status: WhistleblowingStatusSchema.optional(),
    assigneeUserId: z.uuid().nullable().optional(),
    publicMessage: z.string().max(4000).nullable().optional(),
    internalNotes: z.string().max(20000).nullable().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { error: "At least one field required" });
export type WhistleblowingUpdate = z.infer<typeof WhistleblowingUpdateSchema>;

export const WhistleblowingIdParamSchema = z.object({ id: z.uuid() });
export const WhistleblowingCodeParamSchema = z.object({ code: z.string().min(8).max(64) });
