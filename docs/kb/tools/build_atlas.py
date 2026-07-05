#!/usr/bin/env python3
"""
build_atlas.py — Atlante cross-layer deterministico di heuresys-advanced (SoT interrogabile).

Nato S1016 (sessione "conoscenza assoluta" per brainstorming): la mappa trasversale
pagina -> endpoint -> permesso RBAC/org-gate -> tabella sys.* -> dati live non esisteva
come artefatto interrogabile; questo tool la RI-DERIVA dal codice (parsing sorgenti) e
dal DB live (psql via tunnel :5433) ad ogni run — zero numeri hardcoded (lezione D-01).

Ruolo SoT (decisione S1016): l'atlas e' la vista autoritativa interrogabile; il grafo
graphify (graphify-out/) e il grafo wiki sono viste esplorative parallele, MAI SoT —
in caso di disaccordo vince l'atlas.

Output (in docs/kb/atlas/):
  - atlas.yaml   (machine-readable: api / web / shared / db / cross / meta)
  - ATLAS.md     (overview umana compatta, 100% generata)
La sintesi semantica non-derivabile (giudizi, gap, opportunita') vive in
docs/kb/atlas/ATLAS_CURATED.md — file curato a mano, datato, NON toccato da questo tool.

Idempotenza: stesso codice (git HEAD) + stesso stato DB => output identico (il timestamp
in meta e' la data del commit HEAD, non il wall-clock). Doppio run consecutivo = diff vuoto.

Limiti dichiarati (v1):
  - endpoint per pagina = regex `apiFetch(...)` sui file della directory della pagina
    (no risoluzione transitiva di componenti condivisi; la copertura semantica completa
    sta nei frammenti del full-sweep e in ATLAS_CURATED.md);
  - match cross endpoint<->pagina per path normalizzato (senza metodo);
  - tabelle per modulo = regex SQL FROM/JOIN/INTO/UPDATE/DELETE/MERGE sugli schemi
    sys/staging/brownfield/audit.

Usage:
    python docs/kb/tools/build_atlas.py           # full (richiede tunnel :5433)
    python docs/kb/tools/build_atlas.py --no-db   # senza sezione DB live
"""
import argparse
import os
import re
import shutil
import subprocess
import sys
from collections import OrderedDict

REPO = r"D:\heuresys-advanced"
API_MODULES = os.path.join(REPO, "apps", "api", "src", "modules")
API_APP = os.path.join(REPO, "apps", "api", "src", "app.ts")
API_TESTS = os.path.join(REPO, "apps", "api", "test")
WEB_APP = os.path.join(REPO, "apps", "web", "src", "app")
SHARED_SCHEMAS = os.path.join(REPO, "packages", "shared", "src", "schemas")
SHARED_PKG_JSON = os.path.join(REPO, "packages", "shared", "package.json")
OUT_DIR = os.path.join(REPO, "docs", "kb", "atlas")

PSQL_BIN = shutil.which("psql") or r"C:\Program Files\PostgreSQL\16\bin\psql.exe"
PSQL = [PSQL_BIN, "-h", "localhost", "-p", "5433", "-U", "heuresys",
        "-d", "heuresys_advanced", "-tAc"]

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


def read(path):
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()


def run(cmd, cwd=REPO):
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, encoding="utf-8")
    return r.stdout.strip()


def psql(sql, _retries=2):
    r = subprocess.run(PSQL + [sql], capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0:
        # tunnel :5433 puo' avere drop transitori sotto carico — un retry breve li assorbe
        if _retries > 0 and ("SSL SYSCALL" in r.stderr or "connection" in r.stderr):
            import time
            time.sleep(2)
            return psql(sql, _retries - 1)
        raise RuntimeError(f"psql failed: {r.stderr.strip()[:200]}")
    return r.stdout.strip()


# ---------------------------------------------------------------- API layer

RE_REGISTER = re.compile(r"app\.register\(\s*(\w+)\s*,\s*\{\s*prefix:\s*[\"']([^\"']+)[\"']")
RE_ROUTE_START = re.compile(r"app\.(get|post|put|patch|delete)\(\s*$|app\.(get|post|put|patch|delete)\(\s*[\"']")
RE_SQL_TABLE = re.compile(
    r"\b(?:FROM|JOIN|INTO|UPDATE|DELETE\s+FROM|MERGE\s+INTO)\s+"
    r"((?:sys|staging|brownfield|audit)\.[a-z_0-9]+)", re.IGNORECASE)
RE_SHARED_IMPORT = re.compile(r"import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*[\"']@heuresys/shared([^\"']*)[\"']", re.DOTALL)


def parse_routes_file(text):
    """Estrae le route da un file routes: [{method, path, permission, csrf, orgGate}]."""
    routes = []
    # blocchi app.<method>( "path", { ...options... }  — scandiamo per occorrenza
    for m in re.finditer(r"app\.(get|post|put|patch|delete)\(\s*\n?\s*[\"'`]([^\"'`]*)[\"'`]", text):
        method, path = m.group(1).upper(), m.group(2)
        # opzioni = testo fino all'handler (approssimato: prossimi 900 char o fino a "async")
        tail = text[m.end():m.end() + 1200]
        handler_cut = tail.find("async ")
        opts = tail[:handler_cut] if handler_cut != -1 else tail
        perm = None
        pm = re.search(r"requirePermission\(\s*[\"']([^\"']+)[\"']", opts)
        if pm:
            perm = pm.group(1)
        csrf = "verifyCsrf" in opts
        og = None
        ogm = re.search(r"orgGate:\s*[\"']([^\"']+)[\"']", opts)
        if ogm:
            og = ogm.group(1)
        routes.append(OrderedDict(method=method, path=path or "/", permission=perm,
                                  csrf=csrf, orgGate=og))
    return routes


def build_symbol_map():
    """Mappa simbolo esportato -> nome schema file (per risolvere import barrel)."""
    sym = {}
    for fn in sorted(os.listdir(SHARED_SCHEMAS)):
        if not fn.endswith(".ts"):
            continue
        name = fn[:-3]
        text = read(os.path.join(SHARED_SCHEMAS, fn))
        for m in re.finditer(r"export\s+(?:const|type|interface|function)\s+(\w+)", text):
            sym.setdefault(m.group(1), name)
    return sym


def scan_api(symbol_map):
    app_text = read(API_APP)
    prefixes = {}  # pluginVar -> prefix
    for m in RE_REGISTER.finditer(app_text):
        prefixes[m.group(1)] = m.group(2)

    test_files = [f for f in os.listdir(API_TESTS) if f.endswith(".test.ts")]

    modules = OrderedDict()
    for mod in sorted(os.listdir(API_MODULES)):
        mdir = os.path.join(API_MODULES, mod)
        if not os.path.isdir(mdir):
            continue
        files = sorted(f for f in os.listdir(mdir) if f.endswith(".ts"))
        routes, tables, schemas = [], set(), set()
        plugin_prefixes = set()
        for fn in files:
            text = read(os.path.join(mdir, fn))
            if fn.endswith("routes.ts"):
                routes.extend(parse_routes_file(text))
                # quale prefix? cerca l'export const <x>Routes e risolvi in app.ts
                for em in re.finditer(r"export\s+const\s+(\w+)\s*[:=]", text):
                    if em.group(1) in prefixes:
                        plugin_prefixes.add(prefixes[em.group(1)])
            for tm in RE_SQL_TABLE.finditer(text):
                tables.add(tm.group(1).lower())
            for im in RE_SHARED_IMPORT.finditer(text):
                names, subpath = im.group(1), im.group(2)
                if subpath.startswith("/schemas/"):
                    schemas.add(subpath.split("/schemas/")[1].split("/")[0].replace(".js", ""))
                else:
                    for n in re.split(r"[,\s]+", names):
                        n = n.strip()
                        if n and n in symbol_map:
                            schemas.add(symbol_map[n])
        # test file per modulo: match sul nome modulo (con e senza plurale semplice)
        stem = mod
        tests = sorted(t for t in test_files if stem in t)
        modules[mod] = OrderedDict(
            prefixes=sorted(plugin_prefixes),
            routes=routes,
            tables=sorted(tables),
            schemas=sorted(schemas),
            tests=tests,
            files=len(files),
        )
    return modules


# ---------------------------------------------------------------- Web layer

RE_APIFETCH = re.compile(r"apiFetch[^(]*\(\s*[\"'`]([^\"'`]+)[\"'`]")


def page_url(rel_dir):
    """apps/web/src/app/(authenticated)/positions/[id] -> /positions/[id]"""
    parts = [p for p in rel_dir.replace("\\", "/").split("/") if p and not
             (p.startswith("(") and p.endswith(")"))]
    return "/" + "/".join(parts) if parts else "/"


def zone_of(rel_dir):
    r = rel_dir.replace("\\", "/")
    if r.startswith("showcase"):
        return "showcase"
    if "(authenticated)/me" in ("(authenticated)/" + r) or r.startswith("(authenticated)/me"):
        return "me" if r.startswith("(authenticated)/me") else "admin"
    if r.startswith("(authenticated)"):
        return "admin"
    return "public"


def collect_page_files(page_dir):
    """Tutti i .ts/.tsx della pagina, ricorsivo, ESCLUSE le sottodirectory che sono
    a loro volta pagine (contengono un proprio page.tsx) — quelle appartengono ad
    altre route; le dir di supporto (_components, _lib, ...) sono incluse."""
    out = []
    for root, dirs, files in os.walk(page_dir):
        if root != page_dir and "page.tsx" in files:
            dirs[:] = []  # non scendere oltre: e' un'altra pagina
            continue
        for fn in files:
            if fn.endswith((".tsx", ".ts")):
                out.append(os.path.join(root, fn))
    return out


def scan_web():
    pages = OrderedDict()
    for root, _dirs, files in os.walk(WEB_APP):
        if "page.tsx" not in files:
            continue
        rel = os.path.relpath(root, WEB_APP)
        rel = "" if rel == "." else rel
        url = page_url(rel)
        endpoints = set()
        for fpath in collect_page_files(root):
            text = read(fpath)
            for m in RE_APIFETCH.finditer(text):
                ep = m.group(1)
                ep = re.sub(r"\$\{[^}]*\}", ":param", ep)  # template param -> :param
                ep = ep.split("?")[0]
                if ep.startswith("/v1") or ep.startswith("/api"):
                    endpoints.add(ep)
        pages[url] = OrderedDict(zone=zone_of(rel), endpoints=sorted(endpoints))
    return OrderedDict(sorted(pages.items()))


# ---------------------------------------------------------------- Shared layer

def scan_shared():
    files = sorted(f[:-3] for f in os.listdir(SHARED_SCHEMAS) if f.endswith(".ts"))
    pkg = read(SHARED_PKG_JSON)
    exported = set(re.findall(r"\./schemas/([a-z0-9-]+)", pkg))
    return OrderedDict(
        schemas=files,
        count=len(files),
        missing_subpath_export=sorted(set(files) - exported),
        subpath_without_file=sorted(exported - set(files)),
    )


# ---------------------------------------------------------------- DB live

def scan_db():
    tables = []
    raw = psql("SELECT schemaname||'.'||relname||'|'||n_live_tup FROM pg_stat_user_tables ORDER BY 1")
    zero_candidates = []
    for line in raw.splitlines():
        name, rows = line.rsplit("|", 1)
        rows = int(rows)
        tables.append([name, rows])
        if rows == 0:
            zero_candidates.append(name)
    # verifica esatta dei soli zero-candidati (stime pg_stat possono essere stale),
    # in batch UNION ALL per non moltiplicare i round-trip sul tunnel
    empty = []
    exact = {}
    for i in range(0, len(zero_candidates), 25):
        chunk = zero_candidates[i:i + 25]
        union = " UNION ALL ".join(
            f"SELECT '{n}' AS t, count(*) AS c FROM {n}" for n in chunk)
        for line in psql(union).splitlines():
            n, c = line.rsplit("|", 1)
            exact[n] = int(c)
    for name in zero_candidates:
        if exact.get(name, 0) == 0:
            empty.append(name)
        else:  # stima stale: correggi col count reale
            for t in tables:
                if t[0] == name:
                    t[1] = exact[name]
    views = psql("SELECT table_schema||'.'||table_name FROM information_schema.views "
                 "WHERE table_schema IN ('sys','brownfield','audit','staging') ORDER BY 1").splitlines()
    matviews = psql("SELECT schemaname||'.'||matviewname FROM pg_matviews ORDER BY 1").splitlines()
    exts = psql("SELECT extname FROM pg_extension ORDER BY 1").splitlines()
    key_defs = [
        ("tenants_active", "SELECT count(*) FROM sys.sys_tenancies WHERE tenant_status='ACTIVE'"),
        ("users", "SELECT count(*) FROM sys.sys_users"),
        ("positions", "SELECT count(*) FROM sys.sys_positions"),
        ("org_units", "SELECT count(*) FROM sys.sys_organization_units"),
        ("roles", "SELECT count(*) FROM sys.sys_auth_roles"),
        ("permissions", "SELECT count(*) FROM sys.sys_auth_permissions"),
        ("role_permission_mappings", "SELECT count(*) FROM sys.sys_auth_role_permissions"),
        ("ui_interfaces_active", "SELECT count(*) FROM sys.sys_ui_interfaces WHERE ui_interface_is_active"),
        ("skills", "SELECT count(*) FROM sys.sys_skills"),
    ]
    union = " UNION ALL ".join(f"SELECT '{label}' AS k, ({sql}) AS v" for label, sql in key_defs)
    key = OrderedDict()
    for line in psql(union).splitlines():
        k, v = line.rsplit("|", 1)
        key[k] = int(v)
    return OrderedDict(tables=tables, empty_tables=empty, views=views,
                       matviews=matviews, extensions=exts, key_counts=key)


# ---------------------------------------------------------------- Cross layer

def normalize_api_path(prefix, path):
    p = (prefix.rstrip("/") + "/" + path.lstrip("/")).rstrip("/") or prefix
    return re.sub(r":(\w+)", ":param", p)


def cross_join(api, web):
    """endpoint API -> pagine che lo chiamano; pagine -> endpoint inesistenti."""
    api_paths = {}
    for mod, m in api.items():
        for prefix in m["prefixes"] or ["/v1/" + mod]:
            for r in m["routes"]:
                api_paths[normalize_api_path(prefix, r["path"])] = mod
    consumers = {}
    unknown = OrderedDict()
    for url, p in web.items():
        for ep in p["endpoints"]:
            norm = re.sub(r":\w+", ":param", ep.replace("/api/v1", "/v1"))
            norm = norm.rstrip("/") or "/"
            if norm in api_paths:
                consumers.setdefault(norm, []).append(url)
            else:
                unknown.setdefault(url, []).append(ep)
    api_only = sorted(set(api_paths) - set(consumers))
    return OrderedDict(
        endpoints_with_web_consumers={k: sorted(v) for k, v in sorted(consumers.items())},
        api_only_endpoints=api_only,
        web_endpoints_unmatched=unknown,
    )


# ---------------------------------------------------------------- YAML emit (no deps)

def yaml_dump(obj, indent=0):
    """Serializzatore YAML minimale deterministico (evita dipendenza PyYAML)."""
    pad = "  " * indent
    out = []
    if isinstance(obj, dict):
        if not obj:
            return pad + "{}"
        for k, v in obj.items():
            if isinstance(v, (dict, list)) and v:
                out.append(f"{pad}{k}:")
                out.append(yaml_dump(v, indent + 1))
            else:
                out.append(f"{pad}{k}: {yaml_scalar(v)}")
    elif isinstance(obj, list):
        if not obj:
            return pad + "[]"
        for item in obj:
            if isinstance(item, (dict, list)):
                body = yaml_dump(item, indent + 1)
                first, *rest = body.splitlines()
                out.append(f"{pad}- {first.strip()}")
                out.extend(rest)
            else:
                out.append(f"{pad}- {yaml_scalar(item)}")
    else:
        return pad + yaml_scalar(obj)
    return "\n".join(out)


def yaml_scalar(v):
    if v is None:
        return "null"
    if isinstance(v, list) and not v:
        return "[]"
    if isinstance(v, dict) and not v:
        return "{}"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    s = str(v)
    if s == "" or re.search(r"[:#{}\[\],&*?|>'\"%@`]", s) or s != s.strip():
        return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'
    return s


# ---------------------------------------------------------------- Main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-db", action="store_true", help="salta la sezione DB live")
    args = ap.parse_args()

    head = run(["git", "log", "-1", "--format=%h %cI"]).split()
    meta = OrderedDict(
        generated_from_commit=head[0] if head else "unknown",
        commit_date=head[1] if len(head) > 1 else "unknown",
        tool="docs/kb/tools/build_atlas.py",
        sot_role=("atlas = SoT interrogabile; graphify-out/ e wiki-graph = viste "
                  "esplorative parallele, mai autoritative"),
        curated="docs/kb/atlas/ATLAS_CURATED.md (a mano, non generato)",
        db_included=not args.no_db,
    )

    symbol_map = build_symbol_map()
    api = scan_api(symbol_map)
    web = scan_web()
    shared = scan_shared()
    db = None
    if not args.no_db:
        db = scan_db()
    cross = cross_join(api, web)

    atlas = OrderedDict(meta=meta, api=api, web=web, shared=shared)
    if db is not None:
        atlas["db"] = db
    atlas["cross"] = cross

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, "atlas.yaml"), "w", encoding="utf-8", newline="\n") as f:
        f.write("# GENERATED by docs/kb/tools/build_atlas.py — do not edit by hand.\n")
        f.write(yaml_dump(atlas) + "\n")

    write_md(atlas)
    print(f"atlas: {len(api)} moduli API · {sum(len(m['routes']) for m in api.values())} route · "
          f"{len(web)} pagine web · {shared['count']} schemi shared"
          + (f" · {len(db['tables'])} tabelle DB ({len(db['empty_tables'])} vuote)" if db else " · DB skipped"))


def write_md(atlas):
    api, web, shared = atlas["api"], atlas["web"], atlas["shared"]
    db = atlas.get("db")
    cross = atlas["cross"]
    L = []
    L.append("# ATLAS — mappa cross-layer heuresys-advanced (GENERATO)")
    L.append("")
    L.append(f"> Generato da `docs/kb/tools/build_atlas.py` @ commit `{atlas['meta']['generated_from_commit']}` "
             f"({atlas['meta']['commit_date']}). **Non editare a mano** — la sintesi curata vive in "
             f"`ATLAS_CURATED.md`. Ruolo SoT: {atlas['meta']['sot_role']}.")
    L.append("")
    n_routes = sum(len(m["routes"]) for m in api.values())
    L.append("## Conteggi")
    L.append("")
    L.append("| Layer | Valore |")
    L.append("|---|---|")
    L.append(f"| Moduli API | {len(api)} |")
    L.append(f"| Route API | {n_routes} |")
    L.append(f"| Pagine web | {len(web)} |")
    L.append(f"| Schemi shared | {shared['count']} |")
    if db:
        L.append(f"| Tabelle DB | {len(db['tables'])} (vuote: {len(db['empty_tables'])}) |")
        L.append(f"| Viste / matview | {len(db['views'])} / {len(db['matviews'])} |")
    L.append(f"| Endpoint API senza consumer web (server-side/CLI/ESS-fetch indiretto) | {len(cross['api_only_endpoints'])} |")
    L.append("")
    L.append("## Moduli API")
    L.append("")
    L.append("| Modulo | Prefix | Route | Permessi | Tabelle | Test |")
    L.append("|---|---|---|---|---|---|")
    for mod, m in api.items():
        perms = sorted({r["permission"] for r in m["routes"] if r["permission"]})
        L.append(f"| {mod} | {', '.join(m['prefixes']) or '—'} | {len(m['routes'])} | "
                 f"{len(perms)} | {len(m['tables'])} | {len(m['tests'])} |")
    L.append("")
    L.append("## Pagine web per zona")
    L.append("")
    zones = {}
    for url, p in web.items():
        zones.setdefault(p["zone"], []).append(url)
    for z in sorted(zones):
        L.append(f"- **{z}** ({len(zones[z])}): " + " · ".join(sorted(zones[z])))
    L.append("")
    if db:
        L.append("## Tabelle DB vuote (feature senza dati — candidate brainstorming)")
        L.append("")
        for t in db["empty_tables"]:
            L.append(f"- `{t}`")
        L.append("")
        L.append("## Key counts live")
        L.append("")
        for k, v in db["key_counts"].items():
            L.append(f"- {k}: **{v}**")
        L.append("")
    if shared["missing_subpath_export"] or shared["subpath_without_file"]:
        L.append("## Anomalie shared exports")
        L.append("")
        if shared["missing_subpath_export"]:
            L.append(f"- schemi senza subpath export: {', '.join(shared['missing_subpath_export'])}")
        if shared["subpath_without_file"]:
            L.append(f"- subpath export senza file: {', '.join(shared['subpath_without_file'])}")
        L.append("")
    L.append("## Dettaglio completo")
    L.append("")
    L.append("Il dettaglio machine-readable (route con permessi/orgGate/CSRF, tabelle per modulo, "
             "endpoint per pagina, rowcount per tabella, cross-join) e' in `atlas.yaml` (stessa dir). "
             "Query rapide: `python -c \"import yaml\"` oppure grep sul file.")
    L.append("")
    with open(os.path.join(OUT_DIR, "ATLAS.md"), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(L))


if __name__ == "__main__":
    main()
