#!/usr/bin/env python3
"""
genera_tsv.py - V1: unisce i dati degli estrattori e scrive le quattro tabelle consegnate.

USO   HEURESYS_ADVANCED=<repo> HEURESYS_DATASTORE=<repo> python3 genera_tsv.py --out <cartella>
Legge  <out>/dati/endpoint.json, pagine.json, console.json
Scrive <out>/pagine.tsv, endpoint.tsv, pagina_endpoint.tsv, anomalie.tsv  (UTF-8, intestazione, tabulazioni)
"""
import argparse, csv, json, os, re, sys
from collections import defaultdict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from estrai_rotte import camminata, leggi, regex_percorso
from grafo_ts import leggi_pulito
from estrai_pagine_v1 import trova, indice_endpoint
from accenti import accenta

ADV = os.environ["HEURESYS_ADVANCED"]
DS = os.environ["HEURESYS_DATASTORE"]

def cella(v):
    if v is None: return ""
    if isinstance(v, bool): return "si" if v else "no"
    return accenta(re.sub(r"[\t\r\n]+", " ", str(v)).strip())

def scrivi(path, colonne, righe):
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write("\t".join(colonne) + "\n")
        for r in righe:
            f.write("\t".join(cella(r.get(c, "")) for c in colonne) + "\n")

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--out", required=True); a = ap.parse_args()
    D = os.path.join(a.out, "dati")
    endpoint = json.load(open(os.path.join(D, "endpoint.json"), encoding="utf-8"))["endpoint"]
    pg = json.load(open(os.path.join(D, "pagine.json"), encoding="utf-8"))
    con = json.load(open(os.path.join(D, "console.json"), encoding="utf-8"))
    idx = indice_endpoint(endpoint)

    # ---------------- id e uso degli endpoint
    for i, e in enumerate(endpoint, 1): e["id"] = f"E{i:04d}"
    chiave = lambda e: f"{e['metodo']} {e['percorso']}"
    per_chiave = {chiave(e): e for e in endpoint if e["progetto"] == "advanced"}
    usi_pagina = defaultdict(set)      # endpoint -> pagine/layout
    usi_layout = defaultdict(set)
    righe_pe = []
    pagine_rows = []
    anomalie = []
    pid = 0

    def an(tipo, sev, oggetto, dettaglio, file, evidenza=""):
        anomalie.append(dict(id=f"A{len(anomalie)+1:03d}", tipo=tipo, severita=sev, oggetto=oggetto, dettaglio=dettaglio, file=file, evidenza=evidenza))

    for p in pg["web"]:
        pid += 1; p["id"] = f"P{pid:03d}"
    for p in pg["showcase"]:
        pid += 1; p["id"] = f"P{pid:03d}"
    ordine = {"page": 0, "layout": 1}

    # ---------------- chiamate -> relazione
    for p in pg["web"]:
        if p["kind"] not in ("page", "layout"): continue
        for c in p.get("chiamate", []):
            e = None
            ekey = c["endpoint_id"]
            esiste = "si" if ekey else "NO"
            if ekey and not ekey.startswith("[gateway]"):
                usi_pagina[ekey].add(p["id"] if p["kind"] == "page" else p["id"])
                if p["kind"] == "layout": usi_layout[ekey].add(p["id"])
            righe_pe.append(dict(
                pagina_id=p["id"], tipo_elemento=p["kind"], route=p["route"], app="web", file_pagina=p["file"],
                metodo=c["metodo"], percorso_chiamato=c["percorso"], endpoint=ekey, endpoint_esiste=esiste,
                metodi_esistenti_per_il_percorso=c["metodi_esistenti"], origine=c["origine"], tipo_chiamata=c["tipo"],
                file_chiamata=c["file"], riga=c["riga"], dedotta_da=c.get("da", "")))
            if c["tipo"] == "non-risolta":
                an("chiamata_non_risolta", "bassa", f"{p['route']} -> {c['percorso']}", "percorso non letterale: l'analisi statica non lo risolve", f"{c['file']}:{c['riga']}")
            elif not ekey:
                if c["metodi_esistenti"]:
                    an("chiamata_con_metodo_errato", "alta", f"{p['route']}: {c['metodo']} {c['percorso']}",
                       f"il percorso esiste nell'API ma con metodo {c['metodi_esistenti']}, non {c['metodo']}: la chiamata fallirebbe (404/405)", f"{c['file']}:{c['riga']}")
                else:
                    an("chiamata_a_endpoint_inesistente", "alta", f"{p['route']}: {c['metodo']} {c['percorso']}", "nessun endpoint dell'API ha questo percorso", f"{c['file']}:{c['riga']}")

    # ---------------- chiamate di TUTTI i file web (anche non raggiunti da pagine), test e2e, gateway
    from estrai_pagine_v1 import chiamate_del_file, WEB_SRC, valori_proprieta
    uso_file = defaultdict(list)
    for f in camminata(WEB_SRC, (".ts", ".tsx")):
        for c in chiamate_del_file(f):
            if c["tipo"] in ("diretta", "href/src") and not f.endswith("SystemHealthDashboard.tsx"):
                e, _ = trova(idx, c["metodo"], c["percorso"])
                if e: uso_file[chiave(e)].append(os.path.relpath(f, ADV) + f":{c['riga']}")
    # via-prop: i letterali path:/basePath: con un helper noto
    for f in camminata(WEB_SRC, (".ts", ".tsx")):
        if f.endswith("SystemHealthDashboard.tsx"): continue     # righe dimostrative della vetrina, non chiamate
        for ident, suff in (("path", ""), ("basePath", ""), ("basePath", "/summary")):
            for (np_, riga) in valori_proprieta(f, ident):
                e, _ = trova(idx, "GET", np_ + suff)
                if e: uso_file[chiave(e)].append(os.path.relpath(f, ADV) + f":{riga} (via {ident})")
    corp_test = [(f, leggi(f)) for f in camminata(os.path.join(ADV, "apps/web/tests"), (".ts", ".tsx"))]
    corp_gw = [(f, leggi(f)) for f in camminata(os.path.join(ADV, "apps/agent-gateway/src"), (".ts",))]
    corp_gw_scripts = [(f, leggi(f)) for f in camminata(os.path.join(ADV, "apps/agent-gateway/scripts"), (".ts",))]
    corp_apitest = [(f, leggi(f)) for f in camminata(os.path.join(ADV, "apps/api/test"), (".ts",))]

    def conta(corpo, e):
        rx = regex_percorso(e["percorso"]); n = 0; esempio = ""
        for f, t in corpo:
            if rx.search(t):
                n += 1
                if not esempio: esempio = os.path.relpath(f, ADV)
        return n, esempio

    NOTE_INFRA = {"/healthz": "sonda di salute", "/readyz": "sonda di prontezza", "/metrics": "metriche Prometheus", "/openapi.json": "spec OpenAPI (solo se API_DOCS_ENABLED)"}
    END_ROWS = []
    pagine_di = defaultdict(list)
    idpag = {p["id"]: p for p in pg["web"] + pg["showcase"]}
    for k, s in usi_pagina.items():
        for pid_ in s: pagine_di[k].append(idpag[pid_]["route"] + ("" if idpag[pid_]["kind"] == "page" else " [layout]"))
    for e in endpoint:
        k = chiave(e)
        if e["progetto"] == "agent-gateway":
            # chiamato dalle pagine che usano use-agent-stream (POST /agent, /agent/approve)
            pp = sorted({p["route"] for p in pg["web"] for c in p.get("chiamate", []) if c["endpoint_id"] == f"[gateway] {k}"})
            e["n_pagine"] = len(pp); e["pagine"] = ";".join(pp[:8]); e["n_test_e2e"] = 0; e["n_gateway"] = 0
            e["stato_uso"] = "usato da pagina" if pp else "nessun consumatore rilevato"
            END_ROWS.append(e); continue
        pp = sorted(set(pagine_di.get(k, [])))
        n_t, es_t = conta(corp_test, e)
        n_g, es_g = conta(corp_gw + corp_gw_scripts, e)
        n_at, es_at = conta(corp_apitest, e)
        file_web = uso_file.get(k, [])
        if pp: uso = "usato da pagina"
        elif file_web and all("lib/api/fetch.ts" in x for x in file_web): uso = "infrastruttura (rinnovo silenzioso della sessione in lib/api/fetch.ts)"
        elif file_web: uso = "usato da codice web non raggiunto da alcuna pagina"
        elif e["percorso"] in NOTE_INFRA: uso = "infrastruttura (" + NOTE_INFRA[e["percorso"]] + ")"
        elif n_g: uso = "usato solo dall'agent-gateway"
        elif n_t: uso = "solo test e2e web"
        else: uso = "nessun consumatore rilevato"
        e.update(n_pagine=len(pp), pagine=";".join(pp[:8]) + (";..." if len(pp) > 8 else ""), file_web_che_lo_citano=";".join(file_web[:3]),
                 n_test_e2e=n_t, esempio_test_e2e=es_t, n_gateway=n_g, n_test_api=n_at, stato_uso=uso)
        END_ROWS.append(e)
        if uso.startswith("nessun consumatore") :
            an("endpoint_orfano", "media", k,
               f"nessuna pagina, componente web, test e2e o gateway lo chiama (modulo {e['modulo']}, permesso {e['permessi'] or e['autenticazione']}); test API: {n_at} file", e["file"],
               "ricerca del percorso nei sorgenti di apps/web/src, apps/web/tests, apps/agent-gateway")
        elif uso.startswith("solo test e2e"):
            an("endpoint_senza_pagina", "bassa", k, f"chiamato solo dai test e2e ({es_t})", e["file"])
        elif uso.startswith("usato da codice web non raggiunto"):
            an("endpoint_senza_pagina", "media", k, "citato in codice web che nessuna pagina importa (codice morto o componente non montato): " + ";".join(file_web[:2]), e["file"])
        elif uso.startswith("usato solo dall'agent"):
            an("endpoint_senza_pagina", "bassa", k, "usato soltanto dall'agent-gateway/MCP, nessuna interfaccia web", e["file"])
        # guardie dell'API
        if e["metodo"] in ("POST", "PUT", "PATCH", "DELETE") and e["csrf"] == "NO" and not e["percorso"].startswith(("/v1/auth/", "/v1/leads", "/v1/whistleblowing")) :
            an("guardia_mancante_csrf", "media", k, "metodo che modifica senza verifyCsrf nel preHandler", e["file"])
        if e["autenticazione"].startswith("pubblica") and e["progetto"] == "advanced":
            attesa = e["percorso"] in NOTE_INFRA or e["percorso"].startswith(("/v1/auth/login", "/v1/auth/refresh", "/v1/auth/password-reset", "/v1/auth/mfa/", "/v1/leads", "/v1/whistleblowing", "/v1/public/"))
            an("endpoint_senza_guardia", "bassa" if attesa else "alta", k,
               ("pubblico per disegno (login/sonde/landing/segnalazioni anonime/annunci)" if attesa else "nessun requirePermission ne' uso di req.user rilevato: verificare") +
               ("; rateLimit: " + ("si" if "rateLimit" in e["altre_guardie"] else "no")), e["file"])

    # ---------------- righe pagine
    colonne_p = ["id", "app", "tipo", "route", "file", "righe", "gruppo_rotte", "area", "render", "natura", "natura_evidenza", "redirect", "layout_catena",
                 "guardia_middleware", "guardia_layout", "guardia_componente", "permessi_ui", "ruoli_ui", "menu", "raggiungibilita", "riferita_da",
                 "n_chiamate_api", "n_endpoint_distinti", "endpoint_chiamati", "ui_pagina", "componenti_locali_condivisi", "ui_via_componenti_condivisi",
                 "tabella", "grafico", "dashboard", "filtri_predefiniti", "searchparams", "params_lista", "colonne", "schede", "page_size", "widget_testid", "segni_dato_fittizio", "varianti_per_ruolo"]
    for p in sorted(pg["web"], key=lambda x: (x["route"], ordine.get(x["kind"], 2), x["kind"])):
        ch = p.get("chiamate", [])
        distinti = sorted({(c["metodo"] + " " + c["percorso"]) for c in ch})
        row = dict(p); row["tipo"] = p["kind"]
        row["n_chiamate_api"] = len(ch); row["n_endpoint_distinti"] = len(distinti)
        row["endpoint_chiamati"] = ";".join(distinti)
        if p["kind"] not in ("page", "layout"):
            row["natura"] = "infrastruttura Next.js"; row["area"] = "(n/a)"
        var = []
        if p.get("permessi_ui"): var.append("azioni condizionate ai permessi: " + p["permessi_ui"])
        if p.get("ruoli_ui"): var.append("condizionata ai ruoli: " + p["ruoli_ui"])
        if p["kind"] == "page" and p["route"].startswith("/me"): var.append("ESS: l'API restituisce solo i dati della persona che ha fatto login (/v1/me/*)")
        if p["route"] == "/dashboard/[famiglia]": var.append("la famiglia e le viste vengono dal catalogo /v1/dashboard/catalog filtrato dal server per attore (blocchi mascherati contati)")
        if p["route"] == "/dashboard": var.append("pagina di atterraggio per chi ha il permesso dashboard:view (lib/landing.ts); gli altri atterrano su /me")
        pp_ = {c["percorso"] for c in ch}
        if any(x.startswith("/v1/me/") for x in pp_) and any((not x.startswith("/v1/me/")) and x.replace("/v1/", "/v1/me/", 1) in pp_ for x in pp_): var.append("doppio percorso self (/v1/me/..) e altri (/v1/..)")
        row["varianti_per_ruolo"] = " | ".join(var)
        pagine_rows.append(row)
        # anomalie di pagina
        if p["kind"] == "page":
            if p.get("raggiungibilita", "").startswith("ORFANA"):
                an("pagina_orfana", "media", p["route"], "nessuna voce di menu attiva e nessun riferimento letterale al percorso in altri file", p["file"])
            if p.get("menu", "").startswith("INATTIVA"):
                an("pagina_con_voce_di_menu_inattiva", "bassa", p["route"], p["menu"], p["file"])
            if p.get("segni_dato_fittizio") and p["route"].split("/")[1:2] != ["showcase"]:
                an("segni_di_dato_fittizio_o_statico", "media" if "array-letterale" in p["segni_dato_fittizio"] or "mock" in p["segni_dato_fittizio"] else "bassa", p["route"], p["segni_dato_fittizio"][:300], p["file"], "euristica lessicale: da rileggere a mano")
            scritture = [c for c in ch if c["metodo"] != "GET" and not c["percorso"].startswith("/v1/auth/")]
            if scritture and p.get("gruppo_rotte") == "(authenticated)" and not (p.get("permessi_ui") or p.get("ruoli_ui")) and not p["route"].startswith("/me"):
                an("guardia_mancante_azioni_di_scrittura_senza_controllo_ui", "bassa", p["route"],
                   "la pagina esegue " + ", ".join(sorted({c['metodo'] + ' ' + c['percorso'] for c in scritture}))[:240] + " senza controllare permessi/ruoli nel componente (la protezione e' solo nell'API)", p["file"])
            if p["natura"] != "produzione" and p["natura"] != "redirect" and p.get("gruppo_rotte") != "(authenticated)":
                an("pagina_temporanea_di_prova_o_demo", "media" if "showcase" not in p["route"] else "bassa", p["route"],
                   f"{p['natura']}: {p['natura_evidenza']}; middleware: {p['guardia_middleware']}", p["file"])
            if p["natura"].startswith("di prova"):
                an("pagina_temporanea_di_prova_o_demo", "media", p["route"], f"{p['natura']}: {p['natura_evidenza']}; dentro (authenticated), nessuna guardia di ruolo", p["file"])
            if p["natura"] == "redirect":
                an("pagina_redirect", "bassa", p["route"], p["redirect"], p["file"])
    for rel in pg.get("file_web_non_raggiunti", []):
        an("file_web_non_raggiunto_da_alcuna_pagina", "bassa", "apps/web/src/" + rel, "nessuna pagina, layout o loro componenti importano questo file (codice morto, o usato solo da test/altra app)", "apps/web/src/" + rel,
           "chiusura degli import per nome a partire da ogni page.tsx/layout.tsx")
    # showcase app e console
    for p in pg["showcase"]:
        row = dict(p); row["tipo"] = p["kind"]; row["n_chiamate_api"] = 0; row["n_endpoint_distinti"] = 0; row["endpoint_chiamati"] = ""
        row["guardia_middleware"] = "nessuno (sito statico, apps/showcase output: export)"; row["raggiungibilita"] = "pubblica (GitHub Pages)"
        row["note"] = "le altre pagine /showcase/* sono copiate da apps/web/src/app/showcase da scripts/sync-showcase.sh a build time e NON stanno in git"
        pagine_rows.append(row)
    cid = 0
    console_pe = []
    for p in con["pagine"]:
        if not p["tocca_advanced"]: continue
        cid += 1; pidc = f"C{cid:03d}"
        distinti = sorted({c["metodo"] + " " + c["percorso"] for c in p["chiamate"]})
        row = dict(id=pidc, app="console-datastore", tipo="page", route=p["route"], file=p["file"], righe=p["righe"], area="Console datastore - tocca advanced", render="server+client",
                   natura="produzione (console interna)", natura_evidenza="; ".join(p["prove"][:3]),
                   guardia_middleware="nessun middleware nell'app console (apps/console non ha proxy.ts/middleware.ts); l'accesso e' deciso dall'autenticazione davanti a console.datastore.heuresys.com (fuori dal codice letto)",
                   guardia_layout="layout.tsx di apps/console: guscio comune, nessun controllo di ruolo", raggiungibilita="menu della console (menu.ts)",
                   n_chiamate_api=len(p["chiamate"]), n_endpoint_distinti=len(distinti), endpoint_chiamati=";".join(distinti))
        pagine_rows.append(row)
        for c in p["chiamate"]:
            console_pe.append(dict(pagina_id=pidc, tipo_elemento="page", route=p["route"], app="console-datastore", file_pagina=p["file"], metodo=c["metodo"],
                                   percorso_chiamato=c["percorso"], endpoint="(datastore) " + c["bersaglio"], endpoint_esiste="(non verificato: API del datastore, fuori perimetro)",
                                   origine="server/browser", tipo_chiamata="letterale", file_chiamata=c["file"], riga=c["riga"]))
    # supplemento dedotto a mano dal codice (percorso costruito con variabili)
    for pagina_id, route in [(r["id"], r["route"]) for r in pagine_rows if r.get("app") == "console-datastore" and r["route"] == "/traccia-datastore/corsa/[id]"]:
        console_pe.append(dict(pagina_id=pagina_id, tipo_elemento="page", route=route, app="console-datastore", file_pagina="apps/console/src/app/traccia-datastore/corsa/[id]/page.tsx",
                               metodo="GET", percorso_chiamato="/api-rtl/banco/api/datastore/prototipi/:id/{verifica|fonti|analisi-fonti|ricerca|misure}",
                               endpoint="(datastore) istanza RTL 3104 (sola lettura, base advanced)", endpoint_esiste="(non verificato)", origine="browser (azioni-corsa.tsx)",
                               tipo_chiamata="dedotta a mano", file_chiamata="apps/console/src/app/traccia-datastore/scritture/azioni-corsa.tsx", riga="152,163"))
    for h in con["route_handler"]:
        if h["tocca_advanced"]:
            cid += 1; pidc = f"C{cid:03d}"
            pagine_rows.append(dict(id=pidc, app="console-datastore", tipo="route-handler", route=h["route"], file=h["file"], area="Console datastore - tocca advanced",
                                    natura="produzione (console interna)", natura_evidenza="route handler server della console; metodi " + ",".join(h["metodi"]),
                                    guardia_middleware="nessun middleware", n_chiamate_api="", endpoint_chiamati=""))

    # ---------------- pagine -> endpoint che non esistono / endpoint nel menu senza pagina
    rotte_pagina = {p["route"] for p in pg["web"] if p["kind"] == "page"}
    for rt, m in pg["menu"].items():
        if not m.get("active"): continue
        def combacia(r):
            prx = re.compile("^" + re.sub(r"\\\[[^/]+?\\\]", "[^/]+", re.escape(r)) + "$")
            return bool(prx.match(rt))
        if not any(combacia(r) for r in rotte_pagina) and rt not in rotte_pagina:
            an("voce_di_menu_senza_pagina", "alta", rt, f"voce attiva nel registro ricostruito dalle migrazioni ({m.get('file','')}) ma nessun page.tsx con questo percorso", "db/migrations/" + m.get("file", ""),
               "ricostruzione dalle migrazioni: lo stato vivo del DB puo' differire (verificare con V3)")

    # ---------------- scrittura
    colonne_e = ["id", "progetto", "metodo", "percorso", "modulo", "file", "autenticazione", "permessi", "csrf", "altre_guardie", "orgGate", "tenantGate", "catalogGate",
                 "schema_body", "schema_query", "schema_params", "schema_risposta", "schemi_file", "tabelle_lette", "tabelle_scritte", "tabelle_citate", "perimetro",
                 "mascheramento", "filtro_tenant_nel_codice", "stato_uso", "n_pagine", "pagine", "file_web_che_lo_citano", "n_test_e2e", "n_test_api", "n_gateway"]
    # endpoint del datastore (istanza RTL 3104) che leggono advanced: righe sintetiche dal sorgente
    rtl = [
        ("GET", "/v1/salute", "servizio_rtl.ts:116", "stato e sola lettura della connessione ad advanced (select 1 / default_transaction_read_only)", ""),
        ("GET", "/banco/api/datastore/prototipi", "banco_interfaccia.ts (lettore RTL)", "elenco dei tenant di advanced come 'prototipi' (id prtl_bank)", ";".join(con["tabelle_advanced_lette_da_3104"])),
        ("GET", "/banco/api/datastore/prototipi/:id", "banco_interfaccia.ts (lettore RTL)", "il tenant di advanced composto come corpo di prototipo (componiPrototipo in rtl_lettura.ts)", ";".join(con["tabelle_advanced_lette_da_3104"])),
        ("GET", "/banco/api/datastore/prototipi/:id/:vista", "banco_interfaccia.ts", "viste del corpo (verifica, fonti, analisi-fonti, ricerca, misure)", ""),
        ("GET", "/banco/api/datastore/prototipi/prtl_bank/vuoti", "servizio_rtl.ts:134", "vuoti di advanced rispetto al completo (rtl_vuoti.ts)", ""),
    ]
    extra = []
    for (m, pth, f, nota, tab) in rtl:
        extra.append(dict(id="", progetto="datastore-RTL-3104 (legge advanced)", metodo=m, percorso=pth, modulo="servizio_rtl/banco_interfaccia", file="heuresys-datastore/apps/api/src/" + f,
                          autenticazione="nessuna (istanza interna, solo GET; ogni altro metodo 405)", permessi="", csrf="n/a", schema_risposta=nota, tabelle_lette=tab, tabelle_scritte="(nessuna: connessione default_transaction_read_only=on)",
                          stato_uso="usato dalla console datastore", n_pagine=""))
    for i, e in enumerate(extra, 1): e["id"] = f"D{i:03d}"
    scrivi(os.path.join(a.out, "endpoint.tsv"), colonne_e, END_ROWS + extra)
    scrivi(os.path.join(a.out, "pagine.tsv"), colonne_p + ["note"], pagine_rows)
    colonne_pe = ["pagina_id", "tipo_elemento", "route", "app", "file_pagina", "metodo", "percorso_chiamato", "endpoint", "endpoint_esiste", "metodi_esistenti_per_il_percorso",
                  "origine", "tipo_chiamata", "file_chiamata", "riga", "dedotta_da"]
    scrivi(os.path.join(a.out, "pagina_endpoint.tsv"), colonne_pe, righe_pe + console_pe)
    scrivi(os.path.join(a.out, "anomalie.tsv"), ["id", "tipo", "severita", "oggetto", "dettaglio", "file", "evidenza"], anomalie)
    # totali
    tot = dict(
        pagine_web=sum(1 for p in pg["web"] if p["kind"] == "page"), layout_web=sum(1 for p in pg["web"] if p["kind"] == "layout"),
        altri_file_app=sum(1 for p in pg["web"] if p["kind"] not in ("page", "layout")),
        showcase_file=len(pg["showcase"]), console_pagine_totali=len(con["pagine"]), console_pagine_advanced=sum(1 for p in con["pagine"] if p["tocca_advanced"]),
        endpoint_advanced=sum(1 for e in endpoint if e["progetto"] == "advanced"), endpoint_gateway=sum(1 for e in endpoint if e["progetto"] == "agent-gateway"),
        relazioni=len(righe_pe) + len(console_pe), anomalie=len(anomalie))
    from collections import Counter
    tot["anomalie_per_tipo"] = dict(Counter(x["tipo"] for x in anomalie))
    tot["stato_uso_endpoint"] = dict(Counter(e["stato_uso"] for e in END_ROWS if e["progetto"] == "advanced"))
    tot["autenticazione_endpoint"] = dict(Counter(e["autenticazione"] for e in endpoint if e["progetto"] == "advanced"))
    tot["natura_pagine"] = dict(Counter(p["natura"] for p in pg["web"] if p["kind"] == "page"))
    tot["raggiungibilita"] = dict(Counter(p.get("raggiungibilita", "") for p in pg["web"] if p["kind"] == "page"))
    json.dump(tot, open(os.path.join(D, "totali.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps(tot, ensure_ascii=False, indent=1))

if __name__ == "__main__":
    main()
