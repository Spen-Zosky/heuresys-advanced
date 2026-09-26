/**
 * Append-only audit sink for the Agent SDK write-gate (#9 WI-B, M-4).
 *
 * Records EVERY tool decision (allow read, allow write, deny) with the redacted
 * args-hash so there is a tamper-evident, replayable trail of what the agent did
 * and who authorised it (GDPR Art. 22 human-oversight evidence; EU AI Act log).
 *
 * SEAM: `AuditSink` is the only contract callers depend on. Today the concrete
 * impl is a JSONL file appender (no DB migration — the DB-table audit shape is a
 * separate Enzo decision, class D-22). A `DbAuditSink implements AuditSink` can
 * drop in later (write a row to `sys.sys_*` + registry) with zero call-site change.
 *
 * RETENTION DOCTRINE: records must be retained >= 6 months (plan M-4). File
 * ROTATION / archival is intentionally OUT OF SCOPE here — operate the JSONL file
 * under an external logrotate/retention policy; this module only appends.
 *
 * The args are NEVER stored raw — only a sha256 of the REDACTED args (redact.ts),
 * so no PII/secret lands in the audit file (compliance-guard: no raw PII).
 */
import { createHash } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { redact } from "./redact.js";
import type { LivelloPersone } from "./soglie-persone.js";

export type AuditDecision = "allow" | "deny";

/** Principal that drove the tool call (hybrid auth: forwarded user vs service user). */
export type AuditPrincipal = "user" | "service" | "unknown";

export interface AuditEntry {
  /** ISO-8601 UTC timestamp. */
  ts: string;
  /** Who: the principal kind + an opaque subject id (never PII — a user/session id). */
  who: { principal: AuditPrincipal; subject?: string };
  /** Tenant the call ran against (implicit from JWT upstream; "unknown" if unbound). */
  tenant: string;
  /** MCP tool name (e.g. hrx_org_units_upsert). */
  tool: string;
  /** sha256 hex of the REDACTED args (no raw PII/secret ever persisted). */
  argsHash: string;
  /**
   * SU COSA è stata presa la decisione, per gli strumenti parametrici (#214, S1078).
   *
   * PERCHÉ ESISTE. Fino a oggi il diario diceva CHI, QUANDO, con QUALE STRUMENTO e con
   * quale ESITO — ma non su quale risorsa: gli strumenti generici si chiamano tutti
   * `hrx_entity_query`, e il concetto interrogato finiva dentro `argsHash`, cioè in
   * un'impronta illeggibile. Un registro di decisioni che non sa dire su COSA ha deciso
   * non è verificabile: non si può rispondere a «l'agente ha davvero letto i contenuti?»
   * né, che è peggio, a «ha letto qualcosa che non doveva?».
   *
   * Si è visto misurando: la prova live del perimetro `content` risultava rossa sul
   * criterio «almeno una lettura consentita su `content`», e la causa non era l'apertura
   * — era che quel criterio è soddisfacibile SOLO dai perimetri che hanno strumenti di
   * dominio omonimi (`hrx_positions_list` porta «positions» nel nome). Per tutti gli
   * altri era impossibile da soddisfare, e nessuno poteva accorgersene.
   *
   * NON È UNA DEROGA AL «MAI PII»: sono identificatori di RISORSA e di OPERAZIONE
   * (`content`, `get_search`) — la stessa classe di informazione del nome dello
   * strumento, che è sempre stato registrato in chiaro. Gli argomenti restano hashati.
   */
  concept?: string;
  operation?: string;
  /**
   * QUANTE PERSONE DISTINTE la conversazione aveva toccato al momento di questa decisione,
   * e in quale livello cadeva (#251, ADR-0040 R2).
   *
   * PERCHÉ NEL DIARIO E NON SOLO IN MEMORIA. Il freno dell'agente si misura in persone
   * distinte per conversazione, non in righe: una soglia sulle righe non discrimina fra «il
   * reparto più grande» e «tutta l'azienda» (misurato il 2026-09-08, ~4×), il numero di
   * persone sì (1 · 7 · 38 · 160 nelle quattro domande tipo). Ma una soglia che non lascia
   * traccia non è verificabile a posteriori: senza questi due campi non si può rispondere a
   * «chi ha letto quanto», che è la domanda del diritto (profilazione di massa) e la ragione
   * per cui il ponte di approvazione di `#252` può appoggiarsi a un numero invece che a un
   * ruolo. `#253` ne farà una colonna e una vista interrogabile.
   *
   * `livelloPersone: "non-misurato"` NON è un verde: vuol dire che le soglie non si sono
   * potute leggere, o che la raccolta si è guastata. `#252` lo tratta come «oltre la soglia».
   *
   * Assenti se il chiamante non collega un contatore (i test del gate che non lo iniettano):
   * il diario dice ciò che gli è stato dato, non inventa uno zero — uno zero significherebbe
   * «nessuna persona letta», che è un'affermazione diversa da «non l'ho misurato».
   */
  personeDistinte?: number;
  livelloPersone?: LivelloPersone;
  /** Gate decision + a human-readable reason. */
  decision: AuditDecision;
  reason: string;
}

/** Fields the caller supplies; ts + argsHash are derived by the sink. */
export interface AuditInput {
  who: { principal: AuditPrincipal; subject?: string };
  tenant: string;
  tool: string;
  /** Raw tool args — redacted + hashed inside the sink, never stored raw. */
  args: unknown;
  /** #251 — persone distinte e livello al momento della decisione. Assenti = non misurati. */
  personeDistinte?: number;
  livelloPersone?: LivelloPersone;
  decision: AuditDecision;
  reason: string;
}

/** The stable seam. A DB-backed impl can replace the file impl transparently. */
export interface AuditSink {
  record(input: AuditInput): Promise<void>;
}

/** sha256 hex of the redacted args (stable, JSON-canonical-ish key order via clone). */
export function hashArgs(args: unknown): string {
  const safe = redact(args);
  return createHash("sha256").update(JSON.stringify(safe)).digest("hex");
}

/**
 * Il concetto e l'operazione, letti dagli argomenti degli strumenti parametrici.
 * Solo stringhe, e solo questi due campi: tutto il resto degli argomenti resta hashato.
 */
export function targetOf(args: unknown): { concept?: string; operation?: string } {
  const a = (args ?? {}) as { conceptId?: unknown; operationId?: unknown };
  return {
    ...(typeof a.conceptId === "string" && a.conceptId ? { concept: a.conceptId } : {}),
    ...(typeof a.operationId === "string" && a.operationId ? { operation: a.operationId } : {}),
  };
}

export function toEntry(input: AuditInput): AuditEntry {
  return {
    ts: new Date().toISOString(),
    who: input.who,
    tenant: input.tenant,
    tool: input.tool,
    argsHash: hashArgs(input.args),
    ...targetOf(input.args),
    // Si copiano solo se il chiamante li ha dati: `exactOptionalPropertyTypes` è off in questo
    // repo, quindi un `undefined` esplicito finirebbe nel JSON come chiave presente e vuota —
    // che in un diario si legge come «misurato e nullo», non come «non misurato».
    ...(input.personeDistinte !== undefined ? { personeDistinte: input.personeDistinte } : {}),
    ...(input.livelloPersone !== undefined ? { livelloPersone: input.livelloPersone } : {}),
    decision: input.decision,
    reason: input.reason,
  };
}

/**
 * JSONL file sink — one JSON object per line, append-only. The default path is
 * `<repoRoot>/.data/agent-audit.jsonl` (gitignored data dir); override via the
 * AGENT_GATEWAY_AUDIT_PATH env key.
 */
export class FileAuditSink implements AuditSink {
  private readonly path: string;
  private ensured = false;

  constructor(path?: string) {
    this.path = path ?? process.env.AGENT_GATEWAY_AUDIT_PATH ?? join(process.cwd(), ".data", "agent-audit.jsonl");
  }

  private async ensureDir(): Promise<void> {
    if (this.ensured) return;
    await mkdir(dirname(this.path), { recursive: true });
    this.ensured = true;
  }

  async record(input: AuditInput): Promise<void> {
    await this.ensureDir();
    await appendFile(this.path, JSON.stringify(toEntry(input)) + "\n", "utf8");
  }
}

/**
 * In-memory sink for tests (and a no-IO default). Keeps the entries array so a test
 * can assert the redacted args-hash + decision without touching the filesystem.
 */
export class MemoryAuditSink implements AuditSink {
  readonly entries: AuditEntry[] = [];
  async record(input: AuditInput): Promise<void> {
    this.entries.push(toEntry(input));
  }
}

/** Il nome che il diario usa al posto di uno strumento, per la voce di chiusura (#251). */
export const VOCE_CONVERSAZIONE = "(conversazione)";
/** La ragione della voce di chiusura: non è una decisione, è la misura finale. */
export const RAGIONE_CHIUSURA = "CONVERSAZIONE_CHIUSA";

/**
 * La voce di CHIUSURA di una conversazione: quante persone distinte in tutto, e a che livello
 * (#251, ADR-0040 §4b — «un contatore in chiusura basta»).
 *
 * ⭐ PERCHÉ SERVE, e non è una duplicazione. Il gate audita **prima** di eseguire la chiamata
 * (`canUseTool` decide, poi lo strumento parte): il numero che finisce in quella voce è quante
 * persone la conversazione aveva già toccato, quindi il totale dell'**ultima** lettura non
 * comparirebbe da nessuna parte. Su quattro letture annidate — una persona, la sua squadra, la
 * sua catena, il tenant — le voci di decisione scrivono 0 · 1 · 7 · 38 e la chiusura scrive
 * 160: senza di lei il numero più grande, cioè il solo che conta per il freno, sarebbe invisibile.
 *
 * ⚠ FORMA DELLA VOCE, dichiarata perché non somigli a una decisione che non è: `tool` è
 * `(conversazione)` — fra parentesi, così non può collidere con un nome `hrx_*` — e `decision`
 * è `allow` perché il tipo lo esige e nulla è stato negato; il fatto sta in `reason`
 * (`CONVERSAZIONE_CHIUSA`) e nei due campi del contatore. Chi interrogherà il diario (`#253`)
 * filtra su `reason`, non su `tool`.
 */
export async function registraChiusuraConversazione(
  sink: AuditSink,
  who: { principal: AuditPrincipal; subject?: string; tenant?: string },
  persone: { conta(): number; livello(): LivelloPersone },
): Promise<void> {
  try {
    await sink.record({
      who: { principal: who.principal, ...(who.subject !== undefined ? { subject: who.subject } : {}) },
      tenant: who.tenant ?? "unknown",
      tool: VOCE_CONVERSAZIONE,
      args: {},
      personeDistinte: persone.conta(),
      livelloPersone: persone.livello(),
      decision: "allow",
      reason: RAGIONE_CHIUSURA,
    });
  } catch {
    /* il diario è best-effort come nel gate: non deve poter far fallire una conversazione */
  }
}

/** A sink that swallows everything (used when audit is not wired — never silently in prod). */
export const NULL_AUDIT_SINK: AuditSink = { record: async () => {} };
