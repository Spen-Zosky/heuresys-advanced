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
 *
 * Dal piano dei principi agentici T6c (ADR-0056 D4): accanto al pannello la colonna delle
 * conversazioni salvate (`AgentActivityList`), da cui la persona ne riprende una; il rifiuto di
 * una proposta chiede il motivo, che il gateway registra (senza motivo l'API risponde 422).
 */
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AgentActivityList, AgentPanel, Button, type AgentActivityStatus } from "@heuresys/ui";
import { AGENT_DEV_ENABLED, useAgentStream } from "@/lib/use-agent-stream";
import { paginaIdonea } from "@/lib/agente/idoneita";
import { useContestoDichiarato, useVistaAttuale } from "@/lib/agente/contesto";

export function PannelloAgente() {
  const pathname = usePathname() ?? "";
  if (!AGENT_DEV_ENABLED || paginaIdonea(pathname) === null) return null;
  return <PannelloAgenteAcceso pathname={pathname} />;
}

function PannelloAgenteAcceso({ pathname }: { pathname: string }) {
  const { t, i18n } = useTranslation("common");
  const dichiarato = useContestoDichiarato();
  const vistaAttuale = useVistaAttuale();
  // La pagina da cui è partita la richiesta, e quella aperta ora: un comando arrivato dopo un cambio
  // di pagina non si applica alla pagina nuova (in mod-platform: «La persona ha cambiato pagina»).
  const percorsoInvio = useRef<string | null>(null);
  const percorsoOra = useRef(pathname);
  useEffect(() => {
    percorsoOra.current = pathname;
  }, [pathname]);
  // I comandi della vista vanno alla parte della pagina che si è dichiarata (oggi ogni tabella).
  const agent = useAgentStream({
    onPageCommand: (nome, argomenti) => {
      if (percorsoInvio.current !== percorsoOra.current)
        return { stato: "rifiutata", dettaglio: "La persona ha cambiato pagina: il comando non si applica a quella nuova." };
      const v = vistaAttuale();
      if (!v || !v.comandi.includes(nome)) return { stato: "rifiutata", dettaglio: "Questa pagina non accetta il comando." };
      return v.esegui(nome, argomenti);
    },
  });
  const [aperto, setAperto] = useState(false);
  const [prompt, setPrompt] = useState("");
  const { refreshConversations } = agent;

  // Le conversazioni si rileggono a ogni apertura: il lavoro continua anche a finestra chiusa.
  useEffect(() => {
    if (aperto) void refreshConversations();
  }, [aperto, refreshConversations]);

  const quando = (iso: string) => new Date(iso).toLocaleString(i18n.language);
  const stati: Record<AgentActivityStatus, string> = {
    IN_CORSO: t("agente.statoIN_CORSO"),
    IN_ATTESA: t("agente.statoIN_ATTESA"),
    FATTA: t("agente.statoFATTA"),
    FALLITA: t("agente.statoFALLITA"),
    INTERROTTA: t("agente.statoINTERROTTA"),
  };

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
      <AgentActivityList
        testIdPrefix="agente-attivita"
        labels={{
          title: t("agente.attivitaTitolo"),
          empty: t("agente.attivitaVuota"),
          resume: t("agente.riprendi"),
          newConversation: t("agente.nuovaConversazione"),
          statusLabels: stati,
        }}
        items={agent.conversations.map((c) => ({
          id: c.id,
          title: c.title,
          status: c.lastActivityStatus,
          updatedText: t("agente.aggiornata", { quando: quando(c.updatedAt) }),
        }))}
        selectedId={agent.conversationId}
        onSelect={(id) => void agent.resume(id)}
        onNew={agent.startNew}
      />
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
          rejectReasonLabel: t("agente.rejectReasonLabel"),
          rejectConfirm: t("agente.rejectConfirm"),
          approvalExpires: t("agente.approvalExpires"),
        }}
        requireRejectReason
        prompt={prompt}
        onPromptChange={setPrompt}
        running={agent.running}
        // Il gateway non vede la pagina, vede ciò che le si dice: dove si trova, che cosa mostra e
        // quali comandi della vista accetta, letti al momento dell'invio. Il mandato resta la sola
        // parola della persona.
        onRun={() => {
          const v = vistaAttuale();
          percorsoInvio.current = pathname;
          void agent.run(prompt, {
            percorso: pathname,
            titolo: contesto,
            ...(v ? { vista: v.vista, comandi: v.comandi } : { comandi: [] }),
          });
        }}
        onStop={agent.stop}
        lines={agent.lines}
        approval={
          agent.approval === null
            ? null
            : {
                ...agent.approval,
                ...(agent.approval.expiresAt ? { expiresText: quando(agent.approval.expiresAt) } : {}),
              }
        }
        onApproval={(decision, reason) => void agent.resolveApproval(decision, reason)}
        notice={agent.notice === null || testoAvviso === null ? null : { kind: agent.notice.kind, text: testoAvviso }}
      />
    </section>
  );
}
