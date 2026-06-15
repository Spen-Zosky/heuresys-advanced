/**
 * Agent gateway HTTP server (#9 WI-B.2) — READ-LIVE service port.
 *
 * POST /agent          → Server-Sent Events stream of the Agent SDK run (runHrAgent).
 *   Auth (READ): the caller's heuresys session cookies (hrx_access + hrx_csrf) are
 *   FORWARDED per request → the agent acts as the logged-in user (RBAC + tenant
 *   enforced by /v1). No service account / secret for reads (PLATFORM_MAP §1).
 *   Write gate (M-2): every write triggers a human-in-the-loop round-trip. The stream
 *   emits an `approval_required` event carrying an `approvalId` + the REDACTED tool/args;
 *   a human resolves it via POST /agent/approve. DENY-BY-DEFAULT on timeout / unknown id.
 *   Reads auto-allow (write-gate.ts). EVERY decision is audited (audit-sink.ts).
 * POST /agent/approve   → { approvalId, decision:'allow'|'deny' } resolves a pending write.
 * GET  /healthz         → liveness.
 *
 * Node http only (no framework dep). HEURESYS_API defaults to the dev API on :3001.
 */
import { createServer, type IncomingMessage } from "node:http";
import { ApprovalRegistry, type ApprovalDecision } from "./approval-bridge.js";
import { FileAuditSink } from "./audit-sink.js";
import { HeuresysClient } from "./heuresys-client.js";
import { redact } from "./redact.js";
import { runHrAgent } from "./sdk-agent.js";
import type { GatePrincipal } from "./write-gate.js";

const PORT = Number(process.env.AGENT_GATEWAY_PORT ?? 8790);
const HEURESYS_API = (process.env.HEURESYS_API ?? "http://localhost:3001").replace(/\/$/, "");
const APPROVAL_TIMEOUT_MS = Number(process.env.AGENT_GATEWAY_APPROVAL_TIMEOUT_MS ?? 120_000);

// Module-level singletons (one per server process):
//  - the HITL approval registry bridges the SSE stream ↔ POST /agent/approve;
//  - the file audit sink leaves a tamper-evident trail of EVERY gate decision (M-4).
const approvals = new ApprovalRegistry({ approvalTimeoutMs: APPROVAL_TIMEOUT_MS });
const auditSink = new FileAuditSink();

// #9 §A.1 — DEV subscription auth: with AGENT_GATEWAY_SUBSCRIPTION_AUTH=1 do NOT
// forward an ANTHROPIC_API_KEY to the SDK, so query() falls back to the machine's
// logged-in Claude credentials (subscription, zero cost). The PROD service port
// MUST instead provide a real ANTHROPIC_API_KEY (or AWS Bedrock / GCP Vertex auth).
if (process.env.AGENT_GATEWAY_SUBSCRIPTION_AUTH === "1") {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_AUTH_TOKEN;
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/healthz") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, service: "agent-gateway", api: HEURESYS_API }));
      return;
    }

    // HITL resolve route: a human allows/denies a pending write from the webapp.
    if (req.method === "POST" && req.url === "/agent/approve") {
      const body = await readBody(req);
      let parsed: { approvalId?: string; decision?: string };
      try {
        parsed = JSON.parse(body || "{}") as { approvalId?: string; decision?: string };
      } catch {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "BAD_JSON" }));
        return;
      }
      const approvalId = parsed.approvalId;
      const decision = parsed.decision;
      if (!approvalId || (decision !== "allow" && decision !== "deny")) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "BAD_REQUEST", message: "approvalId + decision:'allow'|'deny'" }));
        return;
      }
      // unknown / expired / already-resolved id → no-op (deny-by-default semantics).
      const resolved = approvals.resolve(approvalId, decision as ApprovalDecision);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, resolved }));
      return;
    }

    if (req.method === "POST" && req.url === "/agent") {
      const cookies = parseCookies(req.headers.cookie);
      const cookieAccess = cookies["hrx_access"];
      const cookieCsrf = cookies["hrx_csrf"] ?? "";
      if (!cookieAccess) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "NO_SESSION", message: "forward hrx_access cookie" }));
        return;
      }
      const body = await readBody(req);
      const prompt = (JSON.parse(body || "{}") as { prompt?: string }).prompt;
      if (!prompt) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "NO_PROMPT" }));
        return;
      }

      const client = new HeuresysClient({
        baseUrl: HEURESYS_API,
        session: { cookieAccess, cookieCsrf, csrf: cookieCsrf },
      });

      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });

      // M-2 HITL bridge: each write registers a pending approval, emits an
      // `approval_required` SSE event with the REDACTED tool/args, and awaits the
      // human's decision via POST /agent/approve (deny-by-default on timeout).
      const principal: GatePrincipal = { principal: "user" };
      const approve = async (reqApprove: { tool: string; input: unknown }): Promise<boolean> => {
        const { approvalId, decided } = approvals.create();
        const payload = {
          approvalId,
          tool: redact(reqApprove.tool),
          input: redact(reqApprove.input),
        };
        res.write(`event: approval_required\ndata: ${JSON.stringify(payload)}\n\n`);
        return decided; // resolves allow/deny; false on timeout / unknown id
      };

      try {
        for await (const event of runHrAgent(prompt, client, {
          approve,
          approvalTimeoutMs: APPROVAL_TIMEOUT_MS,
          audit: auditSink,
          principal,
        })) {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
      } catch (err) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: String(err) })}\n\n`);
      }
      res.write("event: done\ndata: {}\n\n");
      res.end();
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "NOT_FOUND" }));
  } catch (err) {
    if (!res.headersSent) res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "INTERNAL", message: String(err) }));
  }
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[agent-gateway] listening on :${PORT} → ${HEURESYS_API}`);
});
