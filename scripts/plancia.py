#!/usr/bin/env python3
"""plancia.py — plancia unificata: sessioni Claude Code + stato di sola
lettura del loop zero-pendenze, in un solo processo e una sola pagina.

Aggiunta additiva del 2026-08-08 (decisione di Enzo): NON sostituisce
scripts/sessioni_panel.py ne' scripts/zp_panel.py, che restano disponibili
e invariati come strumenti a se'. Riusa la loro logica di lettura:

  · vista "Sessioni"      — importa scripts/sessioni_panel.py e ne chiama
    stato() cosi' com'e'.
  · vista "Zero-Pending"  — importa scripts/zp_panel.py e ne chiama SOLO
    stato() (lettura pura: piano, freno, lock, spesa, corse, vassoio,
    triage). Le azioni che mutano stato reale (lancio del driver, freno,
    censimento, attivita' Windows) NON sono replicate qui: restano
    ESCLUSIVAMENTE in scripts/zp_panel.py, che e' gia' live con la sua
    chiave d'accesso, le sue configurazioni salvate e le sue attivita'
    schedulate — questo file non li tocca ne' li duplica.

Il frontend e' lo stesso di sessioni-panel (scripts/sessioni-panel/): la
vista "Zero-Pending" in app.js si attiva da sola quando la risposta di
/api/stato porta la chiave `zp` (qui presente; assente quando a rispondere
e' sessioni_panel.py da solo).

Uso
---
    python scripts/plancia.py            # http://127.0.0.1:8481
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

QUI = Path(__file__).resolve().parent
sys.path.insert(0, str(QUI))
import panel_base as pb          # noqa: E402
import sessioni_panel            # noqa: E402
import zp_panel                  # noqa: E402  (SOLO lettura: si chiama solo zp_panel.stato())

REPO = sessioni_panel.REPO
PORTA = 8481
CHIAVE_FILE = REPO / ".panel" / "plancia-chiave.txt"

CACHE = pb.Cache()


def stato_zp_sola_lettura() -> dict:
    """Involucro esplicito: nomina il fatto che qui si chiama SOLO la lettura
    di zp_panel, mai una delle sue funzioni che mutano stato reale."""
    return zp_panel.stato()


def stato() -> dict:
    d = sessioni_panel.stato()
    d["zp"] = CACHE.prendi("zp", 5.0, stato_zp_sola_lettura)
    return d


class Handler(pb.PlanciaHandler):
    STATICI = sessioni_panel.STATICI    # riusa lo stesso frontend, nessuna duplicazione
    VENDOR = sessioni_panel.VENDOR

    def do_GET(self):
        via = self._percorso()
        if via.startswith("/api/"):
            if not self._autorizzato():
                self._nega()
                return
            if via == "/api/stato":
                self._json(stato())
                return
            self._json({"errore": "non trovato"}, 404)
            return
        if not self.servi_statico():
            self._manda(b"non trovato", "text/plain; charset=utf-8", 404)

    def do_POST(self):
        if not self._autorizzato():
            self._nega()
            return
        if self._percorso() != "/api/azione":
            self._json({"ok": False, "errore": "non trovato — le azioni operative "
                                                 "restano su scripts/zp_panel.py"}, 404)
            return
        n = int(self.headers.get("Content-Length") or 0)
        try:
            corpo = json.loads(self.rfile.read(n) or b"{}")
        except (ValueError, json.JSONDecodeError):
            corpo = {}
        esito = self.azione_self(corpo.get("azione"))
        if esito is None:
            self._json({"ok": False, "errore": "azione non ammessa"}, 400)
        else:
            self._json(esito)


Handler.CACHE = CACHE
Handler.RIAVVIA_CB = pb.riavvia_processo


def main() -> int:
    ap = argparse.ArgumentParser(add_help=False)
    ap.add_argument("--stampa", action="store_true")
    a, _resto = ap.parse_known_args()
    if a.stampa:
        print(json.dumps(stato(), ensure_ascii=False, indent=2))
        return 0
    return pb.avvia_server(Handler, PORTA, CHIAVE_FILE, "plancia unificata",
                           aperta_default=True,
                           descrizione_dati="i transcript delle sessioni e lo stato di zero-pendenze")


if __name__ == "__main__":
    sys.exit(main())
