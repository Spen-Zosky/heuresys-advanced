#!/usr/bin/env python3
"""atlante_fresco.py — l'atlante e' ancora vero? Una parola sola, per chi non e' python.

#217 I5. `scripts/profilo-chiusura.sh` deve sapere se rigenerare l'atlante, ma la misura
canonica vive dentro `status_dashboard.atlas_freshness()` — e uno script bash non puo'
chiamarla. Le alternative erano due, entrambe peggiori: ricopiare la regola dei sorgenti
in bash (una seconda definizione che divergera'), oppure dedurre il passo dai path di
deploy — che e' esattamente cio' che la prima stesura faceva e che la prima esecuzione ha
smentito, stampando «la finestra tocca sorgenti che l'atlante descrive» per una finestra
che toccava solo `scripts/`.

Qui non c'e' nessuna regola nuova: si chiama quella che esiste e se ne traduce l'esito.

Stampa una parola su stdout, ed e' anche il codice d'uscita:
    fresco    (0) — nessun file descritto dall'atlante e' cambiato dopo la sua generazione
    vecchio   (1) — ne e' cambiato almeno uno: va rigenerato
    indeciso  (2) — non misurabile (atlante assente, git muto). Chi chiama rigenera:
                    si degrada verso il lavoro in piu', mai verso il silenzio.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def main() -> int:
    try:
        import status_dashboard as sd
    except Exception:
        print("indeciso")
        return 2
    try:
        stato, _msg = sd.atlas_freshness()
    except Exception:
        print("indeciso")
        return 2
    if stato == sd.OK:
        print("fresco")
        return 0
    if stato == sd.UNK:
        print("indeciso")
        return 2
    print("vecchio")
    return 1


if __name__ == "__main__":
    sys.exit(main())
