/**
 * apps/web/src/lib/agente/messaggi.ts — dalla corsa dell'assistente ai messaggi che la persona legge
 * (richiesta di Enzo del 2026-11-18: la finestra come Claude Desktop, senza dati tecnici).
 *
 * Funzioni pure, perché sono la parte che può sbagliare in silenzio: quali righe dello stream
 * diventano un messaggio, come si fondono i pezzi di una risposta, e come il rifiuto deciso dal
 * gateway prende il posto del testo del modello. Gli strumenti usati, i comandi della pagina e gli
 * identificativi non diventano mai un messaggio.
 */
import type { StreamLine } from "@/lib/use-agent-stream";

export interface Messaggio {
  id: number;
  ruolo: "persona" | "assistente" | "avviso";
  testo: string;
  /** Vero quando è il messaggio fisso di una domanda tutta su dati vietati (deciso dal gateway). */
  rifiuto?: boolean;
}

/**
 * Le righe dello stream, nell'ordine, diventano messaggi: la domanda della persona, la risposta
 * dell'assistente (i pezzi consecutivi in un messaggio solo) e gli avvisi. Un `rifiuto` sostituisce
 * la risposta della domanda a cui si riferisce.
 */
export function messaggiDaRighe(righe: readonly StreamLine[]): Messaggio[] {
  const out: Messaggio[] = [];
  let inizioRisposta = 0;
  for (const r of righe) {
    if (r.kind === "prompt") {
      out.push({ id: r.id, ruolo: "persona", testo: r.text });
      inizioRisposta = out.length;
    } else if (r.kind === "message") {
      if (!r.text.trim()) continue;
      const ultimo = out[out.length - 1];
      if (ultimo && ultimo.ruolo === "assistente" && !ultimo.rifiuto) ultimo.testo = `${ultimo.testo}\n\n${r.text}`;
      else out.push({ id: r.id, ruolo: "assistente", testo: r.text });
    } else if (r.kind === "rifiuto") {
      out.splice(inizioRisposta);
      out.push({ id: r.id, ruolo: "assistente", testo: r.text, rifiuto: true });
    } else if (r.kind === "error") {
      out.push({ id: r.id, ruolo: "avviso", testo: "errore" });
    } else if (r.kind === "limit") {
      out.push({ id: r.id, ruolo: "avviso", testo: "limite" });
    }
  }
  return out;
}

/** Che cosa sta facendo l'assistente, in parole: consulta i dati o scrive la risposta. */
export function fase(righe: readonly StreamLine[]): "consulta" | "scrive" | "pensa" {
  for (let i = righe.length - 1; i >= 0; i -= 1) {
    const k = righe[i]?.kind;
    if (k === "prompt") return "pensa";
    if (k === "tool" || k === "page_command") return "consulta";
    if (k === "message") return "scrive";
  }
  return "pensa";
}

/**
 * Una tabella in CSV con il separatore «;» (quello che Excel in italiano apre senza chiedere) e le
 * virgolette solo dove servono.
 */
export function csvDa(righe: readonly (readonly string[])[]): string {
  const cella = (grezzo: string) => {
    const v = disinnesca(grezzo);
    return /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  return righe.map((r) => r.map(cella).join(";")).join("\r\n");
}

/** Una tabella in testo separato da tabulazioni, per incollarla in un foglio di calcolo. */
export function tsvDa(righe: readonly (readonly string[])[]): string {
  return righe.map((r) => r.map((v) => disinnesca(v).replace(/[\t\n\r]+/g, " ")).join("\t")).join("\n");
}

/**
 * Una cella che il foglio di calcolo leggerebbe come formula (=, +, -, @, tabulazione, a capo in
 * testa) prende un apostrofo davanti: il testo resta quello, ma non si esegue. I numeri restano numeri.
 */
export function disinnesca(v: string): string {
  if (/^[-+]?\d[\d.,]*%?$/.test(v.trim())) return v;
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

/** Che cosa farebbe una scrittura proposta, in parole: l'azione e i campi che cambia. */
export interface RiepilogoProposta {
  azione: "crea-aggiorna" | "elimina" | "costruisci" | "altro";
  oggetto: string;
  campi: Array<{ nome: string; valore: string }>;
}

/**
 * Dal nome dello strumento e dagli argomenti (già oscurati dal gateway) il riepilogo che la persona
 * legge prima di confermare: non si consente una modifica senza sapere quale.
 */
export function riepilogoProposta(tool: unknown, input: unknown, massimo = 12): RiepilogoProposta {
  const nome = typeof tool === "string" ? (tool.split("__").pop() ?? tool) : "";
  const azione = /_upsert$/.test(nome) ? "crea-aggiorna" : /_delete$/.test(nome) ? "elimina" : /materialize/.test(nome) ? "costruisci" : "altro";
  const oggetto = nome.replace(/^hrx_/, "").replace(/_(upsert|delete|materialize)$/, "").replace(/_/g, " ");
  const campi: Array<{ nome: string; valore: string }> = [];
  const visita = (v: unknown, prefisso: string) => {
    if (campi.length >= massimo) return;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) visita(x, prefisso && prefisso !== "payload" ? `${prefisso}.${k}` : k);
      return;
    }
    const testo = typeof v === "string" ? v : JSON.stringify(v);
    campi.push({ nome: prefisso || "valore", valore: (testo ?? "").slice(0, 200) });
  };
  visita(input, "");
  return { azione, oggetto, campi };
}
