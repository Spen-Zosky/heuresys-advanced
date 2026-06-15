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
import { makeCanUseTool, type ApproveFn, type GatePrincipal } from "./write-gate.js";
import type { AuditSink } from "./audit-sink.js";
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
}

export async function* runHrAgent(
  prompt: string,
  client: HeuresysClient,
  opts: RunHrAgentOptions,
) {
  const heuresys = buildHeuresysMcp(client);
  const canUseTool = makeCanUseTool(opts.approve, {
    ...(opts.approvalTimeoutMs !== undefined ? { approvalTimeoutMs: opts.approvalTimeoutMs } : {}),
    ...(opts.audit !== undefined ? { audit: opts.audit } : {}),
    ...(opts.allowlist !== undefined ? { allowlist: opts.allowlist } : {}),
    ...(opts.principal !== undefined ? { principal: opts.principal } : {}),
  });

  const iterator = query({
    prompt,
    options: {
      settingSources: ["project", "user"], // discover the plugin's skills + agents
      allowedTools: ["Skill", "mcp__heuresys__*"], // model-invoked skills + heuresys tools
      mcpServers: { heuresys },
      permissionMode: "default", // writes fall through to canUseTool
      canUseTool,
    },
  });

  for await (const event of iterator) yield event; // stream to the webapp
}
