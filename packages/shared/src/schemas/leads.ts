/**
 * @heuresys/shared — website lead-capture (GTM #4) schemas.
 * Backs the PUBLIC POST /v1/leads (consent-gated, honeypot anti-spam) + the
 * admin GET /v1/leads (leads:read). Zod v4 API.
 */
import { z } from "zod";

export const LeadCompanySizeEnum = z.enum(["LT_50", "50_250", "250_2000", "GT_2000"]);
export type LeadCompanySize = z.infer<typeof LeadCompanySizeEnum>;

/** Public submission. `website` is a honeypot — real users never fill it. */
export const LeadCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  company: z.string().trim().min(1).max(200),
  email: z.email().max(320),
  role: z.string().trim().max(160).optional(),
  companySize: LeadCompanySizeEnum.optional(),
  message: z.string().trim().max(2000).optional(),
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
