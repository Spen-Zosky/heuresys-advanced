#!/usr/bin/env python3
"""
estrai_endpoint.py - V1: inventario degli endpoint HTTP di apps/api (e apps/agent-gateway) per advanced.

USO   HEURESYS_ADVANCED=<repo> python3 estrai_endpoint.py --out <cartella>
Scrive <out>/endpoint.tsv e <out>/dati/endpoint.json (stesso dato, per gli altri script).
SOLA LETTURA sul repository; nessun server avviato, nessun database interrogato.

COME LAVORA (sopra estrai_rotte.py, che resta il parser delle rotte)
  rotta      : app.<metodo>(percorso, opzioni, gestore) letto da apps/api/src/app.ts + file routes dei plugin registrati.
  guardie    : requirePermission("x:y"), verifyCsrf, config.orgGate/tenantGate/catalogGate, rateLimit.
  schemi     : chiavi body/querystring/params/response di schema:{...}, con il file di packages/shared che li definisce.
  tabelle    : dal gestore si seguono le chiamate per nome (service -> repository -> helper, anche tra moduli, fino a
               profondita' 8); nel testo delle funzioni raggiunte si leggono i riferimenti SQL sys./staging./audit./
               reference_sync. con il verbo che li precede (FROM/JOIN = lettura; INSERT/UPDATE/DELETE = scrittura).
  perimetro  : funzioni di lib/scope usate nelle funzioni raggiunte + dichiarazioni orgGate/tenantGate/catalogGate.
  mascheram. : funzioni di lib/scope/mask.ts (maskFields, masks*, classiMascherateDa, vede...) usate.
  autenticaz.: 'permesso' se c'e' requirePermission; 'sessione' se il gestore o le funzioni raggiunte leggono req.user
               (actorFromRequest); altrimenti 'pubblica (nessuna guardia rilevata)'.
LIMITI: vedi LEGGIMI.md (analisi lessicale; DI e query costruite dinamicamente non seguite).
"""
import argparse, json, os, re, sys
from collections import defaultdict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from estrai_rotte import (estrai_advanced, dettagli_guardie, unisci, toglie_commenti, leggi, camminata,
                          chiudi_parentesi, salta_stringa, CLASSE_MODULO)
from grafo_ts import (Risolutore, importazioni, riesportazioni, unita_del_file, unita_per_nome, leggi_pulito, nome_default)

ADV = os.environ["HEURESYS_ADVANCED"]
RIS = Risolutore({})

# ---------------------------------------------------------------- indice schemi condivisi
def indice_schemi():
    base = os.path.join(ADV, "packages/shared/src")
    idx = {}
    for f in camminata(base, (".ts",)):
        t = leggi_pulito(f)
        for m in re.finditer(r"export\s+(?:const|type|interface)\s+([A-Za-z_][\w]*)", t):
            idx.setdefault(m.group(1), os.path.relpath(f, ADV))
    return idx

# ---------------------------------------------------------------- viste dalle migrazioni
def viste_db():
    d = os.path.join(ADV, "db/migrations"); out = {}
    for fn in sorted(os.listdir(d)):
        if not fn.endswith(".sql"): continue
        t = re.sub(r"--[^\n]*", "", leggi(os.path.join(d, fn)))
        for m in re.finditer(r"create\s+(?:or\s+replace\s+)?(materialized\s+)?view\s+(?:if\s+not\s+exists\s+)?([a-z_]+\.[a-z_0-9]+)", t, re.I):
            out[m.group(2).lower()] = "materialized" if m.group(1) else "view"
        for m in re.finditer(r"drop\s+(?:materialized\s+)?view\s+(?:if\s+exists\s+)?([a-z_]+\.[a-z_0-9]+)", t, re.I):
            pass   # il ritiro non e' cancellazione (ADR-0035): la vista resta nell'elenco finche' una CREATE successiva non la sostituisce
    return out

# ---------------------------------------------------------------- opzioni e schema di una rotta
def argomenti_toplevel(testo):
    """spezza il testo di un elenco di argomenti/proprieta' alle virgole di primo livello."""
    out = []; d = 0; i = 0; ini = 0; n = len(testo)
    while i < n:
        c = testo[i]
        if c in "'\"`": i = salta_stringa(testo, i); continue
        if c in "([{": d += 1
        elif c in ")]}": d -= 1
        elif c == "," and d == 0:
            out.append(testo[ini:i]); ini = i + 1
        i += 1
    if testo[ini:].strip(): out.append(testo[ini:])
    return out

def blocco_dopo(testo, chiave):
    m = re.search(r"\b" + chiave + r"\s*:\s*\{", testo)
    if not m: return None
    j = m.end() - 1
    f = chiudi_parentesi(testo, j, "{", "}")
    return testo[j + 1:f - 1]

def schema_della_rotta(corpo):
    sb = blocco_dopo(corpo, "schema")
    res = dict(body="", querystring="", params="", response="")
    if sb is None: return res
    for item in argomenti_toplevel(sb):
        mk = re.match(r"\s*(body|querystring|params|headers|response)\s*:\s*(.*)$", item, re.S)
        if not mk: continue
        chiave, val = mk.group(1), mk.group(2).strip()
        if chiave == "response" and val.startswith("{"):
            interno = val[1:-1] if val.endswith("}") else val[1:]
            parti = []
            for it in argomenti_toplevel(interno):
                mm = re.match(r"\s*(\d{3}|[\"'][^\"']+[\"'])\s*:\s*(.*)$", it, re.S)
                if mm: parti.append(mm.group(1).strip("\"'") + ":" + compatta(mm.group(2)))
            val = ";".join(parti)
        else:
            val = compatta(val)
        if chiave in res: res[chiave] = val
    return res

def compatta(s):
    return re.sub(r"\s+", " ", s.strip())[:140]

def nomi_schema(s):
    return sorted(set(re.findall(r"\b([A-Z][A-Za-z0-9]*(?:Schema|Body|Query|Param|Response))\b", s)))

# ---------------------------------------------------------------- SQL
RE_TAB = re.compile(r"\b((?:sys|staging|audit|reference_sync)\.[a-z_][a-z0-9_]*)\b", re.I)
VERBI = [
    (re.compile(r"INSERT\s+INTO\s+(?:ONLY\s+)?$", re.I), "scrive:insert"),
    (re.compile(r"UPDATE\s+(?:ONLY\s+)?$", re.I), "scrive:update"),
    (re.compile(r"DELETE\s+FROM\s+(?:ONLY\s+)?$", re.I), "scrive:delete"),
    (re.compile(r"TRUNCATE\s+(?:TABLE\s+)?$", re.I), "scrive:truncate"),
    (re.compile(r"REFRESH\s+MATERIALIZED\s+VIEW\s+(?:CONCURRENTLY\s+)?$", re.I), "scrive:refresh"),
    (re.compile(r"(?:FROM|JOIN)\s+(?:ONLY\s+|LATERAL\s+)?$", re.I), "legge"),
    (re.compile(r"(?:FROM|JOIN)\s+[\w.]+\s*(?:AS\s+)?\w*\s*,\s*$", re.I), "legge"),
]
def costanti_tabella(testo):
    return {m.group(1): m.group(2) for m in re.finditer(r"(?:const|let)\s+([A-Za-z_]\w*)\s*(?::\s*[^=]+)?=\s*[\"'`]((?:sys|staging|audit|reference_sync)\.[a-z_][a-z0-9_]*)[\"'`]", testo)}

def usi_sql(testo, costanti=None):
    if costanti:
        for k, v in costanti.items():
            testo = testo.replace("${" + k + "}", v)
    out = defaultdict(set)
    for m in RE_TAB.finditer(testo):
        nome = m.group(1).lower()
        if nome.endswith("_"): continue
        pre = testo[max(0, m.start() - 80):m.start()]
        post = testo[m.end():m.end() + 2]
        verbo = None
        for rx, v in VERBI:
            if rx.search(pre): verbo = v; break
        if verbo is None:
            verbo = "funzione" if post.startswith("(") else "cita"
        out[nome].add(verbo)
    return out

# ---------------------------------------------------------------- grafo delle chiamate
SCOPE_RE = re.compile(r"\b(resolveOrgReadScope|resolveActivityScope|resolveRecruitingOrgScope|orgSubtreeUnitIds|orgSubtreeUserIds|orgAncestorUserIds|isInOrgSubtree|canReadOrgTarget|isOrgUnitManager|chainLevelOf|unitaEntroLivello|functionalScopeUserIds|isInFunctionalScope|isFunctionalLeader|perimetroDiCatalogo|scopeTierOf|scopeTierAndRole|activeDomainsOf|hasAnyDomain|dominiCheApronoUnaSuperficie|codiciDelProfilo|almenoUnaCellaAperta|modalitaDellaVista|vede|recordScopeAccess|PARTECIPANTI_OGGI_SQL|haMandatoHr|haMandatoPiattaforma|haMandatoGdpr|haPerimetroTenantMascherato|TENANT_WIDE_MANDATE_ROLES|HR_MANDATED_ROLES)\b")
MASK_RE = re.compile(r"\b(maskFields|masksSensitiveClass|masksUnderPlatformMandate|masksUnderTenantWideMandate|masksTopOfChainPay|masksTenantImportCandidates|classiMascherateDa|Masked|MASKED_UNDER_PLATFORM_MANDATE|TENANT_WIDE_MASKED_ROLES|haPerimetroTenantMascherato|isSensitiveClass|isSensitiveResource|dataClassOf)\b")
AUTH_RE = re.compile(r"\b(actorFromRequest|actorFromReq|actor\(req\)|req\.user\b|request\.user\b|requireUser|userHasPermission)")
TENANT_RE = re.compile(r"_tenant_id\b|\btenant_id\b|\btenantId\b")
NON_RICEVITORI = {"req", "request", "reply", "app", "this", "res", "console", "JSON", "Math", "Object", "Array", "Date", "String", "Number", "Promise",
                  "z", "path", "fs", "crypto", "process", "Buffer", "Set", "Map", "client", "pool", "db", "pg", "result", "rows", "r", "row", "body", "query", "params", "item", "items"}

from functools import lru_cache
@lru_cache(maxsize=None)
def costanti_sql_file(file):
    """costanti di primo livello (stringhe o template) che contengono riferimenti a tabelle: NAME -> testo."""
    t = leggi_pulito(file)
    out = {}
    for m in re.finditer(r"(?:^|\n)(?:export\s+)?const\s+([A-Za-z_]\w*)\s*(?::[^=\n]+)?=\s*(?=[`\"'])", t):
        ini = m.end()
        fin = salta_stringa(t, ini)
        # concatenazioni: + `...`
        while True:
            mm = re.match(r"\s*\+\s*(?=[`\"'])", t[fin:])
            if not mm: break
            fin = salta_stringa(t, fin + mm.end())
        blocco = t[ini:fin]
        if RE_TAB.search(blocco): out[m.group(1)] = blocco
    return out

class Grafo:
    def __init__(self):
        self.ris = RIS
        self.visti = set()
        self.tabelle = defaultdict(set)
        self.scope = set(); self.mask = set(); self.auth = False; self.tenant = False
        self.file_toccati = set(); self.n_unita = 0

    def unita_risolte(self, file, ric, m):
        """unita raggiunte dalla chiamata ric.m(...) o m(...) (ric None) scritta in `file`."""
        imps = importazioni(file, self.ris)
        out = []
        if ric is None:
            if m in imps:
                f2, orig, _ = imps[m]
                if f2: out += self.simbolo(f2, orig if orig not in ("default", "*") else (nome_default(f2) or m), 0)
            out += [u for u in unita_per_nome(file, m) if u.contenitore is None]
            return out
        if ric == "this":
            return unita_per_nome(file, m)
        if ric in imps:
            f2, orig, _ = imps[ric]
            if f2 and not f2.endswith(".test.ts"):
                us = unita_per_nome(f2, m, orig if orig not in ("*", "default") else None)
                if orig == "*": us = [u for u in unita_per_nome(f2, m) if u.contenitore is None] or us
                if not us:
                    us = self.simbolo_ric(f2, orig, m)
                return us
            return []
        us = [u for u in unita_del_file(file) if u.nome == m and u.contenitore == ric]
        if not us and re.search(r"(?i)service|svc|repo|store|deps|handler", ric):
            # ripiego: servizio/repository costruiti da una factory (iniezione): si cercano le unita omonime
            # nei file della stessa cartella (modulo), esclusi i file delle rotte e i test
            d = os.path.dirname(file)
            for fn in sorted(os.listdir(d)):
                if not fn.endswith(".ts") or fn.endswith(".test.ts") or "routes" in fn: continue
                us += unita_per_nome(os.path.join(d, fn), m)
        return us

    def simbolo(self, f, nome, prof):
        us = [u for u in unita_per_nome(f, nome) if u.contenitore is None]
        if us or prof > 3: return us
        for (n, f3, orig) in riesportazioni(f, self.ris):
            if n == "*" or n == nome:
                r = self.simbolo(f3, orig or nome, prof + 1)
                if r: return r
        return []

    def simbolo_ric(self, f, orig, m):
        for (n, f3, o2) in riesportazioni(f, self.ris):
            if n == "*" or n == orig:
                us = unita_per_nome(f3, m, o2 if o2 else None)
                if us: return us
        return []

    def analizza(self, file, testo, prof, costanti_file=None):
        self.file_toccati.add(file)
        if costanti_file is None: costanti_file = costanti_tabella(leggi_pulito(file))
        for t, vs in usi_sql(testo, costanti_file).items():
            self.tabelle[t] |= vs
        for nome_c, blocco in costanti_sql_file(file).items():
            if re.search(r"(?<![\w$])" + re.escape(nome_c) + r"(?![\w$])", testo) and blocco not in testo:
                for t, vs in usi_sql(blocco, costanti_file).items():
                    self.tabelle[t] |= vs
        for m in SCOPE_RE.finditer(testo): self.scope.add(m.group(1))
        for m in MASK_RE.finditer(testo): self.mask.add(m.group(1))
        if AUTH_RE.search(testo): self.auth = True
        if TENANT_RE.search(testo): self.tenant = True
        if prof >= 8: return
        cand = []
        for m in re.finditer(r"(?<![\w$.])([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\s*(?:<[^>()]*>)?\(", testo):
            ric, nome = m.group(1), m.group(2)
            if ric in NON_RICEVITORI and ric != "this": continue
            cand.append((ric, nome))
        for m in re.finditer(r"(?<![\w$.])([A-Za-z_$][\w$]*)\s*(?:<[^>()]*>)?\(", testo):
            nome = m.group(1)
            if nome in ("if", "for", "while", "switch", "catch", "function", "return", "await", "async", "super", "new", "typeof"): continue
            cand.append((None, nome))
        for ric, nome in set(cand):
            for u in self.unita_risolte(file, ric, nome):
                if u.file.endswith((".test.ts",)): continue
                k = (u.file, u.inizio)
                if k in self.visti: continue
                self.visti.add(k); self.n_unita += 1
                self.analizza(u.file, u.testo(), prof + 1)

# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    os.makedirs(os.path.join(a.out, "dati"), exist_ok=True)
    schemi = indice_schemi(); viste = viste_db()
    rotte, orfani_file = estrai_advanced(ADV)
    righe = []
    api_src = os.path.join(ADV, "apps/api/src")
    for r in rotte:
        full = unisci(r["prefisso"], r["path"])
        perms, altre, gates = dettagli_guardie(r["corpo"], r.get("consts"))
        sch = schema_della_rotta(r["corpo"])
        f_abs = os.path.join(ADV, r["file"])
        g = Grafo()
        # i prefissi comuni dei plugin non sono noti al Risolutore: relativo soltanto
        g.analizza(f_abs, r["corpo"], 0, costanti_tabella(leggi_pulito(f_abs)))
        tab = g.tabelle
        def fmt(t, vs):
            tipo = viste.get(t)
            marca = {"view": "(vista)", "materialized": "(vista materializzata)"}.get(tipo, "")
            return t + marca
        legge = sorted(fmt(t, v) for t, v in tab.items() if "legge" in v)
        scrive = sorted(fmt(t, v) + "[" + ",".join(sorted(x.split(":")[1] for x in v if x.startswith("scrive:"))) + "]" for t, v in tab.items() if any(x.startswith("scrive:") for x in v))
        solo_citate = sorted(fmt(t, v) for t, v in tab.items() if not ("legge" in v or any(x.startswith("scrive:") for x in v)))
        # autenticazione
        if perms: auth = "permesso"
        elif "requireAuth" in " ".join(altre) or g.auth: auth = "sessione (req.user, nessun permesso nominato)"
        else: auth = "pubblica (nessuna guardia rilevata)"
        csrf = "csrf" in altre
        metodo = r["metodo"]
        ruoli_inline = sorted(set(re.findall(r"[\"']([A-Z][A-Z_]{3,})[\"']", r["corpo"]) )) if False else []
        righe.append(dict(
            progetto="advanced", metodo=metodo, percorso=full, modulo=r["modulo"], file=f'{r["file"]}:{r["riga"]}',
            autenticazione=auth, permessi=";".join(perms), csrf="si" if csrf else ("n/a" if metodo == "GET" else "NO"),
            altre_guardie=";".join(x for x in altre if x != "csrf"),
            orgGate=gates.get("orgGate", ""), tenantGate=gates.get("tenantGate", ""), catalogGate=gates.get("catalogGate", ""),
            schema_body=sch["body"], schema_query=sch["querystring"], schema_params=sch["params"], schema_risposta=sch["response"],
            schemi_file=";".join(f"{n}@{schemi.get(n, '?')}" for n in nomi_schema(" ".join(sch.values()))),
            tabelle_lette=";".join(legge), tabelle_scritte=";".join(scrive), tabelle_citate=";".join(solo_citate),
            perimetro=";".join(sorted(g.scope)), mascheramento=";".join(sorted(g.mask)),
            filtro_tenant_nel_codice="si" if g.tenant else "no", unita_seguite=g.n_unita,
        ))
    # ---- agent-gateway
    gw_f = os.path.join(ADV, "apps/agent-gateway/src/server.ts")
    gw = toglie_commenti(leggi(gw_f))
    for m in re.finditer(r"req\.method === \"(\w+)\" && req\.url === \"([^\"]+)\"", gw):
        riga = gw.count("\n", 0, m.start()) + 1
        righe.append(dict(
            progetto="agent-gateway", metodo=m.group(1), percorso=m.group(2), modulo="agent-gateway", file=f"apps/agent-gateway/src/server.ts:{riga}",
            autenticazione="(auth propria del gateway: da verificare in server.ts)", permessi="", csrf="n/a", altre_guardie="", orgGate="", tenantGate="", catalogGate="",
            schema_body="", schema_query="", schema_params="", schema_risposta="", schemi_file="", tabelle_lette="", tabelle_scritte="", tabelle_citate="",
            perimetro="", mascheramento="", filtro_tenant_nel_codice="", unita_seguite=0))
    with open(os.path.join(a.out, "dati", "endpoint.json"), "w", encoding="utf-8") as f:
        json.dump(dict(endpoint=righe, file_routes_non_registrati=orfani_file), f, ensure_ascii=False, indent=1)
    print("endpoint advanced:", sum(1 for r in righe if r["progetto"] == "advanced"), "gateway:", sum(1 for r in righe if r["progetto"] == "agent-gateway"))

if __name__ == "__main__":
    main()
