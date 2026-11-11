/**
 * apps/web/src/lib/lettura-grafico.ts — la lettura in parole e la tabella di un grafico ECharts
 * (classe C8), ricavate dalla sua opzione. Separata dal componente perché si prova senza browser.
 */
export interface ChartTable {
  titolo: string;
  colonne: string[];
  righe: Array<Array<string | number>>;
}

/**
 * C8: ogni grafico porta una lettura in parole e la sua tabella, anche quando la pagina non le
 * dà. Enzo: «grafici che non sono intellegibili». Per un grafico a barre o a linee con un asse
 * di categorie, e per una torta, si ricavano dall'opzione stessa: la categoria più alta e la più
 * bassa di ogni serie (e il totale, se la serie è una sola), e la tabella categoria per serie.
 * Nessun dato inventato: sono gli stessi numeri del disegno, scritti.
 */
type Serie = { name?: unknown; type?: unknown; data?: unknown };
function valoreDi(d: unknown): number | null {
  const v = d && typeof d === "object" && !Array.isArray(d) ? (d as Record<string, unknown>).value : d;
  const x = Array.isArray(v) ? v[v.length - 1] : v;
  const n = typeof x === "string" ? Number(x) : x;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}
function nomeDi(d: unknown, i: number, categorie: string[] | null): string {
  if (categorie?.[i] !== undefined) return categorie[i]!;
  if (d && typeof d === "object" && !Array.isArray(d) && typeof (d as Record<string, unknown>).name === "string") return (d as Record<string, string>).name!;
  return String(i + 1);
}
export function letturaDelGrafico(option: unknown, locale: string): { frase: string; tabella: ChartTable } | null {
  if (!option || typeof option !== "object") return null;
  const o = option as Record<string, unknown>;
  const serie = (Array.isArray(o.series) ? o.series : o.series ? [o.series] : []) as Serie[];
  if (serie.length === 0 || serie.length > 8) return null;
  const tipi = new Set(serie.map((s) => s.type));
  const asseCat = [o.xAxis, o.yAxis].flat().find((a) => a && typeof a === "object" && (a as Record<string, unknown>).type === "category") as Record<string, unknown> | undefined;
  const categorie = Array.isArray(asseCat?.data) ? (asseCat!.data as unknown[]).map((c) => (c && typeof c === "object" ? String((c as Record<string, unknown>).value ?? "") : String(c))) : null;
  const torta = tipi.size === 1 && tipi.has("pie");
  if (!torta && (!categorie || ![...tipi].every((t) => t === "bar" || t === "line"))) return null;
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 2, useGrouping: "always" } as unknown as Intl.NumberFormatOptions);
  const frasi: string[] = [];
  const righe = new Map<string, Array<string | number>>();
  serie.forEach((s, k) => {
    const dati = Array.isArray(s.data) ? s.data : [];
    const punti = dati.map((d, i) => ({ nome: nomeDi(d, i, torta ? null : categorie), v: valoreDi(d) })).filter((p) => p.v !== null) as Array<{ nome: string; v: number }>;
    for (const p of punti) {
      const r = righe.get(p.nome) ?? [p.nome, ...serie.map(() => "—" as string | number)];
      r[k + 1] = p.v;
      righe.set(p.nome, r);
    }
    if (punti.length < 2) return;
    const alto = punti.reduce((a, b) => (b.v > a.v ? b : a));
    const basso = punti.reduce((a, b) => (b.v < a.v ? b : a));
    const nome = typeof s.name === "string" && s.name && serie.length > 1 ? `${s.name}: ` : "";
    const totale = punti.reduce((a, b) => a + b.v, 0);
    frasi.push(`${nome}il valore più alto è ${nf.format(alto.v)} (${alto.nome}), il più basso ${nf.format(basso.v)} (${basso.nome})${serie.length === 1 ? `; totale ${nf.format(totale)} su ${punti.length} voci` : ""}.`);
  });
  if (frasi.length === 0) return null;
  const testo = frasi.join(" ");
  const colonne = ["Voce", ...serie.map((s, i) => (typeof s.name === "string" && s.name ? s.name : serie.length === 1 ? "Valore" : `Serie ${i + 1}`))];
  const tutte = [...righe.values()];
  // C9: una serie senza nessun valore è una colonna di soli trattini; non si mostra
  const tenute = colonne.map((_c, j) => j === 0 || tutte.some((r) => r[j] !== "—"));
  return {
    frase: testo.charAt(0).toUpperCase() + testo.slice(1),
    tabella: { titolo: "Vedi i numeri del grafico", colonne: colonne.filter((_c, j) => tenute[j]), righe: tutte.map((r) => r.filter((_v, j) => tenute[j])) },
  };
}
