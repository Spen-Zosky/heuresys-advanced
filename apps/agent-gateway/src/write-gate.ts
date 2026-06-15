/**
 * Pure write-gate logic for the Agent SDK backend (#9 WI-B).
 *
 * The chokepoint that enforces "no solely-automated consequential write"
 * (GDPR Art. 22 / EU AI Act human oversight): reads auto-allow, writes require a
 * human approval round-trip, and DENY-BY-DEFAULT on timeout or approver error (M-2).
 *
 * Kept SDK-free so it is unit-testable without the live @anthropic-ai/claude-agent-sdk.
 */

/** Verbs that mutate platform state — the MCP tool naming is `hrx.<domain>.<verb>`
 *  (or snake-case `hrx_<domain>_<verb>`). A tool is a WRITE if its name carries any. */
const WRITE_VERBS =
  /(upsert|create|update|delete|apply|materialize|recommend|handoff|add|remove|activate|override)/i;

export function isWriteTool(name: string): boolean {
  return WRITE_VERBS.test(name);
}

export type ApprovalRequest = { tool: string; input: unknown };
export type ApproveFn = (req: ApprovalRequest) => Promise<boolean>;

/** Mirrors the SDK PermissionResult: updatedInput must be a Record (not unknown). */
export type ToolDecision =
  | { behavior: "allow"; updatedInput: Record<string, unknown> }
  | { behavior: "deny"; message: string };

export interface GateOptions {
  /** Max time to wait for the human approval before denying (default 120s). */
  approvalTimeoutMs?: number;
}

const DENY: ToolDecision = { behavior: "deny", message: "write not approved (compliance gate)" };

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
 * Builds the SDK `canUseTool` callback. Reads pass automatically; writes are routed
 * to `approve` (the webapp HITL round-trip). Any non-true outcome — explicit refusal,
 * timeout, or a thrown approver — results in DENY (fail-closed).
 */
export function makeCanUseTool(approve: ApproveFn, opts: GateOptions = {}) {
  const timeoutMs = opts.approvalTimeoutMs ?? 120_000;
  return async function canUseTool(name: string, input: unknown): Promise<ToolDecision> {
    if (!isWriteTool(name)) {
      return { behavior: "allow", updatedInput: input as Record<string, unknown> };
    }
    let approved = false;
    try {
      approved = await withTimeout(approve({ tool: name, input }), timeoutMs, false);
    } catch {
      approved = false; // approver threw → fail closed
    }
    return approved ? { behavior: "allow", updatedInput: input as Record<string, unknown> } : DENY;
  };
}
