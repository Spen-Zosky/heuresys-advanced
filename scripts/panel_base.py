#!/usr/bin/env python3
"""panel_base.py — nucleo condiviso delle plance locali di heuresys-advanced.

Estratto il 2026-08-08 dai pattern gia' verificati in sessioni_panel.py (lab):
redazione dei segreti, cache con scadenza, autenticazione chiave/cookie,
serving statico, scaffold CLI. Ogni funzione qui e' pura infrastruttura di
plancia: niente di specifico ne' alle sessioni Claude Code ne' al loop
zero-pendenze.

scripts/zp_panel.py NON usa ancora questo modulo: e' gia' live con stato
reale (chiave d'accesso, attivita' Windows schedulate, configurazioni
salvate) e la sua migrazione e' stata deliberatamente rimandata da Enzo il
2026-08-08 a una sessione dedicata — vedi l'addendum in
docs/kb/COWORK_INBOX.md. Questo file e' usato da scripts/sessioni_panel.py
e da scripts/plancia.py.
"""
from __future__ import annotations

import json
import os
import re
import secrets
import socket
import subprocess
import sys
import threading
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

# --------------------------------------------------------------- redazione
# Catalogo verificato in sessioni_panel.py: password/token/api-key, chiavi
# sk-, connection string Postgres con credenziali, blocchi di chiave privata,
# JWT. Applicato a ogni testo che puo' arrivare da un transcript, un comando
# o l'output di git prima che esca dal processo (R11 secret hygiene).
SEGRETI = [
    re.compile(r"(?i)\b(password|passwd|pwd|secret|token|api[_-]?key|apikey|access[_-]?key"
               r"|private[_-]?key|client[_-]?secret|refresh[_-]?token|jwt)\b\s*[:=]\s*"
               r"[\"']?([^\s\"',;}]{4,})"),
    re.compile(r"\b(sk-[A-Za-z0-9_-]{12,})"),
    re.compile(r"(postgres(?:ql)?://[^:\s]+:)([^@\s]+)(@)"),
    re.compile(r"(-----BEGIN [A-Z ]*PRIVATE KEY-----)[\s\S]+?(-----END [A-Z ]*PRIVATE KEY-----)"),
    re.compile(r"\b(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})"),
]


def reda(testo: str) -> str:
    """Sostituisce cio' che somiglia a un segreto con «redatto»."""
    if not testo:
        return testo
    t = SEGRETI[0].sub(lambda m: f"{m.group(1)}=«redatto»", testo)
    t = SEGRETI[1].sub("«redatto»", t)
    t = SEGRETI[2].sub(lambda m: f"{m.group(1)}«redatto»{m.group(3)}", t)
    t = SEGRETI[3].sub(lambda m: f"{m.group(1)}«redatto»{m.group(2)}", t)
    t = SEGRETI[4].sub("«redatto»", t)
    return t


# ------------------------------------------------------------------- utilita'
class Cache:
    """Una scadenza per grandezza: i processi costano ~500 ms, i file no."""

    def __init__(self):
        self._d: dict[str, tuple[float, object]] = {}
        self._lock = threading.Lock()

    def prendi(self, chiave: str, ttl: float, calcola):
        with self._lock:
            v = self._d.get(chiave)
            if v and (time.time() - v[0]) < ttl:
                return v[1]
        val = calcola()
        with self._lock:
            self._d[chiave] = (time.time(), val)
        return val

    def svuota(self) -> None:
        with self._lock:
            self._d.clear()


def comando(args: list[str], cwd=None, timeout: int = 20, env: dict | None = None) -> tuple[int, str]:
    """Esegue un comando, non solleva mai: ritorna (returncode, output unito)."""
    try:
        r = subprocess.run(args, cwd=str(cwd) if cwd else None, capture_output=True,
                           text=True, encoding="utf-8", errors="replace",
                           timeout=timeout, env=env)
        return r.returncode, (r.stdout + r.stderr).strip()
    except Exception as exc:
        return 1, str(exc)


def ip_lan() -> str:
    """L'IP con cui questa macchina si vede dalla rete locale. Nessun pacchetto
    parte davvero: serve solo a far scegliere l'interfaccia al sistema."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("192.168.1.1", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return ""


def prepara_chiave(chiave_file: Path) -> str:
    """Chiave persistente su file per l'accesso dalla rete locale. Non va MAI
    stampata altrove che sul terminale di chi avvia la plancia (R11)."""
    try:
        c = chiave_file.read_text(encoding="utf-8").strip()
        if c:
            return c
    except OSError:
        pass
    c = secrets.token_urlsafe(12)
    chiave_file.parent.mkdir(parents=True, exist_ok=True)
    chiave_file.write_text(c + "\n", encoding="utf-8")
    return c


# ------------------------------------------------------ autenticazione e invio
TIPI = {".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
        ".svg": "image/svg+xml"}


class PlanciaHandler(BaseHTTPRequestHandler):
    """Handler base: autenticazione chiave/cookie, serving statico e le due
    azioni self (aggiorna/riavvia) gia' pronti. Ogni plancia lo estende
    aggiungendo solo le proprie rotte /api/*.

    Il controllo di autenticazione vale SOLO su /api/*: proteggere anche i
    file statici e' un guasto gia' misurato in sessioni-panel (pagina bianca
    da rete, 2026-08-05) — i file statici non contengono dati.
    """
    STATICI: Path
    VENDOR: Path | None = None
    APERTA = False
    CHIAVE = ""
    CHIAVE_FILE: Path | None = None
    CACHE: "Cache | None" = None
    RIAVVIA_CB = None   # funzione richiamata per il riavvio (riavvia_processo)
    IP_LAN = ""         # valorizzato da avvia_server()

    def log_message(self, *a):
        pass

    def _percorso(self) -> str:
        return urlparse(self.path).path

    def _chiave_data(self) -> str:
        q = parse_qs(urlparse(self.path).query).get("k", [""])[0]
        if q:
            return q
        m = re.search(r"(?:^|;\s*)plancia_k=([^;]+)", self.headers.get("Cookie") or "")
        return m.group(1) if m else ""

    def _autorizzato(self) -> bool:
        if self.APERTA or self.client_address[0] in ("127.0.0.1", "::1"):
            return True
        return bool(self.CHIAVE) and self._chiave_data() == self.CHIAVE

    def _nega(self) -> None:
        dati = ("chiave mancante o errata.\n\nApri  http://<ip-del-pc>:{porta}/?k=<chiave>\n"
                "La chiave sta sul PC, nel file:\n  {f}\n").format(
                    porta=self.server.server_address[1], f=self.CHIAVE_FILE).encode("utf-8")
        self.send_response(403)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(dati)))
        self.end_headers()
        try:
            self.wfile.write(dati)
        except (BrokenPipeError, ConnectionAbortedError):
            pass

    def _manda(self, corpo: bytes, tipo: str, codice: int = 200, biscotto: str | None = None) -> None:
        self.send_response(codice)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(corpo)))
        self.send_header("Cache-Control", "no-store")
        if biscotto:
            self.send_header("Set-Cookie", f"plancia_k={biscotto}; Path=/; Max-Age=86400; SameSite=Strict")
        self.end_headers()
        try:
            self.wfile.write(corpo)
        except (BrokenPipeError, ConnectionAbortedError):
            pass

    def _json(self, corpo: dict, codice: int = 200) -> None:
        self._manda(json.dumps(corpo, ensure_ascii=False).encode("utf-8"), TIPI[".json"], codice)

    def servi_statico(self) -> bool:
        """True se ha gestito la richiesta come file statico."""
        via = self._percorso()
        if self.VENDOR and via.startswith("/vendor/"):
            f = self.VENDOR / Path(via).name
        elif via in ("/", "/index.html"):
            f = self.STATICI / "index.html"
        else:
            f = self.STATICI / Path(via).name
        if not f.is_file():
            return False
        biscotto = None
        if via in ("/", "/index.html") and self.CHIAVE and self._chiave_data() == self.CHIAVE:
            biscotto = self.CHIAVE
        self._manda(f.read_bytes(), TIPI.get(f.suffix, "application/octet-stream"), biscotto=biscotto)
        return True

    def azione_self(self, azione: str) -> dict | None:
        """Le due azioni universali. None se `azione` non e' una di queste."""
        if azione == "aggiorna":
            if self.CACHE:
                self.CACHE.svuota()
            return {"ok": True, "fatto": "cache svuotata"}
        if azione == "riavvia" and self.RIAVVIA_CB:
            threading.Timer(0.4, self.RIAVVIA_CB).start()
            return {"ok": True, "fatto": "riavvio in corso"}
        return None


def riavvia_processo() -> None:
    """Ricarica il codice sostituendo il processo con se' stesso (os.execv).
    Su Windows non conserva il PID (nota gia' misurata in sessioni-panel)."""
    try:
        sys.stdout.flush()
        os.execv(sys.executable, [sys.executable] + sys.argv)
    except OSError:
        os._exit(3)


def avvia_server(handler_cls, porta_default: int, chiave_file: Path, nome: str,
                 aperta_default: bool, descrizione_dati: str = "i dati") -> int:
    """Scaffold CLI comune. La postura di sicurezza di default (aperta o con
    chiave) resta quella gia' decisa per ciascuna plancia — non la si
    reinterpreta qui."""
    import argparse
    ap = argparse.ArgumentParser(prog=nome)
    ap.add_argument("--porta", type=int, default=porta_default)
    ap.add_argument("--no-browser", action="store_true")
    ap.add_argument("--solo-locale", action="store_true",
                    help="ascolta solo su 127.0.0.1 (niente telefono, niente altri PC)")
    if aperta_default:
        ap.add_argument("--con-chiave", action="store_true",
                        help="richiede una chiave d'accesso fuori da localhost (default: no)")
    else:
        ap.add_argument("--senza-chiave", action="store_true",
                        help="LAN aperta senza chiave (default: richiede la chiave)")
    a, _ = ap.parse_known_args()
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    aperta = (not getattr(a, "con_chiave", False)) if aperta_default else getattr(a, "senza_chiave", False)
    handler_cls.APERTA = aperta
    handler_cls.CHIAVE_FILE = chiave_file
    handler_cls.CHIAVE = "" if aperta else prepara_chiave(chiave_file)

    bind = "127.0.0.1" if a.solo_locale else "0.0.0.0"
    ip = "" if a.solo_locale else ip_lan()
    handler_cls.IP_LAN = ip
    srv = ThreadingHTTPServer((bind, a.porta), handler_cls)
    srv.daemon_threads = True
    print(f"{nome} su http://127.0.0.1:{a.porta}  (ctrl-c per fermare)")
    if ip:
        coda = f"/?k={handler_cls.CHIAVE}" if handler_cls.CHIAVE else ""
        print(f"dalla rete locale:   http://{ip}:{a.porta}{coda}")
        if handler_cls.CHIAVE:
            print(f"  chiave d'accesso in {chiave_file}")
        else:
            print(f"  aperta senza chiave: chiunque sulla rete legge {descrizione_dati}")
    if not a.no_browser:
        threading.Timer(0.8, lambda: webbrowser.open(f"http://127.0.0.1:{a.porta}")).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nfermata")
    return 0
