#!/usr/bin/env python3
"""
verify_gate.py — cancello di verifica per heuresys-advanced.

Principio: il verdetto e' funzione dello STATO OSSERVABILE, mai della
conversazione. Non chiede "hai verificato?", legge il working tree e gli
exit code. Se lo stato cambia, il verdetto scade da solo.

Freschezza PER SUITE (S1045)
----------------------------
Ogni suite porta l'impronta dei SOLI file che la instradano, presa sul
contenuto:

    scope(suite) = sha256( contenuto dei file modificati che instradano suite )

Prima l'impronta era una sola per tutto (HEAD + status + diff): correggere una
pagina di `apps/web` scadeva anche i 37 minuti di `test-api`, e modificare
questo stesso file — che non instrada alcuna suite — azzerava il verdetto. Con
una suite cosi' lunga il ciclo «correggi -> verifica» non converge: ogni
correzione suggerita dal verdetto invalida il verdetto, e l'hook Stop rimanda
all'inizio. Da qui la granularita' per suite, e `run` che riesegue solo cio'
che serve.

Conseguenza voluta: `git commit` non scade piu' niente — il contenuto
verificato e' lo stesso, cambia solo dove e' scritto.

Rieseguire e' idempotente: stesso stato -> stesso verdetto, nessun effetto
collaterale.

Sottocomandi
------------
  route   stampa quali suite servono per il diff corrente (deterministico)
  run     esegue le suite scadute o rosse e scrive .zp/verify-verdict.json;
          quelle gia' verdi sullo stesso contenuto si riusano
          --all           riesegui tutto, anche cio' che e' gia' verde
          --suite NOME    esegui QUESTA suite anche se il diff non la instrada
                          (ripetibile). Serve a misurare a working tree pulito:
                          vedi «Misura chiesta a mano» qui sotto.
  check   confronta impronte ed exit code — exit 0 se verde e fresco
          --hook  emette il JSON per l'hook Stop invece del testo

Misura chiesta a mano (S1054)
-----------------------------
Il router guarda il DIFF: a working tree pulito non instrada niente, e prima
`run` prendeva la scorciatoia «niente da verificare» scrivendo un verdetto
`green` con `results: []` — un verde per ASSENZA di misura, che per giunta
cancellava dal file il rosso precedente. Misurato in S1054, il giorno dopo che
un freno era stato tirato proprio per un rosso che nessuno riusciva a rimettere
in pari: il comando indicato per rimetterlo in pari non avrebbe eseguito nulla.

Due correzioni, entrambe nel verso di stringere:
  * quel ramo scrive ora `verdict: "not-measured"`, mai `green`: il file dice
    cio' che e' successo (nessuna misura), non cio' che fa comodo;
  * `--suite NOME` esegue una suite per nome, fuori dal routing, e la esegue
    SEMPRE — anche se il verdetto precedente la dava verde e fresca: chi la
    chiede a mano vuole la misura, non il ricordo di una misura.
Cio' che NON cambia: le suite instradate dal diff restano obbligatorie, e
nessuna suite risulta passata se non e' stata eseguita su quel contenuto.

Freno
-----
  .zp/verify-off   se il file esiste, il cancello e' sempre verde.

Il routing riusa i trigger dei workflow CI, cosi' cancello locale e CI non
divergono mai.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
VERDICT = REPO / ".zp" / "verify-verdict.json"
BRAKE = REPO / ".zp" / "verify-off"

# --- Layer 1: il router --------------------------------------------------
# prefisso di path -> suite da eseguire. Primo match che vince, in ordine.
ROUTES: list[tuple[str, list[str]]] = [
    # ⚠ LE ROTTE PIU' SPECIFICHE VANNO PRIMA: `route()` si ferma al primo prefisso che
    # combacia (`break`). Messe dopo `apps/api/`, queste due non verrebbero mai raggiunte.
    #
    # #181 F2 — la prova che l'assert di drift RILASCIA il lucchetto esisteva, era
    # tracciata, e non la eseguiva nessuno: non era nella batteria e non era instradata.
    # Un controllo che esiste e non controlla e' il difetto che #181 racconta, applicato
    # alla prova del difetto stesso. Gira solo toccando il codice che sorveglia — costa
    # una corsa vera di Vitest, quindi non va nella batteria di ogni `scripts/`.
    # Le suite si RIPETONO di proposito: `break` interrompe al primo match, quindi una
    # rotta specifica che elencasse solo `drift-lock` farebbe PERDERE typecheck e test-api
    # proprio ai file piu' delicati. Aggiungere, non sostituire.
    ("apps/api/test/helpers/drift-check.ts", ["typecheck", "test-api", "drift-lock"]),
    ("apps/api/vitest.config.ts",            ["typecheck", "test-api", "drift-lock"]),
    ("apps/api/",        ["typecheck", "test-api"]),
    ("packages/shared/", ["typecheck", "test-api"]),
    ("apps/web/",        ["typecheck", "lint"]),
    ("apps/showcase/",   ["typecheck", "lint"]),
    # `handoff-lint` c'e' perche' verifica anche il CONTEGGIO delle migrazioni sul
    # disco contro la headline di SOT_STATE (check D3). Legarlo ai soli file di
    # stato era un buco: aggiungere una migrazione cambia cio' che quel lint
    # misura, ma non i file che lo instradavano — cosi' il cancello locale restava
    # verde e il rosso compariva solo in CI, a push fatto. Misurato in S1045 con la
    # 000273: headline a 000272, disco a 000273, gate locale verde, `state-lint`
    # rosso e deploy bloccato dal suo stesso cancello.
    ("db/migrations/",   ["migrate-idempotent", "db-health", "no-contamination", "handoff-lint"]),
    ("db/",              ["typecheck", "db-health", "no-contamination"]),
    ("scripts/",         ["shell-tests"]),
    # solo i file di stato governati dall'handoff, non i tool sotto docs/kb/tools/
    ("docs/kb/SOT_",     ["handoff-lint"]),
    ("docs/kb/DEBT_",    ["handoff-lint"]),
    ("docs/kb/tools/handoff_lint.py", ["handoff-lint"]),
    (".handoff/",        ["handoff-lint"]),
    # Un piano si rompe in due modi: cambiando il piano, o cambiando il parser che lo legge.
    # Entrambi instradano la stessa suite, o meta' dei difetti resta invisibile.
    (".programmi/",      ["programmi"]),
    ("docs/kb/tools/programmi.py", ["programmi"]),
]

# suite -> (livello, comando). I livelli seguono la piramide del playbook:
# L0 statica · L1 contratto · L2 integrazione su dati reali · L3 end-to-end.
SUITES: dict[str, tuple[str, str]] = {
    "typecheck":          ("L0", "pnpm typecheck"),
    "lint":               ("L0", "pnpm lint"),
    "test-api":           ("L2", "pnpm --filter @heuresys/api test"),
    "migrate-idempotent": ("L2", "pnpm db:migrate:sh && pnpm db:migrate:sh"),
    "shell-tests":        ("L1", "bash scripts/test/run-shell-tests.sh"),
    "handoff-lint":       ("L1", "python docs/kb/tools/handoff_lint.py"),
    # #217/S1071 — l'INTEGRITA' dei piani, non solo la loro esistenza. `handoff_lint` T2
    # verifica che ogni voce ACTIVE ABBIA un file in `.programmi/`; nessuno verificava che
    # quei file fossero validi. Costo misurato: il piano di `#217` e' entrato in main con
    # stato fuori vocabolario e due spunte senza evidenza, e TUTTI i cancelli erano verdi.
    "programmi":          ("L1", "python docs/kb/tools/programmi.py --verifica"),
    # L2: monta una suite vera con i globalSetup reali e un test che lascia una riga,
    # esattamente come `inbox-stream.integration.test.ts:113`. Pretende il database.
    "drift-lock":         ("L2", "bash scripts/test/drift-check-rilascia-il-lucchetto.sh"),
    # Cruscotto DBMS e guardia anti-contaminazione: instradati su db/** dal
    # momento in cui il loro esito e' verde (2026-08-03, chiusura #89/#91).
    # Un gate che nasce rosso insegna soltanto ad aggirarlo.
    "db-health":          ("L2", "python docs/kb/tools/db_health.py"),
    "no-contamination":   ("L2", "python docs/kb/tools/check_tenant_contamination.py"),
}

# L3 (Playwright) NON e' instradato automaticamente: costa minuti e va
# chiesto esplicitamente con `run --with-e2e`. Vedi Definition of Done —
# la prova live resta obbligatoria per chiudere un work-item, ma non e'
# il cancello di fine turno.
E2E = ("L3", "cd apps/web && pnpm test:e2e:prod:node22")


def git(*args: str) -> str:
    """Output di un comando git, sempre come stringa.

    `encoding`/`errors` espliciti: senza, su Windows `text=True` decodifica con
    il codec di sistema (cp1252) e un solo byte fuori tabella nel diff fa
    esplodere il thread lettore di subprocess. L'effetto non e' un errore
    parlante ma una PERDITA: `stdout` resta None e chi lo usa muore con un
    oscuro «NoneType has no attribute encode».

    Misurato in S1045: `run` ha eseguito e superato tutte e quattro le suite
    instradate, poi e' morto proprio mentre scriveva il verdetto — 6 minuti di
    verifiche vere buttati sull'ultima riga. La stessa lezione era gia' scritta
    dieci righe piu' sotto per l'esecuzione delle suite, ma questa funzione era
    rimasta indietro: una correzione applicata a una sola delle due strade.

    `or ""` chiude anche il caso residuo (processo ucciso, pipe chiusa): un
    output mancante deve dare stringa vuota, non None.
    """
    return subprocess.run(
        ["git", "-C", str(REPO), *args],
        capture_output=True, text=True, check=False,
        encoding="utf-8", errors="replace",
    ).stdout or ""


def changed_files() -> list[str]:
    """File toccati rispetto a HEAD, tracciati e non."""
    out: set[str] = set()
    for line in git("status", "--porcelain").splitlines():
        p = line[3:].strip().strip('"')
        if p:
            out.add(p.split(" -> ")[-1])
    for p in git("diff", "HEAD", "--name-only").splitlines():
        if p.strip():
            out.add(p.strip())
    return sorted(out)


def input_hash() -> str:
    h = hashlib.sha256()
    h.update(git("rev-parse", "HEAD").encode())
    h.update(git("status", "--porcelain").encode())
    h.update(git("diff", "HEAD").encode())
    return h.hexdigest()


# --- Freschezza PER SUITE (S1045) ---------------------------------------
# Prima la freschezza era UN hash solo: HEAD + status + diff dell'intero albero.
# Conseguenza misurata in S1045: corretta una pagina di `apps/web`, scadevano
# anche i 37 minuti di `test-api` che quella pagina non tocca — e persino
# modificare QUESTO file, che non instrada alcuna suite, azzerava tutto. Con una
# suite cosi' lunga il ciclo «correggi -> verifica» non converge: ogni correzione
# nata dal verdetto invalida il verdetto stesso, e l'hook Stop rimanda all'inizio.
#
# Ora ogni suite porta l'impronta dei SOLI file che la instradano, presa sul
# CONTENUTO. Due conseguenze volute:
#   * toccare `apps/web` scade `typecheck`/`lint`, non `test-api`;
#   * `git commit` non scade niente — il contenuto verificato e' lo stesso, e
#     cambia solo dove e' scritto (prima HEAD entrava nell'hash: committare i
#     file appena verificati li rendeva da riverificare).
# Cio' che NON cambia: una suite si considera passata solo se e' stata eseguita
# davvero su quel contenuto. Nessuna scorciatoia, granularita' diversa.

def files_for_suite(suite: str, files: list[str]) -> list[str]:
    """I file modificati che instradano QUESTA suite (primo prefisso che vince)."""
    out: list[str] = []
    for f in files:
        norm = f.replace("\\", "/")
        for prefix, names in ROUTES:
            if norm.startswith(prefix):
                if suite in names:
                    out.append(f)
                break
    return sorted(out)


def content_hash(paths: list[str]) -> str:
    """Impronta del CONTENUTO dei file indicati (non del loro stato git)."""
    h = hashlib.sha256()
    for p in paths:
        h.update(p.encode())
        fp = REPO / p
        try:
            if fp.is_dir():
                # `git status --porcelain` collassa una directory non tracciata in
                # una voce sola (es. `?? .zp/`): non c'e' un contenuto da leggere,
                # e il nome basta perche' nessuna directory simile instrada suite.
                h.update(b"<dir>")
            elif fp.exists():
                h.update(hashlib.sha256(fp.read_bytes()).hexdigest().encode())
            else:
                h.update(b"<deleted>")
        except OSError as exc:
            # Illeggibile != invariato: si marca in modo che l'impronta cambi.
            h.update(f"<unreadable:{exc}>".encode())
    return h.hexdigest()


def route(files: list[str]) -> list[str]:
    suites: list[str] = []
    for f in files:
        norm = f.replace("\\", "/")
        for prefix, names in ROUTES:
            if norm.startswith(prefix):
                for n in names:
                    if n not in suites:
                        suites.append(n)
                break
    return suites


# --- Layer 2: il collector ----------------------------------------------

LOGS = REPO / ".zp" / "verify-logs"

# Le sequenze di colore vanno tolte PRIMA di cercare i fallimenti: `tsc` colora
# anche il riepilogo, e un pattern che non ne tiene conto non aggancia niente
# proprio sulla suite che e' fallita.
ANSI = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")

# Le righe con cui le suite di questo repo dichiarano CHE COSA e' caduto.
FALLIMENTI = (
    re.compile(r"^\s*FAIL\s+(\S+)", re.M),                     # vitest
    re.compile(r"Found \d+ errors? in (\S+)", re.M),           # tsc, riepilogo
    re.compile(r"^(\S+\.tsx?)\(\d+,\d+\): error TS", re.M),    # tsc, forma per-file
)


TETTO_FALLITI = 50


def estrai_falliti(uscita: str) -> tuple[list[str], int]:
    """(i primi TETTO_FALLITI nomi di cio' che e' caduto, quanti erano in tutto).

    E' questo che evita la rilettura del log — e soprattutto la RIESECUZIONE della
    suite — a chi deve solo sapere dove guardare. Costo misurato del non averlo
    (2026-08-05): gate rosso alle 03:03, e per riavere i nomi di 4 file falliti la
    suite intera e' ripartita per altri 36 minuti, con quei nomi che il processo
    aveva avuto in memoria e buttato.

    Il TOTALE viaggia accanto alla lista perche' il taglio non sia muto (S1054).
    Il verdetto del 2026-08-10 elencava esattamente 50 nomi — cioe' il tetto — e da
    quel file non e' piu' ricostruibile quanti fossero davvero: chi lo leggeva non
    aveva modo di sapere che stava guardando una lista tagliata. Uno strumento il
    cui mestiere e' dare un verdetto non puo' tacere quanto non ha detto.
    """
    pulito = ANSI.sub("", uscita)
    fuori: list[str] = []
    for rx in FALLIMENTI:
        for grezzo in rx.findall(pulito):
            v = grezzo.strip()
            if v and v not in fuori:
                fuori.append(v)
    return fuori[:TETTO_FALLITI], len(fuori)


def scrivi_log(nome: str, uscita: str) -> str:
    """L'output intero su file. Ritorna il path relativo, o la ragione per cui non
    e' stato scritto: un log mancante va dichiarato, non taciuto.

    `.zp/*` e' gitignorato, quindi i log non compaiono in `git status`, non entrano
    nei commit e non passano ai cloni.
    """
    try:
        LOGS.mkdir(parents=True, exist_ok=True)
        p = LOGS / f"{nome}.log"
        p.write_text(uscita, encoding="utf-8", errors="replace", newline="\n")
        return str(p.relative_to(REPO)).replace("\\", "/")
    except OSError as exc:
        return f"(non scritto: {exc})"


SUITE_LOCK = REPO / ".zp" / "suite.lock"


def chi_occupa_il_db() -> str | None:
    """Descrizione di chi sta gia' eseguendo la suite, o None se il campo e' libero.

    Il cancello CONTROLLA il lucchetto ma non lo PRENDE: a prenderlo e' la suite
    stessa (`apps/api/test/helpers/suite-lock.ts`). Se lo prendesse anche qui, il
    cancello si bloccherebbe da solo lanciando vitest.

    Serve a fallire in un secondo invece che dopo ~40 minuti di rossi che non sono
    difetti: due suite sullo stesso PostgreSQL si contendono lock e connessioni
    (misurato 2026-08-05 — 14 file falliti in concorrenza contro 4 su DB libero,
    con ZERO test falliti in entrambi i casi).
    """
    try:
        d = json.loads(SUITE_LOCK.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    pid = d.get("pid")
    if not isinstance(pid, int):
        return None
    # Lock stantio (processo morto) = campo libero: altrimenti un Ctrl-C lascerebbe
    # un blocco permanente.
    try:
        out = subprocess.run(["tasklist", "/FI", f"PID eq {pid}"] if sys.platform == "win32"
                             else ["ps", "-p", str(pid)],
                             capture_output=True, text=True, check=False,
                             encoding="utf-8", errors="replace").stdout or ""
    except OSError:
        return None
    if str(pid) not in out:
        return None
    return f"PID {pid}, avviata {d.get('avviato', '?')} — {d.get('comando', '?')}"


def run_suites(names: list[str], with_e2e: bool, files: list[str],
               keep: list[dict] | None = None) -> dict:
    # Le suite che toccano il database non partono se un'altra e' gia' in corso.
    if any(n in ("test-api", "migrate-idempotent") for n in names):
        occupante = chi_occupa_il_db()
        if occupante:
            print(f"  [BLOCCO] la suite e' gia' in esecuzione: {occupante}")
            print("           due run sullo stesso database producono rossi che non sono difetti.")
            print("           Aspetta che finisca, oppure SUITE_LOCK=0 se sai quello che fai.")
            raise SystemExit(2)

    results = list(keep or [])
    plan = [(n, *SUITES[n]) for n in names]
    if with_e2e:
        plan.append(("e2e", *E2E))
    for name, level, cmd in plan:
        t0 = time.time()
        # encoding esplicito: senza, su Windows `text=True` usa il codec di sistema
        # (cp1252) e su un output UTF-8 solleva UnicodeDecodeError. L'effetto non era
        # un errore visibile ma una PERDITA: stdout e stderr restavano None e il
        # cancello riportava «nessun output catturato» proprio quando l'output
        # serviva — cioe' quando una suite falliva. Misurato in S1043 su test-api.
        proc = subprocess.run(cmd, shell=True, cwd=REPO,
                              capture_output=True, text=True,
                              encoding="utf-8", errors="replace")
        # `capture_output` puo' restituire None se il processo muore in modo anomalo
        # (ucciso dall'esterno, pipe chiusa): sommare due None faceva esplodere il
        # cancello con un TypeError invece di riportare la suite come fallita.
        # Un cancello che CRASHA non dice «rosso», non dice niente — ed e' il modo
        # peggiore di fallire per uno strumento il cui mestiere e' dare un verdetto.
        uscita = (proc.stdout or "") + (proc.stderr or "")
        tail = uscita.strip().splitlines()[-15:]
        if not tail and proc.returncode != 0:
            tail = [f"(nessun output catturato; il processo e' uscito con {proc.returncode})"]
        # L'output INTERO su file, e i nomi dei falliti DENTRO il verdetto: 15 righe
        # di coda bastano a dire «rosso», non a dire «dove».
        log_rel = scrivi_log(name, uscita)
        falliti, falliti_totale = (estrai_falliti(uscita) if proc.returncode != 0
                                   else ([], 0))
        results.append({
            "suite": name,
            "level": level,
            "cmd": cmd,
            "exit": proc.returncode,
            "duration_s": round(time.time() - t0, 1),
            "log": log_rel,
            "righe": len(uscita.splitlines()),
            "falliti": falliti,
            # Quanti erano DAVVERO: `falliti` si ferma a TETTO_FALLITI, e un elenco
            # tagliato in silenzio si legge come un elenco completo.
            "falliti_totale": falliti_totale,
            # L'impronta dei file che instradano questa suite, presa DOPO l'esecuzione:
            # se qualcuno modifica quei file mentre la suite gira, l'impronta registrata
            # e' quella finale e al giro dopo risultera' scaduta. Sbagliare per eccesso
            # di prudenza e' l'unico verso accettabile per un cancello.
            "scope": content_hash(files_for_suite(name, files)),
            "tail": tail,
        })
        taglio = ""
        if falliti_totale > len(falliti):
            taglio = f" · falliti {len(falliti)} di {falliti_totale} elencati"
        elif falliti_totale:
            taglio = f" · {falliti_totale} falliti"
        print(f"  [{level}] {name:<20} exit={proc.returncode} "
              f"({results[-1]['duration_s']}s){taglio}")
    return {
        "input_hash": input_hash(),
        "head": git("rev-parse", "HEAD").strip(),
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "routed": names + (["e2e"] if with_e2e else []),
        "results": results,
        "verdict": "green" if all(r["exit"] == 0 for r in results) else "red",
    }


# --- Layer 3: il gate ----------------------------------------------------

def load_verdict() -> dict:
    if not VERDICT.exists():
        return {}
    try:
        return json.loads(VERDICT.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def triage(files: list[str], needed: list[str]) -> tuple[list[str], list[str], list[str]]:
    """(fresche_verdi, scadute, rosse) fra le suite richieste dal diff corrente."""
    prev = {r["suite"]: r for r in load_verdict().get("results", [])}
    fresh, stale, red = [], [], []
    for s in needed:
        r = prev.get(s)
        # Un verdetto scritto prima di S1045 non ha "scope": si tratta come scaduto,
        # cioe' si riverifica. Un formato vecchio non deve poter passare per fresco.
        if not r or r.get("scope") != content_hash(files_for_suite(s, files)):
            stale.append(s)
        elif r["exit"] != 0:
            red.append(s)
        else:
            fresh.append(s)
    return fresh, stale, red


def check() -> tuple[bool, str]:
    """(ok, motivo). ok=True significa: si puo' chiudere il turno."""
    if BRAKE.exists():
        return True, "freno tirato (.zp/verify-off)"

    files = changed_files()
    needed = route(files)
    if not needed:
        return True, "nessuna modifica che richieda verifica"

    fresh, stale, red = triage(files, needed)

    if red:
        # Quante cose sono cadute, non solo su quale suite: «ROSSA su test-api» e
        # «ROSSA su test-api (63 falliti)» chiedono due reazioni diverse. I verdetti
        # scritti prima di S1054 non portano il totale e degradano al nome nudo.
        prec = {r["suite"]: r for r in load_verdict().get("results", [])}
        etichette = []
        for s in red:
            n = (prec.get(s) or {}).get("falliti_totale") or 0
            etichette.append(f"{s} ({n} falliti)" if n else s)
        return False, (
            f"l'ultima verifica e' ROSSA su: {', '.join(etichette)}. "
            f"Correggi e riesegui: python docs/kb/tools/verify_gate.py run "
            f"(rieseguira' SOLO le suite da rifare). "
            f"Dettaglio in {VERDICT.relative_to(REPO)}"
        )

    if stale:
        verificate = f" · gia' verdi e ancora valide: {', '.join(fresh)}" if fresh else ""
        return False, (
            f"da verificare: {', '.join(stale)} — i file che instradano queste suite "
            f"sono cambiati dopo l'ultima esecuzione{verificate}. "
            f"Esegui: python docs/kb/tools/verify_gate.py run "
            f"(rieseguira' SOLO {', '.join(stale)})"
        )

    return True, f"verdetto verde e fresco su {', '.join(fresh)}"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["route", "run", "check"])
    ap.add_argument("--hook", action="store_true",
                    help="check: emetti il JSON per l'hook Stop")
    ap.add_argument("--with-e2e", action="store_true",
                    help="run: aggiungi la suite Playwright (L3, minuti)")
    ap.add_argument("--all", action="store_true",
                    help="run: riesegui tutte le suite instradate, anche quelle "
                         "gia' verdi sullo stesso contenuto")
    ap.add_argument("--suite", action="append", metavar="NOME",
                    help="run: esegui questa suite anche se il diff non la "
                         "instrada, e sempre (ripetibile). Nomi: "
                         + ", ".join(sorted(SUITES)))
    args = ap.parse_args()

    if args.cmd == "route":
        files = changed_files()
        needed = route(files)
        print(f"{len(files)} file modificati")
        for f in files[:30]:
            print(f"  · {f}")
        if len(files) > 30:
            print(f"  … e altri {len(files) - 30}")
        print(f"\nsuite instradate: {', '.join(needed) if needed else '(nessuna)'}")
        for n in needed:
            lvl, cmd = SUITES[n]
            print(f"  [{lvl}] {n:<20} {cmd}")
        return 0

    if args.cmd == "run":
        files = changed_files()
        needed = route(files)
        # Suite chieste per nome: si eseguono ANCHE se il diff non le instrada.
        # Un nome sbagliato si ferma qui, con l'elenco: una suite scritta male
        # non deve poter passare per «eseguita e verde».
        extra: list[str] = []
        for s in (args.suite or []):
            if s not in SUITES:
                print(f"suite sconosciuta: {s} — disponibili: "
                      f"{', '.join(sorted(SUITES))}")
                return 2
            if s not in extra:
                extra.append(s)
        needed = needed + [s for s in extra if s not in needed]
        if not needed and not args.with_e2e:
            print("nessuna modifica che richieda verifica — niente da eseguire")
            print("  (per misurare comunque una suite: --suite <nome>)")
            VERDICT.parent.mkdir(parents=True, exist_ok=True)
            # `not-measured`, MAI `green`: qui non e' stato eseguito niente, e un
            # file che dicesse verde cancellerebbe un rosso precedente senza aver
            # misurato nulla.
            VERDICT.write_text(json.dumps({
                "input_hash": input_hash(),
                "head": git("rev-parse", "HEAD").strip(),
                "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                "routed": [], "results": [], "verdict": "not-measured",
            }, indent=2, ensure_ascii=False), encoding="utf-8")
            return 0
        # Si rieseguono SOLO le suite scadute o rosse; quelle gia' verdi sullo stesso
        # contenuto si portano avanti. E' il pezzo che fa convergere il ciclo
        # «correggi -> verifica»: correggere una pagina web non ricompra 37 minuti
        # di test API. `--all` forza la riesecuzione integrale.
        fresh, stale, red = triage(files, needed)
        prev = {r["suite"]: r for r in load_verdict().get("results", [])}
        if args.all:
            to_run, keep = needed, []
        else:
            # `extra` entra sempre in to_run ed esce da keep: chi chiede una suite
            # per nome vuole la misura, non il ricordo di una misura.
            to_run = [s for s in needed if s in stale or s in red or s in extra]
            keep = [prev[s] for s in fresh if s not in extra]
        print(f"{len(files)} file modificati → suite: {', '.join(needed)}")
        if extra:
            print(f"  chieste a mano (eseguite comunque): {', '.join(extra)}")
        riusate = [s for s in fresh if s not in extra]
        if riusate:
            print(f"  riuso (verdi, contenuto invariato): {', '.join(riusate)}")
        if not to_run and not args.with_e2e:
            print("  niente da rieseguire")
        verdict = run_suites(to_run, args.with_e2e, files, keep)
        VERDICT.parent.mkdir(parents=True, exist_ok=True)
        VERDICT.write_text(json.dumps(verdict, indent=2, ensure_ascii=False),
                           encoding="utf-8")
        print(f"\nverdetto: {verdict['verdict'].upper()} → "
              f"{VERDICT.relative_to(REPO)}")
        return 0 if verdict["verdict"] == "green" else 1

    ok, reason = check()
    if args.hook:
        if not ok:
            print(json.dumps({"decision": "block", "reason": reason},
                             ensure_ascii=False))
        return 0          # l'hook non usa exit 2: il blocco viaggia nel JSON
    print(("VERDE  — " if ok else "BLOCCO — ") + reason)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
