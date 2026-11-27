#!/usr/bin/env python3
"""Il livello agentico di Heuresys, misurato da un comando e non giudicato a occhio.

Piano Heuresys AI-driven (`docs/piani/PIANO_heuresys-ai-driven_20261126.md`), voce M1;
ADR-0063 D1: dodici assi (sezione 3 del piano) e sette criteri. Ogni asse ha cinque gradini,
dal livello 1 al 5; ogni gradino è una misura con la sua fonte. Il livello è il numero di
gradini pieni in fila, più mezzo punto se il primo gradino non pieno è già a metà o più.
Nessuna misura dichiarata `non misurato` vale come passata.

FONTI, tutte nel deposito e senza database (salvo `--uso`):
  - le rotte dal codice (`build_atlas.scan_api`, lo stesso lettore dell'atlante e di
    `check_copertura_agente.py`), così una rotta nuova si vede prima dell'unione;
  - il catalogo dell'agente `docs/kb/atlas/agent-operations.json` (letture raggiungibili);
  - `docs/kb/agent-classi-scritture.json` (scritture raggiungibili, via `check_copertura_agente`);
  - le voci del menu e le pagine idonee (`check_letture_agente.py`, `check_idoneita_agente.py`);
  - il piano (catalogo degli scenari, segnalatori e applet previsti per dominio);
  - il codice, con tre segni: `@scenario S-O1` (un calcolatore di scenario), `@segnalatore D1:<codice>`
    (un agente in background che osserva) e `@applet D1:<codice>` (un lavoro in più passi), come il
    segno `@agente` dell'anagrafe: chi costruisce la voce mette il segno nello stesso commit;
  - la batteria in `apps/agent-gateway/test/batteria/<Dn>.json` e il suo esito in `ESITO.json`;
  - le prove dal vivo in `docs/kb/livello-agentico-prove.json`.

IL RATCHET (come si vede rosso): `docs/kb/livello-agentico-baseline.json` tiene il minimo accettato
di ogni misura e di ogni livello. Una misura o un livello sotto il minimo rende rosso il comando:
togliere una voce dal catalogo dell'agente, o un segno dal codice, fa scendere la misura. Il minimo
sale solo con `--aggiorna-baseline`, mai da sé.

I SETTE CRITERI: un criterio è VERDE solo con la misura sopra soglia e una prova dal vivo registrata
(ADR-0063 D1). La misura da sola dice `misura verde, prova da registrare`.

Uso:
  python3 docs/kb/tools/misura_livello_agentico.py                 # tabella, esito 0 o 1 (ratchet)
  python3 docs/kb/tools/misura_livello_agentico.py --json | --md   # per macchine o per il piano
  python3 docs/kb/tools/misura_livello_agentico.py --uso           # aggiunge l'uso in produzione (sulla VM)
  python3 docs/kb/tools/misura_livello_agentico.py --aggiorna-baseline
  python3 docs/kb/tools/misura_livello_agentico.py --selftest      # il comando sa diventare rosso
Uscita: 0 nessuna regressione, 1 una misura o un livello sotto il minimo, 2 una fonte manca.
"""
from __future__ import annotations

import contextlib
import copy
import io
import json
import os
import re
import subprocess
import sys
import tempfile

QUI = os.path.dirname(os.path.abspath(__file__))
R = os.path.abspath(os.path.join(QUI, "..", "..", ".."))
PIANO = os.path.join(R, "docs", "piani", "PIANO_heuresys-ai-driven_20261126.md")
CATALOGO = os.path.join(R, "docs", "kb", "atlas", "agent-operations.json")
CLASSI = os.path.join(R, "docs", "kb", "agent-classi-scritture.json")
PERIMETRI = os.path.join(R, "docs", "kb", "agent-perimetri.json")
BASELINE = os.path.join(R, "docs", "kb", "livello-agentico-baseline.json")
PROVE = os.path.join(R, "docs", "kb", "livello-agentico-prove.json")
BATTERIA = os.path.join(R, "apps", "agent-gateway", "test", "batteria")
USO_SQL = os.path.join(R, "docs", "piani", "ai-driven_20261126", "misura-uso.sql")
MOLTE = ("apps", "packages")

sys.path.insert(0, QUI)


class FonteMancante(Exception):
    pass


# ── lettura delle fonti ─────────────────────────────────────────────────────────────────────

def json_di(percorso: str) -> dict:
    try:
        with io.open(percorso, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError) as e:
        raise FonteMancante("%s non si legge (%s)" % (os.path.relpath(percorso, R), e))


def testo_di(percorso: str) -> str:
    try:
        with io.open(percorso, encoding="utf-8", errors="replace") as fh:
            return fh.read()
    except OSError as e:
        raise FonteMancante("%s non si legge (%s)" % (os.path.relpath(percorso, R), e))


def file_sotto(radici: tuple[str, ...], estensioni: tuple[str, ...]):
    for radice in radici:
        for d, dirs, files in os.walk(os.path.join(R, radice)):
            dirs[:] = [x for x in dirs if x not in ("node_modules", ".next", "dist", ".turbo", ".git")]
            for f in files:
                if f.endswith(estensioni):
                    yield os.path.join(d, f)


def piano_catalogo_scenari(piano: str) -> list[str]:
    """Gli id `S-xx` della tabella del catalogo (sezione 4 del piano)."""
    return sorted(set(re.findall(r"^\| (S-[A-Z]\d) \|", piano, re.M)))


def piano_domini(piano: str) -> dict[str, dict]:
    """Per ogni dominio Dn: i segnalatori e le applet previsti, dalla tabella dei domini."""
    out = {}
    for riga in re.findall(r"^\| (D\d) \|(.*)$", piano, re.M):
        celle = [c.strip() for c in riga[1].split("|")]
        if len(celle) < 5:
            continue
        out[riga[0]] = {"dominio": celle[0],
                        "segnalatori": [s.strip() for s in celle[1].split(";") if s.strip()],
                        "applet": [s.strip() for s in celle[3].split(";") if s.strip()]}
    return out


def segni_nel_codice() -> dict[str, set[str]]:
    """I segni `@scenario`, `@segnalatore`, `@applet` nei sorgenti (non nei test né nei documenti)."""
    rx = re.compile(r"@(scenario|segnalatore|applet)\s+([A-Za-z0-9:_.-]+)")
    out: dict[str, set[str]] = {"scenario": set(), "segnalatore": set(), "applet": set()}
    for f in file_sotto(MOLTE, (".ts", ".tsx")):
        rel = os.path.relpath(f, R).replace(os.sep, "/")
        if "/test/" in rel or rel.endswith((".test.ts", ".test.tsx")):
            continue
        for tipo, valore in rx.findall(testo_di(f)):
            out[tipo].add(valore)
    return out


def migrazioni() -> str:
    cartella = os.path.join(R, "db", "migrations")
    return "\n".join(testo_di(os.path.join(cartella, n)) for n in sorted(os.listdir(cartella)) if n.endswith(".sql"))


def batteria() -> dict:
    """{dominio: {domande, per_tipo, esito}} dalla cartella della batteria; vuota se non c'è."""
    out: dict[str, dict] = {}
    if not os.path.isdir(BATTERIA):
        return out
    esito = {}
    pe = os.path.join(BATTERIA, "ESITO.json")
    if os.path.isfile(pe):
        esito = json_di(pe)
    for n in sorted(os.listdir(BATTERIA)):
        m = re.fullmatch(r"(D\d)\.json", n)
        if not m:
            continue
        dati = json_di(os.path.join(BATTERIA, n))
        domande = dati.get("domande", dati) if isinstance(dati, dict) else dati
        per_tipo: dict[str, int] = {}
        for q in domande:
            per_tipo[q.get("tipo", "lettura")] = per_tipo.get(q.get("tipo", "lettura"), 0) + 1
        out[m.group(1)] = {"domande": len(domande), "per_tipo": per_tipo, "esito": esito.get(m.group(1))}
    return out


def strumento(nome: str, *args: str) -> tuple[int, str]:
    p = subprocess.run([sys.executable, os.path.join(QUI, nome), *args], capture_output=True, text=True, cwd=R)
    return p.returncode, p.stdout


def menu_e_pagine() -> dict:
    _, o = strumento("check_letture_agente.py")
    m = re.search(r"VOCI (\d+): lette (\d+), eccezioni (\d+), scoperte (\d+)", o)
    if not m:
        raise FonteMancante("check_letture_agente.py non ha detto le voci del menu")
    _, o2 = strumento("check_idoneita_agente.py")
    t = re.search(r"pagine totali\s+(\d+)", o2)
    i = re.search(r"IDONEE\s+(\d+)", o2)
    return {"voci": int(m.group(1)), "lette": int(m.group(2)), "eccezioni": int(m.group(3)),
            "scoperte": int(m.group(4)), "pagine": int(t.group(1)) if t else None,
            "idonee": int(i.group(1)) if i else None}


def scansione_rotte() -> dict:
    with contextlib.redirect_stderr(io.StringIO()):  # _pg_agenti avvisa su stderr: qui non serve il DB
        import build_atlas
    return build_atlas.scan_api(build_atlas.build_symbol_map())


def letture_e_scritture(moduli: dict, catalogo: dict) -> dict:
    """Le GET del codice, quante il catalogo apre; le scritture di business, quante hanno la classe."""
    from build_agent_operations import operation_id
    import check_copertura_agente as cop

    # La chiave è il modulo del codice: un concetto può chiamarsi diversamente dal suo modulo
    # (tenant-consolidations sta in tenant-consolidation) e il catalogo lo dichiara in `modulo`.
    nel_catalogo = {((v or {}).get("modulo") or m, o["method"], o.get("path", "/"))
                    for m, v in (catalogo.get("concepts") or {}).items()
                    for o in ((v or {}).get("operations") or {}).values()}
    get_tot = get_ok = 0
    codice = {}
    for mod, info in moduli.items():
        for r in info["routes"]:
            if r["method"] == "GET":
                get_tot += 1
                get_ok += (mod, "GET", r["path"]) in nel_catalogo
            else:
                codice[(mod, operation_id(r["method"], r["path"]))] = {"metodo": r["method"], "percorso": r["path"]}
    _, conti = cop.verifica(codice, json_di(CLASSI), json_di(PERIMETRI))
    return {"get_totali": get_tot, "get_raggiungibili": get_ok,
            "scritture_totali": conti["scritture"], "scritture_di_business": conti["di_business"],
            "scritture_nel_catalogo": conti["catalogo"], "B": conti["B"], "C": conti["C"]}


# ── le misure ───────────────────────────────────────────────────────────────────────────────

def misura(catalogo: dict | None = None, segni: dict | None = None) -> dict:
    """Tutte le misure. `catalogo` e `segni` si possono sostituire: serve all'autoprova."""
    piano = testo_di(PIANO)
    catalogo = catalogo if catalogo is not None else json_di(CATALOGO)
    segni = segni if segni is not None else segni_nel_codice()
    ls = letture_e_scritture(scansione_rotte(), catalogo)
    mp = menu_e_pagine()
    scen_piano = piano_catalogo_scenari(piano)
    domini = piano_domini(piano)
    seg_prev = sum(len(d["segnalatori"]) for d in domini.values())
    app_prev = sum(len(d["applet"]) for d in domini.values())
    mig = migrazioni()
    bat = batteria()
    domande = {d: b["domande"] for d, b in bat.items()}
    rc, _ = strumento("check_anagrafe_agenti.py")
    anagrafe = testo_di(os.path.join(R, "docs", "architecture", "agenti", "ANAGRAFE_agenti.md"))
    web = os.path.join(R, "apps", "web", "src", "app", "(authenticated)")
    pagine_web = [os.path.join(d, x) for d, ds, _f in os.walk(web) for x in ds]
    scen_impl = sorted(s for s in segni["scenario"] if s in scen_piano)

    def ha(*percorsi: str) -> bool:
        return all(os.path.isfile(os.path.join(R, p)) for p in percorsi)

    def scenari(prefisso: str) -> tuple[int, int]:
        previsti = [s for s in scen_piano if s.startswith(prefisso)]
        return sum(1 for s in previsti if s in scen_impl), len(previsti)

    return {
        "letture": {"totali": ls["get_totali"], "raggiungibili": ls["get_raggiungibili"],
                    "pct": round(100.0 * ls["get_raggiungibili"] / max(1, ls["get_totali"]), 1)},
        "scritture": {"totali": ls["scritture_totali"], "di_business": ls["scritture_di_business"],
                      "nel_catalogo": ls["scritture_nel_catalogo"], "B": ls["B"], "C": ls["C"],
                      "pct": round(100.0 * ls["scritture_nel_catalogo"] / max(1, ls["scritture_di_business"]), 1)},
        "pagine": {"voci_menu": mp["voci"], "lette": mp["lette"], "eccezioni": mp["eccezioni"],
                   "scoperte": mp["scoperte"], "pagine": mp["pagine"], "idonee": mp["idonee"],
                   "pct_lette": round(100.0 * mp["lette"] / max(1, mp["voci"]), 1)},
        "segnalatori": {"previsti": seg_prev, "implementati": len(segni["segnalatore"]),
                        "domini": len({s.split(":")[0] for s in segni["segnalatore"]})},
        "applet": {"previste": app_prev, "implementate": len(segni["applet"]),
                   "domini": len({s.split(":")[0] for s in segni["applet"]})},
        "scenari": {"catalogo": len(scen_piano), "implementati": len(scen_impl),
                    "S-O": scenari("S-O"), "S-M": scenari("S-M"), "S-P": scenari("S-P"),
                    "settore": sum(1 for s in ("S-O3", "S-C3", "S-P3") if s in scen_impl),
                    "S-O3": int("S-O3" in scen_impl)},
        "batteria": {"domande": sum(domande.values()), "domini_con_domande": len(domande),
                     "domini_a_soglia": sum(1 for n in domande.values() if n >= 200),
                     "diagnosi": sum(b["per_tipo"].get("diagnosi", 0) for b in bat.values()),
                     "documenti": sum(b["per_tipo"].get("documento", 0) for b in bat.values()),
                     "domini_superati": sum(1 for b in bat.values()
                                            if b["esito"] and b["esito"].get("totale")
                                            and b["esito"]["corrette"] / b["esito"]["totale"] >= 0.9),
                     "domini_previsti": len(domini)},
        "presenze": {
            "classi_fisse": ha("apps/agent-gateway/src/classi-azioni.ts", "docs/kb/agent-classi-scritture.json"),
            "cancello": ha("apps/agent-gateway/src/write-gate.ts", "apps/agent-gateway/test/prova-avversaria.test.ts"),
            "anagrafe_allineata": rc == 0,
            "diario_nel_db": "agent_gateway_decisions" in mig,
            "cruscotto_agenti": any(re.search(r"agent.*(cruscotto|dashboard|usage|uso)", p) for p in pagine_web),
            "versioni_promosse": bool(re.search(r"sys_agent_versions?\b", mig)),
            "proposte_agente": "sys_agent_proposals" in mig,
            "consigliere": os.path.isdir(os.path.join(R, "apps", "api", "src", "modules", "advisor")),
            "schema_scenari": "sys_scenarios" in mig,
            "struttura_ombra": "sys_scenario_shadow_units" in mig,
            "organigramma": os.path.isdir(os.path.join(R, "apps", "api", "src", "modules", "organigramma")),
            "cambiamento_oggetto": bool(re.search(r"sys_change(s|_requests|_plans)\b", mig)),
            "processi_modellati": os.path.isdir(os.path.join(R, "apps", "api", "src", "modules", "tenant-processes")),
            "agente_propone_processi": "000510" in "".join(os.listdir(os.path.join(R, "db", "migrations"))),
            "pannello_agente": ha("apps/web/src/components/pannello-agente.tsx"),
            "contesto_dichiarato_per_pagina": False,  # nessuna dichiarazione di contesto per pagina nel codice
            "copertura_in_ci": ha(".github/workflows/copertura-agente.yml"),
            "prova_avversaria": ha("apps/agent-gateway/test/prova-avversaria.test.ts"),
            "memoria_per_persona": bool(re.search(r"sys_agent_memor", mig)),
            "consolidamento": os.path.isdir(os.path.join(R, "apps", "api", "src", "modules", "tenant-consolidation")),
            "agente_ricerca": "`ricerca-proponente`" in anagrafe,
            "giudice_consolidamento": "`consolidamento-giudice`" in anagrafe,
        },
    }


# ── i dodici assi: cinque gradini ciascuno, con la misura che lo rende pieno ─────────────────

def g(testo: str, ratio: float) -> tuple[str, float]:
    return testo, max(0.0, min(1.0, float(ratio)))


def ass(m: dict) -> list[dict]:
    p, L, S, P = m["presenze"], m["letture"], m["scritture"], m["pagine"]
    sg, ap, sc, ba = m["segnalatori"], m["applet"], m["scenari"], m["batteria"]
    frazione = lambda a, b: (a / b) if b else 0.0
    scen = lambda k: frazione(*sc[k])
    return [
        {"n": 1, "asse": "Governo e sicurezza", "valutazione": 4.0, "gradini": [
            g("ogni azione ha la sua classe fissa", p["classi_fisse"]),
            g("cancello di scrittura con prova avversaria", p["cancello"]),
            g("anagrafe degli agenti allineata al codice", p["anagrafe_allineata"]),
            g("diario delle decisioni nel database", p["diario_nel_db"]),
            g("cruscotto di uso e consumo, versioni promosse = in servizio",
              (p["cruscotto_agenti"] + p["versioni_promosse"]) / 2 if not (p["cruscotto_agenti"] and p["versioni_promosse"]) else 1)]},
        {"n": 2, "asse": "Profondità di lettura", "valutazione": 3.5, "gradini": [
            g("letture raggiungibili ≥ 50%", L["pct"] / 50), g("≥ 80%", L["pct"] / 80),
            g("≥ 90%", L["pct"] / 90), g("≥ 98%", L["pct"] / 98),
            g("domande sui documenti nella batteria", frazione(ba["documenti"], 1))]},
        {"n": 3, "asse": "Capacità di agire", "valutazione": 1.5, "gradini": [
            g("scritture di business raggiungibili ≥ 25%", S["pct"] / 25), g("≥ 50%", S["pct"] / 50),
            g("≥ 90%", S["pct"] / 90),
            g("almeno un lavoro in più passi (applet)", ap["implementate"]),
            g("applet per dominio ≥ 3", frazione(ap["implementate"], 3 * max(1, ba["domini_previsti"])))]},
        {"n": 4, "asse": "Autonomia e proattività", "valutazione": 1.0, "gradini": [
            g("l'agente fa proposte", p["proposte_agente"]),
            g("almeno un segnalatore attivo", sg["implementati"]),
            g("segnalatori ≥ 50% dei previsti", frazione(sg["implementati"], 0.5 * sg["previsti"])),
            g("segnalatori = previsti, in ogni dominio", frazione(sg["implementati"], sg["previsti"])),
            g("segnalazioni giudicate utili ≥ 70% (uso, dal database)", 0)]},
        {"n": 5, "asse": "Fatti sommersi", "valutazione": 1.5, "gradini": [
            g("consigliere a regole con citazioni", p["consigliere"]),
            g("almeno un caso di diagnosi nella batteria", ba["diagnosi"]),
            g("≥ 25 casi di diagnosi", ba["diagnosi"] / 25),
            g("diagnosi in almeno 4 domini", 0 if not ba["diagnosi"] else ba["domini_con_domande"] / 4),
            g("diagnosi superate ≥ 90%", frazione(ba["domini_superati"], ba["domini_previsti"]))]},
        {"n": 6, "asse": "Decisioni sofisticate", "valutazione": 2.0, "gradini": [
            g("consigliere a regole", p["consigliere"]),
            g("schema degli scenari (opzioni, ipotesi, equità, fonti)", p["schema_scenari"]),
            g("almeno un calcolatore di scenario", sc["implementati"]),
            g("calcolatori ≥ 50% del catalogo", frazione(sc["implementati"], 0.5 * sc["catalogo"])),
            g("tutto il catalogo", frazione(sc["implementati"], sc["catalogo"]))]},
        {"n": 7, "asse": "Organizzazione e risorse", "valutazione": 2.5, "gradini": [
            g("organigramma e unità modellati", p["organigramma"]),
            g("struttura ombra del tenant", p["struttura_ombra"]),
            g("almeno uno scenario S-O", sc["S-O"][0]), g("tutti gli scenari S-O", scen("S-O")),
            g("confronto col settore (S-O3)", sc["S-O3"])]},
        {"n": 8, "asse": "Change management", "valutazione": 0.5, "gradini": [
            g("il cambiamento come oggetto (tabelle)", p["cambiamento_oggetto"]),
            g("almeno uno scenario S-M", sc["S-M"][0]), g("tutti gli scenari S-M", scen("S-M")),
            g("piano di adozione con avanzamento misurato", 0),
            g("un cambiamento di RTL dall'inizio alla fine (prova dal vivo)", 0)]},
        {"n": 9, "asse": "Ridisegno dei processi", "valutazione": 1.5, "gradini": [
            g("processi modellati con le loro facce", p["processi_modellati"]),
            g("l'agente propone le facce dei processi", p["agente_propone_processi"]),
            g("almeno uno scenario S-P", sc["S-P"][0]), g("tutti gli scenari S-P", scen("S-P")),
            g("ridisegno provato su un processo di RTL", 0)]},
        {"n": 10, "asse": "Assistenza in ogni funzione", "valutazione": 2.5, "gradini": [
            g("l'assistente è nelle pagine", p["pannello_agente"]),
            g("voci del menu lette ≥ 90%", P["pct_lette"] / 90),
            g("voci del menu lette 100% (le eccezioni scritte)", P["pct_lette"] / 100 if not P["scoperte"] else 0.5),
            g("contesto dichiarato su ogni pagina idonea", p["contesto_dichiarato_per_pagina"]),
            g("ogni funzione nuova nasce con la sua voce (controllo in CI)", p["copertura_in_ci"])]},
        {"n": 11, "asse": "Qualità e apprendimento", "valutazione": 1.0, "gradini": [
            g("prova avversaria del gateway", p["prova_avversaria"]),
            g("batteria di domande con risposta attesa", ba["domande"]),
            g("200 domande in ogni dominio", frazione(ba["domini_a_soglia"], ba["domini_previsti"])),
            g("soglia 9 su 10 in ogni dominio", frazione(ba["domini_superati"], ba["domini_previsti"])),
            g("memoria per persona e correzioni che migliorano le proposte", p["memoria_per_persona"])]},
        {"n": 12, "asse": "Generazione di modelli", "valutazione": 3.0, "gradini": [
            g("il consolidamento col modello del datastore", p["consolidamento"]),
            g("l'agente della ricerca di modello", p["agente_ricerca"]),
            g("il giudice del consolidamento", p["giudice_consolidamento"]),
            g("scenari con confronto di settore (S-O3, S-C3, S-P3)", sc["settore"] / 3),
            g("confronto di settore provato dal vivo", 0)]},
    ]


def livello(gradini: list[tuple[str, float]]) -> float:
    lv = 0.0
    for _t, r in gradini:
        if r >= 1:
            lv += 1
        else:
            if r >= 0.5:
                lv += 0.5
            break
    return lv


CRITERI = [
    (1, "Ogni funzione è anche dell'agente", "letture ≥ 95%, scritture ≥ 70%",
     lambda m: m["letture"]["pct"] >= 95 and m["scritture"]["pct"] >= 70),
    (2, "Agenti che lavorano da soli e segnalano", "segnalatori in almeno 3 domini",
     lambda m: m["segnalatori"]["domini"] >= 3),
    (3, "Lavoro in più passi", "almeno un'applet per dominio",
     lambda m: m["applet"]["domini"] >= m["batteria"]["domini_previsti"] > 0),
    (4, "Decisioni su scenari", "tutto il catalogo degli scenari calcolato",
     lambda m: m["scenari"]["catalogo"] > 0 and m["scenari"]["implementati"] == m["scenari"]["catalogo"]),
    (5, "Il cambiamento è un oggetto", "tabelle del cambiamento e scenari S-M",
     lambda m: m["presenze"]["cambiamento_oggetto"] and m["scenari"]["S-M"][0] == m["scenari"]["S-M"][1] > 0),
    (6, "I processi si ridisegnano con prove", "scenari S-P calcolati",
     lambda m: m["scenari"]["S-P"][0] == m["scenari"]["S-P"][1] > 0),
    (7, "Qualità e valore misurati", "batteria a soglia in ogni dominio",
     lambda m: m["batteria"]["domini_previsti"] > 0 and m["batteria"]["domini_superati"] == m["batteria"]["domini_previsti"]),
]


def criteri(m: dict, prove: dict) -> list[dict]:
    out = []
    for n, nome, soglia, pred in CRITERI:
        misura_ok = bool(pred(m))
        voci = prove.get(str(n)) or []
        out.append({"n": n, "criterio": nome, "soglia": soglia, "misura": misura_ok, "prove": len(voci),
                    "stato": "VERDE" if misura_ok and voci else ("misura verde, prova da registrare" if misura_ok else "ROSSO")})
    return out


# ── uso in produzione (facoltativo, sulla VM) ───────────────────────────────────────────────

def interpreta_uso(uscita: str) -> dict:
    """Le righe `etichetta|valore|...` della query di sola lettura `misura-uso.sql`."""
    uso: dict[str, list] = {}
    for riga in uscita.splitlines():
        campi = riga.split("|")
        if len(campi) >= 2 and campi[0] and not riga.startswith("SET"):
            uso.setdefault(campi[0], []).append(campi[1:])
    return uso


def uso_in_produzione() -> dict | None:
    import _pg_agenti  # noqa: F401  (porta l'ambiente sul ruolo degli agenti, se la credenziale c'è)
    p = subprocess.run(["psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-f", USO_SQL],
                       capture_output=True, text=True, cwd=R)
    if p.returncode != 0:
        print("uso: NON MISURATO, psql non ha risposto (%s)" % (p.stderr.strip().splitlines() or ["?"])[-1])
        return None
    return interpreta_uso(p.stdout)


# ── baseline: il ratchet ────────────────────────────────────────────────────────────────────

def piatte(m: dict) -> dict[str, float]:
    """Le misure numeriche, una chiave per valore, per il confronto col minimo."""
    out: dict[str, float] = {}

    def vai(prefisso, v):
        if isinstance(v, bool):
            out[prefisso] = float(v)
        elif isinstance(v, (int, float)):
            out[prefisso] = float(v)
        elif isinstance(v, dict):
            for k, x in v.items():
                vai(prefisso + "." + str(k), x)
        elif isinstance(v, (list, tuple)) and len(v) == 2 and all(isinstance(x, int) for x in v):
            out[prefisso] = float(v[0])
    for k in ("letture", "scritture", "pagine", "segnalatori", "applet", "scenari", "batteria", "presenze"):
        vai(k, m[k])
    # Il minimo guarda i numeratori e le percentuali, non i denominatori: il totale delle rotte, le
    # scritture «di business» (cambiano quando una categoria si riclassifica, come con #526) o i
    # previsti del piano possono scendere senza che si sia perso niente. Anche B e C si spostano
    # fra loro, e le eccezioni e le scoperte sono migliori quando scendono.
    for k in DENOMINATORI:
        out.pop(k, None)
    return out


DENOMINATORI = ("letture.totali", "scritture.totali", "scritture.di_business", "scritture.B", "scritture.C",
                "pagine.voci_menu", "pagine.pagine", "pagine.eccezioni", "pagine.scoperte",
                "segnalatori.previsti", "applet.previste", "scenari.catalogo", "batteria.domini_previsti")


def regressioni(m: dict, assi: list[dict], base: dict) -> list[str]:
    rossi = []
    ora = piatte(m)
    for k, minimo in sorted((base.get("misure") or {}).items()):
        if k in ora and ora[k] < minimo:
            rossi.append("misura %s: %s sotto il minimo %s" % (k, ora[k], minimo))
    for a in assi:
        minimo = (base.get("livelli") or {}).get(str(a["n"]))
        if minimo is not None and a["livello"] < minimo:
            rossi.append("asse %d (%s): livello %s sotto il minimo %s" % (a["n"], a["asse"], a["livello"], minimo))
    return rossi


def calcola(catalogo=None, segni=None) -> tuple[dict, list[dict]]:
    m = misura(catalogo, segni)
    assi = ass(m)
    for a in assi:
        a["livello"] = livello(a["gradini"])
    return m, assi


# ── presentazione ───────────────────────────────────────────────────────────────────────────

def mezzi(x: float) -> str:
    return ("%.1f" % x).replace(".", ",")


def tabella(m: dict, assi: list[dict], crit: list[dict], md: bool = False) -> str:
    L, S, P, sg, ap, sc, ba = (m[k] for k in ("letture", "scritture", "pagine", "segnalatori", "applet", "scenari", "batteria"))
    media = sum(a["livello"] for a in assi) / len(assi)
    righe = []
    if md:
        righe += ["| # | Asse | Valutazione 26/11 | Livello misurato | Primo gradino che manca |", "|---|---|---|---|---|"]
    for a in assi:
        manca = next((t for t, r in a["gradini"] if r < 1), "nessuno: livello 5")
        if md:
            righe.append("| %d | %s | %s | %s | %s |" % (a["n"], a["asse"], mezzi(a["valutazione"]), mezzi(a["livello"]), manca))
        else:
            righe.append("%2d  %-30s val. %s  misurato %s  manca: %s" % (a["n"], a["asse"], mezzi(a["valutazione"]), mezzi(a["livello"]), manca))
    righe.append("")
    righe.append("Livello medio sui dodici assi: %s su 5 (livello 5 su tutti gli assi = AI-driven, ADR-0063 D1)" % mezzi(media))
    righe.append("")
    righe.append("Numeri (valutazione del 26/11 tra parentesi):")
    righe.append("  letture   %d su %d raggiungibili dall'assistente, %s%% (415 e 387, 93%%)" % (L["raggiungibili"], L["totali"], L["pct"]))
    righe.append("  scritture %d di business, nel catalogo %d (B %d, C %d), %s%% (28 su 341, 8%%)"
                 % (S["di_business"], S["nel_catalogo"], S["B"], S["C"], S["pct"]))
    righe.append("  pagine    voci del menu lette %d su %d (eccezioni %d, scoperte %d); pagine idonee %s su %s"
                 % (P["lette"], P["voci_menu"], P["eccezioni"], P["scoperte"], P["idonee"], P["pagine"]))
    righe.append("  segnalatori %d su %d previsti; applet %d su %d previste; scenari calcolati %d su %d del catalogo"
                 % (sg["implementati"], sg["previsti"], ap["implementate"], ap["previste"], sc["implementati"], sc["catalogo"]))
    righe.append("  batteria  %d domande in %d domini su %d (a soglia %d, superati %d)"
                 % (ba["domande"], ba["domini_con_domande"], ba["domini_previsti"], ba["domini_a_soglia"], ba["domini_superati"]))
    righe.append("")
    righe.append("I sette criteri (VERDE = misura sopra soglia e prova dal vivo registrata):")
    for c in crit:
        righe.append("  %d  %-42s %s [%s; prove %d]" % (c["n"], c["criterio"], c["stato"], c["soglia"], c["prove"]))
    return "\n".join(righe)


def autoprova() -> int:
    """Il comando sa diventare rosso: toglie una voce dal catalogo e un segno dal codice, e guarda."""
    ko = 0
    m0, a0 = calcola()
    base = {"misure": piatte(m0), "livelli": {str(a["n"]): a["livello"] for a in a0}}
    if regressioni(m0, a0, base):
        print("  [KO] il punto di partenza non è verde contro se stesso")
        return 1
    # 1. una voce tolta dal catalogo dell'agente: letture raggiungibili in meno, rosso
    cat = copy.deepcopy(json_di(CATALOGO))
    for mod, v in cat["concepts"].items():
        gets = [k for k, o in v["operations"].items() if o["method"] == "GET"]
        if gets:
            del v["operations"][gets[0]]
            break
    m1, a1 = calcola(catalogo=cat)
    if not m1["letture"]["raggiungibili"] == m0["letture"]["raggiungibili"] - 1:
        print("  [KO] togliere una lettura dal catalogo non fa scendere le letture raggiungibili")
        ko += 1
    if not any("letture.pct" in r for r in regressioni(m1, a1, base)):
        print("  [KO] togliere una lettura dal catalogo non rende rosso il ratchet")
        ko += 1
    # 2. un segno aggiunto nel codice: il gradino sale, nessun rosso
    segni = segni_nel_codice()
    segni["segnalatore"].add("D1:finto")
    m2, a2 = calcola(segni=segni)
    if m2["segnalatori"]["implementati"] != m0["segnalatori"]["implementati"] + 1 or regressioni(m2, a2, base):
        print("  [KO] un segnalatore in più deve alzare la misura e non rendere rosso")
        ko += 1
    # 3. un livello sotto il minimo è rosso, anche se le misure sono uguali
    alto = copy.deepcopy(base)
    alto["livelli"]["1"] = 5.0
    if not any("asse 1" in r for r in regressioni(m0, a0, alto)):
        print("  [KO] un livello sotto il minimo non rende rosso")
        ko += 1
    # 4. un criterio non è verde senza la prova dal vivo
    m_ok = copy.deepcopy(m0)
    m_ok["letture"]["pct"], m_ok["scritture"]["pct"] = 100.0, 100.0
    if criteri(m_ok, {})[0]["stato"] != "misura verde, prova da registrare":
        print("  [KO] un criterio con la sola misura non deve dirsi verde")
        ko += 1
    if criteri(m_ok, {"1": [{"data": "x"}]})[0]["stato"] != "VERDE":
        print("  [KO] un criterio con misura e prova deve dirsi verde")
        ko += 1
    # 5. l'uso si legge dall'uscita del database
    uso = interpreta_uso("conv|10|3|2026-11-01|2026-11-26\nattivita|7\n")
    if uso.get("conv") != [["10", "3", "2026-11-01", "2026-11-26"]] or uso.get("attivita") != [["7"]]:
        print("  [KO] l'uscita della query dell'uso non si interpreta")
        ko += 1
    print("selftest: 7 casi, %d falliti" % ko)
    return 1 if ko else 0


def main() -> int:
    a = sys.argv[1:]
    if "--selftest" in a:
        return autoprova()
    try:
        m, assi = calcola()
        prove = json_di(PROVE) if os.path.isfile(PROVE) else {}
        base = json_di(BASELINE) if os.path.isfile(BASELINE) else {}
    except FonteMancante as e:
        print("NON MISURABILE: %s" % e)
        return 2
    crit = criteri(m, prove)
    uso = uso_in_produzione() if "--uso" in a else None
    if "--aggiorna-baseline" in a:
        vecchi = base.get("misure") or {}
        nuovi = {k: max(v, vecchi.get(k, v)) for k, v in piatte(m).items()}  # le chiavi dismesse cadono
        liv = {str(x["n"]): max(x["livello"], (base.get("livelli") or {}).get(str(x["n"]), 0)) for x in assi}
        with io.open(BASELINE, "w", encoding="utf-8", newline="\n") as fh:
            json.dump({"_nota": "Il minimo accettato di ogni misura e livello. Sale solo con --aggiorna-baseline, "
                                "mai da sé. docs/kb/tools/misura_livello_agentico.py (piano AI-driven, voce M1).",
                       "misure": nuovi, "livelli": liv}, fh, ensure_ascii=False, indent=1, sort_keys=True)
            fh.write("\n")
        print("minimo aggiornato: %d misure, %d livelli" % (len(nuovi), len(liv)))
        return 0
    rossi = regressioni(m, assi, base) if base else []
    if "--json" in a:
        print(json.dumps({"misure": m, "assi": [{k: v for k, v in x.items() if k != "gradini"} |
                          {"gradini": [{"gradino": t, "ratio": r} for t, r in x["gradini"]]} for x in assi],
                          "criteri": crit, "uso": uso, "regressioni": rossi}, ensure_ascii=False, indent=1, default=list))
    else:
        print(tabella(m, assi, crit, md="--md" in a))
        if uso is not None:
            print("\nUso in produzione (sola lettura): " + "; ".join("%s %s" % (k, v[0]) for k, v in uso.items()))
        elif "--uso" not in a:
            print("\nUso in produzione: non misurato qui (serve --uso sulla VM).")
        if not base:
            print("\nBASELINE assente: nessun ratchet. Si crea con --aggiorna-baseline.")
        for r in rossi:
            print("ROSSO " + r)
        print("\nesito: %s" % ("ROSSO, %d regressioni" % len(rossi) if rossi else "VERDE (nessuna misura sotto il minimo)"))
    return 1 if rossi else 0


if __name__ == "__main__":
    sys.exit(main())
