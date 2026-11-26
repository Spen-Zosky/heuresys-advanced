/**
 * packages/shared/src/schemas/agent-weekly-summary.ts — ADR-0063 D3, piano «Heuresys AI-driven»
 * voce F0c (decisione E5 di Enzo del 2026-11-26).
 *
 * Il riepilogo settimanale delle scritture fatte con l'assistente: ogni scrittura che una persona
 * ha confermato, quelle che ha negato e (deve restare zero, ADR-0063 D4) quelle eseguite da sole.
 * La fonte è il diario del cancello (`audit.agent_gateway_decisions`, 000452 e 000482). Sola
 * lettura. La settimana va dal lunedì alla domenica, ora di Roma.
 *
 * La piattaforma vede tutti i tenant; il Direttore HR e l'amministratore del tenant solo il loro.
 */
import { z } from "zod";

const GIORNO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const AgentWeeklySummaryQuerySchema = z.object({
  /** Un giorno qualsiasi della settimana voluta; assente = l'ultima settimana conclusa. */
  week: GIORNO.optional(),
});
export type AgentWeeklySummaryQuery = z.infer<typeof AgentWeeklySummaryQuerySchema>;

/** Il nome dell'operazione nelle due lingue dell'interfaccia; `null` se il catalogo non la descrive. */
export const AgentOperationLabelSchema = z.object({ it: z.string(), en: z.string() }).nullable();

export const AgentWeeklyPersonSchema = z.object({
  userId: z.string().nullable(),
  /** «Cognome, Nome»; `null` se la persona non c'è più. */
  personName: z.string().nullable(),
  tenantCode: z.string(),
  tenantName: z.string().nullable(),
  confirmed: z.number().int().min(0),
  denied: z.number().int().min(0),
  autonomous: z.number().int().min(0),
  lastAt: z.string(),
});
export type AgentWeeklyPerson = z.infer<typeof AgentWeeklyPersonSchema>;

export const AGENT_WEEKLY_OUTCOME_VALUES = ["CONFERMATA", "NEGATA", "AUTONOMA"] as const;
export const AgentWeeklyOutcomeSchema = z.enum(AGENT_WEEKLY_OUTCOME_VALUES);

export const AgentWeeklyWriteSchema = z.object({
  id: z.string(),
  at: z.string(),
  personName: z.string().nullable(),
  tenantName: z.string().nullable(),
  operationLabel: AgentOperationLabelSchema,
  method: z.string().nullable(),
  conversationId: z.string().nullable(),
  outcome: AgentWeeklyOutcomeSchema,
});
export type AgentWeeklyWrite = z.infer<typeof AgentWeeklyWriteSchema>;

export const AgentWeeklySummarySchema = z.object({
  weekStart: GIORNO,
  /** L'ultimo giorno della settimana (la domenica), compreso. */
  weekEnd: GIORNO,
  totals: z.object({
    confirmed: z.number().int().min(0),
    denied: z.number().int().min(0),
    /** Scritture eseguite senza conferma: con il modo LIBERA spento (ADR-0063 D4) deve restare 0. */
    autonomous: z.number().int().min(0),
    people: z.number().int().min(0),
    conversations: z.number().int().min(0),
  }),
  people: z.array(AgentWeeklyPersonSchema),
  writes: z.array(AgentWeeklyWriteSchema),
  /** Quante scritture ci sono in tutto: se è più di `writes.length`, l'elenco è troncato e lo si dice. */
  writesTotal: z.number().int().min(0),
});
export type AgentWeeklySummary = z.infer<typeof AgentWeeklySummarySchema>;
