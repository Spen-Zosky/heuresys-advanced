/**
 * apps/api/src/modules/scenari/calcolatori/successione.ts — il calcolatore della successione,
 * voce F3b-1 del piano docs/piani/PIANO_heuresys-ai-driven_20261126.md (ADR-0063 D5).
 *
 * Serve le prime due famiglie del motore degli scenari sul dominio talenti e rimpiazzo:
 *   · EFFETTO DIRETTO (S-T1): escono una o più persone; chi copre le loro posizioni fra i successori
 *     pronti, quali posizioni restano scoperte, in quanti mesi si copre;
 *   · CASCATA (S-T2): chi copre lascia la sua posizione, che a sua volta si copre con i suoi
 *     successori, e così via fino in fondo; alla fine della catena restano le posizioni scoperte.
 *
 * Logica PURA: niente database, niente orologio, niente caso. Riceve la fotografia (struttura ombra
 * della 000515) e le tavole di successione già lette, e restituisce i passi della catena. Lo stesso
 * ingresso dà sempre lo stesso esito: l'ordine di visita e la scelta del successore sono fissati
 * qui sotto e non dipendono dall'ordine delle righe.
 *
 * Regole, scritte una volta:
 *   1. Una posizione si libera quando esce (o si sposta) un suo titolare PRIMARY e non resta nessun
 *      altro titolare PRIMARY. Le assegnazioni SECONDARY, INTERIM e ACTING non coprono e non liberano.
 *   2. È candidabile chi è nella tavola della posizione con una prontezza diversa da NOT_READY (o
 *      assente), non esce, non si è già spostato in questa catena e non è già titolare di quella
 *      posizione.
 *   3. Si sceglie la prontezza più vicina (READY_NOW 0 mesi, READY_6_MONTHS 6, READY_1_YEAR 12,
 *      READY_2_YEARS 24); a parità il candidato CONFERMATO; a parità ancora l'identificativo più
 *      piccolo, solo perché l'esito sia riproducibile (lo si dichiara come politica dello scenario).
 *   4. Le posizioni si visitano in ampiezza: prima tutte quelle liberate dalle uscite, poi quelle
 *      liberate da chi le ha coperte, e così via; dentro lo stesso livello per codice di posizione.
 *   5. `profonditaMassima` dice fin dove si copre: 0 nessuno (l'opzione «nessuna azione»), 1 solo
 *      il primo rimpiazzo (effetto diretto), di più la cascata. Una posizione liberata oltre il
 *      limite resta scoperta; se il limite ha troncato una cascata che poteva continuare, l'esito lo
 *      dice (`troncata`), perché un numero tagliato non si presenta come completo.
 */

export const CALCOLATORE_SUCCESSIONE = "successione@0.1.0" as const;

export const PRONTEZZE = ["READY_NOW", "READY_6_MONTHS", "READY_1_YEAR", "READY_2_YEARS", "NOT_READY"] as const;
export type Prontezza = (typeof PRONTEZZE)[number];

/** Mesi alla prontezza; `null` vuol dire non candidabile. */
export const MESI_DI_PRONTEZZA: Readonly<Record<Prontezza, number | null>> = {
  READY_NOW: 0,
  READY_6_MONTHS: 6,
  READY_1_YEAR: 12,
  READY_2_YEARS: 24,
  NOT_READY: null,
};

/** Le criticità che rendono «critica» una posizione scoperta (CHECK di sys_positions). */
export const CRITICITA_ALTE: ReadonlySet<string> = new Set(["CRITICAL", "HIGH"]);

/** La profondità della cascata completa: oltre, la catena si dichiara troncata. */
export const PROFONDITA_CASCATA = 10;

export interface PosizioneOmbra {
  /** id della riga ombra (sys_scenario_shadow_positions) */
  id: string;
  /** la posizione vera da cui viene (le tavole di successione la nominano) */
  sourceId: string | null;
  codice: string;
  titolo: string;
  criticita: string | null;
}

export interface TitolareOmbra {
  /** id della riga ombra (sys_scenario_shadow_assignments) */
  id: string;
  posizioneId: string;
  userId: string | null;
  tipo: string;
}

export interface Successore {
  /** la posizione vera della tavola di successione */
  posizioneSourceId: string;
  userId: string;
  prontezza: Prontezza | null;
  confermato: boolean;
}

export interface IngressoSuccessione {
  posizioni: readonly PosizioneOmbra[];
  titolari: readonly TitolareOmbra[];
  successori: readonly Successore[];
  /** le persone che escono (le leve PERSONA_ESCE) */
  uscite: readonly string[];
}

export interface PassoSuccessione {
  /** 1 = posizione liberata da un'uscita, 2 = liberata da chi ha coperto al livello 1, … */
  profondita: number;
  posizioneId: string;
  /** chi l'ha lasciata: una persona che esce o un successore che si è spostato */
  lasciataDa: string;
  /** chi la copre; `null` se resta scoperta */
  successoreUserId: string | null;
  mesi: number | null;
}

export interface EsitoSuccessione {
  passi: PassoSuccessione[];
  /** posizioni liberate dalle sole uscite */
  vacantiIniziali: number;
  coperte: number;
  /** le posizioni che restano scoperte alla fine, in ordine di codice */
  scoperte: string[];
  scoperteCritiche: number;
  /** chi si sposta per coprire, in ordine di passo */
  spostati: string[];
  /** il livello più profondo raggiunto da una copertura */
  lunghezzaCatena: number;
  /** i mesi del successore meno pronto fra quelli scelti; `null` se nessuno copre */
  mesiAllaCopertura: number | null;
  troncata: boolean;
}

function confronta(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function calcolaSuccessione(ingresso: IngressoSuccessione, profonditaMassima: number): EsitoSuccessione {
  if (!Number.isInteger(profonditaMassima) || profonditaMassima < 0) {
    throw new Error(`profondità non valida: ${profonditaMassima}`);
  }
  const posizioni = new Map(ingresso.posizioni.map((p) => [p.id, p]));
  const perSorgente = new Map<string, string>();
  for (const p of ingresso.posizioni) if (p.sourceId) perSorgente.set(p.sourceId, p.id);

  // titolari PRIMARY ancora in carica, per posizione e per persona
  const primariPerPosizione = new Map<string, Set<string>>();
  const posizioniPerPersona = new Map<string, Set<string>>();
  for (const t of ingresso.titolari) {
    if (t.tipo !== "PRIMARY" || t.userId === null || !posizioni.has(t.posizioneId)) continue;
    if (!primariPerPosizione.has(t.posizioneId)) primariPerPosizione.set(t.posizioneId, new Set());
    primariPerPosizione.get(t.posizioneId)!.add(t.userId);
    if (!posizioniPerPersona.has(t.userId)) posizioniPerPersona.set(t.userId, new Set());
    posizioniPerPersona.get(t.userId)!.add(t.posizioneId);
  }

  // tavole di successione portate sulle posizioni ombra
  const candidatiPerPosizione = new Map<string, Successore[]>();
  for (const s of ingresso.successori) {
    const id = perSorgente.get(s.posizioneSourceId);
    if (!id) continue;
    if (!candidatiPerPosizione.has(id)) candidatiPerPosizione.set(id, []);
    candidatiPerPosizione.get(id)!.push(s);
  }

  const escono = new Set(ingresso.uscite);
  const spostati: string[] = [];
  const giaSpostati = new Set<string>();
  const passi: PassoSuccessione[] = [];
  const scoperte = new Set<string>();
  let troncata = false;

  /** Toglie la persona dalle sue posizioni e restituisce quelle rimaste senza titolare PRIMARY. */
  const lascia = (userId: string): string[] => {
    const liberate: string[] = [];
    for (const posId of posizioniPerPersona.get(userId) ?? []) {
      const titolari = primariPerPosizione.get(posId)!;
      titolari.delete(userId);
      if (titolari.size === 0) liberate.push(posId);
    }
    posizioniPerPersona.delete(userId);
    return liberate;
  };

  type Vacante = { posizioneId: string; lasciataDa: string };
  const ordina = (v: Vacante[]) =>
    v.sort((a, b) => confronta(posizioni.get(a.posizioneId)!.codice, posizioni.get(b.posizioneId)!.codice) || confronta(a.posizioneId, b.posizioneId));

  let livello: Vacante[] = [];
  for (const u of [...escono].sort(confronta)) {
    for (const posId of lascia(u)) livello.push({ posizioneId: posId, lasciataDa: u });
  }
  // una posizione con più titolari che escono tutti si libera una volta sola
  const viste = new Set<string>();
  livello = ordina(livello.filter((v) => (viste.has(v.posizioneId) ? false : (viste.add(v.posizioneId), true))));
  const vacantiIniziali = livello.length;

  let profondita = 1;
  while (livello.length > 0) {
    const prossimo: Vacante[] = [];
    for (const v of livello) {
      if (profondita > profonditaMassima) {
        scoperte.add(v.posizioneId);
        if (profonditaMassima >= PROFONDITA_CASCATA && scegli(v.posizioneId) !== null) troncata = true;
        continue;
      }
      const scelto = scegli(v.posizioneId);
      if (scelto === null) {
        scoperte.add(v.posizioneId);
        passi.push({ profondita, posizioneId: v.posizioneId, lasciataDa: v.lasciataDa, successoreUserId: null, mesi: null });
        continue;
      }
      giaSpostati.add(scelto.userId);
      spostati.push(scelto.userId);
      passi.push({ profondita, posizioneId: v.posizioneId, lasciataDa: v.lasciataDa, successoreUserId: scelto.userId, mesi: MESI_DI_PRONTEZZA[scelto.prontezza!] });
      for (const posId of lascia(scelto.userId)) prossimo.push({ posizioneId: posId, lasciataDa: scelto.userId });
      if (!primariPerPosizione.has(v.posizioneId)) primariPerPosizione.set(v.posizioneId, new Set());
      primariPerPosizione.get(v.posizioneId)!.add(scelto.userId);
    }
    livello = ordina(prossimo);
    profondita += 1;
  }

  function scegli(posizioneId: string): Successore | null {
    const titolari = primariPerPosizione.get(posizioneId) ?? new Set<string>();
    const idonei = (candidatiPerPosizione.get(posizioneId) ?? []).filter((s) => {
      if (s.prontezza === null || MESI_DI_PRONTEZZA[s.prontezza] === null) return false;
      return !escono.has(s.userId) && !giaSpostati.has(s.userId) && !titolari.has(s.userId);
    });
    idonei.sort(
      (a, b) =>
        MESI_DI_PRONTEZZA[a.prontezza!]! - MESI_DI_PRONTEZZA[b.prontezza!]! ||
        Number(b.confermato) - Number(a.confermato) ||
        confronta(a.userId, b.userId),
    );
    return idonei[0] ?? null;
  }

  const coperti = passi.filter((p) => p.successoreUserId !== null);
  const elencoScoperte = [...scoperte].sort((a, b) => confronta(posizioni.get(a)!.codice, posizioni.get(b)!.codice) || confronta(a, b));
  return {
    passi,
    vacantiIniziali,
    coperte: coperti.length,
    scoperte: elencoScoperte,
    scoperteCritiche: elencoScoperte.filter((id) => CRITICITA_ALTE.has(posizioni.get(id)!.criticita ?? "")).length,
    spostati,
    lunghezzaCatena: coperti.reduce((m, p) => Math.max(m, p.profondita), 0),
    mesiAllaCopertura: coperti.length === 0 ? null : coperti.reduce((m, p) => Math.max(m, p.mesi ?? 0), 0),
    troncata,
  };
}
