"use client";

/**
 * apps/web/src/lib/use-agent-stream.ts — #159 F2, la metà di QUESTO repo.
 *
 * Il canale verso l'agent-gateway (#9 WI-B.2): apre lo stream SSE, ne interpreta i
 * blocchi, tiene lo stato della corsa e risolve le approvazioni umane. È **logica
 * applicativa, non design system**, e per questo vive qui: il rilievo S1083 su `#159`
 * ha nominato il rischio di scrivere il ponte come «componente riusabile» dentro
 * `apps/web`, che è ciò che il divieto permanente del progetto vieta. Il ponte è
 * quindi spezzato in due, e le due metà stanno in repo diversi:
 *
 *   · il CANALE (questo file) → resta qui, accanto a `use-inbox-stream.ts`, che è già
 *     il precedente per uno stream applicativo;
 *   · il COMPONENTE, la superficie visiva riusabile su ogni pagina idonea → va in
 *     `ux-design-shared` e torna come `@heuresys/ui`. Non è in questo file e non
 *     dev'esserci.
 *
 * ⭐ LA COSA CHE LO RENDE RIUSABILE, e che nella pagina non c'era: l'hook **non
 * traduce**. Restituisce un `code` i18n con i suoi parametri, e chi lo monta decide
 * in quale namespace tradurlo. Nella console di sviluppo i messaggi erano costruiti
 * con `t("agentDev.…")` dentro la logica: un secondo consumatore avrebbe ereditato
 * le stringhe della PRIMA pagina, ed è esattamente il difetto che `#159` è venuta a
 * togliere — «il ponte deve valere per le pagine future, non per la prima».
 *
 * Il gateway REDIGE già `tool` e `input` prima di emetterli (`server.ts`:
 * `redact(tool)` / `redact(input)`), quindi qui non transita mai un dato in chiaro.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentConversationSummary } from "@heuresys/shared/schemas/agent-conversations";
import { csrfStore } from "./api/csrf-store";
import { MAX_RIGA, domandaDaPrompt, righeDaMessaggio } from "./agente/risposta";
import {
  elencoConversazioni,
  leggiAttivita,
  leggiConversazione,
  propostaDaDecidere,
  ultimaAttivita,
} from "./agente/conversazioni";

/** Acceso a build-time. I NOMI delle chiavi, mai i valori (R10). */
export const AGENT_DEV_ENABLED = process.env.NEXT_PUBLIC_ENABLE_AGENT_DEV === "1";
const GATEWAY_URL = (
  process.env.NEXT_PUBLIC_AGENT_GATEWAY_URL ?? "http://localhost:8790"
).replace(/\/$/, "");

/** Un'approvazione in attesa, emersa da un evento `approval_required`. */
export interface PendingApproval {
  approvalId: string;
  /** Già redatto dal gateway. */
  tool: unknown;
  /** Già redatto dal gateway. */
  input: unknown;
  /**
   * #252 — PERCHÉ si sta chiedendo. `write` è il caso di sempre; `read` esiste da `#252`:
   * la conversazione ha superato la soglia alta di persone distinte, e la lettura si è fermata.
   * ⚠ Assenti sui gateway che non portano ancora i tre campi: chi li mostra deve reggere
   * `undefined` invece di stampare «0 persone», che sarebbe un'affermazione falsa.
   */
  classe?: "read" | "write" | "unresolved";
  /** Quante persone distinte la conversazione aveva toccato quando si è chiesto. */
  personeDistinte?: number;
  /** Il livello di quel numero: `silenzioso` · `dichiarato` · `confermato` · `non-misurato`. */
  livello?: string;
  /** ADR-0056 D4: fin quando si può decidere (ISO). Dopo, il giro l'ha già negata. */
  expiresAt?: string;
}

/** Una riga dello stream (blocco SSE grezzo, con un tetto). */
export interface StreamLine {
  id: number;
  /** Il nome dell'`event:` quando c'è (`approval_required` / `error` / `done`), altrimenti `message`. */
  kind: string;
  text: string;
}

/**
 * Un avviso, NON tradotto. `code` è la chiave i18n **senza namespace**: chi monta
 * l'hook la prefissa col proprio. È questa la differenza fra un canale riusabile e
 * uno legato alla pagina che l'ha visto nascere per primo.
 */
export interface AgentNotice {
  kind: "ok" | "err";
  code:
    | "approvalResolved"
    | "noSession"
    | "errorRun"
    // ADR-0056 D4 (T6c): scartare chiede un motivo; una decisione arrivata tardi non si registra;
    // una conversazione con un giro aperto non si riprende due volte; una che non c'è non si apre.
    | "reasonRequired"
    | "approvalNotRecorded"
    | "conversationBusy"
    | "conversationNotFound";
  params?: Record<string, string>;
}

/**
 * Interpreta il `data:` di un evento `approval_required`. `null` se non è una richiesta
 * utilizzabile (JSON rotto, o senza `approvalId`: senza quello non c'è niente da risolvere).
 *
 * ⭐ FUORI DALL'HOOK PERCHÉ DEVE ESSERE PROVABILE (#252). Il filtro sui tre campi nuovi è la
 * parte che può sbagliare in silenzio, e dentro una `useCallback` si proverebbe solo montando
 * un componente. Qui è una funzione pura con i suoi casi limite.
 *
 * ⚠ I tre campi si accettano SOLO nella forma attesa. Un `personeDistinte: "molte"` non deve
 * arrivare al pannello come numero, e **assente non è zero**: chi non dichiara il numero fa dire
 * al pannello «non risulta misurato», non «0 persone».
 */
export function parseApprovalPayload(data: string): PendingApproval | null {
  let parsed: {
    approvalId?: unknown;
    tool?: unknown;
    input?: unknown;
    classe?: unknown;
    personeDistinte?: unknown;
    livello?: unknown;
    expiresAt?: unknown;
  };
  try {
    parsed = JSON.parse(data) as typeof parsed;
  } catch {
    return null; // payload malformato: si ignora, la riga resta nello stream
  }
  if (typeof parsed.approvalId !== "string" || !parsed.approvalId) return null;
  return {
    approvalId: parsed.approvalId,
    tool: parsed.tool,
    input: parsed.input,
    ...(parsed.classe === "read" || parsed.classe === "write" || parsed.classe === "unresolved"
      ? { classe: parsed.classe }
      : {}),
    ...(typeof parsed.personeDistinte === "number" && Number.isFinite(parsed.personeDistinte)
      ? { personeDistinte: parsed.personeDistinte }
      : {}),
    ...(typeof parsed.livello === "string" ? { livello: parsed.livello } : {}),
    ...(typeof parsed.expiresAt === "string" && !Number.isNaN(Date.parse(parsed.expiresAt))
      ? { expiresAt: parsed.expiresAt }
      : {}),
  };
}

/**
 * ADR-0056 D4 (T6c): l'evento `conversation` con cui il gateway dice in quale conversazione e
 * attività sta scrivendo. `null` se non ha la forma attesa: senza identificativo non c'è niente
 * da riprendere.
 */
export function parseConversationPayload(data: string): { conversationId: string; activityId: string } | null {
  try {
    const p = JSON.parse(data) as { conversationId?: unknown; activityId?: unknown };
    return typeof p.conversationId === "string" && p.conversationId && typeof p.activityId === "string" && p.activityId
      ? { conversationId: p.conversationId, activityId: p.activityId }
      : null;
  } catch {
    return null;
  }
}

/** Come si mostra nello stream un evento salvato (`TESTO`, `STRUMENTO`…), riletto dall'API. */
export function lineaDaEvento(e: { kind: string; payload: Record<string, unknown> }): { kind: string; text: string } {
  const p = e.payload;
  switch (e.kind) {
    case "TESTO":
      return { kind: "message", text: typeof p.testo === "string" ? p.testo : "" };
    case "STRUMENTO":
      return { kind: "tool", text: typeof p.strumento === "string" ? p.strumento : "" };
    case "PROPOSTA":
      return { kind: "approval_required", text: typeof p.strumento === "string" ? p.strumento : "" };
    case "LIMITE":
      return { kind: "limit", text: typeof p.limite === "string" ? p.limite : "" };
    case "ERRORE":
      return { kind: "error", text: typeof p.messaggio === "string" ? p.messaggio : "" };
    case "FINE":
      return { kind: "done", text: typeof p.risultato === "string" ? p.risultato : "" };
    default:
      return { kind: e.kind.toLowerCase(), text: JSON.stringify(p) };
  }
}

/** Interpreta un blocco SSE («event: x\n data: {...}») in tipo + testo. */
export function parseSseBlock(block: string): { kind: string; data: string } {
  let kind = "message";
  const dataParts: string[] = [];
  for (const raw of block.split("\n")) {
    const line = raw.trimEnd();
    if (line.startsWith("event:")) kind = line.slice("event:".length).trim();
    else if (line.startsWith("data:")) dataParts.push(line.slice("data:".length).trim());
  }
  return { kind, data: dataParts.join("\n") };
}

export interface UseAgentStream {
  running: boolean;
  lines: StreamLine[];
  approval: PendingApproval | null;
  notice: AgentNotice | null;
  /**
   * Apre lo stream per questo prompt. Non fa nulla se una corsa è già in volo o il prompt è vuoto.
   * `pagina` è ciò che la pagina aperta dichiara (dove si trova, che cosa mostra, quali comandi
   * della vista accetta): il gateway la passa al modello come dato, non come mandato.
   */
  run: (prompt: string, pagina?: PaginaPerAgente) => Promise<void>;
  /**
   * Smette di ascoltare. Dal 2026-11-08 (ADR-0056 D4) il giro NON si ferma: continua nel gateway
   * fino a un limite, e la finestra lo ritrova riprendendo la conversazione.
   */
  stop: () => void;
  /** Con `deny` il motivo è obbligatorio: l'API lo pretende, e senza resta l'avviso `reasonRequired`. */
  resolveApproval: (decision: "allow" | "deny", reason?: string) => Promise<void>;
  clearNotice: () => void;
  /** La conversazione in cui scrive `run`; `null` = la prossima ne apre una nuova. */
  conversationId: string | null;
  /** Le conversazioni della persona, lette dall'API (`refreshConversations`). */
  conversations: AgentConversationSummary[];
  refreshConversations: () => Promise<void>;
  /** Riprende una conversazione: ricarica ciò che l'ultima attività ha mostrato e la proposta in attesa. */
  resume: (conversationId: string) => Promise<void>;
  /** La prossima richiesta apre una conversazione nuova. */
  startNew: () => void;
}

/** Ciò che la finestra dice al gateway della pagina aperta (`comandi-vista.ts` del gateway). */
export interface PaginaPerAgente {
  percorso: string;
  titolo?: string;
  vista?: Record<string, unknown>;
  comandi: readonly string[];
}

/** L'esito di un comando della vista, come la pagina lo riferisce. */
export interface EsitoComandoPagina {
  stato: "ok" | "parziale" | "rifiutata";
  dettaglio?: string;
}

export interface OpzioniAgentStream {
  /** Esegue un comando della vista sulla pagina aperta. Assente, ogni comando torna «rifiutata». */
  onPageCommand?: (nome: string, argomenti: Record<string, unknown>) => EsitoComandoPagina;
}

/**
 * Interpreta il `data:` di un evento `nota`: la correzione che il gateway mette sotto il testo del
 * modello quando un comando non è avvenuto come raccontato (piano dell'assistente, blocco I4).
 * Si mostra come un messaggio, lo stesso che la finestra riaperta rilegge dal registro.
 */
export function parseNota(data: string): string | null {
  try {
    const p = JSON.parse(data) as { testo?: unknown };
    return typeof p.testo === "string" && p.testo.trim() ? p.testo : null;
  } catch {
    return null;
  }
}

/** Interpreta il `data:` di un evento `page_command`. `null` se non ne ha la forma. */
export function parsePageCommand(data: string): { commandId: string; nome: string; argomenti: Record<string, unknown> } | null {
  try {
    const p = JSON.parse(data) as { commandId?: unknown; nome?: unknown; argomenti?: unknown };
    if (typeof p.commandId !== "string" || !p.commandId || typeof p.nome !== "string") return null;
    const a = p.argomenti;
    return {
      commandId: p.commandId,
      nome: p.nome,
      argomenti: typeof a === "object" && a !== null && !Array.isArray(a) ? (a as Record<string, unknown>) : {},
    };
  } catch {
    return null;
  }
}

export function useAgentStream(opzioni: OpzioniAgentStream = {}): UseAgentStream {
  const comandoRef = useRef(opzioni.onPageCommand);
  useEffect(() => {
    comandoRef.current = opzioni.onPageCommand;
  });
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<StreamLine[]>([]);
  const [approval, setApproval] = useState<PendingApproval | null>(null);
  const [notice, setNotice] = useState<AgentNotice | null>(null);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<AgentConversationSummary[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const lineIdRef = useRef(0);

  const pushLine = useCallback((kind: string, text: string) => {
    lineIdRef.current += 1;
    const id = lineIdRef.current;
    // Tetto sul buffer reso: una corsa lunga non deve gonfiare il DOM.
    setLines((prev) => [...prev.slice(-199), { id, kind, text }]);
  }, []);

  const handleSseBlock = useCallback(
    (block: string) => {
      if (!block.trim()) return;
      const { kind, data } = parseSseBlock(block);
      if (kind === "approval_required") {
        const richiesta = parseApprovalPayload(data);
        if (richiesta) setApproval(richiesta);
      }
      if (kind === "conversation") {
        const c = parseConversationPayload(data);
        if (c) setConversationId(c.conversationId);
      }
      if (kind === "page_command") {
        // Il comando si applica appena arriva, e l'esito vero torna al gateway: l'assistente
        // racconta alla persona ciò che la pagina ha fatto, non ciò che voleva fare.
        const c = parsePageCommand(data);
        if (c) {
          let esito: EsitoComandoPagina;
          try {
            esito = comandoRef.current
              ? comandoRef.current(c.nome, c.argomenti)
              : { stato: "rifiutata", dettaglio: "Questa pagina non accetta comandi della vista." };
          } catch (e) {
            esito = { stato: "rifiutata", dettaglio: e instanceof Error ? e.message : String(e) };
          }
          void fetch(`${GATEWAY_URL}/agent/esiti`, {
            method: "POST",
            headers: { "content-type": "application/json", "x-csrf-token": csrfStore.get() ?? "" },
            credentials: "include",
            body: JSON.stringify({ commandId: c.commandId, ...esito }),
          }).catch(() => undefined);
          pushLine("page_command", `${c.nome} → ${esito.stato}${esito.dettaglio ? `: ${esito.dettaglio}` : ""}`);
          return;
        }
      }
      if (kind === "nota") {
        const testo = parseNota(data);
        if (testo) {
          pushLine("message", testo.replace(/\s+/g, " ").slice(0, 600));
          return;
        }
      }
      if (kind === "message") {
        // Lo stream dell'SDK non si mostra: solo il testo dell'assistente e gli strumenti che usa.
        for (const r of righeDaMessaggio(data)) pushLine(r.kind, r.text);
        return;
      }
      if (kind === "conversation") return; // identificativi tecnici, già in `conversationId`
      pushLine(kind, data.replace(/\s+/g, " ").slice(0, 600));
    },
    [pushLine],
  );

  const resolveApproval = useCallback(
    async (decision: "allow" | "deny", reason?: string) => {
      if (!approval) return;
      const { approvalId } = approval;
      try {
        const res = await fetch(`${GATEWAY_URL}/agent/approve`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            // ADR-0056 D4: il gateway registra la decisione nell'API con la sessione di chi preme,
            // e l'API vuole il token CSRF della finestra (double-submit), mai ricavato altrove.
            "x-csrf-token": csrfStore.get() ?? "",
          },
          credentials: "include",
          body: JSON.stringify({ approvalId, decision, ...(reason ? { reason } : {}) }),
        });
        if (res.status === 422) {
          // Scartare senza motivo: l'approvazione resta lì, la persona scrive il perché.
          setNotice({ kind: "err", code: "reasonRequired" });
          return;
        }
        const corpo = (await res.json().catch(() => ({}))) as { resolved?: unknown };
        setApproval(null);
        if (!res.ok || corpo.resolved !== true) {
          setNotice({ kind: "err", code: "approvalNotRecorded" });
          return;
        }
        setNotice({ kind: "ok", code: "approvalResolved", params: { decision } });
      } catch (err) {
        setNotice({
          kind: "err",
          code: "errorRun",
          params: { message: err instanceof Error ? err.message : String(err) },
        });
      }
    },
    [approval],
  );

  const run = useCallback(
    async (prompt: string, pagina?: PaginaPerAgente) => {
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
          credentials: "include", // inoltra i cookie hrx_access / hrx_csrf al gateway
          body: JSON.stringify({ prompt, ...(conversationId ? { conversationId } : {}), ...(pagina ? { pagina } : {}) }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const detail = await res.text().catch(() => "");
          if (res.status === 401) {
            setNotice({ kind: "err", code: "noSession" });
          } else if (res.status === 409) {
            setNotice({ kind: "err", code: "conversationBusy" });
          } else if (res.status === 404) {
            setNotice({ kind: "err", code: "conversationNotFound" });
          } else {
            setNotice({
              kind: "err",
              code: "errorRun",
              params: { message: `HTTP ${res.status} ${detail}`.trim() },
            });
          }
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        // I frame SSE sono separati da una riga vuota ("\n\n").
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
          // interruzione voluta dall'utente: non è un errore, e non produce avviso
        } else {
          setNotice({
            kind: "err",
            code: "errorRun",
            params: { message: err instanceof Error ? err.message : String(err) },
          });
        }
      } finally {
        setRunning(false);
        abortRef.current = null;
      }
    },
    [running, handleSseBlock, conversationId],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearNotice = useCallback(() => setNotice(null), []);

  const refreshConversations = useCallback(async () => {
    try {
      setConversations(await elencoConversazioni());
    } catch (err) {
      setNotice({ kind: "err", code: "errorRun", params: { message: err instanceof Error ? err.message : String(err) } });
    }
  }, []);

  const resume = useCallback(
    async (id: string) => {
      if (running) return;
      setNotice(null);
      setApproval(null);
      try {
        const c = await leggiConversazione(id);
        setConversationId(c.id);
        const ultima = ultimaAttivita(c);
        const righe: StreamLine[] = [];
        let n = 0;
        if (ultima) {
          righe.push({ id: ++n, kind: "prompt", text: domandaDaPrompt(ultima.prompt).slice(0, 600) });
          const dettaglio = await leggiAttivita(ultima.id);
          for (const e of dettaglio.events) {
            const l = lineaDaEvento(e);
            righe.push({ id: ++n, kind: l.kind, text: l.kind === "message" ? l.text.slice(0, MAX_RIGA) : l.text.replace(/\s+/g, " ").slice(0, 600) });
          }
          const p = propostaDaDecidere(dettaglio.proposals);
          if (p) {
            setApproval({
              approvalId: p.id,
              tool: p.tool,
              input: p.input,
              classe: p.kind === "LETTURA" ? "read" : "write",
              ...(p.personsCount !== null ? { personeDistinte: p.personsCount } : {}),
              expiresAt: p.expiresAt,
            });
          }
        }
        lineIdRef.current = n;
        setLines(righe.slice(-200));
      } catch (err) {
        setNotice({ kind: "err", code: "conversationNotFound", params: { message: err instanceof Error ? err.message : String(err) } });
      }
    },
    [running],
  );

  const startNew = useCallback(() => {
    if (running) return;
    setConversationId(null);
    setApproval(null);
    setLines([]);
    lineIdRef.current = 0;
  }, [running]);

  return {
    running,
    lines,
    approval,
    notice,
    run,
    stop,
    resolveApproval,
    clearNotice,
    conversationId,
    conversations,
    refreshConversations,
    resume,
    startNew,
  };
}
