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
  const nf0 = new Intl.NumberFormat(locale, { maximumFractionDigits: 2, useGrouping: "always" } as unknown as Intl.NumberFormatOptions);
  // Mappa di calore: righe × colonne, la cella più alta e la più bassa.
  if (tipi.size === 1 && tipi.has("heatmap")) {
    const assi = (a: unknown) => (Array.isArray((a as Record<string, unknown>)?.data) ? ((a as Record<string, unknown>).data as unknown[]).map(String) : []);
    const x = assi(Array.isArray(o.xAxis) ? o.xAxis[0] : o.xAxis);
    const y = assi(Array.isArray(o.yAxis) ? o.yAxis[0] : o.yAxis);
    const celle = ((serie[0]!.data as unknown[]) ?? [])
      .map((d) => (Array.isArray(d) ? d : (d as Record<string, unknown>)?.value) as unknown[] | undefined)
      .filter((d): d is unknown[] => Array.isArray(d) && d.length >= 3 && typeof d[2] === "number");
    if (x.length === 0 || y.length === 0 || celle.length < 2) return null;
    const nome = (d: unknown[]) => `${y[Number(d[1])] ?? d[1]} · ${x[Number(d[0])] ?? d[0]}`;
    const alto = celle.reduce((a, b) => ((b[2] as number) > (a[2] as number) ? b : a));
    const basso = celle.reduce((a, b) => ((b[2] as number) < (a[2] as number) ? b : a));
    const righeH = y.map((ny, iy) => [ny, ...x.map((_nx, ix) => {
      const c = celle.find((d) => Number(d[0]) === ix && Number(d[1]) === iy);
      return c ? (c[2] as number) : "—";
    })]);
    return {
      frase: `Il valore più alto è ${nf0.format(alto[2] as number)} (${nome(alto)}), il più basso ${nf0.format(basso[2] as number)} (${nome(basso)}), su ${celle.length} celle.`,
      tabella: { titolo: "Vedi i numeri del grafico", colonne: ["Voce", ...x], righe: righeH },
    };
  }
  // Scatola e baffi: per categoria minimo, mediana, massimo (le serie di punti accanto non contano).
  const box = serie.find((x) => x.type === "boxplot");
  if (box) {
    const ac = [o.xAxis, o.yAxis].flat().find((a) => a && typeof a === "object" && (a as Record<string, unknown>).type === "category") as Record<string, unknown> | undefined;
    const cat = Array.isArray(ac?.data) ? (ac!.data as unknown[]).map(String) : [];
    const scatole = ((box.data as unknown[]) ?? []).map((d, i) => {
      const v = (Array.isArray(d) ? d : (d as Record<string, unknown>)?.value) as unknown[] | undefined;
      return Array.isArray(v) && v.length >= 5 ? { nome: cat[i] ?? String(i + 1), min: Number(v[0]), med: Number(v[2]), max: Number(v[4]) } : null;
    }).filter((x): x is { nome: string; min: number; med: number; max: number } => x !== null);
    if (scatole.length === 0) return null;
    const alta = scatole.reduce((a, b) => (b.med > a.med ? b : a));
    const bassa = scatole.reduce((a, b) => (b.med < a.med ? b : a));
    return {
      frase: scatole.length === 1
        ? `Mediana ${nf0.format(alta.med)}, da ${nf0.format(alta.min)} a ${nf0.format(alta.max)}.`
        : `La mediana più alta è ${nf0.format(alta.med)} (${alta.nome}), la più bassa ${nf0.format(bassa.med)} (${bassa.nome}).`,
      tabella: { titolo: "Vedi i numeri del grafico", colonne: ["Voce", "Minimo", "Mediana", "Massimo"], righe: scatole.map((b) => [b.nome, b.min, b.med, b.max]) },
    };
  }
  // Albero, mappa ad albero, grafo: quanti elementi e quali in testa.
  if (tipi.size === 1 && ["tree", "treemap", "graph", "sunburst"].includes(String([...tipi][0]))) {
    const s0 = serie[0]! as Serie & { nodes?: unknown; links?: unknown; edges?: unknown };
    const nodi: Array<{ name?: unknown; value?: unknown; children?: unknown }> = [];
    const visita = (n: unknown, prof: number) => {
      if (!n || typeof n !== "object") return;
      const r = n as { name?: unknown; value?: unknown; children?: unknown };
      nodi.push(r);
      if (prof < 30 && Array.isArray(r.children)) for (const c of r.children) visita(c, prof + 1);
    };
    const radici = (Array.isArray(s0.data) ? s0.data : Array.isArray(s0.nodes) ? s0.nodes : []) as unknown[];
    for (const r of radici) visita(r, 0);
    if (nodi.length === 0) return null;
    const collegamenti = Array.isArray(s0.links) ? s0.links.length : Array.isArray(s0.edges) ? s0.edges.length : null;
    const conValore = nodi.filter((n) => typeof n.value === "number").sort((a, b) => (b.value as number) - (a.value as number));
    const primi = (conValore.length > 0 ? conValore : nodi).slice(0, 5).map((n) => String(n.name ?? "")).filter(Boolean);
    return {
      frase: `${nf0.format(nodi.length)} elementi${collegamenti !== null ? ` e ${nf0.format(collegamenti)} collegamenti` : ""}${primi.length ? `; in testa: ${primi.join(", ")}` : ""}.`,
      tabella: {
        titolo: "Vedi gli elementi del grafico",
        colonne: conValore.length > 0 ? ["Voce", "Valore"] : ["Voce"],
        righe: (conValore.length > 0 ? conValore : nodi).slice(0, 200).map((n) => (conValore.length > 0 ? [String(n.name ?? "—"), n.value as number] : [String(n.name ?? "—")])),
      },
    };
  }
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
