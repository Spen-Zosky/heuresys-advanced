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

import { useCallback, useRef, useState } from "react";

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
  code: "approvalResolved" | "noSession" | "errorRun";
  params?: Record<string, string>;
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
  /** Apre lo stream per questo prompt. Non fa nulla se una corsa è già in volo o il prompt è vuoto. */
  run: (prompt: string) => Promise<void>;
  /** Interrompe la corsa. Un'interruzione voluta NON è un errore e non produce avviso. */
  stop: () => void;
  resolveApproval: (decision: "allow" | "deny") => Promise<void>;
  clearNotice: () => void;
}

export function useAgentStream(): UseAgentStream {
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<StreamLine[]>([]);
  const [approval, setApproval] = useState<PendingApproval | null>(null);
  const [notice, setNotice] = useState<AgentNotice | null>(null);

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
        try {
          const parsed = JSON.parse(data) as {
            approvalId?: string;
            tool?: unknown;
            input?: unknown;
          };
          if (parsed.approvalId) {
            setApproval({ approvalId: parsed.approvalId, tool: parsed.tool, input: parsed.input });
          }
        } catch {
          /* payload di approvazione malformato: si ignora, la riga resta nello stream */
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
    async (prompt: string) => {
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
          body: JSON.stringify({ prompt }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const detail = await res.text().catch(() => "");
          if (res.status === 401) {
            setNotice({ kind: "err", code: "noSession" });
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
    [running, handleSseBlock],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearNotice = useCallback(() => setNotice(null), []);

  return { running, lines, approval, notice, run, stop, resolveApproval, clearNotice };
}
