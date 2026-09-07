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
 * ⭐ #159 F2 (S1091): il CANALE non vive piu' qui. Stream SSE, stato della corsa e
 * approvazioni stanno in `@/lib/use-agent-stream`, cosi' che la prossima pagina idonea
 * non debba ricopiarli da questa — che e' il bersaglio della voce, «il ponte deve valere
 * per le pagine future, non per la prima». Questa pagina resta il PRIMO consumatore, e
 * ora fa una cosa sola: rendere. In particolare TRADUCE lei gli avvisi: l'hook
 * restituisce un `code` i18n, non una stringa gia' tradotta, altrimenti un secondo
 * consumatore erediterebbe le stringhe di `agentDev.*`.
 *
 * This page renders without a live agent (the live drive is blocked-on-Enzo:
 * dev subscription out_of_credits / PROD credential required). Submitting a prompt
 * when the gateway is unreachable surfaces a real error in the stream, by design.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { AGENT_DEV_ENABLED, useAgentStream } from "@/lib/use-agent-stream";

// L'indirizzo del gateway si mostra a schermo, quindi resta leggibile anche qui: sono
// i NOMI delle chiavi d'ambiente, mai i valori dei segreti (R10).
const GATEWAY_URL = (process.env.NEXT_PUBLIC_AGENT_GATEWAY_URL ?? "http://localhost:8790").replace(/\/$/, "");

/** A pending write approval surfaced by an `approval_required` SSE event. */
/* Tipi e interprete SSE sono usciti da qui: vivono in `@/lib/use-agent-stream`,
   perche' erano il CANALE e non la vista. Vederli qui dentro era il segno che la
   prossima pagina avrebbe dovuto ricopiarli. */


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

  // Il prompt e' della VISTA (e' cio' che l'utente scrive); tutto il resto e' del canale.
  const [prompt, setPrompt] = useState("");
  const { running, lines, approval, notice, run, stop, resolveApproval } = useAgentStream();

  // ⭐ La traduzione avviene QUI, non nell'hook. `notice.code` e' una chiave senza
  //    namespace: questa pagina la prefissa col proprio (`agentDev.*`), la prossima col suo.
  //    Se l'hook restituisse una stringa gia' tradotta, ogni consumatore futuro
  //    erediterebbe le parole di questa console.
  const noticeText =
    notice === null ? null : t(`agentDev.${notice.code}`, notice.params ?? {});

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
            <Button type="button" data-testid="agentdev-run" onClick={() => void run(prompt)} disabled={running || !prompt.trim()}>
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
              {noticeText}
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
