/**
 * apps/api/src/modules/visualization-exports/render.ts
 * #36 (linea B5) — il motore che trasforma un grafo in un documento.
 *
 * Fino a oggi `visualization-exports` era un registro: annotava che un export
 * era stato chiesto e non produceva nulla. Qui il documento si genera davvero,
 * a partire dal grafo reale (nodi, archi) e — quando esiste — dalle posizioni
 * salvate nel layout.
 *
 * Quattro formati sono testo e si generano senza alcuna dipendenza esterna:
 * SVG, MERMAID, GENERIC_JSON, REACT_FLOW_JSON.
 *
 * PNG e PDF NON si generano: richiedono un rasterizzatore (headless browser o
 * libreria binaria) che questo servizio non ha. Il motore lo dichiara con un
 * errore tipizzato invece di restituire un file vuoto o un segnaposto — un
 * export finto sarebbe peggio di un export assente, perché sembrerebbe vero.
 */
import type { VizEdge, VizExportFormat, VizGraph, VizNode } from "@heuresys/shared";

export interface RenderedExport {
  content: string;
  contentType: string;
  extension: string;
}

export interface NodePosition {
  x: number;
  y: number;
}

/** I formati che il motore sa davvero produrre. */
export const RENDERABLE_FORMATS: readonly VizExportFormat[] = [
  "SVG",
  "MERMAID",
  "GENERIC_JSON",
  "REACT_FLOW_JSON",
] as const;

export function isRenderable(format: VizExportFormat): boolean {
  return RENDERABLE_FORMATS.includes(format);
}

// ---------------------------------------------------------------- layout

const NODE_W = 180;
const NODE_H = 44;
const GAP_X = 24;
const GAP_Y = 90;
const MARGIN = 40;

/**
 * Posizioni di ripiego quando l'export non indica un layout salvato.
 *
 * Dispone i nodi per livelli: le radici (nessun arco entrante) in cima, i figli
 * sotto. È deterministico — stesso grafo, stesse coordinate — così due export
 * successivi dello stesso grafo sono confrontabili byte a byte.
 */
export function computeFallbackPositions(nodes: VizNode[], edges: VizEdge[]): Map<string, NodePosition> {
  const childrenOf = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const e of edges) {
    const list = childrenOf.get(e.sourceNodeId) ?? [];
    list.push(e.targetNodeId);
    childrenOf.set(e.sourceNodeId, list);
    hasParent.add(e.targetNodeId);
  }

  const known = new Set(nodes.map((n) => n.nodeId));
  const roots = nodes.filter((n) => !hasParent.has(n.nodeId)).map((n) => n.nodeId);
  // Un grafo interamente ciclico non ha radici: si parte dal primo nodo, così
  // la disposizione resta definita invece di produrre una tela vuota.
  const seeds = roots.length > 0 ? roots : nodes.slice(0, 1).map((n) => n.nodeId);

  const depth = new Map<string, number>();
  const queue: Array<{ id: string; d: number }> = seeds.map((id) => ({ id, d: 0 }));
  const seen = new Set<string>(seeds);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    depth.set(cur.id, cur.d);
    for (const child of childrenOf.get(cur.id) ?? []) {
      if (seen.has(child) || !known.has(child)) continue;
      seen.add(child);
      queue.push({ id: child, d: cur.d + 1 });
    }
  }
  // Nodi irraggiungibili dai semi (isole): in fondo, su una riga propria.
  const maxDepth = depth.size > 0 ? Math.max(...depth.values()) : 0;
  for (const n of nodes) if (!depth.has(n.nodeId)) depth.set(n.nodeId, maxDepth + 1);

  const byDepth = new Map<number, string[]>();
  for (const n of nodes) {
    const d = depth.get(n.nodeId)!;
    const row = byDepth.get(d) ?? [];
    row.push(n.nodeId);
    byDepth.set(d, row);
  }

  const positions = new Map<string, NodePosition>();
  for (const [d, row] of byDepth) {
    row.forEach((id, i) => {
      positions.set(id, { x: MARGIN + i * (NODE_W + GAP_X), y: MARGIN + d * GAP_Y });
    });
  }
  return positions;
}

// ---------------------------------------------------------------- SVG

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Tronca l'etichetta a una larghezza che sta nel riquadro, con ellissi. */
function fitLabel(label: string, max = 24): string {
  return label.length <= max ? label : `${label.slice(0, max - 1)}…`;
}

function renderSvg(graph: VizGraph, nodes: VizNode[], edges: VizEdge[], pos: Map<string, NodePosition>): string {
  const xs = [...pos.values()].map((p) => p.x);
  const ys = [...pos.values()].map((p) => p.y);
  const width = (xs.length ? Math.max(...xs) : 0) + NODE_W + MARGIN;
  const height = (ys.length ? Math.max(...ys) : 0) + NODE_H + MARGIN + 30;

  const lines: string[] = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${xmlEscape(graph.name)}">`,
  );
  lines.push(`<title>${xmlEscape(graph.name)}</title>`);
  lines.push(
    `<style>.n{fill:#f8fafc;stroke:#475569;stroke-width:1}.l{fill:#0f172a;font:13px system-ui,sans-serif}.e{stroke:#94a3b8;stroke-width:1.2;fill:none}.h{fill:#64748b;font:12px system-ui,sans-serif}</style>`,
  );
  lines.push(`<rect width="${width}" height="${height}" fill="#ffffff"/>`);

  // Archi prima dei nodi, così i riquadri coprono le linee e non viceversa.
  for (const e of edges) {
    const a = pos.get(e.sourceNodeId);
    const b = pos.get(e.targetNodeId);
    if (!a || !b) continue;
    const x1 = a.x + NODE_W / 2;
    const y1 = a.y + NODE_H;
    const x2 = b.x + NODE_W / 2;
    const y2 = b.y;
    const mid = (y1 + y2) / 2;
    lines.push(`<path class="e" d="M${x1} ${y1} L${x1} ${mid} L${x2} ${mid} L${x2} ${y2}"/>`);
  }

  for (const n of nodes) {
    const p = pos.get(n.nodeId);
    if (!p) continue;
    lines.push(`<rect class="n" x="${p.x}" y="${p.y}" width="${NODE_W}" height="${NODE_H}" rx="6"/>`);
    lines.push(
      `<text class="l" x="${p.x + 10}" y="${p.y + 27}">${xmlEscape(fitLabel(n.label))}</text>`,
    );
  }

  lines.push(
    `<text class="h" x="${MARGIN}" y="${height - 14}">${xmlEscape(graph.name)} — v${graph.version} — ${nodes.length} nodi, ${edges.length} archi</text>`,
  );
  lines.push(`</svg>`);
  return lines.join("\n");
}

// ---------------------------------------------------------------- Mermaid

/** Mermaid accetta identificatori senza trattini né spazi. */
function mermaidId(nodeId: string, index: number): string {
  return `n${index}_${nodeId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8)}`;
}

function renderMermaid(graph: VizGraph, nodes: VizNode[], edges: VizEdge[]): string {
  const idOf = new Map<string, string>();
  nodes.forEach((n, i) => idOf.set(n.nodeId, mermaidId(n.nodeId, i)));

  const out: string[] = [];
  out.push(`%% ${graph.name} — v${graph.version} (${graph.code})`);
  out.push("graph TD");
  for (const n of nodes) {
    // Le virgolette nell'etichetta romperebbero la sintassi del nodo.
    out.push(`  ${idOf.get(n.nodeId)}["${n.label.replace(/"/g, "'")}"]`);
  }
  for (const e of edges) {
    const s = idOf.get(e.sourceNodeId);
    const t = idOf.get(e.targetNodeId);
    if (!s || !t) continue;
    out.push(`  ${s} --> ${t}`);
  }
  return out.join("\n");
}

// ---------------------------------------------------------------- JSON

function renderGenericJson(graph: VizGraph, nodes: VizNode[], edges: VizEdge[]): string {
  return JSON.stringify({ graph, nodes, edges }, null, 2);
}

function renderReactFlowJson(nodes: VizNode[], edges: VizEdge[], pos: Map<string, NodePosition>): string {
  return JSON.stringify(
    {
      nodes: nodes.map((n) => ({
        id: n.nodeId,
        data: { label: n.label, type: n.type, groupKey: n.groupKey },
        position: pos.get(n.nodeId) ?? { x: 0, y: 0 },
      })),
      edges: edges.map((e) => ({
        id: e.edgeId,
        source: e.sourceNodeId,
        target: e.targetNodeId,
        label: e.type,
      })),
    },
    null,
    2,
  );
}

// ---------------------------------------------------------------- entry

/**
 * Genera il documento. `positions` sono quelle salvate nel layout richiesto;
 * se manca, si calcolano deterministicamente dagli archi.
 */
export function renderExport(
  format: VizExportFormat,
  input: { graph: VizGraph; nodes: VizNode[]; edges: VizEdge[]; positions?: Map<string, NodePosition> },
): RenderedExport {
  const { graph, nodes, edges } = input;
  const pos = input.positions && input.positions.size > 0
    ? input.positions
    : computeFallbackPositions(nodes, edges);

  switch (format) {
    case "SVG":
      return { content: renderSvg(graph, nodes, edges, pos), contentType: "image/svg+xml; charset=utf-8", extension: "svg" };
    case "MERMAID":
      return { content: renderMermaid(graph, nodes, edges), contentType: "text/vnd.mermaid; charset=utf-8", extension: "mmd" };
    case "GENERIC_JSON":
      return { content: renderGenericJson(graph, nodes, edges), contentType: "application/json; charset=utf-8", extension: "json" };
    case "REACT_FLOW_JSON":
      return { content: renderReactFlowJson(nodes, edges, pos), contentType: "application/json; charset=utf-8", extension: "json" };
    default:
      throw new Error(`Format ${format} is not renderable`);
  }
}
