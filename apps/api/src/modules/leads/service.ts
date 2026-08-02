/**
 * apps/api/src/modules/leads/service.ts — lead capture business logic.
 * The honeypot + consent checks live here; the route is a thin public POST.
 */
import type { ActorContext } from "../../lib/actor.js";
import type { LeadCreate, LeadListQuery, LeadListResponse, LeadUpdate, LeadResponse } from "@heuresys/shared";
import { NotFoundError } from "../../errors/index.js";
import { recordHoneypotTrip } from "../observability/prometheus.js";
import * as repo from "./repository.js";

export type { ActorContext };

/** Set once; the form stamps consent with this version for audit. */
export const LEAD_CONSENT_VERSION = "2026-06-21-v1";

export const leadsService = {
  /** Public. Honeypot-filled submissions are silently accepted but NOT stored
   *  (don't tip off bots). Consent is enforced by the Zod literal(true) upstream. */
  async create(input: LeadCreate): Promise<{ ok: true }> {
    if (input.website && input.website.length > 0) {
      // Trappola scattata: la risposta resta identica a quella di un invio valido —
      // dire al bot che è stato riconosciuto significa aiutarlo a migliorare. Ma da
      // qui in avanti il fatto è CONTATO: prima era invisibile, e una difesa di cui
      // nessuno vede l'andamento non si sa se stia funzionando.
      recordHoneypotTrip("leads");
      return { ok: true };
    }
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

  async list(_actor: ActorContext, query: LeadListQuery): Promise<LeadListResponse> {
    return repo.listLeads(query); // #62 G3: total = filtered count, not page size
  },

  /** #4 W4 — avanzamento dello stato. Senza, `lead_status` era una colonna che nessuna
   *  superficie sapeva cambiare: ogni lead restava `NEW` per sempre. */
  async updateStatus(_actor: ActorContext, leadId: string, patch: LeadUpdate): Promise<LeadResponse> {
    const updated = await repo.updateLeadStatus(leadId, patch.status);
    if (!updated) throw new NotFoundError("Lead");
    return updated;
  },
};
