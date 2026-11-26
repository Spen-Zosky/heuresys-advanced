/**
 * apps/api/src/lib/equita/valuta.ts — il controllo di equità (E12, ADR-0063), voce F6b.
 *
 * Funzioni pure: nessun I/O, nessun orologio fuori dal parametro `oggi`. Ricevono le persone
 * di una proposta, ognuna con l'esito (favorevole o no) e i suoi tratti protetti, e restituiscono
 * la dichiarazione che la proposta porta con sé (`EquitaDichiarazione` in @heuresys/shared).
 *
 * Metodo: regola dei quattro quinti, tratto per tratto. Il contratto e le ragioni delle scelte
 * (gruppi piccoli riuniti, valori mancanti esclusi, ingressi controllati) stanno in testa a
 * packages/shared/src/schemas/equita.ts.
 */
import {
  EQUITA_GRUPPO_NON_DICHIARATO,
  EQUITA_GRUPPO_PICCOLI,
  EQUITA_TRATTO_VALUES,
  type EquitaControlloTratto,
  type EquitaDichiarazione,
  type EquitaGruppo,
  type EquitaTratto,
} from "@heuresys/shared";

export const EQUITA_METODO = "equita-quattro-quinti@1.0.0";
export const EQUITA_SOGLIA = 0.8;
export const EQUITA_MINIMO_GRUPPO = 5;

/** I tratti di una persona come li legge `leggiTrattiProtetti`; null = non dichiarato. */
export interface TrattiPersona {
  genere: string | null;
  /** Data di nascita `YYYY-MM-DD`: si trasforma in fascia qui e non esce mai. */
  nascita: string | null;
  nazionalita: string | null;
  statoCivile: string | null;
}

export interface PersonaInProposta {
  userId: string;
  favorevole: boolean;
  tratti: TrattiPersona | undefined;
}

/**
 * Nomi di ingresso che sono un tratto protetto: se un modello ne usa uno, la proposta non è
 * raccomandabile, qualunque sia il rapporto misurato.
 */
const INGRESSI_PROTETTI = /(^|_)(gender|genere|sex|sesso|age|eta|birth|nascita|nationality|nazionalita|citizenship|cittadinanza|marital|stato_civile|religion|religione|ethnicity|etnia|disability|disabilita|pregnan|gravidanza|maternity|maternita)($|_)/i;

/** Ingressi vicini a un tratto: non vietati, ma dichiarati. */
const INGRESSI_VICINI: Record<string, EquitaTratto> = {
  tenure: "ETA",
  anzianita: "ETA",
  seniority: "ETA",
};

export function fasciaEta(nascita: string | null, oggi: Date): string | null {
  if (!nascita || !/^\d{4}-\d{2}-\d{2}$/.test(nascita)) return null;
  const [y, m, d] = nascita.split("-").map(Number) as [number, number, number];
  let anni = oggi.getUTCFullYear() - y;
  const mese = oggi.getUTCMonth() + 1;
  if (mese < m || (mese === m && oggi.getUTCDate() < d)) anni -= 1;
  if (anni < 30) return "MENO_DI_30";
  if (anni < 40) return "DA_30_A_39";
  if (anni < 50) return "DA_40_A_49";
  return "DA_50_IN_SU";
}

function valoreDelTratto(t: TrattiPersona | undefined, tratto: EquitaTratto, oggi: Date): string | null {
  if (!t) return null;
  let v: string | null = null;
  switch (tratto) {
    case "GENERE": v = t.genere; break;
    case "ETA": v = fasciaEta(t.nascita, oggi); break;
    case "NAZIONALITA": v = t.nazionalita; break;
    case "STATO_CIVILE": v = t.statoCivile; break;
  }
  // UNSPECIFIED è «non dichiarato», non un gruppo.
  return v && v.trim() && v !== "UNSPECIFIED" ? v.trim().toUpperCase() : null;
}

const arrotonda = (x: number): number => Math.round(x * 10000) / 10000;

export function controllaTratto(
  persone: PersonaInProposta[],
  tratto: EquitaTratto,
  oggi: Date,
  soglia = EQUITA_SOGLIA,
  minimo = EQUITA_MINIMO_GRUPPO,
): EquitaControlloTratto {
  const conteggi = new Map<string, { persone: number; favorevoli: number }>();
  for (const p of persone) {
    const g = valoreDelTratto(p.tratti, tratto, oggi) ?? EQUITA_GRUPPO_NON_DICHIARATO;
    const c = conteggi.get(g) ?? { persone: 0, favorevoli: 0 };
    c.persone += 1;
    if (p.favorevole) c.favorevoli += 1;
    conteggi.set(g, c);
  }
  const gruppi: EquitaGruppo[] = [];
  const piccoli = { persone: 0, favorevoli: 0 };
  for (const [g, c] of [...conteggi.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (g === EQUITA_GRUPPO_NON_DICHIARATO) continue;
    if (c.persone < minimo) {
      piccoli.persone += c.persone;
      piccoli.favorevoli += c.favorevoli;
      continue;
    }
    gruppi.push({ gruppo: g, persone: c.persone, favorevoli: c.favorevoli, quota: arrotonda(c.favorevoli / c.persone), confrontato: true });
  }
  // I gruppi piccoli e i non dichiarati si contano ma non si confrontano: le loro quote non escono.
  if (piccoli.persone > 0) gruppi.push({ gruppo: EQUITA_GRUPPO_PICCOLI, persone: piccoli.persone, favorevoli: 0, quota: null, confrontato: false });
  const nd = conteggi.get(EQUITA_GRUPPO_NON_DICHIARATO);
  if (nd) gruppi.push({ gruppo: EQUITA_GRUPPO_NON_DICHIARATO, persone: nd.persone, favorevoli: 0, quota: null, confrontato: false });

  const confrontati = gruppi.filter((g) => g.confrontato);
  if (confrontati.length < 2) {
    return { tratto, esito: "DATI_INSUFFICIENTI", rapporto: null, gruppoMenoFavorito: null, gruppoPiuFavorito: null, gruppi };
  }
  const ordinati = [...confrontati].sort((a, b) => (a.quota as number) - (b.quota as number));
  const basso = ordinati[0]!;
  const alto = ordinati[ordinati.length - 1]!;
  // Nessuno favorito in nessun gruppo: non c'è disparità da misurare, il rapporto è 1.
  const rapporto = (alto.quota as number) === 0 ? 1 : arrotonda((basso.quota as number) / (alto.quota as number));
  return {
    tratto,
    esito: rapporto >= soglia ? "SUPERATO" : "NON_SUPERATO",
    rapporto,
    gruppoMenoFavorito: basso.gruppo,
    gruppoPiuFavorito: alto.gruppo,
    gruppi,
  };
}

export interface OpzioniEquita {
  /** Chiave di traduzione di ciò che conta come esito favorevole. */
  esitoFavorevole: string;
  /** Le chiavi degli ingressi del modello, come compaiono nelle spiegazioni. */
  ingressi: readonly string[];
  oggi: Date;
  soglia?: number;
  minimoGruppo?: number;
}

export function valutaEquita(persone: PersonaInProposta[], o: OpzioniEquita): EquitaDichiarazione {
  const soglia = o.soglia ?? EQUITA_SOGLIA;
  const minimo = o.minimoGruppo ?? EQUITA_MINIMO_GRUPPO;
  const tratti = EQUITA_TRATTO_VALUES.map((t) => controllaTratto(persone, t, o.oggi, soglia, minimo));
  const ingressi = [...new Set(o.ingressi)];
  const ingressiProtetti = ingressi.filter((i) => INGRESSI_PROTETTI.test(i));
  const ingressiVicini = ingressi
    .filter((i) => INGRESSI_VICINI[i] !== undefined)
    .map((i) => ({ ingresso: i, tratto: INGRESSI_VICINI[i]! }));
  const esito = tratti.some((t) => t.esito === "NON_SUPERATO")
    ? "NON_SUPERATO"
    : tratti.some((t) => t.esito === "SUPERATO")
      ? "SUPERATO"
      : "DATI_INSUFFICIENTI";
  return {
    esito,
    raccomandabile: esito !== "NON_SUPERATO" && ingressiProtetti.length === 0,
    metodo: EQUITA_METODO,
    soglia,
    minimoGruppo: minimo,
    esitoFavorevole: o.esitoFavorevole,
    persone: persone.length,
    tratti,
    ingressi,
    ingressiProtetti,
    ingressiVicini,
    calcolatoIl: o.oggi.toISOString(),
  };
}
