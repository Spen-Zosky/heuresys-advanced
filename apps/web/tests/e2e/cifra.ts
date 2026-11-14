/**
 * apps/web/tests/e2e/cifra.ts — un conteggio come lo mostra la pagina: forma italiana con il
 * separatore delle migliaia sempre («1.234»), la stessa di `useFormat().numero` (classe C4).
 * Le prove confrontano la cifra dell'API con quella a video passando da qui, non da `String()`:
 * oltre il migliaio `String(1234)` è «1234», che a video non compare più.
 */
export function cifra(n: number | string): string {
  return new Intl.NumberFormat("it-IT", { useGrouping: "always" } as unknown as Intl.NumberFormatOptions).format(Number(n));
}

/**
 * Un valore grezzo come lo riscrive la rete di pagina (`ReteDiPagina`, lib/leggibile.tsx): un
 * numero intero o decimale va in forma italiana con al massimo due decimali, il resto resta com'è.
 */
export function comeAVideo(v: number | string): string {
  const t = String(v).trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(t)) return t;
  const n = Number(t);
  if (Number.isInteger(n) && n >= 1900 && n <= 2100) return t;
  if (/^-?[1-9]\d{0,2}\.\d{3}$/.test(t)) return t;
  const decimali = t.includes(".") ? Math.min(2, t.split(".")[1]!.length) : 0;
  return new Intl.NumberFormat("it-IT", { useGrouping: "always", maximumFractionDigits: decimali } as unknown as Intl.NumberFormatOptions).format(n);
}
