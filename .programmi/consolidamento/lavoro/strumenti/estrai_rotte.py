#!/usr/bin/env python3
"""
estrai_rotte.py - censimento statico delle rotte HTTP di heuresys-advanced e heuresys-datastore.

USO
    python3 estrai_rotte.py [--advanced DIR] [--datastore DIR] [--out DIR]
Predefiniti: /home/user/heuresys-advanced, /home/user/heuresys-datastore,
             /mnt/project-files/consolidamento/lavoro
Scrive:  <out>/E_api.tsv        (una riga per rotta)
         <out>/strumenti/rotte.json  (stesso dato + tabelle e consumatori, per estrai_pagine.py)
Sola lettura sui repository. Nessun avvio di server, nessun database.

COME LAVORA
  advanced : legge apps/api/src/app.ts (import + app.register(..., {prefix})) e per ogni plugin
             scandisce il file routes con un parser di parentesi che conosce stringhe e commenti.
             Per ogni app.<metodo>(path, opzioni, handler) estrae requirePermission("...") e
             le altre guardie (verifyCsrf, requireXxx), config.catalogGate/orgGate/tenantGate.
  datastore: legge apps/api/src/servizio.ts, servizio_rtl.ts, banco_interfaccia.ts con lo stesso parser.
             Il datastore non ha RBAC: l'identita' e' fissa (involucro.ts) ; come "permesso" si riporta
             l'etichetta passata a scrivendo(r, "xxx:yyy") se c'e', altrimenti "nessuno (identita' fissa)".
  tabelle  : advanced -> riferimenti sys./staging./audit./reference_sync. nei file del modulo
             (repository, service, helper) ; stima A LIVELLO DI MODULO, non di singola rotta.
             datastore -> riferimenti datastore_*.xxx nel corpo del gestore della rotta.
  consumatori: grep del percorso (parametri :x sostituiti da ${...}/segmento) nei sorgenti dei frontend.

LIMITI DICHIARATI
  1. Parser lessicale, non AST: regex letterali, template annidati e percorsi composti con variabili
     (non letterali) non sono risolti; sono marcati <dinamico> e contati.
  2. Le tabelle sono per modulo: una rotta di sola lettura di un modulo che scrive altrove mostra tutte
     le tabelle del modulo. Query in file fuori dal modulo (lib/, db/) non sono seguite, ne' le funzioni SQL.
  3. Il permesso e' quello DICHIARATO nella rotta; i controlli dentro il service (es. ruoli) non si vedono.
     Una rotta senza requirePermission non e' necessariamente pubblica: l'auth globale puo' proteggerla.
  4. Chi detiene il permesso (ruoli) non si ricava qui: sta nelle migrazioni, con GRANT/REVOKE successivi.
  5. Consumatori: stringhe letterali o template con ${...}. Percorsi costruiti per concatenazione o con
     base variabile sfuggono (colonna 'consumatori_prefisso' = file che citano il prefisso del modulo,
     stima per eccesso). apps/web/tests (e2e) esclusi dai consumatori di prodotto, contati a parte.
  6. La classificazione tenant/piattaforma/catalogo/prodotto e' una regola esplicita (tabelle
     CLASSE_MODULO e PERMESSI_*) e va riletta: e' una proposta, non un dato.
"""
import argparse, json, os, re, sys
from collections import defaultdict

METODI = ("get", "post", "put", "patch", "delete", "head", "options")

# ---------------------------------------------------------------- parser lessicale
def salta_stringa(s, i):
    q = s[i]; i += 1; n = len(s)
    while i < n:
        c = s[i]
        if c == "\\": i += 2; continue
        if q == "`" and c == "$" and i + 1 < n and s[i+1] == "{":
            d = 1; i += 2
            while i < n and d:
                if s[i] == "{": d += 1
                elif s[i] == "}": d -= 1
                elif s[i] in "'\"`": i = salta_stringa(s, i); continue
                i += 1
            continue
        if c == q: return i + 1
        i += 1
    return n

def chiudi_parentesi(s, i, ap="(", ch=")"):
    """s[i]==ap ; ritorna indice dopo la parentesi corrispondente."""
    d = 0; n = len(s)
    while i < n:
        c = s[i]
        if c in "'\"`": i = salta_stringa(s, i); continue
        if c == "/" and i + 1 < n and s[i+1] == "/":
            j = s.find("\n", i); i = n if j < 0 else j; continue
        if c == "/" and i + 1 < n and s[i+1] == "*":
            j = s.find("*/", i + 2); i = n if j < 0 else j + 2; continue
        if c == ap: d += 1
        elif c == ch:
            d -= 1
            if d == 0: return i + 1
        i += 1
    return n

def toglie_commenti(s):
    out = []; i = 0; n = len(s)
    while i < n:
        c = s[i]
        if c in "'\"`":
            j = salta_stringa(s, i); out.append(s[i:j]); i = j; continue
        if c == "/" and i + 1 < n and s[i+1] == "/":
            j = s.find("\n", i); i = n if j < 0 else j; continue
        if c == "/" and i + 1 < n and s[i+1] == "*":
            j = s.find("*/", i + 2); k = n if j < 0 else j + 2
            out.append("\n" * s.count("\n", i, k)); i = k; continue
        out.append(c); i += 1
    return "".join(out)

RE_CHIAMATA = re.compile(r"\b(?:app|fastify|instance|server|f)\s*\.\s*(get|post|put|patch|delete|head|options)\s*(?=[<(])")

def trova_rotte(src, costanti=None):
    """Ritorna lista di dict {metodo, path, corpo, riga}. Il sorgente va passato senza commenti."""
    costanti = costanti or {}
    res = []
    for m in RE_CHIAMATA.finditer(src):
        i = m.end()
        if src[i] == "<":   # generici: salta con conteggio di <>
            d = 0
            while i < len(src):
                if src[i] == "<": d += 1
                elif src[i] == ">" and src[i-1] != "=":
                    d -= 1
                    if d == 0: i += 1; break
                i += 1
            while src[i].isspace(): i += 1
        if src[i] != "(": continue
        fine = chiudi_parentesi(src, i)
        corpo = src[i+1:fine-1]
        a = corpo.lstrip()
        path = None
        if a[:1] in "'\"`":
            j = salta_stringa(a, 0); path = a[1:j-1]
        else:
            idm = re.match(r"[A-Za-z_$][\w$]*", a)
            path = "<dinamico:" + (a[:40].replace("\n", " ")) + ">" if idm else "<dinamico>"
        # sostituisce ${COSTANTE} note
        if path.startswith("<") is False:
            path = re.sub(r"\$\{(\w+)\}", lambda mm: costanti.get(mm.group(1), "${" + mm.group(1) + "}"), path)
        riga = src.count("\n", 0, m.start()) + 1
        res.append(dict(metodo=m.group(1).upper(), path=path, corpo=corpo, riga=riga, pos=m.start(), fine=fine))
    return res

# ---------------------------------------------------------------- utilita'
def leggi(p):
    try:
        with open(p, encoding="utf-8", errors="replace") as f: return f.read()
    except OSError: return ""

def camminata(base, estensioni, escludi=("node_modules", ".next", "dist", ".git")):
    for r, dirs, files in os.walk(base):
        dirs[:] = [d for d in dirs if d not in escludi]
        for fn in files:
            if fn.endswith(estensioni): yield os.path.join(r, fn)

def unisci(prefisso, path):
    if path.startswith("<"): return path
    p = (prefisso.rstrip("/") + "/" + path.lstrip("/")) if path not in ("", "/") else prefisso
    p = p if p else "/"
    if len(p) > 1 and p.endswith("/"): p = p[:-1]
    return p

# ---------------------------------------------------------------- classificazione (advanced)
CLASSE_MODULO = {
 # piattaforma: funzioni del tenant "Heuresys System" / strumenti che generano o curano cataloghi
 "generated-origins":"piattaforma","provenance":"piattaforma","leads":"piattaforma","seed-acquisition-runs":"piattaforma",
 "seed-candidate-records":"piattaforma","seed-approval-decisions":"piattaforma","research":"piattaforma",
 "reference-sync":"piattaforma","tenants":"piattaforma","platform-tenant-assignments":"piattaforma",
 "tenant-blueprints":"piattaforma","tenant-materialization":"piattaforma","tenant-import-runs":"piattaforma",
 "observability":"piattaforma","blueprint-activations":"tenant","blueprint-overrides":"tenant",
 "enterprise-typing-profiles":"tenant",
 # catalogo: tassonomie e modelli condivisi senza (o con opzionale) colonna cliente
 "skills":"catalogo","skill-families":"catalogo","skill-categories":"catalogo","skill-aliases":"catalogo",
 "skill-taxonomy-edges":"catalogo","skill-proficiency-levels":"catalogo","job-roles":"catalogo","job-families":"catalogo",
 "kpi-definitions":"catalogo","learning-modules":"catalogo","occupation-classifications":"catalogo",
 "activity-classifications":"catalogo","activity-classification-mappings":"catalogo","enterprise-size-bands":"catalogo",
 "operating-models":"catalogo","assessment-methods":"catalogo","blueprint-families":"catalogo","blueprint-variants":"catalogo",
 "blueprint-processes":"catalogo","content-blueprint-links":"catalogo","process-kpi-templates":"catalogo",
 "organization-unit-kpi-templates":"catalogo","hierarchy-levels":"catalogo",
 # prodotto: funzioni dell'applicazione advanced non legate a un dato HR specifico
 "auth":"prodotto","mfa-policy":"prodotto","me":"prodotto","notifications":"prodotto","data-classification":"prodotto",
 "gdpr":"prodotto","dashboard":"prodotto","public-stats":"prodotto","public-job-postings":"prodotto",
 "whistleblowing":"prodotto","visualization-graphs":"prodotto","visualization-nodes":"prodotto","visualization-edges":"prodotto",
 "visualization-layouts":"prodotto","visualization-node-layouts":"prodotto","visualization-styles":"prodotto",
 "visualization-exports":"prodotto","approvals":"prodotto","delegations":"prodotto","advisor":"prodotto",
 "insights":"prodotto","evidence":"prodotto","content":"prodotto","analytics":"prodotto",
}
NOTA_CLASSE = {
 "piattaforma":"modulo di piattaforma/amministrazione tecnica (elenco CLASSE_MODULO)",
 "catalogo":"catalogo di dominio (ADR-0043 voci 1-12) o modello (voce 14)",
 "prodotto":"funzione trasversale del prodotto advanced",
 "tenant":"dato di business del tenant",
}
PERM_PIATTAFORMA = re.compile(r"^(leads|provenance|generated_origin|seed|research|reference_sync|tenant_blueprint|tenant_import|platform|observability|dashboard_platform|tenant:(create|delete)|tenant_materialization)")

def classifica_advanced(modulo, permessi, catalog_gate, prefisso):
    if modulo in CLASSE_MODULO:
        c = CLASSE_MODULO[modulo]
    else:
        c = "tenant"
    # le risorse RBAC di catalogo dichiarate dal cancello (gate.ts RISORSE_DI_CATALOGO) prevalgono
    for p in permessi:
        if p.split(":")[0] in ("job_role", "blueprint", "enterprise_typing", "operating_model") and modulo not in ("blueprint-activations","blueprint-overrides","enterprise-typing-profiles","tenant-blueprints"):
            c = "catalogo"
    return c

# ---------------------------------------------------------------- advanced
def estrai_advanced(radice):
    api = os.path.join(radice, "apps/api/src")
    app_ts = toglie_commenti(leggi(os.path.join(api, "app.ts")))
    imp = {}
    for m in re.finditer(r"import\s*\{([^}]*)\}\s*from\s*[\"']([^\"']+)[\"']", app_ts):
        for nome in m.group(1).split(","):
            nome = nome.strip()
            if not nome: continue
            nome = re.split(r"\s+as\s+", nome)[-1].strip()
            imp[nome] = m.group(2)
    regs = []
    for m in re.finditer(r"app\.register\(\s*(\w+)\s*,\s*\{", app_ts):
        j = chiudi_parentesi(app_ts, m.start() + len("app.register"))
        blocco = app_ts[m.start():j]
        pm = re.search(r"prefix:\s*[\"']([^\"']+)[\"']", blocco)
        regs.append((m.group(1), pm.group(1) if pm else ""))
    rotte = []
    # rotte registrate direttamente su app.ts
    for r in trova_rotte(app_ts):
        rotte.append(dict(r, prefisso="", file="apps/api/src/app.ts", modulo="(app)", plugin="app.ts"))
    visti = set()
    for nome, pref in regs:
        if nome not in imp:
            continue
        rel = imp[nome]
        f = os.path.normpath(os.path.join(api, rel)).replace(".js", ".ts")
        if not os.path.exists(f):
            continue
        mod = os.path.relpath(f, os.path.join(api, "modules")).split(os.sep)[0] if "/modules/" in f.replace(os.sep, "/") else "(altro)"
        src = toglie_commenti(leggi(f))
        consts = {m.group(1): m.group(2) for m in re.finditer(r"const\s+(\w+)\s*=\s*[\"']([a-z_\-]+:[a-z_\-:]+)[\"']", src)}
        for r in trova_rotte(src):
            rotte.append(dict(r, prefisso=pref, file=os.path.relpath(f, radice), modulo=mod, plugin=nome, consts=consts))
        visti.add(os.path.relpath(f, radice))
    # file routes non registrati
    orfani = []
    for f in camminata(os.path.join(api, "modules"), ("routes.ts", "-routes.ts")):
        rel = os.path.relpath(f, radice)
        if rel not in visti: orfani.append(rel)
    return rotte, orfani

RE_PERM = re.compile(r"(requirePermission|requireAnyPermission|requireAllPermissions|requirePerm\w*)\(\s*([^)]*)\)")
def dettagli_guardie(corpo, consts=None):
    consts = consts or {}
    perms = []
    for m in RE_PERM.finditer(corpo):
        arg = m.group(2).strip()
        primo = arg.split(",")[0].strip()          # il secondo argomento e' il codice d'errore, non un permesso
        lit = re.match(r"[\"']([^\"']+)[\"']$", primo)
        if lit: perms.append(lit.group(1))
        elif primo in consts: perms.append(consts[primo])
        else: perms.append(m.group(1) + "(" + primo[:40] + ")")
    altre = []
    if "verifyCsrf" in corpo: altre.append("csrf")
    for m in re.finditer(r"\b(requireRole\w*|requireAuth\w*|requireMfa\w*|requireStepUp\w*|requirePlatform\w*|requireSelf\w*|app\.authenticate)\b", corpo):
        altre.append(m.group(1))
    rl = re.search(r"rateLimit", corpo)
    if rl: altre.append("rateLimit")
    gates = {}
    for g in ("catalogGate", "orgGate", "tenantGate"):
        mm = re.search(g + r":\s*[\"']([^\"']+)[\"']", corpo)
        if mm: gates[g] = mm.group(1)
    return perms, sorted(set(altre)), gates

def tabelle_modulo(radice, modulo):
    d = os.path.join(radice, "apps/api/src/modules", modulo)
    t = defaultdict(int)
    if not os.path.isdir(d): return []
    for f in camminata(d, (".ts",)):
        if f.endswith((".test.ts",)): continue
        s = toglie_commenti(leggi(f))
        for m in re.finditer(r"\b(sys|staging|audit|reference_sync)\.([a-z_][a-z_0-9]*)", s):
            nome = m.group(1) + "." + m.group(2)
            if nome.endswith("_"): continue
            t[nome] += 1
    return sorted(t, key=lambda k: -t[k])

# ---------------------------------------------------------------- datastore
def estrai_datastore(radice):
    api = os.path.join(radice, "apps/api/src")
    rotte = []
    for nome in ("servizio.ts", "servizio_rtl.ts", "banco_interfaccia.ts"):
        f = os.path.join(api, nome)
        if not os.path.exists(f): continue
        s = toglie_commenti(leggi(f))
        costanti = {}
        for m in re.finditer(r"const\s+(\w+)\s*=\s*[\"']([^\"']+)[\"']", s):
            costanti[m.group(1)] = m.group(2)
        for r in trova_rotte(s, costanti):
            r.update(prefisso="", file=os.path.relpath(f, radice), modulo=nome[:-3], plugin=nome)
            r["testo_gestore"] = s[r["pos"]:r["fine"]]
            rotte.append(r)
        # scritture della pagina del banco (ciclo for ... of SCRITTURE_DELLA_PAGINA)
        if nome == "banco_interfaccia.ts":
            mm = re.search(r"SCRITTURE_DELLA_PAGINA\s*=\s*\[(.*?)\]\s*as const", s, re.S)
            if mm:
                for p in re.findall(r"[\"']([^\"']+)[\"']", mm.group(1)):
                    rotte.append(dict(metodo="POST", path=costanti.get("A", "/banco/api/datastore") + p, corpo="inoltro a /v1/banco" + p,
                                      riga=0, prefisso="", file=os.path.relpath(f, radice), modulo=nome[:-3], plugin=nome,
                                      testo_gestore="", nota="inoltro generato da ciclo"))
    # sostituzione della costante A nei percorsi con ${A}
    for r in rotte:
        r["path"] = r["path"].replace("${A}", "/banco/api/datastore")
    return rotte

# ---------------------------------------------------------------- tabelle datastore (seguendo le funzioni)
RE_TAB_DS = re.compile(r"\bdatastore_(?:core|pub|model|meta|derived|archive)\.[a-z_0-9]+\b")
COSTANTI_DS = {}
RE_FN = re.compile(r"(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*(?:<[^>(]*>)?\(")
def indice_funzioni(radici):
    idx = {}
    for r in radici:
        for f in camminata(r, (".ts", ".mjs")):
            if f.endswith(".test.ts"): continue
            s = toglie_commenti(leggi(f))
            for m in re.finditer(r"const\s+([A-Z][A-Z_0-9]+)\s*=\s*[\"'`](datastore_(?:core|pub|model|meta|derived|archive)\.[a-z_0-9]+)[\"'`]", s):
                COSTANTI_DS.setdefault(m.group(1), m.group(2))
            for m in RE_FN.finditer(s):
                n = m.group(1)
                if n in idx: continue
                # corpo: dalla prima { dopo la firma
                j = chiudi_parentesi(s, m.end() - 1)
                k = s.find("{", j)
                if k < 0: continue
                e = chiudi_parentesi(s, k, "{", "}")
                idx[n] = s[m.start():e]
    return idx

def tabelle_ds(testo, idx, prof=3, visti=None):
    visti = visti if visti is not None else set()
    out = set(RE_TAB_DS.findall(testo))
    for n in set(re.findall(r"\b([A-Z][A-Z_0-9]{2,})\b", testo)):
        if n in COSTANTI_DS: out.add(COSTANTI_DS[n])
    if prof == 0: return out
    for n in set(re.findall(r"\b([A-Za-z_$][\w$]*)\s*\(", testo)):
        if n in idx and n not in visti:
            visti.add(n)
            out |= tabelle_ds(idx[n], idx, prof - 1, visti)
    return out

# ---------------------------------------------------------------- consumatori
def corpus(radici, ammessi=(".ts", ".tsx", ".js", ".mjs", ".html", ".jsx")):
    out = []
    for r in radici:
        if not os.path.isdir(r): continue
        for f in camminata(r, ammessi):
            out.append((f, leggi(f)))
    return out

PARAM = r"(?:\$\{[^}]*\}|[^/\"'`\s?&#]+)"
def regex_percorso(path):
    segs = [s for s in path.split("/") if s != ""]
    parts = []
    for s in segs:
        if s.startswith(":"): parts.append(PARAM)
        elif s == "*": parts.append(r"[^\"'`\s]*")
        else: parts.append(re.escape(s))
    return re.compile("/" + "/".join(parts) + r"(?=[\"'`?\s#]|\$\{|$)")

def consumatori(path, corpi, radice, limite=6):
    if path.startswith("<") or path in ("/", ""): return [], 0
    rx = regex_percorso(path)
    trovati = []
    for f, t in corpi:
        if rx.search(t): trovati.append(os.path.relpath(f, radice))
    return trovati[:limite], len(trovati)

def file_con_prefisso(prefisso, corpi, radice):
    if not prefisso or prefisso == "/": return 0
    rx = re.compile(re.escape(prefisso) + r"(?=[\"'`/?\s#]|\$\{|$)")
    return sum(1 for f, t in corpi if rx.search(t))

# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--advanced", default="/home/user/heuresys-advanced")
    ap.add_argument("--datastore", default="/home/user/heuresys-datastore")
    ap.add_argument("--out", default="/mnt/project-files/consolidamento/lavoro")
    a = ap.parse_args()
    righe = []

    # ---- advanced
    rotte, orfani = estrai_advanced(a.advanced)
    corp_web = corpus([os.path.join(a.advanced, "apps/web/src")])
    corp_web_test = corpus([os.path.join(a.advanced, "apps/web/tests")])
    corp_altri = corpus([os.path.join(a.advanced, "apps/showcase/src"), os.path.join(a.advanced, "apps/agent-gateway/src")])
    cache_tab = {}
    for r in rotte:
        full = unisci(r["prefisso"], r["path"])
        perms, altre, gates = dettagli_guardie(r["corpo"], r.get("consts"))
        mod = r["modulo"]
        if mod not in cache_tab: cache_tab[mod] = tabelle_modulo(a.advanced, mod)
        cons_web, n_web = consumatori(full, corp_web, a.advanced)
        cons_alt, n_alt = consumatori(full, corp_altri, a.advanced)
        _, n_test = consumatori(full, corp_web_test, a.advanced)
        pref_n = file_con_prefisso(r["prefisso"], corp_web, a.advanced) if r["prefisso"] else 0
        classe = "prodotto" if mod == "(app)" else classifica_advanced(mod, perms, gates.get("catalogGate"), r["prefisso"])
        righe.append(dict(
            progetto="advanced", metodo=r["metodo"], percorso=full, modulo=mod, file=f'{r["file"]}:{r["riga"]}',
            permesso=";".join(perms) if perms else "(nessun requirePermission)",
            risorsa=";".join(sorted({p.split(":")[0] for p in perms if ":" in p})),
            altre_guardie=";".join(altre), catalogGate=gates.get("catalogGate", ""), orgGate=gates.get("orgGate", ""), tenantGate=gates.get("tenantGate", ""),
            tabelle_modulo=";".join(cache_tab[mod][:12]),
            consumatori_esatti=";".join(cons_web + cons_alt), n_consumatori=n_web + n_alt, n_test_e2e=n_test,
            consumatori_prefisso=pref_n, classe=classe, nota_classe=NOTA_CLASSE[classe],
        ))
    # ---- agent-gateway (http nativo)
    gw = toglie_commenti(leggi(os.path.join(a.advanced, "apps/agent-gateway/src/server.ts")))
    for m in re.finditer(r"req\.method === \"(\w+)\" && req\.url === \"([^\"]+)\"", gw):
        righe.append(dict(progetto="advanced", metodo=m.group(1), percorso=m.group(2), modulo="agent-gateway", file="apps/agent-gateway/src/server.ts",
                          permesso="(auth propria del gateway, non RBAC)", risorsa="", altre_guardie="", catalogGate="", orgGate="", tenantGate="",
                          tabelle_modulo="", consumatori_esatti="", n_consumatori=0, n_test_e2e=0, consumatori_prefisso=0,
                          classe="prodotto", nota_classe="gateway agente, processo separato"))

    # ---- datastore
    drot = [r for r in estrai_datastore(a.datastore) if "${" not in r["path"] or "ID_RTL" in r["path"]]
    idx_ds = indice_funzioni([os.path.join(a.datastore, "apps/api/src"), os.path.join(a.datastore, "src")])
    corp_ds = corpus([os.path.join(a.datastore, "apps/web/src"), os.path.join(a.datastore, "apps/banco")])
    corp_ds_altri = corpus([os.path.join(a.datastore, "src"), os.path.join(a.datastore, "scripts")])
    for r in drot:
        full = r["path"]
        g = r.get("testo_gestore", "") or r["corpo"]
        scr = re.search(r"scrivendo\(\s*r\s*,\s*[\"']([^\"']+)[\"']", g)
        verbo = re.search(r"avvolgi\(\s*\w+\s*,\s*[\"']([^\"']+)[\"']", g)
        tabs = sorted(t for t in tabelle_ds(g, idx_ds) if t != "datastore_meta.datastore_call")
        cons, n = consumatori(full, corp_ds, a.datastore)
        cons2, n2 = consumatori(full, corp_ds_altri, a.datastore)
        w = r["metodo"] != "GET"
        if full.startswith("/banco") and not full.startswith("/banco/api") : classe = "prodotto"
        elif re.search(r"/(cataloghi|concetti|cerca|contratti|classi-dimensionali|ponti|distribuzione|fonti|edizioni|spiegazione)", full): classe = "catalogo"
        elif re.search(r"/(prototipi|ricerche|passi|banco|fascicoli|blueprint|archivio)", full): classe = "piattaforma"
        else: classe = "prodotto"
        righe.append(dict(
            progetto="datastore", metodo=r["metodo"], percorso=full, modulo=r["modulo"], file=f'{r["file"]}:{r["riga"]}',
            permesso=("etichetta scrittura: " + scr.group(1)) if scr else "(nessun RBAC: identita' fissa dell'involucro)",
            risorsa=("verbo: " + verbo.group(1)) if verbo else "",
            altre_guardie="involucro" if verbo else "", catalogGate="", orgGate="", tenantGate="",
            tabelle_modulo=";".join(tabs[:14]) if tabs else "(nessuna rilevata)",
            consumatori_esatti=";".join(cons + cons2), n_consumatori=n + n2, n_test_e2e=0, consumatori_prefisso=0,
            classe=classe, nota_classe={"catalogo":"lettura di catalogo/vetrina datastore_pub","piattaforma":"modellazione/banco: genera o cura modelli","prodotto":"banco/infrastruttura"}[classe],
        ))

    cols = ["progetto","metodo","percorso","modulo","file","permesso","risorsa","altre_guardie","catalogGate","orgGate","tenantGate",
            "tabelle_modulo","consumatori_esatti","n_consumatori","n_test_e2e","consumatori_prefisso","classe","nota_classe"]
    os.makedirs(os.path.join(a.out, "strumenti"), exist_ok=True)
    with open(os.path.join(a.out, "E_api.tsv"), "w", encoding="utf-8") as f:
        f.write("\t".join(cols) + "\n")
        for r in righe:
            f.write("\t".join(str(r[c]).replace("\t", " ").replace("\n", " ") for c in cols) + "\n")
    with open(os.path.join(a.out, "strumenti", "rotte.json"), "w", encoding="utf-8") as f:
        json.dump(dict(rotte=righe, orfani_advanced=orfani), f, ensure_ascii=False, indent=1)
    din = sum(1 for r in righe if r["percorso"].startswith("<"))
    print(f"rotte: advanced={sum(1 for r in righe if r['progetto']=='advanced')} datastore={sum(1 for r in righe if r['progetto']=='datastore')} dinamiche={din} file_routes_non_registrati={len(orfani)}")
    for o in orfani: print("  non registrato:", o)

if __name__ == "__main__":
    main()
