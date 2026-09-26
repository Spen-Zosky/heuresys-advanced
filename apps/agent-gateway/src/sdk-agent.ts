/**
 * Agent SDK wiring (#9 WI-B, regime path). Loads the human-resources-plus plugin,
 * attaches the heuresys MCP tools, and enforces the human-in-the-loop WRITE gate
 * via canUseTool (the runtime compliance control; GDPR Art. 22). See
 * docs/integrations/agent_sdk_mcp_integration_plan_2026-06-15.md (WI-B) +
 * the plugin's AUTH_AND_COMPLIANCE_DESIGN.md.
 *
 * Reference skeleton — option/callback names follow the @anthropic-ai/claude-agent-sdk
 * published API and are pinned to the installed version. The gate decision lives in
 * write-gate.ts (SDK-free, unit-tested); here it is only bridged to the SDK.
 */
import { query } from "@anthropic-ai/claude-agent-sdk";
import { buildHeuresysMcp } from "./mcp-tools.js";
import { AtlasOperationResolver } from "./atlas-resolver.js";
import { makeCanUseTool, type ApproveFn, type GatePrincipal } from "./write-gate.js";
import { FileAuditSink, registraChiusuraConversazione, type AuditSink } from "./audit-sink.js";
import { ContatorePersone } from "./persone-distinte.js";
import { caricaSoglie } from "./soglie-persone.js";
import type { HeuresysClient } from "./heuresys-client.js";

export interface RunHrAgentOptions {
  /** Bridges to the webapp (SSE/WebSocket) so a human authorises each write. */
  approve: ApproveFn;
  approvalTimeoutMs?: number;
  /** Audit sink for every gate decision (defaults to FileAuditSink inside the gate). */
  audit?: AuditSink;
  /** Allowlist override (defaults to the catalogue set inside the gate). */
  allowlist?: ReadonlySet<string>;
  /** Principal context for the audit trail (forwarded user vs service user). */
  principal?: GatePrincipal;
  /**
   * Risolutore dei perimetri. Di default si carica dall'atlante generato; i test ne
   * iniettano uno costruito in memoria, per non dipendere da un file che cambia.
   */
  operations?: AtlasOperationResolver;
  /**
   * Il contatore di persone distinte della conversazione (#251). Di default se ne crea uno con
   * le soglie ri-derivate dalle misure generate; i test ne iniettano uno con soglie dichiarate,
   * per non dipendere da un file che cambia quando il tenant cresce.
   */
  contatore?: ContatorePersone;
}

export async function* runHrAgent(
  prompt: string,
  client: HeuresysClient,
  opts: RunHrAgentOptions,
) {
  // Il resolver dei perimetri (#156, ADR-0033 §5.2), collegato in S1067. LO STESSO
  // oggetto va al catalogo e al gate, e non e' un'ottimizzazione: se il catalogo montasse
  // una mappa e il gate ne consultasse un'altra, l'agente potrebbe vedere un'operazione
  // che la guardia non conosce — cioe' esattamente il divario che il gate esiste per
  // impedire. Una fonte sola, letta una volta.
  const operations = opts.operations ?? AtlasOperationResolver.load();
  const heuresys = buildHeuresysMcp(client, operations);

  // #251 — IL CONTATORE DI PERSONE DISTINTE, uno per conversazione. Vive qui e non nel client
  // perche' una conversazione e' UNA runHrAgent (ADR-0040 §4b), mentre il client nasce per
  // richiesta in server.ts. LO STESSO oggetto va al client (che lo alimenta a ogni risposta) e
  // al gate (che lo legge e lo scrive nel diario): due contatori diversi renderebbero il
  // numero del diario diverso da quello che il freno guarda — lo stesso divario che il
  // commento sul resolver qui sopra esiste per impedire.
  const contatore = opts.contatore ?? new ContatorePersone(caricaSoglie());
  client.collegaContatore(contatore);

  // Il diario si risolve QUI e non dentro il gate: serve anche alla voce di chiusura, e due
  // sink distinti scriverebbero la conversazione in due posti.
  const audit: AuditSink = opts.audit ?? new FileAuditSink();

  const canUseTool = makeCanUseTool(opts.approve, {
    operations,
    audit,
    persone: contatore,
    ...(opts.approvalTimeoutMs !== undefined ? { approvalTimeoutMs: opts.approvalTimeoutMs } : {}),
    ...(opts.allowlist !== undefined ? { allowlist: opts.allowlist } : {}),
    ...(opts.principal !== undefined ? { principal: opts.principal } : {}),
  });

  const iterator = query({
    prompt,
    options: {
      // S1099 (#214 F6) — NIENTE settings ereditati. `["project", "user"]` serviva a
      // scoprire skill e agenti del plugin `human-resources-plus`, che oggi e' DISATTIVATO
      // (`~/.claude/settings.json`: `"human-resources-plus@heuresys-plugins": false`). Quel
      // che portava davvero, misurato il 2026-09-13 con `live-perimetro.ts`: gli hook di
      // SessionStart/UserPromptSubmit/Stop della macchina e del repo (boot di sessione,
      // registro sessioni, brief «esegui session_start.py»), il CLAUDE.md intero, e un modello
      // che — istruito come una sessione di sviluppo — tentava Bash e PowerShell (9 dinieghi
      // TOOL_NOT_ALLOWLISTED) e non toccava MAI gli strumenti `hrx_*`: 5 criteri su 8 rossi
      // su un perimetro sano. L'agente HR ragiona sul prompt e sugli strumenti MCP: basta.
      settingSources: [],
      // CRITICAL (M-2): do NOT put `mcp__heuresys__*` in allowedTools — per the SDK,
      // allowedTools are "auto-allowed without prompting", which BYPASSES canUseTool.
      // That would let WRITE tools execute with no human approval. Instead every
      // heuresys MCP tool falls through to canUseTool, which auto-allows reads and
      // routes writes to the HITL gate — and audits EVERY decision (M-4). Built-in
      // tools (Bash/ToolSearch the skills use) stay governed by settingSources.
      allowedTools: ["Skill"], // model-invoked skills only; heuresys tools → canUseTool
      mcpServers: { heuresys },
      permissionMode: "default", // unlisted tools (the heuresys MCP set) → canUseTool
      canUseTool,
    },
  });

  // `finally`, non «dopo il ciclo»: la webapp puo' chiudere la connessione a meta' risposta, e
  // una conversazione interrotta e' esattamente quella su cui si vuole sapere quante persone
  // erano state lette. Senza il `finally` il freno sarebbe cieco proprio sull'abbandono.
  try {
    for await (const event of iterator) yield event; // stream to the webapp
  } finally {
    await registraChiusuraConversazione(
      audit,
      opts.principal ?? { principal: "unknown" },
      contatore,
    );
  }
}
