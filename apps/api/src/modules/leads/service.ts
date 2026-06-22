/**
 * apps/api/src/modules/leads/service.ts — lead capture business logic.
 * The honeypot + consent checks live here; the route is a thin public POST.
 */
import type { ActorContext } from "../../lib/actor.js";
import type { LeadCreate, LeadListResponse } from "@heuresys/shared";
import * as repo from "./repository.js";

export type { ActorContext };

/** Set once; the form stamps consent with this version for audit. */
export const LEAD_CONSENT_VERSION = "2026-06-21-v1";

export const leadsService = {
  /** Public. Honeypot-filled submissions are silently accepted but NOT stored
   *  (don't tip off bots). Consent is enforced by the Zod literal(true) upstream. */
  async create(input: LeadCreate): Promise<{ ok: true }> {
    if (input.website && input.website.length > 0) return { ok: true }; // honeypot trip
    await repo.insertLead({
      name: input.name,
      company: input.company,
      email: input.email,
      role: input.role ?? null,
      companySize: input.companySize ?? null,
      message: input.message ?? null,
      source: input.source ?? "WEBSITE",
      consentVersion: LEAD_CONSENT_VERSION,
    });
    return { ok: true };
  },

  async list(_actor: ActorContext): Promise<LeadListResponse> {
    const items = await repo.listLeads();
    return { items, total: items.length };
  },
};
