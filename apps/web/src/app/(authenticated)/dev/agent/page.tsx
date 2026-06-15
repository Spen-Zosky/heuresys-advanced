"use client";

/**
 * DEV-only agent console (#9 WI-B.4).
 *
 * Drives the agent-gateway (#9 WI-B.2): POST /agent → consumes the SSE stream
 * (assistant messages + tool-calls), and renders the human-in-the-loop approval
 * panel when an `approval_required` event arrives — the tool + input are ALREADY
 * REDACTED by the gateway (server.ts emits `redact(tool)` / `redact(input)`),
 * so this page never sees raw PII/secret. Allow/Deny POST to /agent/approve.
 *
 * Gating: the whole page is behind NEXT_PUBLIC_ENABLE_AGENT_DEV. When off it
 * renders a soft "disabled" notice (NOT a hard 404) so the route still resolves.
 * The gateway base URL comes from NEXT_PUBLIC_AGENT_GATEWAY_URL (localhost default).
 *
 * UI: composed ONLY from @heuresys/ui primitives + local composition (project rule —
 * no reusable UI primitive is defined in apps/web). Strings live in the existing
 * `admin` i18n namespace under `agentDev.*` (it + en).
 *
 * This page renders without a live agent (the live drive is blocked-on-Enzo:
 * dev subscription out_of_credits / PROD credential required). Submitting a prompt
 * when the gateway is unreachable surfaces a real error in the stream, by design.
 */
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";

// Feature flag + gateway URL come from build-time public env (KEY names only — R10).
const AGENT_DEV_ENABLED = process.env.NEXT_PUBLIC_ENABLE_AGENT_DEV === "1";
const GATEWAY_URL = (process.env.NEXT_PUBLIC_AGENT_GATEWAY_URL ?? "http://localhost:8790").replace(/\/$/, "");

/** A pending write approval surfaced by an `approval_required` SSE event. */
interface PendingApproval {
  approvalId: string;
  /** Already redacted by the gateway. */
  tool: unknown;
  /** Already redacted by the gateway. */
  input: unknown;
}

/** One rendered line of the SSE stream (raw event block, capped). */
interface StreamLine {
  id: number;
  /** SSE `event:` name when present (`approval_required` / `error` / `done`), else `message`. */
  kind: string;
  text: string;
}

/** Parses one SSE block ("event: x\n data: {...}") into kind + payload text. */
function parseSseBlock(block: string): { kind: string; data: string } {
  let kind = "message";
  const dataParts: string[] = [];
  for (const raw of block.split("\n")) {
    const line = raw.trimEnd();
    if (line.startsWith("event:")) kind = line.slice("event:".length).trim();
    else if (line.startsWith("data:")) dataParts.push(line.slice("data:".length).trim());
  }
  return { kind, data: dataParts.join("\n") };
}

function DisabledNotice() {
  const { t } = useTranslation("admin");
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Card data-testid="agentdev-disabled">
        <CardHeader>
          <CardTitle>{t("agentDev.disabledTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("agentDev.disabledDesc")}</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AgentDevConsolePage() {
  const { t } = useTranslation("admin");

  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<StreamLine[]>([]);
  const [approval, setApproval] = useState<PendingApproval | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const lineIdRef = useRef(0);

  const pushLine = useCallback((kind: string, text: string) => {
    lineIdRef.current += 1;
    const id = lineIdRef.current;
    // Cap the rendered buffer so a long run does not balloon the DOM.
    setLines((prev) => [...prev.slice(-199), { id, kind, text }]);
  }, []);

  const handleSseBlock = useCallback(
    (block: string) => {
      if (!block.trim()) return;
      const { kind, data } = parseSseBlock(block);
      if (kind === "approval_required") {
        try {
          const parsed = JSON.parse(data) as { approvalId?: string; tool?: unknown; input?: unknown };
          if (parsed.approvalId) {
            setApproval({ approvalId: parsed.approvalId, tool: parsed.tool, input: parsed.input });
          }
        } catch {
          /* ignore malformed approval payload */
        }
      }
      pushLine(kind, data.replace(/\s+/g, " ").slice(0, 600));
    },
    [pushLine],
  );

  const resolveApproval = useCallback(
    async (decision: "allow" | "deny") => {
      if (!approval) return;
      const { approvalId } = approval;
      setApproval(null);
      try {
        await fetch(`${GATEWAY_URL}/agent/approve`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ approvalId, decision }),
        });
        setNotice({ kind: "ok", msg: t("agentDev.approvalResolved", { decision }) });
      } catch (err) {
        setNotice({ kind: "err", msg: err instanceof Error ? err.message : String(err) });
      }
    },
    [approval, t],
  );

  const run = useCallback(async () => {
    if (running || !prompt.trim()) return;
    setRunning(true);
    setNotice(null);
    setApproval(null);
    setLines([]);
    lineIdRef.current = 0;

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${GATEWAY_URL}/agent`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include", // forward hrx_access / hrx_csrf cookies to the gateway
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => "");
        if (res.status === 401) {
          setNotice({ kind: "err", msg: t("agentDev.noSession") });
        } else {
          setNotice({ kind: "err", msg: t("agentDev.errorRun", { message: `HTTP ${res.status} ${detail}`.trim() }) });
        }
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      // SSE frames are separated by a blank line ("\n\n").
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        for (const block of blocks) handleSseBlock(block);
      }
      if (buffer.trim()) handleSseBlock(buffer);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // user-initiated stop — not an error
      } else {
        setNotice({ kind: "err", msg: t("agentDev.errorRun", { message: err instanceof Error ? err.message : String(err) }) });
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [running, prompt, handleSseBlock, t]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // Feature-gate: render a soft notice, never a hard 404 (project rule).
  if (!AGENT_DEV_ENABLED) return <DisabledNotice />;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8" data-testid="agentdev-page">
      <Card>
        <CardHeader>
          <CardTitle data-testid="agentdev-title">{t("agentDev.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("agentDev.description")}</p>
          <p className="text-xs text-muted-foreground">
            {t("agentDev.gatewayLabel")}: <code className="font-mono">{GATEWAY_URL}</code>
          </p>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-foreground">{t("agentDev.promptLabel")}</span>
            <textarea
              data-testid="agentdev-prompt"
              className="min-h-28 w-full rounded-md border border-input bg-background p-3 text-sm text-foreground"
              placeholder={t("agentDev.promptPlaceholder")}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={running}
            />
          </label>

          <div className="flex gap-3">
            <Button type="button" data-testid="agentdev-run" onClick={() => void run()} disabled={running || !prompt.trim()}>
              {running ? t("agentDev.running") : t("agentDev.run")}
            </Button>
            {running && (
              <Button type="button" variant="secondary" data-testid="agentdev-stop" onClick={stop}>
                {t("agentDev.stop")}
              </Button>
            )}
          </div>

          {notice && (
            <p
              data-testid={notice.kind === "ok" ? "agentdev-notice-ok" : "agentdev-notice-err"}
              className={`text-sm font-medium ${notice.kind === "ok" ? "text-success" : "text-danger"}`}
              role={notice.kind === "err" ? "alert" : undefined}
            >
              {notice.msg}
            </p>
          )}
        </CardContent>
      </Card>

      {approval && (
        <Card data-testid="agentdev-approval">
          <CardHeader>
            <CardTitle>{t("agentDev.approvalTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("agentDev.approvalDesc")}</p>
            <div className="space-y-1 text-sm">
              <span className="font-medium text-foreground">{t("agentDev.approvalTool")}:</span>{" "}
              <code data-testid="agentdev-approval-tool" className="font-mono break-all">
                {JSON.stringify(approval.tool)}
              </code>
            </div>
            <div className="space-y-1 text-sm">
              <span className="font-medium text-foreground">{t("agentDev.approvalInput")}:</span>
              <pre data-testid="agentdev-approval-input" className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 font-mono text-xs">
                {JSON.stringify(approval.input, null, 2)}
              </pre>
            </div>
            <div className="flex gap-3">
              <Button type="button" data-testid="agentdev-approve-allow" onClick={() => void resolveApproval("allow")}>
                {t("agentDev.allow")}
              </Button>
              <Button type="button" variant="destructive" data-testid="agentdev-approve-deny" onClick={() => void resolveApproval("deny")}>
                {t("agentDev.deny")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("agentDev.streamTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {lines.length === 0 ? (
            <p data-testid="agentdev-stream-empty" className="text-sm text-muted-foreground">
              {t("agentDev.streamEmpty")}
            </p>
          ) : (
            <ul data-testid="agentdev-stream" className="space-y-1">
              {lines.map((line) => (
                <li key={line.id} data-testid="agentdev-stream-line" className="flex items-start gap-2 text-xs">
                  <Badge variant={line.kind === "error" ? "destructive" : line.kind === "approval_required" ? "secondary" : "outline"}>
                    {line.kind}
                  </Badge>
                  <code className="break-all font-mono text-muted-foreground">{line.text}</code>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
