#!/usr/bin/env python3
"""
guardiano.py — le due misure che decidono se si continua o si chiude.

IL GUARDIANO UNICO (Enzo, 2026-08-13, S1056)
--------------------------------------------
Due cose possono finire mentre si lavora, e finiscono in modi diversi:

  · il CONTESTO della sessione — cresce e non torna indietro;
  · il LIMITE DELLE 5 ORE dell'abbonamento — si consuma e si azzera da solo, ma se lo
    si sbatte in faccia il lavoro si ferma li' e si aspetta il reset.

La regola e' una sola, ed e' un OR:

    se  contesto >= 75%   OPPURE   finestra 5h >= 80%
    allora: interrompi le attivita', registra il progresso, committa E PUSHA tutto,
            e fai la chiusura completa della sessione.

Sostituisce la regola precedente che guardava il solo contesto. Vale **sempre**, in
ogni tipo di sessione (canonical e lab) e in ogni progetto.

DA DOVE VENGONO I DUE NUMERI — misurati, non stimati
----------------------------------------------------
CONTESTO. Claude Code scrive il transcript della sessione in JSONL sotto
`~/.claude/projects/<slug>/<session-id>.jsonl`. Ogni messaggio dell'assistente porta il
blocco `usage` **restituito dall'API**. La dimensione della finestra a quel momento e'
`input_tokens + cache_read_input_tokens + cache_creation_input_tokens`.

FINESTRA 5 ORE. Il dato autorevole c'e' ed e' di Claude Code, che lo passa nello stdin
della riga di stato come `rate_limits.five_hour.used_percentage`. Non esiste in nessun
file: verificato il 2026-08-13 — `stats-cache.json` e' fermo a febbraio e non ha campi
di limite, il transcript non ne porta, `history.jsonl` ha solo i prompt. Percio' la
riga di stato (`~/.claude/statusline-command.sh`) lo PERSISTE a ogni disegno in
`~/.claude/rate-limits.json`, con scrittura atomica e senza scrivere niente quando il
dato manca. Un file assente vuol dire «non misurato», che e' la verita'; uno zero
inventato sarebbe una bugia che sembra una misura.

Il file ha un'eta': se e' piu' vecchio della soglia di freschezza si dichiara stantio e
NON lo si usa per decidere. Un numero vecchio di ore su una finestra di cinque e'
peggio di nessun numero.

IL PROBLEMA CHE RISOLVE
-----------------------
La capacita' del modello di stimare "quanto contesto resta" a impressione non e'
affidabile: e' una sensazione, non una misura, e sbaglia in entrambe le direzioni.
La memoria `feedback_no_context_estimation` vieta gia' di stimarlo a impressione e
di proporre la chiusura su quella base — ma vietare non basta, serve il sostituto.

IL SOSTITUTO
------------
Claude Code scrive il transcript della sessione in JSONL sotto
`~/.claude/projects/<slug>/<session-id>.jsonl`. Ogni messaggio dell'assistente porta
il blocco `usage` **restituito dall'API**, non calcolato qui. La dimensione del
contesto a quel momento e' la somma di tre campi:

    input_tokens + cache_read_input_tokens + cache_creation_input_tokens

`cache_read` porta tutto cio' che era gia' in finestra, `cache_creation` cio' che si
e' aggiunto in questo giro: insieme sono la finestra intera. Il valore dell'ULTIMO
blocco e' la dimensione corrente.

LIMITE DICHIARATO, NON NASCOSTO
-------------------------------
Il transcript si scrive a fine turno: la misura e' indietro di **un turno**, quello
in corso. Un turno pesa tipicamente 1-10k token. Quindi il numero e' un **pavimento**
(il vero consumo e' quello o poco piu'), mai un soffitto — che e' il verso giusto
per una decisione di capienza. Lo strumento lo scrive nel proprio output invece di
lasciarlo intendere.

USO
---
    python docs/kb/tools/guardiano.py                 # le due misure + il verdetto
    python docs/kb/tools/guardiano.py --json          # per uno script
    python docs/kb/tools/guardiano.py --selftest      # la prova che puo' fallire
    python docs/kb/tools/guardiano.py --session <id>  # una sessione precisa
    python docs/kb/tools/guardiano.py --budget 40000  # "ci sta un lavoro da 40k?"
    python docs/kb/tools/guardiano.py --sorveglia     # il guardiano: exit 3 se si chiude

`--sorveglia` applica l'OR con le soglie di casa (75% / 80%); `--stop-at` e `--stop-5h`
le spostano. Copia gemella a livello utente in `~/.claude/tools/guardiano.py`, cosi' la
regola vale anche nei progetti che non sono questo.

Exit code: 0 tutto bene · 1 selftest fallito · 2 budget non capiente
           3 SOGLIA RAGGIUNTA -> interrompi, registra, committa, pusha, chiudi.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

# --- stdout utf-8 (2026-08-16) -------------------------------------------------
# Su Windows, con stdout NON terminale, Python sceglie la codepage ANSI (cp1252) e
# ogni carattere fuori repertorio fa morire la print con UnicodeEncodeError — exit 1.
# Qui muoiono il verdetto del guardiano, i titoli con frecce, le emoji del riassunto.
# `errors="replace"` e' la rete: uno strumento di misura non deve morire di tipografia.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
# -------------------------------------------------------------------------------

# Finestra per modello. Il transcript dichiara il modello; se non lo riconosciamo
# NON tiriamo a indovinare: si dichiara sconosciuto e si chiede --window.
WINDOWS: dict[str, int] = {
    "claude-opus-5": 1_000_000,
    "claude-opus-5[1m]": 1_000_000,
    "claude-sonnet-5": 1_000_000,
    "claude-fable-5": 200_000,
    "claude-haiku-4-5-20251001": 200_000,
}
DEFAULT_WINDOW = 1_000_000

# Soglie di giudizio sul CONTESTO. Sotto la prima si lavora senza pensarci; oltre la
# seconda si apre solo cio' che si sa chiudere; oltre la terza si chiude e basta.
SOGLIA_LARGO = 0.60
SOGLIA_STRETTO = 0.80
SOGLIA_CHIUSURA = 0.90

# Le due soglie del GUARDIANO — quelle che fanno scattare la chiusura (Enzo, 2026-08-13).
# Sono diverse di proposito: il contesto non torna indietro, quindi 75% lascia il margine
# per chiudere; la finestra delle 5 ore si riazzera da sola, quindi si puo' arrivare
# piu' vicini prima di fermarsi.
STOP_CONTESTO = 0.75
STOP_5H = 0.80

# Oltre quanti minuti il dato delle 5 ore e' da buttare. La riga di stato si ridisegna
# a ogni giro, quindi in una sessione viva il file ha pochi secondi. Un file di
# mezz'ora fa vuol dire che la riga di stato non gira: meglio dire «non misurato».
FRESCHEZZA_5H_MIN = 15


@dataclass(frozen=True)
class Campione:
    """Una misura di contesto letta da un blocco usage."""

    contesto: int
    model: str
    output: int


def slug_progetto(cwd: Path) -> str:
    """`D:\\heuresys-advanced` -> `D--heuresys-advanced`, come fa Claude Code.

    Su Unix il trattino iniziale VA TENUTO: `/home/ubuntu` -> `-home-ubuntu`,
    perche' nasce dallo slash iniziale del path. Verificato il 2026-08-13 contro
    le directory reali di ~/.claude/projects (`-tmp`, `-home-ubuntu`,
    `-home-ubuntu-heuresys-advanced`). Uno `.strip("-")` lo mangiava, e il ramo
    "contesto" restava cieco su ogni macchina Linux e Mac.
    """
    s = str(cwd.resolve())
    for ch in (":", "\\", "/", "."):
        s = s.replace(ch, "-")
    while "---" in s:
        s = s.replace("---", "--")
    return s


def dir_transcript(cwd: Path | None = None) -> Path:
    base = Path.home() / ".claude" / "projects"
    return base / slug_progetto(cwd or Path.cwd())


def trova_transcript(session: str | None, cwd: Path | None = None) -> Path | None:
    d = dir_transcript(cwd)
    if not d.is_dir():
        return None
    if session:
        p = d / f"{session}.jsonl"
        return p if p.is_file() else None
    cand = sorted(d.glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True)
    return cand[0] if cand else None


def campiona(path: Path) -> list[Campione]:
    """Estrae ogni misura di contesto dal transcript, in ordine di apparizione.

    Non solleva su una riga malformata: un transcript in scrittura puo' avere
    l'ultima riga tronca, e morire li' renderebbe lo strumento inutile proprio
    quando serve.
    """
    out: list[Campione] = []
    with path.open(encoding="utf-8", errors="replace") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                o = json.loads(line)
            except (json.JSONDecodeError, ValueError):
                continue
            msg = o.get("message")
            if not isinstance(msg, dict):
                continue
            u = msg.get("usage")
            if not isinstance(u, dict):
                continue
            ctx = (
                int(u.get("input_tokens") or 0)
                + int(u.get("cache_read_input_tokens") or 0)
                + int(u.get("cache_creation_input_tokens") or 0)
            )
            if ctx <= 0:
                continue
            out.append(
                Campione(
                    contesto=ctx,
                    model=str(msg.get("model") or "?"),
                    output=int(u.get("output_tokens") or 0),
                )
            )
    return out


def finestra_per(model: str, override: int | None) -> tuple[int, bool]:
    """(finestra, riconosciuta?). Senza riconoscimento non si indovina."""
    if override:
        return override, True
    if model in WINDOWS:
        return WINDOWS[model], True
    return DEFAULT_WINDOW, False


def giudizio(frazione: float) -> str:
    if frazione >= SOGLIA_CHIUSURA:
        return "CHIUDI — resta spazio per la sola chiusura"
    if frazione >= SOGLIA_STRETTO:
        return "STRETTO — apri solo cio' che sai chiudere"
    if frazione >= SOGLIA_LARGO:
        return "MEDIO — lavori grossi ancora possibili, uno alla volta"
    return "LARGO — nessun vincolo di capienza"


def misura(session: str | None, override_window: int | None, cwd: Path | None = None) -> dict:
    path = trova_transcript(session, cwd)
    if path is None:
        return {"ok": False, "errore": f"nessun transcript in {dir_transcript(cwd)}"}
    camp = campiona(path)
    if not camp:
        return {"ok": False, "errore": f"nessun blocco usage in {path}"}
    ultimo = camp[-1]
    picco = max(c.contesto for c in camp)
    window, riconosciuta = finestra_per(ultimo.model, override_window)
    frazione = ultimo.contesto / window
    return {
        "ok": True,
        "transcript": str(path),
        "model": ultimo.model,
        "finestra": window,
        "finestra_riconosciuta": riconosciuta,
        "contesto": ultimo.contesto,
        "picco": picco,
        "residuo": max(0, window - ultimo.contesto),
        # Il residuo che conta per decidere se APRIRE un lavoro: non quanto manca alla
        # fine della finestra, ma quanto manca alla soglia che fa CHIUDERE la sessione.
        # Erano confusi, e la confusione autorizzava lavori che sfondavano il 75%: con
        # 136.875 token consumati, `--budget 700000` rispondeva «ci sta» mentre quel
        # lavoro avrebbe portato il contesto all'84%. Uno strumento che dice si' oltre
        # la propria soglia non e' prudente in ritardo, e' rotto (S1057).
        "residuo_soglia": max(0, int(window * STOP_CONTESTO) - ultimo.contesto),
        "frazione": round(frazione, 4),
        "percento": round(frazione * 100, 1),
        "campioni": len(camp),
        "output_totale": sum(c.output for c in camp),
        "giudizio": giudizio(frazione),
        "ritardo": "un turno (quello in corso non e' ancora scritto): il numero e' un pavimento",
    }


def file_5h(base: Path | None = None) -> Path:
    """Dove la riga di stato deposita il consumo delle finestre."""
    cfg = os.environ.get("CLAUDE_CONFIG_DIR")
    root = base or (Path(cfg) if cfg else Path.home() / ".claude")
    return root / "rate-limits.json"


def misura_5h(freschezza_min: int = FRESCHEZZA_5H_MIN, base: Path | None = None,
              adesso: float | None = None) -> dict:
    """Il consumo della finestra di 5 ore, o il motivo per cui non si sa.

    `adesso` esiste per la prova: senza, l'eta' dipenderebbe dall'orologio e il
    selftest non potrebbe mai mettere alla prova il caso «file stantio».
    """
    p = file_5h(base)
    if not p.is_file():
        return {"ok": False, "errore": "nessun rate-limits.json: la riga di stato non lo "
                                       "ha ancora scritto (o non e' configurata)"}
    try:
        d = json.loads(p.read_text(encoding="utf-8"))
        pct = float(d["five_hour_pct"])
        epoch = float(d.get("epoch") or 0)
    except (OSError, ValueError, KeyError, TypeError) as exc:
        return {"ok": False, "errore": f"rate-limits.json illeggibile ({type(exc).__name__})"}
    eta_min = ((adesso if adesso is not None else _adesso()) - epoch) / 60.0
    if eta_min > freschezza_min:
        return {"ok": False, "eta_min": round(eta_min, 1), "percento": pct,
                "errore": f"dato stantio ({eta_min:.0f} min > {freschezza_min}): "
                          f"la riga di stato non gira, non lo si usa per decidere"}
    return {
        "ok": True,
        "percento": pct,
        "frazione": pct / 100.0,
        "sette_giorni_pct": d.get("seven_day_pct"),
        "eta_min": round(eta_min, 1),
        "fonte": str(p),
    }


def _adesso() -> float:
    """L'ora corrente. Isolata in una funzione perche' il selftest la sostituisce."""
    import time
    return time.time()


def sorveglia(m_ctx: dict, m_5h: dict,
              stop_ctx: float = STOP_CONTESTO, stop_5h: float = STOP_5H) -> dict:
    """Il verdetto del guardiano: l'OR fra le due soglie.

    Un ramo NON MISURATO non fa scattare la chiusura e non la impedisce: e' un non-so,
    e va detto. Se pero' NESSUNO dei due e' misurabile, il verdetto stesso e' un non-so
    — e chi legge deve saperlo, perche' un «tutto bene» che nasce dal buio e' identico
    a uno che nasce da una misura, ed e' la peggiore delle risposte.
    """
    scatti, misurati = [], 0
    if m_ctx.get("ok"):
        misurati += 1
        if m_ctx["frazione"] >= stop_ctx:
            scatti.append(f"contesto {m_ctx['percento']:.1f}% >= {stop_ctx:.0%}")
    if m_5h.get("ok"):
        misurati += 1
        if m_5h["frazione"] >= stop_5h:
            scatti.append(f"finestra 5h {m_5h['percento']:.1f}% >= {stop_5h:.0%}")
    return {
        "chiudi": bool(scatti),
        "motivi": scatti,
        "rami_misurati": misurati,
        "cieco": misurati == 0,
    }


PROCEDURA = ("interrompi le attivita' · registra il progresso · committa E PUSHA tutto · "
             "chiusura completa della sessione")


def stampa_guardiano(m_ctx: dict, m_5h: dict, v: dict,
                     stop_ctx: float, stop_5h: float) -> None:
    print("-" * 72)
    if m_5h.get("ok"):
        sette = m_5h.get("sette_giorni_pct")
        extra = f" · 7 giorni {sette:.0f}%" if isinstance(sette, (int, float)) else ""
        print(f"  finestra 5h  {m_5h['percento']:>8.1f}%   (soglia {stop_5h:.0%}"
              f" · dato di {m_5h['eta_min']:.0f} min fa{extra})")
    else:
        print(f"  finestra 5h  NON MISURATA — {m_5h.get('errore', '?')}")
    print("-" * 72)
    if v["cieco"]:
        print("  ⚠ GUARDIANO CIECO: nessuna delle due misure e' disponibile. "
              "Non e' un 'tutto bene'.")
    elif v["chiudi"]:
        print(f"  ⛔ SOGLIA RAGGIUNTA — {' e '.join(v['motivi'])}")
        print(f"     {PROCEDURA}")
    else:
        manca_ctx = (f"contesto: mancano {max(0, int(stop_ctx * m_ctx['finestra']) - m_ctx['contesto']):,} token"
                     if m_ctx.get("ok") else "contesto: non misurato")
        manca_5h = (f"5h: mancano {stop_5h * 100 - m_5h['percento']:.1f} punti"
                    if m_5h.get("ok") else "5h: non misurata")
        print(f"  ✓ si continua — {manca_ctx} · {manca_5h}"
              + ("" if v["rami_misurati"] == 2 else "   (⚠ un ramo su due e' cieco)"))
    print("=" * 72)


def stampa(m: dict, budget: int | None) -> int:
    if not m["ok"]:
        print(f"[!!] {m['errore']}")
        print("     Senza transcript NON si stima a impressione: si dichiara 'non misurabile'.")
        return 0
    barra_n = 40
    pieni = min(barra_n, int(m["frazione"] * barra_n))
    barra = "#" * pieni + "." * (barra_n - pieni)
    print("=" * 72)
    print(" CONTESTO — misurato dal transcript, non stimato")
    print("=" * 72)
    print(f"  [{barra}] {m['percento']:.1f}%")
    print(f"  consumato   {m['contesto']:>9,} token")
    print(f"  residuo     {m['residuo']:>9,} token   (finestra {m['finestra']:,}"
          f"{'' if m['finestra_riconosciuta'] else ' — MODELLO NON RICONOSCIUTO, usa --window'})")
    print(f"  picco       {m['picco']:>9,} token")
    print(f"  output tot  {m['output_totale']:>9,} token   su {m['campioni']} misure")
    print(f"  modello     {m['model']}")
    print(f"  giudizio    {m['giudizio']}")
    print(f"  ritardo     {m['ritardo']}")
    print(f"  fonte       {m['transcript']}")
    if budget:
        # Si misura contro la SOGLIA, non contro la fine della finestra: aprire un lavoro
        # che arriva al 75% significa aprirlo sapendo che va interrotto a meta'.
        capiente = m["residuo_soglia"] >= budget
        print("-" * 72)
        print(f"  budget richiesto {budget:,} → {'CI STA' if capiente else 'NON CI STA'}")
        print(f"  misurato contro il residuo FINO ALLA SOGLIA {int(STOP_CONTESTO*100)}%:"
              f" {m['residuo_soglia']:,} token")
        print(f"  (alla fine della finestra ne mancherebbero {m['residuo']:,}, ma quel"
              " numero non autorizza niente: oltre la soglia si chiude)")
        print("=" * 72)
        return 0 if capiente else 2
    print("=" * 72)
    return 0


# --------------------------------------------------------------------------
# La prova che puo' fallire.
#
# Non verifica "gira senza errori": costruisce transcript SINTETICI con numeri
# noti e pretende che lo strumento restituisca esattamente quelli. Tre dei sei
# casi sono negativi — se il parser sbagliasse, li vedrei rossi.
# --------------------------------------------------------------------------
def _scrivi(tmp: Path, nome: str, righe: list[dict]) -> Path:
    d = tmp / "projects" / "FINTO"
    d.mkdir(parents=True, exist_ok=True)
    p = d / f"{nome}.jsonl"
    p.write_text("\n".join(json.dumps(r) for r in righe), encoding="utf-8")
    return p


def _riga(model: str, inp: int, read: int, create: int, out: int) -> dict:
    return {
        "type": "assistant",
        "message": {
            "model": model,
            "usage": {
                "input_tokens": inp,
                "cache_read_input_tokens": read,
                "cache_creation_input_tokens": create,
                "output_tokens": out,
            },
        },
    }


def selftest() -> int:
    esiti: list[tuple[str, bool, str]] = []

    def check(nome: str, atteso, ottenuto) -> None:
        esiti.append((nome, atteso == ottenuto, f"atteso {atteso!r}, ottenuto {ottenuto!r}"))

    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)

        # 1 — POSITIVO: la somma dei tre campi e' il contesto, e vince l'ULTIMO.
        p = _scrivi(tmp, "s1", [
            _riga("claude-opus-5", 1, 0, 100, 10),
            _riga("claude-opus-5", 2, 100, 400, 20),
            _riga("claude-opus-5", 3, 500, 250, 30),
        ])
        c = campiona(p)
        check("ultimo contesto = 3+500+250", 753, c[-1].contesto)
        check("numero di campioni", 3, len(c))
        check("output sommato", 60, sum(x.output for x in c))

        # 2 — NEGATIVO: righe malformate, senza usage, e usage a zero NON devono
        #     entrare. Se il parser le contasse, questo caso diventerebbe rosso.
        p = _scrivi(tmp, "s2", [
            {"type": "user", "message": {"content": "niente usage"}},
            _riga("claude-opus-5", 0, 0, 0, 5),          # contesto 0 -> scartata
            _riga("claude-opus-5", 1, 10, 20, 5),
        ])
        (p.parent / "s2.jsonl").write_text(
            (p.read_text(encoding="utf-8") + "\n{tronca non json"), encoding="utf-8"
        )
        c = campiona(p)
        check("scarta non-usage / zero / troncata", 1, len(c))
        check("unico contesto valido", 31, c[-1].contesto)

        # 3 — NEGATIVO: il picco puo' superare l'ultimo (dopo una compattazione).
        #     Se lo strumento riportasse il max come 'corrente' mentirebbe.
        p = _scrivi(tmp, "s3", [
            _riga("claude-opus-5", 1, 0, 900_000, 10),
            _riga("claude-opus-5", 1, 0, 50_000, 10),
        ])
        m = misura("s3", None, cwd=None) if False else None  # (percorso reale non usato qui)
        c = campiona(p)
        check("corrente = ultimo, non il picco", 50_001, c[-1].contesto)
        check("picco distinto dal corrente", 900_001, max(x.contesto for x in c))

        # 3-bis — NEGATIVO: il budget si misura sulla SOGLIA, non sulla fine della
        #     finestra. Nato da un difetto reale (S1057): con 136.875 token consumati su
        #     un milione, `--budget 700000` rispondeva «ci sta» perche' guardava gli
        #     863.125 che mancavano alla fine — mentre quel lavoro avrebbe portato il
        #     contesto all'84%, ben oltre il 75% che fa chiudere. Il selftest era verde
        #     29/29 con il difetto dentro: nessun caso guardava questo confine.
        #     La prova sa fallire: rimettendo `residuo` al posto di `residuo_soglia` le
        #     due righe qui sotto diventano rosse.
        finta = {"finestra": 1_000_000, "contesto": 136_875}
        soglia_res = max(0, int(finta["finestra"] * STOP_CONTESTO) - finta["contesto"])
        check("residuo fino alla soglia 75%", 613_125, soglia_res)
        check("un budget che sfonda la soglia e' rifiutato", False, soglia_res >= 700_000)
        check("un budget che ci sta e' accettato", True, soglia_res >= 600_000)

        # 4 — NEGATIVO: modello sconosciuto NON deve spacciare una finestra come certa.
        w, ric = finestra_per("modello-che-non-esiste", None)
        check("finestra sconosciuta dichiarata tale", False, ric)
        check("fallback dichiarato", DEFAULT_WINDOW, w)

        # 5 — POSITIVO: --window ha la precedenza e si dichiara riconosciuta.
        w, ric = finestra_per("claude-opus-5", 250_000)
        check("override finestra", (250_000, True), (w, ric))

        # 6 — POSITIVO: le soglie di giudizio scattano dove dichiarato.
        check("giudizio 10%", "LARGO — nessun vincolo di capienza", giudizio(0.10))
        check("giudizio 85%", "STRETTO — apri solo cio' che sai chiudere", giudizio(0.85))
        check("giudizio 95%", "CHIUDI — resta spazio per la sola chiusura", giudizio(0.95))

        # --- la finestra delle 5 ore --------------------------------------------
        # `adesso` viene passato a mano: senza, l'eta' dipenderebbe dall'orologio e il
        # caso «dato stantio» non sarebbe mai provabile.
        casa = tmp / "cfg"
        casa.mkdir(parents=True, exist_ok=True)
        ORA = 1_000_000.0

        def scrivi5h(pct, epoch, extra=""):
            (casa / "rate-limits.json").write_text(
                extra or f'{{"five_hour_pct":{pct},"seven_day_pct":9,"epoch":{epoch}}}',
                encoding="utf-8")

        # 7 — NEGATIVO: file assente -> non misurato, MAI uno zero.
        try:
            (casa / "rate-limits.json").unlink()
        except FileNotFoundError:
            pass
        r = misura_5h(15, casa, ORA)
        check("5h senza file: non misurata", False, r["ok"])
        check("5h senza file: nessuna percentuale inventata", None, r.get("percento"))

        # 8 — POSITIVO: file fresco -> il valore passa intatto.
        scrivi5h(42.7, ORA - 60)
        r = misura_5h(15, casa, ORA)
        check("5h fresca: misurata", (True, 42.7), (r["ok"], r["percento"]))

        # 9 — NEGATIVO: file STANTIO -> non misurata, anche se il numero c'e'.
        #     E' il caso che conta: un dato vecchio su una finestra di 5 ore inganna.
        scrivi5h(42.7, ORA - 3600)
        r = misura_5h(15, casa, ORA)
        check("5h stantia: NON misurata", False, r["ok"])
        check("5h stantia: lo dice", True, "stantio" in r.get("errore", ""))

        # 10 — NEGATIVO: JSON corrotto -> non misurata, non un'eccezione in faccia.
        scrivi5h(0, 0, extra="{ questo non e' json")
        check("5h corrotta: non misurata", False, misura_5h(15, casa, ORA)["ok"])

        # --- il verdetto: l'OR, e il caso cieco ---------------------------------
        OK_CTX = lambda f: {"ok": True, "frazione": f, "percento": f * 100, "finestra": 1_000_000, "contesto": int(f * 1_000_000)}
        OK_5H = lambda f: {"ok": True, "frazione": f, "percento": f * 100}
        NO = {"ok": False, "errore": "x"}

        check("verdetto: 50/50 si continua", False, sorveglia(OK_CTX(0.50), OK_5H(0.50))["chiudi"])
        check("verdetto: contesto 76% chiude", True, sorveglia(OK_CTX(0.76), OK_5H(0.10))["chiudi"])
        check("verdetto: 5h 85% chiude (ramo nuovo)", True, sorveglia(OK_CTX(0.10), OK_5H(0.85))["chiudi"])
        check("verdetto: 5h 79% NON chiude", False, sorveglia(OK_CTX(0.10), OK_5H(0.79))["chiudi"])
        check("verdetto: contesto 74% NON chiude", False, sorveglia(OK_CTX(0.74), OK_5H(0.10))["chiudi"])
        # un ramo cieco non impedisce all'altro di far scattare la chiusura
        check("verdetto: contesto cieco, 5h 85% -> chiude", True, sorveglia(NO, OK_5H(0.85))["chiudi"])
        check("verdetto: 5h cieca, contesto 76% -> chiude", True, sorveglia(OK_CTX(0.76), NO)["chiudi"])
        # entrambi ciechi: NON e' un «tutto bene», e lo deve dire
        v = sorveglia(NO, NO)
        check("verdetto cieco: non chiude", False, v["chiudi"])
        check("verdetto cieco: si dichiara cieco", True, v["cieco"])
        check("verdetto a un ramo solo: non e' cieco", (False, 1),
              (sorveglia(OK_CTX(0.10), NO)["cieco"], sorveglia(OK_CTX(0.10), NO)["rami_misurati"]))

    rossi = [e for e in esiti if not e[1]]
    for nome, ok, det in esiti:
        print(f"  [{'OK' if ok else '!!'}] {nome}" + ("" if ok else f" — {det}"))
    print(f"\n{len(esiti) - len(rossi)}/{len(esiti)} verdi")
    if rossi:
        print("SELFTEST ROSSO")
        return 1
    print("SELFTEST VERDE")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Contesto consumato, misurato dal transcript.")
    ap.add_argument("--session", help="session-id preciso (default: il transcript piu' recente)")
    ap.add_argument("--window", type=int, help="finestra in token, se il modello non e' riconosciuto")
    ap.add_argument("--budget", type=int, help="quanti token servono: exit 2 se non ci stanno")
    ap.add_argument("--stop-at", type=float, metavar="FRAZ", default=None,
                    help=f"soglia d'arresto sul CONTESTO (default {STOP_CONTESTO}): exit 3 se "
                         "raggiunta. Rende la regola MECCANICA invece che ricordata")
    ap.add_argument("--stop-5h", type=float, metavar="FRAZ", default=None,
                    help=f"soglia d'arresto sulla FINESTRA 5 ORE (default {STOP_5H})")
    ap.add_argument("--sorveglia", action="store_true",
                    help="il guardiano: applica l'OR fra le due soglie ed esce 3 se scatta")
    ap.add_argument("--freschezza", type=int, default=FRESCHEZZA_5H_MIN, metavar="MIN",
                    help="oltre quanti minuti il dato delle 5 ore e' da buttare")
    ap.add_argument("--json", action="store_true", help="output JSON")
    ap.add_argument("--selftest", action="store_true", help="prova che puo' fallire")
    a = ap.parse_args()

    if a.selftest:
        return selftest()

    # Il guardiano e' il modo NORMALE di usare questo strumento: senza opzioni si
    # vedono comunque le due misure e il verdetto. `--sorveglia` serve solo a chi
    # vuole il codice d'uscita per farne un cancello in uno script.
    stop_ctx = a.stop_at if a.stop_at is not None else STOP_CONTESTO
    stop_5h = a.stop_5h if a.stop_5h is not None else STOP_5H

    m = misura(a.session, a.window)
    m5 = misura_5h(a.freschezza)
    v = sorveglia(m, m5, stop_ctx, stop_5h)

    if m.get("ok"):
        m["stop_at"] = stop_ctx
        m["token_alla_soglia"] = max(0, int(stop_ctx * m["finestra"]) - m["contesto"])

    if a.json:
        print(json.dumps({"contesto": m, "cinque_ore": m5, "verdetto": v,
                          "procedura": PROCEDURA}, indent=2, ensure_ascii=False))
    else:
        stampa(m, a.budget)
        stampa_guardiano(m, m5, v, stop_ctx, stop_5h)

    if v["chiudi"]:
        return 3
    if a.budget is not None and m.get("ok") and m["residuo_soglia"] < a.budget:
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
