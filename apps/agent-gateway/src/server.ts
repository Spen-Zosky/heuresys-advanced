/**
 * Agent gateway HTTP server (#9 WI-B.2) — READ-LIVE service port.
 *
 * POST /agent  → Server-Sent Events stream of the Agent SDK run (runHrAgent).
 *   Auth (READ): the caller's heuresys session cookies (hrx_access + hrx_csrf) are
 *   FORWARDED per request → the agent acts as the logged-in user (RBAC + tenant
 *   enforced by /v1). No service account / secret for reads (PLATFORM_MAP §1).
 *   Write gate: in this phase every write is DENIED (approve → false) — zero
 *   mutations; reads auto-allow (write-gate.ts). The live write path is M-2.
 * GET  /healthz → liveness.
 *
 * Node http only (no framework dep). HEURESYS_API defaults to the dev API on :3001.
 */
import { createServer, type IncomingMessage } from "node:http";
import { HeuresysClient } from "./heuresys-client.js";
import { runHrAgent } from "./sdk-agent.js";

const PORT = Number(process.env.AGENT_GATEWAY_PORT ?? 8790);
const HEURESYS_API = (process.env.HEURESYS_API ?? "http://localhost:3001").replace(/\/$/, "");

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
      // READ phase: deny every write (HITL bridge wired in WI-B.4 / M-2).
      const approve = async () => false;
      try {
        for await (const event of runHrAgent(prompt, client, { approve })) {
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
