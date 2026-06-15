/**
 * Pure write-gate logic for the Agent SDK backend (#9 WI-B).
 *
 * The chokepoint that enforces "no solely-automated consequential write"
 * (GDPR Art. 22 / EU AI Act human oversight). Three layers, in order:
 *   1. ALLOWLIST (M-3, I8 defense-in-depth): deny-by-default — an unknown / unlisted
 *      tool name is denied BEFORE the read/write branch, regardless of model output.
 *   2. READ vs WRITE: allowlisted reads auto-allow; allowlisted writes need a human.
 *   3. HITL + DENY-BY-DEFAULT (M-2): a write requires a human approval round-trip;
 *      timeout or approver error fails CLOSED.
 *
 * EVERY decision (allow-read, allow-write, deny) is recorded through the injected
 * AuditSink (M-4) — the sink redacts + hashes the args, so no raw PII/secret is logged.
 *
 * Kept SDK-free so it is unit-testable without the live @anthropic-ai/claude-agent-sdk.
 */
import {
  FileAuditSink,
  type AuditPrincipal,
  type AuditSink,
} from "./audit-sink.js";
import { bareToolName, DEFAULT_TOOL_ALLOWLIST } from "./mcp-tool-names.js";

/** Verbs that mutate platform state — the MCP tool naming is `hrx.<domain>.<verb>`
 *  (or snake-case `hrx_<domain>_<verb>`). A tool is a WRITE if its name carries any. */
const WRITE_VERBS =
  /(upsert|create|update|delete|apply|materialize|recommend|handoff|add|remove|activate|override)/i;

export function isWriteTool(name: string): boolean {
  return WRITE_VERBS.test(bareToolName(name));
}

export type ApprovalRequest = { tool: string; input: unknown };
export type ApproveFn = (req: ApprovalRequest) => Promise<boolean>;

/** Mirrors the SDK PermissionResult: updatedInput must be a Record (not unknown). */
export type ToolDecision =
  | { behavior: "allow"; updatedInput: Record<string, unknown> }
  | { behavior: "deny"; message: string };

/** Who the gate audits the decision under (hybrid auth: forwarded user vs service user). */
export interface GatePrincipal {
  principal: AuditPrincipal;
  /** Opaque subject id (never PII — a user/session id). */
  subject?: string;
  /** Tenant the call runs against (implicit from JWT upstream; "unknown" if unbound). */
  tenant?: string;
}

export interface GateOptions {
  /** Max time to wait for the human approval before denying (default 120s). */
  approvalTimeoutMs?: number;
  /**
   * Audit sink for EVERY decision. Defaults to a FileAuditSink (NOT a silent null sink):
   * production must always leave a trail. Tests inject a MemoryAuditSink.
   */
  audit?: AuditSink;
  /** Deny-by-default allowlist of permitted tool names. Defaults to the catalogue set. */
  allowlist?: ReadonlySet<string>;
  /** Principal context for the audit record. Defaults to the unknown principal. */
  principal?: GatePrincipal;
}

const DENY_NOT_APPROVED = "write not approved (compliance gate)";
const DENY_NOT_ALLOWLISTED = "tool not in allowlist (defense-in-depth)";

async function withTimeout<T>(p: Promise<T>, ms: number, onTimeout: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(onTimeout), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Builds the SDK `canUseTool` callback. Unlisted tools are denied (allowlist, M-3);
 * allowlisted reads pass automatically; allowlisted writes are routed to `approve`
 * (the webapp HITL round-trip). Any non-true outcome — explicit refusal, timeout, or a
 * thrown approver — results in DENY (fail-closed). Every outcome is audited (M-4).
 */
export function makeCanUseTool(approve: ApproveFn, opts: GateOptions = {}) {
  const timeoutMs = opts.approvalTimeoutMs ?? 120_000;
  const audit: AuditSink = opts.audit ?? new FileAuditSink();
  const allowlist = opts.allowlist ?? DEFAULT_TOOL_ALLOWLIST;
  const who = opts.principal ?? { principal: "unknown" as AuditPrincipal };

  const auditDecision = (
    tool: string,
    args: unknown,
    decision: ToolDecision,
    reason: string,
  ): void => {
    // Audit is best-effort and MUST NOT change the gate decision: swallow sink errors.
    void audit
      .record({
        who: { principal: who.principal, ...(who.subject !== undefined ? { subject: who.subject } : {}) },
        tenant: who.tenant ?? "unknown",
        tool,
        args,
        decision: decision.behavior,
        reason,
      })
      .catch(() => {});
  };

  return async function canUseTool(name: string, input: unknown): Promise<ToolDecision> {
    // 1. Allowlist (deny-by-default, before classification).
    if (!allowlist.has(name)) {
      const d: ToolDecision = { behavior: "deny", message: DENY_NOT_ALLOWLISTED };
      auditDecision(name, input, d, "TOOL_NOT_ALLOWLISTED");
      return d;
    }

    // 2. Allowlisted read → auto-allow.
    if (!isWriteTool(name)) {
      const d: ToolDecision = { behavior: "allow", updatedInput: input as Record<string, unknown> };
      auditDecision(name, input, d, "READ_AUTO_ALLOW");
      return d;
    }

    // 3. Allowlisted write → HITL with deny-by-default on timeout/throw.
    let approved = false;
    try {
      approved = await withTimeout(approve({ tool: name, input }), timeoutMs, false);
    } catch {
      approved = false; // approver threw → fail closed
    }
    const d: ToolDecision = approved
      ? { behavior: "allow", updatedInput: input as Record<string, unknown> }
      : { behavior: "deny", message: DENY_NOT_APPROVED };
    auditDecision(name, input, d, approved ? "WRITE_HUMAN_APPROVED" : "WRITE_DENIED_OR_TIMEOUT");
    return d;
  };
}
