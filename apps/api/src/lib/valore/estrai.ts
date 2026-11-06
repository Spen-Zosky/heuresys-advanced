/**
 * apps/api/src/lib/valore/estrai.ts — F0-3.
 *
 * Il catalogo delle decisioni (`audit.valore_rotte_decisione`) dice per ogni rotta DOVE
 * si trova l'oggetto deciso e dove l'esito: `param:<nome>` (parametro di rotta),
 * `corpo:<campo>` (corpo della richiesta), `risposta:<campo>` (corpo della risposta).
 * Con `[]` in coda il campo è un elenco e ogni elemento è un oggetto deciso.
 *
 * Funzione pura: nessuna ipotesi oltre la specifica. Un valore che non è testo non
 * diventa un identificativo, e una specifica che non si capisce non produce niente.
 */

export interface ContestoEstrazione {
  params: unknown;
  corpo: unknown;
  risposta: unknown;
}

const SPEC_RE = /^(param|corpo|risposta):([A-Za-z][A-Za-z0-9_]*)(\[\])?$/;
const MAX_VALORE = 128;
const MAX_ELEMENTI = 500;

function campo(origine: unknown, nome: string): unknown {
  if (origine === null || typeof origine !== "object" || Array.isArray(origine)) return undefined;
  return (origine as Record<string, unknown>)[nome];
}

function testo(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 && v.length <= MAX_VALORE ? v : null;
}

export function estraiValori(spec: string | null | undefined, ctx: ContestoEstrazione): string[] {
  if (!spec) return [];
  const m = SPEC_RE.exec(spec);
  if (!m) return [];
  const [, dove, nome, elenco] = m;
  const origine = dove === "param" ? ctx.params : dove === "corpo" ? ctx.corpo : ctx.risposta;
  const v = campo(origine, nome!);
  if (elenco) {
    if (!Array.isArray(v)) return [];
    const visti = new Set<string>();
    for (const el of v.slice(0, MAX_ELEMENTI)) {
      const t = testo(el);
      if (t !== null) visti.add(t);
    }
    return [...visti];
  }
  const t = testo(v);
  return t === null ? [] : [t];
}
