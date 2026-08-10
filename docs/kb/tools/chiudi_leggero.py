#!/usr/bin/env python3
"""chiudi_leggero — il cancello della chiusura leggera di una sessione.

    python docs/kb/tools/chiudi_leggero.py                 # controlla e basta
    python docs/kb/tools/chiudi_leggero.py --commit "msg"  # controlla, poi committa

PERCHE' ESISTE
--------------
La chiusura completa (skill `handoff`) fa nove passi: conteggi granulari ri-derivati,
indice dei percorsi, push, propagazione a VM e linux-pc, deploy. Sono cari, e NESSUNO
di loro serve al menu che si apre domani.

Al menu servono TRE cose, e solo quelle:
  1. tutto committato — cio' che vive solo nel working tree sparisce, o finisce nel
     commit sbagliato (S1053: un `git add -u` si porto' dentro 174 righe altrui);
  2. il REGISTRO allineato — `build_menu.py` costruisce il menu da li', non dalla
     memoria di nessuno: voci chiuse, voci nuove, e le interrotte con scritto DA DOVE
     riprendere;
  3. la VISTA RAPIDA riscritta — `.handoff/STATE.md`: cosa e' successo, cosa resta,
     cosa sapere prima di toccare qualcosa.

COSA QUESTO STRUMENTO NON FA, E PERCHE'
---------------------------------------
Non scrive il registro e non scrive la vista rapida. Quel contenuto richiede giudizio —
quale voce e' chiusa, cosa e' rimasto a meta', da dove si riprende — e lo sa solo chi ha
lavorato. Uno strumento che lo inventasse produrrebbe un menu plausibile e falso, che e'
peggio di un menu assente.

Quindi fa il mestiere di un cancello: MISURA le tre mosse, dice quale manca e con che
comando si rimedia, e rifiuta di chiudere se una non c'e'. La parte meccanica (il commit
finale, il controllo di coerenza) la fa lui.

Esce 0 se si puo' chiudere, 1 se manca qualcosa.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
STATE = REPO / ".handoff" / "STATE.md"
LINT = REPO / "docs" / "kb" / "tools" / "handoff_lint.py"

# Untracked che NON sono di Claude e non vanno committati ne' segnalati come sporcizia:
# il canale di audit di Codex ha i suoi file e il suo AGENTS.md, e restano untracked per
# scelta architetturale (CLAUDE.md, §"Codex read-only audit channel").
NON_MIEI = (".codex/", ".codex-review/", ".agents/", "AGENTS.md")


def git(*args: str) -> str:
    p = subprocess.run(["git", *args], cwd=str(REPO), capture_output=True, text=True)
    return p.stdout.strip()


def mossa_1_lavoro_committato() -> tuple[bool, str, str]:
    """Tutto cio' che e' mio deve stare in un commit."""
    righe = [r for r in git("status", "--porcelain").splitlines() if r.strip()]
    modificati = [r for r in righe if not r.startswith("??")]
    untracked = [r[3:] for r in righe if r.startswith("??")]
    miei_untracked = [f for f in untracked if not f.startswith(NON_MIEI)]

    if modificati:
        return (False,
                f"{len(modificati)} file modificati non committati",
                "git status  →  poi committali, o dichiara perche' restano fuori")
    if miei_untracked:
        return (False,
                f"{len(miei_untracked)} file nuovi mai aggiunti: {', '.join(miei_untracked[:4])}",
                "git add <file> && git commit  —  oppure aggiungili al .gitignore con una ragione")
    return (True, "tutto committato" + (f" ({len(untracked)} untracked non miei, ignorati)"
                                        if untracked else ""), "")


def mossa_2_registro_allineato() -> tuple[bool, str, str]:
    """Il menu si costruisce dal registro: se e' incoerente, il menu mente."""
    if not LINT.is_file():
        return (True, "nessun linter del registro in questo repo", "")
    p = subprocess.run([sys.executable, str(LINT)], cwd=str(REPO),
                       capture_output=True, text=True)
    coda = (p.stdout or p.stderr or "").strip().splitlines()
    ultima = coda[-1] if coda else "(nessun esito)"
    if p.returncode != 0:
        return (False, ultima, "python docs/kb/tools/handoff_lint.py  →  correggi i FAIL")
    return (True, ultima, "")


def mossa_3_vista_rapida() -> tuple[bool, str, str]:
    """La vista rapida deve parlare di OGGI.

    Il controllo e' sulla data dichiarata dentro il file, non sulla data del file: un
    `touch` non e' un aggiornamento, e un file riscritto senza cambiare la riga
    `**Updated**` racconta comunque la sessione di ieri.
    """
    if not STATE.is_file():
        return (False, f"{STATE.name} non esiste", f"scrivi {STATE}")
    testo = STATE.read_text(encoding="utf-8", errors="replace")
    oggi = time.strftime("%Y-%m-%d")
    riga = next((r for r in testo.splitlines() if r.startswith("**Updated**")), "")
    if not riga:
        return (False, "manca la riga **Updated**",
                "aggiungi in testa: **Updated**: <data> (<sessione> — <una frase>)")
    if oggi not in riga:
        return (False, f"la vista rapida dice ancora «{riga[:58]}…»",
                f"riscrivila per questa sessione e metti la data {oggi}")
    return (True, riga[:70], "")


def main() -> int:
    ap = argparse.ArgumentParser(description="cancello della chiusura leggera")
    ap.add_argument("--commit", metavar="MSG",
                    help="se i tre controlli passano, committa cio' che resta con questo messaggio")
    a = ap.parse_args()

    print("CHIUSURA LEGGERA — le tre mosse che determinano il menu di domani\n")
    mosse = [
        ("1. lavoro committato", mossa_1_lavoro_committato),
        ("2. registro allineato (il menu nasce da qui)", mossa_2_registro_allineato),
        ("3. vista rapida di oggi", mossa_3_vista_rapida),
    ]
    manca = []
    for titolo, f in mosse:
        ok, dettaglio, rimedio = f()
        print(f"  [{'OK' if ok else '  '}] {titolo}\n       {dettaglio}")
        if not ok:
            print(f"       → {rimedio}")
            manca.append(titolo)
        print()

    if manca:
        print(f"NON SI CHIUDE: manca {len(manca)} mossa/e su 3.")
        print("Nessuna di queste si inventa: il contenuto lo scrive chi ha lavorato.")
        return 1

    nuovi = git("log", "--oneline", "@{u}..HEAD").splitlines() if git("rev-parse", "--abbrev-ref", "@{u}") else []
    print(f"SI PUO' CHIUDERE. {len(nuovi)} commit locali non ancora su origin.")
    print("Il push NON lo fa questo strumento: resta una decisione esplicita.")

    if a.commit:
        resta = [r for r in git("status", "--porcelain").splitlines()
                 if r.strip() and not r.startswith("??")]
        if not resta:
            print("\n--commit: non c'era piu' niente da committare.")
            return 0
        subprocess.run(["git", "commit", "-am", a.commit], cwd=str(REPO), check=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
