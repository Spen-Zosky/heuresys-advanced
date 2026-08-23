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

/** A sink that swallows everything (used when audit is not wired — never silently in prod). */
export const NULL_AUDIT_SINK: AuditSink = { record: async () => {} };
