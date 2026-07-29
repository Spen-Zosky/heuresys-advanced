#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
db/scripts/audit-storia36-semantic.py — audit semantico trasversale (storia36 Task C12, Step 12.2)

MANDATO (Enzo, S1033): "il secondo passaggio va fatto su TUTTE le tabelle" — per ognuna
una regola di dominio applicabile, ESEGUITA e verbalizzata con esito; le tabelle senza
regola sensata dichiarate esplicitamente con il perche'.

Metodo (AP-03: mai elenchi a mano — tutto derivato da `information_schema`/`pg_catalog`):
  * il perimetro e' l'insieme delle BASE TABLE di `sys` letto dal catalogo a ogni run;
  * l'APPLICABILITA' di ogni regola si deriva dal TIPO della colonna e dal suo RUOLO
    (nome), non da una lista di tabelle;
  * ogni regola e' una query eseguita sul DB reale: il verbale riporta cio' che il
    database ha risposto, non cio' che ci si aspettava.

Regole (ognuna dichiarata nel verbale con il criterio di applicabilita'):
  D1  date/timestamp di FATTO oltre la finestra della storia (futuro non spiegabile)
  D2  date di FATTO assurdamente antiche (< 1900-01-01)
  D3  coppie inizio/fine invertite (fine < inizio)
  N1  misure percentuali fuori [0,100]
  N2  importi monetari negativi
  S1  colonne interamente NULL su tabella popolata (campo previsto e mai valorizzato)
  S2  colonne a valore unico su tabella con >= 20 righe (varianza zero: riempimento meccanico)
  C1  artefatto di calendario: giorno-del-mese o mese dominante su date di FATTO
  X1  duplicati logici (righe identiche al netto di chiave tecnica e audit di scrittura)
  V1  tabella vuota — richiede una dichiarazione esplicita del perche'

Le colonne di AUDIT DI SCRITTURA (created_at/updated_at/*_by) sono ESCLUSE dalle regole
di fatto (D1/D2/C1/X1): chi scrive una riga non e' il soggetto della riga (lezione I14),
e la loro data e' quella del seed, non della storia.

Uso:
    python db/scripts/audit-storia36-semantic.py            # scrive il verbale
    python db/scripts/audit-storia36-semantic.py --strict   # exit 1 se ci sono rilievi
    python db/scripts/audit-storia36-semantic.py --table X  # una sola tabella (debug)
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
OUT = REPO / "docs" / "kb" / "storia36" / "AUDIT_FINALE.md"
WAIVERS = REPO / "db" / "scripts" / "audit-storia36-empty-tables.txt"
EXPLANATIONS = REPO / "db" / "scripts" / "audit-storia36-explanations.txt"

# Finestra della storia: inizio dal piano; la fine si calcola (mai una costante — il DB
# e' produzione viva e il mese in corso non e' una violazione).
STORY_START = "2023-08-01"

PSQL_BIN = shutil.which("psql") or r"C:\Program Files\PostgreSQL\16\bin\psql.exe"

# ---------------------------------------------------------------- ruoli di colonna
AUDIT_COL = re.compile(
    r"^(created_at|updated_at|deleted_at|created_by|updated_by|deleted_by|"
    r"created_by_user_id|updated_by_user_id|deleted_by_user_id|.*_by|.*_actor.*)$"
)
# date per cui un valore FUTURO e' atteso (scadenze, pianificazioni, obiettivi)
FUTURE_OK = re.compile(
    r"(expir|expiry|valid_to|valid_until|due|deadline|target|planned|scheduled|"
    r"next_|renewal|forecast|end_date|ends_at|until|review_date|retention|"
    r"effective_to|to_date|cycle_end|period_end|window_end)"
)
MONEY = re.compile(
    r"(amount|salary|pay|cost|budget|price|compensation|bonus|gross|net_|_net|"
    r"ral|fee|allowance|premium|contribution|earning|deduction|balance)"
)
PERCENT = re.compile(r"(percent|_pct|pct_|percentage|progress|completion|coverage)$|"
                     r"(percent|_pct|pct_|percentage|progress|completion|coverage)_")
NON_NEGATIVE = re.compile(r"(count|quantity|qty|hours|days|duration|number|total|"
                          r"score|rating|level|rank|weight|headcount|seats|capacity)")
DATEISH = ("date", "timestamp with time zone", "timestamp without time zone")
NUMERIC = ("numeric", "integer", "bigint", "smallint", "real", "double precision")
# tipi senza operatore di uguaglianza affidabile -> fuori da DISTINCT/duplicati
NO_EQ = ("json", "USER-DEFINED", "tsvector", "xml")


def psql(sql: str) -> str:
    env = dict(os.environ)
    envfile = REPO / ".env"
    if envfile.exists():
        for line in envfile.read_text(encoding="utf-8", errors="replace").splitlines():
            m = re.match(r"^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$", line)
            if m:
                env.setdefault(m.group(1), m.group(2).strip().strip('"').strip("'"))
    args = [
        PSQL_BIN,
        "-h", env.get("POSTGRES_HOST", "localhost"),
        "-p", env.get("POSTGRES_PORT", "5433"),
        "-U", env.get("POSTGRES_USER", "heuresys"),
        "-d", env.get("POSTGRES_DB", "heuresys_advanced"),
        "-X", "-tA", "-v", "ON_ERROR_STOP=1", "-c", sql,
    ]
    if env.get("POSTGRES_PASSWORD"):
        env["PGPASSWORD"] = env["POSTGRES_PASSWORD"]
    return subprocess.check_output(args, text=True, encoding="utf-8",
                                   errors="replace", env=env).strip()


def jq(sql: str):
    """Una query che ritorna JSON. Lista vuota se nessuna riga.

    L'alias `__q` non e' cosmetico: con un alias di una lettera, una colonna omonima
    nella SELECT interna lo maschera e `json_agg` aggrega la COLONNA invece della RIGA
    (visto davvero su `relname AS t`). `to_jsonb(__q.*)` riferisce la riga in modo esplicito.
    """
    raw = psql(f"SELECT coalesce(json_agg(to_jsonb(__q.*)), '[]'::json) FROM ({sql}) __q")
    return json.loads(raw or "[]")


def qi(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


# ---------------------------------------------------------------- catalogo
def catalog():
    cols = jq("""
        SELECT c.table_name, c.column_name, c.data_type, c.is_nullable
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_schema=c.table_schema AND t.table_name=c.table_name
         AND t.table_type='BASE TABLE'
        WHERE c.table_schema='sys'
        ORDER BY c.table_name, c.ordinal_position
    """)
    tables: dict[str, list[dict]] = {}
    for c in cols:
        tables.setdefault(c["table_name"], []).append(c)
    return tables


def window_end() -> str:
    return psql("SELECT (date_trunc('month', now()) + interval '1 month - 1 day')::date")


# ---------------------------------------------------------------- regole
def fact_dates(cols):
    """Colonne data che rappresentano un FATTO della storia (non audit di scrittura)."""
    return [c for c in cols
            if c["data_type"] in DATEISH and not AUDIT_COL.match(c["column_name"])]


def start_end_pairs(cols):
    """Coppie inizio/fine derivate dai nomi, non da una lista."""
    names = {c["column_name"]: c for c in cols if c["data_type"] in DATEISH}
    pairs = []
    for n in names:
        for a, b in (("start", "end"), ("_from", "_to"), ("valid_from", "valid_to"),
                     ("hire", "termination"), ("begin", "end"), ("issued", "expires")):
            if a in n:
                cand = n.replace(a, b)
                if cand in names and cand != n:
                    pairs.append((n, cand))
    # dedup mantenendo l'ordine
    seen, out = set(), []
    for p in pairs:
        if p not in seen and (p[1], p[0]) not in seen:
            seen.add(p)
            out.append(p)
    return out


def build_probe(table, cols, wend):
    """UNA query per tabella: tutte le aggregazioni in una passata.

    Gli alias sono POSIZIONALI (`a0`, `a1`, …) e la corrispondenza vive in Python:
    un alias parlante lungo verrebbe troncato da PostgreSQL a 63 caratteri e due
    misure diverse potrebbero collassare sulla stessa chiave, perdendone una in
    silenzio (osservato sui nomi `*_position_assignment_*`). Un audit che perde una
    misura senza dirlo e' peggio di un audit che non la fa.
    """
    exprs, amap = ["count(*) AS a_n"], {}

    def add(kind, key, sql):
        alias = f"a{len(amap)}"
        amap[alias] = (kind, key)
        exprs.append(f"{sql} AS {alias}")

    for c in cols:
        col, dt, name = qi(c["column_name"]), c["data_type"], c["column_name"]
        if dt not in NO_EQ:
            add("nn", name, f"count({col})")
            add("nd", name, f"count(DISTINCT {col})")

        if dt in DATEISH and not AUDIT_COL.match(name):
            add("mn", name, f"min({col})::text")
            add("mx", name, f"max({col})::text")
            if not FUTURE_OK.search(name):
                add("fu", name, f"count(*) FILTER (WHERE {col} > date '{wend}')")
            add("an", name, f"count(*) FILTER (WHERE {col} < date '1900-01-01')")

        if dt in NUMERIC:
            add("nmin", name, f"min({col})::text")
            add("nmax", name, f"max({col})::text")

    for a, b in start_end_pairs(cols):
        add("se", (a, b), f"count(*) FILTER (WHERE {qi(b)} < {qi(a)})")

    return f"SELECT {', '.join(exprs)} FROM sys.{qi(table)}", amap


def calendar_probe(table, col):
    c = qi(col)
    return f"""
        SELECT to_char({c}, 'DD') AS k, count(*) AS n
        FROM sys.{qi(table)} WHERE {c} IS NOT NULL
        GROUP BY 1 ORDER BY 2 DESC LIMIT 1
    """, f"""
        SELECT to_char({c}, 'MM') AS k, count(*) AS n
        FROM sys.{qi(table)} WHERE {c} IS NOT NULL
        GROUP BY 1 ORDER BY 2 DESC LIMIT 1
    """


def dup_probe(table, cols):
    body = [c["column_name"] for c in cols
            if not AUDIT_COL.match(c["column_name"])
            and c["column_name"] != "id"
            and c["data_type"] not in NO_EQ]
    if not body:
        return None
    lst = ", ".join(qi(c) for c in body)
    return f"SELECT count(*) AS gruppi FROM (SELECT {lst} FROM sys.{qi(table)} " \
           f"GROUP BY {lst} HAVING count(*) > 1) d"


# ---------------------------------------------------------------- audit
def audit_table(table, cols, wend, big):
    """Ritorna (righe, lista_rilievi, lista_regole_applicate)."""
    findings, applied = [], []
    sql, amap = build_probe(table, cols, wend)
    row = jq(sql)
    if not row:
        return 0, findings, applied
    raw = row[0]
    n = int(raw["a_n"])
    if n == 0:
        return 0, findings, applied

    # ri-mappa gli alias posizionali sulle misure (kind, chiave)
    r, pairs = {}, {}
    for alias, (kind, key) in amap.items():
        if kind == "se":
            pairs[key] = raw.get(alias)
        else:
            r[f"{kind}__{key}"] = raw.get(alias)

    for c in cols:
        name, dt = c["column_name"], c["data_type"]
        nn = r.get("nn__" + name)
        nd = r.get("nd__" + name)

        if nn is not None:
            applied.append("S1")
            if int(nn) == 0 and not AUDIT_COL.match(name):
                findings.append(("S1", f"`{name}`: colonna interamente NULL su {n} righe"))
            elif n >= 20 and nd is not None and int(nd) == 1 and int(nn) == n \
                    and not AUDIT_COL.match(name) and dt != "boolean":
                applied.append("S2")
                findings.append(("S2", f"`{name}`: un solo valore distinto su {n} righe"))

        fu = r.get("fu__" + name)
        if fu is not None:
            applied.append("D1")
            if int(fu) > 0:
                findings.append(("D1", f"`{name}`: {fu} righe oltre la finestra "
                                       f"(> {wend}), max {r.get('mx__' + name)}"))
        an = r.get("an__" + name)
        if an is not None:
            applied.append("D2")
            if int(an) > 0:
                findings.append(("D2", f"`{name}`: {an} righe prima del 1900 "
                                       f"(min {r.get('mn__' + name)})"))

        if dt in NUMERIC:
            lo, hi = r.get("nmin__" + name), r.get("nmax__" + name)
            if lo is not None:
                if PERCENT.search(name):
                    applied.append("N1")
                    try:
                        if float(lo) < 0 or float(hi) > 100:
                            findings.append(("N1", f"`{name}`: misura percentuale "
                                                   f"fuori [0,100] — min {lo} max {hi}"))
                    except ValueError:
                        pass
                if MONEY.search(name) or NON_NEGATIVE.search(name):
                    applied.append("N2")
                    try:
                        if float(lo) < 0:
                            findings.append(("N2", f"`{name}`: valore negativo su misura "
                                                   f"non-negativa — min {lo}"))
                    except ValueError:
                        pass

    for (a, b), val in pairs.items():
        if val is not None and int(val) > 0:
            findings.append(("D3", f"`{a}` → `{b}`: {val} righe con fine < inizio"))
    if pairs:
        applied.append("D3")

    # C1 — artefatto di calendario (solo date di fatto, campione significativo)
    if n >= 30 and not big:
        for c in fact_dates(cols):
            if FUTURE_OK.search(c["column_name"]):
                continue
            nn = r.get("nn__" + c["column_name"])
            if nn is None or int(nn) < 30:
                continue
            applied.append("C1")
            dq, mq = calendar_probe(table, c["column_name"])
            for probe, label, soglia in ((dq, "giorno del mese", 0.25),
                                         (mq, "mese", 0.30)):
                res = jq(probe)
                if res:
                    share = int(res[0]["n"]) / int(nn)
                    if share > soglia:
                        findings.append((
                            "C1", f"`{c['column_name']}`: {label} «{res[0]['k']}» "
                                  f"concentra {share:.0%} delle {nn} date"))

    # X1 — duplicati logici
    if not big:
        dp = dup_probe(table, cols)
        if dp:
            applied.append("X1")
            res = jq(dp)
            if res and int(res[0]["gruppi"]) > 0:
                findings.append(("X1", f"{res[0]['gruppi']} gruppi di righe identiche "
                                       f"(al netto di chiave tecnica e audit)"))

    return n, findings, sorted(set(applied))


def load_waivers():
    """Motivi dichiarati per le tabelle legittimamente vuote."""
    out = {}
    if WAIVERS.exists():
        for line in WAIVERS.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "|" in line:
                t, why = line.split("|", 1)
                out[t.strip()] = why.strip()
    return out


def load_explanations():
    """Classi di rilievi dichiarate legittime, con il motivo.

    Ogni riga: <regola> | <regex tabella> | <regex colonna> | <motivo>.
    Si classificano CLASSI, non casi singoli: una tabella nuova con le stesse
    caratteristiche eredita la spiegazione invece di generare rumore.
    """
    out = []
    if EXPLANATIONS.exists():
        for line in EXPLANATIONS.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            # il separatore e' il pipe CIRCONDATO DA SPAZI: dentro i campi ci
            # sono regex che usano `|` come alternativa (senza spazi), e uno
            # split ingenuo le spezzerebbe a meta'.
            parts = re.split(r"\s+\|\s+", line, maxsplit=3)
            if len(parts) < 4:
                continue
            rule, tab, col, why = (p.strip() for p in parts)
            out.append((rule, re.compile(tab), re.compile(col), why))
    return out


def explain(rules, code, table, msg):
    """Il motivo per cui questo rilievo e' legittimo, o None se resta aperto."""
    m = re.match(r"`([^`]+)`", msg)
    col = m.group(1) if m else ""
    for rule, rtab, rcol, why in rules:
        if rule == code and rtab.search(table) and rcol.search(col):
            return why
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict", action="store_true",
                    help="exit 1 se restano rilievi o tabelle vuote non dichiarate")
    ap.add_argument("--table", help="limita a una tabella (debug)")
    args = ap.parse_args()

    tables = catalog()
    if args.table:
        tables = {k: v for k, v in tables.items() if k == args.table}
    wend = window_end()
    waivers = load_waivers()
    rules = load_explanations()

    big_rows = {r["t"]: int(r["n"]) for r in jq(
        "SELECT relname AS t, n_live_tup AS n FROM pg_stat_user_tables "
        "WHERE schemaname='sys' AND n_live_tup > 100000")}

    results, empties = [], []
    for i, (t, cols) in enumerate(sorted(tables.items()), 1):
        big = t in big_rows
        try:
            n, findings, applied = audit_table(t, cols, wend, big)
        except subprocess.CalledProcessError as e:
            results.append((t, -1, [("ERR", f"query fallita: {e}")], []))
            continue
        if n == 0:
            empties.append(t)
        # ogni rilievo porta con se' la sua spiegazione, o resta aperto
        findings = [(c, m, explain(rules, c, t, m)) for c, m in findings]
        results.append((t, n, findings, applied))
        aperti_t = sum(1 for f in findings if f[2] is None)
        print(f"[{i}/{len(tables)}] {t}: {n} righe, {len(findings)} rilievi "
              f"({aperti_t} aperti)", file=sys.stderr)

    render(results, empties, waivers, wend, big_rows)

    aperti = sum(1 for _, _, f, _ in results for x in f if x[2] is None)
    spiegati = sum(1 for _, _, f, _ in results for x in f if x[2] is not None)
    non_dichiarate = [t for t in empties if t not in waivers]
    print(f"\nrilievi aperti: {aperti} · spiegati: {spiegati} · "
          f"tabelle vuote non dichiarate: {len(non_dichiarate)}")
    if args.strict and (aperti or non_dichiarate):
        return 1
    return 0


def render(results, empties, waivers, wend, big_rows):
    tot = len(results)
    aperti = [(t, n, [f for f in fs if f[2] is None])
              for t, n, fs, _ in results if any(f[2] is None for f in fs)]
    spiegati = [(t, n, [f for f in fs if f[2] is not None])
                for t, n, fs, _ in results if any(f[2] is not None for f in fs)]
    n_aperti = sum(len(f) for _, _, f in aperti)
    n_spiegati = sum(len(f) for _, _, f in spiegati)
    righe_tot = sum(max(r[1], 0) for r in results)

    L = []
    A = L.append
    A("# storia36 — Audit semantico finale (Task C12, Step 12.2)")
    A("")
    A(f"> Generato da `db/scripts/audit-storia36-semantic.py` — **ri-eseguibile**. "
      f"Data: {date.today().isoformat()} · finestra della storia: "
      f"`{STORY_START}` → `{wend}` (fine calcolata, mai costante).")
    A("")
    A("**Perimetro**: tutte le tabelle `sys.*` lette dal catalogo di sistema a ogni "
      "esecuzione (AP-03: nessun elenco scritto a mano — una tabella nuova entra "
      "nell'audit da sola).")
    A("")
    A(f"| | |")
    A(f"|---|---|")
    A(f"| tabelle esaminate | **{tot}** |")
    A(f"| righe coperte | **{righe_tot:,}** |".replace(",", "."))
    A(f"| rilievi **aperti** (nessuna spiegazione) | **{n_aperti}** |")
    A(f"| rilievi **spiegati** (classe dichiarata legittima) | **{n_spiegati}** |")
    A(f"| tabelle vuote | **{len(empties)}** (dichiarate: {len([t for t in empties if t in waivers])}) |")
    A("")
    A("## Le regole e il loro criterio di applicabilità")
    A("")
    A("Ogni regola si applica **per tipo e ruolo della colonna**, dedotti dal catalogo: "
      "non esiste una lista di tabelle da tenere aggiornata. Le colonne di *audit di "
      "scrittura* (`created_at`, `updated_at`, `*_by`) sono escluse dalle regole di "
      "fatto — chi scrive una riga non è il soggetto della riga, e la sua data è quella "
      "del popolamento, non della storia.")
    A("")
    A("| id | regola | si applica a |")
    A("|---|---|---|")
    A("| D1 | data di fatto oltre la finestra della storia | colonne data/ora che non "
      "esprimono una scadenza o una pianificazione |")
    A("| D2 | data di fatto precedente al 1900 | colonne data/ora di fatto |")
    A("| D3 | intervallo invertito (fine < inizio) | coppie inizio/fine riconosciute dal nome |")
    A("| N1 | misura percentuale fuori da [0,100] | colonne numeriche con ruolo percentuale |")
    A("| N2 | valore negativo su misura non-negativa | colonne monetarie, conteggi, durate |")
    A("| S1 | colonna interamente NULL su tabella popolata | tutte le colonne non-audit |")
    A("| S2 | un solo valore distinto su ≥20 righe | colonne non-audit, non booleane |")
    A("| C1 | artefatto di calendario (giorno o mese dominante) | date di fatto con ≥30 valori |")
    A("| X1 | righe identiche al netto di chiave tecnica e audit | tabelle con colonne confrontabili |")
    A("| V1 | tabella vuota: richiede una dichiarazione esplicita | tabelle a zero righe |")
    A("")
    if big_rows:
        A(f"**Nota di perimetro**: {len(big_rows)} tabelle superano le 100.000 righe "
          f"({', '.join(f'`{k}` ({v:,})'.replace(',', '.') for k, v in sorted(big_rows.items()))}) "
          "— su queste le regole C1 e X1 (che richiedono una scansione completa) non "
          "vengono eseguite: il costo non è giustificato e sono tabelle di traffico, "
          "non di storia. Le altre regole si applicano regolarmente.")
        A("")

    A("## Rilievi APERTI")
    A("")
    A("Rilievi per cui nessuna classe di `db/scripts/audit-storia36-explanations.txt` "
      "dichiara un motivo: o sono difetti da riparare, o attendono una spiegazione "
      "esplicita. Il silenzio non è una delle opzioni.")
    A("")
    if not aperti:
        A("**Nessun rilievo aperto.** Ogni esito è o verde, o riparato, o spiegato "
          "con il suo motivo.")
    else:
        A("| tabella | righe | regola | rilievo |")
        A("|---|---|---|---|")
        for t, n, findings in sorted(aperti, key=lambda x: -len(x[2])):
            for code, msg, _ in findings:
                A(f"| `{t}` | {n:,} | {code} | {msg} |".replace(",", "."))
    A("")

    A("## Rilievi SPIEGATI")
    A("")
    A("Esiti che una regola segnala ma che sono corretti nel dominio. La classe e "
      "il motivo sono dichiarati nel file delle spiegazioni; una tabella nuova con "
      "le stesse caratteristiche eredita la spiegazione invece di generare rumore.")
    A("")
    if not spiegati:
        A("Nessuno.")
    else:
        A("| tabella | regola | rilievo | perché è corretto |")
        A("|---|---|---|---|")
        for t, n, findings in sorted(spiegati):
            for code, msg, why in findings:
                A(f"| `{t}` | {code} | {msg} | {why} |")
    A("")

    A("## Tabelle vuote (regola V1)")
    A("")
    if not empties:
        A("Nessuna tabella vuota.")
    else:
        A("| tabella | perché è vuota |")
        A("|---|---|")
        for t in sorted(empties):
            A(f"| `{t}` | {waivers.get(t, '**⚠ non dichiarato** — richiede una motivazione')} |")
    A("")

    A("## Verbale per tabella")
    A("")
    A("Esito di ogni tabella del perimetro, con le regole effettivamente eseguite su di essa.")
    A("")
    A("| tabella | righe | regole eseguite | esito |")
    A("|---|---|---|---|")
    for t, n, findings, applied in sorted(results):
        n_ap = sum(1 for f in findings if f[2] is None)
        if n == 0:
            esito = "vuota → V1"
            reg = "V1"
        elif n_ap:
            esito = f"**{n_ap} aperti**" + (f" · {len(findings) - n_ap} spiegati"
                                            if len(findings) > n_ap else "")
            reg = " ".join(applied) or "—"
        elif findings:
            esito = f"verde ({len(findings)} spiegati)"
            reg = " ".join(applied) or "—"
        else:
            esito = "verde"
            reg = " ".join(applied) or "— *(nessuna regola applicabile: nessuna colonna " \
                                       "di fatto, misura o confrontabile)*"
        A(f"| `{t}` | {max(n,0):,} | {reg} | {esito} |".replace(",", "."))
    A("")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(L) + "\n", encoding="utf-8")
    print(f"\nverbale: {OUT.relative_to(REPO)}", file=sys.stderr)


if __name__ == "__main__":
    sys.exit(main())
