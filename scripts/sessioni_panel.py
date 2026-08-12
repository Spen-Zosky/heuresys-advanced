#!/usr/bin/env python3
"""sessioni_panel.py — plancia live delle sessioni Claude Code attive su questo
progetto. Portata nel repo il 2026-08-08 (accanto a scripts/zp_panel.py,
stesso pattern di promozione dal design-lab: S1043/#97), sulla base condivisa
scripts/panel_base.py.

Cosa mostra
-----------
Per ogni sessione: se e' viva, in che modalita', COSA sta facendo in questo
momento (quale strumento, da quanto), la cronologia scorrevole degli eventi,
gli strumenti usati, i file toccati, i comandi lanciati, il ritmo di lavoro,
i task in background. Piu' le viste incrociate che una sessione sola non puo'
avere di se stessa: le COLLISIONI (due sessioni che scrivono lo stesso file),
i processi di test in corso, lo stato del cancello di verifica e la
posizione di git.

Da dove legge — verificato, non assunto
---------------------------------------
  · `~/.claude/projects/<slug>/<sid>.jsonl`  — il transcript, in append
    mentre la sessione gira.
  · `%TEMP%/claude/<slug>/<sid>/tasks/*.output` e `scratchpad/` — il lavoro
    della sessione, per scoprire un esito mai raccolto.
  · `<padre del repo>/.heuresys-session-mode/<sid>.json` — la modalita'
    dichiarata (scritta da scripts/hooks/session_mode.py).
  · `Get-CimInstance Win32_Process` — i processi node/python con avvio e CPU.
  · `.zp/verify-verdict.json` — il cancello di verifica.
  · `git` — HEAD, ramo, file sporchi, commit non spinti (contro il remoto
    vero, con `ls-remote`: mai un numero inventato se la rete non risponde).

Vincoli di progetto (INVARIANTE, non rinegoziabile da qui)
-----------------------------------------------------------
  · NESSUNA AZIONE SUL PROGETTO. Le uniche due azioni ammesse sono sulla
    plancia stessa (`aggiorna`, `riavvia`): non toccano file, database, git
    ne' altri processi.
  · Bind su 0.0.0.0 di default — la pagina si guarda anche dal telefono; e
    la lettura e' APERTA (`aperta_default=True`), quindi chiunque sulla rete
    locale la legge senza chiave. `--solo-locale` la chiude sul solo PC,
    `--con-chiave` la lascia in rete ma pretende la chiave. Misurato il
    2026-08-12 con netstat: 0.0.0.0:8479 — questa riga diceva «127.0.0.1 di
    default» ed era il contrario del codice (panel_base.avvia_server).
  · REDAZIONE dei segreti (scripts/panel_base.py) su ogni testo che potrebbe
    portare credenziali lette da un transcript.
  · Zero dipendenze Python. React/ReactDOM/htm sono in scripts/vendor/,
    serviti in locale: la pagina non chiama nessun CDN.

Uso
---
    python scripts/sessioni_panel.py            # http://127.0.0.1:8479
    python scripts/sessioni_panel.py --porta N
    python scripts/sessioni_panel.py --sintesi   # fotografia leggibile, da terminale
    python scripts/sessioni_panel.py --stampa    # la stessa, in JSON
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import panel_base as pb  # noqa: E402

QUI = Path(__file__).resolve().parent          # scripts/
REPO = Path(os.environ.get("HRX_REPO", QUI.parent))  # radice del repo (come zp_panel.py)
VENDOR = QUI / "vendor"
STATICI = QUI / "sessioni-panel"

PORTA = 8479
VIVA_SEC = 180
SOSPETTO_SEC = 900
ABBANDONO_SEC = 7200
SCARTO_SEC = 120
CODA_BYTE = 393216
EVENTI = 120
# Quante sessioni mostrare E analizzare a fondo — STESSO numero apposta (2026-08-08:
# prima erano scollegati, 10 analizzate ma 18 mostrate: le 8 piu' vecchie finivano in
# un generico "spenta" non perche' fossero davvero indistinguibili, ma solo perche'
# nessuno le aveva guardate da vicino).
MOSTRA = 24
RITMO_MIN = 40

# Stato di runtime (chiave d'accesso LAN): gitignorato, NON dentro .zp/ che e'
# di zero-pending-loop. Cartella dedicata e condivisa dalle nuove plance.
CHIAVE_FILE = REPO / ".panel" / "sessioni-panel-chiave.txt"


def slug_progetto(repo: Path) -> str:
    return str(repo).replace(":", "-").replace("\\", "-").replace("/", "-")


PROGETTI = Path.home() / ".claude" / "projects" / slug_progetto(REPO)
STORE_MODI = REPO.parent / ".heuresys-session-mode"

reda = pb.reda
CACHE = pb.Cache()
comando = pb.comando


# ------------------------------------------------------------------- utilita'
def _ora(iso: str | None) -> float | None:
    if not iso:
        return None
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp()
    except (ValueError, AttributeError):
        return None


def _taglia(s: str, n: int = 220) -> str:
    s = " ".join(str(s).split())
    return s if len(s) <= n else s[: n - 1] + "…"


def _iso(t: float | None) -> str | None:
    return datetime.fromtimestamp(t, timezone.utc).isoformat() if t else None


# ------------------------------------------------------- lettura dei transcript
def coda_righe(path: Path, byte: int = CODA_BYTE) -> list[dict]:
    """Le ultime righe JSON del transcript, senza leggere tutto il file."""
    try:
        dim = path.stat().st_size
        with open(path, "rb") as f:
            if dim > byte:
                f.seek(dim - byte)
                f.readline()
            grezzo = f.read()
    except OSError:
        return []
    fuori = []
    for riga in grezzo.decode("utf-8", errors="replace").splitlines():
        riga = riga.strip()
        if not riga.startswith("{"):
            continue
        try:
            fuori.append(json.loads(riga))
        except json.JSONDecodeError:
            continue
    return fuori


def testa_righe(path: Path, byte: int = 65536) -> list[dict]:
    try:
        with open(path, "rb") as f:
            grezzo = f.read(byte)
    except OSError:
        return []
    fuori = []
    for riga in grezzo.decode("utf-8", errors="replace").splitlines():
        if riga.strip().startswith("{"):
            try:
                fuori.append(json.loads(riga))
            except json.JSONDecodeError:
                continue
    return fuori


SCRIVONO = {"Edit", "Write", "NotebookEdit", "MultiEdit"}
LEGGONO = {"Read", "Grep", "Glob"}


def nome_breve(nome: str) -> str:
    return (nome.replace("mcp__claude-in-chrome__", "chrome:")
                .replace("mcp__claude_ai_", "").replace("mcp__", "")
                .replace("__", ":"))


def descrivi_strumento(nome: str, inp: dict) -> str:
    if not isinstance(inp, dict):
        return nome
    for chiave in ("description", "command", "file_path", "pattern", "path", "prompt",
                   "query", "url", "task_id", "skill", "notebook_path"):
        if chiave in inp and inp[chiave]:
            return _taglia(f"{nome} · {inp[chiave]}", 200)
    return nome


def _rel(p: str) -> str:
    try:
        pp = Path(p)
        for radice, prefisso in ((REPO, ""), (QUI.parent.parent, "«fuori repo»/")):
            try:
                return prefisso + str(pp.relative_to(radice)).replace("\\", "/")
            except ValueError:
                continue
        return str(pp).replace("\\", "/")
    except (OSError, ValueError):
        return str(p)


def analizza(path: Path) -> dict:
    righe = coda_righe(path)
    eventi: list[dict] = []
    strumenti: dict[str, int] = {}
    file_toccati: dict[str, dict] = {}
    comandi: list[dict] = []
    modello, tok_in, tok_out, tok_cache = "", 0, 0, 0
    ultimo_tool_use = None
    tool_result_visti: set[str] = set()

    for r in righe:
        tipo = r.get("type")
        msg = r.get("message") or {}
        ts = r.get("timestamp")
        if tipo == "assistant":
            modello = msg.get("model") or modello
            u = msg.get("usage") or {}
            tok_in += u.get("input_tokens") or 0
            tok_cache += u.get("cache_read_input_tokens") or 0
            tok_out += u.get("output_tokens") or 0
        for blocco in (msg.get("content") or []):
            if not isinstance(blocco, dict):
                continue
            b = blocco.get("type")
            if b == "tool_use":
                nome = blocco.get("name") or "?"
                inp = blocco.get("input") or {}
                breve = nome_breve(nome)
                strumenti[breve] = strumenti.get(breve, 0) + 1
                ultimo_tool_use = {"id": blocco.get("id"), "nome": nome, "quando": ts}
                eventi.append({"quando": ts, "genere": "strumento", "nome": nome,
                               "testo": reda(descrivi_strumento(nome, inp))})
                if isinstance(inp, dict):
                    grezzo = inp.get("file_path") or inp.get("notebook_path")
                    if grezzo:
                        chiave = _rel(str(grezzo))
                        voce = file_toccati.setdefault(
                            chiave, {"file": chiave, "scritto": False, "volte": 0})
                        voce["volte"] += 1
                        if nome in SCRIVONO:
                            voce["scritto"] = True
                    if nome == "Bash" and inp.get("command"):
                        comandi.append({"quando": ts,
                                        "testo": reda(_taglia(str(inp["command"]), 300)),
                                        "nota": reda(_taglia(str(inp.get("description") or ""), 90))})
            elif b == "tool_result":
                tool_result_visti.add(blocco.get("tool_use_id"))
            elif b == "text" and blocco.get("text", "").strip():
                eventi.append({"quando": ts,
                               "genere": "voce" if tipo == "assistant" else "Enzo",
                               "testo": reda(_taglia(blocco["text"], 400))})
            elif b == "thinking":
                eventi.append({"quando": ts, "genere": "ragiona", "testo": "(ragionamento)"})

    datati = [(e, _ora(e["quando"])) for e in eventi if e.get("quando")]
    datati = [(e, t) for e, t in datati if t]
    piu_recente = max(datati, key=lambda x: x[1])[0] if datati else None
    piu_vecchio = min(datati, key=lambda x: x[1])[1] if datati else None

    adesso = time.time()
    ritmo = [0] * RITMO_MIN
    for _e, t in datati:
        indietro = int((adesso - t) // 60)
        if 0 <= indietro < RITMO_MIN:
            ritmo[RITMO_MIN - 1 - indietro] += 1

    in_corso = None
    if ultimo_tool_use and ultimo_tool_use["id"] not in tool_result_visti:
        in_corso = ultimo_tool_use

    return {
        "eventi": eventi[-EVENTI:],
        "modello": modello,
        "token_in": tok_in,
        "token_cache": tok_cache,
        "token_out": tok_out,
        "ultimo_evento": piu_recente["quando"] if piu_recente else None,
        "ultimo_genere": piu_recente["genere"] if piu_recente else None,
        "primo_evento": _iso(piu_vecchio),
        "durata_sec": round(adesso - piu_vecchio) if piu_vecchio else None,
        "strumento_in_corso": in_corso,
        "strumenti": dict(sorted(strumenti.items(), key=lambda kv: -kv[1])),
        "eventi_totali": len(eventi),
        "file": sorted(file_toccati.values(), key=lambda v: (-v["volte"], v["file"]))[:60],
        "comandi": comandi[-25:],
        "ritmo": ritmo,
    }


def segni_di_vita(sid: str) -> tuple[float | None, list[dict]]:
    radice = os.environ.get("TEMP") or os.environ.get("TMP")
    if not radice:
        return (None, [])
    base = Path(radice) / "claude" / slug_progetto(REPO) / sid
    ultimo, task = None, []
    for sotto in ("tasks", "scratchpad"):
        d = base / sotto
        if not d.is_dir():
            continue
        for f in d.iterdir():
            try:
                st = f.stat()
            except OSError:
                continue
            if ultimo is None or st.st_mtime > ultimo:
                ultimo = st.st_mtime
            if sotto == "tasks" and f.suffix == ".output":
                task.append({"id": f.stem, "byte": st.st_size,
                             "quando": _iso(st.st_mtime),
                             "eta_sec": round(time.time() - st.st_mtime)})
    task.sort(key=lambda t: t["eta_sec"])
    return (ultimo, task[:8])


def modalita(sid: str, path: Path | None = None) -> str:
    p = STORE_MODI / f"{re.sub(r'[^A-Za-z0-9_.-]', '_', sid)[:120]}.json"
    try:
        return json.loads(p.read_text(encoding="utf-8")).get("mode", "?")
    except Exception:
        pass
    if path is None:
        return "?"
    testo = json.dumps(testa_righe(path)[:12], ensure_ascii=False).lower()
    if "avvia sessione lab" in testo or "modalita' sessione: lab" in testo:
        return "lab?"
    if "avvia sessione" in testo:
        return "canonical?"
    return "?"


def stato_sessione(dati: dict, eta_sec: float, lavoro: float | None = None,
                   transcript: float | None = None) -> tuple[str, str]:
    corso = dati.get("strumento_in_corso")
    if corso:
        nome = corso.get("nome") or "?"
        da = _ora(corso.get("quando"))
        eta_str = (time.time() - da) if da else 0
        quanto = f" da {int(eta_str // 60)} min" if da else ""
        if lavoro and transcript and lavoro > transcript + SCARTO_SEC:
            fine = datetime.fromtimestamp(lavoro).strftime("%H:%M")
            return ("chiusa", f"chiusa dentro {nome} · il suo lavoro è andato avanti fino "
                              f"alle {fine} e nessuno ne ha raccolto l'esito")
        if nome in ("TaskOutput", "Monitor", "AskUserQuestion"):
            return ("attesa", f"in attesa · {nome}{quanto}")
        if eta_str > ABBANDONO_SEC:
            return ("interrotta", f"interrotta dentro {nome}{quanto} · mai completato")
        if eta_str > SOSPETTO_SEC:
            return ("sospesa", f"dentro {nome}{quanto} · o gira ancora, o la sessione è chiusa")
        return ("lavora", f"sta eseguendo {nome}{quanto}")

    fine = dati.get("ultimo_genere")
    q = f"{int(eta_sec // 60)} min" if eta_sec < 5400 else f"{eta_sec / 3600:.0f} ore"
    if eta_sec <= VIVA_SEC:
        return (("enzo", "ha finito il turno · aspetta Enzo") if fine == "voce"
                else ("lavora", "sta elaborando"))
    if fine == "voce":
        # 2026-08-08 (Enzo, sessione bf45a545): NON si può sapere da qui se la
        # finestra è ancora aperta — verificato che non esiste un segnale di
        # processo attendibile (vedi COWORK_INBOX.md). La frase dice solo il
        # fatto osservabile, mai una certezza che il sistema non ha.
        return ("silenzio", f"nessuna attività da {q} · non verificabile se la finestra è ancora aperta")
    if fine in ("strumento", "ragiona"):
        return ("troncata", f"si è fermata a metà lavoro · {q} fa")
    return ("spenta", f"inattiva da {q}")


VIVI = ("lavora", "attesa", "enzo", "sospesa")


def sessioni() -> list[dict]:
    if not PROGETTI.is_dir():
        return []
    fuori = []
    ordinati = sorted(PROGETTI.glob("*.jsonl"), key=lambda x: x.stat().st_mtime, reverse=True)
    for i, p in enumerate(ordinati):
        eta = time.time() - p.stat().st_mtime
        profonda = i < MOSTRA or eta <= VIVA_SEC
        voce = {"sid": p.stem, "corta": p.stem[:8], "eta_sec": round(eta),
                "byte": p.stat().st_size, "modalita": modalita(p.stem, p),
                "mtime": _iso(p.stat().st_mtime)}
        if profonda:
            d = analizza(p)
            voce.update(d)
            ue = _ora(d.get("ultimo_evento"))
            eta = (time.time() - ue) if ue else eta
            voce["eta_sec"] = round(eta)
            lavoro, task = segni_di_vita(p.stem)
            voce["lavoro_fino_a"] = _iso(lavoro)
            voce["task"] = task
            voce["codice"], voce["frase"] = stato_sessione(d, eta, lavoro, ue or p.stat().st_mtime)
        else:
            voce["codice"], voce["frase"] = "spenta", f"inattiva da {int(eta // 60)} min"
            voce["task"] = []
        voce["viva"] = voce["codice"] in VIVI
        fuori.append(voce)
    return fuori[:MOSTRA]


def collisioni(ses: list[dict]) -> list[dict]:
    mappa: dict[str, list[dict]] = {}
    for s in ses:
        if not s.get("viva") and s.get("codice") not in ("chiusa", "troncata"):
            continue
        for f in (s.get("file") or []):
            if f.get("scritto"):
                mappa.setdefault(f["file"], []).append({"corta": s["corta"],
                                                        "modalita": s["modalita"],
                                                        "volte": f["volte"]})
    fuori = [{"file": k, "sessioni": v} for k, v in mappa.items() if len(v) > 1]
    fuori.sort(key=lambda x: (-len(x["sessioni"]), x["file"]))
    return fuori[:25]


def processi() -> list[dict]:
    ps = ("Get-CimInstance Win32_Process -Filter \"Name='node.exe' or Name='python.exe' "
          "or Name='pnpm.exe'\" | ForEach-Object { $p=Get-Process -Id $_.ProcessId "
          "-ErrorAction Ignore; [PSCustomObject]@{ pid=$_.ProcessId; nome=$_.Name; "
          "avvio=$_.CreationDate.ToString('o'); cpu=[math]::Round($p.CPU,1); "
          "ram=[math]::Round($_.WorkingSetSize/1MB,0); riga=$_.CommandLine } } "
          "| ConvertTo-Json -Compress")
    rc, grezzo = comando(["powershell", "-NoProfile", "-NonInteractive", "-Command", ps], timeout=25)
    try:
        dati = json.loads(grezzo) if grezzo else []
    except json.JSONDecodeError:
        return []
    if isinstance(dati, dict):
        dati = [dati]
    fuori = []
    for d in dati:
        riga = d.get("riga") or ""
        marche = [k for k in ("vitest", "verify_gate", "playwright", "next", "tsc",
                              "pnpm", "psql", "sessioni_panel") if k in riga]
        fuori.append({"pid": d.get("pid"), "nome": d.get("nome"), "avvio": d.get("avvio"),
                      "cpu_min": round((d.get("cpu") or 0) / 60, 1),
                      "ram_mb": d.get("ram") or 0,
                      "riga": reda(_taglia(riga, 220)), "marche": marche,
                      "interessante": bool(marche)})
    fuori.sort(key=lambda x: (not x["interessante"], x.get("avvio") or ""))
    return fuori[:16]


def verdetto() -> dict:
    p = REPO / ".zp" / "verify-verdict.json"
    try:
        d = json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {"presente": False}
    suite = []
    for r in (d.get("results") or []):
        suite.append({"suite": r.get("suite"), "livello": r.get("level"),
                      "exit": r.get("exit"), "durata_s": r.get("duration_s"),
                      "log": r.get("log"), "righe": r.get("righe"),
                      "falliti": r.get("falliti") or [],
                      "coda": [reda(_taglia(x, 200)) for x in (r.get("tail") or [])]})
    return {"presente": True, "esito": d.get("verdict"),
            "head": (d.get("head") or "")[:8],
            "quando": d.get("generated_at"),
            "eta_min": int((time.time() - p.stat().st_mtime) // 60),
            "instradate": d.get("routed") or [], "suite": suite}


def stato_remoto() -> dict:
    ramo = comando(["git", "rev-parse", "--abbrev-ref", "HEAD"], REPO)[1] or "main"
    testa = comando(["git", "rev-parse", "HEAD"], REPO)[1]
    riga = comando(["git", "ls-remote", "origin", f"refs/heads/{ramo}"], REPO, timeout=12)[1]
    if not riga or not testa:
        return {"verificato": False, "motivo": "remoto non raggiungibile"}
    sha = riga.split()[0]
    if sha == testa:
        return {"verificato": True, "avanti": 0, "indietro": 0, "sha": sha[:8], "ramo": ramo}
    avanti = comando(["git", "rev-list", "--count", f"{sha}..HEAD"], REPO)[1]
    indietro = comando(["git", "rev-list", "--count", f"HEAD..{sha}"], REPO)[1]
    if not avanti.isdigit():
        return {"verificato": False, "motivo": "il remoto ha commit non presenti qui (serve un fetch)",
                "sha": sha[:8], "ramo": ramo}
    return {"verificato": True, "avanti": int(avanti),
            "indietro": int(indietro) if indietro.isdigit() else 0,
            "sha": sha[:8], "ramo": ramo}


def git() -> dict:
    sporchi = [r for r in comando(["git", "status", "--porcelain"], REPO)[1].splitlines() if r.strip()]
    remoto = CACHE.prendi("git_remoto", 60.0, stato_remoto)
    riferimento = f"{remoto['sha']}..HEAD" if remoto.get("verificato") else "origin/main..HEAD"
    non_spinti = [r for r in comando(["git", "log", "--oneline", riferimento],
                                     REPO)[1].splitlines() if r.strip()]
    return {"head": comando(["git", "rev-parse", "--short", "HEAD"], REPO)[1],
            "ramo": comando(["git", "rev-parse", "--abbrev-ref", "HEAD"], REPO)[1],
            "sporchi": len(sporchi),
            "elenco_sporchi": [_taglia(r, 90) for r in sporchi[:40]],
            "non_spinti": len(non_spinti),
            "elenco_non_spinti": [_taglia(r, 90) for r in non_spinti[:20]],
            "remoto": remoto,
            "ultimo_commit": _taglia(comando(["git", "log", "-1", "--pretty=%s"], REPO)[1], 100)}


def stato() -> dict:
    ses = CACHE.prendi("sessioni", 2.5, sessioni)
    return {
        "adesso": _iso(time.time()),
        "repo": str(REPO),
        "progetti": str(PROGETTI),
        "avvio_server": AVVIO,
        "rete": {"esposta": bool(Handler.IP_LAN), "aperta": Handler.APERTA, "ip": Handler.IP_LAN},
        "sessioni": ses,
        "collisioni": collisioni(ses),
        "processi": CACHE.prendi("processi", 6.0, processi),
        "verdetto": CACHE.prendi("verdetto", 5.0, verdetto),
        "git": CACHE.prendi("git", 5.0, git),
    }


def sintesi(d: dict) -> None:
    vive = [s for s in d["sessioni"] if s["viva"]]
    print(f"SESSIONI ({len(vive)} vive)")
    for s in d["sessioni"][:10]:
        print(f"  {s['corta']} · {s['modalita']:10} · {s['codice']:10} · {s['frase'][:60]:60} "
              f"· {s.get('modello', '')} · out {s.get('token_out', 0)} tok")
    g = d["git"]
    print(f"GIT  {g['ramo']} @ {g['head']} · {g['sporchi']} sporchi · "
          f"{g['non_spinti']} non spinti · {g['ultimo_commit']}")
    v = d["verdetto"]
    print(f"CANCELLO  esito={v.get('esito')} head={v.get('head')} eta={v.get('eta_min')} min")


# ------------------------------------------------------------------ il server
AVVIO = _iso(time.time())


class Handler(pb.PlanciaHandler):
    STATICI = STATICI
    VENDOR = VENDOR

    def do_GET(self):
        via = self._percorso()
        if via.startswith("/api/"):
            if not self._autorizzato():
                self._nega()
                return
            if via == "/api/stato":
                self._json(stato())
                return
            self._json({"errore": "non trovato"}, 404)
            return
        if not self.servi_statico():
            self._manda(b"non trovato", "text/plain; charset=utf-8", 404)

    def do_POST(self):
        if not self._autorizzato():
            self._nega()
            return
        if self._percorso() != "/api/azione":
            self._json({"ok": False, "errore": "non trovato"}, 404)
            return
        n = int(self.headers.get("Content-Length") or 0)
        try:
            corpo = json.loads(self.rfile.read(n) or b"{}")
        except (ValueError, json.JSONDecodeError):
            corpo = {}
        esito = self.azione_self(corpo.get("azione"))
        if esito is None:
            self._json({"ok": False, "errore": "azione non ammessa"}, 400)
        else:
            self._json(esito)


Handler.CACHE = CACHE
Handler.RIAVVIA_CB = pb.riavvia_processo


def main() -> int:
    ap = argparse.ArgumentParser(add_help=False)
    ap.add_argument("--stampa", action="store_true", help="una fotografia JSON, senza server")
    ap.add_argument("--sintesi", action="store_true", help="la stessa fotografia, leggibile")
    a, _resto = ap.parse_known_args()
    if a.stampa:
        print(json.dumps(stato(), ensure_ascii=False, indent=2))
        return 0
    if a.sintesi:
        sintesi(stato())
        return 0
    return pb.avvia_server(Handler, PORTA, CHIAVE_FILE, "plancia sessioni",
                           aperta_default=True, descrizione_dati="i transcript delle sessioni")


if __name__ == "__main__":
    sys.exit(main())
