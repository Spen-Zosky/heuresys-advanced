#!/usr/bin/env python3
"""
session_start.py — ONE consolidated session-start view for heuresys-advanced.

Prints, in one round: the action menu (build_menu) · the deliveries the design-lab has left in
its inbox and that are NOT yet in the register (lab_inbox — silent when there is nothing, and on
the clones, where the lab does not exist) · the live health dashboard (status_dashboard) · the
`v_*` sentinels (db_health).

Collapses the two-step boot (build_menu.py + status_dashboard.py) into a SINGLE process
and a SINGLE model round: it prints the action menu (from build_menu) followed by the live
health dashboard (from status_dashboard), which AT BOOT runs OFFLINE-FAST (--no-net). The
network probes (git-fetch / gh-CI / curl-prod) are monitoring data, not inputs to the action
menu — the boot hook already established tunnel + DB + branch/dirty/unpushed — so they are
skipped by default and checked on demand:

    python docs/kb/tools/status_dashboard.py        # FULL live health (CI/PROD/git-fetch) — alias `pnpm status`
    python docs/kb/tools/session_start.py --net     # menu + health WITH the network probes

Born from the session-start forensics (2026-07-07): the two-script, N-round session-start
doctrine (Read 4 raw state files → run build_menu → run status_dashboard → aggregate) was the
dominant cost of a slow "avvia sessione". This cuts the model rounds and the redundant boot-time
network probes without losing any information — build_menu still derives the exhaustive menu
from the Action register, status_dashboard still re-derives DB/backlog/debt/decisions live.

Read-only. Exit 0 always (it's a VIEW, not a gate). Passes --no-db through when the tunnel is down.
Usage:
    python docs/kb/tools/session_start.py             # menu + health (offline-fast — the boot default)
    python docs/kb/tools/session_start.py --no-db     # + skip psql (tunnel down)
    python docs/kb/tools/session_start.py --show-hold # + list HOLD items
    python docs/kb/tools/session_start.py --net       # + run the network probes (CI/PROD/git-fetch)
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_menu  # noqa: E402
import db_health  # noqa: E402
import lab_inbox  # noqa: E402
import status_dashboard  # noqa: E402

try:
    sys.stdout.reconfigure(encoding="utf-8")  # glyph/arrow-safe on Windows consoles
except Exception:
    pass


def main():
    ap = argparse.ArgumentParser(
        description="Consolidated session-start: action menu + offline-fast health in ONE process/round.")
    ap.add_argument("--no-db", action="store_true", help="skip psql (tunnel down)")
    ap.add_argument("--show-hold", action="store_true", help="also list HOLD items")
    ap.add_argument("--net", action="store_true",
                    help="also run the network probes (git-fetch/gh/curl) — OFF by default at boot")
    args = ap.parse_args()

    # Reuse the two standalone tools in-process. build_menu/status_dashboard stay usable
    # on their own (pnpm status = full on-demand); here we run both once, boot = offline-fast.
    saved_argv = sys.argv
    try:
        sys.argv = (["build_menu"]
                    + (["--no-db"] if args.no_db else [])
                    + (["--show-hold"] if args.show_hold else []))
        build_menu.main()
        # Il design-lab sta fuori dal repo (sessioni parallele senza collisioni), e questo
        # rendeva le sue consegne un ponte MANUALE. Qui la canonica le scopre da sola: la
        # sezione compare solo se c'e' qualcosa da dire, ed e' muta sui cloni VM/linux-pc,
        # dove il lab non esiste (riassunto() esce vuota se la inbox non e' una directory).
        try:
            lab = lab_inbox.riassunto()
        except Exception as exc:  # una vista non puo' abbattere il boot
            lab = f"   ⚠ lab inbox non leggibile: {exc}"
        if lab:
            print("\n" + lab)
        print()
        sys.argv = (["status_dashboard"]
                    + ([] if args.net else ["--no-net"])
                    + (["--no-db"] if args.no_db else []))
        status_dashboard.main()
        # Le 14 viste sentinella `v_*` di sys esistevano da tempo e nessuno le
        # interrogava (misurato in lab 2026-08-03). Qui si accendono a ogni boot,
        # in forma compatta: una riga se sono a zero, una riga per allarme se no.
        # Vista, non gate: l'esito si stampa e session_start esce comunque 0.
        if not args.no_db:
            print("\nSENTINELLE DBMS (viste v_* — db_health.py)")
            sys.argv = ["db_health", "--sentinelle", "--compatto"]
            db_health.main()
    finally:
        sys.argv = saved_argv
    return 0


if __name__ == "__main__":
    sys.exit(main())
