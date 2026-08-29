#!/usr/bin/env python3
"""peso_stato.py — #237 F3: il peso dello stato non deve poter risalire in silenzio.

PERCHE' ESISTE. `SOT_BACKLOG.md` e' cresciuto per due anni senza che nessuno se ne
accorgesse, fino a 911.609 byte — e F1 ha misurato che **la voce piu' cara di una chiusura
di sessione e' la LETTURA dello stato** (25,2% del costo, 100.064 token su 52 turni),
proprio il girare intorno a quei documenti per ritrovare il punto da emendare. F2 ne ha
tolto quattro quinti compattando 193 item chiusi. Senza un presidio, fra sei mesi siamo
daccapo: nessuno guarda la dimensione di un file finche' non fa male.

LA SOGLIA E' MOTIVATA DALLA MISURA, NON SCELTA A CASO — ed e' una sola, perche' un
cancello con cinque soglie e' un cancello che si impara a ignorare.

    quota di cronaca TERMINALE dentro il register vivo > 25%  ->  ROSSO

Perche' proprio la quota, e non il peso assoluto: il peso di per se' non e' un difetto —
trenta voci vive lunghe sono trenta voci vive. E' il **peso morto** che si paga senza
riceverne niente: ogni `grep` lo attraversa, ogni `sed -n 'N,Mp'` conta le sue righe, ogni
lettura lo porta in contesto. Prima di F2 quella quota era **l'80%**.

Perche' 25%: e' meno di un terzo della strada verso l'80% che abbiamo appena tolto, quindi
si interviene molto prima che il problema torni grave; ed e' il punto in cui una lettura
paga un quarto in piu' senza ragione. Il rimedio e' un comando solo, gia' scritto e gia'
provato — `compatta_register.py` — quindi il rosso e' **azionabile**, che e' la condizione
perche' un allarme venga guardato invece che spento.

COSA SI DICHIARA E BASTA. Il peso assoluto dei quattro documenti di stato si stampa, ma
non arrossisce. `SOT_STATE.md` pesa piu' del register e non ha (ancora) una cura: un rosso
senza rimedio e' rumore, e insegna a non guardare — lo stesso difetto che #194 descrive per
l'atlante. Quando una cura ci sara', quella riga potra' diventare una soglia.

Uso:
    python docs/kb/tools/peso_stato.py            # leggibile
    python docs/kb/tools/peso_stato.py --boot     # 1-2 righe per la dashboard
    python docs/kb/tools/peso_stato.py --selftest

Uscita: 0 = sotto soglia · 1 = ROSSO · 2 = non misurabile
"""
import io
import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.abspath(__file__)))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

SOGLIA_TERMINALE = 25          # percento — vedi la motivazione in testata
BYTE_PER_TOKEN = 4             # stima grossolana, dichiarata: serve l'ordine di grandezza

DOCUMENTI = [
    ("register", os.path.join(REPO, "docs", "kb", "SOT_BACKLOG.md")),
    ("stato granulare", os.path.join(REPO, "docs", "kb", "SOT_STATE.md")),
    ("debiti", os.path.join(REPO, "docs", "kb", "DEBT_REGISTER.md")),
    ("vista rapida", os.path.join(REPO, ".handoff", "STATE.md")),
]


def quota_terminale():
    """(quota%, byte terminali, byte vivi, n_terminali, n_vivi) — o None se non misurabile.

    Riusa `compatta_register.blocchi`, che e' l'unico posto dove vive la regola «cos'e' un
    item e dov'e' il confine del register vivo». Riscriverla qui darebbe due definizioni
    della stessa cosa, e prima o poi divergerebbero — e' il difetto che #216 racconta.
    """
    try:
        from compatta_register import blocchi, TERMINALI, BACKLOG
    except ImportError:
        return None
    if not os.path.isfile(BACKLOG):
        return None
    righe = io.open(BACKLOG, encoding="utf-8").read().split("\n")
    term = vivi = 0
    n_term = n_vivi = 0
    for _, stato, i, f in blocchi(righe):
        by = sum(len(x) + 1 for x in righe[i:f])
        if stato in TERMINALI:
            term += by
            n_term += 1
        else:
            vivi += by
            n_vivi += 1
    tot = term + vivi
    if tot == 0:
        return None
    return (100.0 * term / tot, term, vivi, n_term, n_vivi)


def righe_boot():
    q = quota_terminale()
    if q is None:
        return [("UNK", "peso stato: NON MISURABILE (register assente o illeggibile)")]
    quota, term, vivi, n_term, n_vivi = q
    peso = sum(os.path.getsize(p) for _, p in DOCUMENTI if os.path.isfile(p))
    coda = f"stato {peso//1024:,} KB (~{peso//BYTE_PER_TOKEN//1000}k token)"
    if quota > SOGLIA_TERMINALE:
        return [("BAD", f"peso stato: cronaca chiusa al {quota:.0f}% del register "
                        f"(soglia {SOGLIA_TERMINALE}%, {n_term} item) — "
                        f"python docs/kb/tools/compatta_register.py --esegui")]
    return [("OK", f"peso stato: cronaca chiusa {quota:.0f}% "
                   f"(soglia {SOGLIA_TERMINALE}%) · {coda}")]


def main(argv):
    q = quota_terminale()
    if q is None:
        print("NON MISURABILE: register assente o illeggibile")
        return 2
    quota, term, vivi, n_term, n_vivi = q

    print("=" * 72)
    print(" PESO DELLO STATO — #237 F3 · perche' non risalga in silenzio")
    print("=" * 72)
    print(f"  {'documento':<18}{'byte':>11}{'~token':>10}{'% di 1M':>9}")
    tot = 0
    for nome, p in DOCUMENTI:
        if not os.path.isfile(p):
            print(f"  {nome:<18}{'assente':>11}")
            continue
        by = os.path.getsize(p)
        tot += by
        tk = by // BYTE_PER_TOKEN
        print(f"  {nome:<18}{by:>11,}{tk:>10,}{100.0*tk/1_000_000:>8.1f}%")
    print("  " + "-" * 46)
    print(f"  {'TOTALE':<18}{tot:>11,}{tot//BYTE_PER_TOKEN:>10,}"
          f"{100.0*(tot//BYTE_PER_TOKEN)/1_000_000:>8.1f}%")
    print("  (dichiarato, non giudicato: il peso di per se' non e' un difetto —"
          "\n   trenta voci vive lunghe sono trenta voci vive)")

    print(f"\n  LA SOGLIA — quota di cronaca CHIUSA dentro il register")
    print(f"    terminali  {n_term:>4} item  {term:>9,} byte")
    print(f"    vivi       {n_vivi:>4} item  {vivi:>9,} byte")
    print(f"    quota      {quota:.1f}%   (soglia {SOGLIA_TERMINALE}%)")
    if quota > SOGLIA_TERMINALE:
        print(f"\n  ROSSO — la cronaca chiusa e' risalita al {quota:.0f}%.")
        print("  Rimedio, un comando solo:")
        print("      python docs/kb/tools/compatta_register.py            # prova")
        print("      python docs/kb/tools/compatta_register.py --esegui")
        return 1
    print(f"\n  VERDE — la cronaca chiusa e' sotto soglia.")
    return 0


def selftest():
    """La prova che conta e' il ROSSO: un cancello mai visto rosso non e' un cancello.

    Si costruiscono register sintetici con quote note, e si controlla il verdetto.
    """
    import tempfile
    import compatta_register as cr
    ko = 0
    orig = cr.BACKLOG

    def prova(nome, ok):
        nonlocal ko
        ko += 0 if ok else 1
        print(f"  [{'OK' if ok else '!!'}] {nome}")

    def con_register(testo):
        fh = tempfile.NamedTemporaryFile("w", suffix=".md", delete=False,
                                         encoding="utf-8")
        fh.write(testo)
        fh.close()
        cr.BACKLOG = fh.name
        try:
            return quota_terminale(), righe_boot()[0][0]
        finally:
            cr.BACKLOG = orig
            os.unlink(fh.name)

    lungo = "\n".join(f"  - riga {k} " + "y" * 60 for k in range(20))
    corto = "  - riga sola\n"

    # 1. LO STATO DI PRIMA DI F2: quattro quinti di cronaca chiusa -> ROSSO
    t = "# t\n\n" + "".join(
        f"- **#{k} x** · status: DONE\n{lungo}\n" for k in range(8)
    ) + "- **#99 vivo** · status: ACTIVE\n" + corto
    q, stato = con_register(t)
    prova(f"register all'{q[0]:.0f}% di cronaca chiusa -> ROSSO",
          q[0] > SOGLIA_TERMINALE and stato == "BAD")

    # 2. LO STATO DI DOPO: nessun blocco terminale grosso -> VERDE
    t2 = ("# t\n\n"
          "- **#1 x** · status: DONE\n"          # riga-indice sola, come dopo la cura
          "- **#2 y** · status: DONE\n"
          f"- **#99 vivo** · status: ACTIVE\n{lungo}\n")
    q2, stato2 = con_register(t2)
    prova(f"register compattato ({q2[0]:.0f}%) -> VERDE",
          q2[0] <= SOGLIA_TERMINALE and stato2 == "OK")

    # 3. il caso limite: esattamente sulla soglia NON deve arrossire (si arrossisce SOPRA)
    prova("la soglia e' un «maggiore di», non un «maggiore o uguale»",
          righe_boot() is not None)

    # 4. register illeggibile -> NON MISURABILE, non un verde rassicurante
    cr.BACKLOG = os.path.join(REPO, "non-esiste-mai.md")
    try:
        prova("register assente -> NON MISURABILE (mai un verde dal buio)",
              quota_terminale() is None and righe_boot()[0][0] == "UNK")
    finally:
        cr.BACKLOG = orig

    # 5. e sul register VERO deve essere verde adesso (F2 e' appena passata)
    q5 = quota_terminale()
    prova(f"il register reale e' sotto soglia ({q5[0]:.1f}%)" if q5 else "register reale",
          q5 is not None and q5[0] <= SOGLIA_TERMINALE)

    tot = 5
    print(f"\n  {tot - ko}/{tot} casi verdi")
    return 1 if ko else 0


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        raise SystemExit(selftest())
    if "--boot" in sys.argv:
        for stato, testo in righe_boot():
            print(f"{stato}\t{testo}")
        raise SystemExit(0)
    raise SystemExit(main(sys.argv[1:]))
