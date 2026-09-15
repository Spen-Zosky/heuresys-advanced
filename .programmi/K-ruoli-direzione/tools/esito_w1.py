#!/usr/bin/env python3
"""esito_w1.py — F1 passo W3: dai `_risultato.json` dei lanci di W1 produce una BOZZA per indagine
in esiti/_bozza_<voce>.md: comandi con numero e stato di verifica (VERIFICATO / DISCORDANTE con il
numero del verificatore), risposte con file:riga, non_misurato, discrepanze, e le voci «manca» del
critico. La sessione principale completa la bozza in linea (ri-misure, verdetto) e la salva come
esiti/<voce>.md. Uso: python tools/esito_w1.py <cartella_run> [<cartella_run_b> ...]
La voce vince nell'ULTIMA cartella in cui compare con spia_trovata=true.
"""
from __future__ import annotations

import json
import os
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
RADICE_K = os.path.dirname(QUI)
ESITI = os.path.join(RADICE_K, "esiti")

vinc: dict[str, dict] = {}
critiche: dict[str, list] = {}
for cart in sys.argv[1:]:
    r = json.load(open(os.path.join(cart, "_risultato.json"), encoding="utf-8"))
    res = r["result"]
    for e in res["esiti"]:
        if e.get("spia_trovata"):
            vinc[e["voce"]] = {"esito": e, "cartella": cart, "runId": r.get("runId", "?")}
    for m in res.get("critica", {}).get("manca", []):
        critiche.setdefault(m["voce"], []).append((cart, m))

for voce, v in vinc.items():
    e, cart = v["esito"], v["cartella"]
    l, ver = e["lettura"], e["verifica"] or {"discrepanze": [], "ricontrollati": 0}
    disc = {d["comando"]: d for d in ver["discrepanze"]}
    out = [f"# {voce} — BOZZA generata da esito_w1.py (cartella `{cart}`)", "",
           f"Lettore + verificatore: spia trovata; ricontrollati {ver.get('ricontrollati')} comandi, {len(ver['discrepanze'])} discrepanze (la prima e' la spia).", "",
           "## Comandi e numeri", "", "| # | stato | numero lettore | numero verificatore | comando |", "|---|---|---|---|---|"]
    for i, c in enumerate(l["comandi"]):
        d = disc.get(c["comando"])
        if i == 0:
            stato, nv = "SPIA (+7 trovata)", (d["ottenuto"] if d else "")
        elif d:
            stato, nv = "**DISCORDANTE**", d["ottenuto"]
        else:
            stato, nv = "verificato", ""
        cmd = c["comando"].replace("|", "\\|").replace("\n", " ")
        out.append(f"| {i} | {stato} | {c['numero']} | {nv} | `{cmd}` |")
    # discrepanze su comandi riscritti (non corrispondono a nessun comando del lettore)
    extra = [d for d in ver["discrepanze"] if d["comando"] not in {c["comando"] for c in l["comandi"]}]
    if extra:
        out += ["", "Discrepanze del verificatore su comandi riscritti (non combaciano per stringa):", ""]
        for d in extra:
            out.append(f"- atteso {d['atteso']} → ottenuto {d['ottenuto']} · `{str(d['comando']).replace('|', chr(92)+'|')[:200]}`")
    out += ["", "## Output grezzi (prime righe)", ""]
    for i, c in enumerate(l["comandi"]):
        og = (c.get("output_grezzo") or "").strip().replace("\r", "")
        out.append(f"- [{i}] {og[:300]}")
    out += ["", "## Risposte del lettore", ""]
    for r_ in l["risposte"]:
        out += [f"### {r_['domanda']}", "", r_["risposta"], ""]
        for fr in r_.get("file_riga", []):
            out.append(f"- `{fr}`")
        out.append("")
    out += ["## Non misurato dal lettore", ""] + [f"- {x}" for x in l["non_misurato"]] + [""]
    out += ["## Il critico di completezza dice che manca", ""]
    for cart_c, m in critiche.get(voce, []):
        out.append(f"- **{m['cosa']}** — {m['perche']}")
    out += ["", "## Ri-misure in linea (sessione principale)", "", "(da compilare)", "", "## Verdetto", "", "(da compilare)"]
    p = os.path.join(ESITI, f"_bozza_{voce}.md")
    open(p, "w", encoding="utf-8", newline="\n").write("\n".join(out) + "\n")
    print(f"{voce:<12} -> {os.path.relpath(p, RADICE_K)}  ({len(l['comandi'])} comandi, {len(l['risposte'])} risposte, {len(critiche.get(voce, []))} manca)")
for voce, lst in critiche.items():
    if voce not in vinc:
        print(f"{voce:<12} critiche senza esito valido: {len(lst)}")
