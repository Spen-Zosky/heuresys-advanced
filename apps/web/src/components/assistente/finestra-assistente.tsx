"use client";

/**
 * apps/web/src/components/assistente/finestra-assistente.tsx — la finestra dell'assistente, rifatta
 * come una chat di Claude Desktop (richiesta di Enzo del 2026-11-18). Prende il posto di
 * `components/pannello-agente.tsx` nel layout autenticato.
 *
 * Che cosa c'è: un simbolo fisso apre una finestra ampia, allargabile trascinando il bordo sinistro e
 * ingrandibile a tutto schermo; a sinistra le conversazioni salvate; in testa «Nuova conversazione»;
 * al centro la conversazione intera (le domande della persona e le risposte in Markdown, con tabelle,
 * blocchi e diagrammi che si aprono nell'ispettore, una finestra modale ridimensionabile); in fondo il
 * campo della domanda. Che cosa non c'è più: i nomi degli strumenti, le «letture», gli identificativi
 * e ogni altro dettaglio tecnico. Mentre l'assistente lavora si vede un'attesa animata (regola delle
 * attese che bloccano, `.claude/rules/attese-bloccanti.md`).
 *
 * Il canale resta `useAgentStream`; i messaggi li ricava `lib/agente/messaggi.ts`, funzione pura
 * provata. Il componente è di questa applicazione (conversazioni dell'API, comandi della pagina,
 * contesto) e compone primitive di @heuresys/ui. Dietro il flag `NEXT_PUBLIC_ENABLE_AGENT_DEV`.
 */
import { formati } from "@/lib/format";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { History, Lock, Maximize2, Minimize2, PanelLeftClose, SendHorizontal, Square, SquarePen, X } from "lucide-react";
import { AgentLauncher, AgentSymbol, Button, type AgentActivityStatus } from "@heuresys/ui";
import { AGENT_DEV_ENABLED, useAgentStream, type PendingApproval } from "@/lib/use-agent-stream";
import { paginaIdonea } from "@/lib/agente/idoneita";
import { titoloLeggibile } from "@/lib/agente/risposta";
import {
  CONCETTI_CON_SCHEDA,
  fase,
  messaggiDaRighe,
  nomeLeggibile,
  riepilogoProposta,
  type Messaggio,
  type RiepilogoProposta,
} from "@/lib/agente/messaggi";
import { apiFetch } from "@/lib/api/fetch";
import { useContestoDichiarato, useVistaAttuale } from "@/lib/agente/contesto";
import { LavoroInCorso } from "@/components/lavoro-in-corso";
import { IspettoreAssistente, type ContenutoIspezionabile } from "./ispettore-assistente";
import { RispostaAssistente } from "./risposta-assistente";

const LARGHEZZA_DEFAULT = 880;
const LARGHEZZA_MINIMA = 420;
const CHIAVE_LARGHEZZA = "heuresys.assistente.larghezza";

function larghezzaSalvata(): number {
  try {
    const v = Number(window.localStorage.getItem(CHIAVE_LARGHEZZA));
    return Number.isFinite(v) && v >= LARGHEZZA_MINIMA ? v : LARGHEZZA_DEFAULT;
  } catch {
    return LARGHEZZA_DEFAULT;
  }
}

const schermoLargo = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

export function PannelloAgente() {
  const pathname = usePathname() ?? "";
  if (!AGENT_DEV_ENABLED) return null;
  return <FinestraAssistente pathname={pathname} idonea={paginaIdonea(pathname) !== null} />;
}

function FinestraAssistente({ pathname, idonea }: { pathname: string; idonea: boolean }) {
  const { t, i18n } = useTranslation("common");
  const dichiarato = useContestoDichiarato();
  const vistaAttuale = useVistaAttuale();
  // La pagina da cui è partita la richiesta, e quella aperta ora: un comando arrivato dopo un cambio
  // di pagina non si applica alla pagina nuova.
  const percorsoInvio = useRef<string | null>(null);
  const percorsoOra = useRef(pathname);
  useEffect(() => {
    percorsoOra.current = pathname;
  }, [pathname]);
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
  const [cronologia, setCronologia] = useState(true);
  const [grande, setGrande] = useState(false);
  const [larghezza, setLarghezza] = useState(LARGHEZZA_DEFAULT);
  const [prompt, setPrompt] = useState("");
  const [ispeziona, setIspeziona] = useState<ContenutoIspezionabile | null>(null);
  const { refreshConversations, running } = agent;

  // Le conversazioni si rileggono a ogni apertura e a fine giro: il lavoro continua anche a finestra
  // chiusa, e la conversazione appena fatta compare subito fra quelle salvate.
  useEffect(() => {
    if (aperto && !running) void refreshConversations();
  }, [aperto, running, refreshConversations]);

  const quando = (iso: string) => formati(i18n.language).dataOra(iso);
  const stati: Record<AgentActivityStatus, string> = {
    IN_CORSO: t("agente.statoIN_CORSO"),
    IN_ATTESA: t("agente.statoIN_ATTESA"),
    FATTA: t("agente.statoFATTA"),
    FALLITA: t("agente.statoFALLITA"),
    INTERROTTA: t("agente.statoINTERROTTA"),
  };

  // Il nome della pagina in parole (C7, giro qa-web 18/11, come in pannello-agente.tsx): il titolo
  // della finestra del browser è sempre «Heuresys» e l'indirizzo può portare un UUID. Si legge
  // l'intestazione principale; senza, «Pagina corrente». L'indirizzo parte comunque al gateway.
  const titoloPagina = typeof document === "undefined" ? "" : (document.querySelector("main h1")?.textContent ?? "").trim();
  const contesto = dichiarato ?? (titoloPagina ? t("agente.contestoPagina", { titolo: titoloPagina }) : t("agente.contestoPaginaSenzaNome"));
  const occupato = agent.running || agent.approval !== null;
  const mostraSimbolo = idonea || aperto || occupato;
  const messaggi = messaggiDaRighe(agent.lines);
  const faseOra = fase(agent.lines);
  const testoAvviso = agent.notice === null ? null : t(`agente.${agent.notice.code}`, agent.notice.params ?? {});

  const invia = (testo: string) => {
    const domanda = testo.trim();
    if (!domanda || agent.running) return;
    const v = vistaAttuale();
    percorsoInvio.current = pathname;
    setPrompt("");
    void agent.run(domanda, {
      percorso: pathname,
      titolo: contesto,
      ...(v ? { vista: v.vista, comandi: v.comandi } : { comandi: [] }),
    });
  };

  // Il fondo della conversazione resta in vista mentre arrivano le risposte e mentre tabelle e
  // diagrammi finiscono di disegnarsi, a meno che la persona non sia risalita a leggere.
  const scorrimento = useRef<HTMLDivElement>(null);
  const contenuto = useRef<HTMLDivElement>(null);
  const inFondo = useRef(true);
  /** Vero quando lo scorrimento l'ha fatto il codice: non dice niente su dove vuole stare la persona. */
  const daCodice = useRef(false);
  useEffect(() => {
    inFondo.current = true;
  }, [aperto, agent.lines.length]);
  useEffect(() => {
    const s = scorrimento.current;
    const c = contenuto.current;
    if (!s || !c) return;
    const giu = () => {
      if (!inFondo.current) return;
      daCodice.current = true;
      s.scrollTop = s.scrollHeight;
    };
    giu();
    const osserva = new ResizeObserver(giu);
    osserva.observe(c);
    return () => osserva.disconnect();
  }, [aperto, agent.lines.length, agent.approval, agent.running]);

  // Il bordo sinistro si trascina per allargare la finestra; la misura resta nel browser.
  const trascina = useRef<{ x: number; w: number } | null>(null);
  const iniziaTrascina = (e: React.PointerEvent<HTMLDivElement>) => {
    trascina.current = { x: e.clientX, w: larghezza };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const muovi = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!trascina.current) return;
    const max = window.innerWidth - 32;
    setLarghezza(Math.min(max, Math.max(LARGHEZZA_MINIMA, trascina.current.w + (trascina.current.x - e.clientX))));
  };
  const fineTrascina = () => {
    if (!trascina.current) return;
    trascina.current = null;
    try {
      window.localStorage.setItem(CHIAVE_LARGHEZZA, String(Math.round(larghezza)));
    } catch {
      /* senza memoria del browser la larghezza vale solo per questa visita */
    }
  };

  const apriChiudi = () => {
    if (!aperto) {
      setLarghezza(larghezzaSalvata());
      // Sul telefono la cronologia coprirebbe la conversazione: si apre chiusa.
      setCronologia(schermoLargo());
    }
    setAperto((a) => !a);
  };

  return (
    <>
      {mostraSimbolo && (
        <AgentLauncher
          testIdPrefix="agente"
          label={t("agente.title")}
          busyLabel={t("agente.inCorso")}
          open={aperto}
          busy={occupato}
          onToggle={apriChiudi}
        />
      )}
      {aperto && (
        <section
          role="dialog"
          aria-labelledby="agente-titolo"
          data-testid="agente-window"
          onKeyDown={(e) => {
            if (e.key === "Escape" && ispeziona === null) setAperto(false);
          }}
          className={
            grande
              ? "fixed inset-2 z-40 flex flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl sm:inset-4"
              : "fixed inset-0 z-40 flex flex-col overflow-hidden border border-border bg-background shadow-2xl sm:inset-auto sm:bottom-4 sm:right-4 sm:top-4 sm:w-[var(--larghezza)] sm:max-w-[calc(100vw-2rem)] sm:rounded-xl"
          }
          style={{ "--larghezza": `${larghezza}px` } as React.CSSProperties}
        >
          {!grande && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={t("agente.ridimensiona")}
              title={t("agente.ridimensiona")}
              data-testid="agente-bordo"
              onPointerDown={iniziaTrascina}
              onPointerMove={muovi}
              onPointerUp={fineTrascina}
              className="absolute inset-y-0 left-0 z-20 hidden w-1.5 cursor-ew-resize hover:bg-primary/30 sm:block"
            />
          )}
          <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <IconButton
                etichetta={cronologia ? t("agente.nascondiCronologia") : t("agente.mostraCronologia")}
                testId="agente-cronologia-toggle"
                onClick={() => setCronologia((c) => !c)}
              >
                {cronologia ? <PanelLeftClose className="h-4 w-4" aria-hidden /> : <History className="h-4 w-4" aria-hidden />}
              </IconButton>
              <AgentSymbol className="h-5 w-5 shrink-0" />
              <h2 id="agente-titolo" data-testid="agente-title" className="break-words text-sm font-semibold">
                {t("agente.nome")}
              </h2>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={agent.startNew}
                disabled={agent.running}
                data-testid="agente-nuova"
                className="h-9 gap-1.5 px-2.5"
              >
                <SquarePen className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">{t("agente.nuovaConversazione")}</span>
              </Button>
              <IconButton
                etichetta={grande ? t("agente.riduci") : t("agente.massimizza")}
                testId="agente-massimizza"
                onClick={() => setGrande((g) => !g)}
                soloSchermoLargo
              >
                {grande ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
              </IconButton>
              <IconButton etichetta={t("agente.chiudi")} testId="agente-window-close" onClick={() => setAperto(false)}>
                <X className="h-4 w-4" aria-hidden />
              </IconButton>
            </div>
          </header>

          <div className="relative flex min-h-0 flex-1">
            {cronologia && (
              <nav
                aria-label={t("agente.cronologia")}
                data-testid="agente-attivita-list"
                className="absolute inset-y-0 left-0 z-10 flex w-72 max-w-[85%] shrink-0 flex-col border-r border-border bg-background lg:static lg:max-w-none lg:bg-muted/30"
              >
                <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("agente.cronologia")}</p>
                <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
                  {agent.conversations.length === 0 && <li className="px-2 py-2 text-xs text-muted-foreground">{t("agente.attivitaVuota")}</li>}
                  {agent.conversations.map((c) => {
                    const scelta = c.id === agent.conversationId;
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          data-testid="agente-attivita-voce"
                          aria-current={scelta ? "true" : undefined}
                          disabled={agent.running}
                          onClick={() => {
                            void agent.resume(c.id);
                            if (!schermoLargo()) setCronologia(false);
                          }}
                          className={`w-full rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted disabled:opacity-60 ${scelta ? "bg-muted font-medium" : ""}`}
                        >
                          <span className="break-words">{titoloLeggibile(c.title)}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {c.lastActivityStatus ? `${stati[c.lastActivityStatus]} · ` : ""}
                            {quando(c.updatedAt)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            )}

            <div data-testid="agente-page" className="flex min-w-0 flex-1 flex-col">
              <p data-testid="agente-context" className="break-words border-b border-border px-4 py-1.5 text-xs text-muted-foreground" title={contesto}>
                {contesto}
              </p>
              <div
                ref={scorrimento}
                onScroll={(e) => {
                  if (daCodice.current) {
                    daCodice.current = false;
                    return;
                  }
                  const s = e.currentTarget;
                  inFondo.current = s.scrollHeight - s.scrollTop - s.clientHeight < 48;
                }}
                className="min-h-0 flex-1 overflow-y-auto"
                aria-live="polite"
              >
                <div ref={contenuto} className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-5">
                  {messaggi.length === 0 && !agent.running && <Vuoto onScegli={setPrompt} />}
                  {messaggi.map((m) => (
                    <Bolla key={m.id} m={m} onApri={setIspeziona} />
                  ))}
                  <LavoroInCorso
                    attivo={agent.running && agent.approval === null}
                    titolo={t(faseOra === "consulta" ? "agente.faseConsulta" : faseOra === "scrive" ? "agente.faseScrive" : "agente.fasePensa")}
                    dettaglio={t("agente.faseDettaglio")}
                  />
                  {agent.approval && (
                    <Approvazione
                      approval={agent.approval}
                      scade={agent.approval.expiresAt ? quando(agent.approval.expiresAt) : null}
                      onDecidi={(d, motivo) => void agent.resolveApproval(d, motivo)}
                    />
                  )}
                  {agent.notice && testoAvviso && (
                    <p
                      role={agent.notice.kind === "err" ? "alert" : "status"}
                      data-testid={`agente-notice-${agent.notice.kind}`}
                      className={`rounded-md px-3 py-2 text-sm ${agent.notice.kind === "err" ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground"}`}
                    >
                      {testoAvviso}
                    </p>
                  )}
                </div>
              </div>
              <Composer prompt={prompt} onPrompt={setPrompt} running={agent.running} onInvia={() => invia(prompt)} onFerma={agent.stop} />
            </div>
          </div>
        </section>
      )}
      <IspettoreAssistente contenuto={ispeziona} onChiudi={() => setIspeziona(null)} />
    </>
  );
}

function IconButton({
  etichetta,
  testId,
  onClick,
  soloSchermoLargo,
  children,
}: {
  etichetta: string;
  testId: string;
  onClick: () => void;
  /** Nascosto sul telefono, dove la finestra occupa già tutto lo schermo. */
  soloSchermoLargo?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={etichetta}
      title={etichetta}
      data-testid={testId}
      onClick={onClick}
      className={`${soloSchermoLargo ? "hidden sm:inline-flex" : "inline-flex"} h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
    >
      {children}
    </button>
  );
}

function Vuoto({ onScegli }: { onScegli: (s: string) => void }) {
  const { t } = useTranslation("common");
  const suggerimenti = [t("agente.suggerimento1"), t("agente.suggerimento2"), t("agente.suggerimento3")];
  return (
    <div data-testid="agente-stream-empty" className="flex flex-col items-center gap-3 py-10 text-center">
      <AgentSymbol className="h-10 w-10 text-primary" />
      <h3 className="text-lg font-semibold">{t("agente.vuotoTitolo")}</h3>
      <p className="max-w-md text-sm text-muted-foreground">{t("agente.vuotoTesto")}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {suggerimenti.map((s) => (
          <button key={s} type="button" onClick={() => onScegli(s)} className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted">
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function Bolla({ m, onApri }: { m: Messaggio; onApri: (c: ContenutoIspezionabile) => void }) {
  const { t } = useTranslation("common");
  if (m.ruolo === "persona") {
    return (
      <div className="flex justify-end" data-testid="agente-domanda">
        <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-muted px-4 py-2 text-sm">{m.testo}</p>
      </div>
    );
  }
  if (m.ruolo === "avviso") {
    return (
      <p className="text-center text-xs text-muted-foreground" data-testid="agente-avviso">
        {m.testo === "limite" ? t("agente.avvisoLimite") : t("agente.avvisoErrore")}
      </p>
    );
  }
  if (m.rifiuto) {
    return (
      <div data-testid="agente-stream-line">
        <div data-testid="agente-rifiuto" className="flex gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <p className="font-semibold">{t("agente.rifiutoTitolo")}</p>
            <p>{m.testo}</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div data-testid="agente-stream-line" className="flex gap-3">
      <AgentSymbol className="mt-1 h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1 text-sm">
        <RispostaAssistente testo={m.testo} onApri={onApri} />
      </div>
    </div>
  );
}

function Approvazione({
  approval,
  scade,
  onDecidi,
}: {
  approval: PendingApproval;
  scade: string | null;
  onDecidi: (d: "allow" | "deny", motivo?: string) => void;
}) {
  const { t } = useTranslation("common");
  const [rifiuto, setRifiuto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const descrizione =
    approval.classe === "read"
      ? approval.personeDistinte === undefined
        ? t("agente.approvazioneLetturaSenzaNumero")
        : t("agente.approvazioneLettura", { persone: approval.personeDistinte })
      : t("agente.approvazioneScrittura");
  // Una scrittura si conferma sapendo quale: l'azione, l'oggetto e i campi che cambia.
  const riepilogo = useMemo(
    () => (approval.classe === "read" ? null : riepilogoProposta(approval.tool, approval.input)),
    [approval.classe, approval.tool, approval.input],
  );
  return (
    <div data-testid="agente-approval" className="rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 text-sm">
      <p className="font-semibold">{t("agente.approvazioneTitolo")}</p>
      <p className="mt-1">{descrizione}</p>
      {riepilogo && <RiepilogoScrittura riepilogo={riepilogo} />}
      {scade && (
        <p className="mt-1 text-xs text-muted-foreground">
          {t("agente.approvalExpires")} {scade}
        </p>
      )}
      {rifiuto ? (
        <div className="mt-3 flex flex-col gap-2">
          <label className="text-xs font-medium" htmlFor="agente-motivo">
            {t("agente.rejectReasonLabel")}
          </label>
          <textarea
            id="agente-motivo"
            data-testid="agente-reject-reason"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" disabled={!motivo.trim()} onClick={() => onDecidi("deny", motivo.trim())} data-testid="agente-reject-confirm">
              {t("agente.rejectConfirm")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRifiuto(false)}>
              {t("agente.riduci")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={() => onDecidi("allow")} data-testid="agente-allow">
            {t("agente.allow")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setRifiuto(true)} data-testid="agente-deny">
            {t("agente.deny")}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Il riepilogo di una scrittura nella lingua della persona (prova dal vivo di F1, 2026-11-26): il
 * nome dell'oggetto e degli oggetti collegati al posto degli identificativi, le etichette dei campi
 * al posto dei nomi del contratto. Un nome che non si legge (oggetto fuori perimetro, scheda che
 * non risponde) diventa «un elemento collegato», mai l'identificativo.
 */
function RiepilogoScrittura({ riepilogo }: { riepilogo: RiepilogoProposta }) {
  const { t } = useTranslation("common");
  const [nomi, setNomi] = useState<Record<string, string | null>>({});
  useEffect(() => {
    const daLeggere: Array<[string, string]> = [];
    if (riepilogo.concetto && riepilogo.id) daLeggere.push([riepilogo.concetto, riepilogo.id]);
    for (const c of riepilogo.campi) if (c.riferimento && c.identificativo && !c.valore.startsWith("[")) daLeggere.push([c.riferimento, c.valore]);
    const ctrl = new AbortController();
    for (const [concetto, id] of daLeggere) {
      if (!CONCETTI_CON_SCHEDA.has(concetto)) continue;
      const chiave = `${concetto}/${id}`;
      apiFetch<unknown>(`/v1/${concetto}/${encodeURIComponent(id)}`, { signal: ctrl.signal })
        .then((r) => setNomi((n) => ({ ...n, [chiave]: nomeLeggibile(r) })))
        .catch(() => setNomi((n) => ({ ...n, [chiave]: null })));
    }
    return () => ctrl.abort();
  }, [riepilogo]);
  const collegato = t("agente.elementoCollegato");
  const nomeDi = (concetto: string | undefined, id: string) => (concetto ? nomi[`${concetto}/${id}`] : null) ?? collegato;
  const oggetto = riepilogo.concetto
    ? t(`agente.concetti.${riepilogo.concetto}`, { defaultValue: t("agente.oggettoGenerico") })
    : t("agente.oggettoGenerico");
  const valore = (c: RiepilogoProposta["campi"][number]) => {
    if (c.identificativo) {
      if (c.valore.startsWith("[")) {
        try {
          return (JSON.parse(c.valore) as string[]).map(() => collegato).join(", ");
        } catch {
          return collegato;
        }
      }
      return nomeDi(c.riferimento, c.valore);
    }
    if (c.valore === "true") return t("agente.valoreSi");
    if (c.valore === "false") return t("agente.valoreNo");
    if (c.valore === "" || c.valore === "null") return t("agente.valoreVuoto");
    return c.valore;
  };
  return (
    <div data-testid="agente-approval-riepilogo" className="mt-2 rounded-md border border-border bg-background px-3 py-2">
      <p className="font-medium">
        {t(`agente.azione_${riepilogo.azione}`)}: {oggetto}
        {riepilogo.id && <span data-testid="agente-approval-oggetto"> — {nomeDi(riepilogo.concetto ?? undefined, riepilogo.id)}</span>}
      </p>
      {riepilogo.campi.length > 0 && (
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
          {riepilogo.campi.map((c, i) => (
            <div key={i} className="contents">
              <dt className="text-muted-foreground">{t(`agente.campi.${c.campo}`, { defaultValue: t("agente.campoAltro") })}</dt>
              <dd className="break-words">{valore(c)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function Composer({
  prompt,
  onPrompt,
  running,
  onInvia,
  onFerma,
}: {
  prompt: string;
  onPrompt: (s: string) => void;
  running: boolean;
  onInvia: () => void;
  onFerma: () => void;
}) {
  const { t } = useTranslation("common");
  const area = useRef<HTMLTextAreaElement>(null);
  // Il campo cresce con il testo, fino a otto righe circa.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [prompt]);
  const tasto = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        onInvia();
      }
    },
    [onInvia],
  );
  return (
    <div className="border-t border-border bg-background px-4 pb-3 pt-3">
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-border bg-background px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-ring">
        <label htmlFor="agente-prompt" className="sr-only">
          {t("agente.domanda")}
        </label>
        <textarea
          ref={area}
          id="agente-prompt"
          data-testid="agente-prompt"
          value={prompt}
          onChange={(e) => onPrompt(e.target.value)}
          onKeyDown={tasto}
          rows={1}
          placeholder={t("agente.domandaSegnaposto")}
          className="max-h-[200px] min-h-[24px] flex-1 resize-none bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
        />
        {running ? (
          <button
            type="button"
            onClick={onFerma}
            aria-label={t("agente.ferma")}
            title={t("agente.ferma")}
            data-testid="agente-stop"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background hover:opacity-90"
          >
            <Square className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={onInvia}
            disabled={!prompt.trim()}
            aria-label={t("agente.invia")}
            title={t("agente.invia")}
            data-testid="agente-run"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-fg hover:bg-primary/90 disabled:opacity-40"
          >
            <SendHorizontal className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
      <p className="mx-auto mt-1 max-w-3xl text-center text-xs text-muted-foreground">{t("agente.aiutoInvio")}</p>
    </div>
  );
}
