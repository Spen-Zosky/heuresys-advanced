#!/usr/bin/env python3
"""
chi_ripara.py — #257: il registro di CHI ripara e CHI popola, derivato mai scritto a mano.

Perche' esiste
--------------
Enzo, 2026-09-09: *«non ho capito chi si occupa di riparare questi problemi e chi si occupa
di popolare i dati al momento assenti»*. Il progetto aveva gia' TRE strumenti che misurano
lacune (`completezza_tenant.py`, `db_health.py`, `sys.v_contenuto_fuori_settore`), ma nessuno
diceva CHI deve colmarle. **Adottato da Enzo il 2026-09-14 (S1101)**, nella forma piu'
piccola: un quarto strumento che RI-DERIVA le lacune dai tre esistenti e assegna la famiglia
con regole meccaniche — mai una tabella `sys.*` scritta a mano (invecchierebbe).

Le cinque famiglie (decise da Enzo, non si ri-chiedono — la quinta aggiunta il 2026-09-28)
--------------------------------------------------------------------------------------------
  ① DERIVABILE  — colmabile dal codice: la colonna/tabella vuota ha una FK verso una tabella
                  gia' popolata (es. un `_user_id` di audit -> il codice conosce l'attore della
                  richiesta; una FK di contenuto -> un legame gia' presente permette di derivare).
  ② RICERCA     — contenuto di settore mancante (unita', posizioni, competenze, indicatori,
                  processi): si aggancia a `#205` — riusa `check_domini_ricercabili.py`
                  (il gemello python di `chiaviDominio()` in
                  `apps/api/src/modules/research/domains/index.ts`), non reinventa i domini.
  ③ CLIENTE     — dati della persona o dell'azienda (utenti, incarichi, retribuzioni,
                  presenze): bloccata da M6 (la porta d'ingresso dei dati del cliente non
                  esiste). Questo registro la NOMINA, non la risolve.
  ⑤ USO-PRODOTTO — tabella vuota il cui modulo ha GIA' una rotta di scrittura raggiungibile
                  (`app.post`/`app.put` nel `routes.ts`) e un `INSERT INTO` reale nel proprio
                  `repository.ts`: non manca un dato da procurarsi, manca solo l'USO del
                  prodotto (OKR, survey, ...). Nessuno la ripara: si popola vivendo.
  ④ DECISIONE   — cio' che nessuna regola classifica. Elenco finito, letto da Enzo: chi lo
                  guarda decide se serve una regola nuova o una scelta di prodotto.

Le tre fonti (misurate, non ricopiate)
---------------------------------------
  A. `completezza_tenant.py --contro <tenant>`  -> tabelle che RTL_BANK (il riferimento
     strutturale, E18) popola e un altro tenant no: lacune di livello TABELLA.
  B. `db_health.py` (sonda "colonne dichiarate e mai riempite")  -> lo stesso predicato SQL
     (`pg_stats.null_frac=1` su `schemaname='sys'`), qui coi nomi (tabella, colonna): lacune
     di livello COLONNA, senza tenant (sono vuote su OGNI riga, non solo per un tenant).
  C. `sys.v_contenuto_fuori_settore` (mig. `000388`)  -> contenuto presente ma incoerente col
     settore del tenant (I21): la sostituzione con contenuto pertinente e' compito di ricerca,
     quindi ogni riga qui e' RICERCA per costruzione — non e' un dato "vuoto" ma la ragione per
     cui il contenuto corretto non c'e' ancora.

F1 — LA MISURA UNIFICATA (fatto quando il totale coincide con la somma delle tre fonti)
-----------------------------------------------------------------------------------------
`--verifica-fonti` ri-esegue le TRE fonti in modo indipendente (import diretto dei moduli
gemelli, non ricopiando i numeri) e confronta il totale contro la lista unificata. E' la
post-condizione scritta di F1: se non coincide, lo strumento esce ROSSO — un registro che non
sa dire "non torna" non e' un registro, e' un elenco con una funzione davanti.

F2 — LE REGOLE (dichiarative, in `REGOLE`, non in `if` sparsi)
------------------------------------------------------------------
`--selftest` verifica quattro casi REALI a esito noto e diverso (uno per DERIVABILE/RICERCA/
CLIENTE/USO-PRODOTTO) piu' un quinto che nessuna regola tocca (DECISIONE), poi SABOTA la regola
che ha prodotto il primo esito e pretende che quel caso, e SOLO quello, diventi rosso — la prova
che la regola e' responsabile dell'esito, non un `else` che indovina.

Uso
---
    python docs/kb/tools/chi_ripara.py                    # il registro: totali per famiglia
    python docs/kb/tools/chi_ripara.py --verifica-fonti   # + la post-condizione di F1
    python docs/kb/tools/chi_ripara.py --per-famiglia     # F3: le quattro code, con responsabile
    python docs/kb/tools/chi_ripara.py --selftest         # F2: autoprova a esiti opposti + sabotaggio
    python docs/kb/tools/chi_ripara.py --json <file>

Uscite: 0 misura pulita · 1 selftest o post-condizione rossa · 2 database non raggiungibile
(NON MISURABILE, non "tutto bene" — chi chiama non deve confondere i due).
"""
from __future__ import annotations

import argparse
import collections
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from typing import Callable, Optional

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, QUI)
import completezza_tenant as ct  # noqa: E402 — riuso, non reinvento (RIFERIMENTO, misura, confronta)
import check_domini_ricercabili as cdr  # noqa: E402 — riuso, il gemello python di chiaviDominio()
import check_exposure as ce  # noqa: E402 — riuso di RADICE/API/_leggi_dir per la famiglia ⑤

PSQL = ["psql", "-h", os.environ.get("PGHOST", "localhost"),
        "-p", os.environ.get("PGPORT", "5433"),
        "-U", os.environ.get("PGUSER", "heuresys"),
        "-d", os.environ.get("PGDATABASE", "heuresys_advanced"),
        "-At", "-F", "\t"]


class NonRaggiungibile(RuntimeError):
    """psql ha fallito. Un'eccezione, non un sys.exit: questo modulo lo importa session_start.py
    per la riga di dashboard (F4), e una vista non deve abbattere il boot quando il tunnel e' giu'."""


def q(sql: str) -> list[list[str]]:
    e = subprocess.run(PSQL + ["-c", sql], capture_output=True, text=True,
                        encoding="utf-8", errors="replace")
    if e.returncode != 0:
        raise NonRaggiungibile(e.stderr.strip() or "psql ha fallito senza messaggio")
    return [r.split("\t") for r in e.stdout.strip().splitlines() if r]


# ── F1 — LE TRE FONTI, RI-DERIVATE ────────────────────────────────────────────────────────

@dataclass
class Lacuna:
    fonte: str                 # completezza_tenant | db_health | v_contenuto_fuori_settore
    tabella: str
    colonna: Optional[str] = None
    tenant: Optional[str] = None
    dettaglio: str = ""        # cosa dice la fonte (righe, termine forbidden, ecc.)
    famiglia: str = ""         # assegnata da classifica() — vuota finche' non classificata
    regola: str = ""
    motivo: str = ""


def tenants_non_riferimento() -> list[str]:
    righe = q("select tenant_code from sys.sys_tenancies order by 1")
    return [r[0] for r in righe if r and r[0] != ct.RIFERIMENTO]


def lacune_tabelle() -> tuple[list[Lacuna], dict]:
    """Fonte A — completezza_tenant.py: tabelle che il riferimento popola e un tenant no.

    Riusa DIRETTAMENTE le funzioni di completezza_tenant.py (tabelle_di_tenant/misura/
    confronta): stessa aritmetica di `--contro`, non una copia riscritta a mano.
    """
    tab_col = ct.tabelle_di_tenant()
    rif = ct.misura(tab_col, ct.tenant_id(ct.RIFERIMENTO))
    out: list[Lacuna] = []
    per_tenant: dict[str, int] = {}
    for cod in tenants_non_riferimento():
        altro = ct.misura(tab_col, ct.tenant_id(cod))
        d = ct.confronta(rif, altro)
        per_tenant[cod] = len(d["tabelle_mancanti"])
        for tab in d["tabelle_mancanti"]:
            out.append(Lacuna(fonte="completezza_tenant", tabella=tab, tenant=cod,
                               dettaglio=f"{ct.RIFERIMENTO} la popola, {cod} no (0 righe)"))
    return out, per_tenant


def lacune_colonne() -> list[Lacuna]:
    """Fonte B — lo STESSO predicato della sonda 'colonne dichiarate e mai riempite' di
    db_health.py: `pg_stats.schemaname='sys' AND null_frac=1`. db_health riporta solo il
    conteggio; qui servono i nomi, quindi si ripete il predicato (non lo si copia dal suo
    output) e la parita' col conteggio di db_health si verifica in `verifica_fonti()`.
    """
    righe = q("""SELECT tablename, attname FROM pg_stats
                  WHERE schemaname='sys' AND null_frac=1 ORDER BY 1, 2""")
    out = []
    for tab, col in righe:
        out.append(Lacuna(fonte="db_health", tabella=tab, colonna=col,
                           dettaglio="colonna sempre NULL (null_frac=1)"))
    return out


SUPERFICIE_TABELLA = {"okr": "sys_okrs", "goal": "sys_goals"}


def lacune_fuori_settore() -> list[Lacuna]:
    """Fonte C — sys.v_contenuto_fuori_settore: contenuto presente ma del settore SBAGLIATO.
    Non e' un vuoto, e' un errore di posto: la cura e' sostituire con contenuto pertinente al
    settore del tenant, che e' — per definizione della vista (I21) — un compito di ricerca.
    """
    righe = q("select tenant, superficie, riga_id, termine, valore from sys.v_contenuto_fuori_settore")
    out = []
    for tenant, superficie, riga_id, termine, valore in righe:
        out.append(Lacuna(
            fonte="v_contenuto_fuori_settore",
            tabella=SUPERFICIE_TABELLA.get(superficie, superficie),
            tenant=tenant,
            dettaglio=f"riga {riga_id} ({superficie}) contiene '{termine}': fuori dal settore — \"{valore}\""))
    return out


def misura_unificata() -> list[Lacuna]:
    """F1: le tre fonti in una sola lista, senza ancora classificare."""
    tab, _ = lacune_tabelle()
    return tab + lacune_colonne() + lacune_fuori_settore()


def verifica_fonti(lacune: list[Lacuna]) -> tuple[bool, list[str]]:
    """La post-condizione di F1: il totale della lista unificata coincide con quello che le tre
    fonti dichiarano CIASCUNA PER CONTO PROPRIO, ri-misurate qui (non ricopiate dalla prima
    corsa). Import diretto dei moduli gemelli — non un subprocess che duplica psql per niente.
    """
    problemi = []

    attesa_tab = sum(1 for l in lacune if l.fonte == "completezza_tenant")
    _, per_tenant = lacune_tabelle()
    ricontrollo_tab = sum(per_tenant.values())
    if ricontrollo_tab != attesa_tab:
        problemi.append(f"tabelle: lista unificata {attesa_tab} != ricontrollo {ricontrollo_tab}")

    attesa_col = sum(1 for l in lacune if l.fonte == "db_health")
    import db_health  # import qui: apre un tunnel psql persistente, non serve se non richiesto
    sonde = db_health.sonde()
    riscontro = next((v for n, v, _ in sonde if n == "colonne dichiarate e mai riempite"), None)
    if riscontro is None:
        problemi.append("db_health.py non espone piu' la sonda 'colonne dichiarate e mai riempite'")
    elif int(riscontro) != attesa_col:
        problemi.append(f"colonne: lista unificata {attesa_col} != db_health.py {riscontro}")

    attesa_fs = sum(1 for l in lacune if l.fonte == "v_contenuto_fuori_settore")
    ricontrollo_fs = int(q("select count(*) from sys.v_contenuto_fuori_settore")[0][0])
    if ricontrollo_fs != attesa_fs:
        problemi.append(f"fuori-settore: lista unificata {attesa_fs} != ricontrollo {ricontrollo_fs}")

    return (not problemi), problemi


# ── F2 — LE REGOLE, DICHIARATIVE ──────────────────────────────────────────────────────────

RE_ROTTA_SCRITTURA = re.compile(r"\bapp\.(?:post|put)\s*\(", re.I)
RE_INSERT_TABELLA = re.compile(r"\bINSERT\s+INTO\s+sys\.(sys_\w+)", re.I)


def _tabelle_uso_prodotto(radice: str | None = None) -> dict[str, set[str]]:
    """Famiglia ⑤ — tabella -> {moduli} il cui `repository.ts` ha un `INSERT INTO` reale su di
    lei E il cui `routes.ts` GEMELLO registra almeno una rotta `app.post`/`app.put`: le due
    condizioni insieme, non una sola — un `INSERT` senza rotta non e' raggiungibile dal
    prodotto (e' esattamente la lezione di `#262`: leggere il codice non basta, serve la porta).
    """
    cartella_moduli = os.path.join(ce.API, "modules")
    esito: dict[str, set[str]] = collections.defaultdict(set)
    if not os.path.isdir(cartella_moduli):
        return esito
    for modulo in sorted(os.listdir(cartella_moduli)):
        base = os.path.join(cartella_moduli, modulo)
        repo_p = os.path.join(base, "repository.ts")
        routes_p = os.path.join(base, "routes.ts")
        if not (os.path.isfile(repo_p) and os.path.isfile(routes_p)):
            continue
        repo_testo = open(repo_p, encoding="utf-8", errors="replace").read()
        routes_testo = open(routes_p, encoding="utf-8", errors="replace").read()
        if not RE_ROTTA_SCRITTURA.search(routes_testo):
            continue
        for m in RE_INSERT_TABELLA.finditer(repo_testo):
            esito[m.group(1)].add(modulo)
    return esito


@dataclass
class Contesto:
    esito_205: dict            # tabella -> {r1, r3, soggetti, dominio, ...} (check_domini_ricercabili)
    dest_domain: dict          # tabella -> chiave dominio #205 (solo domini dichiarati)
    fk_map: dict                # (tabella, colonna) -> (tabella_riferita, righe_riferita)
    uso_prodotto: dict          # tabella -> {moduli} con INSERT + rotta di scrittura (famiglia ⑤)


def costruisci_contesto() -> Contesto:
    esito, _senza_dest, _fonti = cdr.misura()
    chiavi = cdr.domini_dichiarati()
    dest_domain = {tab: chiave for chiave, tab in cdr.DESTINAZIONE.items() if chiave in chiavi}
    uso_prodotto = _tabelle_uso_prodotto()

    righe = q("""
        SELECT r.relname, a.attname, f.relname, coalesce(t.n_live_tup, 0)
          FROM pg_constraint c
          JOIN pg_class r      ON r.oid = c.conrelid
          JOIN pg_namespace n  ON n.oid = r.relnamespace
          JOIN pg_attribute a  ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
          JOIN pg_class f      ON f.oid = c.confrelid
          LEFT JOIN pg_stat_user_tables t ON t.relname = f.relname AND t.schemaname = n.nspname
         WHERE n.nspname = 'sys' AND c.contype = 'f'
    """)
    fk_map: dict[tuple[str, str], tuple[str, int]] = {}
    for tab, col, rif_tab, rif_righe in righe:
        fk_map.setdefault((tab, col), (rif_tab, int(rif_righe)))

    return Contesto(esito_205=esito, dest_domain=dest_domain, fk_map=fk_map, uso_prodotto=uso_prodotto)


def _di_persona(ctx: Contesto, tabella: str) -> bool:
    e = ctx.esito_205.get(tabella)
    return bool(e and e["r1"] and not e["r3"])


def regola_fuori_settore(l: Lacuna, ctx: Contesto) -> bool:
    return l.fonte == "v_contenuto_fuori_settore"


def motivo_fuori_settore(l: Lacuna, ctx: Contesto) -> str:
    return "contenuto fuori dal settore del tenant (I21, sys.v_contenuto_fuori_settore): la cura e' sostituirlo con contenuto pertinente"


def regola_colonna_soggetto(l: Lacuna, ctx: Contesto) -> bool:
    return (l.fonte == "db_health" and l.colonna is not None
            and bool(cdr.RE_SOGGETTO.search(l.colonna)) and not bool(cdr.RE_ATTORE.search(l.colonna)))


def motivo_colonna_soggetto(l: Lacuna, ctx: Contesto) -> str:
    return f"la colonna `{l.colonna}` identifica una persona (regola R3 di #205): non e' il codice a saperlo, e' il cliente"


def regola_fk_popolata(l: Lacuna, ctx: Contesto) -> bool:
    if l.fonte != "db_health" or l.colonna is None:
        return False
    fk = ctx.fk_map.get((l.tabella, l.colonna))
    return bool(fk and fk[1] > 0)


def motivo_fk_popolata(l: Lacuna, ctx: Contesto) -> str:
    rif_tab, rif_righe = ctx.fk_map[(l.tabella, l.colonna)]
    return f"FK verso `{rif_tab}` (gia' popolata, {rif_righe} righe): il codice ha gia' l'informazione per valorizzarla"


def regola_contenuto_settore(l: Lacuna, ctx: Contesto) -> bool:
    return l.fonte == "completezza_tenant" and l.tabella in ctx.dest_domain


def motivo_contenuto_settore(l: Lacuna, ctx: Contesto) -> str:
    return f"contenuto di settore, dominio ricercabile #205 `{ctx.dest_domain[l.tabella]}` (chiaviDominio())"


def regola_uso_prodotto(l: Lacuna, ctx: Contesto) -> bool:
    return l.fonte == "completezza_tenant" and l.tabella in ctx.uso_prodotto


def motivo_uso_prodotto(l: Lacuna, ctx: Contesto) -> str:
    moduli = ", ".join(sorted(ctx.uso_prodotto[l.tabella]))
    return f"tabella vuota ma con una rotta di scrittura gia' raggiungibile (modulo `{moduli}`): si popola usando il prodotto, non riparando"


def regola_tabella_persona(l: Lacuna, ctx: Contesto) -> bool:
    return l.fonte == "completezza_tenant" and _di_persona(ctx, l.tabella)


def motivo_tabella_persona(l: Lacuna, ctx: Contesto) -> str:
    e = ctx.esito_205.get(l.tabella) or {}
    soggetti = ", ".join(e.get("soggetti", [])[:3]) or "?"
    return f"tabella di dati della persona/azienda (colonna soggetto: {soggetti}) — bloccata da M6, il registro la nomina"


# La tabella dichiarativa: (nome regola, famiglia, predicato, motivo). Valutate IN ORDINE,
# prima che vince. Cio' che non ne rispetta nessuna e' DECISIONE — non un `else` nascosto,
# e' l'assenza di un match, stampata come tale.
REGOLE: list[tuple[str, str, Callable[[Lacuna, Contesto], bool], Callable[[Lacuna, Contesto], str]]] = [
    ("fuori-settore",              "RICERCA",    regola_fuori_settore,      motivo_fuori_settore),
    ("colonna-soggetto-persona",   "CLIENTE",    regola_colonna_soggetto,   motivo_colonna_soggetto),
    ("contenuto-di-settore-vuoto", "RICERCA",    regola_contenuto_settore,  motivo_contenuto_settore),
    ("uso-prodotto",               "USO-PRODOTTO", regola_uso_prodotto,     motivo_uso_prodotto),
    ("tabella-di-persona-vuota",   "CLIENTE",    regola_tabella_persona,    motivo_tabella_persona),
    ("fk-a-tabella-popolata",      "DERIVABILE", regola_fk_popolata,        motivo_fk_popolata),
]


def classifica(l: Lacuna, ctx: Contesto) -> Lacuna:
    for nome, famiglia, pred, motivo in REGOLE:
        if pred(l, ctx):
            l.famiglia, l.regola, l.motivo = famiglia, nome, motivo(l, ctx)
            return l
    l.famiglia, l.regola = "DECISIONE", "nessuna-regola"
    l.motivo = "nessuna regola meccanica classifica questa lacuna — la legge Enzo"
    return l


def classifica_tutte(lacune: list[Lacuna], ctx: Contesto) -> list[Lacuna]:
    return [classifica(l, ctx) for l in lacune]


# ── F3 — LA CODA DI LAVORO PER FAMIGLIA ───────────────────────────────────────────────────

FAMIGLIE = ["DERIVABILE", "RICERCA", "CLIENTE", "USO-PRODOTTO", "DECISIONE"]


def per_famiglia(lacune: list[Lacuna]) -> dict[str, list[Lacuna]]:
    out = {f: [] for f in FAMIGLIE}
    for l in lacune:
        out[l.famiglia].append(l)
    return out


def stampa_per_famiglia(lacune: list[Lacuna]) -> None:
    gruppi = per_famiglia(lacune)
    print("=" * 96)
    print(" #257 — CHI RIPARA E CHI POPOLA: la coda per famiglia")
    print("=" * 96)

    print(f"\n① DERIVABILE — lo fa il CODICE ({len(gruppi['DERIVABILE'])})")
    for l in gruppi["DERIVABILE"]:
        print(f"    {l.tabella}.{l.colonna}  —  {l.motivo}")

    print(f"\n② RICERCA — lo fa la macchina della ricerca #205 ({len(gruppi['RICERCA'])})")
    for l in gruppi["RICERCA"]:
        dove = f"tenant {l.tenant}" if l.tenant else "-"
        print(f"    {l.tabella}  ({dove})  —  {l.motivo}")

    print(f"\n③ CLIENTE — lo fornisce l'azienda cliente, BLOCCATA DA M6 ({len(gruppi['CLIENTE'])})")
    for l in gruppi["CLIENTE"]:
        dove = f"tenant {l.tenant}" if l.tenant else (l.colonna or "-")
        print(f"    {l.tabella}  ({dove})  —  {l.motivo}")

    print(f"\n⑤ USO-PRODOTTO — si popola vivendo, nessuno la ripara ({len(gruppi['USO-PRODOTTO'])})")
    for l in gruppi["USO-PRODOTTO"]:
        dove = f"tenant {l.tenant}" if l.tenant else "-"
        print(f"    {l.tabella}  ({dove})  —  {l.motivo}")

    print(f"\n④ DECISIONE — la legge Enzo, elenco finito ({len(gruppi['DECISIONE'])})")
    if not gruppi["DECISIONE"]:
        print("    (nessuna: ogni lacuna misurata oggi rientra in una delle altre famiglie)")
    for l in gruppi["DECISIONE"]:
        colonna = f".{l.colonna}" if l.colonna else ""
        dove = f" (tenant {l.tenant})" if l.tenant else ""
        print(f"    {l.tabella}{colonna}{dove}  —  fonte: {l.fonte}  —  {l.dettaglio}")
    print("=" * 96)


# ── F4 — LA RIGA PER session_start.py ─────────────────────────────────────────────────────

def riga_dashboard() -> str:
    """Una riga, muta se il database non risponde (NON MISURABILE, non un verde)."""
    try:
        lacune = misura_unificata()
        ctx = costruisci_contesto()
        lacune = classifica_tutte(lacune, ctx)
    except NonRaggiungibile:
        return "  [? ] lacune      database non raggiungibile: NON MISURABILE"
    gruppi = per_famiglia(lacune)
    return (f"  [i ] lacune      {len(lacune)} — DERIVABILE {len(gruppi['DERIVABILE'])} · "
            f"RICERCA {len(gruppi['RICERCA'])} · CLIENTE {len(gruppi['CLIENTE'])} · "
            f"USO-PRODOTTO {len(gruppi['USO-PRODOTTO'])} · DECISIONE {len(gruppi['DECISIONE'])}")


# ── --selftest (F2): esiti opposti su casi reali, poi si sabota la regola che ha deciso ────

# Casi reali (non fixture): se la misura del vivo cambia, il selftest lo dice — non si adatta.
CASI = [
    ("DERIVABILE", "sys_bonus_pools", "bonus_pool_organization_unit_id", None,
     "fk-a-tabella-popolata", "FK verso sys_organization_units, gia' popolata"),
    ("RICERCA", "sys_skills", None, "HEURESYS",
     "contenuto-di-settore-vuoto", "dominio #205 `skills`, tabella vuota per HEURESYS"),
    ("CLIENTE", "sys_attendance", None, "HEURESYS",
     "tabella-di-persona-vuota", "presenze: dato della persona, vuota per HEURESYS"),
    ("USO-PRODOTTO", "sys_okrs", None, "HEURESYS",
     "uso-prodotto", "modulo okrs: INSERT reale + rotta POST gia' raggiungibile"),
    ("DECISIONE", "sys_activity_classifications", "activity_classification_description", None,
     "nessuna-regola", "nessuna FK, nessun soggetto, non e' un dominio #205"),
]


def _lacuna_di_caso(famiglia, tabella, colonna, tenant) -> Lacuna:
    fonte = "db_health" if colonna else "completezza_tenant"
    return Lacuna(fonte=fonte, tabella=tabella, colonna=colonna, tenant=tenant)


def selftest() -> int:
    print("=" * 96)
    print(" #257 F2 — AUTOPROVA: esiti opposti su casi reali, poi si sabota la regola vincente")
    print("=" * 96)
    ctx = costruisci_contesto()
    rossi = 0

    esiti = []
    for famiglia_attesa, tabella, colonna, tenant, regola_attesa, nota in CASI:
        l = _lacuna_di_caso(famiglia_attesa, tabella, colonna, tenant)
        classifica(l, ctx)
        ok = l.famiglia == famiglia_attesa and l.regola == regola_attesa
        print(f"  [{'OK' if ok else '!!'}] {tabella}{'.' + colonna if colonna else ''} "
              f"-> atteso {famiglia_attesa} (`{regola_attesa}`), ottenuto {l.famiglia} (`{l.regola}`)  — {nota}")
        rossi += 0 if ok else 1
        esiti.append((famiglia_attesa, tabella, colonna, tenant, regola_attesa, ok))

    # Sabotaggio: disabilito LA regola che ha prodotto il primo esito (DERIVABILE, fk-popolata)
    # e pretendo che SOLO quel caso cambi famiglia — la prova che la regola, non un fallback
    # fortunato, era responsabile dell'esito.
    global REGOLE
    print("\n  sabotaggio: la regola 'fk-a-tabella-popolata' viene disattivata")
    originali = REGOLE
    REGOLE = [r for r in REGOLE if r[0] != "fk-a-tabella-popolata"]
    try:
        for famiglia_attesa, tabella, colonna, tenant, regola_attesa, _ in esiti:
            l = _lacuna_di_caso(famiglia_attesa, tabella, colonna, tenant)
            classifica(l, ctx)
            if regola_attesa == "fk-a-tabella-popolata":
                cambiato = l.famiglia != famiglia_attesa
                print(f"  [{'OK' if cambiato else '!!'}] {tabella}{'.' + colonna if colonna else ''} "
                      f"sabotato -> {l.famiglia} (atteso: DIVERSO da {famiglia_attesa})")
                rossi += 0 if cambiato else 1
            else:
                invariato = l.famiglia == famiglia_attesa
                print(f"  [{'OK' if invariato else '!!'}] {tabella}{'.' + colonna if colonna else ''} "
                      f"invariato -> {l.famiglia} (atteso: ANCORA {famiglia_attesa})")
                rossi += 0 if invariato else 1
    finally:
        REGOLE = originali

    print("=" * 96)
    print(f"  {'AUTOPROVA SUPERATA' if rossi == 0 else f'AUTOPROVA FALLITA — {rossi} guasti'}")
    print("=" * 96)
    return 1 if rossi else 0


# ── main ───────────────────────────────────────────────────────────────────────────────────

def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--per-famiglia", action="store_true")
    p.add_argument("--selftest", action="store_true")
    p.add_argument("--verifica-fonti", action="store_true", help="F1: post-condizione contro le tre fonti")
    p.add_argument("--json", metavar="FILE")
    a = p.parse_args()

    try:
        if a.selftest:
            return selftest()

        lacune = misura_unificata()
        ctx = costruisci_contesto()
        lacune = classifica_tutte(lacune, ctx)

        if a.per_famiglia:
            stampa_per_famiglia(lacune)
        else:
            gruppi = per_famiglia(lacune)
            print("=" * 96)
            print(" #257 — IL REGISTRO DI CHI RIPARA E CHI POPOLA")
            print("=" * 96)
            print(f"  lacune misurate (fonti A+B+C)          {len(lacune):>5}")
            print(f"    A. completezza_tenant (tabelle)      {sum(1 for l in lacune if l.fonte == 'completezza_tenant'):>5}")
            print(f"    B. db_health (colonne mai riempite)  {sum(1 for l in lacune if l.fonte == 'db_health'):>5}")
            print(f"    C. v_contenuto_fuori_settore (righe) {sum(1 for l in lacune if l.fonte == 'v_contenuto_fuori_settore'):>5}")
            print()
            print(f"  ① DERIVABILE (il codice)              {len(gruppi['DERIVABILE']):>5}")
            print(f"  ② RICERCA (macchina della ricerca #205) {len(gruppi['RICERCA']):>5}")
            print(f"  ③ CLIENTE (bloccata da M6)             {len(gruppi['CLIENTE']):>5}")
            print(f"  ⑤ USO-PRODOTTO (si popola vivendo)     {len(gruppi['USO-PRODOTTO']):>5}")
            print(f"  ④ DECISIONE (la legge Enzo)            {len(gruppi['DECISIONE']):>5}")
            print("=" * 96)
            print("  `--per-famiglia` per la coda dettagliata, `--verifica-fonti` per la post-condizione di F1.")

        if a.verifica_fonti:
            ok, problemi = verifica_fonti(lacune)
            print("\n" + "-" * 96)
            print(" F1 — POST-CONDIZIONE: il totale coincide con la somma delle tre fonti?")
            print("-" * 96)
            if ok:
                print("  OK — le tre fonti, ri-misurate in modo indipendente, tornano.")
            else:
                print("  GUASTO:")
                for pr in problemi:
                    print(f"    - {pr}")
            print("-" * 96)
            if not ok:
                return 1

        if a.json:
            with open(a.json, "w", encoding="utf-8") as f:
                json.dump([{"fonte": l.fonte, "tabella": l.tabella, "colonna": l.colonna,
                            "tenant": l.tenant, "dettaglio": l.dettaglio, "famiglia": l.famiglia,
                            "regola": l.regola, "motivo": l.motivo} for l in lacune],
                          f, ensure_ascii=False, indent=2)
            print(f"  scritto {a.json}")
        return 0
    except NonRaggiungibile as e:
        print(f"\n  NON MISURABILE: database non raggiungibile ({e})")
        print("  -> tunnel :5433 su? `ssh -fN -L 5433:localhost:5432 oracle-vm-default`")
        return 2


if __name__ == "__main__":
    sys.exit(main())
