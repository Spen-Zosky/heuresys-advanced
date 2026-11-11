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
 * ⭐ #159 F2 (S1091): il CANALE non vive piu' qui; (S1099) nemmeno la VISTA: e' `AgentPanel` di `@heuresys/ui`. Stream SSE, stato della corsa e
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
import { PageHeader } from "@/components/intestazione-pagina";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AgentPanel, Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { AGENT_DEV_ENABLED, useAgentStream } from "@/lib/use-agent-stream";

// L'indirizzo del gateway si mostra a schermo, quindi resta leggibile anche qui: sono
// i NOMI delle chiavi d'ambiente, mai i valori dei segreti (R10).
const GATEWAY_URL = (process.env.NEXT_PUBLIC_AGENT_GATEWAY_URL ?? "http://localhost:8790").replace(/\/$/, "");

/* ⭐ #159 F2 (S1099): anche la VISTA non vive piu' qui. `AgentPanel` e' di `@heuresys/ui`
   (1.2.0): questa pagina traduce le parole nel proprio namespace, monta il canale e passa
   stato e callback. La prossima pagina idonea fa lo stesso con il suo namespace e il suo
   contesto — e non tocca ne' il canale ne' il componente. */

function DisabledNotice() {
  const { t } = useTranslation("admin");
  return (
    // C7: anche spenta, la pagina ha il suo titolo
    <main className="mx-auto max-w-7xl space-y-6 px-6 pb-8">
      <PageHeader title={t("agentDev.title")} description={t("agentDev.description")} />
      <Card data-testid="agentdev-disabled">
        <CardHeader>
          <CardTitle>{t("agentDev.disabledTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("agentDev.disabledDesc")}</p>
        </CardContent>
      </Card>
    </main>
  );
}

export default function AgentDevConsolePage() {
  const { t, i18n } = useTranslation("admin");

  // Il prompt e' della VISTA (e' cio' che l'utente scrive); tutto il resto e' del canale.
  const [prompt, setPrompt] = useState("");
  const { running, lines, approval, notice, run, stop, resolveApproval } = useAgentStream();

  // ⭐ La traduzione avviene QUI, non nell'hook e non nel componente. `notice.code` e' una
  //    chiave senza namespace: questa pagina la prefissa col proprio (`agentDev.*`), la
  //    prossima col suo.
  const noticeText =
    notice === null ? null : t(`agentDev.${notice.code}`, notice.params ?? {});

  // ⭐ #252 — LA DESCRIZIONE LA COMPONE LA PAGINA, non il pannello. `AgentPanel` vive in
  //    `@heuresys/ui` e riceve `approvalDesc` come etichetta già pronta: il numero di persone
  //    entra da qui, senza toccare il design system (che serve anche ad altri prodotti).
  //    Tre casi, e il terzo non è un dettaglio: se il gateway non dichiara il numero non si
  //    scrive «0 persone» — «non l'ho misurato» è un'altra frase, e il pannello deve dirla.
  const approvalDesc =
    approval?.classe === "read"
      ? approval.personeDistinte === undefined
        ? t("agentDev.approvalDescReadUnknown")
        : t("agentDev.approvalDescRead", { persone: approval.personeDistinte })
      : t("agentDev.approvalDesc");

  // Feature-gate: render a soft notice, never a hard 404 (project rule).
  if (!AGENT_DEV_ENABLED) return <DisabledNotice />;

  return (
    <div className="mx-auto max-w-4xl px-6 pb-8">
      {/* C7: la pagina ha il suo titolo, come le altre; il pannello porta il nome della conversazione */}
      <PageHeader title={t("agentDev.title")} description={t("agentDev.description")} />
      <AgentPanel
        testIdPrefix="agentdev"
        labels={{
          title: t("agentDev.panelTitle"),
          description: "",
          gatewayLabel: t("agentDev.gatewayLabel"),
          promptLabel: t("agentDev.promptLabel"),
          promptPlaceholder: t("agentDev.promptPlaceholder"),
          run: t("agentDev.run"),
          running: t("agentDev.running"),
          stop: t("agentDev.stop"),
          streamTitle: t("agentDev.streamTitle"),
          streamEmpty: t("agentDev.streamEmpty"),
          approvalTitle: t("agentDev.approvalTitle"),
          approvalDesc,
          approvalTool: t("agentDev.approvalTool"),
          approvalInput: t("agentDev.approvalInput"),
          allow: t("agentDev.allow"),
          deny: t("agentDev.deny"),
          rejectReasonLabel: t("agentDev.rejectReasonLabel"),
          rejectConfirm: t("agentDev.rejectConfirm"),
          approvalExpires: t("agentDev.approvalExpires"),
        }}
        // ADR-0056 D4: il rifiuto porta il motivo, che il gateway registra (senza, l'API dà 422).
        requireRejectReason
        gatewayUrl={GATEWAY_URL}
        prompt={prompt}
        onPromptChange={setPrompt}
        running={running}
        onRun={() => void run(prompt)}
        onStop={stop}
        lines={lines}
        approval={
          approval === null
            ? null
            : {
                ...approval,
                ...(approval.expiresAt
                  ? { expiresText: new Date(approval.expiresAt).toLocaleString(i18n.language) }
                  : {}),
              }
        }
        onApproval={(d, reason) => void resolveApproval(d, reason)}
        notice={notice === null || noticeText === null ? null : { kind: notice.kind, text: noticeText }}
      />
    </div>
  );
}
