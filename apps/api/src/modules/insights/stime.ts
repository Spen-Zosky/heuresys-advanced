/**
 * apps/api/src/modules/insights/stime.ts
 * F3c — compone le stime dalla storia del tenant: legge con storia-repository.ts,
 * stima con probabilita.ts, restituisce ipotesi STIMA pronte per il motore degli scenari.
 *
 * Quando la storia non contiene nemmeno un evento (per RTL Bank, misurato il 2026-11-26:
 * nessuna uscita e nessun successore passato alla posizione bersaglio), la stima esce
 * lo stesso, con la sua banda, ma `senzaEventi` lo dice: la banda dice quanto in alto
 * potrebbe stare il tasso, non che il tasso sia zero.
 */
import {
  comeIpotesi,
  durataBootstrap,
  frequenzaJeffreys,
  provaSuPeriodoTenutoDaParte,
  suPiuPeriodi,
  tassoTrimestraleUscita,
  type IpotesiStimata,
  type ProvaTenutaDaParte,
} from "./probabilita.js";
import * as storia from "./storia-repository.js";
import type { DbConnector } from "./storia-repository.js";

export interface StimaConEsito {
  codice: string;
  ipotesi: IpotesiStimata | null;
  /** La storia non ha nemmeno un evento di questo tipo. */
  senzaEventi: boolean;
  /** Perché manca l'ipotesi, quando manca. */
  nota: string | null;
}

export interface StimeDallaStoria {
  tenantId: string;
  dal: string;
  storiaGenerata: boolean;
  stime: StimaConEsito[];
  /** La prova di F3c sulle uscite: null se i trimestri non bastano a tenerne quattro da parte. */
  provaUscite: ProvaTenutaDaParte | null;
}

const ORDINE = new Map<string, number>(storia.GRADINI_PRONTEZZA.map((g, i) => [g, i]));

function meno36Mesi(oggi: Date): string {
  const d = new Date(Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth() - 36, 1));
  return d.toISOString().slice(0, 10);
}

export async function stimeDallaStoria(
  db: DbConnector,
  tenantId: string,
  opzioni: { dal?: string; oggi?: Date } = {},
): Promise<StimeDallaStoria> {
  const dal = opzioni.dal ?? meno36Mesi(opzioni.oggi ?? new Date());
  const generata = await storia.storiaGenerata(db, tenantId);
  const base = { storiaGenerata: generata };
  const stime: StimaConEsito[] = [];

  // ── Uscite ────────────────────────────────────────────────────────────────────────
  const trimestri = (await storia.leggiTrimestriUscite(db, tenantId, dal)).filter((t) => t.esposti > 0);
  let provaUscite: ProvaTenutaDaParte | null = null;
  if (trimestri.length === 0) {
    stime.push({ codice: "uscita_12_mesi", ipotesi: null, senzaEventi: true, nota: "nessuna persona in forza nella finestra" });
  } else {
    const tasso = tassoTrimestraleUscita(trimestri);
    const uscite = trimestri.reduce((s, t) => s + t.uscite, 0);
    stime.push({
      codice: "uscita_12_mesi",
      ipotesi: comeIpotesi(suPiuPeriodi(tasso, 4), {
        ...base,
        statement: `Probabilità che una persona lasci l'organizzazione entro dodici mesi, da ${uscite} uscite su ${tasso.casi} persone-trimestre dal ${trimestri[0]?.inizio}.`,
        unit: "%",
        scala: 100,
        cifre: 2,
        metodo: "Beta di Jeffreys sul tasso trimestrale, 1-(1-q)^4",
        fonte: { ref: "/insights", label: "Storia delle uscite del tenant" },
      }),
      senzaEventi: uscite === 0,
      nota: uscite === 0 ? "nessuna uscita nella storia: la banda è un limite superiore, non un tasso osservato" : null,
    });
    if (trimestri.length >= 8) {
      const taglio = trimestri[trimestri.length - 4]?.inizio as string;
      provaUscite = provaSuPeriodoTenutoDaParte(trimestri, taglio);
    }
  }

  // ── Selezione ─────────────────────────────────────────────────────────────────────
  const selezioni = await storia.leggiDurateSelezione(db, tenantId);
  const giorniSel = selezioni.map((s) => s.giorni);
  for (const [codice, q, testo] of [
    ["selezione_giorni_mediana", 0.5, "Giorni tipici (mediana)"],
    ["selezione_giorni_p90", 0.9, "Giorni entro cui si chiude nove volte su dieci (90° percentile)"],
  ] as const) {
    const s = durataBootstrap(giorniSel, q);
    stime.push({
      codice,
      ipotesi: s
        ? comeIpotesi(s, {
            ...base,
            statement: `${testo} dall'apertura di una selezione all'ingresso della persona, su ${s.casi} selezioni concluse.`,
            unit: "giorni",
            cifre: 0,
            metodo: "quantile empirico, banda bootstrap con seme fisso",
            fonte: { ref: "/recruiting", label: "Selezioni concluse del tenant" },
          })
        : null,
      senzaEventi: giorniSel.length === 0,
      nota: s ? null : `selezioni concluse: ${giorniSel.length}, ne servono almeno due`,
    });
  }

  // ── Formazione ────────────────────────────────────────────────────────────────────
  const corsi = await storia.leggiDurateFormazione(db, tenantId);
  const giorniCorsi = corsi.flatMap((c) => (c.giorni === null ? [] : [c.giorni]));
  const durata = durataBootstrap(giorniCorsi, 0.5);
  stime.push({
    codice: "formazione_giorni_mediana",
    ipotesi: durata
      ? comeIpotesi(durata, {
          ...base,
          statement: `Giorni tipici (mediana) dall'inizio di un corso al suo completamento, su ${durata.casi} corsi completati.`,
          unit: "giorni",
          cifre: 0,
          metodo: "quantile empirico, banda bootstrap con seme fisso",
          fonte: { ref: "/learning", label: "Corsi assegnati e attestati del tenant" },
        })
      : null,
    senzaEventi: giorniCorsi.length === 0,
    nota: durata ? null : `corsi completati con data di inizio: ${giorniCorsi.length}`,
  });
  const conScadenza = corsi.filter((c) => c.entroScadenza !== null);
  const entro = conScadenza.filter((c) => c.entroScadenza).length;
  stime.push({
    codice: "formazione_entro_scadenza",
    ipotesi:
      conScadenza.length > 0
        ? comeIpotesi(frequenzaJeffreys(entro, conScadenza.length), {
            ...base,
            statement: `Probabilità che un corso con scadenza si completi entro la scadenza, da ${entro} su ${conScadenza.length}.`,
            unit: "%",
            scala: 100,
            metodo: "Beta di Jeffreys",
            fonte: { ref: "/learning", label: "Corsi con scadenza del tenant" },
          })
        : null,
    senzaEventi: conScadenza.length === 0,
    nota: conScadenza.length > 0 ? null : "nessun corso con scadenza e attestato",
  });

  // ── Prontezza dei successori ──────────────────────────────────────────────────────
  const passaggi = (await storia.leggiPassaggiProntezza(db, tenantId)).filter(
    (p) => ORDINE.has(p.prima) && ORDINE.has(p.dopo) && p.prima !== "READY_NOW",
  );
  const salite = passaggi.filter((p) => (ORDINE.get(p.dopo) as number) > (ORDINE.get(p.prima) as number)).length;
  const mediaGiorni =
    passaggi.length > 0 ? Math.round(passaggi.reduce((s, p) => s + p.giorni, 0) / passaggi.length) : null;
  stime.push({
    codice: "prontezza_sale_un_gradino",
    ipotesi:
      passaggi.length > 0
        ? comeIpotesi(frequenzaJeffreys(salite, passaggi.length), {
            ...base,
            statement: `Probabilità che un successore salga almeno di un gradino di prontezza fra una valutazione e la successiva (in media ${mediaGiorni} giorni dopo), da ${salite} su ${passaggi.length}.`,
            unit: "%",
            scala: 100,
            metodo: "Beta di Jeffreys sulle coppie di valutazioni successive",
            fonte: { ref: "/succession", label: "Valutazioni di prontezza dei successori" },
          })
        : null,
    senzaEventi: passaggi.length === 0,
    nota: passaggi.length > 0 ? null : "nessun candidato con due valutazioni",
  });

  // La finestra comincia dal trimestre che contiene `dal`: si dichiara quello, come fa la frase delle uscite.
  return { tenantId, dal: trimestri[0]?.inizio ?? dal, storiaGenerata: generata, stime, provaUscite };
}
