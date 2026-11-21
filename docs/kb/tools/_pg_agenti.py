"""Ruolo degli agenti per gli strumenti che leggono il database (B2, 2026-11-21).

Gli strumenti di `docs/kb/tools/` leggono e al piu' scrivono righe: non cambiano
la struttura. Importando questo modulo passano a `heuresys_agenti`, il ruolo
che il database ferma su DROP, TRUNCATE, ALTER e CREATE.

La credenziale sta in ~/.config/claude-agenti/db-agenti.env (modo 600), creata
da deploy/postgres/assegna-password-agenti.sh; non viene mai stampata.
Dove il file manca (PC via tunnel, gemello: la propagazione e' una decisione di
Enzo) l'ambiente resta com'era e lo si dice su stderr.

Gemello di deploy/postgres/env-agenti.sh per gli script bash.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

VARIABILI_UTENTE = ("PGUSER", "POSTGRES_USER", "ATLAS_PGUSER")
VARIABILI_PASSWORD = ("PGPASSWORD", "POSTGRES_PASSWORD")


def _file() -> Path:
    return Path(os.environ.get("HEURESYS_AGENTI_DB_ENV",
                               Path.home() / ".config" / "claude-agenti" / "db-agenti.env"))


def usa_ruolo_agenti() -> bool:
    """Porta l'ambiente del processo su heuresys_agenti. True se ci e' riuscito."""
    f = _file()
    if not f.is_file():
        print(f"[pg-agenti] manca {f}: resto sull'utente gia' impostato", file=sys.stderr)
        return False
    valori: dict[str, str] = {}
    for riga in f.read_text(encoding="utf-8").splitlines():
        chiave, sep, valore = riga.partition("=")
        if sep:
            valori[chiave.strip()] = valore.strip()
    utente = valori.get("POSTGRES_AGENT_USER", "")
    password = valori.get("POSTGRES_AGENT_PASSWORD", "")
    if not utente or not password:
        print(f"[pg-agenti] {f} incompleto: resto sull'utente gia' impostato", file=sys.stderr)
        return False
    for v in VARIABILI_UTENTE:
        os.environ[v] = utente
    for v in VARIABILI_PASSWORD:
        os.environ[v] = password
    os.environ["HEURESYS_PG_RUOLO"] = "agenti"
    return True


usa_ruolo_agenti()
