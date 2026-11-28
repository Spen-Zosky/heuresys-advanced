/**
 * apps/api/src/modules/scenari/service.ts — il motore degli scenari, voce F3b-1 del piano
 * docs/piani/PIANO_heuresys-ai-driven_20261126.md (ADR-0063 D5, D6).
 *
 * `calcolaScenarioUscite` apre uno scenario di uscita (S-T1 effetto diretto, S-T2 cascata), fa la
 * fotografia del tenant, calcola le opzioni con il calcolatore puro della successione e salva tutto
 * nelle tabelle degli scenari e della struttura ombra, in una sola transazione. Non scrive nessuna
 * tabella di business: le guardie della 000515 e la prova di integrazione lo verificano.
 *
 * Le opzioni:
 *   A «nessuna copertura»           (isBaseline): le posizioni liberate restano scoperte;
 *   B «solo il primo rimpiazzo»     (effetto diretto): i successori coprono, le loro posizioni no;
 *   C «copertura a cascata»         (solo per CASCATA): ogni posizione liberata si copre, fin dove si può.
 *
 * Equità (E12): B e C spostano persone, quindi portano un controllo di equità. Il calcolo vero è la
 * voce F6b: finché non c'è, il controllo si dichiara DATI_INSUFFICIENTI con il metodo
 * `equita-non-calcolata@0.1.0`, e per la guardia G3 l'opzione non può essere raccomandata. Nessuna
 * opzione viene raccomandata da questo calcolatore: raccomandare è una scelta che si fa dopo
 * l'equità, non un numero.
 *
 * Il perimetro della persona (I16-I22) si applica alle rotte che chiamano questo servizio (F3b-2):
 * qui il servizio pretende solo che le persone siano del tenant (I5).
 */
import type { PoolClient } from "pg";
import { withTransaction } from "../../db/client.js";
import { ForbiddenError, NotFoundError, UnprocessableEntityError } from "../../errors/index.js";
import type { ActorContext } from "../../lib/actor.js";
import type { ScenarioDetail, ScenarioExitsCreate, ScenarioList, ScenarioOverTimeCreate } from "@heuresys/shared";
import { dettaglioScenario, elencoScenari } from "./lettura.js";
import {
  CALCOLATORE_SUCCESSIONE,
  calcolaSuccessione,
  PROFONDITA_CASCATA,
  type EsitoSuccessione,
} from "./calcolatori/successione.js";
import { calcolaScenarioNelTempo } from "./nel-tempo.js";
import * as repo from "./repository.js";
import type { Fonte, TitolareOmbraCompleto } from "./repository.js";

export const METODO_EQUITA_PROVVISORIO = "equita-non-calcolata@0.1.0" as const;
export const SOGLIA_EQUITA = 0.8;

export interface RichiestaUscite {
  tenantId: string;
  /** chi lancia il calcolo (persona collegata) */
  actorUserId: string | null;
  /** le persone che escono: le leve PERSONA_ESCE */
  userIds: readonly string[];
  family: "EFFETTO_DIRETTO" | "CASCATA";
}

export interface EsitoOpzione {
  code: string;
  optionId: string;
  profondita: number;
  esito: EsitoSuccessione;
}

export interface ScenarioUsciteCalcolato {
  scenarioId: string;
  versionId: string;
  fotografia: repo.Fotografia;
  opzioni: EsitoOpzione[];
}

const FONTI_STRUTTURA: readonly Fonte[] = [
  { kind: "DATO", ref: "/v1/positions", label: "Posizioni del tenant" },
  { kind: "DATO", ref: "/v1/user-position-assignments", label: "Titolari delle posizioni" },
];
const FONTI_SUCCESSIONE: readonly Fonte[] = [
  { kind: "DATO", ref: "/v1/succession-pools", label: "Tavole di successione" },
  { kind: "DATO", ref: "/v1/successor-candidates", label: "Candidati alla successione e prontezza" },
];

interface Metrica {
  code: string;
  label: string;
  unit: string;
  valore: (e: EsitoSuccessione) => number | null;
  fonti: readonly Fonte[];
}

const METRICHE: readonly Metrica[] = [
  { code: "posizioni_liberate", label: "Posizioni liberate dalle uscite", unit: "posizioni", valore: (e) => e.vacantiIniziali, fonti: FONTI_STRUTTURA },
  { code: "posizioni_coperte", label: "Posizioni coperte da un successore", unit: "posizioni", valore: (e) => e.coperte, fonti: FONTI_SUCCESSIONE },
  { code: "posizioni_scoperte", label: "Posizioni scoperte alla fine", unit: "posizioni", valore: (e) => e.scoperte.length, fonti: [...FONTI_STRUTTURA, ...FONTI_SUCCESSIONE] },
  { code: "posizioni_critiche_scoperte", label: "Posizioni critiche o ad alta criticità scoperte", unit: "posizioni", valore: (e) => e.scoperteCritiche, fonti: FONTI_STRUTTURA },
  { code: "persone_spostate", label: "Persone che si spostano per coprire", unit: "persone", valore: (e) => e.spostati.length, fonti: FONTI_SUCCESSIONE },
  { code: "lunghezza_catena", label: "Lunghezza della catena di rimpiazzo", unit: "passi", valore: (e) => e.lunghezzaCatena, fonti: FONTI_SUCCESSIONE },
  { code: "mesi_alla_copertura", label: "Mesi alla prontezza del successore meno pronto", unit: "mesi", valore: (e) => e.mesiAllaCopertura, fonti: FONTI_SUCCESSIONE },
];

function domanda(nomi: readonly string[], family: RichiestaUscite["family"]): string {
  const chi = nomi.join("; ");
  return family === "CASCATA"
    ? `Se esce ${chi}, chi copre le posizioni liberate e quali posizioni restano scoperte alla fine della catena di rimpiazzo?`
    : `Se esce ${chi}, chi copre subito le sue posizioni fra i successori pronti e che cosa resta scoperto?`;
}

export async function calcolaScenarioUscite(r: RichiestaUscite): Promise<ScenarioUsciteCalcolato> {
  const uscite = [...new Set(r.userIds)];
  if (uscite.length === 0) throw new UnprocessableEntityError({ userIds: [] }, "Serve almeno una persona che esce", "SCENARIO_NO_EXITS");
  return withTransaction((c) => calcolaDentro(c, r, uscite));
}

async function calcolaDentro(c: PoolClient, r: RichiestaUscite, uscite: string[]): Promise<ScenarioUsciteCalcolato> {
  const nomi = await repo.personeDelTenant(c, r.tenantId, uscite);
  const fuori = uscite.filter((u) => !nomi.has(u));
  if (fuori.length > 0) throw new UnprocessableEntityError({ userIds: fuori }, "Persone che non appartengono al tenant", "SCENARIO_PEOPLE_NOT_IN_TENANT");

  const catalogo = r.family === "CASCATA" ? "S-T2" : "S-T1";
  const elencoNomi = uscite.map((u) => nomi.get(u) || u);
  const scenarioId = await repo.inserisciScenario(c, {
    tenantId: r.tenantId,
    title: `${r.family === "CASCATA" ? "Catena di rimpiazzo" : "Uscita"}: ${elencoNomi.join("; ")}`.slice(0, 255),
    question: domanda(elencoNomi, r.family),
    family: r.family,
    domain: "TALENTI",
    catalogCode: catalogo,
    ownerUserId: r.actorUserId,
    actorUserId: r.actorUserId,
  });
  const versionId = await repo.inserisciVersione(c, scenarioId, r.tenantId, `Calcolata da ${CALCOLATORE_SUCCESSIONE}`, r.actorUserId);
  const fotografia = await repo.fotografa(c, versionId);
  const ombra = await repo.leggiOmbra(c, versionId);
  const successori = await repo.leggiSuccessori(c, r.tenantId);

  await repo.inserisciIpotesi(c, {
    versionId, tenantId: r.tenantId, kind: "DATO", ordinal: 1,
    statement: "Successori e prontezza letti dalle tavole di successione attive del tenant al momento del calcolo; candidati ritirati e non pronti esclusi.",
    fonti: FONTI_SUCCESSIONE,
  });
  await repo.inserisciIpotesi(c, {
    versionId, tenantId: r.tenantId, kind: "POLITICA", ordinal: 2,
    statement: "Si sceglie il successore con la prontezza più vicina; a parità il candidato confermato; a parità ancora l'ordine dell'identificativo, solo perché l'esito sia riproducibile.",
    fonti: [{ kind: "DOCUMENTO", ref: "doc:apps/api/src/modules/scenari/calcolatori/successione.ts", label: "Regole del calcolatore della successione" }],
  });

  const piani: Array<{ code: string; label: string; description: string; profondita: number; baseline: boolean }> = [
    { code: "A", label: "Nessuna copertura", description: "Le posizioni liberate dalle uscite restano scoperte.", profondita: 0, baseline: true },
    { code: "B", label: "Solo il primo rimpiazzo", description: "I successori pronti coprono le posizioni liberate; le loro posizioni restano scoperte.", profondita: 1, baseline: false },
  ];
  if (r.family === "CASCATA") {
    piani.push({ code: "C", label: "Copertura a cascata", description: `Ogni posizione liberata si copre con i suoi successori, fino a ${PROFONDITA_CASCATA} passi.`, profondita: PROFONDITA_CASCATA, baseline: false });
  }

  const opzioni: EsitoOpzione[] = [];
  for (const [i, p] of piani.entries()) {
    const esito = calcolaSuccessione({ posizioni: ombra.posizioni, titolari: ombra.titolari, successori, uscite }, p.profondita);
    const toccaPersone = esito.spostati.length > 0;
    const optionId = await repo.inserisciOpzione(c, {
      versionId, tenantId: r.tenantId, code: p.code, label: p.label,
      description: esito.troncata ? `${p.description} La catena è stata troncata al limite: continua oltre.` : p.description,
      isBaseline: p.baseline, touchesPeople: toccaPersone, ordinal: i + 1,
    });
    let ordinale = 1;
    for (const u of uscite) {
      await repo.inserisciLeva(c, { optionId, tenantId: r.tenantId, kind: "PERSONA_ESCE", targetType: "PERSONA", targetId: u, parameters: {}, ordinal: ordinale++ });
    }
    if (p.profondita > 0) {
      await repo.inserisciLeva(c, { optionId, tenantId: r.tenantId, kind: "COPERTURA_INTERNA", targetType: "TENANT", targetId: null, parameters: { profonditaMassima: p.profondita }, ordinal: ordinale++ });
    }
    for (const m of METRICHE) {
      const v = m.valore(esito);
      if (v === null) continue;
      await repo.inserisciRisultato(c, {
        versionId, optionId, tenantId: r.tenantId, metricCode: m.code, metricLabel: m.label,
        value: v, unit: m.unit, computedBy: CALCOLATORE_SUCCESSIONE, fonti: m.fonti,
      });
    }
    if (toccaPersone) {
      await repo.inserisciEquita(c, {
        optionId, tenantId: r.tenantId, trait: "GENERE",
        groups: "non confrontati: il calcolo dell'equità è la voce F6b del piano, non ancora in servizio",
        ratio: null, threshold: SOGLIA_EQUITA, outcome: "DATI_INSUFFICIENTI", method: METODO_EQUITA_PROVVISORIO,
      });
    }
    await scriviOmbraOpzione(c, { versionId, tenantId: r.tenantId, optionId, uscite, esito, titolari: ombra.titolari });
    opzioni.push({ code: p.code, optionId, profondita: p.profondita, esito });
  }

  await repo.segnaCalcolata(c, versionId);
  return { scenarioId, versionId, fotografia, opzioni };
}

/** Lo stato dopo le leve: chiuse le assegnazioni PRIMARY di chi esce e di chi si sposta, nuove quelle di chi copre. */
async function scriviOmbraOpzione(
  c: PoolClient,
  x: { versionId: string; tenantId: string; optionId: string; uscite: readonly string[]; esito: EsitoSuccessione; titolari: readonly TitolareOmbraCompleto[] },
): Promise<void> {
  const lasciano = new Set([...x.uscite, ...x.esito.spostati]);
  for (const t of x.titolari) {
    if (t.tipo !== "PRIMARY" || t.userId === null || !lasciano.has(t.userId)) continue;
    await repo.inserisciAssegnazioneOmbra(c, {
      versionId: x.versionId, tenantId: x.tenantId, optionId: x.optionId, sourceId: null,
      positionId: t.posizioneId, userId: t.userId, kind: t.tipo, fte: t.fte, change: "CHIUSA",
    });
  }
  for (const p of x.esito.passi) {
    if (p.successoreUserId === null) continue;
    await repo.inserisciAssegnazioneOmbra(c, {
      versionId: x.versionId, tenantId: x.tenantId, optionId: x.optionId, sourceId: null,
      positionId: p.posizioneId, userId: p.successoreUserId, kind: "PRIMARY", fte: 1, change: "NUOVA",
    });
  }
}

// ── Le rotte (F3b-2) ───────────────────────────────────────────────────────────────────────

/**
 * Chi può: i permessi `scenario:read` e `scenario:create` li hanno i soli mandati HR del tenant
 * (migrazione 000524), che vedono tutto il tenant (I22): uno scenario di successione legge le
 * tavole di tutto il tenant, quindi un perimetro più stretto non basterebbe a tenerlo dentro.
 * Il servizio pretende un tenant: la piattaforma non calcola scenari per conto di un cliente.
 */
function tenantDi(a: ActorContext): string {
  if (!a.tenantId) throw new ForbiddenError("Uno scenario si calcola dentro un tenant", "SCENARIO_TENANT_REQUIRED");
  return a.tenantId;
}

export const scenariService = {
  async list(a: ActorContext): Promise<ScenarioList> {
    const items = await elencoScenari(tenantDi(a));
    return { items, total: items.length };
  },

  async get(a: ActorContext, scenarioId: string): Promise<ScenarioDetail> {
    const d = await dettaglioScenario(tenantDi(a), scenarioId);
    if (!d) throw new NotFoundError("Scenario", "SCENARIO_NOT_FOUND");
    return d;
  },

  async createExits(a: ActorContext, body: ScenarioExitsCreate): Promise<ScenarioDetail> {
    const tenantId = tenantDi(a);
    const s = await calcolaScenarioUscite({ tenantId, actorUserId: a.userId, userIds: body.userIds, family: body.family });
    const d = await dettaglioScenario(tenantId, s.scenarioId);
    return d!;
  },

  /** F3b-3: lo scenario nel tempo (S-T3), con la stima dalla storia o con un tasso imposto. */
  async createOverTime(a: ActorContext, body: ScenarioOverTimeCreate): Promise<ScenarioDetail> {
    const tenantId = tenantDi(a);
    const s = await calcolaScenarioNelTempo({
      tenantId,
      actorUserId: a.userId,
      ...(body.horizonsMonths ? { orizzontiMesi: body.horizonsMonths } : {}),
      ...(body.draws ? { estrazioni: body.draws } : {}),
      ...(body.annualExitRate !== undefined ? { tassoAnnuoImposto: body.annualExitRate } : {}),
    });
    const d = await dettaglioScenario(tenantId, s.scenarioId);
    return d!;
  },
};
