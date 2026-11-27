/**
 * packages/shared/src/schemas/equita.ts — la dichiarazione di equità (E12, ADR-0063),
 * voce F6b del piano docs/piani/PIANO_heuresys-ai-driven_20261126.md.
 *
 * Ogni proposta che riguarda persone (chi è pronto per una posizione, chi è a rischio, chi ha
 * un divario) porta con sé questa dichiarazione: quali tratti protetti sono stati controllati,
 * quali gruppi sono stati confrontati, il rapporto misurato fra il gruppo meno favorito e il più
 * favorito, la soglia, il metodo e l'esito. Sotto soglia la proposta non si presenta come
 * raccomandazione (`raccomandabile: false`).
 *
 * Il metodo è la regola dei quattro quinti: per ogni tratto si calcola, gruppo per gruppo, la
 * quota di persone con l'esito favorevole; il rapporto fra la quota più bassa e la più alta deve
 * stare almeno a 0,8. Un gruppo sotto il minimo di persone non entra nel confronto e non viene
 * mostrato da solo (finisce in «gruppi piccoli»), così la dichiarazione non rivela il tratto di
 * una persona da sola, e i suoi favorevoli non escono. Non è una garanzia di anonimato: incrociando i
 * totali di più tratti si può a volte risalire al conteggio di un gruppo piccolo, quindi la pagina non la
 * promette. I valori mancanti stanno in «non dichiarato» e non entrano nel confronto.
 *
 * Il controllo guarda anche gli ingressi del calcolo: un tratto protetto fra gli ingressi rende
 * la proposta non raccomandabile in ogni caso; un ingresso vicino a un tratto (l'anzianità
 * rispetto all'età) si dichiara, perché è la via per cui uno svantaggio può entrare senza nome.
 *
 * Gli esiti sono gli stessi dei controlli degli scenari (`SCENARIO_EQUITY_OUTCOME_VALUES`), così
 * una dichiarazione si può conservare in `sys_scenario_equity_checks` senza tradurla.
 */
import { z } from "zod";

export const EQUITA_TRATTO_VALUES = ["GENERE", "ETA", "NAZIONALITA", "STATO_CIVILE"] as const;
export const EquitaTrattoSchema = z.enum(EQUITA_TRATTO_VALUES);
export type EquitaTratto = z.infer<typeof EquitaTrattoSchema>;

export const EQUITA_ESITO_VALUES = ["SUPERATO", "NON_SUPERATO", "DATI_INSUFFICIENTI"] as const;
export const EquitaEsitoSchema = z.enum(EQUITA_ESITO_VALUES);
export type EquitaEsito = z.infer<typeof EquitaEsitoSchema>;

/** Gruppi speciali: valore mancante e gruppi sotto il minimo, riuniti. */
export const EQUITA_GRUPPO_NON_DICHIARATO = "NON_DICHIARATO";
export const EQUITA_GRUPPO_PICCOLI = "GRUPPI_PICCOLI";

/** Fasce d'età: il confronto si fa per fascia, mai per data di nascita. */
export const EQUITA_FASCE_ETA = ["MENO_DI_30", "DA_30_A_39", "DA_40_A_49", "DA_50_IN_SU"] as const;

export const EquitaGruppoSchema = z
  .object({
    /** Il valore del tratto (FEMALE, DA_40_A_49, IT…) oppure NON_DICHIARATO o GRUPPI_PICCOLI. */
    gruppo: z.string().min(1).max(32),
    persone: z.number().int().min(0),
    /** Persone con l'esito favorevole; null quando il gruppo non entra nel confronto (non si mostra). */
    favorevoli: z.number().int().min(0).nullable(),
    /** Quota con l'esito favorevole, 0..1; null quando il gruppo non entra nel confronto. */
    quota: z.number().min(0).max(1).nullable(),
    confrontato: z.boolean(),
  })
  .strict()
  .refine((g) => g.confrontato === (g.favorevoli !== null && g.quota !== null), {
    message: "un gruppo confrontato porta favorevoli e quota; uno non confrontato non li mostra",
    path: ["favorevoli"],
  });
export type EquitaGruppo = z.infer<typeof EquitaGruppoSchema>;

export const EquitaControlloTrattoSchema = z
  .object({
    tratto: EquitaTrattoSchema,
    esito: EquitaEsitoSchema,
    /** Quota più bassa / quota più alta fra i gruppi confrontati; null con dati insufficienti. */
    rapporto: z.number().min(0).max(1).nullable(),
    gruppoMenoFavorito: z.string().nullable(),
    gruppoPiuFavorito: z.string().nullable(),
    gruppi: z.array(EquitaGruppoSchema),
  })
  .strict()
  .refine((c) => (c.esito === "DATI_INSUFFICIENTI") === (c.rapporto === null), {
    message: "un esito misurato porta il rapporto; «dati insufficienti» non lo inventa",
    path: ["rapporto"],
  });
export type EquitaControlloTratto = z.infer<typeof EquitaControlloTrattoSchema>;

export const EquitaDichiarazioneSchema = z
  .object({
    /** Esito complessivo: NON_SUPERATO se un tratto non supera, SUPERATO se almeno uno è misurato e nessuno fallisce. */
    esito: EquitaEsitoSchema,
    /** false sotto soglia o con un tratto protetto fra gli ingressi: la proposta non è una raccomandazione. */
    raccomandabile: z.boolean(),
    metodo: z.string().regex(/^[a-z][a-z0-9-]*@[0-9]+\.[0-9]+\.[0-9]+$/),
    soglia: z.number().gt(0).max(1),
    minimoGruppo: z.number().int().min(1),
    /** Che cosa conta come esito favorevole per questa proposta (chiave di traduzione). */
    esitoFavorevole: z.string().min(1).max(64),
    persone: z.number().int().min(0),
    tratti: z.array(EquitaControlloTrattoSchema),
    /** Ingressi del calcolo, così come li usa il modello (le chiavi delle spiegazioni). */
    ingressi: z.array(z.string()),
    /** Tratti protetti trovati fra gli ingressi: deve restare vuoto. */
    ingressiProtetti: z.array(z.string()),
    /** Ingressi vicini a un tratto protetto, dichiarati: { ingresso, tratto }. */
    ingressiVicini: z.array(z.object({ ingresso: z.string(), tratto: EquitaTrattoSchema }).strict()),
    calcolatoIl: z.iso.datetime(),
  })
  .strict()
  .refine((d) => !(d.raccomandabile && (d.esito === "NON_SUPERATO" || d.ingressiProtetti.length > 0)), {
    message: "sotto soglia, o con un tratto protetto fra gli ingressi, la proposta non è raccomandabile (E12)",
    path: ["raccomandabile"],
  });
export type EquitaDichiarazione = z.infer<typeof EquitaDichiarazioneSchema>;
