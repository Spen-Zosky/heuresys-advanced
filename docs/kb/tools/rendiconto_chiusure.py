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


def _riparazioni():
    """Per ogni passo, il ts piu' recente in cui e' stato eseguito con esito sereno.

    NASCE DA UN ROSSO REALE (S1084, 2026-08-29). La chiusura di S1083 registro'
    `marciume:fallito` alle 23:22; alle 23:29 la stessa sessione riparo' il guasto e
    ne lascio' traccia nel diario. Il boot del giorno dopo mostrava comunque il rosso,
    perche' `ultima_chiusura()` guarda **una sola corsa** e la riparazione era in
    un'altra. Un allarme che resta acceso su un guasto gia' chiuso insegna a non
    guardarlo — e' il difetto che `#194` descrive per l'atlante.

    LA REGOLA E' MECCANICA, non un'euristica: un guasto e' riparato se, PIU' TARDI nel
    diario, lo **stesso passo** porta un esito sereno. Nient'altro conta come
    riparazione — in particolare non una riga di prosa su un altro passo, che sarebbe
    una parola e non una misura. Chi ripara registra col verbo del passo che ha
    riparato, e questo lo rende leggibile.

    ⚠ Non puo' mascherare un guasto aperto: senza una ri-esecuzione serena successiva
    il rosso resta rosso. E' il caso limite provato dal `--selftest`.
    """
    ultimo = {}
    for r in _righe():
        if r.get("outcome") in SERENI:
            passo = r.get("step") or "?"
            ts = r.get("ts") or ""
            if ts > ultimo.get(passo, ""):
                ultimo[passo] = ts
    return ultimo


def guasti_di(rr):
    """(aperti, riparati) fra i passi non sereni della corsa `rr`."""
    rip = _riparazioni()
    aperti, riparati = [], []
    for x in rr:
        if x.get("outcome") in SERENI:
            continue
        (riparati if rip.get(x.get("step") or "?", "") > (x.get("ts") or "")
         else aperti).append(x)
    return aperti, riparati


def righe_boot():
    corsa, rr = ultima_chiusura()
    if corsa is None:
        return [("UNK", "rendiconto: nessuna chiusura registrata (.handoff/close-log.ndjson)")]
    sess = next((x.get("session") for x in rr if x.get("session")), "S?")
    quando = (rr[-1].get("ts") or "")[:16].replace("T", " ")
    aperti, riparati = guasti_di(rr)
    coda = f" · {len(riparati)} riparati dopo" if riparati else ""
    out = []
    if aperti:
        elenco = ", ".join(sorted({f"{x.get('step')}:{x.get('outcome')}" for x in aperti}))
        out.append(("BAD", f"ultima chiusura {sess} ({quando}): {len(rr)} passi · "
                           f"{len(aperti)} non sereni — {elenco}{coda}"))
    else:
        out.append(("OK", f"ultima chiusura {sess} ({quando}): {len(rr)} passi, "
                          f"tutti sereni{coda}"))
    return out


def main() -> int:
    corsa, rr = ultima_chiusura()
    if corsa is None:
        print("nessuna chiusura registrata in .handoff/close-log.ndjson")
        return 0
    sess = next((x.get("session") for x in rr if x.get("session")), "S?")
    aperti, riparati = guasti_di(rr)
    id_rip = {id(x) for x in riparati}
    print(f"ULTIMA CHIUSURA — {sess} · corsa {corsa} · {len(rr)} passi")
    for x in rr:
        segno = " " if x.get("outcome") in SERENI else ("~" if id(x) in id_rip else "!")
        print(f"  {segno} {(x.get('ts') or '')[11:16]}  {x.get('step',''):<16}"
              f"{x.get('outcome',''):<12}{(x.get('why') or '')[:70]}")
    print(f"\n  non sereni APERTI: {len(aperti)} su {len(rr)}"
          + (f" · riparati dopo (~): {len(riparati)}" if riparati else ""))
    print("  (rendiconto, non stato: nessuna decisione dipende da questo file)")
    return 0


def selftest() -> int:
    """Le prove devono poter fallire: il caso che conta e' il guasto MAI riparato.

    Un controllo che dichiara «riparato» anche senza la ri-esecuzione serena sarebbe
    verde qui sotto e inutile nella realta'.
    """
    import tempfile
    casi = [
        # (righe, aperti attesi, riparati attesi, nome)
        ([("propaga", "eseguito", "10:00"), ("marciume", "fallito", "10:05")],
         1, 0, "guasto MAI riparato -> resta APERTO"),
        ([("propaga", "eseguito", "10:00"), ("marciume", "fallito", "10:05"),
          ("marciume", "eseguito", "10:09")],
         0, 1, "stesso passo, sereno DOPO -> riparato"),
        ([("propaga", "eseguito", "10:00"), ("marciume", "fallito", "10:05"),
          ("verifica", "eseguito", "10:09")],
         1, 0, "un ALTRO passo sereno non ripara"),
        ([("propaga", "eseguito", "10:00"), ("marciume", "eseguito", "09:00"),
          ("marciume", "fallito", "10:05")],
         1, 0, "sereno PRIMA del guasto non ripara"),
        ([("propaga", "eseguito", "10:00"), ("clone-db", "ignoto", "10:05"),
          ("clone-db", "saltato", "10:20")],
         0, 1, "«saltato» e' sereno e ripara un «ignoto»"),
    ]
    ko = 0
    for righe, att_ap, att_rip, nome in casi:
        fh = tempfile.NamedTemporaryFile("w", suffix=".ndjson", delete=False,
                                         encoding="utf-8")
        for passo, esito, hhmm in righe:
            fh.write(json.dumps({"ts": f"2026-08-29T{hhmm}:00+0200", "run": "X",
                                 "session": "S1", "step": passo,
                                 "outcome": esito, "why": "test"}) + "\n")
        fh.close()
        globals()["DIARIO"] = fh.name
        _, rr = ultima_chiusura()
        ap, rip = guasti_di(rr)
        ok = (len(ap) == att_ap and len(rip) == att_rip)
        ko += 0 if ok else 1
        print(f"  [{'OK' if ok else '!!'}] {nome} "
              f"(aperti {len(ap)}/{att_ap} · riparati {len(rip)}/{att_rip})")
        os.unlink(fh.name)
    print(f"\n  {len(casi) - ko}/{len(casi)} casi verdi")
    return 1 if ko else 0


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        raise SystemExit(selftest())
    if "--boot" in sys.argv:
        for stato, testo in righe_boot():
            print(f"{stato}\t{testo}")
        sys.exit(0)
    sys.exit(main())
