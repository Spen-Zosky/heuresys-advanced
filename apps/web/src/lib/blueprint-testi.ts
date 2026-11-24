/**
 * apps/web/src/lib/blueprint-testi.ts
 *
 * Giro forense K32 (2026-11-23): i testi del confronto e della costruzione di un fascicolo,
 * in parole e nella lingua della pagina.
 *
 *  - Il confronto scriveva le decisioni come `02 — PARTIAL: …`: il codice del processo e il
 *    codice dell'inclusione a vista. Qui la voce usa il nome del processo e l'etichetta tradotta
 *    dell'inclusione (le stesse chiavi `dossier.decisions.in|partial|out` della pagina del fascicolo).
 *  - La costruzione mostrava in grassetto il messaggio del 409, che elencava centinaia di codici
 *    `ESCO::uuid`. Il servizio ora manda i dettagli strutturati (`BuildPlanIncoherence`), e
 *    qui si riconoscono per forma: se non tornano, la pagina usa il ripiego di sempre.
 *
 * Funzioni pure, senza React: si provano in `blueprint-testi.test.ts`.
 */
import {
  BuildPlanIncoherenceSchema,
  type BuildPlanIncoherence,
  type ProcessDecision,
} from "@heuresys/shared";

type Traduci = (chiave: string, opzioni?: Record<string, unknown>) => string;

/** L'etichetta tradotta di un'inclusione (IN, PARTIAL, OUT), mai il codice. */
export function etichettaInclusione(inclusione: ProcessDecision["inclusion"], t: Traduci): string {
  return inclusione === null
    ? t("dossier.decisions.fromModel")
    : t(`dossier.decisions.${inclusione.toLowerCase()}`);
}

/** Una decisione del confronto: «nome del processo — Parziale: motivazione». */
export function voceDecisione(
  p: Pick<ProcessDecision, "processName" | "inclusion" | "rationale">,
  t: Traduci,
): string {
  const base = `${p.processName} — ${etichettaInclusione(p.inclusion, t)}`;
  return p.rationale ? `${base}: ${p.rationale}` : base;
}

/** I dettagli del 409 di `build-plan`, se l'errore li porta nella forma dichiarata. */
export function incoerenzaDelPiano(errore: unknown): BuildPlanIncoherence | null {
  if (typeof errore !== "object" || errore === null || !("details" in errore)) return null;
  const r = BuildPlanIncoherenceSchema.safeParse((errore as { details: unknown }).details);
  return r.success ? r.data : null;
}

/** Il titolo del rifiuto, nella lingua della pagina: il motivo e il numero, non l'elenco. */
export function titoloIncoerenza(i: BuildPlanIncoherence, t: Traduci): string {
  return i.reason === "SKILLS_WITHOUT_CATEGORY"
    ? t("dossier.build.incoherent.skillsWithoutCategory", { count: i.count })
    : t("dossier.build.incoherent.positionsInMissingUnits", { count: i.count });
}
