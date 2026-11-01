/**
 * apps/api/src/modules/tenant-consolidation/engine.ts — AC-7.
 *
 * Il MOTORE dei giri di un gruppo (`.programmi/consolidamento/agente/05_DISEGNO_TECNICO.md` §5).
 * Puro: niente database, niente rete. Il giudice gli arriva come parametro, così le prove
 * girano con un doppio e il modello vero sta solo nel gateway.
 *
 * Il percorso:
 *   1. giro zero, per CHIAVE: indirizzo ESCO, oppure tipo e livello tradotti dal vocabolario
 *      comune approvato, purché la coppia sia unica da entrambe le parti;
 *   2. giri semantici: per ogni voce libera del tenant si scelgono i candidati con la somiglianza
 *      per trigrammi (la stessa misura di `pg_trgm`) sui nomi della COPIA DI LAVORO, già tradotti;
 *      il giudice risponde; le equipollenze sicure e senza conflitto si ADOTTANO nella copia, cioè
 *      la voce del prototipo prende il nome della voce del tenant (R-13);
 *   3. arresto quando un giro non adotta niente di nuovo (R-14), con un fusibile tecnico;
 *   4. le voci rimaste libere diventano lacune (prototipo) e personalizzazioni (tenant).
 *
 * Il prototipo approvato non si tocca: la copia di lavoro è un oggetto a parte, e ogni voce
 * conserva il suo nome originale (terza cautela di R-13).
 */

export interface Voce {
  /** Prototipo: il codice (chiave stabile fra versioni, misura AC-0). Tenant: l'identificativo. */
  key: string;
  name: string;
  code?: string | null;
  description?: string | null;
  type?: string | null;
  level?: string | null;
  parentName?: string | null;
  escoUri?: string | null;
  activities?: string[];
}

/** Una voce della copia di lavoro: il nome originale non cambia mai, quello tradotto sì. */
export interface VoceDiLavoro extends Voce {
  originalName: string;
  translatedInRound: number | null;
}

export interface Domanda {
  tenantItem: Voce;
  candidates: Voce[];
}

export interface RispostaGiudice {
  tenantKey: string;
  prototypeKeys: string[];
  confidence: number;
  reason: string;
}

export type Giudice = (lotto: { group: string; round: number; questions: Domanda[] }) => Promise<RispostaGiudice[]>;

export type Esito = "CORRISPONDENZA" | "LACUNA" | "PERSONALIZZAZIONE";
export type Metodo = "CHIAVE" | "VOCABOLARIO" | "SEMANTICA";

export interface Proposta {
  /** Identificativo locale della proposta dentro la sessione (l'API lo mappa sull'uuid). */
  id: string;
  outcome: Esito;
  method: Metodo;
  prototypeKeys: string[];
  tenantKeys: string[];
  confidence: number;
  reason: string;
  round: number;
  adoptedInWorkingCopy: boolean;
  /** Le adozioni dei giri precedenti su cui questa proposta si appoggia (rifacimento al rifiuto). */
  dependsOn: string[];
}

export interface StatoGruppo {
  group: string;
  prototype: VoceDiLavoro[];
  tenant: Voce[];
  proposals: Proposta[];
  /** Le proposte rifiutate da una persona: l'agente non le ripropone (registro, R-4). */
  rejected: Array<{ prototypeKeys: string[]; tenantKeys: string[] }>;
  rounds: Array<{ round: number; adopted: number; asked: number }>;
  /** Vero se si è fermato il fusibile e non la regola: è un'anomalia da segnalare. */
  fuseTripped: boolean;
}

export interface Opzioni {
  /** Fiducia da cui un'equipollenza si adotta da sola nella copia. Valore iniziale, da ritarare (§5). */
  safeConfidence?: number;
  /** Il fusibile: non la regola d'arresto, la protezione contro un ciclo che non converge. */
  maxRounds?: number;
  maxCandidates?: number;
  batchSize?: number;
  /** Equivalenze di vocabolario approvate dalla piattaforma: termine del tenant → termine del prototipo. */
  vocabulary?: ReadonlyMap<string, string>;
}

const DEFAULTS = { safeConfidence: 90, maxRounds: 12, maxCandidates: 8, batchSize: 25 } as const;

/* ── Somiglianza per trigrammi, come pg_trgm ─────────────────────────────────────────── */

function trigrammi(testo: string): Set<string> {
  const out = new Set<string>();
  const parole = testo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  for (const p of parole) {
    const s = `  ${p} `;
    for (let i = 0; i + 3 <= s.length; i++) out.add(s.slice(i, i + 3));
  }
  return out;
}

/** `similarity()` di pg_trgm: trigrammi in comune su trigrammi distinti dell'unione. */
export function somiglianza(a: string, b: string): number {
  const ta = trigrammi(a);
  const tb = trigrammi(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let comuni = 0;
  for (const t of ta) if (tb.has(t)) comuni++;
  return comuni / (ta.size + tb.size - comuni);
}

/* ── Copia di lavoro ─────────────────────────────────────────────────────────────────── */

export function copiaDiLavoro(prototipo: Voce[]): VoceDiLavoro[] {
  return prototipo.map((v) => ({ ...v, originalName: v.name, translatedInRound: null }));
}

export function nuovoStato(group: string, prototipo: Voce[], tenant: Voce[]): StatoGruppo {
  return { group, prototype: copiaDiLavoro(prototipo), tenant, proposals: [], rejected: [], rounds: [], fuseTripped: false };
}

function chiaviOccupate(stato: StatoGruppo): { proto: Set<string>; tenant: Set<string> } {
  const proto = new Set<string>();
  const tenant = new Set<string>();
  for (const p of stato.proposals) {
    if (p.outcome !== "CORRISPONDENZA" || !p.adoptedInWorkingCopy) continue;
    p.prototypeKeys.forEach((k) => proto.add(k));
    p.tenantKeys.forEach((k) => tenant.add(k));
  }
  return { proto, tenant };
}

function giaRifiutata(stato: StatoGruppo, proto: string[], tenant: string[]): boolean {
  const k = (a: string[]) => [...a].sort().join("|");
  return stato.rejected.some((r) => k(r.prototypeKeys) === k(proto) && k(r.tenantKeys) === k(tenant));
}

let contatore = 0;
function nuovoId(): string {
  contatore += 1;
  return `p${contatore}`;
}

function adotta(stato: StatoGruppo, p: Proposta): void {
  p.adoptedInWorkingCopy = true;
  // R-13: il prototipo prende la nomenclatura del tenant. Con una sola voce del tenant il nome
  // tradotto è il suo; con più voci (il tenant ne ha due dove il prototipo ne ha una) si uniscono.
  const nomi = stato.tenant.filter((t) => p.tenantKeys.includes(t.key)).map((t) => t.name);
  for (const v of stato.prototype) {
    if (!p.prototypeKeys.includes(v.key)) continue;
    v.name = nomi.join(" / ");
    v.translatedInRound = p.round;
  }
}

/* ── Giro zero: chiavi comuni ────────────────────────────────────────────────────────── */

export function giroZero(stato: StatoGruppo, opz: Opzioni = {}): number {
  const vocab = opz.vocabulary ?? new Map<string, string>();
  let adottate = 0;
  const unico = <T>(lista: T[], f: (x: T) => string | null): Map<string, T> => {
    const conta = new Map<string, T[]>();
    for (const x of lista) {
      const k = f(x);
      if (!k) continue;
      conta.set(k, [...(conta.get(k) ?? []), x]);
    }
    return new Map([...conta].filter(([, v]) => v.length === 1).map(([k, v]) => [k, v[0]!]));
  };

  const tentativi: Array<{ metodo: Metodo; fp: (v: Voce) => string | null; ft: (v: Voce) => string | null; motivo: string }> = [
    { metodo: "CHIAVE", fp: (v) => v.escoUri ?? null, ft: (v) => v.escoUri ?? null, motivo: "Stesso indirizzo ESCO da entrambe le parti." },
    {
      metodo: "VOCABOLARIO",
      fp: (v) => (v.type && v.level ? `${v.type}#${v.level}#${(v.parentName ?? "").toLowerCase()}` : null),
      ft: (v) => {
        const tipo = v.type ? vocab.get(v.type) ?? null : null;
        return tipo && v.level ? `${tipo}#${v.level}#${(v.parentName ?? "").toLowerCase()}` : null;
      },
      motivo: "Stesso tipo (secondo il vocabolario comune approvato), stesso livello e stessa voce madre.",
    },
  ];

  for (const t of tentativi) {
    const occ = chiaviOccupate(stato);
    const p = unico(stato.prototype.filter((v) => !occ.proto.has(v.key)), t.fp);
    const tn = unico(stato.tenant.filter((v) => !occ.tenant.has(v.key)), t.ft);
    for (const [k, vp] of p) {
      const vt = tn.get(k);
      if (!vt || giaRifiutata(stato, [vp.key], [vt.key])) continue;
      const prop: Proposta = {
        id: nuovoId(), outcome: "CORRISPONDENZA", method: t.metodo, prototypeKeys: [vp.key], tenantKeys: [vt.key],
        confidence: 100, reason: t.motivo, round: 0, adoptedInWorkingCopy: false, dependsOn: [],
      };
      stato.proposals.push(prop);
      adotta(stato, prop);
      adottate++;
    }
  }
  stato.rounds.push({ round: 0, adopted: adottate, asked: 0 });
  return adottate;
}

/* ── Giri semantici ──────────────────────────────────────────────────────────────────── */

export function scegliCandidati(voce: Voce, liberi: VoceDiLavoro[], quanti: number): VoceDiLavoro[] {
  return liberi
    .map((c) => ({ c, s: somiglianza(voce.name, c.name) + (voce.parentName && c.parentName && somiglianza(voce.parentName, c.parentName) > 0.5 ? 0.2 : 0) }))
    .sort((a, b) => b.s - a.s || a.c.key.localeCompare(b.c.key))
    .slice(0, quanti)
    .map((x) => x.c);
}

async function unGiro(stato: StatoGruppo, giudice: Giudice, round: number, o: Required<Omit<Opzioni, "vocabulary">>): Promise<number> {
  const occ = chiaviOccupate(stato);
  const protoLiberi = stato.prototype.filter((v) => !occ.proto.has(v.key));
  const tenantLiberi = stato.tenant.filter((v) => !occ.tenant.has(v.key));
  if (protoLiberi.length === 0 || tenantLiberi.length === 0) {
    stato.rounds.push({ round, adopted: 0, asked: 0 });
    return 0;
  }
  // Le proposte non adottate dei giri passati si rimpiazzano: questo giro vede nomi più tradotti.
  stato.proposals = stato.proposals.filter((p) => p.adoptedInWorkingCopy || p.method !== "SEMANTICA");
  const base = stato.proposals.filter((p) => p.adoptedInWorkingCopy).map((p) => p.id);

  // Al giudice va la voce, non la copia di lavoro: il suo contratto è `.strict()`.
  const comeVoce = ({ originalName: _o, translatedInRound: _t, ...v }: VoceDiLavoro): Voce => v;
  const domande: Domanda[] = tenantLiberi.map((t) => ({
    tenantItem: t,
    candidates: scegliCandidati(t, protoLiberi, o.maxCandidates).map(comeVoce),
  }));
  const risposte: RispostaGiudice[] = [];
  for (let i = 0; i < domande.length; i += o.batchSize) {
    risposte.push(...(await giudice({ group: stato.group, round, questions: domande.slice(i, i + o.batchSize) })));
  }

  // Il giudice si controlla di nuovo qui: valgono solo voci libere di questo giro.
  const protoAmmessi = new Set(protoLiberi.map((v) => v.key));
  const tenantAmmessi = new Set(tenantLiberi.map((v) => v.key));
  const valide = risposte
    .filter((r) => tenantAmmessi.has(r.tenantKey))
    .map((r) => ({ ...r, prototypeKeys: r.prototypeKeys.filter((k) => protoAmmessi.has(k)) }));

  // Dalla fiducia più alta alla più bassa: a parità di prototipo vince la proposta più sicura.
  const prese = new Set<string>();
  let adottate = 0;
  for (const r of valide.sort((a, b) => b.confidence - a.confidence)) {
    if (r.prototypeKeys.length === 0 || giaRifiutata(stato, r.prototypeKeys, [r.tenantKey])) continue;
    const conflitto = r.prototypeKeys.some((k) => prese.has(k));
    const prop: Proposta = {
      id: nuovoId(), outcome: "CORRISPONDENZA", method: "SEMANTICA", prototypeKeys: r.prototypeKeys, tenantKeys: [r.tenantKey],
      confidence: r.confidence, reason: r.reason, round, adoptedInWorkingCopy: false, dependsOn: base,
    };
    stato.proposals.push(prop);
    if (r.confidence >= o.safeConfidence && !conflitto) {
      r.prototypeKeys.forEach((k) => prese.add(k));
      adotta(stato, prop);
      adottate++;
    }
  }
  stato.rounds.push({ round, adopted: adottate, asked: domande.length });
  return adottate;
}

/** Chiude il gruppo: ciò che resta libero diventa lacuna o personalizzazione. */
export function chiudiGruppo(stato: StatoGruppo): void {
  stato.proposals = stato.proposals.filter((p) => p.outcome === "CORRISPONDENZA");
  const coperte = { proto: new Set<string>(), tenant: new Set<string>() };
  for (const p of stato.proposals) {
    p.prototypeKeys.forEach((k) => coperte.proto.add(k));
    p.tenantKeys.forEach((k) => coperte.tenant.add(k));
  }
  const ultimo = stato.rounds.at(-1)?.round ?? 0;
  for (const v of stato.prototype) {
    if (coperte.proto.has(v.key)) continue;
    stato.proposals.push({
      id: nuovoId(), outcome: "LACUNA", method: "SEMANTICA", prototypeKeys: [v.key], tenantKeys: [], confidence: 100,
      reason: "Il prototipo ha questa voce e il tenant non ha niente che le corrisponda.", round: ultimo, adoptedInWorkingCopy: false, dependsOn: [],
    });
  }
  for (const v of stato.tenant) {
    if (coperte.tenant.has(v.key)) continue;
    stato.proposals.push({
      id: nuovoId(), outcome: "PERSONALIZZAZIONE", method: "SEMANTICA", prototypeKeys: [], tenantKeys: [v.key], confidence: 100,
      reason: "Questa voce è del tenant e il prototipo non la conosce: resta sua.", round: ultimo, adoptedInWorkingCopy: false, dependsOn: [],
    });
  }
}

/** Tutto il percorso di un gruppo: giro zero, giri fino a zero adozioni, chiusura. */
export async function consolidaGruppo(stato: StatoGruppo, giudice: Giudice, opz: Opzioni = {}): Promise<StatoGruppo> {
  const o = { ...DEFAULTS, ...opz };
  if (stato.rounds.length === 0) giroZero(stato, opz);
  let round = (stato.rounds.at(-1)?.round ?? 0) + 1;
  for (;;) {
    if (round > o.maxRounds) {
      stato.fuseTripped = true;
      break;
    }
    const adottate = await unGiro(stato, giudice, round, o);
    if (adottate === 0) break;
    round++;
  }
  chiudiGruppo(stato);
  return stato;
}

/**
 * Una persona rifiuta un'equipollenza adottata: la sua traduzione esce dalla copia, le proposte
 * che si appoggiavano su di lei si tolgono, e i giri si rifanno dal giro in cui era nata.
 * Restituisce lo stato da passare di nuovo a `consolidaGruppo`.
 */
export function rifiuta(stato: StatoGruppo, proposalId: string): StatoGruppo {
  const p = stato.proposals.find((x) => x.id === proposalId);
  if (!p) throw new Error(`proposta sconosciuta: ${proposalId}`);
  stato.rejected.push({ prototypeKeys: p.prototypeKeys, tenantKeys: p.tenantKeys });
  if (p.outcome !== "CORRISPONDENZA") {
    stato.proposals = stato.proposals.filter((x) => x.id !== proposalId);
    return stato;
  }
  const da = p.round;
  const restano = stato.proposals.filter(
    (x) => x.outcome === "CORRISPONDENZA" && x.id !== proposalId && !x.dependsOn.includes(proposalId) && x.round < Math.max(da, 1),
  );
  // Le adozioni del giro zero e quelle dei giri precedenti a `da` restano; tutto il resto si rifà.
  const vive = new Set(restano.filter((x) => x.adoptedInWorkingCopy).map((x) => x.id));
  for (const v of stato.prototype) {
    const tradotta = restano.some((x) => vive.has(x.id) && x.prototypeKeys.includes(v.key));
    if (!tradotta) {
      v.name = v.originalName;
      v.translatedInRound = null;
    }
  }
  stato.proposals = restano;
  stato.rounds = stato.rounds.filter((r) => r.round < Math.max(da, 1));
  stato.fuseTripped = false;
  return stato;
}
