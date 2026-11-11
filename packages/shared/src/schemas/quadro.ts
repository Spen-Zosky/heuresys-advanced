/**
 * packages/shared/src/schemas/quadro.ts — GET /v1/me/quadro (classe C15 del piano
 * docs/piani/PIANO_interfaccia-sistematica_20261111.md).
 *
 * Enzo, 2026-11-11: «Dove sono gli insight che dovrebbero caratterizzare un prodotto smart?».
 * Il quadro è ciò che una pagina dice per prima: le anomalie, i rischi, gli andamenti e l'azione
 * suggerita, calcolati sul perimetro di chi guarda. Ogni voce è un conteggio o una misura con la
 * sua frase e, quando c'è, il posto dove si agisce.
 */
import { z } from "zod";

export const AREE_QUADRO = [
  "organizzazione",
  "posizioni",
  "persone",
  "assenze",
  "obiettivi",
  "valutazioni",
  "formazione",
  "selezione",
  "approvazioni",
  "retribuzioni",
  "personale",
  "accessi",
  "processi",
  "contenuti",
  "segnalazioni",
  "progetti",
  "contatti",
] as const;
export const AreaQuadroSchema = z.enum(AREE_QUADRO);
export type AreaQuadro = z.infer<typeof AreaQuadroSchema>;

export const ToniInsight = ["rischio", "attenzione", "positivo", "informazione"] as const;

export const InsightSchema = z.object({
  chiave: z.string(),
  area: AreaQuadroSchema,
  tono: z.enum(ToniInsight),
  /** la frase principale, già con il numero dentro */
  titolo: z.string(),
  valore: z.number().nullable(),
  /** perché conta, in una frase */
  dettaglio: z.string(),
  /** andamento rispetto al periodo prima, in percentuale (null se non ha senso) */
  andamento: z.number().nullable(),
  azione: z.object({ etichetta: z.string(), href: z.string() }).nullable(),
});
export type Insight = z.infer<typeof InsightSchema>;

export const QuadroQuerySchema = z.object({
  /** elenco separato da virgole; vuoto = tutte le aree */
  aree: z.string().max(400).optional(),
});

export const QuadroResponseSchema = z.object({
  insight: z.array(InsightSchema),
  /** le lenti che non si sono potute calcolare (mai un rosso muto) */
  nonCalcolate: z.array(z.string()),
  /** quante verifiche sono state fatte: con zero insight, «nessuna anomalia su N» */
  verifiche: z.number().int(),
});
export type QuadroResponse = z.infer<typeof QuadroResponseSchema>;
