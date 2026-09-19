#!/usr/bin/env python3
"""permessi_da_classificazione.py — mandato K, R-6 passo 56.

Genera l'elenco dei permessi RBAC da concedere a PEOPLE_MANAGER (TUTTI i permessi di
SCRITTURA sulle tabelle NATIVE/IBRIDE di X-1, `sys.sys_classificazione_direzione_dato`)
e a DATA_STEWARD (permessi di LETTURA sulle tabelle IMPORTATE), incrociando la
classificazione con le rotte reali dei moduli API. Le tabelle `infrastruttura` sono
escluse: non sono dato di cliente (I23).

Il mandato lo dice esplicitamente (passo 56): l'elenco "si GENERA... e si rivede a
mano, non si scrive a mano". Questo strumento e' il punto di partenza misurato, non
una fonte di verita' perfetta — un modulo con una relazione insolita fra tabella e
rotta (join, vista, funzione) puo' sfuggire all'euristica per-file qui sotto.

METODO, per ogni modulo (`apps/api/src/modules/<modulo>/`):
  1. `repository.ts` (+ eventuali file `*repository*.ts`/`*.repo.ts` dello stesso
     modulo): regex sulle tabelle scritte (INSERT INTO / UPDATE / DELETE FROM
     sys.sys_xxx) e lette (FROM / JOIN sys.sys_xxx).
  2. `routes.ts`: per ciascuna rotta (app.get/post/patch/put/delete), il primo
     `requirePermission("codice")` nel blocco fino alla rotta successiva. GET => rotta
     di lettura; le altre quattro => rotta di scrittura.
  3. Una tabella NATIVA o IBRIDA i cui scrittori appartengono al modulo M aggiunge i
     permessi di SCRITTURA di M all'elenco di PEOPLE_MANAGER. Una tabella IMPORTATA i
     cui lettori appartengono al modulo M aggiunge i permessi di LETTURA di M
     all'elenco di DATA_STEWARD.

Uso:
  python .programmi/K-ruoli-direzione/tools/permessi_da_classificazione.py
  python .programmi/K-ruoli-direzione/tools/permessi_da_classificazione.py --selftest
"""
from __future__ import annotations

import os
import re
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
RADICE_K = os.path.dirname(QUI)                              # .programmi/K-ruoli-direzione
REPO = os.path.dirname(os.path.dirname(RADICE_K))             # D:\heuresys-advanced
MODULI = os.path.join(REPO, "apps", "api", "src", "modules")
DSN = "host=localhost port=5433 user=heuresys dbname=heuresys_advanced"

TABELLA_RE = re.compile(r"\bsys\.(sys_[a-z0-9_]+)\b")
SCRITTURA_RE = re.compile(r"\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+sys\.(sys_[a-z0-9_]+)\b", re.IGNORECASE)
LETTURA_RE = re.compile(r"\b(?:FROM|JOIN)\s+sys\.(sys_[a-z0-9_]+)\b", re.IGNORECASE)
ROTTA_RE = re.compile(r'app\.(get|post|patch|put|delete)\(\s*["\']([^"\']*)["\']', re.IGNORECASE)
PERMESSO_RE = re.compile(r'requirePermission\(\s*["\']([a-z_]+:[a-z_]+)["\']')

SCRITTURA_METODI = {"post", "patch", "put", "delete"}


def leggi(path: str) -> str:
    with open(path, encoding="utf-8", errors="replace") as fh:
        return fh.read()


def tabelle_di_modulo(modulo_dir: str) -> tuple[set[str], set[str]]:
    """(tabelle scritte, tabelle lette) da tutti i file *repository*.ts del modulo."""
    scritte: set[str] = set()
    lette: set[str] = set()
    for nome in os.listdir(modulo_dir):
        if "repository" not in nome.lower() or not nome.endswith(".ts"):
            continue
        testo = leggi(os.path.join(modulo_dir, nome))
        scritte |= {m.group(1) for m in SCRITTURA_RE.finditer(testo)}
        lette |= {m.group(1) for m in LETTURA_RE.finditer(testo)}
    return scritte, lette


def permessi_di_modulo(modulo_dir: str) -> tuple[set[str], set[str]]:
    """(permessi su rotte di scrittura, permessi su rotte di lettura) dal routes.ts."""
    path = os.path.join(modulo_dir, "routes.ts")
    if not os.path.isfile(path):
        return set(), set()
    testo = leggi(path)
    rotte = list(ROTTA_RE.finditer(testo))
    scrittura: set[str] = set()
    lettura: set[str] = set()
    for i, r in enumerate(rotte):
        fine = rotte[i + 1].start() if i + 1 < len(rotte) else len(testo)
        blocco = testo[r.start():fine]
        perm = PERMESSO_RE.search(blocco)
        if not perm:
            continue
        metodo = r.group(1).lower()
        (scrittura if metodo in SCRITTURA_METODI else lettura).add(perm.group(1))
    return scrittura, lettura


def costruisci_mappe() -> tuple[dict[str, set[str]], dict[str, set[str]]]:
    """tabella -> permessi di scrittura dei moduli che la scrivono
       tabella -> permessi di lettura dei moduli che la leggono"""
    scrittori: dict[str, set[str]] = {}
    lettori: dict[str, set[str]] = {}
    for modulo in sorted(os.listdir(MODULI)):
        modulo_dir = os.path.join(MODULI, modulo)
        if not os.path.isdir(modulo_dir):
            continue
        tab_scritte, tab_lette = tabelle_di_modulo(modulo_dir)
        if not tab_scritte and not tab_lette:
            continue
        perm_scrittura, perm_lettura = permessi_di_modulo(modulo_dir)
        for t in tab_scritte:
            scrittori.setdefault(t, set()).update(perm_scrittura)
        for t in tab_lette:
            lettori.setdefault(t, set()).update(perm_lettura)
    return scrittori, lettori


def classificazione(cur) -> dict[str, str]:
    cur.execute("SELECT tabella, stato FROM sys.sys_classificazione_direzione_dato")
    return dict(cur.fetchall())


def deriva(cur) -> tuple[list[str], list[str], list[str]]:
    """Ritorna (permessi PEOPLE_MANAGER, permessi DATA_STEWARD, tabelle senza porta trovata)."""
    classi = classificazione(cur)
    scrittori, lettori = costruisci_mappe()
    people_manager: set[str] = set()
    data_steward: set[str] = set()
    senza_porta: list[str] = []
    for tabella, stato in classi.items():
        if stato in ("nativo", "ibrido"):
            trovati = scrittori.get(tabella)
            if trovati:
                people_manager |= trovati
            else:
                senza_porta.append(f"{tabella} ({stato}, nessuno scrittore trovato)")
        elif stato == "importato":
            trovati = lettori.get(tabella)
            if trovati:
                data_steward |= trovati
            else:
                senza_porta.append(f"{tabella} (importato, nessun lettore trovato)")
        # infrastruttura: esclusa (I23)
    return sorted(people_manager), sorted(data_steward), sorted(senza_porta)


def connetti():
    try:
        import psycopg2  # noqa: WPS433
    except ImportError:
        return None, "psycopg2 non installato"
    try:
        con = psycopg2.connect(DSN, connect_timeout=8)
        return con, ""
    except Exception as e:  # noqa: BLE001
        return None, str(e).strip().splitlines()[0] if str(e).strip() else repr(e)


def stampa(titolo: str, elenco: list[str]) -> None:
    print(f"\n{titolo} ({len(elenco)}):")
    for p in elenco:
        print(f"  {p}")


def selftest() -> int:
    """Controprova che sa fallire: sposta una tabella nativa a importato in una
    transazione, verifica che l'elenco cambi, ROLLBACK. Mai sull'originale committato."""
    con, err = connetti()
    if con is None:
        print(f"NON MISURATO — {err}")
        return 4
    con.autocommit = False
    cur = con.cursor()
    try:
        # Serve una tabella 'nativo' con almeno uno SCRITTORE trovato dall'euristica:
        # altrimenti lo spostamento a 'importato' non cambia nulla per costruzione
        # (era gia' "nessuno scrittore" prima), e la prova non prova niente.
        scrittori, _ = costruisci_mappe()
        candidate_con_scrittore = [t for t in scrittori if scrittori[t]]
        cur.execute(
            "SELECT tabella FROM sys.sys_classificazione_direzione_dato WHERE stato = 'nativo' AND tabella = ANY(%s) LIMIT 1",
            (candidate_con_scrittore,),
        )
        row = cur.fetchone()
        if not row:
            print("SELFTEST SALTATO — nessuna tabella 'nativo' con uno scrittore noto da spostare")
            return 3
        tabella = row[0]

        pm_prima, ds_prima, _ = deriva(cur)
        cur.execute(
            "UPDATE sys.sys_classificazione_direzione_dato SET stato = 'importato' WHERE tabella = %s",
            (tabella,),
        )
        pm_dopo, ds_dopo, _ = deriva(cur)

        cambiato = pm_prima != pm_dopo or ds_prima != ds_dopo
        con.rollback()

        # Controprova che la stessa query, DOPO il rollback, torna come prima
        # (la modifica non e' sopravvissuta — prova che il ROLLBACK ha funzionato).
        pm_ripristinato, ds_ripristinato, _ = deriva(cur)
        ripristinato_ok = pm_ripristinato == pm_prima and ds_ripristinato == ds_prima

        if cambiato and ripristinato_ok:
            print(f"SELFTEST VERDE — spostando '{tabella}' nativo->importato l'elenco cambia; dopo ROLLBACK torna identico.")
            return 0
        if not cambiato:
            print(f"SELFTEST ROSSO — spostando '{tabella}' nativo->importato l'elenco NON e' cambiato (prova che sa fallire).")
            return 1
        print("SELFTEST ROSSO — dopo ROLLBACK l'elenco non e' tornato identico a prima (il rollback non ha isolato la prova).")
        return 1
    finally:
        cur.close()
        con.close()


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if "--selftest" in sys.argv:
        return selftest()

    con, err = connetti()
    if con is None:
        print(f"NON MISURATO — {err}")
        return 4
    con.set_session(readonly=True, autocommit=True)
    cur = con.cursor()
    pm, ds, senza_porta = deriva(cur)
    cur.close()
    con.close()

    stampa("PEOPLE_MANAGER — permessi di scrittura (tabelle nativo+ibrido)", pm)
    stampa("DATA_STEWARD — permessi di lettura (tabelle importato)", ds)
    if senza_porta:
        print(f"\n⚠ {len(senza_porta)} tabelle senza porta trovata dall'euristica (rivedere a mano):")
        for t in senza_porta:
            print(f"  {t}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
