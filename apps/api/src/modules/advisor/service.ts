/**
 * apps/api/src/modules/advisor/service.ts
 * F4 fase 1 — orchestra le tre scorecard, applica il motore a regole, registra la traccia.
 *
 * Le fonti si leggono ATTRAVERSO i service esistenti, non con query proprie: l'advisor deve
 * citare esattamente ciò che l'utente vede nelle scorecard. Una seconda query, anche
 * identica oggi, diventerebbe una seconda verità alla prima modifica.
 *
 * Conseguenza voluta: i controlli di scope dei tre service si applicano già, perché ricevono
 * lo stesso `actor`. L'advisor non allarga la visibilità di nessuno.
 */
import type { ActorContext } from "../../lib/actor.js";
import { isPlatform } from "../../lib/actor.js";
import { ForbiddenError } from "../../errors/index.js";
import {
  ADVISOR_MODEL_VERSION, ADVISOR_RULES,
  type AdvisorSuggestionsResponse,
} from "@heuresys/shared";
import { capabilityCompositionService } from "../capability-composition/service.js";
import { orgHealthService } from "../org-health/service.js";
import { computeSuggestions, type AdvisorInputs } from "./engine.js";
import * as repo from "./repository.js";

export const advisorService = {
  /**
   * Deriva le raccomandazioni, le REGISTRA e poi le restituisce — in quest'ordine.
   * Nulla viene mostrato che non sia già tracciato: è il requisito di audit di F4.
   *
   * La scrittura è una traccia, non uno stato di dominio: il risultato è funzione
   * deterministica delle scorecard, quindi due chiamate di seguito sugli stessi dati
   * lasciano il database nello stesso stato.
   */
  async suggestions(actor: ActorContext): Promise<AdvisorSuggestionsResponse> {
    const [essential, vrio, orgHealth] = await Promise.all([
      capabilityCompositionService.essentialRanking(actor),
      capabilityCompositionService.vrioScorecard(actor),
      orgHealthService.scorecard(actor),
    ]);
    const inputs: AdvisorInputs = { essential, vrio, orgHealth };
    const { items, discarded } = computeSuggestions(inputs);

    // PLATFORM_ADMIN legge cross-tenant: non esiste UN tenant a cui attribuire la traccia,
    // quindi non se ne scrive nessuna invece di attribuirla a caso. La lettura resta piena.
    const tenantId = isPlatform(actor) ? null : actor.tenantId;
    if (tenantId) {
      await repo.replaceSuggestions(tenantId, items, ADVISOR_MODEL_VERSION);
    }

    return {
      items,
      total: items.length,
      rulesEvaluated: [...ADVISOR_RULES],
      discarded,
      modelVersion: ADVISOR_MODEL_VERSION,
      generatedAt: new Date().toISOString(),
    };
  },

  /** La traccia registrata, così com'è a database. È ciò che rende l'audit interrogabile. */
  async audit(actor: ActorContext): Promise<AdvisorSuggestionsResponse> {
    if (!isPlatform(actor) && !actor.tenantId) {
      throw new ForbiddenError("Tenant context required", "TENANT_REQUIRED");
    }
    const rows = await repo.listSuggestions(isPlatform(actor) ? null : actor.tenantId!);
    return {
      items: rows.map(({ generatedAt: _g, ...s }) => s),
      total: rows.length,
      rulesEvaluated: [...ADVISOR_RULES],
      discarded: 0,
      modelVersion: ADVISOR_MODEL_VERSION,
      generatedAt: rows[0]?.generatedAt ?? new Date().toISOString(),
    };
  },
};
