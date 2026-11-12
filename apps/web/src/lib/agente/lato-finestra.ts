/**
 * apps/web/src/lib/agente/lato-finestra.ts — la colonna di destra della finestra dell'assistente
 * (piano dell'assistente nelle interfacce, blocco I2, logica L2; ripresa da mod-platform, dove a
 * destra sta «ciò che l'attività ha prodotto o usato»).
 *
 * Funzione pura: dalle righe dello stream e dalla proposta in attesa ricava tre elenchi, ciò che
 * l'assistente ha fatto sulla pagina (i comandi della vista con il loro esito), ciò che ha letto
 * (gli strumenti, senza doppioni) e ciò che aspetta la decisione della persona. Niente arriva dal
 * modello: sono gli eventi che il gateway ha già registrato.
 */
import type { StreamLine } from "@/lib/use-agent-stream";

export interface ComandoSullaPagina {
  nome: string;
  esito: string;
  dettaglio: string | null;
}

export interface LatoDellaFinestra {
  comandi: ComandoSullaPagina[];
  letture: string[];
  proposta: string | null;
}

const MAX_VOCI = 20;

/** `pushLine("page_command", "nome → stato: dettaglio")` in `use-agent-stream.ts`. */
function comando(testo: string): ComandoSullaPagina | null {
  const i = testo.indexOf(" → ");
  if (i <= 0) return null;
  const nome = testo.slice(0, i);
  const resto = testo.slice(i + 3);
  const j = resto.indexOf(": ");
  return j < 0 ? { nome, esito: resto, dettaglio: null } : { nome, esito: resto.slice(0, j), dettaglio: resto.slice(j + 2) };
}

export function latoDellaFinestra(lines: readonly StreamLine[], propostaInAttesa: string | null): LatoDellaFinestra {
  const comandi: ComandoSullaPagina[] = [];
  const letture: string[] = [];
  for (const l of lines) {
    if (l.kind === "page_command") {
      const c = comando(l.text);
      if (c) comandi.push(c);
    } else if (l.kind === "tool" && l.text && !letture.includes(l.text)) {
      letture.push(l.text);
    }
  }
  return { comandi: comandi.slice(-MAX_VOCI), letture: letture.slice(-MAX_VOCI), proposta: propostaInAttesa };
}

export function latoVuoto(l: LatoDellaFinestra): boolean {
  return l.comandi.length === 0 && l.letture.length === 0 && l.proposta === null;
}
