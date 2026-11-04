#!/usr/bin/env python3
"""
docs/kb/tools/check_permessi_inutili.py — S-21 del piano interfacce (2026-11-04).

Due domande sul catalogo dei permessi, con la risposta misurata e non ricordata:

  1. Quali permessi del catalogo NON servono a niente? Un permesso serve se lo chiede una
     rotta (`requirePermission`), se il codice lo nomina (servizi, cruscotti, pagine web,
     contratti condivisi) o se una voce di menu lo richiede (`sys_ui_interfaces`).
  2. Quali concessioni vive (ruolo -> permesso, non ritirate) nessuna migrazione spiega?
     Una concessione e' spiegata se almeno un file di `db/migrations/` nomina sia il ruolo
     sia il permesso, oppure concede al ruolo l'intero catalogo o un'intera risorsa.

Per ognuno l'esito va scritto in ESITI (qui sotto): `usato` (con dove), `da ritirare`
(si emenda il file che lo crea, ADR-0035), `spiegato` (con la migrazione). Un permesso o una
concessione senza esito e' un rosso; un esito per qualcosa che non c'e' piu' anche.

Il database si raggiunge con le variabili PG* consuete; senza, il tunnel di Windows
(localhost:5433, heuresys_advanced). Sulla VM:
    PGHOST=/var/run/postgresql PGPORT=5432 PGDATABASE=<db> python docs/kb/tools/check_permessi_inutili.py

Uscita: 0 verde, 1 rosso, 2 database non raggiungibile (non si dichiara niente).
Opzione --elenco: stampa i due elenchi completi in TSV, senza giudicare.
"""
from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

RADICE = Path(__file__).resolve().parents[3]
CODICE = [RADICE / "apps/api/src", RADICE / "apps/web/src", RADICE / "packages/shared/src"]
MIGRAZIONI = RADICE / "db/migrations"
CODICE_PERMESSO = re.compile(r"""["'`]([a-z][a-z0-9_]*:[a-z][a-z0-9_]*(?::[a-z][a-z0-9_]*)?)["'`]""")

# Esiti scritti a mano dopo la misura. Chiave: codice del permesso, oppure «RUOLO permesso»
# per una concessione. Valore: l'esito e la sua ragione, in una riga.
ESITI: dict[str, str] = {}


def psql(sql: str) -> list[list[str]] | None:
    env = dict(os.environ)
    env.setdefault("PGHOST", "localhost")
    env.setdefault("PGPORT", "5433")
    env.setdefault("PGDATABASE", "heuresys_advanced")
    env.setdefault("PGUSER", "heuresys")
    try:
        out = subprocess.run(
            ["psql", "-X", "-q", "-tA", "-F", "\t", "-c", sql],
            capture_output=True, text=True, timeout=60, env=env, encoding="utf-8", errors="replace",
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if out.returncode != 0:
        return None
    return [r.split("\t") for r in out.stdout.splitlines() if r.strip()]


def citati_nel_codice() -> dict[str, str]:
    """Ogni codice di permesso scritto come stringa nel codice, con il primo file che lo nomina."""
    dove: dict[str, str] = {}
    for base in CODICE:
        for f in sorted(base.rglob("*")):
            if f.suffix not in {".ts", ".tsx"} or ".test." in f.name or "node_modules" in f.parts:
                continue
            testo = f.read_text(encoding="utf-8", errors="replace")
            for m in CODICE_PERMESSO.finditer(testo):
                dove.setdefault(m.group(1), str(f.relative_to(RADICE)))
    return dove


def testi_delle_migrazioni() -> list[tuple[str, str]]:
    return [(f.name, f.read_text(encoding="utf-8", errors="replace")) for f in sorted(MIGRAZIONI.glob("*.sql"))]


def spiegata(ruolo: str, permesso: str, migrazioni: list[tuple[str, str]]) -> str | None:
    risorsa = permesso.split(":")[0]
    for nome, testo in migrazioni:
        if ruolo not in testo:
            continue
        if f"'{permesso}'" in testo or f"'{risorsa}:%'" in testo or f"'{risorsa}'" in testo:
            return nome
    return None


def main() -> int:
    catalogo = psql("SELECT auth_permission_code FROM sys.sys_auth_permissions ORDER BY 1")
    menu = psql(
        "SELECT DISTINCT ui_interface_required_resource || ':' || ui_interface_required_action "
        "FROM sys.sys_ui_interfaces WHERE ui_interface_required_resource IS NOT NULL"
    )
    concessioni = psql(
        "SELECT r.auth_role_code, p.auth_permission_code FROM sys.sys_auth_role_permissions rp "
        "JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id "
        "JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id "
        "WHERE rp.revoked_at IS NULL AND r.retired_at IS NULL ORDER BY 1, 2"
    )
    if catalogo is None or menu is None or concessioni is None:
        print("check_permessi_inutili: database non raggiungibile, niente da dichiarare")
        return 2

    codice = citati_nel_codice()
    dal_menu = {r[0] for r in menu}
    inutili = [c[0] for c in catalogo if c[0] not in codice and c[0] not in dal_menu]

    migrazioni = testi_delle_migrazioni()
    da_spiegare = [f"{r} {p}" for r, p in concessioni if spiegata(r, p, migrazioni) is None]

    if "--elenco" in sys.argv:
        print(f"# permessi del catalogo: {len(catalogo)}; citati nel codice o nel menu: {len(catalogo) - len(inutili)}")
        print(f"# permessi che niente usa: {len(inutili)}")
        for c in inutili:
            print(f"inutile\t{c}")
        print(f"# concessioni vive: {len(concessioni)}; senza una migrazione che le spieghi: {len(da_spiegare)}")
        for k in da_spiegare:
            print(f"da_spiegare\t{k}")
        return 0

    trovati = set(inutili) | set(da_spiegare)
    senza_esito = sorted(k for k in trovati if k not in ESITI)
    esiti_orfani = sorted(k for k in ESITI if k not in trovati)
    print(f"permessi che niente usa: {len(inutili)}; concessioni senza migrazione: {len(da_spiegare)}")
    for k in senza_esito:
        print(f"ROSSO senza esito: {k}")
    for k in esiti_orfani:
        print(f"ROSSO esito senza oggetto (rimuovilo da ESITI): {k}")
    return 1 if senza_esito or esiti_orfani else 0


if __name__ == "__main__":
    sys.exit(main())
