/**
 * packages/shared/src/schemas/organigramma.ts — GET /v1/me/organigramma.
 *
 * Piano docs/piani/PIANO_organigrammi-a-blocchi_20261114.md (V1). L'organigramma di un cliente
 * calcolato dai dati vivi a ogni richiesta: le unità attive con il loro responsabile e le persone
 * che vi lavorano («Cognome, Nome», con la posizione), le posizioni attive con il riporto e il
 * titolare. Nessun grafo salvato: i collegamenti sono quelli di `sys_organization_units` e
 * `sys_positions` nel momento della chiamata. Contiene solo nomi, gli stessi della rubrica.
 */
import { z } from "zod";

export const OrganigrammaQuerySchema = z.object({
  /** Per chi vede più clienti (mandati di piattaforma): il cliente da disegnare. */
  tenantId: z.string().uuid().optional(),
});
export type OrganigrammaQuery = z.infer<typeof OrganigrammaQuerySchema>;

export const OrganigrammaPersonaSchema = z.object({
  id: z.string().uuid(),
  /** «Cognome, Nome». */
  etichetta: z.string(),
  posizioneId: z.string().uuid(),
  posizione: z.string(),
  /** Vero se è il responsabile dell'unità. */
  responsabile: z.boolean(),
});
export type OrganigrammaPersona = z.infer<typeof OrganigrammaPersonaSchema>;

export const OrganigrammaUnitaSchema = z.object({
  id: z.string().uuid(),
  codice: z.string().nullable(),
  nome: z.string(),
  tipo: z.string().nullable(),
  /** LINEA o STAFF. */
  relazione: z.string().nullable(),
  padreId: z.string().uuid().nullable(),
  /** Profondità nell'albero vivo: 1 per la radice. */
  livello: z.number().int(),
  /** Vero per le unità di tipo BRANCH: disegnate tratteggiate e raccolte nel gruppo delle filiali. */
  filiale: z.boolean(),
  responsabileId: z.string().uuid().nullable(),
  responsabile: z.string().nullable(),
  /** Persone con un'assegnazione attiva su una posizione attiva dell'unità. */
  persone: z.array(OrganigrammaPersonaSchema),
  posizioni: z.number().int(),
  scoperte: z.number().int(),
  /** Persone dell'unità e di tutte quelle sotto di lei. */
  addettiTotali: z.number().int(),
});
export type OrganigrammaUnita = z.infer<typeof OrganigrammaUnitaSchema>;

export const OrganigrammaPosizioneSchema = z.object({
  id: z.string().uuid(),
  titolo: z.string(),
  unitaId: z.string().uuid().nullable(),
  riportaAId: z.string().uuid().nullable(),
  titolareId: z.string().uuid().nullable(),
  titolare: z.string().nullable(),
});
export type OrganigrammaPosizione = z.infer<typeof OrganigrammaPosizioneSchema>;

export const OrganigrammaResponseSchema = z.object({
  tenantId: z.string().uuid(),
  cliente: z.string(),
  /** Quando è stato calcolato (ISO 8601): l'interfaccia lo mostra accanto ad «Aggiorna». */
  calcolatoIl: z.string(),
  unita: z.array(OrganigrammaUnitaSchema),
  posizioni: z.array(OrganigrammaPosizioneSchema),
  /** Incoerenze dei dati vivi che il disegno rende visibili, contate. */
  avvisi: z.object({
    posizioniSenzaRiporto: z.number().int(),
    riportiFuoriCliente: z.number().int(),
    unitaSenzaResponsabile: z.number().int(),
  }),
});
export type OrganigrammaResponse = z.infer<typeof OrganigrammaResponseSchema>;
