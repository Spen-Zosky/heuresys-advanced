/**
 * apps/api/src/modules/agent-signals/service.ts — ADR-0063, voce F4a (decisione E6 di Enzo).
 *
 * @agente segnalatori (anagrafe: docs/architecture/agenti/ANAGRAFE_agenti.md)
 *
 * I segnalatori osservano il tenant e segnalano, senza cambiare nulla. Tre, uno per domanda:
 *   · POSIZIONE_CRITICA_SENZA_SUCCESSORE (talenti, D1): una posizione critica senza nessun
 *     successore pronto ora;
 *   · AMPIEZZA_DI_CONTROLLO (organizzazione, D5): un capo con più riporti diretti della soglia;
 *   · POSIZIONE_SCOPERTA (organizzazione, D5): una posizione attiva senza titolare da troppo tempo.
 * I numeri li calcola il codice (ADR-0063 D5, piano §6): qui non pensa nessun modello. Le soglie
 * sono dichiarate in SEGNALATORI e finiscono nell'evidenza di ogni segnalazione.
 *
 * A chi va (E6, «a ciascuno nel suo perimetro», I16-I22):
 *   · CATENA: chi dirige l'unità del soggetto, o la più vicina sopra; per la successione mai il
 *     titolare della posizione (la successione non si comunica a chi riguarda), quindi il suo capo;
 *   · MANDATO_HR: chi ha il mandato HR sul tenant (Direttore HR, amministratore, People manager),
 *     anche qui mai il titolare per la successione.
 * La guardia di 000522 ricontrolla nel database ogni destinatario e rifiuta chi è fuori.
 *
 * Il giro: ciò che è ancora vero si rivede (non si ripete); ciò che non è più vero si chiude
 * RISOLTA; ciò che resta vero ma non spetta più a quel destinatario si chiude RITIRATA; ciò che ha
 * superato la scadenza si chiude SCADUTA e, se è ancora vero, si riapre con un avviso nuovo (il
 * promemoria). Ogni segnalazione nuova mette un avviso nella casella della piattaforma della
 * persona (tipo SYSTEM, niente posta).
 */
import type { AgentSignalList, AgentSignalStatus, AgentSignalerCode } from "@heuresys/shared";
import { pool, withTransaction } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";
import { emitNotification } from "../../lib/notifications/emit.js";
import {
  testoSegnalazioneAmpiezza,
  testoSegnalazioneScoperta,
  testoSegnalazioneSuccessione,
} from "../../lib/notifications/messaggi.js";
import * as repo from "./repository.js";

/** Le soglie e la validità di ogni segnalatore. Cambiare qui, e la riga dell'anagrafe. */
export const SEGNALATORI = {
  POSIZIONE_CRITICA_SENZA_SUCCESSORE: { domain: "TALENTI", validDays: 30 },
  /** Oltre 10 riporti diretti: la misura di RTL del 26/11 ha mediana 2 e novantesimo percentile 7. */
  AMPIEZZA_DI_CONTROLLO: { domain: "ORGANIZZAZIONE", validDays: 30, threshold: 10 },
  /** Oltre 60 giorni senza titolare; oltre 180 la gravità sale. */
  POSIZIONE_SCOPERTA: { domain: "ORGANIZZAZIONE", validDays: 30, thresholdDays: 60, highDays: 180 },
} as const;

const CODICI = Object.keys(SEGNALATORI) as AgentSignalerCode[];

/** Una segnalazione rilevata, prima di sapere a chi va. */
export interface Rilevazione {
  tenantId: string;
  signalerCode: AgentSignalerCode;
  subjectType: "POSITION" | "ORGANIZATION_UNIT";
  subjectId: string;
  unitId: string | null;
  severity: "INFO" | "MEDIUM" | "HIGH" | "CRITICAL";
  evidence: Record<string, string | number | boolean | null>;
  sourceUrl: string;
  /** Persone che non devono riceverla (per la successione: i titolari). */
  esclusi: string[];
  testo: { subject: string; body: string };
}

export interface Destinazione {
  userId: string;
  basis: "CATENA" | "MANDATO_HR";
}

export async function rileva(db: repo.Db): Promise<Rilevazione[]> {
  const out: Rilevazione[] = [];
  for (const r of await repo.posizioniCriticheSenzaSuccessore(db)) {
    out.push({
      tenantId: r.tenant_id, signalerCode: "POSIZIONE_CRITICA_SENZA_SUCCESSORE",
      subjectType: "POSITION", subjectId: r.position_id, unitId: r.unit_id,
      severity: r.candidates === 0 ? "CRITICAL" : "HIGH",
      evidence: { candidates: r.candidates, readyNow: 0, ready6Months: r.ready_6_months, position: r.position_title, unit: r.unit_name },
      sourceUrl: `/positions/${r.position_id}`,
      esclusi: r.holder_ids,
      testo: testoSegnalazioneSuccessione(r.position_title, r.unit_name ?? "—", r.candidates, r.ready_6_months),
    });
  }
  const amp = SEGNALATORI.AMPIEZZA_DI_CONTROLLO;
  for (const r of await repo.ampiezzeDiControllo(db, amp.threshold)) {
    out.push({
      tenantId: r.tenant_id, signalerCode: "AMPIEZZA_DI_CONTROLLO",
      subjectType: "POSITION", subjectId: r.position_id, unitId: r.unit_id,
      severity: "MEDIUM",
      evidence: { directReports: r.direct_reports, threshold: amp.threshold, position: r.position_title, unit: r.unit_name },
      sourceUrl: `/positions/${r.position_id}`,
      esclusi: [],
      testo: testoSegnalazioneAmpiezza(r.position_title, r.unit_name ?? "—", r.direct_reports, amp.threshold),
    });
  }
  const sc = SEGNALATORI.POSIZIONE_SCOPERTA;
  for (const r of await repo.posizioniScoperte(db, sc.thresholdDays)) {
    out.push({
      tenantId: r.tenant_id, signalerCode: "POSIZIONE_SCOPERTA",
      subjectType: "POSITION", subjectId: r.position_id, unitId: r.unit_id,
      severity: r.days > sc.highDays ? "HIGH" : "MEDIUM",
      evidence: { days: r.days, vacantSince: r.vacant_since, everAssigned: r.ever_assigned, thresholdDays: sc.thresholdDays, position: r.position_title, unit: r.unit_name },
      sourceUrl: `/positions/${r.position_id}`,
      esclusi: [],
      testo: testoSegnalazioneScoperta(r.position_title, r.unit_name ?? "—", r.days),
    });
  }
  return out;
}

/** A chi va una rilevazione: il capo più vicino nella catena, più chi ha il mandato HR. Senza doppioni. */
export async function destinatari(db: repo.Db, r: Rilevazione, mandatoHr: string[]): Promise<Destinazione[]> {
  const out: Destinazione[] = [];
  if (r.unitId) {
    const capo = await repo.capoPiuVicino(db, r.unitId, r.esclusi);
    if (capo) out.push({ userId: capo, basis: "CATENA" });
  }
  for (const u of mandatoHr) {
    if (r.esclusi.includes(u) || out.some((d) => d.userId === u)) continue;
    out.push({ userId: u, basis: "MANDATO_HR" });
  }
  return out;
}

export const chiave = (r: Pick<Rilevazione, "signalerCode" | "subjectId">): string => `${r.signalerCode}:${r.subjectId}`;

export interface EsitoGiro {
  detected: number;
  opened: number;
  kept: number;
  resolved: number;
  withdrawn: number;
  expired: number;
  notified: number;
  outOfScope: number;
  bySignaler: Record<string, number>;
}

/** In modalità di prova il giro finisce con questo errore, che fa annullare la transazione. */
class GiroDiProva extends Error {
  constructor(readonly esito: EsitoGiro) { super("giro di prova: nessuna scrittura"); }
}

/** Un giro dei segnalatori su tutti i tenant, in una transazione. `prova` = nessuna scrittura (ROLLBACK). */
export async function giro(opts: { prova?: boolean } = {}): Promise<EsitoGiro> {
  try {
    return await withTransaction(async (client) => {
      const esito = await giroDentro(client);
      if (opts.prova) throw new GiroDiProva(esito);
      return esito;
    });
  } catch (err) {
    if (err instanceof GiroDiProva) return err.esito;
    throw err;
  }
}

export async function giroDentro(db: repo.Db): Promise<EsitoGiro> {
  const rilevate = await rileva(db);
  const mandati = new Map<string, string[]>();
  // ciò che deve essere aperto ora: chiave+destinatario → rilevazione e base
  const attese = new Map<string, { r: Rilevazione; d: Destinazione }>();
  for (const r of rilevate) {
    if (!mandati.has(r.tenantId)) mandati.set(r.tenantId, await repo.personeConMandatoHr(db, r.tenantId));
    for (const d of await destinatari(db, r, mandati.get(r.tenantId)!)) {
      attese.set(`${d.userId}|${chiave(r)}`, { r, d });
    }
  }
  const chiaviVere = new Set(rilevate.map(chiave));
  const oggi = new Date().toISOString().slice(0, 10);

  const esito: EsitoGiro = {
    detected: rilevate.length, opened: 0, kept: 0, resolved: 0, withdrawn: 0, expired: 0, notified: 0, outOfScope: 0,
    bySignaler: Object.fromEntries(CODICI.map((c) => [c, rilevate.filter((r) => r.signalerCode === c).length])),
  };

  const tenute = new Set<string>();
  for (const a of await repo.segnalazioniAperte(db, CODICI)) {
    const k = `${a.agent_signal_recipient_user_id}|${a.agent_signal_dedupe_key}`;
    const atteso = attese.get(k);
    if (a.agent_signal_expires_on < oggi) {
      await repo.chiudi(db, a.agent_signal_id, "SCADUTA");
      esito.expired += 1;
    } else if (atteso) {
      await repo.rivista(db, a.agent_signal_id, atteso.r.severity, atteso.r.evidence);
      tenute.add(k);
      esito.kept += 1;
    } else if (chiaviVere.has(a.agent_signal_dedupe_key)) {
      await repo.chiudi(db, a.agent_signal_id, "RITIRATA");
      esito.withdrawn += 1;
    } else {
      await repo.chiudi(db, a.agent_signal_id, "RISOLTA");
      esito.resolved += 1;
    }
  }

  for (const [k, { r, d }] of attese) {
    if (tenute.has(k)) continue;
    const cfg: { domain: string; validDays: number } = SEGNALATORI[r.signalerCode];
    const id = await repo.inserisci(db, {
      tenantId: r.tenantId, signalerCode: r.signalerCode, domain: cfg.domain, subjectType: r.subjectType,
      subjectId: r.subjectId, recipientUserId: d.userId, recipientBasis: d.basis, severity: r.severity,
      dedupeKey: chiave(r), evidence: r.evidence, sourceUrl: r.sourceUrl, validDays: cfg.validDays,
    });
    esito.opened += 1;
    const avviso = await emitNotification(db, {
      tenantId: r.tenantId, userId: d.userId, type: "SYSTEM",
      subject: r.testo.subject, body: r.testo.body,
      priority: r.severity, resourceType: r.subjectType === "POSITION" ? "POSITION" : null,
      resourceId: id, actionUrl: r.sourceUrl,
    });
    if (avviso) {
      await repo.collegaAvviso(db, id, avviso);
      esito.notified += 1;
    }
  }
  esito.outOfScope = await repo.fuoriPerimetro(db);
  return esito;
}

/** La casella delle segnalazioni di chi chiede: solo le sue, mai quelle di altri. */
export async function mie(actor: ActorContext, status: AgentSignalStatus | undefined): Promise<AgentSignalList> {
  const righe = await repo.diUnaPersona(pool, actor.userId, status ?? "APERTA");
  return {
    items: righe.map((r) => ({
      id: r.agent_signal_id,
      signalerCode: r.agent_signal_signaler_code as AgentSignalerCode,
      domain: r.agent_signal_domain,
      severity: r.agent_signal_severity as "INFO" | "MEDIUM" | "HIGH" | "CRITICAL",
      status: r.agent_signal_status as AgentSignalStatus,
      recipientBasis: r.agent_signal_recipient_basis as "CATENA" | "MANDATO_HR",
      subjectType: r.agent_signal_subject_type as "POSITION" | "ORGANIZATION_UNIT",
      subjectId: r.agent_signal_subject_id,
      positionTitle: r.position_title,
      unitName: r.unit_name,
      evidence: r.agent_signal_evidence,
      sourceUrl: r.agent_signal_source_url,
      firstSeenAt: r.first_seen_at,
      lastSeenAt: r.last_seen_at,
      expiresOn: r.expires_on,
      closedAt: r.closed_at,
    })),
  };
}

export const agentSignalsService = { giro, mie };
