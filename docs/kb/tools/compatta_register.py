#!/usr/bin/env python3
"""compatta_register.py — #237 F2: il register porta 193 cronache di lavori gia' chiusi.

LA MISURA CHE HA FATTO NASCERE QUESTO STRUMENTO (F1, 2026-08-29). Ripartendo il costo di
14 chiusure di sessione, la voce piu' cara e' la **lettura dello stato**: 25,2% del totale,
100.064 token su 52 turni. Non la scrittura — la lettura. Sono `cat .handoff/STATE.md`,
`head docs/kb/SOT_STATE.md`, `sed -n '971,985p' docs/kb/SOT_BACKLOG.md`, `grep -n '^### #…'`:
il girare intorno a un documento grande per ritrovare il punto da emendare.

E il documento e' grande per una ragione precisa, misurata prima di toccarlo:

    register vivo   773.048 byte   223 item
      DONE          592.211 byte   185 item   76%
      FATTO          18.432 byte     3 item    2%
      WON'T-DO       14.185 byte     5 item    1%
      -------------------------------------------
      TERMINALI     610.643 byte   193 item   78%     <- cronaca di lavoro gia' chiuso
      vivi          162.405 byte    30 item   22%

**Il 78% del register e' memoria di cose finite.** Ogni `grep` la attraversa, ogni `sed`
conta le sue righe, ogni lettura la porta in contesto.

COSA FA — COMPATTA, NON CANCELLA. Ogni blocco terminale va per intero in
`docs/archive/SOT_BACKLOG_CHIUSI.md`, e al suo posto nel register resta **la sua prima
riga**, quella che porta id, titolo e status, piu' un puntatore all'archivio. Percio':

  · nulla si perde — l'archivio ha il testo integrale, e `docs/archive/` e' esattamente il
    posto che il CLAUDE.md indica per i record storici («non sono SoT»);
  · `handoff_lint.py` continua a passare — il controllo A2 chiede che un id dichiarato
    chiuso in STATE sia **terminale nel backlog**, e la riga-indice porta ancora
    `· status: DONE`. Cio' che il lint cerca resta dov'era;
  · chi cerca la cronaca la trova, in un file che nessuna chiusura ha motivo di leggere.

⚠ NON E' UNA CANCELLAZIONE E NON E' UN RITIRO (ADR-0035): non si tocca nessun oggetto vivo,
si sposta del testo fra due file versionati. Il rollback e' `git checkout` dei due file, ed
e' dichiarato qui perche' la regola lo pretende — non perche' serva un giornale `_undo`:
git **e'** il giornale, e questo e' l'unico caso in cui basta.

LE QUATTRO COSE che una scrittura di massa deve portare (metodo di bonifica, regola 4):
  (a) la misura PRIMA          — stampata a ogni corsa, anche in prova
  (b) una GUARDIA al momento   — si ri-legge lo status di ogni blocco che si sta per
                                 spostare; un item tornato ACTIVE non si muove
  (c) una POST-CONDIZIONE che protegge cio' che NON doveva cambiare — i blocchi non
      terminali devono restare **identici byte per byte**, e nessun id puo' sparire
  (d) un ROLLBACK dichiarato   — `git checkout -- <i due file>`

Uso:
    python docs/kb/tools/compatta_register.py             # PROVA: misura e non scrive
    python docs/kb/tools/compatta_register.py --esegui    # scrive, dopo le post-condizioni
    python docs/kb/tools/compatta_register.py --selftest
"""
import io
import os
import re
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.abspath(__file__)))))
BACKLOG = os.path.join(REPO, "docs", "kb", "SOT_BACKLOG.md")
ARCHIVIO = os.path.join(REPO, "docs", "archive", "SOT_BACKLOG_CHIUSI.md")

# Il puntatore come appare NEL MARKDOWN — path relativo al repo, non di filesystem.
# Serve anche a riconoscerlo: e' la sentinella che rende idempotente l'appensione.
PUNTATORE = "↦ `docs/archive/SOT_BACKLOG_CHIUSI.md`"

TERMINALI = ("DONE", "FATTO", "WON'T-DO", "WON-T-DO", "WONT-DO")
INIZIO_ITEM = re.compile(r"^- \*\*#(\d+)")
STATUS = re.compile(r"status:\s*`?([A-Z'\-]+)")
# La fine del register vivo: la prima sezione di cronaca storica (## ✅ / ## 🟢).
FINE_VIVO = re.compile(r"^## (✅|🟢) ")


def _stato(riga):
    m = STATUS.search(riga)
    return m.group(1).upper() if m else "?"


def blocchi(righe):
    """(id, stato, inizio, fine) per ogni item del register VIVO, in ordine.

    Il confine del register vivo si legge dal documento, non si assume: sotto le sezioni
    di cronaca ci sono altre righe che cominciano con `- **#`, e trascinarle qui
    vorrebbe dire archiviare due volte lo stesso testo.
    """
    fine_vivo = next((i for i, r in enumerate(righe) if FINE_VIVO.match(r)), len(righe))
    inizi = [i for i in range(fine_vivo) if INIZIO_ITEM.match(righe[i])]
    out = []
    for j, i in enumerate(inizi):
        f = inizi[j + 1] if j + 1 < len(inizi) else fine_vivo
        out.append((INIZIO_ITEM.match(righe[i]).group(1), _stato(righe[i]), i, f))
    return out


def compatta(testo):
    """(register nuovo, testo archiviato, elenco archiviati, elenco tenuti).

    Non scrive niente: e' una funzione pura, cosi' il selftest puo' provarla su testi
    sintetici senza toccare il repo. Le prove che si fanno solo sul file vero sono prove
    che si eseguono una volta e poi non piu'.
    """
    righe = testo.split("\n")
    bb = blocchi(righe)
    archiviati, tenuti = [], []
    pezzi_arch = []
    out, cursore = [], 0

    for ident, stato, i, f in bb:
        if stato not in TERMINALI:
            tenuti.append(ident)
            continue
        out.extend(righe[cursore:i])
        # la riga-indice: la PRIMA riga del blocco, che gia' porta id, titolo e status,
        # piu' il puntatore. Non si riscrive il titolo: riscriverlo lo farebbe divergere.
        #
        # ⚠ IL PUNTATORE SI APPENDE UNA VOLTA SOLA. Fino a S1086 questa riga lo
        # appendeva SEMPRE, e una seconda corsa dello strumento su voci gia'
        # archiviate ne accodava un altro: misurato, 193 righe su 201 si sono
        # ritrovate «· ↦ path · ↦ path». Nessun cancello se ne accorgeva, perche'
        # la riga resta formalmente valida — sporca, ma valida.
        riga = righe[i].rstrip()
        if PUNTATORE not in riga:
            riga += f"  ·  {PUNTATORE}"
        out.append(riga)
        pezzi_arch.append("\n".join(righe[i:f]).rstrip())
        archiviati.append(ident)
        cursore = f
    out.extend(righe[cursore:])
    return "\n".join(out), "\n\n".join(pezzi_arch), archiviati, tenuti


def _blocco_di(testo, ident):
    """Il testo integrale del blocco `ident`, per confrontare prima e dopo."""
    righe = testo.split("\n")
    for i, stato, a, b in blocchi(righe):
        if i == ident:
            return "\n".join(righe[a:b])
    return None


def verifica(prima, dopo, arch, archiviati, tenuti):
    """Le post-condizioni. Ritorna la lista dei guasti: vuota = si puo' scrivere.

    ⚠ La piu' importante e' la SECONDA: protegge cio' che NON doveva cambiare. Un
    controllo che guardasse solo gli item spostati sarebbe verde anche se l'operazione
    avesse mangiato per sbaglio un item attivo — ed e' esattamente il guasto che
    nessuno si accorgerebbe di aver causato.
    """
    guasti = []

    # 1. nessun id sparito dal register
    ids_prima = {i for i, _, _, _ in blocchi(prima.split("\n"))}
    ids_dopo = {i for i, _, _, _ in blocchi(dopo.split("\n"))}
    persi = ids_prima - ids_dopo
    if persi:
        guasti.append(f"{len(persi)} id spariti dal register: {sorted(persi)[:8]}")

    # 2. ogni item NON terminale e' identico byte per byte
    diversi = [i for i in tenuti if _blocco_di(prima, i) != _blocco_di(dopo, i)]
    if diversi:
        guasti.append(f"{len(diversi)} item NON terminali sono cambiati: {diversi[:8]}")

    # 3. ogni item archiviato compare per intero nell'archivio
    #
    # ⚠ `.rstrip()` sui due lati, e la ragione l'ha trovata la post-condizione stessa alla
    # prima corsa vera: su 193 item, UNO (#224) risultava assente. Non era assente — e'
    # l'ultimo blocco terminale prima della fine del register vivo, quindi si porta
    # dietro una riga vuota che l'archivio toglie (`.rstrip()` in `compatta`). Una riga
    # vuota in fondo non e' contenuto, e confrontare il testo esatto qui non misurava la
    # perdita di dati: misurava la spaziatura. Il controllo resta severo su tutto il
    # resto — cambia una sola riga di codice, non la sua severita'.
    fuori = [i for i in archiviati
             if (_blocco_di(prima, i) or "!nessuno!").rstrip() not in arch]
    if fuori:
        guasti.append(f"{len(fuori)} item archiviati non si ritrovano nell'archivio: {fuori[:8]}")

    # 4. lo status terminale resta leggibile nel register (il lint A2 lo cerca li')
    righe_dopo = dopo.split("\n")
    senza = [i for i, s, _, _ in blocchi(righe_dopo)
             if i in archiviati and s not in TERMINALI]
    if senza:
        guasti.append(f"{len(senza)} righe-indice hanno perso lo status terminale: {senza[:8]}")

    # 5. il register deve essere piu' PICCOLO: se non lo e', l'operazione non serve a nulla
    if len(dopo) >= len(prima):
        guasti.append(f"il register non e' calato ({len(prima):,} -> {len(dopo):,})")
    return guasti


def main(argv):
    if not os.path.isfile(BACKLOG):
        print(f"NON MISURABILE: {BACKLOG} assente")
        return 2
    prima = io.open(BACKLOG, encoding="utf-8").read()
    bb = blocchi(prima.split("\n"))

    # ------------------------------------------------------------------ (a) la misura
    per_stato = {}
    righe = prima.split("\n")
    for ident, stato, i, f in bb:
        by = sum(len(x) + 1 for x in righe[i:f])
        v = per_stato.setdefault(stato, [0, 0])
        v[0] += 1
        v[1] += by
    tot = sum(v[1] for v in per_stato.values())
    print("=" * 74)
    print(" COMPATTAZIONE DEL REGISTER — #237 F2 · misura prima di toccare")
    print("=" * 74)
    print(f"  file      {len(prima):,} byte  (~{len(prima)//4:,} token)")
    print(f"  register  {tot:,} byte in {len(bb)} item\n")
    print(f"  {'status':<14}{'item':>6}{'byte':>11}{'~token':>10}{'quota':>7}")
    for stato, (n, by) in sorted(per_stato.items(), key=lambda kv: -kv[1][1]):
        segno = " ·" if stato in TERMINALI else "  "
        print(f" {segno}{stato:<13}{n:>6}{by:>11,}{by//4:>10,}{100*by//tot:>6}%")
    term = sum(by for s, (n, by) in per_stato.items() if s in TERMINALI)
    print(f"\n  TERMINALI: {term:,} byte = {100*term//tot}% del register"
          f"  (~{term//4:,} token di cronaca gia' chiusa)")

    dopo, arch, archiviati, tenuti = compatta(prima)
    print(f"\n  compattando: {len(archiviati)} item archiviati · {len(tenuti)} tenuti vivi")
    print(f"  register:    {len(prima):,} -> {len(dopo):,} byte "
          f"({100 - 100*len(dopo)//len(prima)}% in meno)")
    print(f"  archivio:    {len(arch):,} byte in docs/archive/SOT_BACKLOG_CHIUSI.md")

    # --------------------------------------------------- (b)+(c) guardia e postcondizioni
    guasti = verifica(prima, dopo, arch, archiviati, tenuti)
    print("\n  POST-CONDIZIONI")
    if guasti:
        for g in guasti:
            print(f"    [!!] {g}")
        print("\n  NON SCRIVO: una post-condizione e' rossa.")
        return 1
    print("    [OK] nessun id sparito dal register")
    print(f"    [OK] i {len(tenuti)} item non terminali sono identici byte per byte")
    print(f"    [OK] i {len(archiviati)} archiviati si ritrovano per intero nell'archivio")
    print("    [OK] le righe-indice conservano lo status terminale (lint A2)")
    print("    [OK] il register e' calato")

    if "--esegui" not in argv:
        print("\n  PROVA — non ho scritto niente. Per scrivere: --esegui")
        return 0

    os.makedirs(os.path.dirname(ARCHIVIO), exist_ok=True)
    testata = (
        "# SOT_BACKLOG — cronaca degli item chiusi (ARCHIVIO, non SoT)\n\n"
        "> Generato da `python docs/kb/tools/compatta_register.py --esegui` (#237 F2).\n"
        "> Qui sta il **testo integrale** dei blocchi terminali del register; in\n"
        "> `docs/kb/SOT_BACKLOG.md` ne resta la riga con id, titolo e status.\n"
        ">\n"
        "> ⚠ **Non e' una fonte di verita'.** `docs/archive/` non e' SoT (CLAUDE.md):\n"
        "> e' memoria di lavoro finito. Lo stato vivo sta nel register.\n\n"
        "---\n\n")
    io.open(ARCHIVIO, "a" if os.path.exists(ARCHIVIO) else "w",
            encoding="utf-8", newline="\n").write(
        (testata if not os.path.exists(ARCHIVIO) else "\n\n") + arch + "\n")
    io.open(BACKLOG, "w", encoding="utf-8", newline="\n").write(dopo)
    print(f"\n  SCRITTO. Rollback: git checkout -- docs/kb/SOT_BACKLOG.md"
          f" docs/archive/SOT_BACKLOG_CHIUSI.md")
    print("  Adesso: python docs/kb/tools/handoff_lint.py  e  build_menu.py")
    return 0


# --------------------------------------------------------------------------- selftest
def selftest():
    """Su testi sintetici: i numeri attesi sono noti, e i casi negativi contano di piu'."""
    ko = 0
    eseguiti = 0

    def prova(nome, ok):
        # ⚠ Il totale si CONTA, non si scrive: fino a S1086 era `tot = 11` a mano,
        # e stampava «11/11» anche quando i casi erano 13 — e avrebbe continuato a
        # stamparlo cancellandone uno. E' il punto fisso del progetto applicato allo
        # strumento stesso: un dato che puo' variare si misura.
        nonlocal ko, eseguiti
        eseguiti += 1
        ko += 0 if ok else 1
        print(f"  [{'OK' if ok else '!!'}] {nome}")

    # ⚠ I BLOCCHI DEL CASO DI PROVA SONO LUNGHI DI PROPOSITO. La prima stesura ne usava
    # da due righe, e la post-condizione «il register e' calato» usciva ROSSA sul caso
    # sano: la riga-indice aggiunge ~48 byte di puntatore, che su un blocco di due righe
    # pesano piu' di quanto si tolga. Non e' un difetto della post-condizione — e' vero
    # che compattare blocchi cortissimi PEGGIORA, ed e' giusto che si rifiuti di farlo.
    # Era il caso di prova a non somigliare al register reale, dove un blocco terminale
    # vale ~3.000 byte.
    corpo = "\n".join(f"  - riga {k} " + "x" * 60 for k in range(20))
    t = ("# testa\n\n"
         f"- **#1 uno** · status: DONE\n{corpo}\n"
         "- **#2 due** · status: ACTIVE\n  - viva a\n  - viva b\n"
         f"- **#3 tre** · status: WON'T-DO\n{corpo}\n"
         "## ✅ cronaca\n- **#9 storico** · status: DONE\n  - non toccare\n")
    dopo, arch, a, v = compatta(t)
    prova("archivia i terminali, tiene i vivi", a == ["1", "3"] and v == ["2"])
    prova("l'item ACTIVE resta intero",
          "- **#2 due** · status: ACTIVE\n  - viva a\n  - viva b" in dopo)
    prova("il blocco archiviato porta il puntatore",
          "- **#1 uno** · status: DONE  ·  ↦ `docs/archive/SOT_BACKLOG_CHIUSI.md`" in dopo)
    # ⚠ IL CASO CHE MI E' SFUGGITO, e che in S1086 ha sporcato 193 righe su 201:
    # una riga-indice che il puntatore ce l'ha GIA' non deve prenderne un secondo.
    # Non lo accendeva nessun cancello, perche' la riga resta formalmente valida.
    gia_indicizzato = (
        "# testa\n\n"
        f"- **#7 sette** · status: DONE  ·  {PUNTATORE}\n{corpo}\n")
    d_idem, _, _, _ = compatta(gia_indicizzato)
    prova("il puntatore non si duplica su una riga che ce l'ha gia'",
          d_idem.count(PUNTATORE) == 1)
    # e la prova deve poter fallire: senza puntatore, uno ce ne finisce eccome
    senza = "# testa\n\n" + f"- **#8 otto** · status: DONE\n{corpo}\n"
    d_senza, _, _, _ = compatta(senza)
    prova("...ma su una riga che non ce l'ha, il puntatore ci finisce",
          d_senza.count(PUNTATORE) == 1)
    prova("il corpo del terminale non e' piu' nel register", "- riga 7 " not in dopo)
    prova("il corpo del terminale E' nell'archivio", arch.count("- riga 7 ") == 2)
    # IL CASO CHE CONTA: cio' che sta sotto la cronaca storica non si tocca due volte
    prova("gli item SOTTO la cronaca storica restano dove sono",
          "- **#9 storico** · status: DONE\n  - non toccare" in dopo and "9" not in a)
    prova("le post-condizioni sono verdi sul caso sano",
          verifica(t, dopo, arch, a, v) == [])
    # e devono poter FALLIRE: un register manomesso deve accendere la post-condizione 2
    rotto = dopo.replace("  - viva b", "  - viva MANOMESSA")
    prova("un item vivo alterato accende la post-condizione",
          any("NON terminali sono cambiati" in g for g in verifica(t, rotto, arch, a, v)))
    # e la 5: nessun terminale = niente da compattare = register non calato
    solo_vivi = "# t\n\n- **#5 cinque** · status: ACTIVE\n  - x\n"
    d2, ar2, a2, v2 = compatta(solo_vivi)
    prova("nessun terminale => post-condizione «non e' calato» accesa",
          a2 == [] and any("non e' calato" in g for g in verifica(solo_vivi, d2, ar2, a2, v2)))
    # 10. il caso che la corsa vera ha scoperto: un blocco terminale che finisce con una
    #     riga vuota non deve risultare «perso». Ma la post-condizione deve restare capace
    #     di accorgersi di una perdita VERA (caso 11).
    t2 = ("# t\n\n"
          f"- **#7 sette** · status: DONE\n{corpo}\n\n"
          "- **#8 otto** · status: ACTIVE\n  - viva\n\n")
    d3, ar3, a3, v3 = compatta(t2)
    prova("un blocco che finisce con riga vuota NON risulta perso",
          verifica(t2, d3, ar3, a3, v3) == [])
    prova("ma un archivio MUTILATO viene ancora visto",
          any("non si ritrovano" in g
              for g in verifica(t2, d3, ar3.replace("riga 7 ", "TOLTO "), a3, v3)))

    print(f"\n  {eseguiti - ko}/{eseguiti} casi verdi")
    return 1 if ko else 0


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        raise SystemExit(selftest())
    raise SystemExit(main(sys.argv[1:]))
