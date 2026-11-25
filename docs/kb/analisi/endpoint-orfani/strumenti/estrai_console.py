#!/usr/bin/env python3
"""
estrai_console.py - V1 (punto 3): le pagine della console del datastore che toccano advanced.

USO   HEURESYS_DATASTORE=<repo> HEURESYS_ADVANCED=<repo> python3 estrai_console.py --out <cartella>
Scrive <out>/dati/console.json.   SOLA LETTURA.

COME LAVORA
  - pagine : ogni apps/console/src/app/**/page.tsx. Si segue la chiusura degli import relativi (profondita' 6) e la
             pagina 'tocca advanced' se un file della chiusura contiene tenantAdvanced | SERVIZIO_RTL | api-rtl |
             CAMPI_DI_ADVANCED | fonte === "advanced" | 'advanced' nel testo (commenti esclusi).
  - chiamate: letterali di percorso nei file della chiusura: /banco/api/datastore/*, /v1/*, /dati/*, /api-rtl/*, /api/*;
             il bersaglio e' dedotto dal prefisso: /api-rtl -> istanza RTL 3104 (sola lettura su base advanced);
             /api -> servizio 3101; /dati/* -> route handler della console (apps/console/src/app/dati/**/route.ts).
  - tabelle di advanced : tabelle sys.* citate nelle QUERY di apps/api/src/rtl_lettura.ts (l'istanza 3104 le legge in sola lettura).
LIMITI: una pagina che serve sia corse del datastore sia tenant di advanced (corsa/[id]) mostra chiamate di entrambe;
        la colonna 'solo_advanced' non e' distinguibile in modo statico.
"""
import argparse, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from estrai_rotte import camminata, toglie_commenti
from grafo_ts import Risolutore, importazioni, leggi_pulito, leggi_grezzo

DS = os.environ["HEURESYS_DATASTORE"]
CON = os.path.join(DS, "apps/console/src/app")
RIS = Risolutore({})
TOCCA = re.compile(r"tenantAdvanced\(|rigaDellaCorsa\(|corpoDellaCorsa\(|api-rtl|CAMPI_DI_ADVANCED|fonte\s*===?\s*[\"']advanced[\"']|\badvanced\s*(?:[=?:}),]|&&)|\{\s*advanced\b|SERVIZIO_RTL")
# file infrastrutturali che DEFINISCONO l'accesso ad advanced ma non dicono che la pagina lo usi
NEUTRI = ("/app/menu.ts", "/app/dati/corse.ts", "/app/guscio-console.tsx", "/src/banco/regia.ts")

def chiusura(f, prof=6):
    visti = {f: 0}; coda = [f]
    while coda:
        x = coda.pop(0)
        if visti[x] >= prof: continue
        for nome, (f2, orig, spec) in importazioni(x, RIS).items():
            if f2 and f2.startswith(DS) and f2 not in visti and "/apps/web/" not in f2 and "node_modules" not in f2 and f2.endswith((".ts", ".tsx", ".mjs")):
                visti[f2] = visti[x] + 1; coda.append(f2)
    return visti

def route(f):
    rel = os.path.relpath(os.path.dirname(f), CON)
    parts = [] if rel == "." else rel.split(os.sep)
    return "/" + "/".join(parts)

def tabelle_advanced():
    t = leggi_pulito(os.path.join(DS, "apps/api/src/rtl_lettura.ts"))
    m = re.search(r"export const QUERY.*?\n\};", t, re.S)
    blocco = m.group(0) if m else t
    return sorted(set(re.findall(r"\b(sys\.[a-z_0-9]+)\b", blocco)))

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--out", required=True); a = ap.parse_args()
    pagine = []
    for f in sorted(camminata(CON, (".tsx",))):
        if os.path.basename(f) != "page.tsx": continue
        cl = chiusura(f)
        prove = []
        for x in cl:
            t = leggi_pulito(x)
            if x.endswith(NEUTRI): continue
            m = TOCCA.search(t)
            if m: prove.append(f"{os.path.relpath(x, DS)}: '{m.group(0)}'")
        chiam = []
        for x in cl:
            t = leggi_pulito(x)
            for m in re.finditer(r"[\"'`]((?:/banco/api/datastore|/v1/|/dati/|/api-rtl/|/api/)[^\"'`\s]*)", t):
                p = re.sub(r"\$\{[^}]*\}", ":p", m.group(1)).split("?")[0]
                riga = t.count("\n", 0, m.start()) + 1
                if p.startswith("/api-rtl"): bers = "istanza RTL 3104 (sola lettura, base advanced)"
                elif p.startswith("/dati/"): bers = "route handler della console (server)"
                elif p.startswith("/api/"): bers = "servizio datastore 3101 (via rewrite /api)"
                else: bers = "servizio 3101 o 3104 (secondo la base passata a leggi())"
                ctx = t[max(0, m.start() - 80):m.start() + len(m.group(0)) + 60]
                m2 = re.search(r"method\s*:\s*[\"'](\w+)", ctx)
                chiam.append(dict(metodo=(m2.group(1).upper() if m2 else "GET"), percorso=p, bersaglio=bers, file=os.path.relpath(x, DS), riga=riga,
                                  con_base_rtl=bool(re.search(r"SERVIZIO_RTL", ctx))))
        visti = set(); dd = []
        for c in chiam:
            k = (c["metodo"], c["percorso"], c["file"])
            if k in visti: continue
            visti.add(k); dd.append(c)
        pagine.append(dict(route=route(f), file=os.path.relpath(f, DS), righe=len(leggi_grezzo(f).splitlines()), tocca_advanced=bool(prove), prove=prove[:6], chiamate=dd if prove else []))
    handlers = []
    for f in sorted(camminata(os.path.join(CON, "dati"), (".ts",))):
        if os.path.basename(f) == "route.ts":
            t = leggi_pulito(f)
            handlers.append(dict(route=route(f), file=os.path.relpath(f, DS), metodi=sorted(set(re.findall(r"export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)", t))),
                                 tocca_advanced=any(TOCCA.search(leggi_pulito(x)) for x in chiusura(f) if not x.endswith(NEUTRI))))
    out = dict(pagine=pagine, route_handler=handlers, tabelle_advanced_lette_da_3104=tabelle_advanced())
    os.makedirs(os.path.join(a.out, "dati"), exist_ok=True)
    json.dump(out, open(os.path.join(a.out, "dati", "console.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("console: pagine", len(pagine), "che toccano advanced", sum(1 for p in pagine if p["tocca_advanced"]), "route handler", len(handlers), "tabelle advanced", len(out["tabelle_advanced_lette_da_3104"]))
if __name__ == "__main__":
    main()
