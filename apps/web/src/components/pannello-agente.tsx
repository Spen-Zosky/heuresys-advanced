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
 *
 * Dal blocco I2 del piano dell'assistente nelle interfacce (logiche L1, L2, L9, riprese da
 * mod-platform): un simbolo fisso in un angolo (`AgentLauncher`, con il puntino quando c'è un
 * lavoro in corso) apre una finestra sopra la pagina (`AgentWindow`, @heuresys/ui 1.4.0) con le
 * attività a sinistra, la conversazione al centro e a destra ciò che l'attività ha toccato
 * (`lib/agente/lato-finestra.ts`). Il componente resta montato su ogni pagina a flag acceso,
 * così cambiare pagina o chiudere la finestra non interrompe lo stream; il simbolo si mostra
 * sulle pagine idonee e, altrove, solo mentre la finestra è aperta o un lavoro è in corso.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AgentActivityList, AgentLauncher, AgentPanel, AgentWindow, type AgentActivityStatus } from "@heuresys/ui";
import { AGENT_DEV_ENABLED, useAgentStream } from "@/lib/use-agent-stream";
import { paginaIdonea } from "@/lib/agente/idoneita";
import { titoloLeggibile } from "@/lib/agente/risposta";
import { useContestoDichiarato, useVistaAttuale } from "@/lib/agente/contesto";
import { latoDellaFinestra, latoVuoto, type LatoDellaFinestra } from "@/lib/agente/lato-finestra";

export function PannelloAgente() {
  const pathname = usePathname() ?? "";
  if (!AGENT_DEV_ENABLED) return null;
  return <PannelloAgenteAcceso pathname={pathname} idonea={paginaIdonea(pathname) !== null} />;
}

function PannelloAgenteAcceso({ pathname, idonea }: { pathname: string; idonea: boolean }) {
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
  const [attivitaCompresse, setAttivitaCompresse] = useState(false);
  const chiudi = useCallback(() => setAperto(false), []);
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

  const strumentoInAttesa = agent.approval === null ? null : typeof agent.approval.tool === "string" ? agent.approval.tool : t("agente.approvalTitle");
  const lato = latoDellaFinestra(agent.lines, strumentoInAttesa);
  const occupato = agent.running || agent.approval !== null;

  // Il simbolo si mostra sulle pagine idonee; su un'altra pagina resta solo se la finestra è
  // aperta o c'è un lavoro in corso, così cambiare pagina non spegne niente (L1).
  const mostraSimbolo = idonea || aperto || occupato;

  return (
    <>
      {mostraSimbolo && (
        <AgentLauncher
          testIdPrefix="agente"
          label={t("agente.title")}
          busyLabel={t("agente.inCorso")}
          open={aperto}
          busy={occupato}
          onToggle={() => {
            // Sul telefono la colonna delle attività copre la conversazione: si apre compressa,
            // così il campo della domanda è subito raggiungibile (prova dal vivo del 2026-11-12).
            if (!aperto && typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches)
              setAttivitaCompresse(true);
            setAperto((a) => !a);
          }}
        />
      )}
      <AgentWindow
        testIdPrefix="agente"
        open={aperto}
        onClose={chiudi}
        labels={{
          title: t("agente.title"),
          close: t("agente.chiudi"),
          toggleAside: t("agente.comprimiAttivita"),
          sideTitle: t("agente.latoTitolo"),
        }}
        asideCollapsed={attivitaCompresse}
        onToggleAside={() => setAttivitaCompresse((c) => !c)}
        aside={
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
              title: titoloLeggibile(c.title),
              status: c.lastActivityStatus,
              updatedText: t("agente.aggiornata", { quando: quando(c.updatedAt) }),
            }))}
            selectedId={agent.conversationId}
            onSelect={(id) => void agent.resume(id)}
            onNew={agent.startNew}
          />
        }
        side={<LatoFinestra lato={lato} />}
      >
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
      </AgentWindow>
    </>
  );
}

function LatoFinestra({ lato }: { lato: LatoDellaFinestra }) {
  const { t } = useTranslation("common");
  if (latoVuoto(lato)) return <p className="text-xs text-muted-foreground" data-testid="agente-lato-vuoto">{t("agente.latoVuoto")}</p>;
  return (
    <div className="space-y-3 text-xs" data-testid="agente-lato">
      {lato.proposta !== null && (
        <section>
          <h3 className="mb-1 font-semibold">{t("agente.latoProposta")}</h3>
          <p data-testid="agente-lato-proposta">{lato.proposta}</p>
        </section>
      )}
      {lato.comandi.length > 0 && (
        <section>
          <h3 className="mb-1 font-semibold">{t("agente.latoPagina")}</h3>
          <ul className="space-y-1" data-testid="agente-lato-comandi">
            {lato.comandi.map((c, i) => (
              <li key={i}>
                <span className="font-medium">{c.nome}</span> ({c.esito}){c.dettaglio ? `: ${c.dettaglio}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
      {lato.letture.length > 0 && (
        <section>
          <h3 className="mb-1 font-semibold">{t("agente.latoLetture")}</h3>
          <ul className="space-y-1" data-testid="agente-lato-letture">
            {lato.letture.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
