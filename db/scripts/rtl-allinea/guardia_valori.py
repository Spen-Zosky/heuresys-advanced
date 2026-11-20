"""Guardia dei generatori J3*: un testo che si traduce non deve essere un valore che il codice o le migrazioni leggono.

Classe scoperta il 20/11/2026: J3c traduceva sys_okrs.okr_department «Company-wide» in «Intera azienda»; ma «Company-wide» e' un valore SENTINELLA
(migrazione 000357, riapplicata a ogni deploy: `lower(o.okr_department) <> 'company-wide'`), e la catena delle migrazioni usciva rossa.

La guardia rifiuta (esce 1, il file SQL non si genera) ogni coppia (tabella, colonna, valore inglese) il cui valore compare come LETTERALE fra apici in un file di
  db/migrations/**, apps/api/src/** o packages/shared/src/**  (test e file generati esclusi)
che nomina anche la COLONNA: li' il valore e' un confronto, un CHECK, una costante o un default, non un testo da mostrare.
Il confronto e' senza maiuscole (le migrazioni scrivono `lower(col) = 'company-wide'`). Non e' una lista di eccezioni: se una voce scatta, o non si traduce o si cambia
prima il codice che la legge (nuovo ADR/migrazione), e solo allora si toglie dalla lista.
Gli inserimenti storici (`INSERT ... ON CONFLICT DO NOTHING` di seed e migrazioni di ingestione) citano la colonna e il valore ma non li LEGGONO: restano fuori con la
condizione `legge`: la riga deve contenere un confronto (=, <>, !=, IN, LIKE, CASE, WHEN, lower(), ===, includes) oppure CHECK/DEFAULT sulla stessa riga del valore.
"""
import pathlib
import re
import sys

RADICE = pathlib.Path(__file__).resolve().parents[3]
CARTELLE = ["db/migrations", "apps/api/src", "packages/shared/src"]
LEGGE = re.compile(r"(=|<>|!=|\bIN\b|\bLIKE\b|\bCASE\b|\bWHEN\b|\blower\(|\bupper\(|\bCHECK\b|\bDEFAULT\b|\.includes\(|\bcase\b|=== |!== )", re.I)


def _file():
    for c in CARTELLE:
        for p in (RADICE / c).rglob("*"):
            if p.suffix not in (".sql", ".ts") or not p.is_file():
                continue
            n = p.name
            if ".test." in n or ".generated." in n or n.endswith(".d.ts") or "node_modules" in p.parts or "dist" in p.parts:
                continue
            yield p


def trova(coppie):
    """coppie: iterabile di (tabella, colonna, valore_en). Ritorna le violazioni [(tabella, colonna, valore, file, riga, testo)].
    Un valore e' letto dal codice quando, in un punto che nomina la colonna (stessa riga o a due righe di distanza), compare come letterale in un confronto/CHECK/DEFAULT.
    Maiuscole: il valore deve coincidere esattamente, salvo che la riga confronti in minuscolo (`lower(...)`, `ilike`), come fa la 000357 con «company-wide»."""
    testi = {}
    for p in _file():
        try:
            testi[p] = p.read_text(encoding="utf-8", errors="ignore").splitlines()
        except OSError:
            pass
    out = []
    for t, c, en in coppie:
        lett = en.replace("'", "''")
        esatto = re.compile(r"""(['"])""" + re.escape(lett) + r"""\1""")
        senza_maiuscole = re.compile(r"""(['"])""" + re.escape(lett) + r"""\1""", re.I)
        col = c.lower()
        for p, righe in testi.items():
            basso = [r.lower() for r in righe]
            if not any(col in r for r in basso):
                continue
            for i, r in enumerate(righe):
                if not LEGGE.search(r):
                    continue
                insensibile = re.search(r"\b(lower|upper)\(|\bilike\b", r, re.I)
                if not (senza_maiuscole.search(r) if insensibile else esatto.search(r)):
                    continue
                if any(col in basso[j] for j in range(max(0, i - 2), min(len(righe), i + 3))):
                    out.append((t, c, en, str(p.relative_to(RADICE)), i + 1, r.strip()[:140]))
    return out


def verifica(R):
    v = trova((t, c, en) for t, c, en, _ in R)
    if v:
        print("GUARDIA: valori che il codice o le migrazioni leggono, non si traducono:", file=sys.stderr)
        for t, c, en, f, i, r in v:
            print(f"  {t}.{c} = {en!r}  <-  {f}:{i}  {r}", file=sys.stderr)
        sys.exit(1)
