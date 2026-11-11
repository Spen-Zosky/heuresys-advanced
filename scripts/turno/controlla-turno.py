#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Controlla che questa macchina abbia il turno del repo (guardia GU2 del piano dei turni gemelli).

Piano: docs/piani/PIANO_turni-advanced-datastore_20261110.md (regola di Enzo del 2026-11-10: un solo lato
lavora alla volta). Lo chiamano gli hook pre-commit e pre-push di scripts/turno/hooks.

Legge il registro dal clone locale di turni-gemelli (TURNO_CLONE, altrimenti ~/turni-gemelli): basta, perché
il registro cambia solo con `turno prendi` e `turno chiudi`, che lo aggiornano. Esiti:
  0  questa macchina ha il turno aperto, oppure il repo non è ancora nei turni (registro assente);
  1  il turno è chiuso o ce l'ha un'altra macchina: niente commit e niente push da qui.
Solo libreria standard.
"""
import json
import os
import socket
import sys

REPO = sys.argv[1] if len(sys.argv) > 1 else "heuresys-advanced"
CLONE = os.environ.get("TURNO_CLONE") or os.path.join(os.path.expanduser("~"), "turni-gemelli")


def macchina():
    if os.environ.get("TURNO_MACCHINA"):
        return os.environ["TURNO_MACCHINA"]
    try:
        with open(os.path.join(CLONE, "turno", "macchine.json"), encoding="utf-8") as f:
            prof = json.load(f)["macchine"]
    except (OSError, ValueError, KeyError):
        return None
    h = socket.gethostname().lower()
    for nome, p in prof.items():
        if h in [x.lower() for x in p.get("host", [])]:
            return nome
    return None


def main():
    reg = os.environ.get("TURNO_REGISTRO_FILE") or os.path.join(CLONE, "registro", REPO + ".json")
    if not os.path.exists(reg):
        return 0  # il repo non è ancora nei turni: nessuna regola da far rispettare
    try:
        with open(reg, encoding="utf-8") as f:
            st = json.load(f)
    except (OSError, ValueError) as e:
        print("turno: registro %s illeggibile (%s): commit bloccato nel dubbio" % (reg, e), file=sys.stderr)
        return 1
    me = macchina()
    if me is None:
        print("turno: non so che macchina è questa (%s): commit bloccato nel dubbio" % socket.gethostname(), file=sys.stderr)
        return 1
    ap = st.get("aperto") or {}
    if st.get("stato") == "aperto" and ap.get("macchina") == me:
        return 0
    if st.get("stato") == "aperto":
        print("turno: il turno %s di %s ce l'ha %s dal %s. Qui (%s) non si committa e non si pubblica:"
              " lavora lì, oppure chiudilo lì e prendilo qui con `turno prendi`." % (
                  st.get("n"), REPO, ap.get("macchina"), ap.get("aperto_il"), me), file=sys.stderr)
    else:
        print("turno: nessuno ha il turno di %s (ultimo chiuso: n. %s). Per lavorare qui (%s): `turno prendi`." % (
            REPO, (st.get("ultimo_chiuso") or {}).get("n"), me), file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
