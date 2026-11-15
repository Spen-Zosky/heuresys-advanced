/**
 * apps/web/src/lib/lettura-grafico.ts — la lettura in parole e la tabella di un grafico ECharts
 * (classe C8), ricavate dalla sua opzione. Separata dal componente perché si prova senza browser.
 */
import { testo as tr } from "./testi";

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
  const tipi = new Set(serie.map((s) => s.type));
  // Dispersione: per gruppo quanti punti e la media sui due assi (anche oltre otto gruppi).
  if (serie.length > 0 && tipi.size === 1 && tipi.has("scatter")) {
    const nfS = new Intl.NumberFormat(locale, { maximumFractionDigits: 0, useGrouping: "always" } as unknown as Intl.NumberFormatOptions);
    const nomeAsse = (a: unknown) => {
      const x = (Array.isArray(a) ? a[0] : a) as Record<string, unknown> | undefined;
      return typeof x?.name === "string" && x.name ? x.name : null;
    };
    const ax = nomeAsse(o.xAxis) ?? tr(locale, "lettura.asseX");
    const ay = nomeAsse(o.yAxis) ?? tr(locale, "lettura.asseY");
    const gruppi = serie.map((g, i) => {
      const pt = ((Array.isArray(g.data) ? g.data : []) as unknown[])
        .map((d) => (Array.isArray(d) ? d : (d as Record<string, unknown>)?.value) as unknown[] | undefined)
        .filter((d): d is unknown[] => Array.isArray(d) && d.length >= 2 && Number.isFinite(Number(d[0])) && Number.isFinite(Number(d[1])))
        .map((d) => [Number(d[0]), Number(d[1])] as const);
      const media = (k: 0 | 1) => (pt.length ? pt.reduce((a, b) => a + b[k], 0) / pt.length : 0);
      return { nome: typeof g.name === "string" && g.name ? g.name : tr(locale, "lettura.gruppo", { n: i + 1 }), n: pt.length, mx: media(0), my: media(1) };
    }).filter((g) => g.n > 0);
    if (gruppi.length === 0) return null;
    const punti = gruppi.reduce((a, g) => a + g.n, 0);
    const alto = gruppi.reduce((a, b) => (b.my > a.my ? b : a));
    return {
      frase: tr(locale, "lettura.scatter", { punti: nfS.format(punti), gruppi: nfS.format(gruppi.length), asse: ay, valore: nfS.format(alto.my), nome: alto.nome }),
      tabella: {
        titolo: tr(locale, "lettura.vediNumeri"),
        colonne: [tr(locale, "lettura.voce"), tr(locale, "lettura.punti"), tr(locale, "lettura.media", { asse: ax }), tr(locale, "lettura.media", { asse: ay })],
        righe: gruppi.map((g) => [g.nome, g.n, Math.round(g.mx), Math.round(g.my)]),
      },
    };
  }
  if (serie.length === 0 || serie.length > 8) return null;
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
      frase: tr(locale, "lettura.heatmap", { alto: nf0.format(alto[2] as number), nomeAlto: nome(alto), basso: nf0.format(basso[2] as number), nomeBasso: nome(basso), celle: celle.length }),
      tabella: { titolo: tr(locale, "lettura.vediNumeri"), colonne: [tr(locale, "lettura.voce"), ...x], righe: righeH },
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
        ? tr(locale, "lettura.boxSolo", { med: nf0.format(alta.med), min: nf0.format(alta.min), max: nf0.format(alta.max) })
        : tr(locale, "lettura.boxPiu", { alta: nf0.format(alta.med), nomeAlta: alta.nome, bassa: nf0.format(bassa.med), nomeBassa: bassa.nome }),
      tabella: { titolo: tr(locale, "lettura.vediNumeri"), colonne: [tr(locale, "lettura.voce"), tr(locale, "lettura.minimo"), tr(locale, "lettura.mediana"), tr(locale, "lettura.massimo")], righe: scatole.map((b) => [b.nome, b.min, b.med, b.max]) },
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
    // nomi diversi: cinque «Specialista» di fila non dicono niente di più di uno
    const primi = [...new Set((conValore.length > 0 ? conValore : nodi).map((n) => String(n.name ?? "")).filter(Boolean))].slice(0, 5);
    return {
      frase: `${tr(locale, "lettura.alberoElementi", { n: nf0.format(nodi.length) })}${collegamenti !== null ? tr(locale, "lettura.alberoCollegamenti", { n: nf0.format(collegamenti) }) : ""}${primi.length ? tr(locale, "lettura.alberoInTesta", { lista: primi.join(", ") }) : ""}.`,
      tabella: {
        titolo: tr(locale, "lettura.vediElementi"),
        colonne: conValore.length > 0 ? [tr(locale, "lettura.voce"), tr(locale, "lettura.valore")] : [tr(locale, "lettura.voce")],
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
    if (punti.length === 0) return;
    if (punti.length === 1) {
      // un solo valore è comunque una lettura: si scrive, invece di lasciare il disegno muto
      frasi.push(`${typeof s.name === "string" && s.name && serie.length > 1 ? `${s.name}: ` : ""}${tr(locale, "lettura.unico", { valore: nf.format(punti[0]!.v), nome: punti[0]!.nome })}`);
      return;
    }
    const alto = punti.reduce((a, b) => (b.v > a.v ? b : a));
    const basso = punti.reduce((a, b) => (b.v < a.v ? b : a));
    const nome = typeof s.name === "string" && s.name && serie.length > 1 ? `${s.name}: ` : "";
    const totale = punti.reduce((a, b) => a + b.v, 0);
    frasi.push(`${nome}${tr(locale, "lettura.altoBasso", { alto: nf.format(alto.v), nomeAlto: alto.nome, basso: nf.format(basso.v), nomeBasso: basso.nome, totale: serie.length === 1 ? tr(locale, "lettura.totale", { totale: nf.format(totale), voci: punti.length }) : "" })}`);
  });
  if (frasi.length === 0) return null;
  const testo = frasi.join(" ");
  const colonne = [tr(locale, "lettura.voce"), ...serie.map((s, i) => (typeof s.name === "string" && s.name ? s.name : serie.length === 1 ? tr(locale, "lettura.valore") : tr(locale, "lettura.serie", { n: i + 1 })))];
  const tutte = [...righe.values()];
  // C9: una serie senza nessun valore è una colonna di soli trattini; non si mostra
  const tenute = colonne.map((_c, j) => j === 0 || tutte.some((r) => r[j] !== "—"));
  return {
    frase: testo.charAt(0).toUpperCase() + testo.slice(1),
    tabella: { titolo: tr(locale, "lettura.vediNumeri"), colonne: colonne.filter((_c, j) => tenute[j]), righe: tutte.map((r) => r.filter((_v, j) => tenute[j])) },
  };
}

/**
 * S-10 (forense 15/11/2026): 19 grafici su 26 non dicevano che cosa misura l'asse dei valori. Il nome
 * che la pagina non dichiara si ricava dall'opzione stessa: l'asse dei valori prende il nome delle
 * serie (al massimo tre, distinte), che è già il nome del dato che il disegno misura. Un nome
 * dichiarato dalla pagina (`assi`) o scritto nell'opzione vince sempre; l'asse delle categorie non
 * si deriva (le sue etichette sono il nome di ciò che si conta) e gli assi di mappe, torte e alberi
 * non esistono.
 */
export function assiDerivati(option: unknown, assi: { x?: string; y?: string } | undefined): { x?: string; y?: string } {
  const o = option as Record<string, unknown>;
  const serie = (Array.isArray(o.series) ? o.series : o.series ? [o.series] : []) as Array<{ name?: unknown; type?: unknown }>;
  const cartesiane = serie.length > 0 && serie.every((s) => s.type === "bar" || s.type === "line" || s.type === "scatter" || s.type === "boxplot");
  const nomi = [...new Set(serie.map((s) => (typeof s.name === "string" ? s.name.trim() : "")).filter(Boolean))];
  const derivato = cartesiane && nomi.length > 0 && nomi.length <= 3 ? nomi.join(" / ") : undefined;
  const per = (k: "xAxis" | "yAxis", dichiarato: string | undefined) => {
    if (dichiarato) return dichiarato;
    const a = o[k];
    if (!a || typeof a !== "object" || Array.isArray(a)) return undefined;
    const ax = a as Record<string, unknown>;
    if (typeof ax.name === "string" && ax.name) return undefined;
    const tipo = ax.type ?? "value";
    return tipo === "value" || tipo === "log" ? derivato : undefined;
  };
  const x = per("xAxis", assi?.x);
  const y = per("yAxis", assi?.y);
  return { ...(x !== undefined ? { x } : {}), ...(y !== undefined ? { y } : {}) };
}
