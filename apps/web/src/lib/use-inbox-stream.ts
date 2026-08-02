"use client";
/**
 * apps/web/src/lib/use-inbox-stream.ts
 * #38 B6 — ascolto degli avvisi della posta in arrivo (SSE) al posto del sondaggio a 30s.
 *
 * Il flusso passa dal proxy same-origin `/api/*`, quindi il cookie di sessione viaggia da
 * solo e non serve `withCredentials`.
 *
 * L'evento NON porta il contenuto della notifica: porta il fatto che qualcosa è cambiato.
 * Chi riceve rilegge da `GET /v1/me/inbox`, dove valgono permessi e filtro per tenant.
 *
 * Il ripiego è dichiarato, non implicito: finché il flusso è aperto il sondaggio è spento;
 * se il flusso non si apre o cade — un proxy che accumula, una rete che taglia le
 * connessioni lunghe — il sondaggio riparte a cadenza ridotta. Senza questo, un ambiente
 * in cui SSE non passa lascerebbe la posta in arrivo ferma **senza alcun segnale**, che è
 * peggio del sondaggio che sostituisce.
 */
import { useEffect, useRef, useState } from "react";

export interface InboxStreamState {
  /** True finché il flusso è aperto: la pagina può spegnere il sondaggio. */
  connected: boolean;
}

export function useInboxStream(onChange: () => void): InboxStreamState {
  const [connected, setConnected] = useState(false);
  // L'ultima callback senza rilanciare la connessione a ogni render del chiamante.
  // L'aggiornamento sta in un effetto, non nel corpo del render: scrivere su un ref
  // durante il render è una scrittura durante una fase che React può ripetere o
  // interrompere.
  const handler = useRef(onChange);
  useEffect(() => {
    handler.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;

    const source = new EventSource("/api/v1/me/inbox/stream");

    const onOpen = () => setConnected(true);
    const onInbox = () => handler.current();
    const onError = () => {
      // EventSource riprova da solo; qui interessa solo che la pagina sappia di NON
      // essere più in ascolto, così il sondaggio di riserva riparte nel frattempo.
      setConnected(false);
    };

    source.addEventListener("open", onOpen);
    source.addEventListener("inbox", onInbox);
    source.addEventListener("error", onError);

    return () => {
      source.removeEventListener("open", onOpen);
      source.removeEventListener("inbox", onInbox);
      source.removeEventListener("error", onError);
      source.close();
      setConnected(false);
    };
  }, []);

  return { connected };
}
