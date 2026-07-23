/**
 * @heuresys/shared — website lead-capture (GTM #4) schemas.
 * Backs the PUBLIC POST /v1/leads (consent-gated, honeypot anti-spam) + the
 * admin GET /v1/leads (leads:read). Zod v4 API.
 */
import { z } from "zod";
import { paginationFields } from "./_pagination.js";

export const LeadCompanySizeEnum = z.enum(["LT_50", "50_250", "250_2000", "GT_2000"]);
export type LeadCompanySize = z.infer<typeof LeadCompanySizeEnum>;

/** Where the lead came from — segments the pipeline (landing / one-pager / demo). */
export const LeadSourceEnum = z.enum(["WEBSITE", "INVESTOR", "DEMO"]);
export type LeadSource = z.infer<typeof LeadSourceEnum>;

/** Public submission. `website` is a honeypot — real users never fill it. */
export const LeadCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  company: z.string().trim().min(1).max(200),
  email: z.email().max(320),
  role: z.string().trim().max(160).optional(),
  companySize: LeadCompanySizeEnum.optional(),
  message: z.string().trim().max(2000).optional(),
  source: LeadSourceEnum.optional(),
  consent: z.literal(true),
  website: z.string().optional().default(""), // honeypot: real users leave it empty; the service swallows non-empty silently
});
export type LeadCreate = z.infer<typeof LeadCreateSchema>;

export const LeadCreateResponseSchema = z.object({ ok: z.literal(true) });

export const LeadResponseSchema = z.object({
  leadId: z.uuid(),
  name: z.string(),
  company: z.string(),
  email: z.string(),
  role: z.string().nullable(),
  companySize: LeadCompanySizeEnum.nullable(),
  message: z.string().nullable(),
  source: z.string(),
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "CLOSED"]),
  consentAt: z.iso.datetime(),
  consentVersion: z.string(),
  createdAt: z.iso.datetime(),
});
export type LeadResponse = z.infer<typeof LeadResponseSchema>;

export const LeadListResponseSchema = z.object({
  items: z.array(LeadResponseSchema),
  total: z.number().int().min(0),
});
export type LeadListResponse = z.infer<typeof LeadListResponseSchema>;

/** GET /v1/leads filters + pagination (#62 G3 — the list was unpaginated/unfiltered).
 *  All optional → fully backward-compatible; `total` becomes the FILTERED count. */
export const LeadStatusEnum = z.enum(["NEW", "CONTACTED", "QUALIFIED", "CLOSED"]);
export type LeadStatus = z.infer<typeof LeadStatusEnum>;

export const LeadListQuerySchema = z.object({
  status: LeadStatusEnum.optional(),
  source: LeadSourceEnum.optional(),
  q: z.string().min(1).max(200).optional(), // matches name / company / email (ILIKE)
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  ...paginationFields(500, 100),
});
export type LeadListQuery = z.infer<typeof LeadListQuerySchema>;
