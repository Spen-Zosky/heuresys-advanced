/**
 * packages/shared/src/schemas/rubrica.ts — GET /v1/me/rubrica (classe C2 del piano
 * docs/piani/PIANO_interfaccia-sistematica_20261111.md).
 *
 * La rubrica del perimetro di chi guarda: per ogni persona, posizione e unità organizzativa il
 * nome con cui un essere umano la riconosce. Serve all'interfaccia per non mostrare mai un'email
 * o un identificativo al posto di una persona («Cognome, Nome»), di una posizione o di un'unità,
 * e per aprire la scheda di sintesi di ciò che si vede (classe C12). Contiene solo nomi: niente
 * dati sensibili, gli stessi che chiunque del tenant vede nell'organigramma.
 */
import { z } from "zod";

export const RubricaPersonaSchema = z.object({
  id: z.string().uuid(),
  email: z.string().nullable(),
  /** «Cognome, Nome»; per un'utenza senza cognome, il nome che ha. */
  etichetta: z.string(),
  posizione: z.string().nullable(),
  unita: z.string().nullable(),
  posizioneId: z.string().uuid().nullable(),
  unitaId: z.string().uuid().nullable(),
  attiva: z.boolean(),
});
export type RubricaPersona = z.infer<typeof RubricaPersonaSchema>;

export const RubricaPosizioneSchema = z.object({
  id: z.string().uuid(),
  codice: z.string().nullable(),
  titolo: z.string(),
  unita: z.string().nullable(),
  titolare: z.string().nullable(),
  unitaId: z.string().uuid().nullable(),
  titolareId: z.string().uuid().nullable(),
  riportaAId: z.string().uuid().nullable(),
  criticita: z.string().nullable(),
  attiva: z.boolean(),
});
export type RubricaPosizione = z.infer<typeof RubricaPosizioneSchema>;

export const RubricaUnitaSchema = z.object({
  id: z.string().uuid(),
  codice: z.string().nullable(),
  nome: z.string(),
  tipo: z.string().nullable(),
  padreId: z.string().uuid().nullable(),
  responsabileId: z.string().uuid().nullable(),
  attiva: z.boolean(),
});
export type RubricaUnita = z.infer<typeof RubricaUnitaSchema>;

export const RubricaResponseSchema = z.object({
  persone: z.array(RubricaPersonaSchema),
  posizioni: z.array(RubricaPosizioneSchema),
  unita: z.array(RubricaUnitaSchema),
});
export type RubricaResponse = z.infer<typeof RubricaResponseSchema>;
