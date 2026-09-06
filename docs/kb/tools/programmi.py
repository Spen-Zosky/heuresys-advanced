#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Programmi multi-sessione — lo stato di avanzamento vive su disco, non nella memoria.

PERCHE' ESISTE
--------------
Una voce del backlog che vale 2-8 sessioni non si chiude mai, perche' ogni sessione
che la apre deve prima ri-capire dove era arrivata la precedente. Il progetto ha gia'
risolto il problema due volte, per due programmi specifici — `.storia36/PROGRESS.md`
(13 cluster spuntabili) e `zp_state.py` (cursore + interrotto). Questo strumento
generalizza quella forma a QUALUNQUE voce multi-sessione, senza inventare una terza
convenzione: stessi ingredienti, stesso patto.

IL PATTO, in quattro punti
--------------------------
1. **Le decisioni gia' prese non si ri-chiedono.** Stanno in testa al file di programma.
   Una sessione nuova le legge, non le rinegozia.
2. **Una fase sta in UNA sessione.** Se non ci sta, va spezzata. Il budget dichiarato
   e' una promessa verificabile, non un augurio.
3. **Una spunta senza evidenza non e' una spunta.** `[x]` esige data + evidenza sulla
   stessa riga, e `--verifica` esce 1 se manca. E' la regola che impedisce a un
   programma di dichiararsi avanti mentre sta fermo.
4. **Interrompersi e' previsto, dimenticarsene no.** Una fase lasciata a meta' si marca
   `INTERROTTO` con il punto preciso; da li' riprende la sessione dopo.

USO
---
    python docs/kb/tools/programmi.py                 # cosa c'e' aperto e da dove si riprende
    python docs/kb/tools/programmi.py --verifica      # integrita' (exit 1 su difetto)
    python docs/kb/tools/programmi.py --selftest      # prove che possono fallire
    python docs/kb/tools/programmi.py --id 99         # un solo programma, per esteso

Il boot lo chiama via `riassunto()`, che resta MUTA quando non c'e' niente da dire —
cosi' la sezione non compare sui cloni e non abbaia a vuoto.
"""
from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

RADICE = Path(__file__).resolve().parents[3]
DIR_PROGRAMMI = RADICE / ".programmi"

STATI = {"NON AVVIATO", "IN CORSO", "CHIUSO", "SOSPESO"}

# Una fase: `- [x] **F1 titolo** — ... — FATTO 2026-08-14 · evidenza`
RE_FASE = re.compile(r"^- \[( |x|X)\]\s+\*\*(?P<sigla>[^*]+?)\*\*\s*(?P<resto>.*)$")
# Cio' che un umano legge come fase. Il confronto con RE_FASE misura quante fasi il parser sta
# perdendo: la sigla non puo' contenere `*`, e in `#69` la sigla «I 18 residui `staging.wave1_*`»
# faceva sparire la fase in silenzio — il menu diceva «0/1 fatte» su un piano che ne mostra due.
RE_FASE_LASCA = re.compile(r"^- \[( |x|X)\]")
RE_STATO = re.compile(r"^>\s*\*\*stato\*\*:\s*(?P<stato>[A-Z ]+?)\s*$", re.M)
RE_ITEM = re.compile(r"^>\s*\*\*item\*\*:\s*[`#]*(?P<id>[A-Za-z]{0,2}-?\d+)", re.M)
RE_DATA = re.compile(r"\b20\d{2}-\d{2}-\d{2}\b")
RE_INTERROTTO = re.compile(r"\bINTERROTTO\b")

# L'identificativo di una voce non e' sempre un numero: accanto a `#216` il register porta
# `Z-251`. Tre strumenti devono riconoscerlo allo stesso modo — questo, il cancello che conta
# le voci senza piano, e il generatore del menu — e tre copie della stessa regola sono il difetto
# che #216 racconta. Vive qui una volta sola, e gli altri due la importano.
RE_ID = re.compile(r"[`#]*([A-Za-z]{0,2}-?\d+)")

# `S1089-piano-sessione.md` — il quaderno di una singola sessione (R24), non un programma
# multi-sessione. Vedi la ragione per esteso in `carica()`.
RE_PIANO_SESSIONE = re.compile(r"^S\d+-piano-sessione\.md$", re.I)


def normalizza_id(testo: str) -> str | None:
    """L'id di una voce, da un titolo del register o dal nome di un file di programma.
    `#216 Titolo` -> `216` · `` `Z-251` — titolo `` -> `Z-251` · `Z251-slug.md` -> `Z-251`."""
    if not testo:
        return None
    m = RE_ID.match(testo.strip())
    if not m:
        return None
    grezzo = m.group(1)
    if grezzo.isdigit():
        return grezzo
    # `Z251` e `Z-251` sono lo stesso identificativo scritto in due modi: il nome di un file non
    # puo' portare comodamente il trattino nella posizione dell'id, il register si'.
    lettere = "".join(c for c in grezzo if c.isalpha())
    cifre = "".join(c for c in grezzo if c.isdigit())
    return f"{lettere.upper()}-{cifre}" if lettere and cifre else None


def _senza_prefisso_id(titolo: str, item: str | None) -> str:
    """Il titolo del file ripete gia' l'id («99 — Domini…», «Z-251 — La suite…»): il riassunto
    stampa l'etichetta da se', quindi qui l'id va tolto — qualunque forma abbia."""
    testo = titolo.strip()
    if item and testo.upper().startswith(item.upper()):
        testo = testo[len(item):]
    return testo.lstrip(" -—:·").strip()


@dataclass
class Fase:
    sigla: str
    fatta: bool
    testo: str
    riga: int

    @property
    def interrotta(self) -> bool:
        return bool(RE_INTERROTTO.search(self.testo))

    @property
    def ha_evidenza(self) -> bool:
        """Una spunta esige una data E qualcosa dopo il trattino lungo."""
        return bool(RE_DATA.search(self.testo)) and len(self.testo.strip()) > 20


@dataclass
class Programma:
    percorso: Path
    item: str | None
    titolo: str
    stato: str
    fasi: list[Fase] = field(default_factory=list)
    # Righe che un umano legge come fase e che il parser NON ha prodotto. Vedi il difetto (5)
    # in difetti(): senza questo campo il programma dichiara meno fasi di quante ne ha, e lo fa
    # in silenzio — «0/1 fatte» su un piano che di fasi ne mostra due.
    fasi_perse: list[int] = field(default_factory=list)

    @property
    def fatte(self) -> int:
        return sum(1 for f in self.fasi if f.fatta)

    @property
    def totale(self) -> int:
        return len(self.fasi)

    @property
    def prossima(self) -> Fase | None:
        for f in self.fasi:
            if not f.fatta:
                return f
        return None

    @property
    def stato_derivato(self) -> str:
        """Lo stato che le SPUNTE dicono — che puo' smentire quello dichiarato.

        SENZA FASI NON C'E' NIENTE DA DERIVARE, e allora vale lo stato dichiarato
        (S1083). Prima, un programma con zero fasi cadeva su «NON AVVIATO» perche'
        `fatte == 0`: un'affermazione su uno stato ricavata da zero informazione.
        Quattro programmi chiusi — `#224`, `#225`, `#226`, `D86-D87` — comparivano
        cosi' a ogni avvio fra i «PROGRAMMI APERTI FUORI DAL MENU», e il boot
        chiedeva di lavorare su cose gia' fatte. Sono file di sola narrazione: la
        loro cronaca sta nel corpo, non in una lista di spunte, e non per questo
        sono aperti. Le spunte possono smentire lo stato dichiarato solo quando ci
        sono; dove mancano, chi ha scritto il file e' l'unica fonte.
        """
        if not self.totale:
            return self.stato or "NON AVVIATO"
        if self.fatte == self.totale:
            return "CHIUSO"
        if self.fatte == 0:
            return "NON AVVIATO"
        return "IN CORSO"


def _leggi(percorso: Path) -> Programma:
    testo = percorso.read_text(encoding="utf-8")
    righe = testo.splitlines()

    m_stato = RE_STATO.search(testo)
    m_item = RE_ITEM.search(testo)
    titolo = ""
    for r in righe:
        if r.startswith("# "):
            titolo = r[2:].strip()
            break

    fasi: list[Fase] = []
    perse: list[int] = []
    dentro = False
    for i, r in enumerate(righe, start=1):
        if r.strip().startswith("## Fasi"):
            dentro = True
            continue
        if dentro and r.startswith("## "):
            dentro = False
        if not dentro:
            continue
        m = RE_FASE.match(r)
        if m:
            fasi.append(Fase(sigla=m.group("sigla").strip(),
                             fatta=m.group(1).lower() == "x",
                             testo=m.group("resto").strip(),
                             riga=i))
        elif RE_FASE_LASCA.match(r):
            perse.append(i)

    return Programma(
        percorso=percorso,
        item=normalizza_id(m_item.group("id")) if m_item else None,
        titolo=titolo or percorso.stem,
        stato=(m_stato.group("stato").strip() if m_stato else "?"),
        fasi=fasi,
        fasi_perse=perse,
    )


def carica(dir_programmi: Path | None = None) -> list[Programma]:
    d = dir_programmi or DIR_PROGRAMMI
    if not d.is_dir():
        return []
    out = []
    for p in sorted(d.glob("*.md")):
        if p.name.upper() == "README.MD":
            continue
        # Un PIANO DI SESSIONE non e' un programma multi-sessione: e' il quaderno di UNA
        # giornata, che R24 impone a ogni sessione e che si chiude con essa. Non ha un item nel
        # register e non puo' averlo — non e' una voce di backlog — quindi ogni suo file cadeva
        # per costruzione fra i «PROGRAMMI APERTI FUORI DAL MENU» e fra i difetti «nessuna fase».
        # Misurato in S1090: tre file (S1087, S1088, S1089) su otto orfani, destinati a crescere
        # di uno per sessione. Un allarme che si accende sempre e' un allarme che si impara a non
        # guardare — e' il difetto che #194 e' venuta a togliere.
        if RE_PIANO_SESSIONE.match(p.name):
            continue
        try:
            out.append(_leggi(p))
        except Exception:
            continue
    return out


def difetti(programmi: list[Programma]) -> list[str]:
    """I controlli che possono uscire ROSSI. Ognuno nasce da un modo di barare."""
    fuori = []
    for pr in programmi:
        nome = pr.percorso.name
        if not pr.fasi:
            # La ragione del controllo e' la RIPARTENZA: senza fasi il menu non sa da dove
            # riprendere. Un piano CHIUSO non riparte, quindi per lui non e' un difetto —
            # e chiedergliele produce fasi retroattive inventate, che e' peggio del silenzio.
            # Misurato in S1079: quattro piani chiusi (#224 #225 #226 D86-D87) tenevano il
            # cancello rosso senza che ci fosse niente da correggere, e un cancello rosso per
            # sempre e' un cancello che si impara a scavalcare.
            # ⚠ Lo sconto vale SOLO per lo stato CHIUSO letto dal vocabolario: un piano il cui
            # stato non e' riconosciuto vale come aperto, altrimenti basterebbe scrivere male
            # la riga di stato per uscire dal controllo.
            if pr.stato != "CHIUSO":
                fuori.append(f"{nome}: nessuna fase — un programma senza fasi non e' ripartibile")
            continue
        if pr.stato not in STATI:
            fuori.append(f"{nome}: stato '{pr.stato}' fuori dal vocabolario {sorted(STATI)}")
        # (5) una fase che il parser non produce sparisce dal conteggio SENZA dirlo: il piano
        # si dichiara piu' corto di quello che e', e il menu mostra un avanzamento sbagliato.
        # Trovato sul vivo in #69, dove un `*` dentro la sigla ha fatto sparire la prima fase.
        if pr.fasi_perse:
            fuori.append(f"{nome}: {len(pr.fasi_perse)} riga/e sembrano fasi e non lo diventano "
                         f"(righe {pr.fasi_perse}) — la sigla fra ** non puo' contenere '*'")
        # (1) spunta nuda: dichiara fatto senza dire quando e con quale prova
        for f in pr.fasi:
            if f.fatta and not f.ha_evidenza:
                fuori.append(f"{nome}:{f.riga} fase {f.sigla} spuntata SENZA evidenza (serve data + prova)")
        # (2) stato dichiarato che contraddice le spunte
        if pr.stato != "SOSPESO" and pr.stato != pr.stato_derivato:
            fuori.append(f"{nome}: stato dichiarato '{pr.stato}' ma le spunte dicono "
                         f"'{pr.stato_derivato}' ({pr.fatte}/{pr.totale})")
        # (3) una fase interrotta non puo' avere fasi spuntate DOPO di se'
        vista_interrotta = False
        for f in pr.fasi:
            if f.interrotta:
                vista_interrotta = True
                continue
            if vista_interrotta and f.fatta:
                fuori.append(f"{nome}:{f.riga} fase {f.sigla} spuntata DOPO una fase INTERROTTA — "
                             f"si riprende dall'interruzione, non oltre")
        # (4) l'item deve essere dichiarato, o il programma non si aggancia al register
        if pr.item is None:
            fuori.append(f"{nome}: manca '> **item**: #N' — il programma non e' agganciato al register")
    return fuori


def riassunto(dir_programmi: Path | None = None) -> str:
    """Vista compatta per il boot. MUTA se non c'e' niente da dire."""
    programmi = [p for p in carica(dir_programmi) if p.stato_derivato != "CHIUSO"]
    if not programmi:
        return ""
    righe = ["PROGRAMMI MULTI-SESSIONE (.programmi/ — si riprende da qui)"]
    for pr in sorted(programmi, key=lambda p: (p.stato_derivato != "IN CORSO", p.item.isdigit() is False if p.item else True, int(p.item) if p.item and p.item.isdigit() else 0, p.item or "")):
        pross = pr.prossima
        marca = "▶" if pr.stato_derivato == "IN CORSO" else "·"
        etichetta = (("#" + pr.item) if pr.item.isdigit() else pr.item) if pr.item else pr.percorso.stem
        # il titolo del file ripete gia' l'id ("99 — Domini..."): non stamparlo due volte
        titolo = _senza_prefisso_id(pr.titolo, pr.item)
        righe.append(f"  {marca} {etichetta} {titolo}  [{pr.fatte}/{pr.totale}]")
        if pross:
            testo = pross.testo.split("—")[0].strip() if "—" in pross.testo else pross.testo
            righe.append(f"      prossima: {pross.sigla} {testo[:90]}")
    guasti = difetti(carica(dir_programmi))
    if guasti:
        righe.append(f"  ⚠ {len(guasti)} difetto/i di integrita' — `python docs/kb/tools/programmi.py --verifica`")
    return "\n".join(righe)


# --------------------------------------------------------------------------- selftest
def _selftest() -> int:
    import tempfile
    esiti: list[tuple[str, bool]] = []

    def prova(nome: str, cond: bool):
        esiti.append((nome, bool(cond)))

    with tempfile.TemporaryDirectory() as td:
        d = Path(td)

        # --- caso sano
        (d / "10-sano.md").write_text(
            "# 10 — programma sano\n\n> **item**: #10\n> **stato**: IN CORSO\n\n"
            "## Fasi\n"
            "- [x] **F1 prima** — fatta — FATTO 2026-08-14 · evidenza reale allegata\n"
            "- [ ] **F2 seconda** — da fare · budget ~80k\n", encoding="utf-8")
        p = carica(d)
        prova("il file sano si legge", len(p) == 1)
        prova("le fasi si contano", p[0].totale == 2 and p[0].fatte == 1)
        prova("l'item si aggancia", p[0].item == "10")
        prova("la prossima fase e' F2", p[0].prossima is not None and p[0].prossima.sigla.startswith("F2"))
        prova("nessun difetto sul sano", difetti(p) == [])
        prova("il riassunto parla", "10" in riassunto(d))

        # --- spunta nuda (senza data/evidenza)
        (d / "11-nuda.md").write_text(
            "# 11 — spunta nuda\n\n> **item**: #11\n> **stato**: IN CORSO\n\n"
            "## Fasi\n- [x] **F1 prima** — fatta\n- [ ] **F2** — dopo\n", encoding="utf-8")
        g = difetti(carica(d))
        prova("la spunta senza evidenza e' un difetto", any("SENZA evidenza" in x for x in g))

        # --- stato dichiarato che mente
        (d / "12-mente.md").write_text(
            "# 12 — stato che mente\n\n> **item**: #12\n> **stato**: CHIUSO\n\n"
            "## Fasi\n- [ ] **F1** — mai fatta\n", encoding="utf-8")
        g = difetti(carica(d))
        prova("lo stato che contraddice le spunte e' un difetto",
              any("stato dichiarato 'CHIUSO'" in x for x in g))

        # --- spunta dopo un'interruzione
        (d / "13-oltre.md").write_text(
            "# 13 — oltre l'interruzione\n\n> **item**: #13\n> **stato**: IN CORSO\n\n"
            "## Fasi\n"
            "- [ ] **F1** — INTERROTTO al passo 3 — 2026-08-14\n"
            "- [x] **F2** — fatta — FATTO 2026-08-14 · evidenza\n", encoding="utf-8")
        g = difetti(carica(d))
        prova("spuntare oltre un'interruzione e' un difetto",
              any("DOPO una fase INTERROTTA" in x for x in g))

        # --- programma senza fasi
        (d / "14-vuoto.md").write_text(
            "# 14 — vuoto\n\n> **item**: #14\n> **stato**: NON AVVIATO\n\n## Fasi\n", encoding="utf-8")
        g = difetti(carica(d))
        prova("un programma senza fasi e' un difetto", any("nessuna fase" in x for x in g))

        # --- lo SCONTO per i piani chiusi, e il modo ovvio di abusarne (S1079)
        # Il controllo qui sopra esiste per la RIPARTENZA: un piano chiuso non riparte, quindi
        # per lui non e' un difetto. Ma lo sconto vale solo per uno stato CHIUSO *riconosciuto*:
        # se bastasse una riga di stato scritta male, il modo di uscire dal controllo sarebbe
        # peggiorare il file invece di correggerlo.
        (d / "16-chiuso-vuoto.md").write_text(
            "# 16\n\n> **item**: #16\n> **stato**: CHIUSO\n\n## Fasi\n", encoding="utf-8")
        g = difetti(carica(d))
        prova("un piano CHIUSO senza fasi NON e' un difetto",
              not any("16-chiuso-vuoto" in x and "nessuna fase" in x for x in g))

        (d / "17-finto-chiuso.md").write_text(
            "# 17\n\n> **item**: #17\n> **stato**: CHIUSO ma con testo dopo\n\n## Fasi\n",
            encoding="utf-8")
        g = difetti(carica(d))
        prova("uno stato illeggibile NON compra lo sconto dei chiusi",
              any("17-finto-chiuso" in x and "nessuna fase" in x for x in g))

        # --- item mancante
        (d / "15-orfano.md").write_text(
            "# 15 — orfano\n\n> **stato**: NON AVVIATO\n\n## Fasi\n- [ ] **F1** — x\n", encoding="utf-8")
        g = difetti(carica(d))
        prova("un programma non agganciato al register e' un difetto",
              any("non e' agganciato" in x for x in g))

        # --- controlli NEGATIVI: le prove devono poter fallire
        prova("il difetto della spunta nuda NON compare sul file sano",
              not any("10-sano" in x and "SENZA evidenza" in x for x in difetti(carica(d))))
        prova("un CHIUSO coerente non e' un difetto",
              difetti([_leggi(_scrivi_tmp(d, "16-chiuso.md",
                    "# 16 — chiuso\n\n> **item**: #16\n> **stato**: CHIUSO\n\n"
                    "## Fasi\n- [x] **F1** — fatta — FATTO 2026-08-14 · prova\n"))]) == [])

        # --- il piano di sessione non e' un programma (S1090)
        # Contenuto scelto apposta perche' SAREBBE un difetto se venisse letto: niente item,
        # niente fasi, stato fuori vocabolario. Se l'esclusione smettesse di funzionare, la
        # prima prova diventerebbe rossa — e la seconda impedisce di comprarsi quel verde
        # escludendo troppo.
        (d / "S1090-piano-sessione.md").write_text(
            "# S1090 — piano di sessione\n\n> **stato**: IN CORSO (S1090)\n", encoding="utf-8")
        letti = {p.percorso.name for p in carica(d)}
        prova("un piano di sessione non viene censito fra i programmi",
              "S1090-piano-sessione.md" not in letti)
        prova("l'esclusione dei piani di sessione NON si porta via i programmi veri",
              "10-sano.md" in letti and "16-chiuso.md" in letti)

        # --- il riassunto tace quando non c'e' nulla
        with tempfile.TemporaryDirectory() as vuota:
            prova("il riassunto tace su directory vuota", riassunto(Path(vuota)) == "")
        prova("il riassunto tace su directory inesistente",
              riassunto(Path(td) / "non-esiste") == "")
        # un programma CHIUSO non deve comparire nel riassunto
        with tempfile.TemporaryDirectory() as solo:
            _scrivi_tmp(Path(solo), "17-chiuso.md",
                        "# 17 — chiuso\n\n> **item**: #17\n> **stato**: CHIUSO\n\n"
                        "## Fasi\n- [x] **F1** — fatta — FATTO 2026-08-14 · prova\n")
            prova("un programma CHIUSO non compare nel riassunto", riassunto(Path(solo)) == "")

    for nome, ok in esiti:
        print(f"  [{'OK' if ok else '!!'}] {nome}")
    verdi = sum(1 for _, ok in esiti if ok)
    print(f"\n{verdi}/{len(esiti)} verdi")
    if verdi == len(esiti):
        print("SELFTEST VERDE")
        return 0
    print("SELFTEST ROSSO")
    return 1


def _scrivi_tmp(d: Path, nome: str, testo: str) -> Path:
    p = d / nome
    p.write_text(testo, encoding="utf-8")
    return p


def main() -> int:
    ap = argparse.ArgumentParser(description="Programmi multi-sessione: dove eravamo, da dove si riprende.")
    ap.add_argument("--verifica", action="store_true", help="integrita' (exit 1 su difetto)")
    ap.add_argument("--selftest", action="store_true", help="prove che possono fallire")
    ap.add_argument("--id", help="un solo programma, per esteso (numero, oppure Z-251)")
    args = ap.parse_args()

    if args.selftest:
        return _selftest()

    programmi = carica()

    if args.verifica:
        guasti = difetti(programmi)
        if not guasti:
            print(f"programmi OK — {len(programmi)} programma/i, nessun difetto")
            return 0
        for g in guasti:
            print(f"  [!!] {g}")
        print(f"\n{len(guasti)} difetto/i")
        return 1

    if args.id is not None:
        for pr in programmi:
            if pr.item == normalizza_id(args.id):
                print(pr.percorso.read_text(encoding="utf-8"))
                return 0
        print(f"nessun programma per #{args.id}")
        return 1

    if not programmi:
        print("nessun programma in .programmi/")
        return 0
    testo = riassunto()
    print(testo if testo else "tutti i programmi sono CHIUSI")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
