#!/usr/bin/env python3
"""
check_exposure.py — il cancello di ESPOSIZIONE.

Regola (Enzo, 2026-07-28, vincolante e retroattiva su tutti i cluster):
un dato che nessuna API espone non è nel prodotto, è solo nel database. Alla
chiusura di ogni cluster del programma storia36 — e di qualunque lavoro che
popoli tabelle — le lacune di esposizione vanno colmate: endpoint, schema
condiviso, query, wiring.

Questo strumento rende la regola VERIFICABILE invece che augurabile: deriva
dal repository quali tabelle vengono POPOLATE e quali di quelle nessun modulo
dell'API legge, e fallisce (exit 1) se ne resta anche una sola.

Non contiene liste scritte a mano: le tabelle scritte si ricavano dai seed E
dalle migrazioni, le letture dal sorgente dell'API, i conteggi dal database vivo.

⚠ IL BUCO CHIUSO IL 2026-09-12 (#79 F3, dichiarato in S1083 e rimasto aperto due
settimane). Fino ad allora le «scritte» erano SOLO i seed di storia36: una migrazione
che popola una tabella nuova, mai toccata dal codice applicativo, passava inosservata —
esattamente il caso di `000361` e `000362`, verificate a mano quel giorno. Adesso le
migrazioni sono la seconda fonte (`INSERT INTO` / `COPY` su `sys.sys_*`), etichettate
col loro numero. Misurato il giorno dell'estensione: 86 tabelle popolate da migrazioni,
di cui 11 senza un `FROM`/`JOIN` nel sorgente dell'API — e tre erano FALSI SCOPERTI,
perché il cancello sapeva leggere in un modo solo. Da qui le tre vie di lettura in più:
  ② una COSTANTE di tabella (`tabella: "sys.sys_x"` in `lib/scope/profilo.ts`, poi
     `FROM ${cfg.tabella}`): la stringa è nel sorgente, la regex `FROM sys.` non la vede;
  ③ una FUNZIONE o VISTA SQL che legge la tabella e che l'API invoca per nome
     (`sys.sys_blueprint_family_for_activity_class()` in `derivation.ts`);
  ④ un TRIGGER su una tabella che l'API legge: la funzione del trigger consuma la
     tabella (`sys_auth_mfa_exemption_eligible_users` via il trigger di
     `sys_auth_mfa_exemptions`).
Le altre restano scoperte finché non hanno un lettore o una deroga MOTIVATA.

Uso:
    python docs/kb/tools/check_exposure.py            # con conteggi live
    python docs/kb/tools/check_exposure.py --no-db    # senza tunnel
    python docs/kb/tools/check_exposure.py --json     # esito per altri strumenti
    python docs/kb/tools/check_exposure.py --selftest # l'autoprova, a esiti opposti

Deroghe: una tabella può restare non esposta solo se dichiarata in
`docs/kb/tools/exposure_waivers.txt` con una motivazione sulla stessa riga
(formato `nome_tabella  # motivo`). Una deroga senza motivo non è una deroga.

Trappola nota: l'esito si legge sul CODICE D'USCITA del processo, mai dai messaggi.
"""
from __future__ import annotations

import argparse
import collections
import json
import os
import re
import subprocess
import sys

RADICE = subprocess.run(["git", "rev-parse", "--show-toplevel"],
                        capture_output=True, text=True).stdout.strip()
SEEDS = os.path.join(RADICE, "db", "seeds", "storia36")
MIGRAZIONI = os.path.join(RADICE, "db", "migrations")
API = os.path.join(RADICE, "apps", "api", "src")
DEROGHE = os.path.join(RADICE, "docs", "kb", "tools", "exposure_waivers.txt")

CLUSTER_DA_PREFISSO = {"00": "C0", "01": "C1", "02": "C2", "03": "C3", "04": "C4",
                       "05": "C5", "06": "C6", "07": "C7", "08": "C8", "09": "C9",
                       "10": "C10", "11": "C11", "12": "C12"}

RE_SCRIVE = re.compile(r"\b(?:INSERT\s+INTO|UPDATE|COPY)\s+sys\.(sys_\w+)", re.I)
RE_LEGGE = re.compile(r"\b(?:FROM|JOIN)\s+sys\.(sys_\w+)", re.I)
RE_COSTANTE = re.compile(r"""["'`]sys\.(sys_\w+)["'`]""")
RE_OGGETTO = re.compile(
    r"CREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|VIEW|MATERIALIZED\s+VIEW)\s+(sys\.\w+)", re.I)
RE_FINE_OGGETTO = re.compile(r"\n(?:CREATE|ALTER|DROP|INSERT|DO\s+\$|COMMIT|COMMENT)", re.I)
RE_COMMENTO_SQL = re.compile(r"^[ \t]*--[^\n]*$", re.M)
RE_TRIGGER = re.compile(
    r"CREATE\s+TRIGGER\s+\w+\s+.*?\bON\s+sys\.(sys_\w+)\b.*?EXECUTE\s+(?:FUNCTION|PROCEDURE)\s+(sys\.\w+)",
    re.I | re.S)


# ── le fonti, come TESTI: così l'autoprova può darle finte ─────────────────────────

def _leggi_dir(cartella: str, suffisso: str = ".sql") -> list[tuple[str, str]]:
    if not os.path.isdir(cartella):
        return []
    esito = []
    for nome in sorted(os.listdir(cartella)):
        if nome.endswith(suffisso):
            esito.append((nome, open(os.path.join(cartella, nome),
                                     encoding="utf-8", errors="replace").read()))
    return esito


def _leggi_api(radice: str) -> list[tuple[str, str]]:
    esito = []
    for base, _dirs, files in os.walk(radice):
        for f in files:
            if f.endswith(".ts"):
                p = os.path.join(base, f)
                rel = os.path.relpath(p, radice).replace("\\", "/")
                esito.append((rel, open(p, encoding="utf-8", errors="replace").read()))
    return esito


def tabelle_scritte(seeds: list[tuple[str, str]] | None = None,
                    migrazioni: list[tuple[str, str]] | None = None) -> dict[str, set[str]]:
    """Le tabelle che i seed del programma E le migrazioni popolano, con chi le tocca."""
    esito: dict[str, set[str]] = collections.defaultdict(set)
    for nome, testo in (seeds if seeds is not None else _leggi_dir(SEEDS)):
        cluster = CLUSTER_DA_PREFISSO.get(nome[:2], "?")
        for m in RE_SCRIVE.finditer(testo):
            esito[m.group(1)].add(cluster)
    for nome, testo in (migrazioni if migrazioni is not None else _leggi_dir(MIGRAZIONI)):
        # dalle migrazioni contano INSERT e COPY: un UPDATE non popola una tabella nuova,
        # e conterebbe ogni backfill di colonna come «scrittura da esporre».
        for m in re.finditer(r"\b(?:INSERT\s+INTO|COPY)\s+sys\.(sys_\w+)", testo, re.I):
            esito[m.group(1)].add("mig:" + nome[:6])
    return esito


def _modulo(rel: str) -> str:
    return rel.split("/")[1] if rel.startswith("modules/") else rel.split("/")[0]


def tabelle_lette(api: list[tuple[str, str]] | None = None,
                  migrazioni: list[tuple[str, str]] | None = None) -> dict[str, set[str]]:
    """Le tabelle che il sorgente dell'API legge, e come.

    Quattro vie, ognuna etichettata con chi legge:
      ① `FROM`/`JOIN sys.sys_x` nel sorgente          → `<modulo>`
      ② la costante `"sys.sys_x"` nel sorgente         → `<modulo> (costante)`
      ③ una funzione/vista SQL che legge x, invocata   → `<modulo> via sys.f`
      ④ un trigger su una tabella letta, che legge x   → `trigger su sys_t (sys.f)`
    """
    api = api if api is not None else _leggi_api(API)
    migrazioni = migrazioni if migrazioni is not None else _leggi_dir(MIGRAZIONI)
    esito: dict[str, set[str]] = collections.defaultdict(set)
    sorgente = "\n".join(t for _, t in api)

    # ① e ②
    for rel, testo in api:
        mod = _modulo(rel)
        for m in RE_LEGGE.finditer(testo):
            esito[m.group(1)].add(mod)
        for m in RE_COSTANTE.finditer(testo):
            esito[m.group(1)].add(f"{mod} (costante)")

    # gli oggetti SQL definiti dalle migrazioni, col loro corpo
    oggetti: dict[str, str] = {}
    trigger: list[tuple[str, str]] = []   # (tabella, funzione)
    for _nome, testo in migrazioni:
        # senza le righe di commento: un blocco di rollback commentato («--   CREATE OR
        # REPLACE FUNCTION …») ridefinirebbe l'oggetto con un corpo vuoto, e la 000284 lo fa
        testo = RE_COMMENTO_SQL.sub("", testo)
        for m in RE_OGGETTO.finditer(testo):
            inizio = m.end()
            fine = RE_FINE_OGGETTO.search(testo, inizio)
            oggetti[m.group(1)] = testo[inizio: fine.start() if fine else len(testo)]
        for m in RE_TRIGGER.finditer(testo):
            trigger.append((m.group(1), m.group(2)))

    # ③ — l'API nomina l'oggetto
    for nome, corpo in oggetti.items():
        if nome not in sorgente:
            continue
        chi = sorted({_modulo(rel) for rel, t in api if nome in t})
        for m in RE_LEGGE.finditer(corpo):
            esito[m.group(1)].add(f"{','.join(chi)} via {nome}")

    # ④ — un trigger su una tabella già letta (per ① o ②)
    for tabella, funzione in trigger:
        if tabella not in esito or funzione not in oggetti:
            continue
        for m in RE_LEGGE.finditer(oggetti[funzione]):
            esito[m.group(1)].add(f"trigger su {tabella} ({funzione})")
    return esito


def deroghe(testo: str | None = None) -> dict[str, str]:
    """Tabelle esplicitamente esentate, con il motivo. Senza motivo non vale."""
    esito: dict[str, str] = {}
    if testo is None:
        if not os.path.exists(DEROGHE):
            return esito
        testo = open(DEROGHE, encoding="utf-8").read()
    for riga in testo.splitlines():
        riga = riga.strip()
        if not riga or riga.startswith("#"):
            continue
        if "#" not in riga:
            continue  # deroga senza motivo: ignorata di proposito
        tabella, motivo = riga.split("#", 1)
        if tabella.strip() and motivo.strip():
            esito[tabella.strip()] = motivo.strip()
    return esito


def conteggi(tabelle: list[str]) -> dict[str, int]:
    if not tabelle:
        return {}
    sql = " UNION ALL ".join(
        f"SELECT '{t}' AS t, count(*)::text AS n FROM sys.{t}" for t in tabelle)
    try:
        out = subprocess.run(
            ["psql", "-h", "localhost", "-p", "5433", "-U", "heuresys",
             "-d", "heuresys_advanced", "-X", "-tA", "-F", "|", "-c", sql],
            capture_output=True, text=True, timeout=120)
    except Exception:
        return {}
    esito = {}
    for r in out.stdout.strip().splitlines():
        if "|" in r:
            t, n = r.split("|", 1)
            try:
                esito[t] = int(n)
            except ValueError:
                pass
    return esito


def classifica(scritte, lette, esentate, righe):
    scoperte, coperte, con_deroga = [], [], []
    for t in sorted(scritte):
        voce = {"tabella": t, "cluster": sorted(scritte[t]),
                "righe": righe.get(t), "moduli": sorted(lette.get(t, []))}
        if voce["moduli"]:
            coperte.append(voce)
        elif t in esentate:
            voce["deroga"] = esentate[t]
            con_deroga.append(voce)
        else:
            scoperte.append(voce)
    return scoperte, coperte, con_deroga


# ── l'autoprova: ogni via di lettura ha un caso che passa e uno che NON passa ──────

def selftest() -> int:
    api = [
        ("modules/a/repository.ts", "SELECT 1 FROM sys.sys_letta_diretta"),
        ("lib/scope/profilo.ts", 'const C = { tabella: "sys.sys_letta_costante" }; `FROM ${C.tabella}`'),
        ("modules/b/derivation.ts", "SELECT sys.fn_usata($1)"),
        ("modules/c/repository.ts", "SELECT 1 FROM sys.sys_con_trigger"),
    ]
    mig = [
        ("000001_x.sql", """
INSERT INTO sys.sys_letta_diretta VALUES (1);
INSERT INTO sys.sys_letta_costante VALUES (1);
INSERT INTO sys.sys_via_funzione VALUES (1);
INSERT INTO sys.sys_via_funzione_non_usata VALUES (1);
INSERT INTO sys.sys_via_trigger VALUES (1);
INSERT INTO sys.sys_via_trigger_orfano VALUES (1);
INSERT INTO sys.sys_scoperta VALUES (1);
INSERT INTO sys.sys_con_deroga VALUES (1);
INSERT INTO sys.sys_deroga_senza_motivo VALUES (1);
UPDATE sys.sys_solo_update SET a = 1;
CREATE OR REPLACE FUNCTION sys.fn_usata() RETURNS int AS $$ SELECT 1 FROM sys.sys_via_funzione $$ LANGUAGE sql;
CREATE OR REPLACE FUNCTION sys.fn_non_usata() RETURNS int AS $$ SELECT 1 FROM sys.sys_via_funzione_non_usata $$ LANGUAGE sql;
CREATE OR REPLACE FUNCTION sys.trg_fn() RETURNS trigger AS $$ BEGIN PERFORM 1 FROM sys.sys_via_trigger; END $$ LANGUAGE plpgsql;
CREATE TRIGGER t1 AFTER INSERT ON sys.sys_con_trigger FOR EACH ROW EXECUTE FUNCTION sys.trg_fn();
CREATE OR REPLACE FUNCTION sys.trg_orfano() RETURNS trigger AS $$ BEGIN PERFORM 1 FROM sys.sys_via_trigger_orfano; END $$ LANGUAGE plpgsql;
CREATE TRIGGER t2 AFTER INSERT ON sys.sys_mai_letta FOR EACH ROW EXECUTE FUNCTION sys.trg_orfano();
-- rollback, tenuto per storia (NON deve ridefinire fn_usata con un corpo vuoto):
--   CREATE OR REPLACE FUNCTION sys.fn_usata() RETURNS int AS $$ SELECT 1 $$ LANGUAGE sql;
"""),
    ]
    seeds = [("03_seed.sql", "INSERT INTO sys.sys_da_seed VALUES (1);")]
    der = deroghe("sys_con_deroga  # motivo scritto\nsys_deroga_senza_motivo\n")
    scritte = tabelle_scritte(seeds, mig)
    lette = tabelle_lette(api, mig)
    scoperte, coperte, con_deroga = classifica(scritte, lette, der, {})
    nomi_scoperte = {v["tabella"] for v in scoperte}
    nomi_coperte = {v["tabella"] for v in coperte}
    attese = [
        # (descrizione, condizione)
        ("un seed scrive → conta (C3)", scritte.get("sys_da_seed") == {"C3"}),
        ("una migrazione popola → conta, con il numero", scritte.get("sys_scoperta") == {"mig:000001"}),
        ("un UPDATE in migrazione NON conta come popolamento", "sys_solo_update" not in scritte),
        ("① FROM diretto → coperta", "sys_letta_diretta" in nomi_coperte),
        ("② costante di tabella → coperta", "sys_letta_costante" in nomi_coperte),
        ("③ funzione invocata dall'API → coperta", "sys_via_funzione" in nomi_coperte),
        ("③ una ridefinizione COMMENTATA (rollback) non svuota il corpo", "sys_via_funzione" in nomi_coperte and "sys_via_funzione" not in nomi_scoperte),
        ("③ funzione che l'API NON invoca → scoperta", "sys_via_funzione_non_usata" in nomi_scoperte),
        ("④ trigger su tabella letta → coperta", "sys_via_trigger" in nomi_coperte),
        ("④ trigger su tabella MAI letta → scoperta", "sys_via_trigger_orfano" in nomi_scoperte),
        ("nessun lettore, nessuna deroga → scoperta", "sys_scoperta" in nomi_scoperte),
        ("deroga con motivo → esentata", any(v["tabella"] == "sys_con_deroga" for v in con_deroga)),
        ("deroga SENZA motivo → resta scoperta", "sys_deroga_senza_motivo" in nomi_scoperte),
    ]
    rossi = 0
    for desc, ok in attese:
        print(f"  [{'ok' if ok else 'FAIL'}] {desc}")
        rossi += 0 if ok else 1
    print(f"\n  autoprova: {len(attese) - rossi}/{len(attese)}")
    return 1 if rossi else 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-db", action="store_true", help="salta i conteggi live")
    ap.add_argument("--json", action="store_true", help="esito in JSON")
    ap.add_argument("--selftest", action="store_true", help="l'autoprova a esiti opposti")
    args = ap.parse_args()
    if args.selftest:
        return selftest()

    scritte = tabelle_scritte()
    lette = tabelle_lette()
    esentate = deroghe()
    tab = sorted(scritte)
    righe = {} if args.no_db else conteggi(tab)
    scoperte, coperte, con_deroga = classifica(scritte, lette, esentate, righe)

    if args.json:
        print(json.dumps({"scoperte": scoperte, "con_deroga": con_deroga,
                          "coperte": len(coperte)}, indent=2, ensure_ascii=False))
        return 1 if scoperte else 0

    da_seed = sum(1 for t in tab if any(not c.startswith("mig:") for c in scritte[t]))
    da_mig = sum(1 for t in tab if any(c.startswith("mig:") for c in scritte[t]))
    print("=" * 84)
    print(" CANCELLO DI ESPOSIZIONE — cosa viene popolato e cosa l'API espone")
    print("=" * 84)
    print(f"\n  tabelle popolate (seed ∪ migrazioni): {len(tab)}   (seed {da_seed} · migrazioni {da_mig})")
    print(f"  lette da almeno un modulo API       : {len(coperte)}")
    print(f"  esentate con motivo dichiarato      : {len(con_deroga)}")
    print(f"  NON ESPOSTE                         : {len(scoperte)}\n")

    for v in con_deroga:
        r = "?" if v["righe"] is None else v["righe"]
        print(f"  [deroga] {v['tabella']:44} {r:>8} righe — {v['deroga']}")
    if con_deroga:
        print()

    for v in scoperte:
        r = "?" if v["righe"] is None else v["righe"]
        print(f"  [SCOPERTA] {v['tabella']:42} {','.join(v['cluster'])[:20]:20} {r:>8} righe")

    if scoperte:
        print("\n  Servono endpoint, schema condiviso, query e wiring — oppure una deroga")
        print(f"  motivata in {os.path.relpath(DEROGHE, RADICE)}.\n")
        return 1

    print("  Nessuna lacuna di esposizione.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
