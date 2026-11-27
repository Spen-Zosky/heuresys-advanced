/**
 * packages/shared/src/schemas/agent-signals.ts — ADR-0063, piano «Heuresys AI-driven» voce F4a
 * (decisione E6 di Enzo del 2026-11-26: agenti che segnalano senza scrivere, a ciascuno nel suo
 * perimetro, in una casella dentro la piattaforma, per ora senza posta).
 *
 * Le segnalazioni le produce il segnalatore notturno (`agents:signals`) leggendo lo stato del
 * tenant; la persona legge solo le proprie (`GET /v1/agent-signals`). Ogni segnalazione porta i
 * numeri che la reggono e la pagina della fonte. Sola lettura: il giudizio «utile/non utile» è
 * la voce F4b.
 */
import { z } from "zod";

export const AgentSignalerCodeSchema = z.enum([
  "POSIZIONE_CRITICA_SENZA_SUCCESSORE",
  "AMPIEZZA_DI_CONTROLLO",
  "POSIZIONE_SCOPERTA",
]);
export type AgentSignalerCode = z.infer<typeof AgentSignalerCodeSchema>;

export const AgentSignalStatusSchema = z.enum(["APERTA", "RISOLTA", "SCADUTA", "RITIRATA"]);
export type AgentSignalStatus = z.infer<typeof AgentSignalStatusSchema>;

export const AgentSignalsQuerySchema = z.object({
  /** Assente = solo le aperte. */
  status: AgentSignalStatusSchema.optional(),
});
export type AgentSignalsQuery = z.infer<typeof AgentSignalsQuerySchema>;

export const AgentSignalSchema = z.object({
  id: z.uuid(),
  signalerCode: AgentSignalerCodeSchema,
  domain: z.string(),
  severity: z.enum(["INFO", "MEDIUM", "HIGH", "CRITICAL"]),
  status: AgentSignalStatusSchema,
  /** CATENA: dirigi l'unità del soggetto o una che le sta sopra; MANDATO_HR: hai il mandato HR sul tenant. */
  recipientBasis: z.enum(["CATENA", "MANDATO_HR"]),
  subjectType: z.enum(["POSITION", "ORGANIZATION_UNIT"]),
  subjectId: z.uuid(),
  positionTitle: z.string().nullable(),
  unitName: z.string().nullable(),
  /** I numeri che reggono la segnalazione (candidati, riporti, giorni, soglia). */
  evidence: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  sourceUrl: z.string().nullable(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
  expiresOn: z.string(),
  closedAt: z.string().nullable(),
});
export type AgentSignal = z.infer<typeof AgentSignalSchema>;

export const AgentSignalListSchema = z.object({ items: z.array(AgentSignalSchema) });
export type AgentSignalList = z.infer<typeof AgentSignalListSchema>;
