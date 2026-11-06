"use client";

/**
 * apps/web/src/components/pannello-agente.tsx — piano interfacce L10, voce A-8.
 *
 * Il pannello dell'agente su OGNI pagina idonea, non su una sola. Fino a L10 l'assistente era
 * montato a mano in due posti (`/dev/agent` e `/approvals/[id]`); qui lo monta il layout
 * autenticato, una volta, e lo mostra solo dove `check_idoneita_agente.py` dice che la pagina è
 * idonea (elenco generato in `lib/agente/pagine-idonee.generated.ts`, che il controllo tiene
 * allineato). Componente e canale restano quelli di #159: `AgentPanel` da `@heuresys/ui`,
 * `useAgentStream` per lo stream. Questo file è solo la cucitura fra i due e la pagina.
 *
 * Il contesto è un valore: quello dichiarato dalla pagina con `useContestoAgente`, oppure il
 * titolo della finestra con l'indirizzo. Dietro lo stesso flag di sempre
 * (`NEXT_PUBLIC_ENABLE_AGENT_DEV`): a flag spento non si disegna niente.
 */
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AgentPanel, Button } from "@heuresys/ui";
import { AGENT_DEV_ENABLED, useAgentStream } from "@/lib/use-agent-stream";
import { paginaIdonea } from "@/lib/agente/idoneita";
import { useContestoDichiarato } from "@/lib/agente/contesto";

export function PannelloAgente() {
  const pathname = usePathname() ?? "";
  if (!AGENT_DEV_ENABLED || paginaIdonea(pathname) === null) return null;
  return <PannelloAgenteAcceso pathname={pathname} />;
}

function PannelloAgenteAcceso({ pathname }: { pathname: string }) {
  const { t } = useTranslation("common");
  const dichiarato = useContestoDichiarato();
  const agent = useAgentStream();
  const [aperto, setAperto] = useState(false);
  const [prompt, setPrompt] = useState("");

  // Il titolo della finestra si legge al disegno: il contesto si mostra solo a pannello aperto,
  // cioè dopo un gesto nel browser, mai nel disegno del server.
  const titolo = typeof document === "undefined" ? "" : document.title;

  const contesto = dichiarato ?? t("agente.contestoPagina", { titolo: titolo || pathname, percorso: pathname });

  const testoAvviso = agent.notice === null ? null : t(`agente.${agent.notice.code}`, agent.notice.params ?? {});
  const descrizioneApprovazione =
    agent.approval?.classe === "read"
      ? agent.approval.personeDistinte === undefined
        ? t("agente.approvalDescReadUnknown")
        : t("agente.approvalDescRead", { persone: agent.approval.personeDistinte })
      : t("agente.approvalDesc");

  if (!aperto) {
    return (
      <div className="flex justify-end px-6 pt-4">
        <Button variant="outline" size="sm" data-testid="agente-apri" onClick={() => setAperto(true)}>
          {t("agente.apri")}
        </Button>
      </div>
    );
  }

  return (
    <section aria-label={t("agente.title")} className="space-y-2 px-6 pt-4">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" data-testid="agente-chiudi" onClick={() => setAperto(false)}>
          {t("agente.chiudi")}
        </Button>
      </div>
      <AgentPanel
        testIdPrefix="agente"
        context={contesto}
        labels={{
          title: t("agente.title"),
          description: t("agente.description"),
          contextLabel: t("agente.contextLabel"),
          promptLabel: t("agente.promptLabel"),
          promptPlaceholder: t("agente.promptPlaceholder"),
          run: t("agente.run"),
          running: t("agente.running"),
          stop: t("agente.stop"),
          streamTitle: t("agente.streamTitle"),
          streamEmpty: t("agente.streamEmpty"),
          approvalTitle: t("agente.approvalTitle"),
          approvalDesc: descrizioneApprovazione,
          approvalTool: t("agente.approvalTool"),
          approvalInput: t("agente.approvalInput"),
          allow: t("agente.allow"),
          deny: t("agente.deny"),
        }}
        prompt={prompt}
        onPromptChange={setPrompt}
        running={agent.running}
        // Il contesto viaggia col prompt: il gateway non vede la pagina, vede ciò che le si dice.
        onRun={() => void agent.run(`${t("agente.contextLabel")}: ${contesto}\n\n${prompt}`)}
        onStop={agent.stop}
        lines={agent.lines}
        approval={agent.approval}
        onApproval={(decision) => void agent.resolveApproval(decision)}
        notice={agent.notice === null || testoAvviso === null ? null : { kind: agent.notice.kind, text: testoAvviso }}
      />
    </section>
  );
}
