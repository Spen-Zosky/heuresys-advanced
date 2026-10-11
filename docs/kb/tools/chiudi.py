#!/usr/bin/env python3
"""chiudi — la chiusura di sessione, un solo comando a tre livelli.

    python docs/kb/tools/chiudi.py                          # livello leggero (default, a ogni sessione)
    python docs/kb/tools/chiudi.py --livello onda --dimostrazioni "<cmd>" "<cmd>"
    python docs/kb/tools/chiudi.py --livello rilascio       # solo se un rilascio e' armato

PERCHE' ESISTE (W0-A3, modifiche 1-5 e 9 di ANALISI_chiusure-e-handoff_20261011)
-------------------------------------------------------------------------------
Advanced aveva due modi di chiudere con nomi diversi dal datastore (`chiudi_leggero.py` e la
skill `handoff`). Il datastore ha `scripts/chiudi.py`. Qui lo stesso nome, gli stessi tre
livelli, lo stesso esito in cinque righe e lo stesso registro (NDJSON: ts, session, run, host,
head, step, outcome, why), per poterli confrontare.

I CONTROLLI NON SI TOLGONO: cambia dove e quando girano.

  leggero   (predefinito) le tre mosse di `chiudi_leggero.py` (riusato, non copiato) piu'
            il cancello `verify_gate.py check` (solo lettura: dice se la verifica e' fresca).
            Non scrive il registro SoT ne' la vista rapida: il giudizio e' di chi ha lavorato.
  onda      leggero + `verify_gate.py run` (le suite instradate dai file cambiati, cioe' le
            prove piu' larghe) + le dimostrazioni dichiarate nel mandato dell'onda
            (--dimostrazioni, un comando per voce, ognuna deve uscire 0).
  rilascio  non fa niente se non c'e' un rilascio armato; se c'e', lo LEGGE con
            `scripts/verifica-deploy.sh`. NON arma, NON propaga, non muove `refs/heads/prod`:
            il rilascio e' di Enzo.

"Rilascio armato" = `refs/heads/prod` su origin esiste e `verifica-deploy.sh` non risponde
DEPLOYATO (cioe' IN-VOLO, CI-ROSSA, DISALLINEATO o NON-VERIFICATO).

USCITA  0 si puo' chiudere, 1 manca qualcosa (e lo dice), 2 uso sbagliato.
Non cancella niente, non fa push (con --commit committa solo i file gia' tracciati).
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

QUI = Path(__file__).resolve().parent
REPO = QUI.parents[2]
REGISTRO = Path(os.environ.get("CHIUDI_REGISTRO") or REPO / ".handoff" / "close-log.ndjson")
RUN = time.strftime("%Y%m%dT%H%M%S") + f"-{os.getpid()}"


def _carica_leggero():
    spec = importlib.util.spec_from_file_location("chiudi_leggero", QUI / "chiudi_leggero.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


LEGGERO = _carica_leggero()


def git(*args: str) -> str:
    p = subprocess.run(["git", *args], cwd=str(REPO), capture_output=True, text=True, encoding="utf-8")
    return p.stdout.strip()


def sessione(arg: str | None) -> str:
    if arg:
        return arg
    if os.environ.get("HEURESYS_SESSION"):
        return os.environ["HEURESYS_SESSION"]
    f = REPO / ".handoff" / "session-id"
    return f.read_text(encoding="utf-8").strip() if f.is_file() else "S?"


def registra(sess: str, step: str, outcome: str, why: str) -> None:
    """Una riga per passo, stesso formato di scripts/close-log.sh. Rendiconto, non stato."""
    try:
        REGISTRO.parent.mkdir(parents=True, exist_ok=True)
        riga = {"ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "session": sess, "run": RUN,
                "host": socket.gethostname(), "head": git("rev-parse", "--short", "HEAD") or "?",
                "step": step, "outcome": outcome, "why": why}
        with open(REGISTRO, "a", encoding="utf-8", newline="\n") as fh:
            fh.write(json.dumps(riga, ensure_ascii=False, separators=(",", ":")) + "\n")
    except OSError:
        pass


def cinque(righe: list[str]) -> None:
    print("\n".join((righe + ["-"] * 5)[:5]))


def lancia(cmd: list[str] | str, shell: bool = False) -> tuple[int, float, str]:
    t = time.time()
    p = subprocess.run(cmd, cwd=str(REPO), shell=shell, capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    coda = (p.stdout + p.stderr).strip().splitlines()
    return p.returncode, time.time() - t, (coda[-1].strip() if coda else "(nessun output)")


def cancello(comando: str) -> tuple[bool, float, str]:
    """verify_gate.py <check|run>. Se lo strumento non c'e' (repo senza cancello) si dichiara."""
    vg = QUI / "verify_gate.py"
    if not vg.is_file():
        return True, 0.0, "nessun cancello in questo repo"
    cod, sec, coda = lancia([sys.executable, str(vg), comando])
    return cod == 0, sec, coda


def leggero(a, sess: str) -> tuple[list[str], list[str], list[str]]:
    """Le tre mosse + cancello check. Ritorna (righe di esito, rossi, passi di registro mancanti)."""
    rossi: list[str] = []
    esiti: dict[str, str] = {}
    for nome, f in (("lavoro", LEGGERO.mossa_1_lavoro_committato),
                    ("registro", LEGGERO.mossa_2_registro_allineato),
                    ("vista-rapida", LEGGERO.mossa_3_vista_rapida)):
        ok, dettaglio, rimedio = f()
        registra(sess, nome, "eseguito" if ok else "fallito", dettaglio)
        esiti[nome] = dettaglio
        if not ok:
            rossi.append(f"{nome}: {dettaglio} -> {rimedio}")
    # All'onda il cancello `run` (piu' sotto) rinfresca e giudica: il `check` prima di lui
    # leggerebbe il verdetto scaduto e darebbe un rosso che il `run` subito dopo smentisce.
    ok, sec, coda = cancello("check") if a.livello == "leggero" else (True, 0.0, "rimandato a `run` (onda)")
    registra(sess, "cancello-check", "eseguito" if ok else "fallito", f"{coda}; {sec:.0f} s")
    if not ok:
        rossi.append(f"cancello: {coda}")
    nuovi = git("log", "--oneline", "@{u}..HEAD").splitlines() if git("rev-parse", "--abbrev-ref", "@{u}") else []
    righe = [
        "VERIFICA: " + ("tre mosse e cancello verdi" if not rossi else f"{len(rossi)} rossi")
        + f" (cancello: {coda}, {sec:.0f} s)",
        f"DEPOSITO: {esiti['lavoro']}; {len(nuovi)} commit non ancora su origin (push: decisione esplicita)",
        "PROPAGAZIONE: non fa parte di questo livello (leggero non propaga: lo fa il rilascio, di Enzo)",
    ]
    return righe, rossi, []


def passo_rilascio(sess: str) -> int:
    prod = git("ls-remote", "origin", "refs/heads/prod").split()
    script = REPO / "scripts" / "verifica-deploy.sh"
    if not prod or not script.is_file():
        registra(sess, "rilascio", "saltato", "nessun rilascio armato")
        cinque(["RILASCIO: nessun rilascio armato, niente da fare."])
        return 0
    bash = r"C:\Git\bin\bash.exe" if os.name == "nt" else "bash"
    out = subprocess.run([bash, str(script)], cwd=str(REPO), capture_output=True, text=True,
                         encoding="utf-8", errors="replace")
    riga = next((r for r in (out.stdout + out.stderr).splitlines() if "VERDETTO:" in r), "")
    verdetto = next((v for v in ("DEPLOYATO", "IN-VOLO", "CI-ROSSA", "DISALLINEATO", "NON-VERIFICATO")
                     if v in riga), "NON-VERIFICATO")
    if verdetto == "DEPLOYATO":
        registra(sess, "rilascio", "saltato", "ultimo armato gia' DEPLOYATO")
        cinque(["RILASCIO: nessun rilascio armato in attesa (l'ultimo e' DEPLOYATO), niente da fare."])
        return 0
    ok = verdetto == "IN-VOLO"
    registra(sess, "rilascio", "eseguito" if ok else "fallito", verdetto)
    cinque([f"RILASCIO: armato, letto {verdetto} (sola lettura, nessuna propagazione)",
            "Il rilascio e il suo esito restano di Enzo." if ok else "Da correggere prima di dire altro.", "-", "-", "-"])
    return 0 if ok else 1


def main() -> int:
    ap = argparse.ArgumentParser(description="chiusura di sessione a tre livelli")
    ap.add_argument("--livello", choices=["leggero", "onda", "rilascio"], default="leggero")
    ap.add_argument("--sessione")
    ap.add_argument("--dimostrazioni", nargs="*", default=[], metavar="CMD",
                    help="onda: comandi dichiarati nel mandato dell'onda, ognuno deve uscire 0")
    ap.add_argument("--commit", metavar="MSG", help="se tutto e' verde, committa i file tracciati rimasti")
    a = ap.parse_args()
    if a.dimostrazioni and a.livello != "onda":
        print("--dimostrazioni vale solo con --livello onda", file=sys.stderr)
        return 2

    sess = sessione(a.sessione)
    registra(sess, "apertura", "eseguito", f"livello {a.livello}")
    if a.livello == "rilascio":
        return passo_rilascio(sess)

    righe, rossi, _ = leggero(a, sess)
    prove = ""
    if a.livello == "onda":
        parti = []
        ok, sec, coda = cancello("run")
        registra(sess, "cancello-run", "eseguito" if ok else "fallito", f"{coda}; {sec:.0f} s")
        parti.append(f"cancello run {'verde' if ok else 'ROSSO'} {sec:.0f} s ({coda})")
        if not ok:
            rossi.append(f"cancello run: {coda}")
        for cmd in a.dimostrazioni:
            cod, sec, coda = lancia(cmd, shell=True)
            registra(sess, "dimostrazione", "eseguito" if cod == 0 else "fallito", f"{cmd}: {coda}")
            parti.append(f"`{cmd}` {'ok' if cod == 0 else 'ROSSO'} {sec:.0f} s")
            if cod != 0:
                rossi.append(f"dimostrazione `{cmd}`: {coda}")
        prove = "; ".join(parti)
    righe.append("PROVE: " + (prove or "livello leggero, nessuna prova larga"))
    righe.append("ROSSI: " + (" | ".join(rossi) if rossi else "nessuno"))
    cinque(righe)
    chiusa = not rossi
    registra(sess, "chiusura", "eseguito" if chiusa else "fallito",
             f"livello {a.livello}: " + ("nessun rosso" if chiusa else f"{len(rossi)} rossi"))
    if chiusa and a.commit:
        resta = [r for r in git("status", "--porcelain").splitlines() if r.strip() and not r.startswith("??")]
        if resta:
            subprocess.run(["git", "commit", "-am", a.commit], cwd=str(REPO), check=False)
    return 0 if chiusa else 1


if __name__ == "__main__":
    sys.exit(main())
