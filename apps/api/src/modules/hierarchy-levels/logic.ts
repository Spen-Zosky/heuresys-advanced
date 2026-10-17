/**
 * apps/api/src/modules/hierarchy-levels/logic.ts
 * IL PRINCIPIO GERARCHIA-LIVELLI (#265, decisione di Enzo dell'11 ottobre 2026): chi sta sopra non ha mai un livello
 * contrattuale inferiore a chi sta sotto. Fra pari livello la dipendenza gerarchica è ammessa (un QD2 può guidare un'unità
 * dove ci sono altri QD2); non è ammesso che un QD2 guidi un'unità dove c'è un QD3.
 *
 * È un AVVISO con motivazione scritta, non un blocco: la funzione non rifiuta niente, descrive. Chi la chiama decide dove mostrarla
 * (anteprima di attivazione di un modello, cambio di posto o di riporto).
 *
 * Pura: niente database, niente tempo. L'ordine dei livelli (`Scala`) non è scritto qui: lo ricava il chiamante dal contratto
 * collettivo caricato (il minimo annuo di ogni livello), perché l'ordine è un dato del contratto e non del codice.
 */

/** I livelli di un contratto, dal più basso al più alto. Il codice è quello del contratto caricato (es. CCNL_CREDITO_QD3). */
export interface Scala {
  readonly ordine: readonly string[];
}

export interface Persona {
  /** Identificativo opaco (utente nel tenant, posizione nel modello): serve a chi chiama per risalire al caso. */
  id: string;
  /** Come si chiama il posto, mai la persona: l'avviso non porta dati personali. */
  posto: string;
  /** Codice del livello contrattuale così come lo porta il dato (può essere nel vocabolario del tenant: 3A1L, QD3, Dirigente). */
  livello: string | null;
}

export interface Unita {
  id: string;
  nome: string;
  padreId: string | null;
  responsabile: Persona | null;
  persone: Persona[];
}

export interface Avviso {
  unitaId: string;
  unitaNome: string;
  responsabileId: string;
  responsabileLivello: string;
  sottopostoId: string;
  sottopostoPosto: string;
  sottopostoLivello: string;
  /** La motivazione scritta, in italiano, leggibile da chi non conosce i codici. */
  motivazione: string;
}

export interface NonValutabile {
  id: string;
  posto: string;
  livello: string | null;
  ragione: "LIVELLO_ASSENTE" | "LIVELLO_FUORI_SCALA";
}

export interface Esito {
  avvisi: Avviso[];
  nonValutabili: NonValutabile[];
}

/**
 * Il posto del livello `codice` nella scala, oppure null se non si può dire.
 * Il dato del tenant usa un vocabolario più corto di quello del contratto (QD3 per CCNL_CREDITO_QD3, 3A1L per CCNL_CREDITO_3AREA_L1,
 * Dirigente per CCNL_CREDITO_DIRIGENTI_DIR): si riconosce solo ciò che combacia in modo non ambiguo, il resto resta "fuori scala"
 * e viene detto, non indovinato.
 */
export function rango(codice: string | null, scala: Scala): number | null {
  if (codice === null || codice.trim() === "") return null;
  const c = codice.trim().toUpperCase();
  const esatto = scala.ordine.findIndex((l) => l.toUpperCase() === c);
  if (esatto >= 0) return esatto;
  const alias: string[] = [`_${c}`];
  const area = /^3A(\d)L$/.exec(c);
  if (area) alias.push(`_3AREA_L${area[1]}`);
  if (c === "DIRIGENTE") alias.push("_DIR");
  for (const a of alias) {
    const trovati = scala.ordine.map((l, i) => [l.toUpperCase(), i] as const).filter(([l]) => l.endsWith(a));
    if (trovati.length === 1) return trovati[0]![1];
  }
  return null;
}

/** Tutte le unità sotto `radice` (esclusa), per padre. */
function discendenti(radice: string, perPadre: Map<string, Unita[]>): Unita[] {
  const fuori: Unita[] = [];
  const pila = [...(perPadre.get(radice) ?? [])];
  const viste = new Set<string>([radice]);
  while (pila.length > 0) {
    const u = pila.pop()!;
    if (viste.has(u.id)) continue; // un ciclo non deve fermare il controllo
    viste.add(u.id);
    fuori.push(u);
    pila.push(...(perPadre.get(u.id) ?? []));
  }
  return fuori;
}

/**
 * Per ogni unità con un responsabile, il livello del responsabile deve essere pari o superiore a quello di ogni persona
 * dell'unità e delle unità sotto, e di ogni responsabile delle unità sotto (per transitività vale sull'intera catena).
 */
export function verifica(unita: readonly Unita[], scala: Scala): Esito {
  const perPadre = new Map<string, Unita[]>();
  for (const u of unita) {
    if (u.padreId === null) continue;
    perPadre.set(u.padreId, [...(perPadre.get(u.padreId) ?? []), u]);
  }
  const avvisi: Avviso[] = [];
  const nonVal = new Map<string, NonValutabile>();
  const nota = (p: Persona): void => {
    const r = rango(p.livello, scala);
    if (r === null) {
      nonVal.set(p.id, { id: p.id, posto: p.posto, livello: p.livello, ragione: p.livello === null ? "LIVELLO_ASSENTE" : "LIVELLO_FUORI_SCALA" });
    }
  };

  for (const u of unita) {
    if (u.responsabile) nota(u.responsabile);
    for (const p of u.persone) nota(p);
    const capo = u.responsabile;
    if (!capo) continue;
    const rc = rango(capo.livello, scala);
    if (rc === null) continue; // senza il livello del capo non si può confrontare: sta già fra i non valutabili
    const sotto = discendenti(u.id, perPadre);
    const candidati: Persona[] = [
      ...u.persone,
      ...sotto.flatMap((d) => [...d.persone, ...(d.responsabile ? [d.responsabile] : [])]),
    ];
    const visti = new Set<string>([capo.id]);
    for (const p of candidati) {
      if (visti.has(p.id)) continue;
      visti.add(p.id);
      const rp = rango(p.livello, scala);
      if (rp === null || rp <= rc) continue;
      avvisi.push({
        unitaId: u.id,
        unitaNome: u.nome,
        responsabileId: capo.id,
        responsabileLivello: capo.livello!,
        sottopostoId: p.id,
        sottopostoPosto: p.posto,
        sottopostoLivello: p.livello!,
        motivazione:
          `Nell'unità «${u.nome}» il responsabile (posto «${capo.posto}») ha livello ${capo.livello}, ` +
          `ma «${p.posto}», che sta nella stessa unità o sotto di essa, ha un livello più alto (${p.livello}). ` +
          `Chi guida non dovrebbe avere un livello contrattuale inferiore a chi è guidato.`,
      });
    }
  }
  return { avvisi, nonValutabili: [...nonVal.values()] };
}

/** La chiave di un avviso: lo stesso caso (unità, sottoposto) è lo stesso avviso prima e dopo una modifica. */
const chiave = (a: Avviso): string => `${a.unitaId}|${a.sottopostoId}`;

/**
 * Gli avvisi che una modifica INTRODUCE: quelli di `dopo` che non c'erano in `prima`. Un avviso che c'era già non è colpa di questa
 * modifica e non va ripetuto a chi la fa (resta visibile in `GET /v1/hierarchy-levels/check`).
 */
export function avvisiNuovi(prima: readonly Avviso[], dopo: readonly Avviso[]): Avviso[] {
  const gia = new Set(prima.map(chiave));
  return dopo.filter((a) => !gia.has(chiave(a)));
}

/**
 * L'organigramma com'è DOPO un'assegnazione proposta: la persona (`persona`) siede nell'unità `unitaId`; se `togliDaPersonaId` è
 * valorizzato (trasferimento) la stessa persona esce prima da dove sedeva. Non modifica `unita`. Chi è già il responsabile
 * dell'unità non viene aggiunto fra le persone: lo è già.
 */
export function conAssegnazione(unita: readonly Unita[], persona: Persona, unitaId: string, togliDaPersonaId?: string): Unita[] {
  return unita.map((u) => {
    const senza = togliDaPersonaId === undefined ? u.persone : u.persone.filter((p) => p.id !== togliDaPersonaId);
    if (u.id !== unitaId || u.responsabile?.id === persona.id || senza.some((p) => p.id === persona.id)) return { ...u, persone: senza };
    return { ...u, persone: [...senza, persona] };
  });
}
