/**
 * apps/web/src/lib/agente/idoneita.ts — piano interfacce L10, voce A-8.
 *
 * Su quali pagine si monta il pannello comune dell'agente. L'elenco non si scrive a mano:
 * è la misura di `check_idoneita_agente.py` (#159 F1, prove P1-P4), generata in
 * `pagine-idonee.generated.ts`. Qui solo il confronto fra una rotta con segmenti `[x]` e
 * l'indirizzo vero della pagina.
 */
import { PAGINE_IDONEE_AGENTE } from "./pagine-idonee.generated";

function corrisponde(modello: string, indirizzo: string): boolean {
  const m = modello.split("/").filter(Boolean);
  const p = indirizzo.split("/").filter(Boolean);
  if (m.length !== p.length) return false;
  return m.every((seg, i) => (seg.startsWith("[") && seg.endsWith("]")) || seg === p[i]);
}

/** Il modello di rotta idoneo per questo indirizzo, o `null` se la pagina non è idonea. */
export function paginaIdonea(indirizzo: string, elenco: readonly string[] = PAGINE_IDONEE_AGENTE): string | null {
  const pulito = (indirizzo.split(/[?#]/)[0] ?? "").replace(/\/+$/, "") || "/";
  // Prima le rotte fisse, poi quelle con segmenti dinamici: `/positions/new` non è `/positions/[id]`.
  const fisse = elenco.filter((r) => !r.includes("["));
  const dinamiche = elenco.filter((r) => r.includes("["));
  return fisse.find((r) => r === pulito) ?? dinamiche.find((r) => corrisponde(r, pulito)) ?? null;
}
