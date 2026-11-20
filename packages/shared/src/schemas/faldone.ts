/**
 * packages/shared/src/schemas/faldone.ts — il FALDONE dell'Utente (la «mega API»).
 *
 * Tutti i dati di una persona, nessuno escluso: ogni tabella del database che ha un legame
 * con `sys.sys_users` (dato diretto) e ogni tabella figlia di quei dati (dato collegato).
 * Il catalogo non è scritto a mano: il servizio lo legge dal database all'avvio, e una prova
 * rossa ferma la CI se una tabella nuova legata alla persona non ha la sua classe di dati.
 *
 * Ciò che chi guarda non può vedere non viene tolto in silenzio: il valore diventa la stringa
 * `{omissis}` e il nome del campo compare in `campiOmessi`, con il motivo. Un vuoto e un
 * {omissis} sono due cose diverse e la risposta le distingue sempre.
 */
import { z } from "zod";

/** Il segnaposto dei campi che chi guarda non può vedere. Uguale a quello dell'assistente. */
export const FALDONE_OMISSIS = "{omissis}" as const;

export const FaldoneClasseSchema = z.enum([
  "PERSONAL", "COMPENSATION", "SKILL", "EVALUATION", "ACTIVITY", "CREDENTIAL", "SPECIAL_CATEGORY",
]);

/** soggetto = la riga parla della persona; relazione = la persona vi compare per un altro motivo
 *  (l'ha creata, approvata, ne è il responsabile): se ne dà l'indice, il contenuto si apre dal suo modulo. */
export const FaldoneLegameSchema = z.enum(["soggetto", "relazione"]);

/** piena = tutti i campi; parziale = alcuni {omissis}; omissis = solo struttura (date, stato, chiavi). */
export const FaldoneVisibilitaSchema = z.enum(["piena", "parziale", "omissis"]);

export const FaldoneSezioneSchema = z.object({
  /** Identificativo stabile: `<tabella>.<colonna di legame>` (per i collegati `<figlia>.<colonna>@<madre>`). */
  id: z.string(),
  titolo: z.string(),
  /** Il gruppo del faldone (Anagrafica, Rapporto di lavoro, Retribuzione, ...). */
  capitolo: z.string(),
  tabella: z.string(),
  colonnaLegame: z.string(),
  /** diretto = FK verso la persona; collegato = figlia di un dato diretto. */
  livello: z.enum(["diretto", "collegato"]),
  legame: FaldoneLegameSchema,
  classe: FaldoneClasseSchema,
  righe: z.number().int().nonnegative(),
  colonne: z.number().int().nonnegative(),
  visibilita: FaldoneVisibilitaSchema,
  campiOmessi: z.array(z.string()),
  motivoOmissis: z.string().nullable(),
});
export type FaldoneSezione = z.infer<typeof FaldoneSezioneSchema>;

export const FaldonePersonaSchema = z.object({
  userId: z.string().uuid(),
  /** «Cognome, Nome». */
  nome: z.string(),
  tenantId: z.string().uuid().nullable(),
});

export const FaldoneTotaliSchema = z.object({
  /** Sezioni del catalogo (legami persona-tabella misurati sul database). */
  sezioni: z.number().int(),
  sezioniConDati: z.number().int(),
  righe: z.number().int(),
  /** Campi del catalogo: somma delle colonne di tutte le sezioni, più quelle della persona. */
  campiCatalogo: z.number().int(),
  /** Sezioni in cui almeno un campo arriva come {omissis} a chi guarda. */
  sezioniConOmissis: z.number().int(),
});

export const FaldoneIndiceSchema = z.object({
  persona: FaldonePersonaSchema,
  generatoIl: z.string(),
  totali: FaldoneTotaliSchema,
  /** ADR-0050 D5: le classi trattenute finché la sessione non conferma il secondo fattore. */
  confermaRichiesta: z.array(FaldoneClasseSchema),
  sezioni: z.array(FaldoneSezioneSchema),
});
export type FaldoneIndice = z.infer<typeof FaldoneIndiceSchema>;

export const FaldoneColonnaSchema = z.object({ nome: z.string(), tipo: z.string() });

export const FaldoneRigheSchema = z.object({
  sezione: FaldoneSezioneSchema,
  colonne: z.array(FaldoneColonnaSchema),
  righe: z.array(z.record(z.string(), z.unknown())),
  /** Per ogni riga, le etichette leggibili dei suoi riferimenti (posizione, unità, persona...). */
  etichette: z.array(z.record(z.string(), z.string())),
  totale: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
  /** L'offset della pagina successiva, o null se questa è l'ultima. */
  prossimo: z.number().int().nullable(),
});
export type FaldoneRighe = z.infer<typeof FaldoneRigheSchema>;

export const FaldoneParamSchema = z.object({ userId: z.string().uuid() });
export const FaldoneSezioneParamSchema = z.object({ userId: z.string().uuid(), sezione: z.string().min(3).max(200) });
export const FaldoneSezioneSelfParamSchema = z.object({ sezione: z.string().min(3).max(200) });
export const FaldonePaginaQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export const FaldoneCompletoQuerySchema = z.object({
  righePerSezione: z.coerce.number().int().min(1).max(1000).default(200),
});

export const FaldoneCompletoSchema = FaldoneIndiceSchema.extend({
  /** Le sezioni con dati, con le loro righe (al più `righePerSezione`; `troncata` lo dichiara). */
  contenuto: z.array(FaldoneRigheSchema.extend({ troncata: z.boolean() })),
});
export type FaldoneCompleto = z.infer<typeof FaldoneCompletoSchema>;
