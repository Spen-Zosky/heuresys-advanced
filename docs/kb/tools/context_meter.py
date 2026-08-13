#!/usr/bin/env python3
"""
context_meter.py — quanto contesto ho consumato, misurato invece che stimato.

IL PROBLEMA CHE RISOLVE (Enzo, 2026-08-13, S1056)
-------------------------------------------------
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
    python docs/kb/tools/context_meter.py                 # rapporto leggibile
    python docs/kb/tools/context_meter.py --json          # per uno script
    python docs/kb/tools/context_meter.py --selftest      # la prova che puo' fallire
    python docs/kb/tools/context_meter.py --session <id>  # una sessione precisa
    python docs/kb/tools/context_meter.py --budget 40000  # "ci sta un lavoro da 40k?"

Exit code: 0 sempre, tranne --selftest fallito (1) e --budget non capiente (2).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

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

# Soglie di giudizio. Sotto la prima si lavora senza pensarci; oltre la seconda si
# apre solo cio' che si sa chiudere; oltre la terza si chiude e basta.
SOGLIA_LARGO = 0.60
SOGLIA_STRETTO = 0.80
SOGLIA_CHIUSURA = 0.90


@dataclass(frozen=True)
class Campione:
    """Una misura di contesto letta da un blocco usage."""

    contesto: int
    model: str
    output: int


def slug_progetto(cwd: Path) -> str:
    """`D:\\heuresys-advanced` -> `D--heuresys-advanced`, come fa Claude Code."""
    s = str(cwd.resolve())
    for ch in (":", "\\", "/", "."):
        s = s.replace(ch, "-")
    while "---" in s:
        s = s.replace("---", "--")
    return s.strip("-") if not s.startswith("D--") else s


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
        "frazione": round(frazione, 4),
        "percento": round(frazione * 100, 1),
        "campioni": len(camp),
        "output_totale": sum(c.output for c in camp),
        "giudizio": giudizio(frazione),
        "ritardo": "un turno (quello in corso non e' ancora scritto): il numero e' un pavimento",
    }


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
        capiente = m["residuo"] >= budget
        print("-" * 72)
        print(f"  budget richiesto {budget:,} → {'CI STA' if capiente else 'NON CI STA'}"
              f" (residuo {m['residuo']:,})")
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
    ap.add_argument("--stop-at", type=float, metavar="FRAZ",
                    help="soglia d'arresto decisa dall'utente (es. 0.75): exit 3 se raggiunta. "
                         "Serve a rendere la regola MECCANICA invece che ricordata")
    ap.add_argument("--json", action="store_true", help="output JSON")
    ap.add_argument("--selftest", action="store_true", help="prova che puo' fallire")
    a = ap.parse_args()

    if a.selftest:
        return selftest()

    m = misura(a.session, a.window)
    if a.stop_at and m.get("ok"):
        m["stop_at"] = a.stop_at
        m["stop_raggiunta"] = m["frazione"] >= a.stop_at
        m["token_alla_soglia"] = max(0, int(a.stop_at * m["finestra"]) - m["contesto"])
    if a.json:
        print(json.dumps(m, indent=2, ensure_ascii=False))
        if not m["ok"]:
            return 0
        if m.get("stop_raggiunta"):
            return 3
        return 0 if (a.budget is None or m["residuo"] >= a.budget) else 2
    rc = stampa(m, a.budget)
    if m.get("ok") and a.stop_at:
        raggiunta = m["stop_raggiunta"]
        print(f"  SOGLIA D'ARRESTO {a.stop_at:.0%} → "
              + ("⛔ RAGGIUNTA: interrompi, registra, committa, pusha, chiudi."
                 if raggiunta else
                 f"non raggiunta, mancano {m['token_alla_soglia']:,} token"))
        print("=" * 72)
        if raggiunta:
            return 3
    return rc


if __name__ == "__main__":
    sys.exit(main())
