#!/usr/bin/env python3
"""rendiconto_chiusure.py — #217 I8: il rendiconto delle chiusure viene LETTO dal boot.

IL DIFETTO: `.handoff/close-log.ndjson` ha 269 record e **nessuno li guarda**. Il
rendiconto veniva scritto con cura da tre script e poi restava li'. La misura che
ha fatto nascere `#217` viene proprio da quel file — ~67 record per sessione, 12
`clone-db ignoto`, 6 `arma ignoto`, 5 `verifica-deploy fallito` — ed e' stata
ricavata a mano, una volta, perche' nessuno strumento la offriva.

COSA MOSTRA, e perche' proprio questo. La domanda di chi apre una sessione e'
**«com'e' finita l'ultima chiusura?»**: quanti passi ha richiesto (il criterio di
successo di `#217` e' che quel numero scenda) e che cosa e' rimasto in sospeso.
Un passo `ignoto` o `fallito` della chiusura precedente e' la prima cosa da
sapere, non l'ultima da scoprire.

⚠ MOSTRA, NON DECIDE. La skill `handoff` lo dice e va rispettato: *«Il diario e'
rendiconto, non stato: nessuna decisione lo legge, e se sparisce la chiusura
resta corretta. Non trasformarlo in una fonte di verita' — un sistema che decide
in base a cio' che ricorda mente quando la memoria si perde.»* Quindi qui non
esiste nessun exit code che blocchi qualcosa: se il file manca, si dice che manca
e la sessione prosegue identica.

Uso:
    python docs/kb/tools/rendiconto_chiusure.py            # leggibile
    python docs/kb/tools/rendiconto_chiusure.py --boot     # 1-3 righe per la dashboard
"""
import io
import json
import os
import sys

# QUATTRO dirname, non tre: il file sta in docs/kb/tools/. Lo stesso errore l'ho appena
# fatto in `build_derivati.py`, dove si fermava su `docs/` e faceva dichiarare «assente»
# ogni generatore. Qui produceva un innocuo «nessuna chiusura registrata» su un diario
# che ne aveva 269 — cioe' un silenzio, che e' il modo peggiore di sbagliare.
REPO = os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.abspath(__file__)))))
DIARIO = os.environ.get("HEURESYS_CLOSE_LOG") or os.path.join(
    REPO, ".handoff", "close-log.ndjson")

# Una CHIUSURA vera porta con se' la propagazione. Le corse da un passo solo sono altro:
# un armamento a mano, un deploy chiesto a comando, una batteria di prove che ha toccato
# uno script che scrive nel diario. Contarle come chiusure falserebbe proprio il numero
# che `#217` vuole veder scendere.
PASSO_CHE_FA_UNA_CHIUSURA = "propaga"
SERENI = ("eseguito", "saltato")


def _righe():
    try:
        with io.open(DIARIO, encoding="utf-8") as fh:
            for l in fh:
                l = l.strip()
                if not l:
                    continue
                try:
                    yield json.loads(l)
                except ValueError:
                    continue
    except OSError:
        return


def ultima_chiusura():
    """(corsa, [record]) dell'ultima chiusura vera, o (None, []) se non ce n'e'."""
    per_corsa = {}
    for r in _righe():
        per_corsa.setdefault(r.get("run") or "?", []).append(r)
    chiusure = [(c, rr) for c, rr in per_corsa.items()
                if any(x.get("step") == PASSO_CHE_FA_UNA_CHIUSURA for x in rr)]
    if not chiusure:
        return None, []
    # l'ultima in ordine di tempo, letto dai record e non dal nome della corsa
    corsa, rr = max(chiusure, key=lambda t: max(x.get("ts", "") for x in t[1]))
    return corsa, sorted(rr, key=lambda x: x.get("ts", ""))


def righe_boot():
    corsa, rr = ultima_chiusura()
    if corsa is None:
        return [("UNK", "rendiconto: nessuna chiusura registrata (.handoff/close-log.ndjson)")]
    sess = next((x.get("session") for x in rr if x.get("session")), "S?")
    quando = (rr[-1].get("ts") or "")[:16].replace("T", " ")
    guasti = [x for x in rr if x.get("outcome") not in SERENI]
    out = []
    if guasti:
        elenco = ", ".join(sorted({f"{x.get('step')}:{x.get('outcome')}" for x in guasti}))
        out.append(("BAD", f"ultima chiusura {sess} ({quando}): {len(rr)} passi · "
                           f"{len(guasti)} non sereni — {elenco}"))
    else:
        out.append(("OK", f"ultima chiusura {sess} ({quando}): {len(rr)} passi, tutti sereni"))
    return out


def main() -> int:
    corsa, rr = ultima_chiusura()
    if corsa is None:
        print("nessuna chiusura registrata in .handoff/close-log.ndjson")
        return 0
    sess = next((x.get("session") for x in rr if x.get("session")), "S?")
    print(f"ULTIMA CHIUSURA — {sess} · corsa {corsa} · {len(rr)} passi")
    for x in rr:
        segno = " " if x.get("outcome") in SERENI else "!"
        print(f"  {segno} {(x.get('ts') or '')[11:16]}  {x.get('step',''):<16}"
              f"{x.get('outcome',''):<12}{(x.get('why') or '')[:70]}")
    guasti = [x for x in rr if x.get("outcome") not in SERENI]
    print(f"\n  non sereni: {len(guasti)} su {len(rr)}")
    print("  (rendiconto, non stato: nessuna decisione dipende da questo file)")
    return 0


if __name__ == "__main__":
    if "--boot" in sys.argv:
        for stato, testo in righe_boot():
            print(f"{stato}\t{testo}")
        sys.exit(0)
    sys.exit(main())
