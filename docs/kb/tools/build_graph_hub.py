#!/usr/bin/env python3
"""
build_graph_hub.py — Genera una pagina-hub HTML che elenca tutte le visualizzazioni
graphify del dominio heuresys-advanced e permette di aprirle.

Scansiona <graph-root>/**/graphify-out/graph.json, ne legge i conteggi, ed emette
<graph-root>/index.html con una card per sottosistema (link a graph.html, GRAPH_TREE.html,
GRAPH_REPORT.md). Idempotente. Auto-aggiornabile (chiamato da sync).

Usage: python build_graph_hub.py [graph-root]
Default root: C:\\Users\\enzospenuso\\wiki-space\\heuresys-advanced-graph
"""
import glob
import html
import json
import os
import sys
from datetime import datetime, timezone

DEFAULT_ROOT = r"C:\Users\enzospenuso\wiki-space\heuresys-advanced-graph"


def counts(graph_json):
    try:
        with open(graph_json, "r", encoding="utf-8") as f:
            d = json.load(f)
        nodes = d.get("nodes", [])
        edges = d.get("edges", d.get("links", []))
        comms = {n.get("community") for n in nodes if isinstance(n, dict)}
        comms.discard(None)
        return len(nodes), len(edges), len(comms)
    except Exception:
        return None, None, None


def label_for(rel_dir):
    # rel_dir es. "src-mirror/apps/api/graphify-out" -> "apps/api"; "src-mirror/graphify-out" -> "DOMINIO COMPLETO"
    p = rel_dir.replace("\\", "/")
    p = p.replace("src-mirror/", "").replace("/graphify-out", "")
    return "DOMINIO COMPLETO" if p in ("", "src-mirror") else p


def main(argv):
    root = argv[1] if len(argv) > 1 else DEFAULT_ROOT
    graphs = []
    for gj in glob.glob(os.path.join(root, "**", "graphify-out", "graph.json"), recursive=True):
        gdir = os.path.dirname(gj)
        rel = os.path.relpath(gdir, root)
        n, e, c = counts(gj)
        has_html = os.path.exists(os.path.join(gdir, "graph.html"))
        has_tree = os.path.exists(os.path.join(gdir, "GRAPH_TREE.html"))
        has_report = os.path.exists(os.path.join(gdir, "GRAPH_REPORT.md"))
        graphs.append({
            "label": label_for(rel),
            "rel": rel.replace("\\", "/"),
            "n": n, "e": e, "c": c,
            "html": has_html, "tree": has_tree, "report": has_report,
        })
    # ordina: DOMINIO COMPLETO primo, poi per nodi desc
    graphs.sort(key=lambda g: (g["label"] != "DOMINIO COMPLETO", -(g["n"] or 0)))

    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    cards = []
    for g in graphs:
        rel = g["rel"]
        meta = (f'{g["n"]} nodi · {g["e"]} edge · {g["c"]} community'
                if g["n"] is not None else "conteggi n/d")
        big = " big" if (g["n"] or 0) > 5000 else ""
        btns = []
        if g["html"]:
            warn = ' title="grafo grande: primo load pesante"' if big else ""
            btns.append(f'<a class="btn primary{big}" href="{rel}/graph.html"{warn}>◉ Grafo</a>')
        if g["tree"]:
            btns.append(f'<a class="btn" href="{rel}/GRAPH_TREE.html">🌳 Albero</a>')
        if g["report"]:
            btns.append(f'<a class="btn ghost" href="{rel}/GRAPH_REPORT.md">📄 Report (.md)</a>')
        cards.append(f'''    <div class="card">
      <div class="title">{html.escape(g["label"])}</div>
      <div class="meta">{meta}</div>
      <div class="btns">{''.join(btns)}</div>
    </div>''')

    doc = f'''<!doctype html>
<html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Heuresys Advanced — Knowledge Graph Hub</title>
<style>
  :root {{ color-scheme: dark; }}
  body {{ font: 15px/1.5 system-ui,Segoe UI,sans-serif; margin:0; background:#0e1116; color:#e6edf3; }}
  header {{ padding:28px 32px; border-bottom:1px solid #21262d; }}
  h1 {{ margin:0 0 4px; font-size:22px; }}
  .sub {{ color:#8b949e; font-size:13px; }}
  .grid {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:16px; padding:28px 32px; }}
  .card {{ background:#161b22; border:1px solid #21262d; border-radius:12px; padding:18px; }}
  .title {{ font-weight:600; font-size:16px; margin-bottom:6px; }}
  .meta {{ color:#8b949e; font-size:12px; margin-bottom:14px; }}
  .btns {{ display:flex; flex-wrap:wrap; gap:8px; }}
  .btn {{ display:inline-block; padding:7px 12px; border-radius:8px; text-decoration:none;
          font-size:13px; border:1px solid #30363d; color:#e6edf3; background:#21262d; }}
  .btn:hover {{ border-color:#58a6ff; }}
  .btn.primary {{ background:#1f6feb; border-color:#1f6feb; color:#fff; }}
  .btn.primary.big {{ background:#9e6a03; border-color:#9e6a03; }}
  .btn.ghost {{ background:transparent; color:#8b949e; }}
  footer {{ padding:18px 32px; color:#6e7681; font-size:12px; border-top:1px solid #21262d; }}
  code {{ background:#21262d; padding:1px 5px; border-radius:4px; }}
</style></head>
<body>
<header>
  <h1>Heuresys Advanced — Knowledge Graph Hub</h1>
  <div class="sub">Visualizzazioni graphify del dominio · {len(graphs)} grafi · rigenerato {ts}</div>
</header>
<div class="grid">
{chr(10).join(cards)}
</div>
<footer>
  Sorgenti lette in-place (zero copie). Rigenera: <code>docs/kb/tools/sync.sh</code> +
  <code>build_graph_hub.py</code>. Query testuale: <code>graphify query "..." --graph &lt;graph.json&gt;</code>.
  I <code>.md</code> aprono come testo nel browser (usa Notepad++ per leggerli formattati).
</footer>
</body></html>'''

    out = os.path.join(root, "index.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(doc)
    print(f"OK: hub con {len(graphs)} grafi -> {out}")


if __name__ == "__main__":
    sys.exit(main(sys.argv))
