#!/usr/bin/env python3
"""
estrai_pagine.py - censimento statico delle pagine delle webapp (Next.js app router + banco statico).

USO   python3 estrai_pagine.py            (dopo estrai_rotte.py: legge strumenti/rotte.json)
Scrive strumenti/pagine.json e strumenti/F_tabella_pagine.md (tabella generata, incollata in F_webapp.md).
SOLA LETTURA sui repository.

COME LAVORA
  - pagine : ogni app/**/page.tsx ; percorso = cartelle senza i gruppi (xxx); [param] resta.
  - chiamate: per ogni pagina si segue la chiusura degli import locali (./ ../ @/) fino a profondita' 5,
              escluso @/lib/api/* e librerie; si raccolgono i letterali "/v1/..." (${..} -> :p, query tolta).
  - confronto con le rotte: la chiamata e' 'inesistente' se nessuna rotta dello stesso progetto ne ha il pattern
              (il metodo non e' verificato).
  - menu (solo advanced): il menu e' un registro DB (sys.sys_ui_interfaces) scritto dalle migrazioni:
              si ricostruisce leggendo le tuple con una rotta 'xxx' nelle migrazioni che citano la tabella,
              applicando in ordine DELETE e flag is_active. Non e' lo stato vivo del DB.
  - raggiungibilita': pagina 'in menu' se la rotta e' una voce attiva; 'via link' se un'altra pagina/componente
              contiene la rotta come letterale/template (href, router.push, tab); altrimenti 'orfana' (candidata).
  - segni di dato fittizio/statico (euristiche, da rileggere): array di >=3 oggetti letterali a livello di file
              fuori da tipi/i18n; Math.random; mock|fixture|lorem|dummy|fake|sample; TODO|FIXME|XXX|HACK;
              'coming soon|prossimamente|in arrivo|non ancora|work in progress|WIP|placeholder data|da implementare';
              pulsanti <Button>/<button> senza onClick/type/asChild/href/onSubmit (candidati 'senza handler').
LIMITI
  Euristiche lessicali: falsi positivi (array di colonne/opzioni) e falsi negativi (dati costruiti altrove)
  sono attesi. Le chiamate costruite per concatenazione o via client generati non sono viste.
  La chiusura degli import include componenti condivisi: una chiamata puo' venire da un componente usato da
  molte pagine ('via_condivisi'). La pagina /showcase di advanced contiene dati dimostrativi per disegno.
"""
import json, os, re, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from estrai_rotte import toglie_commenti, leggi, camminata

ADV = "/home/user/heuresys-advanced"
DS = "/home/user/heuresys-datastore"
OUT = "/mnt/project-files/consolidamento/lavoro/strumenti"

EST = (".tsx", ".ts", ".jsx", ".js", ".mjs")
RE_IMP = re.compile(r"(?:import|export)\s+(?:type\s+)?(?:[^'\"]*?\sfrom\s+)?[\"']([^\"']+)[\"']")
RE_DYN = re.compile(r"import\(\s*[\"']([^\"']+)[\"']\s*\)")

def risolvi(spec, da_file, src_root):
    if spec.startswith("@/"): base = os.path.join(src_root, spec[2:])
    elif spec.startswith("."): base = os.path.normpath(os.path.join(os.path.dirname(da_file), spec))
    else: return None
    for c in [base] + [base + e for e in EST] + [os.path.join(base, "index" + e) for e in EST]:
        if os.path.isfile(c): return c
    return None

def chiusura(f, src_root, prof=5):
    visti = {f: 0}; coda = [f]
    while coda:
        x = coda.pop(0)
        if visti[x] >= prof: continue
        s = leggi(x)
        for sp in RE_IMP.findall(s) + RE_DYN.findall(s):
            r = risolvi(sp, x, src_root)
            if r and r not in visti and os.path.basename(r) not in ("fetch.ts", "csrf-store.ts", "errors.ts", "download.ts") and "/showcase/" not in r.replace(os.sep, "/").split("/app/")[-1][:9]:
                visti[r] = visti[x] + 1; coda.append(r)
    return visti

RE_V1 = re.compile(r"[\"'`]((?:/api)?/v1/[^\"'`\s]*)")
def chiamate_in(testo):
    out = set()
    for m in RE_V1.finditer(testo):
        p = m.group(1)
        if p.count("${") > p.count("}"): p = p[:p.rfind("${")]       # template non chiuso dal limite lessicale: e' la query
        if p.startswith("/api"): p = p[4:]
        p = p.split("?")[0]
        p = re.sub(r"\$\{[^}]*\}", "\x00", p)
        p = re.sub(r"(?<=[^/])\x00.*$", "", p)          # ${qs} attaccato al segmento: e' la query
        p = p.replace("\x00", ":p")
        if p.endswith("/") and len(p) > 1: p = p[:-1]
        if p.startswith("/v1"): out.add(p)
    return out

def pattern_rotta(path):
    segs = [s for s in path.split("/") if s]
    return re.compile("^/" + "/".join(("[^/]+" if s.startswith(":") else (".*" if s == "*" else re.escape(s))) for s in segs) + "$")

SEGNI = [
 ("random", re.compile(r"Math\.random\(")),
 ("mock/fixture/dummy", re.compile(r"\b(mock|fixture|lorem|dummy|fake|stub)[A-Za-z]*\b", re.I)),
 ("TODO/FIXME", re.compile(r"\b(TODO|FIXME|XXX|HACK)\b")),
 ("coming-soon", re.compile(r"coming soon|prossimamente|in arrivo|work in progress|\bWIP\b|da implementare|non ancora implementat|not implemented|segnaposto", re.I)),
]
RE_ARR = re.compile(r"(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*\[\s*\{")
RE_BTN = re.compile(r"<(Button|button)\b([^>]*?)(/?)>", re.S)

def segni(testo_pulito, nome):
    out = []
    for k, rx in SEGNI:
        m = rx.findall(testo_pulito)
        if m: out.append(f"{k} x{len(m)}")
    # array letterali di oggetti: >=3 oggetti
    for m in RE_ARR.finditer(testo_pulito):
        j = m.end() - 1
        from estrai_rotte import chiudi_parentesi
        e = chiudi_parentesi(testo_pulito, j - 0 if testo_pulito[j] == "[" else testo_pulito.rfind("[", 0, j), "[", "]")
        blocco = testo_pulito[m.start():e]
        n = blocco.count("{")
        if n >= 3 and not re.search(r"(columns|COLUMNS|options|OPTIONS|tabs|TABS|STEPS|steps|FIELDS|fields|LABELS|ICON|NAV|MENU|filters|FILTERS|schema|SCHEMA|PERSPECTIVE|STATUS|status)", m.group(1)):
            out.append(f"array-letterale {m.group(1)} ({n} oggetti)")
    nb = 0
    for m in RE_BTN.finditer(testo_pulito):
        attr = m.group(2)
        if not re.search(r"onClick|type=|asChild|href|onSubmit|form=|\{\.\.\.|onPress|disabled|aria-hidden|render=", attr):
            nb += 1
    if nb: out.append(f"pulsanti-senza-handler-apparente x{nb}")
    return out

# ------------------------------------------------------------ menu advanced
def parse_menu():
    d = os.path.join(ADV, "db/migrations")
    menu = {}      # route -> dict(active, resource, action, admin, file)
    files = sorted(f for f in os.listdir(d) if f.endswith(".sql"))
    for fn in files:
        t = leggi(os.path.join(d, fn))
        if "sys_ui_interfaces" not in t: continue
        t_nc = re.sub(r"--[^\n]*", "", t)
        # colonne dell'INSERT, se presenti
        for mi in re.finditer(r"INSERT\s+INTO\s+sys\.sys_ui_interfaces\s*\(([^)]*)\)\s*(?:VALUES|SELECT)", t_nc, re.I):
            cols = [c.strip() for c in mi.group(1).split(",")]
            fine = t_nc.find(";", mi.end())
            blocco = t_nc[mi.end():fine if fine > 0 else None]
            for tu in re.finditer(r"\(([^()]*(?:'[^']*'[^()]*)*)\)", blocco):
                parti = [x.strip() for x in re.split(r",(?=(?:[^']*'[^']*')*[^']*$)", tu.group(1))]
                if len(parti) != len(cols): continue
                row = dict(zip(cols, parti))
                rt = row.get("ui_interface_route", "").strip("'")
                if not rt.startswith("/"): continue
                menu[rt] = dict(active=row.get("ui_interface_is_active", "true").lower() != "false",
                                resource=row.get("ui_interface_required_resource", "NULL").strip("'"),
                                action=row.get("ui_interface_required_action", "NULL").strip("'"),
                                admin=row.get("ui_interface_requires_admin", "false").lower() == "true",
                                persp=row.get("ui_interface_perspective", "").strip("'"), label=row.get("ui_interface_label", "").strip("'"), file=fn)
        # tuple della rimappatura (000163)
        for tu in re.finditer(r"\(\s*'(/[^']*)'\s*,\s*'([A-Z]+)'\s*,\s*'([a-z]+)'\s*,\s*'([^']*)'\s*,\s*(\d+)\s*,\s*(true|false)\s*\)", t_nc, re.I):
            r = tu.group(1)
            menu.setdefault(r, dict(resource="NULL", action="NULL", admin=False, file=fn))
            menu[r].update(active=tu.group(6).lower() == "true", persp=tu.group(2), label=tu.group(4), file=fn)
        for md in re.finditer(r"DELETE\s+FROM\s+sys\.sys_ui_interfaces[^;]*?ui_interface_route\s*=\s*'(/[^']+)'", t_nc, re.I | re.S):
            menu.pop(md.group(1), None)
    return menu

def menu_letterali():
    d = os.path.join(ADV, "db/migrations"); out = {}
    for fn in sorted(os.listdir(d)):
        if not fn.endswith(".sql"): continue
        t = leggi(os.path.join(d, fn))
        if "INSERT INTO sys.sys_ui_interfaces" not in t and "INSERT INTO sys.sys_ui_interfaces".lower() not in t.lower(): continue
        for m in re.finditer(r"'(/[a-z0-9\-/\[\]]*)'", re.sub(r"--[^\n]*", "", t)):
            out.setdefault(m.group(1), fn)
    return out

# ------------------------------------------------------------ pagine
def elenco_pagine(app_root):
    out = []
    for f in camminata(app_root, ("page.tsx", "page.jsx", "page.js")):
        rel = os.path.relpath(os.path.dirname(f), app_root)
        parts = [] if rel == "." else [p for p in rel.split(os.sep) if not (p.startswith("(") and p.endswith(")"))]
        out.append(("/" + "/".join(parts), f))
    return sorted(out)

LETT = {}
def analizza_web(nome, radice, rotte, menu=None):
    src_root = os.path.join(radice, "apps/web/src")
    app_root = os.path.join(src_root, "app")
    pat = [(r["metodo"], r["percorso"], pattern_rotta(r["percorso"])) for r in rotte if r["progetto"] == nome and r["percorso"].startswith("/v1")]
    tutti = {f: toglie_commenti(leggi(f)) for f in camminata(src_root, EST)}
    pagine = []
    for rt, f in elenco_pagine(app_root):
        cl = chiusura(f, src_root)
        dirpag = os.path.dirname(f)
        chiam = set(); segn = []; condivisi = set()
        for x, prof in cl.items():
            tx = tutti.get(x) or toglie_commenti(leggi(x))
            c = chiamate_in(tx)
            if x.startswith(dirpag + os.sep) or x == f:
                chiam |= c
                segn += [(os.path.relpath(x, src_root), s) for s in segni(tx, x)]
            else:
                if c: condivisi |= {(p, os.path.relpath(x, src_root)) for p in c}
        inesist = sorted(p for p in chiam | {p for p, _ in condivisi} if not any(rx.match(p) for _, _, rx in pat))
        # layout/gating
        pagine.append(dict(progetto=nome, route=rt, file=os.path.relpath(f, radice), righe=len(leggi(f).splitlines()),
                           chiamate=sorted(chiam), chiamate_da_componenti_condivisi=sorted({p for p, _ in condivisi}),
                           inesistenti=inesist, segni=[f"{a}: {b}" for a, b in segn]))
    # raggiungibilita': letterali di rotta in altri file
    for p in pagine:
        rt = p["route"]
        stat = re.sub(r"/\[[^/]+\]", "", rt) or "/"
        if rt == "/": p["raggiungibilita"] = "radice"; continue
        cand = [stat]
        rx_t = re.compile(r"[\"'`]" + re.escape(stat) + r"(?:[\"'`/?#]|\$\{)")
        rx_d = None
        if "[" in rt:
            rx_d = re.compile(r"[\"'`]" + re.sub(r"\\\[[^/]+?\\\]", r"(?:\\$\\{[^}]*\\}|[^/\"'`]+)", re.escape(rt)) + r"(?:[\"'`?#]|\$\{)")
        refs = []
        propria = os.path.join(radice, p["file"])
        for f, tx in tutti.items():
            if f == propria: continue
            if "/showcase/" in f.replace(os.sep, "/") and not rt.startswith("/showcase"): continue
            if rx_t.search(tx) or (rx_d and rx_d.search(tx)): refs.append(os.path.relpath(f, src_root))
        p["riferita_da"] = refs[:5]; p["n_riferimenti"] = len(refs)
        in_menu = False
        if menu is not None:
            m = menu.get(rt)
            if m is None:
                prx = re.compile("^" + re.sub(r"\\\[[^/]+?\\\]", "[^/]+", re.escape(rt)) + "$")
                for k, v in menu.items():
                    if prx.match(k): m = v; break
            if m is None and rt in LETT:
                p["menu"] = f"voce trovata solo per letterale in {LETT[rt]} (stato attivo non verificato)"; in_menu = True
            if m: p["menu"] = f"{'attiva' if m['active'] else 'INATTIVA'} ({m.get('persp','')}; {m.get('resource','NULL')}:{m.get('action','NULL')}{'; admin' if m.get('admin') else ''})"; in_menu = m["active"]
        p["in_menu"] = in_menu
        p["raggiungibilita"] = "menu" if in_menu else ("via link" if refs else "ORFANA (nessun riferimento)")
    return pagine, tutti

def banco_ds():
    """apps/banco: pagina statica unica. Chiamate = letterali /banco/api/datastore e /v1."""
    base = os.path.join(DS, "apps/banco")
    chiam = set(); segn = []
    for f in camminata(base, (".js", ".mjs", ".html")):
        t = toglie_commenti(leggi(f))
        for m in re.finditer(r"[\"'`]((?:/banco/api/datastore|/v1)[^\"'`\s]*)", t):
            p = re.sub(r"\$\{[^}]*\}", ":p", m.group(1)).split("?")[0]
            chiam.add(p)
        for k, rx in SEGNI:
            n = len(rx.findall(t))
            if n: segn.append(f"{os.path.relpath(f, base)}: {k} x{n}")
    return sorted(chiam), segn

def main():
    rotte = json.load(open(os.path.join(OUT, "rotte.json")))["rotte"]
    menu = parse_menu()
    LETT.update(menu_letterali())
    pa, tutti_a = analizza_web("advanced", ADV, rotte, menu)
    pd, tutti_d = analizza_web("datastore", DS, rotte, None)
    bch, bsegn = banco_ds()
    # rotte senza pagina (advanced): n_consumatori==0
    json.dump(dict(advanced=pa, datastore=pd, menu=menu, banco_chiamate=bch, banco_segni=bsegn), open(os.path.join(OUT, "pagine.json"), "w"), ensure_ascii=False, indent=1)
    print("pagine advanced", len(pa), "datastore", len(pd), "voci di menu ricostruite", len(menu), "attive", sum(1 for v in menu.values() if v["active"]))

if __name__ == "__main__":
    main()
