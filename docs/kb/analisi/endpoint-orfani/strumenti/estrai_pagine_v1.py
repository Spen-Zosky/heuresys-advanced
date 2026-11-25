#!/usr/bin/env python3
"""
estrai_pagine_v1.py - V1: inventario delle pagine web di advanced (apps/web, apps/showcase) e delle loro chiamate API.

USO   HEURESYS_ADVANCED=<repo> python3 estrai_pagine_v1.py --endpoint <dati/endpoint.json> --out <cartella>
Scrive <out>/dati/pagine.json, <out>/dati/chiamate.json.   SOLA LETTURA.

COME LAVORA
  pagine     : ogni app/**/page.tsx; percorso = cartelle senza i gruppi (xxx); [param] resta. Layout, loading, error,
               not-found, route.ts e global-error sono elencati a parte (kind=layout|route-handler|...).
  chiamate   : in ogni file di apps/web/src si cercano le chiamate apiFetch/apiDownload/fetch; il primo argomento
               (stringa o template) si risolve sostituendo le costanti dello stesso file; il metodo e' quello di
               `method:` nelle opzioni (assente = GET). Percorsi passati come proprieta' (path:, basePath:) a hook o
               componenti che li concatenano (usePaginatedList, TimelinePanel) sono ricomposti per 'via-prop'.
  chiusura   : da ogni pagina si seguono, per nome, le funzioni/componenti importati (anche @/ e relativi) che i testi
               raggiunti citano, fino a profondita' 8; le chiamate sono quelle delle funzioni raggiunte.
               Le chiamate del layout (/v1/me, /v1/me/interfaces ...) sono attribuite al layout, non alle pagine.
  menu       : voci di sys.sys_ui_interfaces ricostruite dalle migrazioni (non e' lo stato vivo del database).
LIMITI: vedi LEGGIMI.md.
"""
import argparse, json, os, re, sys
from collections import defaultdict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from estrai_rotte import toglie_commenti, leggi, camminata, chiudi_parentesi, salta_stringa
from grafo_ts import (Risolutore, importazioni, riesportazioni, unita_del_file, unita_per_nome, leggi_pulito, leggi_grezzo, nome_default)
from estrai_endpoint import argomenti_toplevel
import estrai_pagine as EP   # riuso: segni(), parse_menu(), menu_letterali()

ADV = os.environ["HEURESYS_ADVANCED"]
WEB_SRC = os.path.join(ADV, "apps/web/src")
SHOW_SRC = os.path.join(ADV, "apps/showcase/src")
RIS_WEB = Risolutore({"@/": WEB_SRC + "/"})
RIS_SHOW = Risolutore({"@/": SHOW_SRC + "/"})

FETCH_FN = ("apiFetch", "apiDownload", "fetch")
RE_CALL = re.compile(r"(?<![\w$.])(apiFetch|apiDownload|fetch)\s*(?:<[^()]*?>)?\s*\(")

# ---------------------------------------------------------------- letterali e costanti
def letterali(testo):
    """(inizio, fine, valore_grezzo) dei letterali stringa/template di primo livello in `testo`."""
    out = []; i = 0; n = len(testo)
    while i < n:
        c = testo[i]
        if c in "'\"`":
            j = salta_stringa(testo, i)
            out.append((i, j, testo[i + 1:j - 1])); i = j; continue
        i += 1
    return out

def sostituisci_template(val, consts, prof=0):
    """val: contenuto di un template. Ritorna lista di candidati con ${CONST} sostituite; le altre ${..} -> \x00."""
    cands = [val]
    for _ in range(3):
        nuovi = []; cambiato = False
        for c in cands:
            m = re.search(r"\$\{\s*([A-Za-z_$][\w$]*)\s*\}", c)
            if m and m.group(1) in consts:
                for v in consts[m.group(1)][:4]:
                    nuovi.append(c[:m.start()] + v + c[m.end():]); cambiato = True
            else: nuovi.append(c)
        cands = nuovi
        if not cambiato: break
    return cands

def costanti_file(testo):
    """const NAME = <espressione con letterali> -> {NAME: [valori]} (solo valori che contengono /v1 o ${...})."""
    out = {}
    for m in re.finditer(r"(?:^|\n)\s*(?:export\s+)?(?:const|let)\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*", testo):
        ini = m.end()
        # espressione fino a ';' a profondita' 0 (max 400 caratteri)
        d = 0; i = ini; n = min(len(testo), ini + 700)
        while i < n:
            c = testo[i]
            if c in "'\"`": i = salta_stringa(testo, i); continue
            if c in "([{": d += 1
            elif c in ")]}":
                d -= 1
                if d < 0: break
            elif c == ";" and d == 0: break
            i += 1
        expr = testo[ini:i]
        vals = [v for (_, _, v) in letterali(expr) if "/v1" in v or v.startswith("${")]
        if vals and len(expr) < 700 and "=>" not in expr:
            out[m.group(1)] = vals
    return out

def normalizza(path):
    """valore candidato -> percorso normalizzato (/v1/...), segmenti variabili ':p'; None se non e' una rotta API."""
    p = path
    if p.startswith("/api/"): p = p[4:]
    p = p.split("?")[0] if "${" not in p.split("?")[0] else p
    p = re.sub(r"\$\{[^}]*\}", "\x00", p)
    p = p.split("?")[0]
    p = re.sub(r"(?<=[^/])\x00.*$", "", p)           # ${qs} attaccato al segmento: e' la query
    p = p.replace("\x00", ":p")
    if len(p) > 1 and p.endswith("/"): p = p[:-1]
    return p if p.startswith("/v1") else None

# ---------------------------------------------------------------- chiamate di un file
def chiamate_del_file(path):
    """lista di dict(pos, riga, metodo, percorsi[], espr, tipo) ; tipo = diretta | prop-template | non-risolta"""
    t = leggi_pulito(path)
    consts = costanti_file(t)
    out = []
    for m in RE_CALL.finditer(t):
        fn = m.group(1)
        ap = m.end() - 1
        fine = chiudi_parentesi(t, ap)
        args = argomenti_toplevel(t[ap + 1:fine - 1])
        if not args: continue
        a0 = args[0]
        opzioni = ",".join(args[1:])
        mm = re.search(r"\bmethod\s*:\s*[\"'`](\w+)[\"'`]", opzioni)
        if mm: metodo = mm.group(1).upper()
        elif re.search(r"\bmethod\s*:", opzioni): metodo = "?"
        else: metodo = "GET"
        if fn == "apiDownload": metodo = "GET"
        riga = t.count("\n", 0, m.start()) + 1
        lit = letterali(a0)
        cand = []; prop = None
        for (_, _, v) in lit:
            for c in sostituisci_template(v, consts):
                # template che comincia con ${IDENT} non risolto -> percorso passato come proprieta'
                mp = re.match(r"\$\{\s*([A-Za-z_$][\w$]*)\s*\}(.*)$", c, re.S)
                if mp:
                    suff = re.sub(r"\$\{[^}]*\}.*$", "", mp.group(2).split("?")[0])
                    prop = (mp.group(1), suff)
                    continue
                np_ = normalizza(c)
                if np_: cand.append(np_)
        if not lit:
            ident = a0.strip()
            if ident in consts:
                for v in consts[ident]:
                    for c in sostituisci_template(v, consts):
                        np_ = normalizza(c)
                        if np_: cand.append(np_)
            elif re.fullmatch(r"[A-Za-z_$][\w$]*", ident):
                prop = (ident, "")
        if cand:
            for c in dict.fromkeys(cand):
                out.append(dict(pos=m.start(), riga=riga, metodo=metodo, percorso=c, tipo="diretta", fn=fn))
        elif prop and prop[0] == "GATEWAY_URL":
            out.append(dict(pos=m.start(), riga=riga, metodo=metodo, percorso=prop[1] or "/", tipo="gateway", fn=fn))
        elif prop:
            out.append(dict(pos=m.start(), riga=riga, metodo=metodo, prop=prop[0], suffisso=prop[1], tipo="prop-template", fn=fn))
        elif fn != "fetch" or "/v1" in a0 or "GATEWAY" in a0:
            out.append(dict(pos=m.start(), riga=riga, metodo=metodo, percorso="<non risolto: " + re.sub(r"\s+", " ", a0.strip())[:60] + ">", tipo="non-risolta", fn=fn))
    # letterali '/api/v1/...' non dentro una chiamata (href/src): GET di navigazione
    spans = [(c["pos"], c["pos"]) for c in out]
    for m in re.finditer(r"[\"'`](/api/v1/[^\"'`\s]*)", t):
        # dentro una chiamata gia' contata?
        vicino = [c for c in out if 0 <= m.start() - c["pos"] < 300]
        if vicino: continue
        if m.group(1).endswith("/"): continue          # prefisso: lo gestisce il blocco delle costanti-prefisso
        np_ = normalizza(m.group(1))
        if np_:
            es = bool(re.search(r"EventSource\s*\(\s*$", t[max(0, m.start() - 40):m.start()]))
            out.append(dict(pos=m.start(), riga=t.count("\n", 0, m.start()) + 1, metodo="GET", percorso=np_, tipo="href/src", fn="EventSource (SSE)" if es else "letterale"))
    # costanti-prefisso (es. "/api/v1/me/content/media/") concatenate a un id e usate come href/src: GET sul prefisso + :p
    for nome, vals in consts.items():
        for v in vals:
            if v.startswith("/api/v1/") and v.endswith("/") and re.search(r"(?<![\w$])" + re.escape(nome) + r"(?![\w$])\s*\+|\$\{\s*" + re.escape(nome) + r"\s*\}", t):
                np_ = normalizza(v + "${id}")
                if np_ and not any(c.get("percorso") == np_ for c in out):
                    pos = t.find(v)
                    out.append(dict(pos=pos, riga=t.count("\n", 0, pos) + 1, metodo="GET", percorso=np_, tipo="href/src", fn="prefisso " + nome))
    return out

def valori_proprieta(path, ident):
    """letterali /v1/.. passati come ident="..." oppure ident: "..." in `path`."""
    t = leggi_pulito(path); out = []
    for m in re.finditer(r"(?<![\w$])" + re.escape(ident) + r"\s*(?:=\s*\{?|:\s*)[\"'`]((?:/api)?/v1/[^\"'`]*)[\"'`]", t):
        np_ = normalizza(m.group(1))
        if np_: out.append((np_, t.count("\n", 0, m.start()) + 1))
    return out

# ---------------------------------------------------------------- chiusura di una pagina
def simbolo(ris, f, nome, prof=0):
    us = [u for u in unita_per_nome(f, nome) if u.contenitore is None]
    if us or prof > 3: return us
    for (n, f3, orig) in riesportazioni(f, ris):
        if n == "*" or n == nome:
            r = simbolo(ris, f3, orig or nome, prof + 1)
            if r: return r
    return []

ESCLUSI = ("fetch.ts", "csrf-store.ts", "errors.ts", "download.ts")   # infrastruttura di rete: le sue chiamate interne (refresh, wrapper) non sono della pagina
RE_DYN = re.compile(r"import\(\s*[\"']([^\"']+)[\"']\s*\)")

def chiusura(ris, page_file, radice_src):
    """ritorna (file_raggiunti{file: profondita'}, unita_raggiunte[], file_con_tutto)"""
    file_info = {page_file: 0}
    unita_viste = set(); raggiunte = []
    coda = [(page_file, None, 0)]
    interi = {page_file}
    def aggiungi_file_intero(f, prof):
        for u in unita_del_file(f):
            k = (u.file, u.inizio)
            if k not in unita_viste:
                unita_viste.add(k); raggiunte.append((u, prof)); coda.append((u.file, u, prof))
    aggiungi_file_intero(page_file, 0)
    coda.append((page_file, None, 0))
    visti_testo = set()
    while coda:
        f, u, prof = coda.pop(0)
        testo = u.testo() if u else leggi_pulito(f)
        key = (f, u.inizio if u else -1)
        if key in visti_testo: continue
        visti_testo.add(key)
        if prof >= 8: continue
        imps = importazioni(f, ris)
        toks = set(re.findall(r"[A-Za-z_$][\w$]*", testo))
        for tok in sorted(toks):
            if tok in imps:
                f2, orig, _ = imps[tok]
                if not f2 or not f2.startswith(radice_src): continue
                if os.path.basename(f2) in ESCLUSI: continue
                if orig == "*":
                    for mm in re.finditer(r"(?<![\w$])" + re.escape(tok) + r"\.([A-Za-z_$][\w$]*)", testo):
                        for u2 in simbolo(ris, f2, mm.group(1)):
                            kk = (u2.file, u2.inizio)
                            if kk not in unita_viste:
                                unita_viste.add(kk); raggiunte.append((u2, prof + 1)); coda.append((u2.file, u2, prof + 1)); file_info.setdefault(u2.file, prof + 1)
                    continue
                nome = orig if orig != "default" else (nome_default(f2) or tok)
                us = simbolo(ris, f2, nome)
                if not us:
                    # file senza unita' riconoscibili: lo si prende intero
                    if f2 not in interi and unita_del_file(f2) == ():
                        interi.add(f2); file_info.setdefault(f2, prof + 1); coda.append((f2, None, prof + 1))
                for u2 in us:
                    kk = (u2.file, u2.inizio)
                    if kk not in unita_viste:
                        unita_viste.add(kk); raggiunte.append((u2, prof + 1)); coda.append((u2.file, u2, prof + 1)); file_info.setdefault(u2.file, prof + 1)
        for tok in sorted(toks):
            for u2 in unita_per_nome(f, tok):
                if u2.contenitore is None:
                    kk = (u2.file, u2.inizio)
                    if kk not in unita_viste:
                        unita_viste.add(kk); raggiunte.append((u2, prof)); coda.append((u2.file, u2, prof))
        for mm in RE_DYN.finditer(testo):
            f2 = ris.risolvi(mm.group(1), f)
            if f2 and f2.startswith(radice_src) and f2 not in interi:
                interi.add(f2); file_info.setdefault(f2, prof + 1); aggiungi_file_intero(f2, prof + 1)
    return file_info, raggiunte

# ---------------------------------------------------------------- rotte della pagina
def rotta_da_file(app_root, f):
    rel = os.path.relpath(os.path.dirname(f), app_root)
    parts = [] if rel == "." else [p for p in rel.split(os.sep)]
    gruppi = [p for p in parts if p.startswith("(") and p.endswith(")")]
    vere = [p for p in parts if not (p.startswith("(") and p.endswith(")"))]
    return "/" + "/".join(vere), ",".join(gruppi)

def layout_catena(app_root, f):
    d = os.path.dirname(f); out = []
    while True:
        for nome in ("layout.tsx", "template.tsx"):
            p = os.path.join(d, nome)
            if os.path.exists(p): out.append(os.path.relpath(p, ADV))
        if os.path.abspath(d) == os.path.abspath(app_root): break
        d = os.path.dirname(d)
    return out[::-1]

AREE = {
    "me": "ESS (/me) - area personale del dipendente", "analytics": "Analytics", "admin": "Amministrazione (ruoli, MFA)",
    "dashboard": "Cruscotti (famiglie)", "recruiting": "Recruiting", "showcase": "Showcase (identita' di marca)",
    "login": "Accesso", "privacy": "Pubblico", "jobs": "Pubblico (annunci)", "investors": "Pubblico (investitori)",
    "demo": "Pubblico (demo)", "whistleblowing": "Pubblico (segnalazioni anonime)", "whistleblowing-console": "Segnalazioni - console custode",
    "positions": "Posizioni", "organization": "Organizzazione", "org-director": "Organization Director", "process-owner": "Process Owner",
    "processes": "Processi", "tenants": "Tenant (piattaforma)", "tenant-blueprints": "Blueprint di tenant (piattaforma)", "blueprints": "Blueprint (catalogo)",
    "skills": "Competenze", "skill-taxonomy": "Competenze", "job-catalog": "Catalogo ruoli", "users": "Utenti", "learning": "Formazione", "gaps": "Formazione",
    "goals": "Obiettivi/OKR", "okrs": "Obiettivi/OKR", "kpis": "KPI", "performance": "Performance", "talent-review": "Talent review",
    "career-succession": "Carriera e successione", "compensation-intelligence": "Retribuzione", "engagement": "Engagement", "insights": "Insights",
    "approvals": "Approvazioni", "content": "Contenuti (handbook)", "projects": "Progetti", "time-off": "Assenze", "visualizations": "Visualizzazioni",
    "system-health": "Osservabilita'", "provenance": "Provenienza (Trust Ledger)", "generated-origins": "Provenienza", "seed-acquisition": "Piattaforma (seed)",
    "leads": "Piattaforma (lead)", "dev": "Sviluppo (agente)", "app": "Reindirizzamento", "": "Radice",
}

def area_di(route):
    seg = [s for s in route.split("/") if s]
    k = seg[0] if seg else ""
    return AREE.get(k, k)

# ---------------------------------------------------------------- natura
RE_TEMP = re.compile(r"temporane|temporary|\bprova\b|\bdemo\b|prototipo|prototype|placeholder|work in progress|\bWIP\b|da rimuovere|to be removed|usa e getta|throwaway|sandbox|playground|mock", re.I)
def natura_pagina(route, f, testo_grezzo, righe, redirect, in_menu):
    ev = []; nat = "produzione"
    seg = [s for s in route.split("/") if s]
    if seg and seg[0] == "showcase": nat = "demo/vetrina"; ev.append("route /showcase*: vetrina di marca; showcase/layout.tsx fa notFound() se NEXT_PUBLIC_ENABLE_SHOWCASE!=1 in produzione")
    if seg and seg[0] == "demo": nat = "demo"; ev.append("route /demo")
    if seg and seg[0] == "dev": nat = "di prova (sviluppo)"; ev.append("route /dev/*")
    if seg and seg[0] == "investors": nat = "demo/pubblico"; ev.append("route /investors")
    if redirect: nat = "redirect"; ev.append("la pagina contiene solo " + redirect)
    testa = testo_grezzo[:2500]
    m = RE_TEMP.search(testa)
    if m and nat == "produzione": ev.append(f"commento di testa cita '{m.group(0)}'")
    return nat, "; ".join(ev)

# ---------------------------------------------------------------- caratteristiche della pagina
GRAFICO = re.compile(r"Chart|ECharts|Radar|Sparkline|Graph(?!ql)|Plot|Heatmap|Gantt|OrgChart|Mermaid|NineBox|Canvas|Treemap|Sankey|Funnel|Gauge|Donut|BarList|Timeline", re.I)
TABELLA = re.compile(r"Table|DataGrid|Grid(?!Layout)|EntityTable", re.I)
DASH = re.compile(r"Dashboard|KPIStrip|KpiCard|StatCard|Widget|Kanban|Tile|AuditFeed", re.I)

def importi_ui(testo):
    nomi = []
    for m in re.finditer(r"import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*[\"'](@heuresys/ui[^\"']*)[\"']", testo):
        if re.match(r"\s*import\s+type", m.group(0)): continue
        for n in m.group(1).split(","):
            n = n.strip()
            if not n or n.startswith("type "): continue
            nomi.append(re.split(r"\s+as\s+", n)[0].strip())
    for m in re.finditer(r"import\(\s*[\"'](@heuresys/ui[^\"']*)[\"']\s*\)\.then\(\(m\)\s*=>\s*\(\{\s*default:\s*m\.(\w+)", testo):
        nomi.append(m.group(2))
    return nomi

def importi_librerie(testo):
    return sorted(set(m.group(1) for m in re.finditer(r"from\s*[\"'](echarts[^\"']*|recharts|d3[^\"']*|cytoscape[^\"']*|three[^\"']*|mermaid|@tanstack/react-table|reactflow|@xyflow/[^\"']*)[\"']", testo)))

def impostazioni(testi):
    """testi: lista di (file, testo) della pagina e dei suoi componenti locali."""
    out = dict(stati=[], searchparams=[], params=[], colonne=[], schede=[], page_size=[], widget_testid=[])
    for f, t in testi:
        for m in re.finditer(r"const\s*\[\s*([A-Za-z_$][\w$]*)\s*,\s*set[A-Z][\w$]*\s*\]\s*=\s*useState(?:<[^()]*?>)?\(\s*([^()]*(?:\([^()]*\))?[^()]*)\)", t):
            nome, ini = m.group(1), m.group(2).strip()
            if re.search(r"(?i)filter|status|stato|tab|view|vista|period|range|limit|sort|order|search|cerca|mode|year|anno|month|mese|scope|tipo|type|kind|category|group|level|livello|only|show|self|open", nome) and len(ini) < 60:
                out["stati"].append(f"{nome}={ini}")
        for m in re.finditer(r"searchParams\??\.get\(\s*[\"']([\w\-]+)[\"']", t): out["searchparams"].append(m.group(1))
        for m in re.finditer(r"params\s*:\s*\{([^{}]{0,200})\}", t): out["params"].append(re.sub(r"\s+", " ", m.group(1).strip()))
        for m in re.finditer(r"(?:^|[{,\s])header\s*:\s*(?:t\(\s*[\"']([\w.\-:]+)[\"']|[\"']([^\"']+)[\"'])", t):
            out["colonne"].append(m.group(1) or m.group(2))
        for m in re.finditer(r"initialPageSize\s*[:=]\s*\{?(\d+)", t): out["page_size"].append(m.group(1))
        for m in re.finditer(r"(?:limit|pageSize)\s*=\s*(\d+)", t): out["page_size"].append(m.group(1))
        # schede: tabs (id/key/value) in array di oggetti o TabsTrigger
        for m in re.finditer(r"<TabsTrigger[^>]*value=\"([\w\-]+)\"", t): out["schede"].append(m.group(1))
        for blocco in re.finditer(r"(?:tabs|TABS|sections|SECTIONS|items)\s*(?::[^=]+)?=\s*\[(.{0,1200}?)\]\s*(?:as const|;)", t, re.S):
            for m in re.finditer(r"(?:id|key|value)\s*:\s*[\"']([\w\-]+)[\"']", blocco.group(1)): out["schede"].append(m.group(1))
        for m in re.finditer(r"data-testid=\"([\w\-]*(?:card|kpi|chart|panel|widget|tile|graph|table)[\w\-]*)\"", t): out["widget_testid"].append(m.group(1))
    for k in out:
        out[k] = list(dict.fromkeys(out[k]))
    return out

def guardie_componente(testi):
    perms = []; ruoli = []; g403 = False
    for f, t in testi:
        for m in re.finditer(r"(?:perms|permissions|permSet|canSet)(?:\.data)?(?:\?\.)?(?:\.permissions)?(?:\?\.)?\.(?:has|includes)\(\s*[\"']([\w:]+)[\"']\s*\)", t): perms.append(m.group(1))
        for m in re.finditer(r"\.(?:has|includes)\(\s*[\"']([a-z_]+:[a-z_]+)[\"']\s*\)", t): perms.append(m.group(1))
        for m in re.finditer(r"roles(?:\?\.)?\.(?:includes|some)\(\s*(?:\([^)]*\)\s*=>\s*)?[\"']([A-Z_]{4,})[\"']", t): ruoli.append(m.group(1))
        for m in re.finditer(r"(?:primaryRole|role)\s*===\s*[\"']([A-Z_]{4,})[\"']", t): ruoli.append(m.group(1))
        if re.search(r"status\s*===\s*403|isForbidden|ForbiddenError", t): g403 = True
    return sorted(set(perms)), sorted(set(ruoli)), g403

def redirect_di(testo):
    m = re.search(r"redirect\(\s*[\"'`]([^\"'`]+)[\"'`]", testo)
    if m and len(testo.splitlines()) < 40: return f"redirect(\"{m.group(1)}\")"
    return None

# ---------------------------------------------------------------- confronto con gli endpoint
def indice_endpoint(endpoint):
    out = []
    for e in endpoint:
        if e["progetto"] != "advanced" or not e["percorso"].startswith("/v1"): continue
        segs = [s for s in e["percorso"].split("/") if s]
        out.append((e["metodo"], segs, e))
    return out

def trova(idx, metodo, percorso):
    segs = [s for s in percorso.split("/") if s]
    best = None; bs = -1
    stessa = []
    for (m, es, e) in idx:
        if len(es) != len(segs): continue
        ok = True; punti = 0
        for a, b in zip(es, segs):
            if a == b: punti += 2
            elif a.startswith(":") or b.startswith(":"): punti += 1
            else: ok = False; break
        if ok:
            stessa.append((m, e, punti))
    if metodo == "?":
        return (stessa[0][1] if stessa else None), [x[0] for x in stessa]
    giusti = [x for x in stessa if x[0] == metodo]
    if giusti:
        giusti.sort(key=lambda x: -x[2]); return giusti[0][1], [x[0] for x in stessa]
    return None, [x[0] for x in stessa]

# ---------------------------------------------------------------- menu (registro sys.sys_ui_interfaces dalle migrazioni)
def menu_da_migrazioni():
    """Come estrai_pagine.parse_menu, piu' gli UPDATE ... SET ... WHERE ui_interface_code|route = 'x' e i DELETE per codice."""
    base = EP.parse_menu()
    d = os.path.join(ADV, "db/migrations")
    per_codice = {}
    # mappa codice -> route dalle INSERT (stesso passaggio di parse_menu, ma tenendo il codice)
    for fn in sorted(os.listdir(d)):
        if not fn.endswith(".sql"): continue
        t = leggi(os.path.join(d, fn))
        if "sys_ui_interfaces" not in t: continue
        t_nc = re.sub(r"--[^\n]*", "", t)
        for mi in re.finditer(r"INSERT\s+INTO\s+sys\.sys_ui_interfaces\s*\(([^)]*)\)\s*(?:VALUES|SELECT)", t_nc, re.I):
            cols = [c.strip() for c in mi.group(1).split(",")]
            fine = t_nc.find(";", mi.end()); blocco = t_nc[mi.end():fine if fine > 0 else None]
            for tu in re.finditer(r"\(((?:[^()']|'[^']*')*)\)", blocco):
                parti = [x.strip() for x in re.split(r",(?=(?:[^']*'[^']*')*[^']*$)", tu.group(1))]
                if len(parti) != len(cols): continue
                row = dict(zip(cols, parti))
                rt = row.get("ui_interface_route", "").strip("'"); cd = row.get("ui_interface_code", "").strip("'")
                if rt.startswith("/") and cd: per_codice[cd] = rt
    for fn in sorted(os.listdir(d)):
        if not fn.endswith(".sql"): continue
        t = leggi(os.path.join(d, fn))
        if "sys_ui_interfaces" not in t: continue
        t_nc = re.sub(r"--[^\n]*", "", t)
        for mu in re.finditer(r"UPDATE\s+sys\.sys_ui_interfaces\s+(?:\w+\s+)?SET\s+(.*?)\s+WHERE\s+(ui_interface_code|ui_interface_route)\s*=\s*'([^']+)'", t_nc, re.I | re.S):
            rt = mu.group(3) if mu.group(2).lower().endswith("route") else per_codice.get(mu.group(3))
            if not rt or rt not in base: continue
            for ms in re.finditer(r"(ui_interface_\w+)\s*=\s*('[^']*'|true|false|NULL|\d+)", mu.group(1), re.I):
                col, val = ms.group(1).lower(), ms.group(2).strip("'")
                if col == "ui_interface_required_resource": base[rt]["resource"] = val
                elif col == "ui_interface_required_action": base[rt]["action"] = val
                elif col == "ui_interface_is_active": base[rt]["active"] = val.lower() == "true"
                elif col == "ui_interface_requires_admin": base[rt]["admin"] = val.lower() == "true"
                base[rt]["file"] = fn
        for md in re.finditer(r"DELETE\s+FROM\s+sys\.sys_ui_interfaces[^;]*?ui_interface_code\s*=\s*'([^']+)'", t_nc, re.I | re.S):
            rt = per_codice.get(md.group(1))
            if rt: base.pop(rt, None)
    return base

# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--endpoint", required=True); ap.add_argument("--out", required=True)
    a = ap.parse_args()
    endpoint = json.load(open(a.endpoint, encoding="utf-8"))["endpoint"]
    idx = indice_endpoint(endpoint)
    idx_gw = [(e["metodo"], [x for x in e["percorso"].split("/") if x], e) for e in endpoint if e["progetto"] == "agent-gateway"]
    menu = menu_da_migrazioni(); EP.LETT.update(EP.menu_letterali())

    # PUBLIC_PATHS dal proxy
    proxy = leggi_pulito(os.path.join(WEB_SRC, "proxy.ts"))
    mp = re.search(r"PUBLIC_PATHS\s*=\s*\[([^\]]*)\]", proxy)
    PUBLIC = re.findall(r"\"([^\"]+)\"", mp.group(1)) if mp else []
    def pubblica(route):
        if route == "/": return True
        return any(route == p or route.startswith(p + "/") for p in PUBLIC)

    # ---- pre-calcolo chiamate per file
    tutti_web = list(camminata(WEB_SRC, (".ts", ".tsx")))
    chiamate_f = {f: chiamate_del_file(f) for f in tutti_web if "/node_modules/" not in f}

    pagine = []; rel_righe = []; altri_file = []
    app_root = os.path.join(WEB_SRC, "app")
    elementi = []   # (kind, route, file)
    for f in camminata(app_root, (".tsx", ".ts", ".jsx", ".js")):
        b = os.path.basename(f)
        rt, gr = rotta_da_file(app_root, f)
        if b.startswith("page."): elementi.append(("page", rt, gr, f))
        elif b.startswith("layout."): elementi.append(("layout", rt, gr, f))
        elif b.startswith("route."): elementi.append(("route-handler", rt, gr, f))
        elif re.match(r"(loading|error|not-found|global-error|template|default)\.", b): elementi.append((b.split(".")[0], rt, gr, f))
        elif b in ("sitemap.ts", "robots.ts", "opengraph-image.tsx", "icon.tsx", "manifest.ts"): elementi.append(("metadata-route", rt, gr, f))
    elementi.sort(key=lambda x: (x[1], x[0]))

    def chiamate_raggiunte(ris, f_inizio, radice):
        file_info, raggiunte = chiusura(ris, f_inizio, radice)
        # unita raggiunte per file
        per_file = defaultdict(list)
        for u, prof in raggiunte: per_file[u.file].append(u)
        calls = []   # (file, chiamata)
        for f, lst in per_file.items():
            cs = chiamate_f.get(f)
            if cs is None:
                cs = chiamate_f[f] = chiamate_del_file(f)
            for c in cs:
                in_unita = [u for u in unita_del_file(f) if u.inizio <= c["pos"] < u.fine]
                if not in_unita or any((u.file, u.inizio) in {(x.file, x.inizio) for x in lst} for u in in_unita):
                    calls.append((f, c))
        # file senza unita (interi)
        for f in file_info:
            if f not in per_file and not unita_del_file(f):
                for c in chiamate_f.get(f, chiamate_del_file(f)): calls.append((f, c))
        return file_info, raggiunte, calls

    LAYOUT_CALLS = {}
    RAGGIUNTI_GLOBALI = set()
    pid = 0
    for kind, rt, gr, f in elementi:
        relf = os.path.relpath(f, ADV)
        grezzo = leggi_grezzo(f); pulito = leggi_pulito(f)
        righe_n = len(grezzo.splitlines())
        rec = dict(kind=kind, route=rt, gruppo_rotte=gr, file=relf, righe=righe_n, app="web")
        if kind not in ("page", "layout"):
            rec.update(note=("route handler" if kind == "route-handler" else kind)); pagine.append(rec); continue
        file_info, raggiunte, calls = chiamate_raggiunte(RIS_WEB, f, WEB_SRC)
        RAGGIUNTI_GLOBALI.update(file_info)
        dir_pag = os.path.dirname(f)
        if kind == "layout":
            LAYOUT_CALLS[relf] = calls
        # prop-template -> valori
        risolte = []
        for (cf, c) in calls:
            if c["tipo"] == "prop-template":
                vals = []
                for (ff, ci) in file_info.items() if False else []:
                    pass
            risolte.append((cf, c))
        # ricomposizione via-prop: valori passati come proprieta' nei testi raggiunti
        extra = []
        idents = {c["prop"] for (_, c) in calls if c["tipo"] == "prop-template"}
        if idents:
            testi_raggiunti = {u.file for u, _ in raggiunte}
            for ident in sorted(idents):
                for tf in sorted(testi_raggiunti):
                    for (np_, riga) in valori_proprieta(tf, ident):
                        for (cf, c) in calls:
                            if c["tipo"] == "prop-template" and c["prop"] == ident:
                                p = np_ + c["suffisso"]
                                extra.append((tf, dict(riga=riga, metodo=c["metodo"], percorso=p, tipo="via-prop", fn=c["fn"] + "+" + ident, da=os.path.relpath(cf, ADV) + f":{c['riga']}")))
        tutte = [(cf, c) for (cf, c) in calls if c["tipo"] != "prop-template"] + extra
        tutte.sort(key=lambda x: (x[0], x[1]["riga"], x[1]["metodo"], x[1]["percorso"]))
        # dedup
        viste = set(); fin = []
        for cf, c in tutte:
            k = (c["metodo"], c["percorso"], cf)
            if k in viste: continue
            viste.add(k); fin.append((cf, c))
        # testi della pagina e dei componenti locali / condivisi
        locali = [(ff, leggi_pulito(ff)) for ff in file_info if ff.startswith(dir_pag + os.sep) or ff == f]
        condivisi = [(ff, leggi_pulito(ff)) for ff in file_info if not (ff.startswith(dir_pag + os.sep) or ff == f)]
        ui_loc = sorted(set(n for _, t in locali for n in importi_ui(t)))
        comp_cond = sorted(set(os.path.relpath(ff, WEB_SRC) for ff, _ in condivisi if "/components/" in ff or "/lib/" in ff))
        ui_cond = sorted(set(n for ff, t in condivisi if "/components/" in ff for n in importi_ui(t)))
        librerie = sorted(set(l for _, t in locali + [x for x in condivisi if "/components/" in x[0]] for l in importi_librerie(t)))
        tutti_ui = sorted(set(ui_loc) | set(ui_cond))
        flag_tab = sorted(n for n in tutti_ui if TABELLA.search(n)) + sorted(os.path.basename(c).replace(".tsx", "") for c in comp_cond if re.search(r"table|data-table", c, re.I))
        flag_graf = sorted(n for n in tutti_ui if GRAFICO.search(n)) + librerie
        flag_dash = sorted(n for n in tutti_ui if DASH.search(n))
        perms, ruoli, g403 = guardie_componente(locali + [x for x in condivisi if "/components/" in x[0]])
        imp = impostazioni(locali + [x for x in condivisi if "/components/" in x[0] or "use-paginated" in x[0]])
        redir = redirect_di(pulito) if kind == "page" else None
        seg_ = EP.segni(pulito, f)
        for ff, t in locali:
            if ff != f: seg_ += [f"{os.path.relpath(ff, WEB_SRC)}: {s}" for s in EP.segni(t, ff)]
        # guardie web
        layout_ch = layout_catena(app_root, f) if kind == "page" else []
        g_mw = "pubblica (proxy.ts: nessun login richiesto)" if pubblica(rt) else "richiede cookie di sessione hrx_access|hrx_refresh, altrimenti redirect /login?next= (proxy.ts)"
        g_lay = []
        for l in layout_ch:
            if l.endswith("(authenticated)/layout.tsx"): g_lay.append("(authenticated)/layout.tsx: GET /v1/me, se 401/sessione scaduta router.replace('/login'); sidebar da GET /v1/me/interfaces; NESSUN controllo di ruolo sulla rotta")
            elif l.endswith("showcase/layout.tsx"): g_lay.append("showcase/layout.tsx: notFound() se NEXT_PUBLIC_ENABLE_SHOWCASE!=1 e NODE_ENV=production")
            elif l.endswith("system-health/layout.tsx"): g_lay.append("system-health/layout.tsx: pass-through (nessuna guardia)")
            elif l.endswith("app/layout.tsx"): g_lay.append("layout radice: provider (React Query, i18n, tema)")
            else: g_lay.append(l)
        g_comp = []
        if perms: g_comp.append("permessi controllati nel componente: " + ",".join(perms) + " (mostra/nasconde azioni)")
        if ruoli: g_comp.append("ruoli controllati: " + ",".join(ruoli))
        if g403: g_comp.append("gestisce risposta 403 dell'API")
        # menu
        m = menu.get(rt)
        if m is None and "[" in rt:
            prx = re.compile("^" + re.sub(r"\\\[[^/]+?\\\]", "[^/]+", re.escape(rt)) + "$")
            for k, v in menu.items():
                if prx.match(k): m = v; break
        menu_txt = ""
        in_menu = False
        if m:
            in_menu = m["active"]
            menu_txt = f"{'attiva' if m['active'] else 'INATTIVA'}; sezione {m.get('persp','')}; richiede {m.get('resource','NULL')}:{m.get('action','NULL')}{'; solo admin' if m.get('admin') else ''}; migrazione {m.get('file','')}"
        elif rt in EP.LETT:
            menu_txt = f"citata in {EP.LETT[rt]} (stato non determinato)"; in_menu = True
        rec.update(
            area=area_di(rt), render="client" if re.search(r"^\s*[\"']use client[\"']", pulito[:200]) else "server",
            layout_catena=";".join(layout_ch), guardia_middleware=g_mw, guardia_layout=" | ".join(g_lay), guardia_componente=" | ".join(g_comp),
            menu=menu_txt, in_menu=in_menu, ui_pagina=",".join(ui_loc), componenti_locali_condivisi=",".join(comp_cond), ui_via_componenti_condivisi=",".join(ui_cond),
            tabella=",".join(sorted(set(flag_tab))), grafico=",".join(sorted(set(flag_graf))), dashboard=",".join(sorted(set(flag_dash))),
            filtri_predefiniti=";".join(imp["stati"]), searchparams=",".join(imp["searchparams"]), params_lista=";".join(imp["params"]),
            colonne=f"{len(imp['colonne'])}: " + ",".join(imp["colonne"][:14]), schede=",".join(imp["schede"][:14]), page_size=",".join(imp["page_size"]),
            widget_testid=",".join(imp["widget_testid"][:12]), permessi_ui=",".join(perms), ruoli_ui=",".join(ruoli),
            segni_dato_fittizio=" | ".join(seg_), redirect=redir or "",
        )
        nat, ev = natura_pagina(rt, f, grezzo, righe_n, redir, in_menu)
        flags = sorted({m_ for _, t_ in locali for m_ in re.findall(r"NEXT_PUBLIC_[A-Z_]+", leggi_grezzo(_))} - {"NEXT_PUBLIC_API_PROXY_BASE_URL"})
        if flags: ev = (ev + "; " if ev else "") + "flag di build/ambiente nel codice: " + ",".join(flags)
        if re.search(r"[\"']/demo/\d+[\w\-]*\.png", pulito): ev = (ev + "; " if ev else "") + "mostra screenshot statici (public/demo/*.png), nessun dato vivo"
        rec.update(natura=nat, natura_evidenza=ev)
        # chiamate
        rec["chiamate"] = []
        for cf, c in fin:
            e, metodi = (None, [])
            if c["tipo"] == "gateway":
                e, metodi = trova(idx_gw, c["metodo"], c["percorso"])
            elif c["tipo"] != "non-risolta":
                e, metodi = trova(idx, c["metodo"], c["percorso"])
            origine = ("layout" if kind == "layout" else
                       "pagina" if cf == f else
                       "componente locale" if cf.startswith(dir_pag + os.sep) else
                       "componente condiviso" if "/components/" in cf else "libreria")
            rec["chiamate"].append(dict(metodo=c["metodo"], percorso=c["percorso"], tipo=c["tipo"], origine=origine,
                                        file=os.path.relpath(cf, ADV), riga=c["riga"], endpoint_id=((("[gateway] " if c["tipo"] == "gateway" else "") + f"{e['metodo']} {e['percorso']}") if e else ""),
                                        metodi_esistenti=",".join(sorted(set(metodi))), da=c.get("da", "")))
        pagine.append(rec)

    # ---- raggiungibilita' (riferimenti tra file)
    tutti_testi = {f: leggi_pulito(f) for f in tutti_web}
    for rec in pagine:
        if rec["kind"] != "page": continue
        rt = rec["route"]; stat = re.sub(r"/\[[^/]+\]", "", rt) or "/"
        if rt == "/": rec["raggiungibilita"] = "radice"; rec["riferita_da"] = ""; continue
        rx_t = re.compile(r"[\"'`]" + re.escape(stat) + r"(?:[\"'`/?#]|\$\{)")
        rx_d = None
        if "[" in rt:
            rx_d = re.compile(r"[\"'`]" + re.sub(r"\\\[[^/]+?\\\]", r"(?:\\$\\{[^}]*\\}|[^/\"'`]+)", re.escape(rt)) + r"(?:[\"'`?#]|\$\{)")
        refs = []
        propria = os.path.join(ADV, rec["file"])
        # ultimo segmento statico raggiunto con un template del tipo `${..}/${k}` (es. /positions/${id}/${k} con k in ["skills","kpis"])
        ultimo = rt.rsplit("/", 1)[-1]; padre = rt.rsplit("/", 1)[0]
        rx_e = None
        if ultimo and not ultimo.startswith("["):
            rx_e = re.compile("[`]" + re.sub(r"\\\[[^/]+?\\\]", r"(?:\\$\\{[^}]*\\}|[^/`]+)", re.escape(padre)) + r"/\$\{[^}]*\}")
            rx_s = re.compile("[\"']" + re.escape(ultimo) + "[\"']")
        for f, tx in tutti_testi.items():
            if f == propria: continue
            if "/app/showcase/" in f and not rt.startswith("/showcase"): continue
            if rx_t.search(tx) or (rx_d and rx_d.search(tx)): refs.append(os.path.relpath(f, WEB_SRC))
            elif rx_e is not None and rx_e.search(tx) and rx_s.search(tx): refs.append(os.path.relpath(f, WEB_SRC) + " (template dinamico)")
        rec["riferita_da"] = ";".join(refs[:6])
        rec["raggiungibilita"] = "menu" if rec.get("in_menu") else ("via link/codice" if refs else "ORFANA (nessun riferimento letterale)")

    # ---- apps/showcase
    show_pages = []
    for f in camminata(os.path.join(SHOW_SRC, "app"), (".tsx",)):
        b = os.path.basename(f)
        if b.startswith(("page.", "layout.")):
            rt, gr = rotta_da_file(os.path.join(SHOW_SRC, "app"), f)
            t = leggi_pulito(f)
            show_pages.append(dict(kind=b.split(".")[0], route=rt, gruppo_rotte=gr, file=os.path.relpath(f, ADV), righe=len(leggi_grezzo(f).splitlines()), app="showcase",
                                   redirect=redirect_di(t) or "", natura="demo/vetrina (export statico)", area="Showcase (sito statico GitHub Pages)", chiamate=[]))

    non_raggiunti = []
    for f in tutti_web:
        rel = os.path.relpath(f, WEB_SRC)
        if f in RAGGIUNTI_GLOBALI or rel.startswith(("app/", "locales/")) or f.endswith((".test.ts", ".test.tsx", ".d.ts")) or rel == "proxy.ts" or os.path.basename(f) in ESCLUSI: continue
        non_raggiunti.append(rel)
    with open(os.path.join(a.out, "dati", "pagine.json"), "w", encoding="utf-8") as f:
        json.dump(dict(file_web_non_raggiunti=sorted(non_raggiunti), web=pagine, showcase=show_pages, menu=menu, public_paths=PUBLIC), f, ensure_ascii=False, indent=1)
    print("web: page", sum(1 for p in pagine if p["kind"] == "page"), "layout", sum(1 for p in pagine if p["kind"] == "layout"),
          "altri", sum(1 for p in pagine if p["kind"] not in ("page", "layout")), "| showcase file", len(show_pages),
          "| chiamate totali", sum(len(p.get("chiamate", [])) for p in pagine))

if __name__ == "__main__":
    main()
