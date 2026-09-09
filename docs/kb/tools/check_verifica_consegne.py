#!/usr/bin/env python3
"""
check_verifica_consegne.py — il presidio `#149` diventa misurabile a macchina.

LA REGOLA (Enzo, 2026-08-06): «ogni consegna del lab va trattata come NON VERIFICATA,
incluse quelle gia' ingerite». L'ingestione non e' una verifica.

PERCHE' SERVIVA UNO STRUMENTO, misurato in S1094:

  ① IL SECONDO RAMO DELL'INNESCO NON ERA MAI STATO MISURATO. `#149` F4 si attiva su
    «la prossima consegna che arriva, **o la prossima ingerita che qualcuno cita**».
    Cinque sessioni (S1077, S1083, S1087, S1091, S1092) hanno dichiarato «nessun
    bersaglio» dopo aver guardato la sola inbox. In S1094 stavo per farlo la sesta:
    l'inbox era vuota, e me ne sono accorto solo leggendo un file. Un innesco che
    dipende da chi si ricorda di guardare non e' un presidio.

  ② IL MARKER NON ESISTE, ESISTONO FRASI. Cercando le grafie canoniche su 64 consegne
    ingerite: ZERO riscontri. Le forme reali sono prosa — `VERIFICATO-leggendo-il-file`,
    `voci-VERIFICATE-PULITE`, `verificate-una-SECONDA-volta` — dentro nomi di file e
    paragrafi. Nessuno strumento puo' cercarle, quindi nessuno le cercava.

  ③ UN MARKER CHE CONGELA UNA MISURA INVECCHIA CON LEI. La riga 54 di `SOT_BACKLOG.md`
    portava «`sys` ha 225 tabelle (confermato)» e «`sys_research_sources` NON esiste
    (confermato)» come stato di fatto: oggi sono 240 e la tabella esiste con 5 righe.
    Il marker diceva «verificata» e i numeri erano di un mese prima. Per questo il
    marker canonico pretende DATA e SESSIONE: dice quando si e' guardato, non che si
    e' guardato per sempre. (⭐ IL PUNTO FISSO, applicato a un marker di verifica.)

IL MARKER CANONICO — una riga, una grafia, nel documento della consegna:

    > **#149 verifica avversariale** · esito: CONFERMATO · sessione: S1094 · data: 2026-09-09

`esito` sta in {CONFERMATO, SMENTITO, PARZIALE, NON-VERIFICATO}. `NON-VERIFICATO` e' un
esito legittimo e dichiarato: «non ho potuto guardare» non e' «va bene», ed e' meglio di
un documento muto.

COSA CONTROLLA. I documenti del design-lab **citati dal register** come fonte: sono il
secondo ramo dell'innesco, e sono quelli su cui qualcuno decide. Esce 1 se uno di loro
non porta il marker.

    python docs/kb/tools/check_verifica_consegne.py
    python docs/kb/tools/check_verifica_consegne.py --elenco
    python docs/kb/tools/check_verifica_consegne.py --selftest
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
REGISTER = REPO / "docs" / "kb" / "SOT_BACKLOG.md"
LAB = REPO.parent / "heuresys-design-lab"

for _f in (sys.stdout, sys.stderr):
    try:
        _f.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
    except (AttributeError, ValueError):
        pass

ESITI = {"CONFERMATO", "SMENTITO", "PARZIALE", "NON-VERIFICATO"}

# UNA grafia sola, ed e' il punto: `\s+` fra i campi tollera la formattazione, ma i nomi
# dei campi e l'ordine no. Data e sessione sono OBBLIGATORIE — senza, il marker
# tornerebbe a essere l'affermazione senza tempo che ha prodotto il difetto ③.
RE_MARKER = re.compile(
    r">\s*\*\*#149 verifica avversariale\*\*\s*·\s*"
    r"esito:\s*(?P<esito>[A-Z-]+)\s*·\s*"
    r"sessione:\s*(?P<sessione>S\d+)\s*·\s*"
    r"data:\s*(?P<data>20\d{2}-\d{2}-\d{2})",
    re.I,
)

# Un nome di consegna del lab: `2026-08-16-un-titolo-a-trattini`. E' la forma che il
# design-lab usa da sempre, e il register li nomina cosi'.
RE_CONSEGNA = re.compile(r"\b(20\d{2}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]{4,})\b")


def consegne_citate() -> list[str]:
    """I nomi di consegna che il REGISTER nomina — il secondo ramo dell'innesco."""
    if not REGISTER.exists():
        return []
    testo = REGISTER.read_text(encoding="utf-8", errors="replace")
    return sorted(set(RE_CONSEGNA.findall(testo)))


def trova_documento(nome: str) -> Path | None:
    """Il file della consegna, ovunque stia nel lab (inbox, ingerite, dossier)."""
    if not LAB.exists():
        return None
    for p in LAB.rglob(f"{nome}*"):
        if p.is_file() and p.suffix.lower() in {".md", ".txt"}:
            return p
    return None


def marker_di(p: Path) -> dict[str, str] | None:
    m = RE_MARKER.search(p.read_text(encoding="utf-8", errors="replace"))
    if not m:
        return None
    d = m.groupdict()
    return d if d["esito"].upper() in ESITI else None


def controlla() -> tuple[int, list[str]]:
    """(uscita, righe). 0 = ogni consegna citata porta il suo marker."""
    righe: list[str] = []
    nomi = consegne_citate()

    if not LAB.exists():
        righe.append(f"  [? ] design-lab NON RAGGIUNGIBILE ({LAB})")
        righe.append("       NON MISURATO — e «non ho potuto guardare» non e' «non c'e' niente».")
        return 2, righe

    if not nomi:
        righe.append("  [OK] il register non cita alcuna consegna del lab: niente da verificare")
        return 0, righe

    senza: list[str] = []
    assenti: list[str] = []
    con: list[tuple[str, dict[str, str]]] = []
    for n in nomi:
        p = trova_documento(n)
        if p is None:
            assenti.append(n)
            continue
        mk = marker_di(p)
        if mk is None:
            senza.append(n)
        else:
            con.append((n, mk))

    for n, mk in con:
        righe.append(f"  [OK] {n}\n         esito {mk['esito'].upper()} · {mk['sessione']} · {mk['data']}")
    for n in assenti:
        righe.append(f"  [? ] {n} — citato dal register ma NON TROVATO nel lab")
    for n in senza:
        righe.append(f"  [!!] {n} — citato dal register, SENZA marker di verifica")

    if senza:
        righe.append("")
        righe.append(f"  {len(senza)} consegne citate non portano il marker. La regola di `#149`:")
        righe.append("  una consegna vale NON VERIFICATA finche' non la si misura, e l'ingestione")
        righe.append("  non e' una verifica. Aggiungi al documento, dopo averlo verificato:")
        righe.append("")
        righe.append("    > **#149 verifica avversariale** · esito: CONFERMATO · sessione: Sxxxx · data: AAAA-MM-GG")
        righe.append("")
        righe.append(f"  esiti ammessi: {', '.join(sorted(ESITI))} — «NON-VERIFICATO» e' un esito,")
        righe.append("  ed e' meglio di un documento muto.")
        return 1, righe

    if assenti:
        return 2, righe
    return 0, righe


# --- selftest: la prova deve poter fallire ----------------------------------
def selftest() -> int:
    """Casi positivi E negativi, piu' la controprova che il matcher discrimini."""
    errori: list[str] = []

    buono = "> **#149 verifica avversariale** · esito: CONFERMATO · sessione: S1094 · data: 2026-09-09"
    if not RE_MARKER.search(buono):
        errori.append("positivo: il marker canonico non viene riconosciuto")

    # negativi — ognuno manca di UNA cosa, e ognuna e' obbligatoria per una ragione
    negativi = {
        "senza data (il difetto ③: un marker senza tempo invecchia in silenzio)":
            "> **#149 verifica avversariale** · esito: CONFERMATO · sessione: S1094",
        "senza sessione (non si sa chi lo ha guardato)":
            "> **#149 verifica avversariale** · esito: CONFERMATO · data: 2026-09-09",
        "prosa libera (e' la grafia che oggi esiste, e non e' cercabile)":
            "Verificato leggendo il file, tutto confermato",
        "grafia vicina ma diversa (un marker con due grafie non e' un marker)":
            "> **#149 verifica** · esito: CONFERMATO · sessione: S1094 · data: 2026-09-09",
    }
    for perche, testo in negativi.items():
        if RE_MARKER.search(testo):
            errori.append(f"negativo accettato — {perche}")

    # un esito fuori vocabolario non passa
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        f = Path(d) / "x.md"
        f.write_text("> **#149 verifica avversariale** · esito: BOH · sessione: S1 · data: 2026-01-01",
                     encoding="utf-8")
        if marker_di(f) is not None:
            errori.append("negativo accettato — esito fuori dal vocabolario")
        f.write_text(buono, encoding="utf-8")
        if marker_di(f) is None:
            errori.append("positivo: un file col marker buono non viene letto")

    # il censimento sa distinguere un nome di consegna da un testo qualunque
    if not RE_CONSEGNA.findall("vedi 2026-08-16-un-punto-di-ingresso-unico"):
        errori.append("censimento: non riconosce un nome di consegna")
    if RE_CONSEGNA.findall("il 2026-08-16 abbiamo deciso"):
        errori.append("censimento: scambia una data nuda per una consegna")

    if errori:
        print("SELFTEST check_verifica_consegne — ROSSO")
        for e in errori:
            print(f"  x {e}")
        return 1
    print(f"SELFTEST check_verifica_consegne — verde "
          f"({1 + len(negativi) + 4} casi, positivi e negativi, "
          f"piu' la controprova che il censimento discrimini)")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--elenco", action="store_true",
                    help="stampa le consegne citate dal register e dove stanno")
    ap.add_argument("--selftest", action="store_true", help="prova lo strumento su casi noti")
    a = ap.parse_args()

    if a.selftest:
        return selftest()

    if a.elenco:
        for n in consegne_citate():
            p = trova_documento(n)
            print(f"{n}\n    {p if p else '(non trovata nel lab)'}")
        return 0

    print("=" * 78)
    print(" #149 — le consegne del lab CITATE DAL REGISTER portano il loro esito?")
    print("=" * 78)
    codice, righe = controlla()
    for r in righe:
        print(r)
    print("-" * 78)
    print({0: " VERDE — ogni consegna citata porta il suo marker",
           1: " ROSSO — una consegna citata non e' stata verificata",
           2: " NON MISURATO — non ho potuto guardare, e non e' la stessa cosa di «a posto»",
           }[codice])
    return codice


if __name__ == "__main__":
    sys.exit(main())
