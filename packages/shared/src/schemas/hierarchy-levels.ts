/**
 * packages/shared/src/schemas/hierarchy-levels.ts
 *
 * Il principio gerarchia-livelli (#265): chi sta sopra non ha mai un livello contrattuale inferiore a chi sta sotto.
 * Qui vive solo la FORMA dell'avviso: la regola sta in apps/api/src/modules/hierarchy-levels/logic.ts.
 * È un avviso con motivazione scritta, non un blocco. Non porta dati personali: nomina i posti, non le persone.
 */

import { z } from "zod";

export const AvvisoGerarchiaSchema = z.object({
  unitaId: z.string(),
  unitaNome: z.string(),
  responsabileId: z.string(),
  responsabileLivello: z.string(),
  sottopostoId: z.string(),
  sottopostoPosto: z.string(),
  sottopostoLivello: z.string(),
  motivazione: z.string(),
});
export type AvvisoGerarchia = z.infer<typeof AvvisoGerarchiaSchema>;

export const LivelloNonValutabileSchema = z.object({
  id: z.string(),
  posto: z.string(),
  livello: z.string().nullable(),
  ragione: z.enum(["LIVELLO_ASSENTE", "LIVELLO_FUORI_SCALA"]),
});
export type LivelloNonValutabile = z.infer<typeof LivelloNonValutabileSchema>;

/** Da dove viene l'ordine dei livelli: dal contratto collettivo caricato in un modello. ASSENTE = nessun contratto caricato, nulla da dire. */
export const SCALA_FONTE_VALUES = ["MODELLO", "ATTIVAZIONI", "ASSENTE"] as const;

export const HierarchyLevelsCheckQuerySchema = z.object({
  /** Un modello (versione di variante) non ancora attivato: se manca, si controlla l'organigramma del tenant. */
  modelVersionId: z.uuid().optional(),
});
export type HierarchyLevelsCheckQuery = z.infer<typeof HierarchyLevelsCheckQuerySchema>;

export const HierarchyLevelsCheckResponseSchema = z.object({
  oggetto: z.enum(["MODELLO", "TENANT"]),
  scala: z.object({ fonte: z.enum(SCALA_FONTE_VALUES), livelli: z.array(z.string()) }),
  unitaControllate: z.number().int(),
  avvisi: z.array(AvvisoGerarchiaSchema),
  nonValutabili: z.array(LivelloNonValutabileSchema),
});
export type HierarchyLevelsCheckResponse = z.infer<typeof HierarchyLevelsCheckResponseSchema>;
