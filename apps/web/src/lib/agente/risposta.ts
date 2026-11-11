/**
 * apps/web/src/lib/agente/risposta.ts — ciò che la persona legge dell'assistente.
 *
 * Il gateway manda lo stream dell'SDK così com'è: `system`, `rate_limit_event`, `thinking_tokens`,
 * `commands_changed`, i risultati degli strumenti. Mostrarli in finestra fa sparire la risposta in
 * mezzo a JSON (misurato dal vivo il 2026-11-10). Qui si decide cosa è leggibile: il testo
 * dell'assistente e il nome degli strumenti che usa; il resto non si disegna.
 */

export interface RigaLeggibile {
  kind: "message" | "tool";
  text: string;
}

/** Il testo più lungo che una riga porta in finestra. */
export const MAX_RIGA = 4000;

/**
 * Da un evento `message` dello stream (il `data:` JSON dell'SDK) alle righe da mostrare.
 * Vuoto = niente da mostrare. Un JSON rotto non si mostra: sarebbe di nuovo il flusso grezzo.
 */
export function righeDaMessaggio(data: string): RigaLeggibile[] {
  let ev: unknown;
  try {
    ev = JSON.parse(data);
  } catch {
    return [];
  }
  if (!ev || typeof ev !== "object") return [];
  const e = ev as { type?: unknown; message?: { content?: unknown } };
  if (e.type !== "assistant" || !Array.isArray(e.message?.content)) return [];
  const out: RigaLeggibile[] = [];
  for (const b of e.message.content as Array<{ type?: unknown; text?: unknown; name?: unknown }>) {
    if (b?.type === "text" && typeof b.text === "string" && b.text.trim()) {
      out.push({ kind: "message", text: b.text.trim().slice(0, MAX_RIGA) });
    } else if (b?.type === "tool_use" && typeof b.name === "string") {
      out.push({ kind: "tool", text: nomeStrumento(b.name) });
    }
  }
  return out;
}

/** `mcp__heuresys__hrx_org_unit_processes_list` → `hrx_org_unit_processes_list`. */
export function nomeStrumento(nome: string): string {
  const i = nome.lastIndexOf("__");
  return i >= 0 ? nome.slice(i + 2) : nome;
}

/**
 * La domanda della persona senza il contesto che la finestra le antepone («Contesto: Pagina …»
 * su una riga, riga vuota, poi la domanda). Senza quella forma il testo resta com'è.
 */
export function domandaDaPrompt(prompt: string): string {
  const m = /^[^\n:]{1,40}: [^\n]*\n\n([\s\S]+)$/.exec(prompt);
  return (m?.[1] ?? prompt).trim();
}

/**
 * Il titolo di una conversazione salvata prima che il gateway togliesse il contesto: il prompt
 * arrivava con lo spazio bianco già compattato («Contesto: Pagina «X» (/me) domanda…»).
 */
export function titoloLeggibile(titolo: string): string {
  const t = titolo.replace(/^Contesto: Pagina «[^»]*» \([^)]*\)\s*/, "").trim();
  return t || titolo;
}
