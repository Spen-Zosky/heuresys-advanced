#!/usr/bin/env python3
"""check_marciume.py — il cancello A TEMPO: «e' marcito qualcosa mentre non guardavo?»

PERCHE' ESISTE (S1079, 2026-08-24 — deciso da Enzo)
---------------------------------------------------
`verify_gate.py` guarda il **diff**: un controllo scatta se e solo se qualcuno tocca un file
che lo instrada. E' coerente, ed e' cio' che serve per «ho rotto qualcosa scrivendo?».
Ma **presume che le cose si guastino solo quando le tocchi**.

I sette difetti bonificati in S1079 dicono che non e' cosi'. Nessuno nasceva da un diff:

  · #148 era bloccata «fino al 2026-08-20», e il 24 lo era ancora  → il TEMPO
  · #169 era ferma su #147, che nel frattempo era stata chiusa     → un'ALTRA VOCE
  · #86 chiedeva il login su due macchine, e su una funzionava     → una MACCHINA
  · #222 chiusa prometteva «un piano proprio» mai creato: 4.464
    competenze restate orfane, invisibili a ogni elenco            → una VOCE CHIUSA
  · verifica_incrociata rossa, e nessuno sapeva da quando          → il DATABASE

Sono stati trovati perche' Enzo ha chiesto di cercarli. Non e' una procedura: e' questo file.

COSA FA — due parti
-------------------
A) Esegue gli strumenti che **nessun diff instrada**. L'elenco NON e' scritto a mano: si deriva
   leggendo `verify_gate.py` (cosa e' gia' instradato) e `session_start.py` (cosa gira al boot).
   Uno strumento nuovo entra da se'. Scrivere la lista a mano ripeterebbe esattamente il difetto
   che questo file corregge — e nessuno se ne accorgerebbe, perche' una lista incompleta e' verde.

B) Cinque controlli di STATO che oggi non esistono, uno per ciascuna forma trovata in S1079:
     M1  una voce bloccata da una dipendenza GIA' SCIOLTA
     M2  una voce bloccata da una data GIA' PASSATA
     M3  un residuo dichiarato dentro una voce CHIUSA, senza nessuna destinazione
     M4  un piano ESAURITO su una voce ancora viva
     M5  un'attesa di input diventata STANTIA

USO
---
  python docs/kb/tools/check_marciume.py              tutto (A + B) — exit 1 se qualcosa e' rosso
  python docs/kb/tools/check_marciume.py --solo-stato solo B: istantaneo, nessun DB, nessun processo
  python docs/kb/tools/check_marciume.py --elenco     cosa eseguirebbe, e PERCHE', senza eseguire
  python docs/kb/tools/check_marciume.py --selftest   i casi, ognuno capace di fallire

TRE ONESTA', le stesse del guardiano
------------------------------------
 · un TIMEOUT non e' un verde: si dichiara `NON MISURABILE`, mai «ok».
 · un controllo che non ha nulla da controllare e' **cieco**, e cieco non e' verde: si dice.
 · l'elenco di A si deriva a ogni corsa. Se la derivazione non riesce, il file lo **dichiara**
   e non ripiega su una lista di scorta: una lista di scorta e' una lista scritta a mano che
   nessuno sa di avere.
"""
from __future__ import annotations

import argparse
import datetime as _dt
import os
import re
import subprocess
import sys
from pathlib import Path

RADICE = Path(__file__).resolve().parents[3]
TOOLS = RADICE / "docs" / "kb" / "tools"
REGISTER = RADICE / "docs" / "kb" / "SOT_BACKLOG.md"
VERIFY_GATE = TOOLS / "verify_gate.py"
SESSION_START = TOOLS / "session_start.py"

# Un tetto per strumento. Oltre, si dichiara NON MISURABILE — mai verde.
TIMEOUT_S = int(os.environ.get("MARCIUME_TIMEOUT", "240"))

# Un'attesa di input piu' vecchia di questo va RI-VERIFICATA. Non e' un difetto: e' che
# nessuno e' tornato a guardare se l'input nel frattempo e' arrivato — com'e' successo a #86,
# dove meta' della richiesta era gia' soddisfatta e il titolo diceva ancora il contrario.
GIORNI_ATTESA_STANTIA = 21

VERDE, ROSSO, CIECO, IGNOTO = "OK", "!!", "i ", "? "

# Gli stati TERMINALI del vocabolario chiuso (CLAUDE.md §Item status vocabulary). Sono TRE,
# non due: il register usa `DONE` e `FATTO` come sinonimi, e trattarne uno solo produce falsi
# rossi — misurato alla prima corsa di questo file, che ha dichiarato «viva» una voce FATTO.
# Un cancello con tre falsi rossi e' un cancello che si impara a non guardare.
TERMINALI = {"DONE", "FATTO", "WON'T-DO"}


# ---------------------------------------------------------------------------
# A — la derivazione: chi NON e' instradato da niente
# ---------------------------------------------------------------------------
def _strumenti_instradati() -> set[str]:
    """Gli strumenti che `verify_gate` esegue quando il diff li instrada.

    Si legge il CODICE, non una lista: e' l'unico modo perche' uno strumento aggiunto domani
    a una suite sparisca da qui da solo. Se il file non e' leggibile si solleva: un elenco
    derivato male e' peggio di nessun elenco, perche' sembra completo.
    """
    src = VERIFY_GATE.read_text(encoding="utf-8")
    fuori: set[str] = set()
    for cmd in re.findall(r'\("L\d+",\s*"([^"]+)"\)', src):
        for m in re.finditer(r"docs/kb/tools/(\w+)\.py", cmd):
            fuori.add(m.group(1))
    return fuori


def _strumenti_al_boot() -> set[str]:
    """Gli strumenti che il boot esegue da se' (import di `session_start.py`).

    `build_menu` e `status_dashboard` sono orchestratori: cio' che importano a loro volta
    conta come «gira al boot», altrimenti un cancello eseguito indirettamente risulterebbe
    scoperto e verrebbe eseguito due volte a ogni chiusura.
    """
    visti: set[str] = set()
    da_leggere = [SESSION_START]
    while da_leggere:
        f = da_leggere.pop()
        if not f.exists():
            continue
        for nome in re.findall(r"^import (\w+)", f.read_text(encoding="utf-8"), re.M):
            if nome in visti:
                continue
            visti.add(nome)
            cand = TOOLS / f"{nome}.py"
            if cand.exists():
                da_leggere.append(cand)
    return visti


def scoperti() -> tuple[list[str], dict[str, str]]:
    """(strumenti scoperti, perche' gli altri sono coperti) — derivato, mai scritto a mano."""
    instradati = _strumenti_instradati()
    al_boot = _strumenti_al_boot()
    coperti: dict[str, str] = {}
    fuori: list[str] = []
    candidati = sorted(
        p.stem for p in TOOLS.glob("*.py")
        if p.stem.startswith("check_") or p.stem in ("verifica_incrociata",)
    )
    for nome in candidati:
        if nome == Path(__file__).stem:            # non si misura da se'
            coperti[nome] = "e' questo file"
        elif nome in instradati:
            coperti[nome] = "instradato da verify_gate (il diff lo esegue)"
        elif nome in al_boot:
            coperti[nome] = "eseguito dal boot (session_start)"
        else:
            fuori.append(nome)
    return fuori, coperti


def esegui_scoperti(elenco: list[str]) -> list[tuple[str, str, str]]:
    """Esegue e raccoglie (nome, esito, dettaglio). Un timeout NON diventa un verde."""
    esiti = []
    env = dict(os.environ, PYTHONIOENCODING="utf-8", PYTHONUTF8="1")
    for nome in elenco:
        try:
            r = subprocess.run([sys.executable, str(TOOLS / f"{nome}.py")],
                               capture_output=True, text=True, timeout=TIMEOUT_S,
                               cwd=str(RADICE), env=env)
        except subprocess.TimeoutExpired:
            esiti.append((nome, IGNOTO, f"NON MISURABILE — oltre {TIMEOUT_S}s, non un verde"))
            continue
        except OSError as e:                        # non eseguibile: si dichiara, non si tace
            esiti.append((nome, IGNOTO, f"NON MISURABILE — {e}"))
            continue
        coda = [x for x in (r.stdout or "").rstrip().split("\n") if x.strip()]
        # exit 4 = CIECO DICHIARATO (convenzione del guardiano): lo strumento ha
        # guardato, non ha trovato marcio, e dichiara cosa non poteva vedere.
        # Si stampa — il buio resta visibile — ma non arrossa il cancello.
        stato = VERDE if r.returncode == 0 else (CIECO if r.returncode == 4 else ROSSO)
        # La riga da mostrare e' il RIEPILOGO («ESITO: 8 verifiche con difetti...»),
        # non l'ultima riga: l'ultima riga di un elenco di allarmi e' UN allarme,
        # e mostrarla come sintesi ha nascosto 7 difetti su 8 per tre chiusure
        # di fila (S1081) — lo stesso «si ferma al primo rosso» della regola 6,
        # rovesciato: si fermava all'ULTIMO.
        riepilogo = next((x for x in reversed(coda) if x.lstrip().startswith("ESITO")),
                         coda[-1] if coda else f"exit={r.returncode}")
        esiti.append((nome, stato, riepilogo.strip()[:150]))
    return esiti


# ---------------------------------------------------------------------------
# B — i cinque controlli di stato
# ---------------------------------------------------------------------------
CAPO = re.compile(r"^- \*\*(#?[A-Za-z]{0,2}-?\d+) (?P<tit>.+?)\*\* .*status: (?P<st>[A-Z-]+)")
# Marcatori FORTI di lavoro residuo. Deliberatamente stretti: un elenco largo cattura la
# cronaca («resta come ripiego», «la storia resta») e produce decine di falsi rossi, che e'
# il modo piu' rapido per far smettere di guardare un cancello. Misurato in S1079: un filtro
# largo dava 114 casi su 181 voci chiuse, quello stretto ne da' 5, di cui 1 vero.
RESIDUO = re.compile(
    r"(piano proprio|piano suo|voce a s[eé]\b|lavoro-residuo|fuori da questa voce"
    # \b: senza confine di parola «riNOMINATA una volta sola» accendeva M3 su una
    # narrazione di chiusura (#163, S1081) — un'unita' rinominata non e' un residuo
    r"|\bnominat[ao] (?:qui )?una volta sola|resta da fare|va pianificat|da decompor)", re.I)
DATA = re.compile(r"\b(20\d{2})-(\d{2})-(\d{2})\b")
# «fino al <data>», «GATED fino al <data>»: una scadenza, non un ostacolo.
SCADENZA = re.compile(r"fino al\s+(20\d{2}-\d{2}-\d{2})", re.I)
RIF = re.compile(r"[#⛔]\s*\*{0,2}(#?\d+)")


class Voce:
    __slots__ = ("id", "titolo", "stato", "righe", "riga")

    def __init__(self, vid, titolo, stato, riga):
        self.id, self.titolo, self.stato, self.riga = vid, titolo, stato, riga
        self.righe: list[str] = []

    @property
    def testo(self) -> str:
        return "\n".join(self.righe)


def leggi_register(testo: str | None = None) -> list[Voce]:
    src = testo if testo is not None else REGISTER.read_text(encoding="utf-8")
    voci: list[Voce] = []
    cur: Voce | None = None
    for i, r in enumerate(src.split("\n"), start=1):
        m = CAPO.match(r)
        if m:
            cur = Voce(m.group(1).lstrip("#"), m.group("tit"), m.group("st"), i)
            voci.append(cur)
        elif cur is not None:
            if r.startswith("- **"):
                cur = None
            else:
                cur.righe.append(r)
    return voci


def m1_dipendenza_sciolta(voci: list[Voce]) -> list[str]:
    """Una voce bloccata da un'altra che nel frattempo e' stata CHIUSA.

    Caso reale (S1079): #169 era GATED su #147, chiusa da giorni. Nessun diff poteva
    accorgersene — chiudere una voce non tocca i file che ne instradano un'altra.
    """
    stato = {v.id: v.stato for v in voci}
    fuori = []
    for v in voci:
        if v.stato != "GATED":
            continue
        for riga in v.righe:
            if "blocker" not in riga.lower() and "⛔" not in riga:
                continue
            for rif in RIF.findall(riga):
                rid = rif.lstrip("#")
                if rid == v.id:
                    continue
                if stato.get(rid) in TERMINALI:
                    fuori.append(f"#{v.id} e' GATED su #{rid}, che risulta {stato[rid]} "
                                 f"— il blocco non esiste piu' (riga {v.riga})")
                    break
            else:
                continue
            break
    return fuori


def m2_data_passata(voci: list[Voce], oggi: _dt.date | None = None) -> list[str]:
    """Una voce bloccata «fino al <data>», e quella data e' passata.

    Caso reale (S1079): #148 era GATED «fino al 2026-08-20», misurata il 24. Il tempo non
    produce diff, quindi nessun cancello legato al diff poteva vederlo.
    """
    oggi = oggi or _dt.date.today()
    fuori = []
    for v in voci:
        if v.stato not in ("GATED", "HOLD", "WAIT-INPUT"):
            continue
        for riga in v.righe:
            m = SCADENZA.search(riga)
            if not m:
                continue
            try:
                d = _dt.date.fromisoformat(m.group(1))
            except ValueError:
                continue
            if d < oggi:
                fuori.append(f"#{v.id} ({v.stato}) e' bloccata «fino al {m.group(1)}», "
                             f"passata da {(oggi - d).days} giorni (riga {v.riga})")
                break
    return fuori


def m3_residuo_orfano(voci: list[Voce]) -> list[str]:
    """Lavoro dichiarato dentro una voce CHIUSA, che nessuna voce viva raccoglie.

    Caso reale (S1079): #222 chiusa prometteva a `F6-07` «un piano proprio». Quel piano non
    e' mai stato creato, e 4.464 competenze isolate sono restate invisibili a ogni elenco.
    La destinazione si cerca in DUE posti, perche' basta uno dei due: una voce viva che
    nomina lo stesso riferimento, o un piano in `.programmi/`.
    """
    vivi = [v for v in voci if v.stato not in TERMINALI]
    ids_vivi = {v.id for v in vivi}
    testo_vivi = "\n".join(v.titolo + "\n" + v.testo for v in vivi)
    piani = ""
    d = RADICE / ".programmi"
    if d.is_dir():
        for p in d.glob("*.md"):
            try:
                piani += p.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                pass
    fuori = []
    for v in voci:
        if v.stato not in TERMINALI:
            continue
        for riga in v.righe:
            if not RESIDUO.search(riga) or len(riga.strip()) < 40:
                continue
            if "~~" in riga:
                # riga superata, tenuta per storia: non dichiara piu' niente a nessuno
                continue
            # il riferimento nominato nella riga (es. `F6-07`): se nessuno lo raccoglie, e' orfano
            sigle = re.findall(r"`(F\d+-\d+|F\d+|T\d+[a-z]?)`", riga)
            if sigle and any(s in testo_vivi or s in piani for s in sigle):
                break
            # destinazione esplicita: `raccolto-in: #NNN` — raccoglie solo una voce VIVA,
            # perche' un residuo che punta a una voce chiusa e' orfano due volte
            dest = re.findall(r"raccolto-in:\s*\**#(\d+)", riga)
            if dest and any(d in ids_vivi for d in dest):
                break
            fuori.append(f"#{v.id} e' DONE ma dichiara un residuo che nessuna voce viva "
                         f"e nessun piano raccoglie (riga {v.riga}): {riga.strip()[:110]}")
            break
    return fuori


def m4_piano_esaurito(voci: list[Voce], dir_piani=None) -> list[str]:
    """Un piano con tutte le fasi fatte, su una voce ancora viva.

    Caso reale (S1079): #214 aveva 6/6 fasi e il menu concludeva «va chiusa» — ma la voce e'
    continuativa e la coda misurata portava 45 moduli. Il piano descriveva la fase FINITA
    (costruire il criterio) e taceva su quella in corso (usarlo).
    """
    try:
        sys.path.insert(0, str(TOOLS))
        import programmi  # noqa: E402
    except Exception as e:                          # pragma: no cover
        return [f"NON MISURABILE — non riesco a leggere i piani: {e}"]
    vivi = {v.id: v for v in voci if v.stato not in TERMINALI}
    fuori = []
    for pr in programmi.carica(dir_piani):
        if not pr.item or pr.item not in vivi or not pr.fasi:
            continue
        if pr.fatte == pr.totale:
            fuori.append(f"#{pr.item} e' {vivi[pr.item].stato} ma il suo piano ha "
                         f"{pr.fatte}/{pr.totale} fasi fatte — o la voce si chiude, o il piano "
                         f"descrive una fase finita e tace su quella in corso ({pr.percorso.name})")
    return fuori


def m5_attesa_stantia(voci: list[Voce], oggi: _dt.date | None = None) -> list[str]:
    """Un'attesa di input su cui nessuno e' tornato a guardare.

    Non e' un difetto in se': e' che l'input **puo' essere arrivato** senza che nessuno lo
    verifichi. Caso reale (S1079): #86 chiedeva il login su due macchine e su una funzionava
    gia'; il titolo diceva ancora il contrario. La data si prende dalla piu' recente citata
    nel blocco — se non ce n'e' nessuna, e' CIECO e si dichiara.
    """
    oggi = oggi or _dt.date.today()
    fuori = []
    for v in voci:
        if v.stato != "WAIT-INPUT":
            continue
        date = []
        for riga in v.righe:
            for a, mm, gg in DATA.findall(riga):
                try:
                    date.append(_dt.date(int(a), int(mm), int(gg)))
                except ValueError:
                    pass
        if not date:
            fuori.append(f"#{v.id} attende un input e NON porta alcuna data: non si puo' "
                         f"sapere da quanto — cieco, non verde (riga {v.riga})")
            continue
        eta = (oggi - max(date)).days
        if eta > GIORNI_ATTESA_STANTIA:
            fuori.append(f"#{v.id} attende un input da {eta} giorni — da ri-verificare: "
                         f"l'input puo' essere arrivato ({v.titolo[:70]})")
    return fuori


CONTROLLI = [
    ("M1", "dipendenza gia' sciolta", m1_dipendenza_sciolta),
    ("M2", "data di sblocco gia' passata", m2_data_passata),
    ("M3", "residuo orfano in una voce chiusa", m3_residuo_orfano),
    ("M4", "piano esaurito su una voce viva", m4_piano_esaurito),
    ("M5", "attesa di input stantia", m5_attesa_stantia),
]


def esegui_stato(voci: list[Voce]) -> list[tuple[str, str, str, list[str]]]:
    out = []
    for sigla, nome, fn in CONTROLLI:
        try:
            rilievi = fn(voci)
        except Exception as e:                      # pragma: no cover
            out.append((sigla, nome, IGNOTO, [f"NON MISURABILE — {e}"]))
            continue
        ignoti = [r for r in rilievi if r.startswith("NON MISURABILE")]
        if ignoti:
            out.append((sigla, nome, IGNOTO, rilievi))
        else:
            out.append((sigla, nome, ROSSO if rilievi else VERDE, rilievi))
    return out


# ---------------------------------------------------------------------------
# selftest — ogni controllo con un caso che lo fa scattare E un caso che NON deve
# ---------------------------------------------------------------------------
def selftest() -> int:
    """I casi. Ognuno in due versi: uno che deve accendersi, uno che deve tacere.

    Un controllo provato solo sul caso positivo non distingue «funziona» da «dice sempre si'»
    — ed e' esattamente il falso verde che questo file esiste per non produrre.
    """
    esiti: list[tuple[str, bool]] = []

    def prova(nome: str, ok: bool) -> None:
        esiti.append((nome, ok))
        print(f"  [{'OK' if ok else '!!'}] {nome}")

    OGGI = _dt.date(2026, 8, 24)

    # --- M1: dipendenza sciolta
    reg = ("- **#10 alfa** · status: GATED\n"
           "  - blocker: **#20** — aspetta quella\n"
           "- **#20 beta** · status: DONE\n"
           "  - fatto\n")
    prova("M1 accende su un blocco verso una voce DONE", len(m1_dipendenza_sciolta(leggi_register(reg))) == 1)
    reg_no = reg.replace("- **#20 beta** · status: DONE", "- **#20 beta** · status: ACTIVE")
    prova("M1 TACE se la dipendenza e' ancora viva", m1_dipendenza_sciolta(leggi_register(reg_no)) == [])

    # --- M2: data passata
    reg = "- **#11 gamma** · status: GATED\n  - ⛔ GATED fino al 2026-08-20 (misurato)\n"
    prova("M2 accende su una scadenza passata", len(m2_data_passata(leggi_register(reg), OGGI)) == 1)
    reg_f = reg.replace("2026-08-20", "2026-12-31")
    prova("M2 TACE su una scadenza futura", m2_data_passata(leggi_register(reg_f), OGGI) == [])

    # --- M3: residuo orfano  (nessun piano vivo lo raccoglie)
    reg = ("- **#12 delta** · status: DONE\n"
           "  - avanzamento: chiusa, ma `F9-99` resta da fare con un piano proprio, e vale la pena\n")
    prova("M3 accende su un residuo che nessuno raccoglie", len(m3_residuo_orfano(leggi_register(reg))) == 1)
    reg_ok = reg + "- **#13 chi lo raccoglie** · status: ACTIVE\n  - porta avanti `F9-99`\n"
    prova("M3 TACE se una voce viva lo raccoglie", m3_residuo_orfano(leggi_register(reg_ok)) == [])
    reg_sup = ("- **#14 epsilon** · status: DONE\n"
               "  - ~~fuori da questa voce, nominato una volta sola: un lavoro poi eseguito davvero~~ — RIGA SUPERATA\n")
    prova("M3 TACE su una riga superata (~~)", m3_residuo_orfano(leggi_register(reg_sup)) == [])
    reg_rac = ("- **#15 zeta** · status: DONE\n"
               "  - fuori da questa voce, nominato una volta sola: le 29 righe di prova · raccolto-in: #16\n")
    prova("M3 ACCENDE se raccolto-in punta a una voce chiusa",
          len(m3_residuo_orfano(leggi_register(reg_rac + "- **#16 eta** · status: DONE\n  - x\n"))) == 1)
    prova("M3 TACE se raccolto-in punta a una voce viva",
          m3_residuo_orfano(leggi_register(reg_rac + "- **#16 eta** · status: HOLD\n  - x\n")) == [])
    reg_rin = ("- **#17 theta** · status: DONE\n"
               "  - un'unita' viene rinominata una volta sola nel modello, e il vincolo lo pretende cosi'\n")
    prova("M3 TACE su «rinominata una volta sola» (confine di parola)",
          m3_residuo_orfano(leggi_register(reg_rin)) == [])

    # --- M4: piano esaurito su una voce viva (su una directory di prova, mai sui piani veri:
    #     un selftest che leggesse i piani del repo cambierebbe esito a ogni sessione)
    import tempfile
    with tempfile.TemporaryDirectory() as td:
        d = Path(td)
        (d / "30-tutto-fatto.md").write_text(
            "# 30\n\n> **item**: #30\n> **stato**: IN CORSO\n\n## Fasi\n"
            "- [x] **F1** — fatta — FATTO 2026-08-01 · evidenza\n", encoding="utf-8")
        prova("M4 accende su un piano esaurito con la voce ancora viva",
              len(m4_piano_esaurito(leggi_register(
                  "- **#30 voce viva** · status: ACTIVE\n  - qualcosa\n"), d)) == 1)
        prova("M4 TACE se la voce e' gia' chiusa",
              m4_piano_esaurito(leggi_register(
                  "- **#30 voce chiusa** · status: DONE\n  - qualcosa\n"), d) == [])
        # `FATTO` e' terminale quanto `DONE`: il register li usa come sinonimi. Alla prima
        # corsa reale questo file ha dichiarato «viva» una voce FATTO e ha prodotto tre falsi
        # rossi — e tre falsi rossi sono il modo piu' rapido per far smettere di guardare.
        prova("M4 TACE su una voce FATTO (terminale quanto DONE)",
              m4_piano_esaurito(leggi_register(
                  "- **#30 voce fatta** · status: FATTO\n  - qualcosa\n"), d) == [])
        (d / "31-a-meta.md").write_text(
            "# 31\n\n> **item**: #31\n> **stato**: IN CORSO\n\n## Fasi\n"
            "- [x] **F1** — fatta — FATTO 2026-08-01 · evidenza\n"
            "- [ ] **F2** — da fare\n", encoding="utf-8")
        prova("M4 TACE su un piano ancora a meta'",
              not any("#31" in x for x in m4_piano_esaurito(leggi_register(
                  "- **#31 a meta** · status: ACTIVE\n  - qualcosa\n"), d)))
    # --- M5: attesa stantia
    reg = "- **#14 epsilon** · status: WAIT-INPUT\n  - rilevato il 2026-01-01, aspetta ancora\n"
    prova("M5 accende su un'attesa vecchia", len(m5_attesa_stantia(leggi_register(reg), OGGI)) == 1)
    reg_r = "- **#15 zeta** · status: WAIT-INPUT\n  - rilevato il 2026-08-23, ieri\n"
    prova("M5 TACE su un'attesa recente", m5_attesa_stantia(leggi_register(reg_r), OGGI) == [])
    reg_c = "- **#16 eta** · status: WAIT-INPUT\n  - aspetta un input, e nessuno ha scritto quando\n"
    r = m5_attesa_stantia(leggi_register(reg_c), OGGI)
    prova("M5 dichiara CIECO quando non c'e' una data", len(r) == 1 and "cieco" in r[0])

    # --- la derivazione: il cuore, e il modo ovvio in cui puo' essere finta
    try:
        fuori, coperti = scoperti()
        prova("la derivazione produce un elenco non vuoto", len(fuori) > 0)
        prova("uno strumento INSTRADATO da verify_gate non e' fra gli scoperti",
              "check_tenant_contamination" in coperti and "check_tenant_contamination" not in fuori)
        prova("uno strumento del BOOT non e' fra gli scoperti",
              "check_istruzioni" in coperti and "check_istruzioni" not in fuori)
        prova("questo file non misura se stesso", "check_marciume" not in fuori)
    except Exception as e:
        prova(f"la derivazione non solleva ({e})", False)

    # --- esegui_scoperti: exit 4 = CIECO dichiarato, non marciume
    import tempfile as _tf
    global TOOLS
    with _tf.TemporaryDirectory() as td:
        _vecchio_tools = TOOLS
        TOOLS = Path(td)
        (TOOLS / "finto_cieco.py").write_text("import sys; print('cieco dichiarato'); sys.exit(4)", encoding="utf-8")
        (TOOLS / "finto_rosso.py").write_text("import sys; print('marcio'); sys.exit(1)", encoding="utf-8")
        (TOOLS / "finto_elenco.py").write_text(
            "import sys\nprint('- allarme 1')\nprint('ESITO: 8 verifiche con difetti')\n"
            "print('- allarme ultimo')\nsys.exit(1)", encoding="utf-8")
        try:
            _righe = {n: (e, c) for n, e, c in
                      esegui_scoperti(["finto_cieco", "finto_rosso", "finto_elenco"])}
            prova("exit 4 di uno strumento e' CIECO, non rosso", _righe["finto_cieco"][0] == CIECO)
            prova("exit 1 di uno strumento resta ROSSO", _righe["finto_rosso"][0] == ROSSO)
            prova("la sintesi mostrata e' la riga ESITO, non l'ultimo allarme",
                  _righe["finto_elenco"][1].startswith("ESITO: 8"))
        finally:
            TOOLS = _vecchio_tools

    rossi = [n for n, ok in esiti if not ok]
    print(f"\n{len(esiti) - len(rossi)}/{len(esiti)} verdi")
    print("SELFTEST VERDE" if not rossi else "SELFTEST ROSSO")
    return 0 if not rossi else 1


def main() -> int:
    ap = argparse.ArgumentParser(description="Il cancello a tempo: cosa e' marcito mentre non guardavo")
    ap.add_argument("--elenco", action="store_true", help="cosa eseguirebbe e perche', senza eseguire")
    ap.add_argument("--solo-stato", action="store_true", help="solo i cinque controlli di stato (istantaneo)")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()

    if a.selftest:
        return selftest()

    try:
        fuori, coperti = scoperti()
    except Exception as e:
        print(f"NON MISURABILE — la derivazione dell'elenco e' fallita: {e}", file=sys.stderr)
        print("  (non esiste una lista di scorta, ed e' voluto: una lista scritta a mano", file=sys.stderr)
        print("   e' una lista incompleta che nessuno sa di avere)", file=sys.stderr)
        return 2

    if a.elenco:
        print(f"SCOPERTI — nessun diff li instrada, quindi nessuno li esegue ({len(fuori)}):")
        for n in fuori:
            print(f"  · {n}")
        print(f"\nGIA' COPERTI ({len(coperti)}):")
        for n, perche in sorted(coperti.items()):
            print(f"  · {n:<32} {perche}")
        print("\nCONTROLLI DI STATO:")
        for sigla, nome, _ in CONTROLLI:
            print(f"  · {sigla}  {nome}")
        return 0

    rosso = False
    print("=" * 78)
    print(" IL CANCELLO A TEMPO — e' marcito qualcosa mentre non guardavo?")
    print("=" * 78)

    print("\nSTATO — le forme che nessun diff puo' far scattare")
    for sigla, nome, esito, rilievi in esegui_stato(leggi_register()):
        print(f"  [{esito}] {sigla} {nome:<38} {len(rilievi) if rilievi else ''}")
        for r in rilievi:
            print(f"        · {r}")
        if esito == ROSSO:
            rosso = True

    if not a.solo_stato:
        print(f"\nSTRUMENTI SCOPERTI — {len(fuori)}, derivati (tetto {TIMEOUT_S}s ciascuno)")
        for nome, esito, coda in esegui_scoperti(fuori):
            print(f"  [{esito}] {nome:<32} {coda}")
            if esito == ROSSO:
                rosso = True

    print("\n" + "=" * 78)
    print(" ESITO: qualcosa e' marcito — vedi i [!!]" if rosso else " ESITO: niente e' marcito")
    print("=" * 78)
    return 1 if rosso else 0


if __name__ == "__main__":
    sys.exit(main())
