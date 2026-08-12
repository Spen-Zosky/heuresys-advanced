#!/usr/bin/env python3
"""
zp_panel.py — dashboard locale di gestione del loop zero-pendenze.

Sezioni: stato macchina · KPI del piano · aperti per ondata · spesa vs tetto ·
vassoio «su Enzo» · triage anti-stale · storico corse · azioni (lancio, stop,
notte pianificata, censimento) · log · e il configuratore «Imposta prossima
sessione» (modale) con salvataggio delle configurazioni con nome.

Regola del configuratore: ogni manopola corrisponde a qualcosa che il sistema
onora davvero. La modalita' NON PRESIDIATA muove i parametri reali del driver
(corsia, iterazioni, finestra, adesso/ricorrente/una-tantum); la PRESIDIATA per
definizione la apre Enzo, quindi il configuratore COMPONE LA FRASE esatta da
incollare nella sessione. Nessuna opzione decorativa.

Cosa NON fa: non scavalca freno/lock/repo-pulito/veto-deploy (stanno nel driver);
non tocca DB ne' prodotto. Rete: ascolta su 0.0.0.0 (misurato 2026-08-12 con
netstat: 0.0.0.0:8477), ma dalla LAN NON si comanda nulla senza la chiave nell'URL
— `APERTA=False` di default, e solo `--senza-chiave` la apre davvero. `--solo-locale`
la toglie del tutto dalla rete. Questa riga diceva «ascolta SOLO su 127.0.0.1»:
la conclusione era giusta, la ragione no — a difendere e' la chiave, non il bind.

Uso:  py zp_panel.py            # apre http://127.0.0.1:8477
      py zp_panel.py --no-browser
"""
from __future__ import annotations

import argparse
import datetime
import json
import os
import re
import socket
import subprocess
import sys
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# Promossa dal design-lab a `scripts/` (S1043), accanto al driver che governa.
# La radice del repo e' il PADRE di questa cartella: prima si derivava dalla
# posizione nel lab, che stava fuori dal repo. `HRX_REPO` resta come scavalco.
QUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.environ.get("HRX_REPO", os.path.dirname(QUI))
ZP = os.path.join(REPO, ".zp")
CFG = os.path.join(REPO, ".claude", "skills", "zero-pending-loop", "references", "zp.config.yaml")
PIANO = os.path.join(REPO, "docs", "superpowers", "specs", "2026-07-25-zero-pending-plan.md")
# I file di RUNTIME vivono in `.zp/`, che e' gitignorato: sono stato della macchina,
# non sorgente. Nel lab stavano in `artefatti/` perche' li' non c'era un `.zp/`.
LOG = os.path.join(ZP, "zp-notte.log")
LOG_CENS = os.path.join(ZP, "zp-censimento.log")
TRIAGE_MD = os.path.join(ZP, "zp_triage.md")
CONFIGS = os.path.join(ZP, "zp-sessioni-salvate.json")
TASK = "heuresys-zp-notte"
TASK_ONCE = "heuresys-zp-una-tantum"
PORTA = 8477
DETACHED = 0x00000008 | 0x00000200
CHIAVE_FILE = os.path.join(ZP, "zp-panel-chiave.txt")
CHIAVE = ""        # valorizzata in main()
APERTA = False     # --senza-chiave: LAN libera, scelta consapevole di Enzo
ACCESSO_LAN = ""   # URL comodo per telefono/tablet, valorizzato in main()


# ----------------------------------------------------------------- letture

def config_grezza() -> str:
    try:
        with open(CFG, encoding="utf-8") as f:
            return f.read()
    except OSError:
        return ""


def da_config(chiave: str, difetto: str = "") -> str:
    m = re.search(rf"^\s*{re.escape(chiave)}:\s*'?([^'#\n]+)'?", config_grezza(), re.M)
    return m.group(1).strip() if m else difetto


def percorso_bash() -> str:
    return da_config("bash", r"C:\Git\bin\bash.exe")


def percorso_claude() -> str:
    return da_config("claude", "claude")


def ambiente_pulito() -> dict:
    """Toglie SOLO la ANTHROPIC_API_KEY (stantia e invalida sul PC: scavalcava il
    login e ogni `claude -p` moriva 401 — scoperto col collaudo del 2026-08-03).
    ANTHROPIC_AUTH_TOKEN, se presente, si PRESERVA: e' la via dell'abbonamento
    indicata da Enzo; in sua assenza vale il login claude.ai della CLI."""
    env = dict(os.environ)
    env.pop("ANTHROPIC_API_KEY", None)
    return env


UNSET = "unset ANTHROPIC_API_KEY; "  # per i comandi che girano fuori dal panel


def comando(args: list[str], cwd: str | None = None, timeout: int = 30,
            env: dict | None = None) -> tuple[int, str]:
    try:
        e = subprocess.run(args, cwd=cwd, capture_output=True, text=True,
                           encoding="utf-8", errors="replace", timeout=timeout, env=env)
        return e.returncode, (e.stdout + e.stderr).strip()
    except Exception as exc:
        return 1, str(exc)


def zp_state(*argomenti: str) -> str:
    return comando([sys.executable, os.path.join("docs", "kb", "tools", "zp_state.py"),
                    *argomenti], cwd=REPO)[1]


def lock_stato() -> dict:
    lock = os.path.join(ZP, "driver.lock")
    if not os.path.exists(lock):
        return {"presente": False}
    try:
        pid = open(lock, encoding="utf-8").read().split()[0]
    except OSError:
        pid = "?"
    rc, _ = comando([percorso_bash(), "-c", f"kill -0 {pid} 2>/dev/null"])
    return {"presente": True, "pid": pid, "vivo": rc == 0}


SCARTATE = {"n": 0, "totali": 0}


def corse() -> list[dict]:
    """Le corse leggibili — e SI CONTA quante non lo sono.

    Le righe rotte venivano saltate in silenzio: il 2026-08-09 il file ne aveva 16 e
    la plancia ne mostrava 4, dichiarando una spesa che era quella di un quarto dei
    dati. Un conteggio che tace cio' che non sa e' peggio di un conteggio assente,
    perche' sembra vero. La causa (scrittura non sanificata nel driver) e' corretta a
    monte; questo resta per le righe gia' scritte e per qualunque rottura futura.
    """
    out = []
    try:
        rotte = tot = 0
        for r in open(os.path.join(ZP, "runs.ndjson"), encoding="utf-8"):
            r = r.strip()
            if r:
                tot += 1
                try:
                    out.append(json.loads(r))
                except ValueError:
                    rotte += 1
        SCARTATE["n"], SCARTATE["totali"] = rotte, tot
    except OSError:
        pass
    return out


def coda(path: str, n: int = 40) -> str:
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            return "".join(f.readlines()[-n:]) or "(vuoto)"
    except OSError:
        return "(nessun log ancora)"


def parse_piano(testo: str) -> dict:
    def num(rx):
        m = re.search(rx, testo)
        return int(m.group(1)) if m else 0
    ondate = re.findall(r"^\s+(W\d)\s+(\d+) pezzi\s+(\d+)h", testo, re.M)
    return {"totali": num(r"cluster totali \.+ (\d+)"), "chiusi": num(r"chiusi \.+ (\d+)"),
            "aperti": num(r"aperti \.+ (\d+)"), "autonomi": num(r"autonomi \.+ (\d+)"),
            "ore_autonome": num(r"autonomi \.+ \d+\s+\((\d+)h\)"),
            "su_enzo": num(r"su Enzo \.+ (\d+)"),
            "ondate": [{"nome": w, "pezzi": int(p), "ore": int(h)} for w, p, h in ondate]}


def vassoio_enzo() -> list[dict]:
    out = []
    try:
        for r in open(PIANO, encoding="utf-8").read().splitlines():
            m = re.match(r"^- \[ \] \*\*(Z-\d{3})\*\* \(([^)]*?)\s*·\s*\*\*"
                         r"(decisione-business|esterno|segreto)\*\*\)\s*—\s*(.*)", r)
            if m:
                out.append({"id": m.group(1), "effort": m.group(2), "tipo": m.group(3),
                            "titolo": re.sub(r"\*+", "", m.group(4))[:120]})
    except OSError:
        pass
    return out


def triage_sintesi() -> dict:
    try:
        testo = open(TRIAGE_MD, encoding="utf-8").read()
    except OSError:
        return {"presente": False}
    classi = dict(re.findall(r"^## ([A-Z?-]+) — (\d+)", testo, re.M))
    m = re.search(r"(?:generato\s+)?(\d{4}-\d{2}-\d{2})\s+su HEAD\s+(\w+)", testo)
    return {"presente": True, "classi": classi,
            "generato": m.group(1) if m else "?", "head": m.group(2) if m else "?"}


def configs_salvate() -> dict:
    try:
        return json.load(open(CONFIGS, encoding="utf-8"))
    except (OSError, ValueError):
        return {}


# I campi che la plancia puo' cambiare. ELENCO ESPLICITO, mai un jolly: una webapp
# che puo' riscrivere qualunque chiave di zp.config.yaml puo' anche disarmare le
# guardie. Chiave -> (etichetta, minimo, massimo).
CAMPI_CONFIG = {
    "clusters_per_iteration":       ("Cluster per iterazione", 1, 5),
    "max_effort_hours_per_cluster": ("Ore massime per cluster", 1, 24),
    "max_budget_usd_per_iteration": ("$ per iterazione", 1, 60),
    "max_iterations_default":       ("Iterazioni: tetto del driver", 1, 40),
    "hard_stop_usd_total":          ("$ tetto cumulato", 10, 1000),
    "goal_turn_bound":              ("Turni massimi per obiettivo", 5, 100),
    "reviewers":                    ("Revisori per cluster", 1, 5),
    "majority_to_dismiss":          ("Voti per archiviare un rilievo", 1, 5),
}

# Cio' che la plancia NON tocca, e il motivo. Si MOSTRA in pagina: un campo assente
# senza spiegazione sembra una dimenticanza, e prima o poi qualcuno lo aggiunge.
CAMPI_INTOCCABILI = {
    "autorizzato_non_presidiato": "e' il freno: ha gia' il suo percorso, con verifiche e commit",
    "clusters_classified": "guardia di sicurezza dell'intero impianto: senza classificazione nessuna corsia e' autorizzata",
    "modalita_lavoratore": "permessi di esecuzione di un lavoratore",
    "allow_force": "tocca la produzione",
}

_RX_CAMPO = r"^(?P<pre>\s*{k}:\s*)(?P<val>[^\s#]+)(?P<post>\s*(?:#.*)?)$"


def config_campi() -> dict:
    """Valore corrente di ogni campo modificabile, letto dal file vero."""
    import re
    fuori = {"campi": [], "intoccabili": [{"chiave": k, "perche": v}
                                          for k, v in CAMPI_INTOCCABILI.items()]}
    try:
        righe = open(CFG, encoding="utf-8").read().splitlines()
    except OSError as e:
        fuori["errore"] = str(e)
        return fuori
    for chiave, (etichetta, minimo, massimo) in CAMPI_CONFIG.items():
        rx = re.compile(_RX_CAMPO.format(k=re.escape(chiave)))
        trovate = [(i, m) for i, r in enumerate(righe) if (m := rx.match(r))]
        voce = {"chiave": chiave, "etichetta": etichetta, "min": minimo, "max": massimo}
        if len(trovate) == 1:
            voce["valore"] = trovate[0][1].group("val")
            voce["riga"] = trovate[0][0] + 1
        else:
            voce["valore"] = None
            voce["nota"] = f"{len(trovate)} righe corrispondono: non e' modificabile alla cieca"
        fuori["campi"].append(voce)
    return fuori


COERENZE = [
    ("majority_to_dismiss", "reviewers",
     "servirebbero {a} voti su {b} revisori: una maggioranza irraggiungibile"),
    ("max_budget_usd_per_iteration", "hard_stop_usd_total",
     "{a}$ per iterazione contro un tetto cumulato di {b}$"),
]


def config_incoerenze() -> list[str]:
    """Relazioni che devono valere FRA i campi, lette dal file com'e' adesso."""
    valori = {c["chiave"]: c["valore"] for c in config_campi().get("campi", [])}
    fuori = []
    for minore, maggiore, testo in COERENZE:
        try:
            a, b = int(valori[minore]), int(valori[maggiore])
        except (KeyError, TypeError, ValueError):
            continue
        if a > b:
            fuori.append(f"{minore} ({a}) > {maggiore} ({b}): " + testo.format(a=a, b=b))
    return fuori


def config_scrivi(chiave: str, valore: str) -> str:
    """Cambia UN campo, e solo se il piano regge ancora dopo.

    Le quattro cose che ogni scrittura porta con se':
      (a) la misura prima  — si rilegge il file adesso, non ci si fida di cio' che la
          pagina mostrava (poteva essere vecchio di venti secondi);
      (b) la guardia       — chiave nell'elenco esplicito, valore intero nel suo range,
          ed ESATTAMENTE una riga corrispondente: zero o due, e si rifiuta;
      (c) la post-condizione che protegge cio' che NON doveva cambiare — stesso numero
          di righe, e ogni altra riga identica al carattere. I commenti di questo file
          raccontano perche' il freno esiste: valgono piu' del campo che si sta
          cambiando, e un dump YAML li cancellerebbe tutti;
      (d) il rollback dichiarato — l'originale resta in memoria e viene RIMESSO se
          `zp_state.py verifica` dice di no. La verifica puo' dire di no: e' il punto.
    """
    import re
    etichetta = CAMPI_CONFIG.get(chiave)
    if not etichetta:
        return f"«{chiave}» non e' fra i campi modificabili dalla plancia"
    if chiave in CAMPI_INTOCCABILI:
        return f"«{chiave}» non si tocca da qui: {CAMPI_INTOCCABILI[chiave]}"
    _, minimo, massimo = etichetta
    try:
        n = int(str(valore).strip())
    except (TypeError, ValueError):
        return f"«{valore}» non e' un numero intero"
    if not (minimo <= n <= massimo):
        return f"fuori intervallo: {chiave} ammette da {minimo} a {massimo}, ricevuto {n}"

    try:
        originale = open(CFG, encoding="utf-8").read()
    except OSError as e:
        return f"config illeggibile: {e}"
    righe = originale.splitlines(keepends=True)
    rx = re.compile(_RX_CAMPO.format(k=re.escape(chiave)))
    trovate = [i for i, r in enumerate(righe) if rx.match(r.rstrip("\r\n"))]
    if len(trovate) != 1:
        return f"trovate {len(trovate)} righe per «{chiave}»: non si modifica alla cieca"

    i = trovate[0]
    fine = righe[i][len(righe[i].rstrip("\r\n")):]      # il terminatore, qualunque sia
    m = rx.match(righe[i].rstrip("\r\n"))
    prima = m.group("val")
    if prima == str(n):
        return f"{chiave} era gia' {n}: non ho toccato niente"
    nuove = list(righe)
    nuove[i] = f"{m.group('pre')}{n}{m.group('post')}{fine}"

    # (c) post-condizione, PRIMA di scrivere: nient'altro e' cambiato
    if len(nuove) != len(righe):
        return "rifiutato: la modifica cambierebbe il numero di righe"
    diverse = [j for j in range(len(righe)) if nuove[j] != righe[j]]
    if diverse != [i]:
        return f"rifiutato: sarebbero cambiate {len(diverse)} righe invece di una"

    with open(CFG, "w", encoding="utf-8", newline="") as f:
        f.write("".join(nuove))

    incoerenze = config_incoerenze()
    if incoerenze:
        with open(CFG, "w", encoding="utf-8", newline="") as f:
            f.write(originale)                              # (d) rollback
        return f"RIFIUTATO e rimesso com'era: {incoerenze[0]}"

    rc, out = comando([sys.executable, os.path.join("docs", "kb", "tools", "zp_state.py"), "verifica"],
                      cwd=REPO, timeout=90)
    if rc != 0:
        with open(CFG, "w", encoding="utf-8", newline="") as f:
            f.write(originale)                              # (d) rollback
        motivo = (out or "").strip().splitlines()
        return (f"RIFIUTATO e rimesso com'era: con {chiave}={n} il piano non regge piu'. "
                + (motivo[-1] if motivo else "verifica rossa"))
    return f"{chiave}: {prima} -> {n} (riga {i + 1}); verifica del piano verde"


def budget_dal_dato() -> dict:
    """Quanto costa DAVVERO un'ora di lavoro, misurato sulle corse riuscite.

    Il tetto di 12$/iterazione e' un numero fisso per qualunque cluster: su uno da 4
    ore dichiarate tronca il lavoro invece di proteggerlo, e il troncamento si e' gia'
    visto negli esiti. Qui il tetto si DERIVA: tasso misurato x ore dichiarate, con un
    margine. Se le corse leggibili sono poche lo dice, invece di dare un numero che
    sembra fondato.
    """
    giri = [g for g in corse() if float(g.get("costo_usd") or 0) > 0 and int(g.get("durata_s") or 0) > 0]
    if not giri:
        return {"tasso_orario": None, "campioni": 0, "scartate": SCARTATE["n"]}
    tassi = sorted(float(g["costo_usd"]) / (int(g["durata_s"]) / 3600.0) for g in giri)
    mediano = tassi[len(tassi) // 2]
    massimo = tassi[-1]
    return {"tasso_orario": round(mediano, 2), "tasso_massimo": round(massimo, 2),
            "campioni": len(tassi), "scartate": SCARTATE["n"], "totali": SCARTATE["totali"],
            "affidabile": len(tassi) >= 5}


def stato_veloce() -> dict:
    """Il ritmo del cockpit: SOLO letture di file, nessun processo esterno.

    Gira ogni paio di secondi, quindi non puo' permettersi cio' che costa: `stato()`
    esegue due `schtasks` e un `git status` a ogni chiamata, e con un aggiornamento
    ogni 5 secondi erano tre processi Windows ogni 5 secondi solo per stare a guardare.
    Qui restano le cose che cambiano davvero mentre si guarda — chi ha il lock, se c'e'
    uno STOP, l'ultimo esito, la coda del log — e sono tutte letture di file.
    """
    ultimo = {}
    try:
        ultimo = json.load(open(os.path.join(ZP, "last-outcome.json"), encoding="utf-8"))
    except (OSError, ValueError):
        pass
    giri = corse()
    return {"lock": lock_stato(),
            "stop_presente": os.path.exists(os.path.join(ZP, "STOP")),
            "ultimo_esito": ultimo,
            "spesa_usd": round(sum(float(g.get("costo_usd") or 0) for g in giri), 2),
            "corse": giri[-20:],
            "log": coda(LOG)}


def stato() -> dict:
    ultimo = {}
    try:
        ultimo = json.load(open(os.path.join(ZP, "last-outcome.json"), encoding="utf-8"))
    except (OSError, ValueError):
        pass
    rc_d, _ = comando(["schtasks", "/Query", "/TN", TASK])
    rc_o, _ = comando(["schtasks", "/Query", "/TN", TASK_ONCE])
    rc_git, sporco = comando(["git", "-C", REPO, "status", "--porcelain"])
    sporco = "\n".join(r for r in sporco.splitlines() if not r.startswith("?? .zp/"))
    giri = corse()
    return {"piano": parse_piano(zp_state("piano")),
            "freno_inserito": zp_state("config", "meta.autorizzato_non_presidiato").strip() != "True",
            "lock": lock_stato(),
            "stop_presente": os.path.exists(os.path.join(ZP, "STOP")),
            "ultimo_esito": ultimo,
            "spesa_usd": round(sum(float(g.get("costo_usd") or 0) for g in giri), 2),
            "tetto_usd": float(da_config("hard_stop_usd_total", "120") or 120),
            "budget_giro": da_config("max_budget_usd_per_iteration", "12"),
            "ore_max_cluster": da_config("max_effort_hours_per_cluster", "4"),
            "corse": giri[-20:],
            "task_daily": rc_d == 0, "task_once": rc_o == 0,
            "repo_sporco": bool(sporco.strip()) if rc_git == 0 else None,
            "budget_dal_dato": budget_dal_dato(),
            "corse_scartate": SCARTATE["n"], "corse_totali": SCARTATE["totali"],
            "vassoio_enzo": vassoio_enzo(), "triage": triage_sintesi(),
            "configs": configs_salvate(),
            "auth": {"api_key_utente": "ANTHROPIC_API_KEY" in os.environ,
                     "auth_token": "ANTHROPIC_AUTH_TOKEN" in os.environ},
            "driver_budget_flags": driver_supporta_budget(),
            "accesso_lan": ACCESSO_LAN,
            "log": coda(LOG), "log_censimento": coda(LOG_CENS, 20)}


# ----------------------------------------------------------------- azioni

def driver_supporta_budget() -> bool:
    """True quando il driver conosce --budget-usd (consegna «budget dinamici»).
    Fino ad allora la plancia non manda i flag: un driver vecchio uscirebbe
    con «opzione sconosciuta: exit 2»."""
    try:
        return "--budget-usd" in _l(os.path.join(REPO, "scripts", "zero-pending-driver.sh"))
    except OSError:
        return False


def _l(path: str) -> str:
    with open(path, encoding="utf-8", errors="replace") as f:
        return f.read()


def _flag_budget(riga: str, budget, tetto) -> str:
    if not driver_supporta_budget():
        return riga
    try:
        if budget and float(budget) > 0:
            riga += f" --budget-usd {float(budget):g}"
        if tetto and float(tetto) > 0:
            riga += f" --tetto-usd {float(tetto):g}"
    except (TypeError, ValueError):
        pass
    return riga


def lancia_driver(corsia: str, iterazioni: int, finestra: str, prova: bool,
                  budget=None, tetto=None) -> str:
    if corsia not in ("safe", "full"):
        return "corsia non ammessa"
    riga = (f"cd '{REPO}' && bash scripts/zero-pending-driver.sh "
            f"--lane {corsia} --max-iterations {int(iterazioni)}").replace("\\", "/")
    if re.fullmatch(r"\d{2}:\d{2}-\d{2}:\d{2}", finestra or ""):
        riga += f" --window '{finestra}'"
    if prova:
        riga += " --dry-run"
    riga = _flag_budget(riga, budget, tetto)
    riga += f" >> '{LOG}' 2>&1".replace("\\", "/")
    subprocess.Popen([percorso_bash(), "-lc", UNSET + riga], creationflags=DETACHED,
                     env=ambiente_pulito(), stdin=subprocess.DEVNULL,
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, close_fds=True)
    return f"driver lanciato ({corsia}, {iterazioni} iterazioni). Esito e rifiuti nel log."


def crea_task(nome: str, quando: str, ora: str, corsia: str, iterazioni: int,
              finestra: str, budget=None, tetto=None) -> str:
    if not re.fullmatch(r"\d{2}:\d{2}", ora or ""):
        return "ora non valida (HH:MM)"
    interno = (f"cd '{REPO}' && bash scripts/zero-pending-driver.sh --lane {corsia} "
               f"--max-iterations {int(iterazioni)}")
    if re.fullmatch(r"\d{2}:\d{2}-\d{2}:\d{2}", finestra or ""):
        interno += f" --window {finestra}"
    interno = _flag_budget(interno, budget, tetto)
    interno += f" >> '{LOG}' 2>&1"
    tr = f"\"{percorso_bash()}\" -lc \"{UNSET}{interno}\""
    args = ["schtasks", "/Create", "/F", "/TN", nome, "/ST", ora, "/TR", tr]
    if quando == "once":
        # se l'orario e' gia' passato oggi, la si mette a domani (formato it-IT)
        adesso = datetime.datetime.now()
        h, m = map(int, ora.split(":"))
        giorno = adesso.date() if (h, m) > (adesso.hour, adesso.minute) \
            else adesso.date() + datetime.timedelta(days=1)
        args += ["/SC", "ONCE", "/SD", giorno.strftime("%d/%m/%Y")]
        etichetta = f"una tantum {giorno.strftime('%d/%m')} alle {ora}"
    else:
        args += ["/SC", "DAILY"]
        etichetta = f"ogni giorno alle {ora}"
    rc, out = comando(args)
    return f"attivita' «{nome}» creata: {etichetta}" if rc == 0 else out


def rimuovi_task(nome: str) -> str:
    rc, out = comando(["schtasks", "/Delete", "/TN", nome, "/F"])
    return f"attivita' «{nome}» rimossa" if rc == 0 else out


CONFIG_LOCK = os.path.join(ZP, "config.lock")


def chi_riscrive_la_config() -> int | None:
    """Il pid del censimento in corso, se ce n'e' uno vivo. Un lock di un processo
    morto e' un orfano e non conta — altrimenti un censimento interrotto bloccherebbe
    per sempre chi viene dopo."""
    try:
        pid = int(open(CONFIG_LOCK, encoding="utf-8").read().splitlines()[0])
    except (OSError, ValueError, IndexError):
        return None
    try:
        os.kill(pid, 0)
        return pid
    except OSError:
        return None


def censimento(conferma: str) -> str:
    if conferma.strip().lower() != "zp censimento ok":
        return "conferma rituale mancante: scrivi esattamente «zp censimento ok»"

    # Il censimento riscrive zp.config.yaml PER INTERO. Il lucchetto lo porta il PID
    # del censimento, non quello della plancia, che resta viva per ore.
    vivo = chi_riscrive_la_config()
    if vivo:
        return f"c'e' gia' un censimento in corso (pid {vivo}): non ne parte un secondo"

    p = subprocess.Popen([percorso_claude(), "-p", "zp censimento ok"], cwd=REPO,
                         creationflags=DETACHED, env=ambiente_pulito(),
                         stdin=subprocess.DEVNULL,
                         stdout=open(LOG_CENS, "a", encoding="utf-8"),
                         stderr=subprocess.STDOUT, close_fds=True)
    os.makedirs(ZP, exist_ok=True)
    with open(CONFIG_LOCK, "w", encoding="utf-8") as f:
        f.write(f"{p.pid}\n{datetime.datetime.now().isoformat(timespec='seconds')}\ncensimento\n")
    return "censimento avviato in sessione headless (costo reale). Log nella scheda dedicata."


def rigenera_triage() -> str:
    # Il triage vive con gli altri strumenti del piano (docs/kb/tools/), non qui
    # accanto al pannello: usa zp_state come parser, come zp_gate e zp_zero_check.
    # Fino al 2026-08-09 questo bottone cercava `scripts/zp_triage.py`, che non e'
    # mai esistito nel repo — chi lo premeva otteneva un FileNotFoundError.
    rc, out = comando([sys.executable,
                       os.path.join(REPO, "docs", "kb", "tools", "zp_triage.py"),
                       "--md", TRIAGE_MD], timeout=120)
    return out.splitlines()[0] if rc == 0 and out else (out or "errore nel triage")


def condizioni_freno() -> list[str]:
    """Le condizioni PRESCRITTE (da zp.config.yaml meta e dal driver) per togliere
    il freno. Il bottone non forza mai: se una manca, rifiuta e la nomina."""
    mancanze = []
    _, sporco = comando(["git", "-C", REPO, "status", "--porcelain"])
    sporco = "\n".join(r for r in sporco.splitlines() if not r.startswith("?? .zp/"))
    if sporco.strip():
        mancanze.append("repo con modifiche (l'atto va committato su albero pulito: "
                        "chiudi prima la sessione canonica)")
    if da_config("clusters_classified").lower() != "true":
        mancanze.append("cluster non classificati per raggio d'impatto")
    for t in ("zp_state", "zp_gate", "zp_evidence", "zp_zero_check"):
        if not os.path.exists(os.path.join(REPO, "docs", "kb", "tools", t + ".py")):
            mancanze.append(f"manca docs/kb/tools/{t}.py")
    # PYTHONUTF8: il selftest legge fixture UTF-8 e il default cp1252 della console
    # Windows lo faceva morire di UnicodeDecodeError mascherando l'esito vero
    rc, out = comando([sys.executable, os.path.join("docs", "kb", "tools", "zp_selftest.py")],
                      cwd=REPO, timeout=180, env={**os.environ, "PYTHONUTF8": "1"})
    if rc != 0:
        ultima = out.splitlines()[-1] if out else "nessun output"
        mancanze.append(f"zp_selftest fallisce ({ultima})")
    try:
        piano = open(PIANO, encoding="utf-8").read()
    except OSError:
        piano = ""
    if not re.search(r"^- \[x\] \*\*Z-250\*\*", piano, re.M):
        mancanze.append("Z-250 aperto: i 4 test che richiedono una sessione viva "
                        "(bootstrap, freno a metà lavoro, troncamento da budget, frontiere "
                        "della description) non risultano fatti — serve la prima corsa "
                        "presidiata che li esegua")
    return mancanze


def freno(azione: str) -> str:
    testo = config_grezza()
    if not testo:
        return "config non leggibile"
    rel = os.path.relpath(CFG, REPO)
    if azione == "togli":
        mancanze = condizioni_freno()
        if mancanze:
            return "NON tolto — condizioni mancanti: " + " · ".join(mancanze)
        nuovo = re.sub(r"^(\s*autorizzato_non_presidiato:\s*)false", r"\g<1>true",
                       testo, count=1, flags=re.M)
        msg = ("chore(zp): Enzo autorizza il non presidiato dalla plancia "
               "(selftest verde, Z-250 chiuso, classificazione ok, repo pulito)")
        ok = "freno TOLTO e committato: il non presidiato è autorizzato"
    elif azione == "inserisci":
        _, sporco = comando(["git", "-C", REPO, "status", "--porcelain"])
        sporco = "\n".join(r for r in sporco.splitlines() if not r.startswith("?? .zp/"))
        if sporco.strip():
            return "NON reinserito: repo con modifiche — l'atto va committato su albero pulito"
        nuovo = re.sub(r"^(\s*autorizzato_non_presidiato:\s*)true", r"\g<1>false",
                       testo, count=1, flags=re.M)
        msg = "chore(zp): freno di sicurezza reinserito dalla plancia"
        ok = "freno REINSERITO e committato"
    else:
        return "azione sconosciuta"
    if nuovo == testo:
        return "già nello stato richiesto: nessuna modifica"
    with open(CFG, "w", encoding="utf-8", newline="\n") as f:
        f.write(nuovo)
    comando(["git", "-C", REPO, "add", rel])
    rc, out = comando(["git", "-C", REPO, "commit", "-m", msg])
    if rc != 0:
        return "modifica scritta ma commit fallito: " + out
    return ok


def salva_configurazione(nome: str, config: dict) -> str:
    nome = (nome or "").strip()
    if not nome:
        return "serve un nome per salvare"
    tutte = configs_salvate()
    tutte[nome] = config
    os.makedirs(os.path.dirname(CONFIGS), exist_ok=True)
    with open(CONFIGS, "w", encoding="utf-8") as f:
        json.dump(tutte, f, ensure_ascii=False, indent=2)
    return f"configurazione «{nome}» salvata"


def elimina_configurazione(nome: str) -> str:
    tutte = configs_salvate()
    if nome not in tutte:
        return "configurazione inesistente"
    del tutte[nome]
    with open(CONFIGS, "w", encoding="utf-8") as f:
        json.dump(tutte, f, ensure_ascii=False, indent=2)
    return f"«{nome}» eliminata"


def applica_configurazione(c: dict) -> str:
    """La via NON presidiata (la presidiata compone la frase lato client)."""
    corsia = c.get("corsia", "safe")
    n = int(c.get("iterazioni", 8))
    finestra = c.get("finestra", "")
    quando = c.get("quando", "adesso")
    b, t = c.get("budget_giro_usd"), c.get("tetto_corsa_usd")
    if quando == "adesso":
        return lancia_driver(corsia, n, finestra, bool(c.get("dry")), b, t)
    if quando == "notturna":
        return crea_task(TASK, "daily", c.get("ora", "23:00"), corsia, n, finestra, b, t)
    if quando == "una-tantum":
        return crea_task(TASK_ONCE, "once", c.get("ora", "23:00"), corsia, n, finestra, b, t)
    return "profilo temporale sconosciuto"


# ----------------------------------------------------------------- pagina

PAGINA = """<!doctype html><html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>zp — dashboard</title><style>
:root{color-scheme:dark;
 --piano:#0d0d0d; --sup:#1a1a19; --bordo:rgba(255,255,255,.10);
 --inchiostro:#fff; --sec:#c3c2b7; --muto:#898781; --griglia:#2c2c2a; --base:#383835;
 --accento:#3987e5; --accento-scuro:#184f95;
 --buono:#0ca30c; --avviso:#fab219; --serio:#ec835a; --critico:#d03b3b}
*{box-sizing:border-box}
body{margin:0;background:var(--piano);color:var(--inchiostro);
 font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
header{display:flex;align-items:baseline;gap:14px;padding:16px 26px;
 border-bottom:1px solid var(--bordo);position:sticky;top:0;background:var(--piano);z-index:5}
h1{font-size:17px;margin:0;font-weight:650}
#fresco{color:var(--muto);font-size:12px} header .sp{flex:1}
main{max-width:1240px;margin:0 auto;padding:20px 26px;display:grid;gap:16px}
.card{background:var(--sup);border:1px solid var(--bordo);border-radius:12px;padding:16px 18px}
h2{font-size:12px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;
 color:var(--muto);margin:0 0 12px}
.riga{display:grid;gap:16px}
@media(min-width:900px){.c2{grid-template-columns:1fr 1fr}.c3{grid-template-columns:2fr 1fr}}
.stati{display:grid;gap:8px}
@media(min-width:900px){.stati{grid-template-columns:repeat(3,1fr)}}
.stato{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1px solid var(--bordo);
 border-radius:9px;background:var(--piano)}
.stato .ic{font-size:15px;line-height:1.3;width:18px;text-align:center}
.stato b{display:block;font-size:13px;font-weight:600}
.stato small{color:var(--sec);font-size:12px}
.s-buono .ic{color:var(--buono)} .s-avviso .ic{color:var(--avviso)}
.s-serio .ic{color:var(--serio)} .s-critico .ic{color:var(--critico)} .s-neutro .ic{color:var(--muto)}
.kpi{display:grid;gap:12px;grid-template-columns:repeat(2,1fr)}
@media(min-width:900px){.kpi{grid-template-columns:repeat(6,1fr)}}
.tile{background:var(--piano);border:1px solid var(--bordo);border-radius:10px;padding:12px 14px}
.tile .v{font-size:26px;font-weight:650;letter-spacing:-.01em}
.tile .v small{font-size:14px;color:var(--sec);font-weight:500}
.tile .l{color:var(--sec);font-size:12px;margin-top:2px}
.onda{display:grid;grid-template-columns:34px 1fr 120px;gap:10px;align-items:center;margin:7px 0}
.onda .n{color:var(--muto);font-size:12px;font-variant-numeric:tabular-nums}
.pista{position:relative;height:14px;border-left:1px solid var(--base)}
.barra{position:absolute;left:0;top:0;height:14px;background:var(--accento);
 border-radius:0 4px 4px 0;min-width:2px;transition:width .3s}
.onda .val{font-size:12px;color:var(--sec);font-variant-numeric:tabular-nums}
.onda .val b{color:var(--inchiostro);font-weight:600}
.meter{height:10px;background:var(--griglia);border-radius:6px;overflow:hidden;margin:8px 0 6px}
.meter i{display:block;height:100%;background:var(--accento);border-radius:0 4px 4px 0}
.assi{display:flex;justify-content:space-between;color:var(--muto);font-size:11px;
 font-variant-numeric:tabular-nums}
.vinc{color:var(--sec);font-size:12px;margin-top:10px}
.vinc code{background:var(--piano);border:1px solid var(--bordo);border-radius:5px;padding:1px 6px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{color:var(--muto);text-align:left;font-weight:500;font-size:11px;letter-spacing:.05em;
 text-transform:uppercase;padding:4px 8px;border-bottom:1px solid var(--griglia)}
td{padding:6px 8px;border-bottom:1px solid var(--griglia);vertical-align:top}
td.num{font-variant-numeric:tabular-nums}
.chip{display:inline-block;border:1px solid var(--bordo);border-radius:99px;padding:1px 9px;
 font-size:11px;color:var(--sec)}
.vuoto{color:var(--muto);font-style:italic;padding:14px 4px}
label{display:block;margin:9px 0 4px;color:var(--sec);font-size:12px}
input,select,textarea{background:var(--piano);color:var(--inchiostro);border:1px solid var(--bordo);
 border-radius:7px;padding:7px 9px;width:100%;font:inherit}
input:focus,select:focus,textarea:focus{outline:2px solid var(--accento-scuro)}
button{border:0;border-radius:8px;padding:8px 15px;margin:12px 8px 0 0;cursor:pointer;
 font:inherit;font-weight:600}
.b-primo{background:var(--accento);color:#0d0d0d}
.b-critico{background:var(--critico);color:#fff}
.b-fantasma{background:transparent;color:var(--sec);border:1px solid var(--bordo)}
button:hover{filter:brightness(1.12)}
.esito{margin-top:9px;color:var(--avviso);font-size:12px;min-height:15px}
.nota{color:var(--muto);font-size:12px;margin:2px 0 0}
pre{background:var(--piano);border:1px solid var(--griglia);border-radius:9px;padding:12px;
 overflow:auto;font-size:12px;max-height:280px;white-space:pre-wrap;color:var(--sec)}
nav#viste{display:flex;gap:4px}
nav#viste button{margin:0;padding:6px 13px;border-radius:8px;background:transparent;
 color:var(--muto);font-weight:600;font-size:13px;border:1px solid transparent}
nav#viste button:hover{color:var(--sec)}
nav#viste button.attiva{background:var(--sup);color:var(--inchiostro);border-color:var(--bordo)}
/* una riga che resta con una sola scheda visibile non deve lasciare meta' schermo vuoto */
.riga.mono{grid-template-columns:1fr !important}
.tab{display:inline-block;margin:0 12px 8px 0;color:var(--muto);cursor:pointer;font-size:12px;
 padding-bottom:2px}
.tab.attivo{color:var(--inchiostro);border-bottom:2px solid var(--accento)}
/* modale */
#velo{position:fixed;inset:0;background:rgba(0,0,0,.6);display:none;z-index:20}
#modale{position:fixed;inset:4vh 0 auto 0;margin:0 auto;width:min(880px,94vw);max-height:92vh;
 overflow:auto;background:var(--sup);border:1px solid var(--bordo);border-radius:14px;
 padding:20px 24px;display:none;z-index:21}
.gruppo{border:1px solid var(--griglia);border-radius:10px;padding:12px 14px;margin:10px 0}
.gruppo h3{font-size:12px;color:var(--muto);margin:0 0 8px;font-weight:600;
 text-transform:uppercase;letter-spacing:.06em}
.scelte{display:flex;flex-wrap:wrap;gap:8px}
.scelta{display:flex;gap:7px;align-items:center;border:1px solid var(--bordo);border-radius:8px;
 padding:7px 12px;cursor:pointer;font-size:13px;color:var(--sec)}
.scelta input{width:auto;accent-color:var(--accento)}
.scelta.on{border-color:var(--accento);color:var(--inchiostro);background:rgba(57,135,229,.08)}
.griglia3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
#riepilogo{background:var(--piano);border:1px solid var(--accento-scuro);border-radius:9px;
 padding:10px 13px;font-size:13px;color:var(--sec);margin-top:10px}
#riepilogo b{color:var(--inchiostro)}
.salvate{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
.salvata{display:flex;gap:6px;align-items:center;border:1px solid var(--bordo);border-radius:9px;
 padding:5px 6px 5px 12px;font-size:12px}
.salvata b{color:var(--inchiostro);font-weight:600}
.salvata button{margin:0;padding:3px 9px;font-size:11px}
</style></head><body>
<header><h1>Zero-pendenze</h1><nav id="viste"></nav><span id="fresco"></span><span class="sp"></span>
 <button class="b-primo" style="margin:0" onclick="apriModale()">⚙ Imposta prossima sessione</button>
 <button class="b-fantasma" style="margin:0 0 0 8px" onclick="spegni()">Spegni plancia</button></header>
<main>
 <section class="card" data-vista="volo"><h2>In volo adesso</h2>
  <div id="volo-ora"></div>
  <p class="nota">Si aggiorna ogni 2 secondi. Se il tempo dall'ultima azione cresce e
   non torna a zero, non si sta muovendo piu' niente — ed e' l'unica cosa che una
   console di volo deve saper dire a colpo d'occhio.</p></section>
 <section class="card" data-vista="volo"><h2>Stato macchina</h2><div class="stati" id="stati"></div></section>
 <section class="card" data-vista="config"><h2>Il budget, misurato sulle corse vere</h2>
  <div id="cfg-budget"></div></section>
 <section class="card" data-vista="config"><h2>Configurazione del loop</h2>
  <div id="cfg-campi"></div>
  <div class="esito" id="e-cfg"></div>
  <p class="nota">Ogni modifica tocca <b>una sola riga</b> di <code>zp.config.yaml</code>
   e passa da <code>zp_state.py verifica</code>: se il piano non regge piu', il file
   viene <b>rimesso com'era</b> e qui compare il motivo. I commenti del file non si
   toccano — raccontano perche' il freno esiste, e valgono piu' del campo che stai
   cambiando.</p>
  <h2 style="margin-top:20px">Cio' che da qui non si tocca</h2>
  <div id="cfg-no"></div></section>
 <section class="card" data-vista="piano"><h2>Il piano in numeri</h2><div class="kpi" id="kpi"></div></section>
 <div class="riga c3">
  <section class="card" data-vista="piano"><h2>Aperti autonomi per ondata</h2><div id="ondate"></div>
   <p class="nota">Fonte: <code>zp_state.py piano</code> — una barra = cluster aperti; le ore accanto.</p></section>
  <section class="card" data-vista="volo"><h2>Spesa vs tetto</h2><div id="spesa"></div>
   <div class="vinc" id="vincoli"></div></section>
 </div>
 <div class="riga c2">
  <section class="card" data-vista="volo"><h2>Lancio rapido</h2>
   <p class="nota">Per la configurazione completa (profili, salvataggi, frase presidiata) usa
   «Imposta prossima sessione» in alto.</p>
   <label>Corsia</label><select id="corsia">
     <option value="safe">safe — classi A+B</option>
     <option value="full">full — anche C (precondizioni verificate dal driver)</option></select>
   <label>Iterazioni</label><input id="iter" type="number" value="8" min="1" max="12">
   <label>Finestra (HH:MM-HH:MM, vuota = nessuna)</label><input id="finestra" placeholder="23:00-06:30">
   <button class="b-primo" onclick="lancia()">Lancia adesso</button>
   <div class="esito" id="e-lancia"></div><p class="nota" id="n-lancia"></p></section>
  <section class="card" data-vista="volo"><h2>Fermare</h2>
   <p class="nota">Gentile = file STOP: il giro in volo finisce, il prossimo non parte.<br>
      Duro = TERM al driver: chiude anche la sessione in volo e molla il lock.</p>
   <button class="b-primo" onclick="azione('stop-gentile','e-stop')">STOP gentile</button>
   <button class="b-fantasma" onclick="azione('riprendi','e-stop')">Togli STOP</button>
   <button class="b-critico" onclick="azione('stop-duro','e-stop')">STOP duro</button>
   <div class="esito" id="e-stop"></div>
   <h2 style="margin-top:18px">Attività pianificate</h2>
   <div id="attivita"></div>
   <button class="b-fantasma" onclick="rimuoviTask('heuresys-zp-notte')">Rimuovi ricorrente</button>
   <button class="b-fantasma" onclick="rimuoviTask('heuresys-zp-una-tantum')">Rimuovi una-tantum</button>
   <div class="esito" id="e-task"></div></section>
 </div>
 <section class="card" data-vista="piano"><h2>Vassoio «aspetta te» — cluster bloccati su Enzo</h2>
  <div id="vassoio"></div></section>
 <div class="riga c2">
  <section class="card" data-vista="piano"><h2>Triage anti-stale</h2><div id="triage"></div>
   <button class="b-fantasma" onclick="azione('triage','e-triage')">Rigenera adesso</button>
   <div class="esito" id="e-triage"></div></section>
  <section class="card" data-vista="piano"><h2>Censimento — rifare il piano</h2>
   <p class="nota">Mai automatico. La frase per esteso è la tua firma; apre una sessione headless (costo reale).</p>
   <label>Conferma</label><input id="c-frase" placeholder="zp censimento ok">
   <button class="b-primo" onclick="cens()">Avvia censimento</button>
   <div class="esito" id="e-cens"></div></section>
 </div>
 <section class="card" data-vista="storico"><h2>Storico corse</h2><div id="corse"></div></section>
 <section class="card" data-vista="storico"><h2>Log</h2>
  <span class="tab attivo" id="tab-n" onclick="scheda('n')">notte</span>
  <span class="tab" id="tab-c" onclick="scheda('c')">censimento</span>
  <pre id="log"></pre></section>
</main>

<div id="velo" onclick="chiudiModale()"></div>
<div id="modale">
 <h2 style="font-size:15px;color:var(--inchiostro);text-transform:none;letter-spacing:0">
   Imposta prossima sessione</h2>
 <div class="gruppo"><h3>Modalità</h3><div class="scelte" id="g-modo">
   <label class="scelta"><input type="radio" name="modo" value="autonoma" checked
     onchange="mCambia()">Non presidiata — parte il driver</label>
   <label class="scelta"><input type="radio" name="modo" value="presidiata"
     onchange="mCambia()">Presidiata — compone la frase da incollare in sessione</label>
 </div></div>

 <div class="gruppo" id="g-quando-box"><h3>Quando</h3><div class="scelte" id="g-quando">
   <label class="scelta"><input type="radio" name="quando" value="adesso" checked
     onchange="mCambia()">Adesso</label>
   <label class="scelta"><input type="radio" name="quando" value="notturna"
     onchange="mCambia()">Notturna ricorrente</label>
   <label class="scelta"><input type="radio" name="quando" value="una-tantum"
     onchange="mCambia()">Una tantum a orario</label>
  </div>
  <div class="griglia3" id="g-ora-box" style="margin-top:10px">
   <div><label>Ora di partenza</label><input id="m-ora" value="23:00" oninput="mCambia()"></div>
  </div></div>

 <div class="gruppo"><h3>Durata / finestra</h3><div class="scelte">
   <label class="scelta"><input type="radio" name="fin" value="nessuna" checked
     onchange="mCambia()">Nessun limite</label>
   <label class="scelta"><input type="radio" name="fin" value="orario"
     onchange="mCambia()">Dalle — alle</label>
   <label class="scelta"><input type="radio" name="fin" value="ore"
     onchange="mCambia()">Per le prossime n ore</label>
  </div>
  <div class="griglia3" style="margin-top:10px">
   <div id="f-da-box" style="display:none"><label>Dalle</label><input id="m-da" value="23:00" oninput="mCambia()"></div>
   <div id="f-a-box" style="display:none"><label>Alle</label><input id="m-a" value="06:30" oninput="mCambia()"></div>
   <div id="f-n-box" style="display:none"><label>Ore</label><input id="m-n" type="number" value="3" min="1" max="12" oninput="mCambia()"></div>
  </div></div>

 <div class="gruppo" id="g-driver"><h3>Parametri del driver</h3>
  <div class="griglia3">
   <div><label>Corsia</label><select id="m-corsia" onchange="mCambia()">
     <option value="safe">safe — classi A+B</option>
     <option value="full">full — anche C</option></select></div>
   <div><label>Iterazioni (n batch)</label><input id="m-iter" type="number" value="8" min="1" max="12" oninput="mCambia()"></div>
   <div><label class="scelta" style="margin-top:22px"><input id="m-dry" type="checkbox"
     onchange="mCambia()">dry-run</label></div>
  </div>
  <div class="griglia3" style="margin-top:10px">
   <div><label>$/giro (soffitto: config)</label><input id="m-budget" type="number" min="1" step="1"
     placeholder="config" oninput="mCambia()"></div>
   <div><label>Tetto corsa $ (soffitto: config)</label><input id="m-tetto" type="number" min="1" step="5"
     placeholder="config" oninput="mCambia()"></div>
   <div><p class="nota" id="n-budget" style="margin-top:26px"></p></div>
  </div>
  <div style="margin-top:12px;border-top:1px solid var(--griglia);padding-top:10px">
   <button class="b-fantasma" id="b-freno" onclick="toggleFreno()">…</button>
   <div class="esito" id="e-freno"></div>
   <p class="nota">Non forza mai: verifica le condizioni prescritte (selftest verde, Z-250 chiuso,
   classificazione, repo pulito) e l'atto viene <b>committato</b> — è una modifica versionata.
   Se una condizione manca, rifiuta e la nomina.</p>
  </div></div>

 <div class="gruppo" id="g-pres" style="display:none"><h3>Mandato della sessione presidiata</h3>
  <div class="scelte">
   <label class="scelta"><input type="radio" name="mand" value="prossimo" checked
     onchange="mCambia()">Prossimo cluster</label>
   <label class="scelta"><input type="radio" name="mand" value="batch"
     onchange="mCambia()">Batch di un'ondata</label>
   <label class="scelta"><input type="radio" name="mand" value="report"
     onchange="mCambia()">Solo report</label>
   <label class="scelta"><input type="radio" name="mand" value="libero"
     onchange="mCambia()">Testo libero</label>
  </div>
  <div class="griglia3" style="margin-top:10px">
   <div id="p-onda-box" style="display:none"><label>Ondata</label><select id="m-onda" onchange="mCambia()">
     <option>W1</option><option>W2</option><option>W3</option><option>W4</option><option>W5</option></select></div>
  </div>
  <div id="p-libero-box" style="display:none"><label>Mandato</label>
   <input id="m-libero" placeholder="es. chiudi Z-085 e Z-090" oninput="mCambia()"></div>
  <label class="scelta" style="margin-top:10px"><input id="m-handoff" type="checkbox" checked
    onchange="mCambia()">al termine chiudi con handoff</label>
  <div id="p-frase-box" style="display:none;margin-top:10px">
   <label>Frase pronta — incollala nella sessione canonica</label>
   <textarea id="m-frase" rows="4" readonly></textarea>
   <button class="b-fantasma" onclick="copiaFrase()">Copia negli appunti</button></div>
 </div>

 <div id="riepilogo"></div>

 <div class="gruppo"><h3>Configurazioni salvate</h3>
  <div class="salvate" id="m-salvate"></div>
  <div class="griglia3" style="margin-top:8px">
   <div style="grid-column:1/3"><label>Salva questa configurazione come</label>
    <input id="m-nome" placeholder="es. notte-prudente"></div>
   <div><button class="b-fantasma" style="margin-top:26px" onclick="salvaConf()">Salva</button></div>
  </div><div class="esito" id="e-conf"></div></div>

 <button class="b-primo" id="m-applica" onclick="applica()">Applica</button>
 <button class="b-fantasma" onclick="chiudiModale()">Chiudi</button>
 <div class="esito" id="e-applica"></div>
</div>

<script>
let S=null, schedaLog='n';
const $=id=>document.getElementById(id);
const radio=n=>document.querySelector('input[name="'+n+'"]:checked').value;
const K=new URLSearchParams(location.search).get('k')||'';
const api=u=>K? u+(u.includes('?')?'&':'?')+'k='+K : u;
async function post(url,corpo){const r=await fetch(api(url),{method:'POST',
 headers:{'Content-Type':'application/json'},body:JSON.stringify(corpo||{})});
 return (await r.json()).esito}
function statoHtml(cl,ic,nome,desc){return '<div class="stato s-'+cl+'"><span class="ic">'+ic+
 '</span><span><b>'+nome+'</b><small>'+desc+'</small></span></div>'}
function tile(v,unita,l){return '<div class="tile"><div class="v">'+v+
 (unita?' <small>'+unita+'</small>':'')+'</div><div class="l">'+l+'</div></div>'}

const VISTE=[['volo','Volo'],['piano','Piano'],['config','Config'],['storico','Storico']];
let vista=localStorage.getItem('zp-vista')||'volo';
if(!VISTE.some(v=>v[0]===vista)) vista='volo';
function costruisciNav(){
 $('viste').innerHTML=VISTE.map(v=>'<button data-v="'+v[0]+'" onclick="mostraVista(this.dataset.v)">'
  +v[1]+'</button>').join('');
}
function mostraVista(v){
 vista=v; localStorage.setItem('zp-vista',v);
 document.querySelectorAll('[data-vista]').forEach(el=>{
  el.style.display = el.dataset.vista===v ? '' : 'none'; });
 /* Le righe SENZA vista propria contengono schede di viste diverse: restano visibili
    se almeno una scheda lo e', e passano a colonna unica se ne resta una sola —
    altrimenti mezzo schermo resterebbe vuoto. Le righe con vista propria le ha gia'
    sistemate il ciclo sopra: rimetterci mano le riaccenderebbe. */
 document.querySelectorAll('.riga:not([data-vista])').forEach(r=>{
  const vivi=[...r.children].filter(c=>c.style.display!=='none');
  r.style.display = vivi.length? '' : 'none';
  r.classList.toggle('mono', vivi.length===1); });
 document.querySelectorAll('#viste button').forEach(b=>
  b.classList.toggle('attiva', b.dataset.v===v));
}
function daQuando(iso){
 if(!iso) return null;
 const t=new Date(iso.replace(' ','T')).getTime();
 if(isNaN(t)) return null;
 return Math.max(0, Math.round((Date.now()-t)/1000));
}
function durata(sec){
 if(sec===null||sec===undefined) return '—';
 if(sec<60) return sec+'s fa';
 if(sec<3600) return Math.floor(sec/60)+'m '+(sec%60)+'s fa';
 return Math.floor(sec/3600)+'h '+Math.floor((sec%3600)/60)+'m fa';
}
let CFG=null;
async function caricaConfig(){
 try{ CFG=await (await fetch(api('/api/config'))).json(); renderConfig() }catch(e){}
}
function renderBudget(){
 const b=(S&&S.budget_dal_dato)||null;
 if(!b){$('cfg-budget').innerHTML='<p class="vuoto">nessuna corsa registrata</p>';return}
 let h='';
 if(b.scartate>0) h+=statoHtml('avviso','!','Registro incompleto: '+b.scartate+' righe su '+
  b.totali+' illeggibili','righe spezzate a meta scrittura. La causa e corretta nel driver: le corse nuove non si rompono piu');
 if(b.tasso_orario===null){ $('cfg-budget').innerHTML=h+'<p class="vuoto">nessuna corsa con costo e durata</p>'; return }
 h+=statoHtml(b.affidabile?'buono':'avviso', b.affidabile?'ok':'~',
   'Costo misurato: '+b.tasso_orario+' $/ora (mediano), '+b.tasso_massimo+' $/ora (massimo)',
   b.campioni+' corse leggibili'+(b.affidabile?'':' - sotto le 5, il numero indica ma non fonda'));
 const tetto=S.budget_giro? parseFloat(S.budget_giro):null;
 h+='<table style="margin-top:12px"><tr><th>cluster dichiarato</th><th>tetto derivato</th>'+
  '<th>tetto di oggi</th><th></th></tr>'+
  [0.8,1,2,4].map(function(o){ const d=Math.round(b.tasso_massimo*o*1.3*100)/100;
   const tronca = tetto!==null && d>tetto;
   return '<tr><td>'+o+' h</td><td class="num"><b>'+d+' $</b></td><td class="num">'+
    (tetto===null?'-':tetto)+' $</td><td>'+
    (tronca? '<span style="color:var(--critico)">il tetto di oggi tronca</span>':'')+'</td></tr>'}).join('')+
  '</table><p class="nota">Tasso massimo osservato x ore dichiarate x 1,3 di margine. '+
  'Il tetto fisso non guarda quanto e grande il lavoro: su un cluster lungo lo interrompe '+
  'invece di proteggerlo, e il troncamento si e gia visto negli esiti registrati.</p>';
 $('cfg-budget').innerHTML=h;
}
function renderConfig(){
 if(!CFG) return;
 if(CFG.errore){$('cfg-campi').innerHTML='<p class="vuoto">config illeggibile: '+CFG.errore+'</p>';return}
 $('cfg-campi').innerHTML='<table><tr><th>campo</th><th>valore</th><th>ammesso</th><th></th></tr>'+
  (CFG.campi||[]).map(c=> '<tr><td>'+c.etichetta+'<br><span class="chip">'+c.chiave+'</span></td>'+
   '<td style="width:120px">'+(c.valore===null
     ? '<span style="color:var(--avviso)">'+(c.nota||'non trovato')+'</span>'
     : '<input id="cfg-'+c.chiave+'" type="number" value="'+c.valore+'" min="'+c.min+
       '" max="'+c.max+'">')+'</td>'+
   '<td class="num" style="color:var(--muto);width:90px">'+c.min+'–'+c.max+'</td>'+
   '<td style="width:110px">'+(c.valore===null? ''
     : '<button class="b-fantasma" style="margin:0" onclick="salvaCampo(this,&quot;'+c.chiave+
       '&quot;)">Applica</button>')+'</td></tr>').join('')+'</table>';
 $('cfg-no').innerHTML=(CFG.intoccabili||[]).map(x=>
  '<div class="stato s-neutro"><span class="ic">🔒</span><span><b>'+x.chiave+
  '</b><small>'+x.perche+'</small></span></div>').join('');
}
async function salvaCampo(btn,chiave){
 const v=$('cfg-'+chiave).value;
 btn.disabled=true; $('e-cfg').textContent='scrivo e verifico il piano…';
 $('e-cfg').textContent=await post('/api/config-scrivi',{chiave:chiave,valore:v});
 btn.disabled=false;
 await caricaConfig();          /* si rilegge dal FILE: se c'e' stato rollback si vede */
}
function renderVolo(){
 if(!S) return;
 /* L'ultima azione fra TUTTI i diari: e' l'indicatore che dice se qualcosa si muove.
    Il lock dice se un driver esiste, non se sta facendo qualcosa: un driver bloccato
    ha il lock vivo e il diario fermo, ed e' proprio il caso che va visto subito. */
 let ultima=null, diChi=null;
 const D=S.diari||{};
 for(const n of Object.keys(D)){
  for(const r of (D[n]||[])){
   if(!ultima || (r.quando||'')>(ultima.quando||'')){ ultima=r; diChi=n }
  }
 }
 const eta=ultima? daQuando(ultima.quando) : null;
 const fermo = eta===null || eta>180;
 const L=S.lock||{};
 let h='';
 h+= L.presente&&L.vivo
  ? statoHtml('buono','●','Driver vivo','pid '+L.pid)
  : (L.presente? statoHtml('serio','◐','Lock orfano','il driver e morto senza chiudere')
               : statoHtml('neutro','○','Nessun driver','nessuna corsa in questo momento'));
 h+= ultima
  ? statoHtml(fermo?'avviso':'buono', fermo?'⏸':'▶',
      'Ultima azione '+durata(eta),
      diChi+' · '+String(ultima.comando||ultima.oggetto||ultima.bersaglio||'').slice(0,70))
  : statoHtml('neutro','○','Nessuna azione registrata','nessuna sessione ha ancora agito');
 $('volo-ora').innerHTML=h;
}
function render(){
 const s=S,p=s.piano;let h='';
 h+= s.freno_inserito
  ? statoHtml('avviso','⚠','Freno inserito','il non presidiato è bloccato: il driver rifiuta (exit 3). Si toglie solo con la tua autorizzazione')
  : statoHtml('buono','✓','Freno tolto','esecuzione non presidiata autorizzata');
 h+= s.lock.presente
  ? (s.lock.vivo? statoHtml('buono','●','Driver in esecuzione','pid '+s.lock.pid+' — un solo driver alla volta (lock)')
                : statoHtml('serio','◐','Lock orfano','driver morto senza chiudere: il prossimo avvio recupera da solo'))
  : statoHtml('neutro','○','Driver fermo','nessuna corsa in questo momento');
 h+= s.stop_presente
  ? statoHtml('serio','■','STOP presente','il driver non parte finché non lo togli')
  : statoHtml('buono','✓','Nessuno STOP','via libera al prossimo lancio');
 h+= s.repo_sporco===null ? statoHtml('neutro','?','Repo: stato ignoto','git non ha risposto')
  : (s.repo_sporco? statoHtml('avviso','⚠','Repo con modifiche','il driver rifiuterà (exit 4): serve handoff della sessione in corso')
                  : statoHtml('buono','✓','Repo pulito','precondizione di lancio soddisfatta'));
 h+= (s.task_daily||s.task_once)
  ? statoHtml('buono','◔','Attività pianificate: '+[s.task_daily?'ricorrente':'',s.task_once?'una-tantum':''].filter(Boolean).join(' + '),'gestiscile dal pannello «Fermare» o dal configuratore')
  : statoHtml('neutro','○','Nessuna attività pianificata','creala con «Imposta prossima sessione»');
 h+= (s.ultimo_esito&&s.ultimo_esito.outcome)
  ? statoHtml('neutro','↩','Ultimo esito: '+s.ultimo_esito.outcome,(s.ultimo_esito.cluster||'')+' '+(s.ultimo_esito.reason||''))
  : statoHtml('neutro','○','Nessun esito registrato','il loop non ha ancora chiuso iterazioni');
 h+= s.auth.api_key_utente
  ? statoHtml('avviso','⚠','API key utente presente','è stantia e viene IGNORATA nei lanci (la plancia la spoglia): fa fede l\\'abbonamento'+(s.auth.auth_token?' via ANTHROPIC_AUTH_TOKEN':''))
  : (s.auth.auth_token? statoHtml('buono','✓','Auth headless: ANTHROPIC_AUTH_TOKEN','i lanci usano il token dell\\'abbonamento')
                      : statoHtml('buono','✓','Auth headless: login abbonamento','nessuna variabile interferisce'));
 h+= s.accesso_lan
  ? statoHtml('neutro','📱','Raggiungibile dalla rete locale','<a style="color:var(--accento)" href="'+s.accesso_lan+'">'+s.accesso_lan.split('?')[0]+'</a> — con la chiave (già nel link)')
  : statoHtml('neutro','○','Solo locale','avviata con --solo-locale o IP LAN non rilevato');
 $('stati').innerHTML=h;

 const pct=p.totali?Math.round(100*p.chiusi/p.totali):0;
 $('kpi').innerHTML=tile(p.chiusi+'<small>/'+p.totali+'</small>','','cluster chiusi')+
  tile(pct,'%','completamento')+tile(p.aperti,'','aperti')+
  tile(p.autonomi,'','autonomi ('+p.ore_autonome+'h)')+
  tile(p.su_enzo,'','aspettano te')+tile(s.spesa_usd.toFixed(2),'$','spesa registrata');

 const max=Math.max(1,...p.ondate.map(o=>o.pezzi));
 $('ondate').innerHTML=p.ondate.length? p.ondate.map(o=>
  '<div class="onda"><span class="n">'+o.nome+'</span>'+
  '<span class="pista" title="'+o.nome+': '+o.pezzi+' cluster, '+o.ore+' ore"><i class="barra" style="width:'+
  (100*o.pezzi/max)+'%"></i></span>'+
  '<span class="val"><b>'+o.pezzi+'</b> cluster · '+o.ore+'h</span></div>').join('')
  : '<div class="vuoto">nessuna ondata aperta</div>';

 const q=Math.min(100,100*s.spesa_usd/s.tetto_usd);
 $('spesa').innerHTML='<div class="assi"><span>'+s.spesa_usd.toFixed(2)+' $ spesi · '+
  (s.corse.length? s.corse.length+' corse':'nessuna corsa registrata')+'</span><span>tetto '+
  s.tetto_usd.toFixed(0)+' $</span></div><div class="meter"><i style="width:'+q+'%"></i></div>'+
  '<div class="assi"><span>0</span><span>'+s.tetto_usd.toFixed(0)+'</span></div>';
 $('vincoli').innerHTML='Guard-rail dal driver e dalla config: <code>'+s.budget_giro+
  ' $/giro</code> <code>1 cluster/iterazione</code> <code>'+s.ore_max_cluster+
  'h max/cluster</code> <code>deploy vietato in non presidiato</code>';

 $('n-lancia').textContent = s.freno_inserito
  ? 'Nota: col freno inserito il driver rifiuterà — il rifiuto lo leggi nel log. È il comportamento voluto.'
  : (s.repo_sporco? 'Nota: repo con modifiche — il driver rifiuterà finché la sessione in corso non chiude.':'');
 $('attivita').innerHTML=(s.task_daily?'<span class="chip">ricorrente attiva</span> ':'')+
  (s.task_once?'<span class="chip">una-tantum attiva</span>':'')||
  '<span class="nota">nessuna</span>';

 $('vassoio').innerHTML=s.vassoio_enzo.length
  ? '<table><tr><th>id</th><th>tipo</th><th>effort</th><th>cosa aspetta</th></tr>'+
   s.vassoio_enzo.map(v=>'<tr><td class="num">'+v.id+'</td><td><span class="chip">'+v.tipo+
   '</span></td><td class="num">'+v.effort+'</td><td>'+v.titolo+'</td></tr>').join('')+'</table>'
  : '<div class="vuoto">niente in attesa di te</div>';

 const t=s.triage;
 $('triage').innerHTML=t.presente
  ? '<p class="nota">generato '+t.generato+' su HEAD '+t.head+'</p><table>'+
   Object.entries(t.classi).map(([k,v])=>'<tr><td>'+k.toLowerCase()+'</td><td class="num">'+v+'</td></tr>').join('')+'</table>'
  : '<div class="vuoto">mai generato — usa il bottone</div>';

 $('corse').innerHTML=s.corse.length
  ? '<table><tr><th>esito</th><th>cluster</th><th>costo $</th><th>quando</th></tr>'+
   s.corse.slice().reverse().map(c=>'<tr><td>'+(c.outcome||c.esito||'?')+'</td><td class="num">'+
   (c.cluster||'—')+'</td><td class="num">'+((+c.costo_usd||0).toFixed(2))+'</td><td class="num">'+
   (c.quando||c.ts||'—')+'</td></tr>').join('')+'</table>'
  : '<div class="vuoto">nessuna corsa registrata — il driver non è mai partito</div>';

 $('log').textContent=schedaLog==='n'? s.log : s.log_censimento;
 renderVolo(); renderBudget();
 $('fresco').textContent='aggiornato '+new Date().toLocaleTimeString('it-IT');
 renderSalvate();
}

/* ---------------- modale ---------------- */
function apriModale(){$('velo').style.display='block';$('modale').style.display='block';mCambia()}
function chiudiModale(){$('velo').style.display='none';$('modale').style.display='none'}
function hhmm(d){return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}
function finestraCalcolata(){
 const f=radio('fin');
 if(f==='orario') return $('m-da').value+'-'+$('m-a').value;
 if(f==='ore'){const n=+$('m-n').value||1,da=new Date(),a=new Date(Date.now()+n*3600e3);
  return hhmm(da)+'-'+hhmm(a)}
 return '';
}
function configCorrente(){return {
 modo:radio('modo'), quando:radio('quando'), ora:$('m-ora').value,
 fin:radio('fin'), da:$('m-da').value, a:$('m-a').value, n:+$('m-n').value,
 finestra:finestraCalcolata(),
 corsia:$('m-corsia').value, iterazioni:+$('m-iter').value, dry:$('m-dry').checked,
 budget_giro_usd:$('m-budget').value||null, tetto_corsa_usd:$('m-tetto').value||null,
 mand:radio('mand'), onda:$('m-onda').value, libero:$('m-libero').value,
 handoff:$('m-handoff').checked}}
function fraseFinestra(c){
 if(c.fin==='orario') return ' Lavora entro la finestra '+c.da+'–'+c.a+
   ': a quell\\'ora fermati anche a metà voce e metti lo stato in INTERRUPTED con resume-from.';
 if(c.fin==='ore') return ' Lavora per le prossime '+c.n+' ore, poi fermati'+
   ' anche a metà voce e metti lo stato in INTERRUPTED con resume-from.';
 return '';
}
function frasePresidiata(c){
 let m;
 if(c.mand==='prossimo') m='zero pendenze: prossimo cluster.';
 else if(c.mand==='batch') m='esegui il batch '+c.onda+' del piano zero-pendenze senza interromperti fra le voci.';
 else if(c.mand==='report') m='zp report.';
 else m=(c.libero||'…')+'.';
 return 'avvia sessione\\n'+m+fraseFinestra(c)+(c.handoff?' Al termine chiudi con handoff.':'');
}
function mCambia(){
 const c=configCorrente();
 document.querySelectorAll('.scelta').forEach(l=>{const i=l.querySelector('input');
  l.classList.toggle('on', i.type==='checkbox'? i.checked : i.checked)});
 $('g-driver').style.display = c.modo==='autonoma'?'':'none';
 $('g-quando-box').style.display = c.modo==='autonoma'?'':'none';
 $('g-pres').style.display = c.modo==='presidiata'?'':'none';
 $('g-ora-box').style.display = (c.modo==='autonoma'&&c.quando!=='adesso')?'':'none';
 $('f-da-box').style.display=$('f-a-box').style.display = c.fin==='orario'?'':'none';
 $('f-n-box').style.display = c.fin==='ore'?'':'none';
 $('p-onda-box').style.display = c.mand==='batch'?'':'none';
 $('p-libero-box').style.display = c.mand==='libero'?'':'none';
 $('p-frase-box').style.display = c.modo==='presidiata'?'':'none';
 if(c.modo==='presidiata'){$('m-frase').value=frasePresidiata(c).replace('\\\\n','\\n');
  $('m-applica').textContent='Mostra la frase';}
 else $('m-applica').textContent = c.quando==='adesso'?'Lancia adesso':'Pianifica';
 if(S&&$('b-freno')) $('b-freno').textContent = S.freno_inserito
   ? 'Togli il freno (verifica le condizioni)' : 'Reinserisci il freno';
 if(S){const ok=S.driver_budget_flags;
  $('m-budget').disabled=$('m-tetto').disabled=!ok;
  $('n-budget').textContent= ok
   ? 'la config resta il soffitto: valori più alti vengono ridotti dal driver'
   : 'si attivano con la consegna «budget dinamici» (in lab inbox): il driver di oggi non conosce i flag';}
 // riepilogo
 let r;
 if(c.modo==='presidiata') r='<b>Presidiata</b>: la frase qui sotto va incollata in una sessione canonica. '+
   (S&&S.freno_inserito?'':'')+'Nessun processo parte da qui.';
 else{
  r='<b>Non presidiata</b>: '+(c.quando==='adesso'?'il driver parte subito':
    c.quando==='notturna'?'attività di Windows ricorrente alle <b>'+c.ora+'</b>':
    'attività una-tantum alla prossima occorrenza delle <b>'+c.ora+'</b>')+
   ', corsia <b>'+c.corsia+'</b>, <b>'+c.iterazioni+'</b> iterazioni'+
   (c.finestra?', finestra <b>'+c.finestra+'</b>':'')+(c.dry?', <b>dry-run</b>':'')+
   (c.budget_giro_usd&&S&&S.driver_budget_flags?', budget <b>'+c.budget_giro_usd+' $/giro</b>':'')+
   (c.tetto_corsa_usd&&S&&S.driver_budget_flags?', tetto corsa <b>'+c.tetto_corsa_usd+' $</b>':'')+'.';
  if(S&&S.freno_inserito) r+=' <span style="color:var(--avviso)">⚠ Freno inserito: il driver rifiuterà (exit 3) finché non lo autorizzi.</span>';
  if(S&&S.repo_sporco&&c.quando==='adesso') r+=' <span style="color:var(--avviso)">⚠ Repo con modifiche: rifiuterà (exit 4).</span>';
 }
 $('riepilogo').innerHTML='Cosa succederà — '+r;
}
async function applica(){
 const c=configCorrente();
 if(c.modo==='presidiata'){ $('e-applica').textContent='frase composta qui sopra: copiala e incollala nella sessione.'; return }
 $('e-applica').textContent=await post('/api/applica',c); setTimeout(aggiorna,800);
}
function copiaFrase(){navigator.clipboard.writeText($('m-frase').value)
 .then(()=>$('e-applica').textContent='frase copiata negli appunti')}
function renderSalvate(){
 const box=$('m-salvate'); if(!box||!S) return;
 const nomi=Object.keys(S.configs||{});
 box.innerHTML=nomi.length? nomi.map(n=>'<span class="salvata"><b>'+n+'</b>'+
  '<button class="b-fantasma" onclick="caricaConf(\\''+n+'\\')">carica</button>'+
  '<button class="b-fantasma" onclick="usaConf(\\''+n+'\\')">usa</button>'+
  '<button class="b-critico" onclick="eliminaConf(\\''+n+'\\')">×</button></span>').join('')
  :'<span class="nota">nessuna configurazione salvata</span>';
}
function caricaConf(nome){
 const c=S.configs[nome]; if(!c) return;
 document.querySelector('input[name="modo"][value="'+c.modo+'"]').checked=true;
 document.querySelector('input[name="quando"][value="'+(c.quando||'adesso')+'"]').checked=true;
 document.querySelector('input[name="fin"][value="'+(c.fin||'nessuna')+'"]').checked=true;
 document.querySelector('input[name="mand"][value="'+(c.mand||'prossimo')+'"]').checked=true;
 $('m-ora').value=c.ora||'23:00';$('m-da').value=c.da||'23:00';$('m-a').value=c.a||'06:30';
 $('m-n').value=c.n||3;$('m-corsia').value=c.corsia||'safe';$('m-iter').value=c.iterazioni||8;
 $('m-dry').checked=!!c.dry;$('m-onda').value=c.onda||'W1';$('m-libero').value=c.libero||'';
 $('m-budget').value=c.budget_giro_usd||'';$('m-tetto').value=c.tetto_corsa_usd||'';
 $('m-handoff').checked=c.handoff!==false; $('m-nome').value=nome; mCambia();
 $('e-conf').textContent='«'+nome+'» caricata nel form';
}
async function usaConf(nome){caricaConf(nome);await applica()}
async function toggleFreno(){$('e-freno').textContent='verifico le condizioni (selftest incluso)…';
 $('e-freno').textContent=await post('/api/freno',
 {azione:S&&S.freno_inserito?'togli':'inserisci'});setTimeout(aggiorna,800)}
async function salvaConf(){$('e-conf').textContent=await post('/api/configs',
 {azione:'salva',nome:$('m-nome').value,config:configCorrente()});aggiorna()}
async function eliminaConf(nome){$('e-conf').textContent=await post('/api/configs',
 {azione:'elimina',nome:nome});aggiorna()}

/* ---------------- azioni base ---------------- */
let G=null;
async function aggiorna(){
 S=await (await fetch(api('/api/stato'))).json(); S._fermo=0;
 render(); mostraVista(vista);
}
/* Il battito del cockpit: solo cio' che cambia mentre guardi (lock, STOP, ultimo
   esito, spesa, log) — tutte letture di file, nessun processo. Lo stato pesante
   (schtasks, git, piano) resta sul giro lento.
   Se il battito non risponde la pagina NON si svuota: tiene l'ultimo valore buono e
   lo dichiara. Un cockpit che mostra zero quando non sa e' peggio di uno fermo. */
async function battito(){
 if(!S) return;
 try{ const v=await (await fetch(api('/api/volo'))).json(); Object.assign(S,v); S._fermo=0; render() }
 catch(e){ S._fermo=(S._fermo||0)+1;
  if(S._fermo>=2) $('fresco').textContent='⚠ dati fermi da '+(S._fermo*2)+'s — la plancia non risponde' }
}
function scheda(x){schedaLog=x;$('tab-n').classList.toggle('attivo',x==='n');
 $('tab-c').classList.toggle('attivo',x==='c');render()}
async function lancia(){$('e-lancia').textContent=await post('/api/lancia',
 {corsia:$('corsia').value,iterazioni:+$('iter').value,finestra:$('finestra').value});
 setTimeout(aggiorna,800)}
async function azione(a,dove){$(dove).textContent=await post('/api/'+a);setTimeout(aggiorna,600)}
async function rimuoviTask(n){$('e-task').textContent=await post('/api/task-rimuovi',{nome:n});
 setTimeout(aggiorna,600)}
async function cens(){$('e-cens').textContent=await post('/api/censimento',
 {conferma:$('c-frase').value})}
async function spegni(){await post('/api/spegni');document.body.innerHTML=
 '<p style="padding:40px;color:#898781">plancia spenta — chiudi pure la scheda.</p>'}
costruisciNav(); mostraVista(vista); caricaConfig();
aggiorna(); setInterval(aggiorna, 20000); setInterval(battito, 2000);
</script></body></html>"""


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _json(self, corpo: dict, codice: int = 200):
        dati = json.dumps(corpo, ensure_ascii=False).encode("utf-8")
        self.send_response(codice)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(dati)))
        self.end_headers()
        self.wfile.write(dati)

    def _autorizzato(self) -> bool:
        """Dal PC (loopback) si entra liberi; dalla LAN serve la chiave nell'URL.
        La plancia comanda processi: aperta senza chiave, chiunque sul WiFi
        potrebbe lanciarli."""
        if APERTA or self.client_address[0] in ("127.0.0.1", "::1"):
            return True
        from urllib.parse import urlparse, parse_qs
        q = parse_qs(urlparse(self.path).query)
        return bool(CHIAVE) and q.get("k", [""])[0] == CHIAVE

    def _percorso(self) -> str:
        from urllib.parse import urlparse
        return urlparse(self.path).path

    def do_GET(self):
        if not self._autorizzato():
            dati = ("chiave mancante o errata.\nApri  http://<ip-del-pc>:8477/?k=<chiave>\n"
                    "La chiave sta sul PC in  " + CHIAVE_FILE).encode("utf-8")
            self.send_response(403)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(dati)))
            self.end_headers()
            self.wfile.write(dati)
            return
        if self._percorso() == "/api/stato":
            return self._json(stato())
        if self._percorso() == "/api/volo":
            return self._json(stato_veloce())
        if self._percorso() == "/api/config":
            return self._json(config_campi())
        dati = PAGINA.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(dati)))
        self.end_headers()
        self.wfile.write(dati)

    def do_POST(self):
        if not self._autorizzato():
            return self._json({"esito": "chiave mancante o errata"}, 403)
        percorso = self._percorso()
        n = int(self.headers.get("Content-Length") or 0)
        try:
            corpo = json.loads(self.rfile.read(n) or b"{}")
        except ValueError:
            corpo = {}
        if percorso == "/api/lancia":
            esito = lancia_driver(corpo.get("corsia", "safe"), corpo.get("iterazioni", 8),
                                  corpo.get("finestra", ""), bool(corpo.get("prova")))
        elif percorso == "/api/applica":
            esito = applica_configurazione(corpo)
        elif percorso == "/api/configs":
            if corpo.get("azione") == "salva":
                esito = salva_configurazione(corpo.get("nome", ""), corpo.get("config", {}))
            elif corpo.get("azione") == "elimina":
                esito = elimina_configurazione(corpo.get("nome", ""))
            else:
                esito = "azione sconosciuta"
        elif percorso == "/api/stop-gentile":
            open(os.path.join(ZP, "STOP"), "w").close()
            esito = "STOP creato: il driver si ferma al prossimo giro"
        elif percorso == "/api/riprendi":
            try:
                os.remove(os.path.join(ZP, "STOP"))
                esito = "STOP rimosso"
            except OSError:
                esito = "nessuno STOP da rimuovere"
        elif percorso == "/api/stop-duro":
            l = lock_stato()
            if l.get("presente") and l.get("vivo"):
                rc, out = comando([percorso_bash(), "-c", f"kill -TERM {l['pid']}"])
                esito = "TERM inviato: il driver chiude e molla il lock" if rc == 0 else out
            else:
                esito = "nessun driver vivo da fermare"
        elif percorso == "/api/task-rimuovi":
            esito = rimuovi_task(corpo.get("nome", TASK))
        elif percorso == "/api/censimento":
            esito = censimento(corpo.get("conferma", ""))
        elif percorso == "/api/triage":
            esito = rigenera_triage()
        elif percorso == "/api/config-scrivi":
            esito = config_scrivi(corpo.get("chiave", ""), corpo.get("valore", ""))
        elif percorso == "/api/freno":
            esito = freno(corpo.get("azione", ""))
        elif percorso == "/api/spegni":
            self._json({"esito": "plancia spenta"})
            import threading
            threading.Thread(target=self.server.shutdown, daemon=True).start()
            return
        else:
            return self._json({"esito": "endpoint sconosciuto"}, 404)
        self._json({"esito": esito})


def ip_lan() -> str:
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("192.168.1.1", 80))   # nessun pacchetto parte: serve solo l'interfaccia
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return ""


def main() -> int:
    global CHIAVE, ACCESSO_LAN, PORTA
    p = argparse.ArgumentParser()
    p.add_argument("--no-browser", action="store_true")
    p.add_argument("--solo-locale", action="store_true",
                   help="ascolta solo su 127.0.0.1 (niente telefono/tablet)")
    p.add_argument("--senza-chiave", action="store_true",
                   help="LAN aperta senza chiave: chiunque sulla rete puo' comandare la plancia")
    # C'era gia' un messaggio che diceva «oppure usa --porta con un numero diverso»,
    # ma l'opzione non esisteva: il consiglio mandava dritti a un errore di argomenti.
    # Serve davvero — e' l'unico modo di provare una versione nuova senza spegnere
    # quella che sta girando.
    p.add_argument("--porta", type=int, default=PORTA,
                   help=f"porta di ascolto (default {PORTA})")
    a = p.parse_args()
    PORTA = a.porta
    global APERTA
    APERTA = a.senza_chiave

    # chiave d'accesso LAN: persistente, mai stampata in chat/log condivisi
    try:
        CHIAVE = open(CHIAVE_FILE, encoding="utf-8").read().strip()
    except OSError:
        CHIAVE = ""
    if not CHIAVE:
        import secrets
        CHIAVE = secrets.token_hex(8)
        os.makedirs(os.path.dirname(CHIAVE_FILE), exist_ok=True)
        with open(CHIAVE_FILE, "w", encoding="utf-8") as f:
            f.write(CHIAVE + "\n")

    bind = "127.0.0.1" if a.solo_locale else "0.0.0.0"
    ip = "" if a.solo_locale else ip_lan()
    ACCESSO_LAN = (f"http://{ip}:{PORTA}/" if APERTA else f"http://{ip}:{PORTA}/?k={CHIAVE}") if ip else ""
    if APERTA and ip:
        print("⚠ LAN APERTA SENZA CHIAVE: chiunque sulla rete puo' comandare la plancia.")
    # La porta si CONTROLLA prima di prenderla. Su Windows due processi possono
    # restare in ascolto sulla stessa porta senza che nessuno dei due protesti, e
    # chi risponde al browser diventa indeterminato. Misurato il 2026-08-09: una
    # istanza rimasta accesa dalla sera prima serviva la pagina al posto di quella
    # appena avviata, quindi il bottone del triage continuava a eseguire il CODICE
    # VECCHIO — una correzione applicata e committata sembrava non aver funzionato.
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sonda:
        sonda.settimeout(0.4)
        if sonda.connect_ex(("127.0.0.1", PORTA)) == 0:
            print(f"c'e' gia' qualcosa in ascolto su {PORTA}: non parto, altrimenti")
            print("saremmo in due a rispondere e non si saprebbe chi. Chiudi l'altra")
            print("istanza (il PID di python.exe, non il terminale che l'ha lanciata)")
            print(f"oppure usa --porta con un numero diverso.")
            return 4

    srv = ThreadingHTTPServer((bind, PORTA), Handler)
    print(f"zp dashboard su http://127.0.0.1:{PORTA}")
    if ACCESSO_LAN:
        print(f"da telefono/tablet sulla stessa rete: {ACCESSO_LAN}")
        print(f"(la chiave sta in {CHIAVE_FILE}; senza chiave la LAN riceve 403)")
    if not a.no_browser:
        webbrowser.open(f"http://127.0.0.1:{PORTA}")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
