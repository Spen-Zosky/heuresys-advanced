#!/usr/bin/env python3
"""Batteria del cancello di verifica — sa dire ROSSO, o e' solo un timbro?

Perche' esiste (S1054). `verify_gate.py` e' l'unico guardiano di fine turno, e
fino all'11/08/2026 nessuno lo aveva mai visto dire rosso in modo controllato:
lo si osservava verde e si concludeva che funzionasse. Lo stesso giorno si e'
scoperto che il suo ramo «nessuna modifica da verificare» scriveva `green` senza
aver eseguito niente — un verde per ASSENZA di misura, che per giunta cancellava
dal file il rosso precedente. Un guardiano che nessuno prova e' un guardiano di
cui si spera.

Nove prove, in due famiglie:
  A-E  il verdetto: rosso, scaduto, non-misurato, verde-fresco, freno
  F-I  il troncamento dell'elenco dei falliti non e' muto (#184)

Guardie (ognuna nasce da un difetto reale di questo repo):
  * il verdetto vero viene salvato, ripristinato e **riconfrontato per impronta**:
    un ripristino non verificato non e' un ripristino;
  * il freno eventualmente presente viene messo da parte e rimesso nel `finally`
    — se il processo muore a meta', il freno resta TOLTO, cioe' si sbaglia nel
    verso severo, mai in quello permissivo;
  * il file di prova sotto `apps/api/` non deve sopravvivere alla corsa.

Si esegue da `run-shell-tests.sh`, che e' la suite instradata su `scripts/`.
Scriverla senza agganciarla la lascerebbe fuori dal presidio come le batterie
di #180 — una delle quali resto' rossa per giorni senza che nessuno lo sapesse.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
VERDICT = REPO / ".zp" / "verify-verdict.json"
SALVA_VERDETTO = REPO / ".zp" / "verify-verdict.json.in-prova"
BRAKE = REPO / ".zp" / "verify-off"
SALVA_FRENO = REPO / ".zp" / "verify-off.in-prova"
TMP = REPO / "apps" / "api" / ".prova-cancello.tmp"

PASS = 0
FAIL = 0


def esito(ok: bool, testo: str) -> None:
    global PASS, FAIL
    if ok:
        PASS += 1
        print(f"  ok   {testo}")
    else:
        FAIL += 1
        print(f"  FAIL {testo}")


def carica_modulo():
    p = REPO / "docs" / "kb" / "tools" / "verify_gate.py"
    spec = importlib.util.spec_from_file_location("vg_sotto_prova", p)
    if spec is None or spec.loader is None:
        raise SystemExit(f"non riesco a caricare {p}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else "<assente>"


def check() -> tuple[int, str]:
    r = subprocess.run([sys.executable, "docs/kb/tools/verify_gate.py", "check"],
                       cwd=REPO, capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    return r.returncode, (r.stdout or "").strip()


def scrivi_verdetto(results: list[dict], verdict: str) -> None:
    VERDICT.parent.mkdir(parents=True, exist_ok=True)
    VERDICT.write_text(json.dumps({
        "input_hash": "in-prova", "head": "in-prova", "generated_at": "in-prova",
        "routed": [r["suite"] for r in results], "results": results,
        "verdict": verdict,
    }, indent=2, ensure_ascii=False), encoding="utf-8")


def riga(nome: str, exit_code: int, scope: str) -> dict:
    return {"suite": nome, "level": "L0", "cmd": "in-prova", "exit": exit_code,
            "duration_s": 0.0, "log": "in-prova", "righe": 0, "falliti": [],
            "falliti_totale": 0, "scope": scope, "tail": []}


def prove_sul_verdetto(vg) -> None:
    """A-E — il cancello distingue i quattro stati, e il freno li zittisce tutti.

    Il verdetto si costruisce su TUTTE le suite che il working tree corrente
    instrada, non su due scelte a mano. La prima stesura fissava typecheck+test-api
    e passava solo finche' il working tree non toccava altro: appena la corsa
    includeva `scripts/` e `docs/kb/`, il caso «verde e fresco» diventava rosso per
    le due suite che il verdetto non nominava — la prova misurava il proprio
    ambiente, non il cancello. Una batteria permanente gira ogni volta in
    condizioni diverse: deve derivare l'atteso dallo stato, mai presumerlo.
    """
    # Serve un file che INSTRADI qualcosa: a working tree pulito il cancello esce
    # prima ancora di guardare il verdetto, ed e' verde per costruzione.
    TMP.write_text("prova della batteria del cancello\n", encoding="utf-8")
    files = vg.changed_files()
    instradate = vg.route(files)
    if "test-api" not in instradate:
        esito(False, "precondizione: il file di prova non instrada test-api "
                     f"(instradate: {instradate})")
        return

    def stesura(rossa: str | None = None, scope_vero: bool = True) -> list[dict]:
        return [riga(s, 1 if s == rossa else 0,
                     vg.content_hash(vg.files_for_suite(s, files)) if scope_vero
                     else "impronta-di-un-altro-contenuto")
                for s in instradate]

    scrivi_verdetto(stesura(rossa="test-api"), "red")
    code, out = check()
    esito(code == 1 and "ROSSA" in out, f"A · verdetto rosso -> BLOCCO [{out[:70]}]")

    scrivi_verdetto(stesura(scope_vero=False), "green")
    code, out = check()
    esito(code == 1 and "da verificare" in out,
          f"B · verde ma contenuto cambiato -> BLOCCO [{out[:70]}]")

    # C e' il caso che S1054 ha creato: prima di allora `run` scriveva `green` qui,
    # e il cancello lo prendeva per buono.
    scrivi_verdetto([], "not-measured")
    code, out = check()
    esito(code == 1 and "da verificare" in out,
          f"C · nessuna misura -> BLOCCO [{out[:70]}]")

    scrivi_verdetto(stesura(), "green")
    code, out = check()
    esito(code == 0 and "verde e fresco" in out,
          f"D · verde e fresco -> VERDE [{out[:70]}]")

    scrivi_verdetto(stesura(rossa="test-api"), "red")
    BRAKE.write_text("freno della batteria — rimosso nel finally\n", encoding="utf-8")
    code, out = check()
    BRAKE.unlink(missing_ok=True)
    esito(code == 0 and "freno tirato" in out,
          f"E · freno sopra un rosso -> VERDE [{out[:70]}]")


def prove_sul_troncamento(vg) -> None:
    """F-I — l'elenco dei falliti dichiara quanti erano davvero (#184)."""
    tetto = vg.TETTO_FALLITI
    lista, tot = vg.estrai_falliti(
        "\n".join(f" FAIL  test/modulo-{i:03d}.test.ts" for i in range(tetto + 10)))
    esito(len(lista) == tetto and tot == tetto + 10,
          f"F · {tetto + 10} caduti -> {len(lista)} elencati, totale {tot}")

    lista, tot = vg.estrai_falliti(
        "\n".join(f" FAIL  test/x{i}.test.ts" for i in range(3)))
    esito(len(lista) == 3 and tot == 3, f"G · 3 caduti -> nessun taglio, totale {tot}")

    lista, tot = vg.estrai_falliti("tutto verde, nessun fallimento")
    esito(lista == [] and tot == 0, f"H · 0 caduti -> totale {tot}, nessun nome inventato")

    lista, tot = vg.estrai_falliti(
        " FAIL  test/a.test.ts\n FAIL  test/a.test.ts\n FAIL  test/b.test.ts")
    esito(tot == 2, f"I · vitest ripete i FAIL -> totale {tot} (atteso 2)")


def main() -> int:
    vg = carica_modulo()
    print("batteria del cancello di verifica (verify_gate.py)")

    impronta_iniziale = sha(VERDICT)
    freno_cera = BRAKE.exists()
    if VERDICT.exists():
        shutil.copy2(VERDICT, SALVA_VERDETTO)
    if freno_cera:
        shutil.move(str(BRAKE), str(SALVA_FRENO))

    try:
        prove_sul_verdetto(vg)
        prove_sul_troncamento(vg)
    finally:
        TMP.unlink(missing_ok=True)
        BRAKE.unlink(missing_ok=True)
        if SALVA_FRENO.exists():
            shutil.move(str(SALVA_FRENO), str(BRAKE))
        if SALVA_VERDETTO.exists():
            shutil.copy2(SALVA_VERDETTO, VERDICT)
            SALVA_VERDETTO.unlink()
        elif impronta_iniziale == "<assente>":
            VERDICT.unlink(missing_ok=True)

        # Le post-condizioni proteggono cio' che NON doveva cambiare, non solo
        # cio' che doveva: sono prove anche loro, e contano nel totale.
        esito(sha(VERDICT) == impronta_iniziale,
              f"post · verdetto reale ripristinato ({impronta_iniziale[:12]})")
        esito(BRAKE.exists() == freno_cera,
              f"post · freno com'era prima (c'era: {freno_cera})")
        esito(not TMP.exists(), "post · nessun file di prova lasciato in apps/api/")

    print(f"\n{PASS} ok, {FAIL} failed")
    return 0 if FAIL == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
