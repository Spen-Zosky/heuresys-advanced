/**
 * apps/api/src/modules/scenari/nel-tempo.ts — lo scenario NEL TEMPO (S-T3, resistenza), voce F3b-3 del
 * piano docs/piani/PIANO_heuresys-ai-driven_20261126.md (ADR-0063 D5, D6).
 *
 * `calcolaScenarioNelTempo` apre lo scenario, fa la fotografia del tenant, legge dalla storia il tasso
 * di uscita e le durate delle selezioni (F3c), simula con il calcolatore puro `calcolatori/nel-tempo.ts`
 * e salva ipotesi, opzioni, leve, risultati con la banda e le fonti, in una sola transazione. Come lo
 * scenario di uscita, non scrive nessuna tabella di business.
 *
 * Le opzioni, sulle stesse uscite estratte (il caso è condiviso):
 *   A «nessuna copertura»           (isBaseline): ciò che si libera resta scoperto;
 *   B «copertura interna»           i successori coprono a cascata quando sono pronti;
 *   C «interna, poi da fuori»       ciò che resta scoperto si copre con una selezione esterna
 *                                   (solo se la storia ha almeno due selezioni concluse).
 *
 * Il tasso: di norma la stima della storia (Beta di Jeffreys sulle uscite per persona-trimestre),
 * estratta di nuovo a ogni estrazione; con `annualExitRate` è imposto, ed è una prova di resistenza
 * («e se nei prossimi 12 mesi esce il 10%?»), dichiarata come vincolo e non come stima.
 *
 * Equità: B e C spostano persone; finché le opzioni degli scenari non hanno il calcolo di F6b, il
 * controllo si dichiara DATI_INSUFFICIENTI e nessuna opzione è raccomandata (come in service.ts).
 */
import type { PoolClient } from "pg";
import { withTransaction } from "../../db/client.js";
import { comeIpotesi, durataBootstrap, frequenzaJeffreys, suPiuPeriodi } from "../insights/probabilita.js";
import * as storia from "../insights/storia-repository.js";
import {
  CALCOLATORE_NEL_TEMPO,
  calcolaNelTempo,
  POSIZIONI_MINIME_UNITA,
  SOGLIA_CEDIMENTO,
  trimestraleDaAnnuo,
  type Copertura,
  type Distribuzione,
  type EsitoNelTempo,
  type MisureOrizzonte,
  type TassoUscita,
} from "./calcolatori/nel-tempo.js";
import * as repo from "./repository.js";
import type { Fonte } from "./repository.js";

export const ORIZZONTI_PREDEFINITI = [6, 12, 36] as const;
export const ESTRAZIONI_PREDEFINITE = 1000;
/** Il seme è fisso: lo stesso tenant nello stesso stato dà gli stessi numeri (D5). */
export const SEME_NEL_TEMPO = 20261128;
/** Quante unità «che cedono» si mostrano per orizzonte. */
export const UNITA_MOSTRATE = 5;

const METODO_EQUITA_PROVVISORIO = "equita-non-calcolata@0.1.0";
const SOGLIA_EQUITA = 0.8;

export interface RichiestaNelTempo {
  tenantId: string;
  actorUserId: string | null;
  orizzontiMesi?: readonly number[];
  estrazioni?: number;
  /** tasso annuo di uscita imposto (prova di resistenza), fra 0 e 1 */
  tassoAnnuoImposto?: number;
}

export interface ScenarioNelTempoCalcolato {
  scenarioId: string;
  versionId: string;
  fotografia: repo.Fotografia;
  opzioni: Array<{ code: string; optionId: string; esito: EsitoNelTempo }>;
}

const FONTI_STRUTTURA: readonly Fonte[] = [
  { kind: "DATO", ref: "/v1/positions", label: "Posizioni del tenant" },
  { kind: "DATO", ref: "/v1/user-position-assignments", label: "Titolari delle posizioni" },
];
const FONTI_SUCCESSIONE: readonly Fonte[] = [
  { kind: "DATO", ref: "/v1/succession-pools", label: "Tavole di successione" },
  { kind: "DATO", ref: "/v1/successor-candidates", label: "Candidati alla successione e prontezza" },
];
const FONTE_USCITE: Fonte = { kind: "STORIA", ref: "/insights", label: "Storia delle uscite del tenant" };
const FONTE_SELEZIONI: Fonte = { kind: "STORIA", ref: "/recruiting", label: "Selezioni concluse del tenant" };
const FONTE_REGOLE: Fonte = { kind: "DOCUMENTO", ref: "doc:apps/api/src/modules/scenari/calcolatori/nel-tempo.ts", label: "Regole del calcolatore nel tempo" };

interface Metrica {
  code: string;
  label: (mesi: number) => string;
  unit: string;
  valore: (o: MisureOrizzonte) => Distribuzione;
  fonti: readonly Fonte[];
  /** per quali coperture ha senso */
  per: readonly Copertura[];
}

const TUTTE: readonly Copertura[] = ["NESSUNA", "INTERNA", "INTERNA_ED_ESTERNA"];
const METRICHE: readonly Metrica[] = [
  { code: "uscite", label: (m) => `Persone uscite entro ${m} mesi`, unit: "persone", valore: (o) => o.uscite, fonti: [FONTE_USCITE, ...FONTI_STRUTTURA], per: TUTTE },
  { code: "posizioni_scoperte", label: (m) => `Posizioni scoperte a ${m} mesi`, unit: "posizioni", valore: (o) => o.posizioniScoperte, fonti: [...FONTI_STRUTTURA, ...FONTI_SUCCESSIONE, FONTE_USCITE], per: TUTTE },
  { code: "posizioni_critiche_scoperte", label: (m) => `Posizioni critiche o ad alta criticità scoperte a ${m} mesi`, unit: "posizioni", valore: (o) => o.posizioniCriticheScoperte, fonti: [...FONTI_STRUTTURA, FONTE_USCITE], per: TUTTE },
  { code: "mesi_di_scopertura", label: (m) => `Mesi di posizione scoperta accumulati in ${m} mesi (costo del vuoto)`, unit: "mesi", valore: (o) => o.mesiDiScopertura, fonti: [...FONTI_STRUTTURA, FONTE_USCITE], per: TUTTE },
  { code: "persone_spostate", label: (m) => `Persone che si spostano per coprire entro ${m} mesi`, unit: "persone", valore: (o) => o.personeSpostate, fonti: FONTI_SUCCESSIONE, per: ["INTERNA", "INTERNA_ED_ESTERNA"] },
  { code: "assunzioni_esterne", label: (m) => `Persone assunte da fuori entro ${m} mesi`, unit: "persone", valore: (o) => o.assunzioniEsterne, fonti: [FONTE_SELEZIONI], per: ["INTERNA_ED_ESTERNA"] },
];

const arrotonda = (x: number, cifre = 1): number => Math.round(x * 10 ** cifre) / 10 ** cifre;

function domanda(tassoAnnuoImposto: number | undefined, orizzonti: readonly number[]): string {
  const quando = orizzonti.join(", ");
  return tassoAnnuoImposto === undefined
    ? `Se le persone escono con il tasso che la storia del tenant mostra, che cosa resta scoperto a ${quando} mesi e quali unità cedono per prime?`
    : `Se nei prossimi dodici mesi esce il ${arrotonda(tassoAnnuoImposto * 100, 1).toLocaleString("it-IT")}% delle persone, che cosa resta scoperto a ${quando} mesi e quali unità cedono per prime?`;
}

export async function calcolaScenarioNelTempo(r: RichiestaNelTempo): Promise<ScenarioNelTempoCalcolato> {
  return withTransaction((c) => calcolaDentro(c, r));
}

async function calcolaDentro(c: PoolClient, r: RichiestaNelTempo): Promise<ScenarioNelTempoCalcolato> {
  const orizzonti = [...new Set(r.orizzontiMesi ?? ORIZZONTI_PREDEFINITI)].sort((a, b) => a - b);
  const estrazioni = r.estrazioni ?? ESTRAZIONI_PREDEFINITE;
  const stress = r.tassoAnnuoImposto;

  const scenarioId = await repo.inserisciScenario(c, {
    tenantId: r.tenantId,
    title: stress === undefined ? "Resistenza nel tempo: uscite dalla storia" : `Resistenza nel tempo: esce il ${arrotonda(stress * 100).toLocaleString("it-IT")}% in un anno`,
    question: domanda(stress, orizzonti),
    family: "NEL_TEMPO",
    domain: "TALENTI",
    catalogCode: "S-T3",
    ownerUserId: r.actorUserId,
    actorUserId: r.actorUserId,
  });
  const versionId = await repo.inserisciVersione(c, scenarioId, r.tenantId, `Calcolata da ${CALCOLATORE_NEL_TEMPO}, ${estrazioni} estrazioni`, r.actorUserId);
  const fotografia = await repo.fotografa(c, versionId);
  const ombra = await repo.leggiOmbra(c, versionId);
  const unita = await repo.leggiUnitaOmbra(c, versionId);
  const successori = await repo.leggiSuccessori(c, r.tenantId);

  // ── la storia (F3c): tasso di uscita e durate delle selezioni ───────────────────────────
  const dal = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 36, 1)).toISOString().slice(0, 10);
  const generata = await storia.storiaGenerata(c, r.tenantId);
  const trimestri = (await storia.leggiTrimestriUscite(c, r.tenantId, dal)).filter((t) => t.esposti > 0);
  const k = trimestri.reduce((s, t) => s + t.uscite, 0);
  const n = trimestri.reduce((s, t) => s + t.esposti, 0);
  const giorniSelezione = (await storia.leggiDurateSelezione(c, r.tenantId)).map((s) => s.giorni);

  let ordinale = 1;
  const ipotesi = (a: Omit<Parameters<typeof repo.inserisciIpotesi>[1], "versionId" | "tenantId" | "ordinal">) =>
    repo.inserisciIpotesi(c, { versionId, tenantId: r.tenantId, ordinal: ordinale++, ...a });

  let tasso: TassoUscita;
  if (stress === undefined) {
    tasso = { tipo: "STIMA", a: k + 0.5, b: n - k + 0.5 };
    const s = comeIpotesi(suPiuPeriodi(frequenzaJeffreys(k, n), 4), {
      storiaGenerata: generata,
      statement: `Probabilità che una persona lasci l'organizzazione entro dodici mesi, da ${k} uscite su ${n} persone-trimestre dal ${trimestri[0]?.inizio ?? dal}; a ogni estrazione il tasso si estrae di nuovo dalla sua distribuzione.${k === 0 ? " Nella storia non c'è nessuna uscita: la banda è un limite superiore, non un tasso osservato." : ""}`,
      unit: "%", scala: 100, cifre: 2,
      metodo: "Beta di Jeffreys sul tasso trimestrale, 1-(1-q)^4",
      fonte: { ref: FONTE_USCITE.ref, label: FONTE_USCITE.label },
    });
    await ipotesi({ kind: "STIMA", statement: s.statement, value: s.value, unit: s.unit, low: s.low, high: s.high, fonti: s.sources });
  } else {
    tasso = { tipo: "IMPOSTO", trimestrale: trimestraleDaAnnuo(stress) };
    await ipotesi({
      kind: "VINCOLO",
      statement: `Prova di resistenza: tasso di uscita imposto al ${arrotonda(stress * 100, 2).toLocaleString("it-IT")}% in dodici mesi (${arrotonda(tasso.trimestrale * 100, 3).toLocaleString("it-IT")}% a trimestre), uguale per tutte le persone; la storia del tenant mostra ${k} uscite su ${n} persone-trimestre.`,
      value: arrotonda(stress * 100, 2), unit: "%",
      fonti: [FONTE_USCITE],
    });
  }
  const durata = durataBootstrap(giorniSelezione, 0.5);
  const conEsterna = durata !== null;
  if (durata) {
    const s = comeIpotesi(durata, {
      storiaGenerata: generata,
      statement: `Una selezione esterna dura quanto una di quelle concluse nella storia, estratta a caso fra ${durata.casi}; la mediana è indicata qui.`,
      unit: "giorni", cifre: 0,
      metodo: "quantile empirico, banda bootstrap con seme fisso",
      fonte: { ref: FONTE_SELEZIONI.ref, label: FONTE_SELEZIONI.label },
    });
    await ipotesi({ kind: "STIMA", statement: s.statement, value: s.value, unit: s.unit, low: s.low, high: s.high, fonti: s.sources });
  }
  await ipotesi({ kind: "DATO", statement: "Successori e prontezza letti dalle tavole di successione attive del tenant al momento del calcolo; candidati ritirati e non pronti esclusi.", fonti: FONTI_SUCCESSIONE });
  await ipotesi({
    kind: "POLITICA",
    statement: `Il tempo va a trimestri e le uscite cadono a metà trimestre; il successore copre quando è pronto (subito, a 6, 12 o 24 mesi) e lascia la sua posizione in quel momento; ${estrazioni} estrazioni con seme fisso, uguali per tutte le opzioni; i numeri sono la mediana e la banda dal 5° al 95° percentile. Un'unità cede quando ha scoperto almeno un quarto delle sue posizioni (si guardano le unità con almeno ${POSIZIONI_MINIME_UNITA} posizioni).`,
    fonti: [FONTE_REGOLE],
  });

  const piani: Array<{ code: string; label: string; description: string; copertura: Copertura }> = [
    { code: "A", label: "Nessuna copertura", description: "Le posizioni che si liberano restano scoperte fino all'orizzonte.", copertura: "NESSUNA" },
    { code: "B", label: "Copertura interna", description: "I successori coprono a cascata le posizioni liberate quando sono pronti; ciò che non ha successore resta scoperto.", copertura: "INTERNA" },
  ];
  if (conEsterna) {
    piani.push({ code: "C", label: "Interna, poi da fuori", description: "Come la copertura interna, e ciò che resta scoperto si copre con una selezione esterna della durata osservata nella storia.", copertura: "INTERNA_ED_ESTERNA" });
  }

  const ingresso = {
    posizioni: ombra.posizioni, titolari: ombra.titolari, successori, tasso,
    giorniSelezione, orizzontiMesi: orizzonti, estrazioni, seme: SEME_NEL_TEMPO,
  };
  const opzioni: ScenarioNelTempoCalcolato["opzioni"] = [];
  for (const [i, p] of piani.entries()) {
    const esito = calcolaNelTempo(ingresso, p.copertura);
    const toccaPersone = p.copertura !== "NESSUNA";
    const optionId = await repo.inserisciOpzione(c, {
      versionId, tenantId: r.tenantId, code: p.code, label: p.label, description: p.description,
      isBaseline: p.copertura === "NESSUNA", touchesPeople: toccaPersone, ordinal: i + 1,
    });
    let leva = 1;
    await repo.inserisciLeva(c, {
      optionId, tenantId: r.tenantId, kind: "TASSO_DI_USCITA", targetType: "TENANT", targetId: null, ordinal: leva++,
      parameters: tasso.tipo === "STIMA" ? { tipo: "STIMA", uscite: k, personeTrimestre: n } : { tipo: "IMPOSTO", annuo: stress, trimestrale: tasso.trimestrale },
    });
    if (p.copertura !== "NESSUNA") {
      await repo.inserisciLeva(c, { optionId, tenantId: r.tenantId, kind: "COPERTURA_INTERNA", targetType: "TENANT", targetId: null, parameters: { cascata: true }, ordinal: leva++ });
    }
    if (p.copertura === "INTERNA_ED_ESTERNA") {
      await repo.inserisciLeva(c, { optionId, tenantId: r.tenantId, kind: "COPERTURA_ESTERNA", targetType: "TENANT", targetId: null, parameters: { selezioniOsservate: giorniSelezione.length }, ordinal: leva++ });
    }
    for (const o of esito.orizzonti) {
      for (const m of METRICHE) {
        if (!m.per.includes(p.copertura)) continue;
        const d = m.valore(o);
        await repo.inserisciRisultato(c, {
          versionId, optionId, tenantId: r.tenantId, metricCode: m.code, metricLabel: m.label(o.mesi),
          value: arrotonda(d.mediana), low: arrotonda(d.low), high: arrotonda(d.high), unit: m.unit,
          draws: estrazioni, horizonMonths: o.mesi, computedBy: CALCOLATORE_NEL_TEMPO, fonti: m.fonti,
        });
      }
      await repo.inserisciRisultato(c, {
        versionId, optionId, tenantId: r.tenantId, metricCode: "probabilita_critica_scoperta",
        metricLabel: `Probabilità che almeno una posizione critica o ad alta criticità sia scoperta a ${o.mesi} mesi`,
        value: arrotonda(o.probabilitaCriticaScoperta * 100), unit: "%", draws: estrazioni, horizonMonths: o.mesi,
        computedBy: CALCOLATORE_NEL_TEMPO, fonti: [...FONTI_STRUTTURA, FONTE_USCITE],
      });
      for (const [j, u] of (esito.unitaCheCedono[o.mesi] ?? []).slice(0, UNITA_MOSTRATE).entries()) {
        await repo.inserisciRisultato(c, {
          versionId, optionId, tenantId: r.tenantId, metricCode: `unita_cede_${j + 1}`,
          metricLabel: `${unita.get(u.unitaId) ?? "Unità"}: probabilità di avere scoperto almeno il ${SOGLIA_CEDIMENTO * 100}% delle sue ${u.posizioni} posizioni a ${o.mesi} mesi`.slice(0, 255),
          value: arrotonda(u.probabilita * 100), unit: "%", draws: estrazioni, horizonMonths: o.mesi,
          computedBy: CALCOLATORE_NEL_TEMPO, fonti: [{ kind: "DATO", ref: "/v1/organization-units", label: "Unità del tenant" }, FONTE_USCITE],
        });
      }
    }
    if (toccaPersone) {
      await repo.inserisciEquita(c, {
        optionId, tenantId: r.tenantId, trait: "GENERE",
        groups: "non confrontati: il calcolo dell'equità sulle opzioni degli scenari non è ancora in servizio (voce F6b del piano)",
        ratio: null, threshold: SOGLIA_EQUITA, outcome: "DATI_INSUFFICIENTI", method: METODO_EQUITA_PROVVISORIO,
      });
    }
    opzioni.push({ code: p.code, optionId, esito });
  }

  await repo.segnaCalcolata(c, versionId);
  return { scenarioId, versionId, fotografia, opzioni };
}
