#!/usr/bin/env python3
"""
build_graph_hub.py — Genera una dashboard-hub HTML (brand identity heuresys) che elenca
tutte le visualizzazioni graphify del dominio heuresys-advanced e permette di aprirle.

Token brand verbatim da apps/showcase/src/app/globals.css + bundle ux-design v1:
  surfaces #FAFBFD/#FFFFFF/#F1F4F9, ink #0F1828/#475569, border #E2E6EE,
  primary (action) #2563EB, logo blue #3B82F6, accent purple #A855F7 (personality moment),
  categorical palette #2563EB/#06B6D4/#7C3AED/#F59E0B (per-subsystem encoding).

Scansiona <graph-root>/**/graphify-out/graph.json, legge i conteggi, emette
<graph-root>/index.html. Idempotente. Auto-rigenerato da sync.{sh,ps1}.

Usage: python build_graph_hub.py [graph-root]
"""
import glob
import html
import json
import os
import sys
from datetime import datetime, timezone

DEFAULT_ROOT = r"C:\Users\enzospenuso\wiki-space\heuresys-advanced-graph"
PALETTE = ["#2563EB", "#06B6D4", "#7C3AED", "#F59E0B"]  # categorical (brand --palette-1..4)
ACCENT = "#A855F7"  # brand purple — personality moment (full domain)


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
    p = rel_dir.replace("\\", "/").replace("src-mirror/", "").replace("/graphify-out", "")
    return "Dominio completo" if p in ("", "src-mirror") else p


def main(argv):
    root = argv[1] if len(argv) > 1 else DEFAULT_ROOT
    graphs = []
    for gj in glob.glob(os.path.join(root, "**", "graphify-out", "graph.json"), recursive=True):
        gdir = os.path.dirname(gj)
        rel = os.path.relpath(gdir, root).replace("\\", "/")
        n, e, c = counts(gj)
        graphs.append({
            "label": label_for(rel), "rel": rel, "n": n, "e": e, "c": c,
            "html": os.path.exists(os.path.join(gdir, "graph.html")),
            "tree": os.path.exists(os.path.join(gdir, "GRAPH_TREE.html")),
            "report": os.path.exists(os.path.join(gdir, "GRAPH_REPORT.md")),
        })
    graphs.sort(key=lambda g: (g["label"] != "Dominio completo", -(g["n"] or 0)))

    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    cards = []
    pi = 0
    for g in graphs:
        rel, full = g["rel"], (g["label"] == "Dominio completo")
        accent = ACCENT if full else PALETTE[pi % len(PALETTE)]
        if not full:
            pi += 1
        meta = (f'{g["n"]:,} nodi &middot; {g["e"]:,} edge &middot; {g["c"]} community'
                if g["n"] is not None else "conteggi n/d")
        heavy = (g["n"] or 0) > 5000
        btns = []
        if g["html"]:
            w = ' data-heavy="1" title="grafo grande: primo caricamento pesante"' if heavy else ""
            btns.append(f'<a class="btn primary" href="{rel}/graph.html"{w}>Grafo interattivo</a>')
        if g["tree"]:
            btns.append(f'<a class="btn" href="{rel}/GRAPH_TREE.html">Albero</a>')
        if g["report"]:
            btns.append(f'<a class="btn ghost" href="{rel}/GRAPH_REPORT.md">Report</a>')
        heavy_badge = '<span class="badge heavy">heavy</span>' if heavy else ''
        cards.append(f'''      <article class="card{' hero' if full else ''}" style="--accent:{accent}">
        <div class="bar"></div>
        <div class="body">
          <div class="card-h"><h3>{html.escape(g["label"])}</h3>{heavy_badge}</div>
          <p class="meta">{meta}</p>
          <div class="btns">{''.join(btns)}</div>
        </div>
      </article>''')

    doc = f'''<!doctype html>
<html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Heuresys Advanced &middot; Knowledge Graph</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Exo+2:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root {{
    --background:#FAFBFD; --foreground:#0F1828; --card:#FFFFFF; --muted:#F1F4F9;
    --muted-foreground:#475569; --border:#E2E6EE; --primary:#2563EB; --logo:#3B82F6;
    --accent-purple:#A855F7; --radius:14px;
    --font:"Exo 2",Inter,system-ui,-apple-system,Segoe UI,sans-serif;
    --mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
  }}
  * {{ box-sizing:border-box; }}
  body {{ margin:0; background:var(--background); color:var(--foreground); font-family:var(--font); }}
  header {{ padding:40px 40px 28px; border-bottom:1px solid var(--border); background:var(--card); }}
  .wordmark {{ font-size:27px; font-weight:700; letter-spacing:-.5px; color:var(--logo); }}
  .wordmark .y {{ color:var(--accent-purple); }}
  .wordmark .adv {{ color:var(--muted-foreground); font-weight:500; letter-spacing:-.01em; margin-left:6px; }}
  .tag {{ display:inline-block; margin-left:10px; font-size:11px; font-weight:600; color:var(--primary);
          background:hsl(221 83% 53% / .08); border:1px solid hsl(221 83% 53% / .18);
          padding:2px 9px; border-radius:999px; vertical-align:middle; }}
  .sub {{ color:var(--muted-foreground); font-size:13px; margin-top:8px; }}
  main {{ max-width:1180px; margin:0 auto; padding:32px 40px 56px; }}
  .grid {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(290px,1fr)); gap:18px; }}
  .card {{ position:relative; display:flex; background:var(--card); border:1px solid var(--border);
           border-radius:var(--radius); overflow:hidden; transition:box-shadow .18s, transform .18s; }}
  .card:hover {{ box-shadow:0 6px 18px hsl(221 83% 53% / .12); transform:translateY(-2px); }}
  .card.hero {{ grid-column:1 / -1; }}
  .bar {{ width:5px; background:var(--accent); flex:0 0 5px; }}
  .body {{ padding:18px 20px; flex:1; }}
  .card-h {{ display:flex; align-items:center; gap:10px; }}
  h3 {{ margin:0; font-size:16px; font-weight:600; }}
  .card.hero h3 {{ font-size:19px; }}
  .badge.heavy {{ font-size:10px; font-weight:600; color:#9A3412; background:#FEF3C7;
                  border:1px solid #FDE68A; padding:1px 7px; border-radius:999px; }}
  .meta {{ color:var(--muted-foreground); font-size:12.5px; margin:6px 0 16px; }}
  .btns {{ display:flex; flex-wrap:wrap; gap:8px; }}
  .btn {{ font:500 13px var(--font); text-decoration:none; padding:8px 14px; border-radius:9px;
          border:1px solid var(--border); color:var(--foreground); background:var(--muted); }}
  .btn:hover {{ border-color:var(--accent); }}
  .btn.primary {{ background:var(--primary); border-color:var(--primary); color:#fff; }}
  .btn.primary:hover {{ filter:brightness(1.06); }}
  .btn.ghost {{ background:transparent; color:var(--muted-foreground); }}
  footer {{ max-width:1180px; margin:0 auto; padding:0 40px 40px; color:var(--muted-foreground); font-size:12px; }}
  footer code {{ background:var(--muted); padding:1px 6px; border-radius:5px; font-size:11px; font-family:var(--mono); }}
</style></head>
<body>
  <header>
    <div class="wordmark">heures<span class="y">y</span>s<span class="adv">advanced</span><span class="tag">Knowledge Graph</span></div>
    <div class="sub">Mappa del dominio via graphify (AST + community detection) &middot; {len(graphs)} grafi &middot; sorgenti lette in-place, zero copie &middot; aggiornato {ts}</div>
  </header>
  <main>
    <div class="grid">
{chr(10).join(cards)}
    </div>
  </main>
  <footer>
    Rigenera: <code>docs/kb/tools/sync.sh</code> (full + hub) &middot; sottografi <code>graphify update "&lt;mirror&gt;/&lt;sub&gt;"</code> &middot;
    query <code>graphify query "..." --graph &lt;graph.json&gt;</code>. I Report sono Markdown (resi come testo dal browser).
    Token: brand identity heuresys v1 (palette categorica + accent viola = personality moment).
  </footer>
</body></html>'''

    out = os.path.join(root, "index.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(doc)
    print(f"OK: hub brand-aligned con {len(graphs)} grafi -> {out}")


if __name__ == "__main__":
    sys.exit(main(sys.argv))
