/**
 * packages/shared/src/schemas/research.ts
 *
 * Il contratto della ricerca (#132 F4g — epica P2a §6).
 *
 * ⚠ IL CONTENUTO DI UNA PROPOSTA E' `unknown` DI PROPOSITO. La forma la dichiara il
 * **dominio** (`apps/api/src/modules/research/domains/*`), che vive in codice ed e' diverso
 * per ognuno dei cinque domini in arrivo: ricopiarla qui vorrebbe dire tenerne due, e il
 * giorno in cui divergessero il contratto pubblico direbbe una cosa e il controllo ne
 * verificherebbe un'altra. Chi consuma la proposta guarda `dominio` e sa cosa aspettarsi.
 */
import { z } from "zod";

export const AvviaRicercaBodySchema = z.object({
  /** La chiave di un dominio dichiarato in codice. Sconosciuta ⇒ 422 con l'elenco. */
  dominio: z.string().min(1).max(64),
});
export type AvviaRicercaBody = z.infer<typeof AvviaRicercaBodySchema>;

export const EsitoControlloSchema = z.enum(["PASSED", "FAILED", "WARNING", "SKIPPED"]);
export type EsitoControllo = z.infer<typeof EsitoControlloSchema>;

export const ControlloRicercaSchema = z.object({
  regola: z.string(),
  esito: EsitoControlloSchema,
  messaggio: z.string().nullable(),
});
export type ControlloRicerca = z.infer<typeof ControlloRicercaSchema>;

export const EvidenzaRicercaSchema = z.object({
  url: z.string(),
  retrievedAt: z.string(),
  /** SHA-256 dei byte ricevuti. `null` solo per le evidenze storiche non di ricerca. */
  sha256: z.string().nullable(),
});
export type EvidenzaRicerca = z.infer<typeof EvidenzaRicercaSchema>;

export const StatoPropostaSchema = z.enum([
  "PENDING", "PASSED", "FAILED", "WARNING", "APPROVED", "REJECTED", "APPLIED",
]);
export type StatoProposta = z.infer<typeof StatoPropostaSchema>;

export const PropostaRicercaSchema = z.object({
  candidateId: z.uuid(),
  dominio: z.string(),
  chiaveNaturale: z.string(),
  contenuto: z.unknown(),
  stato: StatoPropostaSchema,
  controlli: z.array(ControlloRicercaSchema),
  evidenze: z.array(EvidenzaRicercaSchema),
  /** La decisione umana, quando c'e': chi, quando, e **perche'**. */
  decisione: z
    .object({
      stato: z.string(),
      motivazione: z.string().nullable(),
      decisaIl: z.string(),
      approvatoreUserId: z.uuid().nullable(),
    })
    .nullable(),
});
export type PropostaRicerca = z.infer<typeof PropostaRicercaSchema>;

export const CorsaRicercaSchema = z.object({
  runId: z.uuid(),
  code: z.string(),
  dominio: z.string(),
  stato: z.enum(["RUNNING", "COMPLETED", "FAILED", "CANCELLED"]),
  /** Le domande **effettivamente** poste, non una descrizione di cosa si e' cercato. */
  domande: z.array(z.string()),
  /** Il perimetro: quali pagine sono state aperte, e quali non si sono potute aprire. */
  pagineLette: z.number().int(),
  pagineNegate: z.number().int(),
  proposteTotali: z.number().int(),
  propostePassate: z.number().int(),
  proposteRespinte: z.number().int(),
  proposteConAvviso: z.number().int(),
  iniziataIl: z.string(),
  finitaIl: z.string().nullable(),
});
export type CorsaRicerca = z.infer<typeof CorsaRicercaSchema>;

export const CandidatiRicercaResponseSchema = z.object({
  items: z.array(PropostaRicercaSchema),
  total: z.number().int(),
});
export type CandidatiRicercaResponse = z.infer<typeof CandidatiRicercaResponseSchema>;

/**
 * La decisione del consulente. La motivazione e' **obbligatoria in entrambi i versi**: un
 * rifiuto senza ragione non insegna niente alla corsa successiva, e un'approvazione senza
 * ragione rende indistinguibile «l'ho valutata» da «ho premuto il bottone».
 */
export const DecisionePropostaBodySchema = z.object({
  decisione: z.enum(["APPROVED", "REJECTED"]),
  motivazione: z.string().min(10).max(4000),
});
export type DecisionePropostaBody = z.infer<typeof DecisionePropostaBodySchema>;

export const DominoRicercabileSchema = z.object({
  chiave: z.string(),
  etichetta: z.string(),
  minimoFonti: z.number().int(),
  fontiConfrontateColRegistro: z.boolean(),
});
export type DominoRicercabile = z.infer<typeof DominoRicercabileSchema>;

export const DominiRicercabiliResponseSchema = z.object({
  items: z.array(DominoRicercabileSchema),
});
export type DominiRicercabiliResponse = z.infer<typeof DominiRicercabiliResponseSchema>;
