/**
 * apps/web/src/lib/colori-grafico.ts — colori per il disegno dei grafici (canvas di ECharts).
 *
 * Il canvas non risolve `var(--x)` e non capisce `hsl(#2563EB / 0.12)`: i token del design
 * sono colori completi (esadecimali) e le pagine li avvolgevano come `hsl(var(--palette-1) / 0.12)`
 * per ottenere la tinta chiara della scala. Il risultato era un colore non valido, e la scala
 * delle mappe di calore (giro del 16/11, G-GRAFICO) non si vedeva. Qui l'esadecimale si
 * porta a `rgba(r, g, b, a)`, che il canvas legge.
 */

/** `#rgb` o `#rrggbb` + trasparenza (0-1, oppure «12%») → `rgba(...)`; null se non è un esadecimale. */
export function esadecimaleConAlfa(esadecimale: string, alfa: string | number): string | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(esadecimale.trim());
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
  let a = typeof alfa === "number" ? alfa : alfa.trim().endsWith("%") ? parseFloat(alfa) / 100 : parseFloat(alfa);
  if (!Number.isFinite(a)) return null;
  a = Math.min(1, Math.max(0, a));
  return `rgba(${n(0)}, ${n(2)}, ${n(4)}, ${a})`;
}
