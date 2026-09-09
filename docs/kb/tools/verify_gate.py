#!/usr/bin/env python3
"""
verify_gate.py — cancello di verifica per heuresys-advanced.

Principio: il verdetto e' funzione dello STATO OSSERVABILE, mai della
conversazione. Non chiede "hai verificato?", legge il working tree e gli
exit code. Se lo stato cambia, il verdetto scade da solo.

Freschezza PER SUITE (S1045)
----------------------------
Ogni suite porta l'impronta del CONTENUTO CHE COPRE, non del suo stato git:

    scope(suite) = sha256( sha-git di ogni file sotto le rotte della suite )

Prima l'impronta era una sola per tutto (HEAD + status + diff): correggere una
pagina di `apps/web` scadeva anche i 37 minuti di `test-api`, e modificare
questo stesso file — che allora non instradava alcuna suite — azzerava il verdetto.
(Dal 2026-09-08 ne instrada una, `router-selftest`: vedi ROUTES.) Con
una suite cosi' lunga il ciclo «correggi -> verifica» non converge: ogni
correzione suggerita dal verdetto invalida il verdetto, e l'hook Stop rimanda
all'inizio. Da qui la granularita' per suite, e `run` che riesegue solo cio'
che serve.

`git commit` non scade niente, ed e' voluto: il contenuto verificato e' lo
stesso, cambia solo dove e' scritto.

⚠ Ma fino al 2026-09-09 questa frase copriva un difetto, non una proprieta'
(D-88 ①). L'impronta si prendeva sui soli file NON COMMITTATI che instradavano
la suite: dopo un commit quell'insieme e' vuoto, e l'impronta del vuoto vale
`e3b0c442...` — sempre uguale a se stessa, quindi sempre «fresca». Committare
non lasciava il contenuto verificato: lo faceva SPARIRE dal campo visivo,
insieme all'obbligo di verificarlo. Misurato due volte in un giorno, una su
migrazioni gia' applicate alla produzione. Ora l'impronta copre TUTTI i file
sotto le rotte della suite, committati o meno, e l'invarianza al commit e' una
conseguenza dell'algoritmo (`git hash-object`, gli stessi hash e gli stessi
filtri dell'indice) invece di un effetto collaterale del non guardare.
Il selftest la prova a esiti opposti su un repo usa-e-getta: vedi
`selftest_impronta()`.

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

# Su Windows lo stdout di Python eredita la codepage della console (cp1252), e una
# singola freccia in un messaggio di stato fa morire il cancello con
# `UnicodeEncodeError` PRIMA che abbia eseguito una sola suite. Misurato il 2026-09-06
# (S1088): `verify_gate.py run` in traceback su `'charmap' codec can't encode '→'`,
# con l'hook Stop che rimandava all'inizio a ogni tentativo.
#
# ⚠ E il modo in cui fallisce e' peggio del fallimento: un cancello che va in traceback
# non dice «rosso», dice **niente** — e chi lo lancia da uno script vede solo un exit
# code diverso da zero, indistinguibile da una suite fallita davvero.
#
# `errors="replace"` invece di `strict`: un carattere che la console non sa disegnare
# deve degradare in un punto interrogativo, mai fermare una verifica.
for _flusso in (sys.stdout, sys.stderr):
    try:
        _flusso.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
    except (AttributeError, ValueError):
        pass  # flusso rediretto o gia' configurato: non e' un errore

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
    # ⭐ S1093 — `migrate-idempotent` STA ANCHE QUI, e la sua assenza era un buco misurato.
    #
    # Il router usa il PRIMO PREFISSO CHE VINCE: `db/migrations/` copre le migrazioni, e tutto
    # il resto di `db/` — `db/scripts/`, `db/seeds/` — cadeva su questa riga, che la prova
    # generale non la chiedeva. Cosi' un seed poteva entrare in main senza che nessuno lo
    # provasse su una copia.
    #
    # ⚠ E `db-health`, che c'era gia', NON copre lo stesso caso: interroga la PRODUZIONE via
    # tunnel, mentre `migrate-idempotent` (→ `prova-idempotenza.sh` → `ci-rehearsal.sh` sul
    # gemello) lavora su una COPIA usa-e-getta di `heuresys_ci`. Due controlli che sembrano
    # guardare la stessa cosa e guardano due database diversi: uno vede cio' che e' in
    # produzione, l'altro cio' che il tuo codice PRODUCE. Un seed sbagliato non tocca la
    # produzione, quindi il primo e' cieco su di lui per costruzione.
    #
    # 🔬 Il costo misurato, 2026-09-08: la prova generale ha trovato un difetto introdotto
    # un'ora prima — `seed-test-admin.ts` scriveva i segreti TOTP in chiaro e accendeva la
    # sentinella `v_mfa_secrets_in_cleartext` — ma l'ha trovato solo perche' nella stessa
    # sessione era stata toccata ANCHE una migrazione. Toccando il solo seed, il cancello
    # sarebbe stato verde e il rosso sarebbe comparso in CI, a push fatto.
    #
    # Il `CLAUDE.md` dichiarava gia' «ogni tocco a `db/**` passa da `ci-rehearsal.sh`»: la
    # regola c'era, l'instradamento no, e una regola che si applica a memoria e' un proposito.
    # Costo: 14-18 s sul gemello (misurato, due corse). Se il gemello non risponde la suite
    # esce ROSSA e non ripiega in locale — di proposito.
    ("db/",              ["typecheck", "db-health", "no-contamination", "migrate-idempotent"]),
    ("scripts/",         ["shell-tests"]),
    # solo i file di stato governati dall'handoff, non i tool sotto docs/kb/tools/
    # `programmi` sta su SOT_BACKLOG per #249 F3 (S1091): la deriva della contabilita'
    # dei piani NON nasce toccando `.programmi/` — nasce QUI, quando una voce passa a
    # DONE nel register e il file-piano resta indietro. Instradata sui soli `.programmi/`
    # la suite scattava per caso, quando capitava che si toccasse anche un piano: e'
    # esattamente cio' che e' successo in S1090, dove ha fermato la chiusura per
    # coincidenza. Legarla al register la lega al momento in cui il difetto si crea.
    ("docs/kb/SOT_BACKLOG.md", ["handoff-lint", "programmi"]),
    ("docs/kb/SOT_",     ["handoff-lint"]),
    ("docs/kb/DEBT_",    ["handoff-lint"]),
    ("docs/kb/tools/handoff_lint.py", ["handoff-lint"]),
    # Il router che instrada se stesso: senza questa riga, modificare la tabella delle
    # rotte non instradava NIENTE (il docstring lo diceva come un vanto — «questo file
    # non instrada alcuna suite» — ed era invece il punto cieco).
    ("docs/kb/tools/verify_gate.py", ["router-selftest"]),
    ("docs/kb/tools/chi_sorveglia.py", ["chi-sorveglia"]),
    # ⭐ S1093 — `agent-perimetri.json` E' UNA SoT, e un test la sorveglia.
    # `apps/agent-gateway/test/atlas-resolver.test.ts` confronta i perimetri DECISI in questo
    # file con quelli presenti nella MAPPA generata (`docs/kb/atlas/agent-operations.json`):
    # aprire un perimetro senza rigenerare la mappa fa cadere quel test.
    # 🔬 E' successo davvero, due volte nello stesso giorno e per la stessa ragione: la PR
    # Dependabot #86 era rossa con `expected ['content', ...(8)] to deeply equal
    # ['blueprint-variants', ...(9)]` — e ho poi scoperto di aver appena introdotto la stessa
    # discordanza io, aprendo `blueprint-families` senza rigenerare (11 decisi contro 10 nella
    # mappa). Il cancello locale non l'ha vista perche' questo file non instradava nulla.
    # `atlas-freshness` non basta: guarda se l'atlante e' vecchio, non se i due elenchi
    # combaciano — sono due domande diverse.
    ("docs/kb/agent-perimetri.json", ["agent-gateway-test"]),
    ("docs/kb/atlas/agent-operations.json", ["agent-gateway-test"]),
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
    # ⭐ 2026-09-09 (Enzo, S1094) — SPOSTATA SUL GEMELLO, e la condizione che la
    # tratteneva qui non e' stata aggirata: e' stata costruita.
    #
    # Il commento precedente diceva, giustamente, che spostare l'host non bastava:
    #   «il gemello sta al commit che gli e' stato propagato l'ultima volta [...]
    #    quindi li' la suite proverebbe il codice di ieri. Un verde su codice
    #    vecchio e' peggio di un'attesa. Se un giorno si vorra' spostarla: prima
    #    serve la propagazione del codice dentro la suite stessa, e una guardia
    #    sull'sha — non basta cambiare l'host.»
    # `prova-api-sul-gemello.sh` e' quelle due cose. La guardia e' piu' forte di
    # quella chiesta: confronta l'**impronta del contenuto** (sha256 per file,
    # lista ordinata, sha256 della lista) invece dello sha del commit — perche' lo
    # sha di un commit non vede le modifiche non committate, e sono proprio quelle
    # che una suite di verifica deve provare. Se le impronte non combaciano la
    # suite NON PARTE: rosso dichiarato, mai un verde su codice che non e' il mio.
    #
    # MISURA, stessa suite e stesso commit (2026-09-09):
    #   da Windows, via tunnel : 2054 s (34 min) — 4 file rossi
    #   sul gemello            : 1002 s (17 min) — 1 file rosso
    # Il fattore e' ~2x, non i ~140x delle migrazioni: qui il costo non e' il
    # tunnel ma l'import dei moduli (537 s dei 1002). Tre dei quattro rossi erano
    # falsi, prodotti dalla latenza del tunnel; l'unico vero e' `me-surveys`, ed e'
    # un buco di DATI nel clone. Su un file solo il divario e' quello che conta:
    # 83 s da qui contro 14 s la' (misurato 2026-08-27).
    #
    # ⚠ Se una rotta nuova instrada `test-api`, va aggiunta anche a `PERCORSI`
    # dentro lo script: altrimenti la suite girerebbe su contenuto non propagato,
    # cioe' il difetto che lo script esiste per chiudere.
    "test-api":           ("L2", "bash db/scripts/prova-api-sul-gemello.sh"),
    # ⭐ 2026-08-27 (Enzo) — LA PROVA GIRA SU UNA COPIA, E DOVE IL DATABASE VIVE.
    # Era `pnpm db:migrate:sh && pnpm db:migrate:sh`, e quel comando aveva due
    # difetti che si sommavano:
    #   ① applicava la catena ALLA PRODUZIONE, due volte, per provare che fosse
    #     idempotente — un cancello di verifica che scrive sull'ambiente vero. E'
    #     il difetto che in S1065 ha portato in produzione una migrazione
    #     committata e non deployata, lasciando 117 utenti senza organigramma.
    #   ② lo faceva da questa macchina, dove il database NON C'E': le ~60.000
    #     righe della catena attraversavano il tunnel SSH una per una. Misurato,
    #     stesso script e stesso esito: ~80 minuti da Windows contro 17 secondi
    #     dove il database e' locale. Due volte. Un cancello che costa ore e' un
    #     cancello che si finisce per aggirare.
    # Ora: `ci-rehearsal.sh` sul linux-pc — copia usa-e-getta `heuresys_ci`, due
    # passate, piu' le sentinelle di db_health che la versione locale non
    # interrogava. Piu' severa e incomparabilmente piu' rapida (12-26 s).
    # Se il gemello non risponde lo script esce ROSSO e NON ripiega in locale:
    # ripiegare vorrebbe dire tornare al difetto ①.
    "migrate-idempotent": ("L2", "bash db/scripts/prova-idempotenza.sh"),
    "shell-tests":        ("L1", "bash scripts/test/run-shell-tests.sh"),
    "handoff-lint":       ("L1", "python docs/kb/tools/handoff_lint.py"),
    # #217/S1071 — l'INTEGRITA' dei piani, non solo la loro esistenza. `handoff_lint` T2
    # verifica che ogni voce ACTIVE ABBIA un file in `.programmi/`; nessuno verificava che
    # quei file fossero validi. Costo misurato: il piano di `#217` e' entrato in main con
    # stato fuori vocabolario e due spunte senza evidenza, e TUTTI i cancelli erano verdi.
    "programmi":          ("L1", "python docs/kb/tools/programmi.py --verifica"),
    # ⭐ S1093 — chi modifica il ROUTER deve provare il router. La riga che instradava
    # la prova generale solo su `db/migrations/` e' stata corretta a mano: una riga
    # corretta a mano si ri-rompe a mano, e senza questa suite nessuno se ne accorgerebbe
    # finche' il difetto non torna. Costa millisecondi ed e' L0: nessuna scusa per saltarla.
    "router-selftest":    ("L0", "python docs/kb/tools/verify_gate.py selftest"),
    # C1 della regola «la catena, non il pezzo»: lo strumento che censisce i sorveglianti
    # deve a sua volta essere provato. Se si rompe in silenzio, la regola resta scritta e
    # smette di essere applicabile — che e' il modo in cui una regola muore senza che
    # nessuno la abroghi.
    "chi-sorveglia":      ("L0", "python docs/kb/tools/chi_sorveglia.py --selftest"),
    # I test del gateway, che sono anche i guardiani della coerenza fra i perimetri decisi e
    # la mappa generata. L0 nel costo, L1 nella sostanza: girano senza database.
    "agent-gateway-test": ("L1", "pnpm --filter @heuresys/agent-gateway test"),
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

# --- D-88 ①: l'impronta del CONTENUTO COPERTO, invariante al commit ---------
#
# IL DIFETTO CHE CHIUDE, misurato due volte il 2026-09-09 nella stessa sessione.
# `changed_files()` guarda `git status --porcelain` e `git diff HEAD`: entrambe
# vedono solo cio' che NON e' committato. Quindi, dopo un `git commit`:
#
#   files   = []                      -> niente da instradare
#   needed  = route([]) = []          -> «nessuna modifica che richieda verifica»
#   scope   = content_hash([])        -> sha256 della stringa VUOTA, e3b0c442...
#
# Committare faceva svanire l'obbligo di verifica, e il verdetto restava
# ancorato al nulla: `e3b0c442...` e' esattamente lo scope trovato nel verdetto
# lasciato dalla sessione precedente, dove `test-api` non era mai girata. Il
# commento qui sopra lo dichiarava voluto — «git commit non scade niente: il
# contenuto verificato e' lo stesso» — e la frase e' vera SOLO SE quel contenuto
# era stato verificato prima del commit. Quando la verifica era stata uccisa
# dalla saturazione di memoria, il commit la faceva sparire dal campo visivo
# insieme all'obbligo di rifarla.
#
# IL RIMEDIO, che e' quello che D-88 chiede: la freschezza non si misura piu'
# su «cosa e' cambiato rispetto a HEAD» ma su «il contenuto che questa suite
# copre e' ancora quello che ho verificato?». Il commit diventa irrilevante per
# COSTRUZIONE, non per promessa.
#
# COSTO, misurato prima di scegliere il disegno (2026-09-09, 3323 file tracciati):
#   leggendo il contenuto di ogni file  : 13,59 s   <- inaccettabile a ogni Stop
#   dagli hash che git ha gia' in indice:  0,19 s   <- ~68x piu' rapido
# `git ls-files -s` restituisce il sha1 del CONTENUTO di ogni file tracciato,
# gia' calcolato. Committare non lo cambia (il contenuto e' lo stesso), che e'
# precisamente la proprieta' che serve. Per i pochi file sporchi — modificati,
# non tracciati o cancellati — si legge il contenuto reale, perche' li' l'indice
# e il disco possono divergere.

def _sha_indice() -> dict[str, str]:
    """path -> sha1 del contenuto, come git lo tiene in indice. Costo ~0,08s."""
    fuori: dict[str, str] = {}
    for line in git("ls-files", "-s").splitlines():
        if "\t" not in line:
            continue
        meta, path = line.split("\t", 1)
        parti = meta.split()
        if len(parti) >= 2:
            fuori[path.strip().strip('"')] = parti[1]
    return fuori


def impronta_suite(suite: str) -> str:
    """Impronta del contenuto che QUESTA suite verifica — non del suo stato git.

    Due proprieta', ed e' per averle che questa funzione esiste:
      · invariante al commit: `git add` + `git commit` non la cambiano, perche'
        misura byte, non lo stato dell'albero di lavoro;
      · cambia appena cambia un file che la suite copre, tracciato o meno.
    """
    mappa = _sha_indice()

    # I file sporchi: il disco vince sull'indice, perche' e' il disco che i test
    # leggono. Ma l'hash DEVE essere calcolato nello stesso modo dei puliti,
    # altrimenti l'impronta cambia al commit per un motivo che col contenuto non
    # c'entra niente — ed e' proprio la proprieta' che questa funzione promette.
    #
    # ⚠ DUE TRAPPOLE, tutte e due colte dal selftest invece che in produzione:
    #   ① `git ls-files -s` da' un SHA-1 in formato git (`blob <len>\0` + dati),
    #      non uno sha256 del contenuto: confrontare i due e' confrontare due
    #      algoritmi diversi, e il commit spostava l'impronta ogni volta;
    #   ② con `core.autocrlf=input` — che e' la configurazione di questo repo —
    #      l'indice contiene il contenuto NORMALIZZATO a LF mentre il disco ha
    #      CRLF. Un hash calcolato sui byte del disco non combacerebbe con quello
    #      dell'indice nemmeno usando l'algoritmo giusto.
    # `git hash-object` risolve entrambe: e' lo stesso codice che git usa per
    # riempire l'indice, filtri compresi. Un solo processo per tutti i file.
    sporchi = changed_files()
    da_hashare = [f for f in sporchi if (REPO / f).is_file()]
    if da_hashare:
        uscita = git("hash-object", "--", *da_hashare).splitlines()
        for f, sha in zip(da_hashare, uscita):
            mappa[f] = sha.strip()

    for f in sporchi:
        fp = REPO / f
        if fp.is_dir():
            mappa[f] = "<dir>"
        elif not fp.exists():
            # cancellato dal disco ma ancora in indice: e' un cambiamento, e va
            # visto — altrimenti togliere un file di test non scadrebbe la suite
            mappa[f] = "<assente>"

    h = hashlib.sha256()
    for p in sorted(mappa):
        if suite in route_file(p):
            h.update(p.encode())
            h.update(mappa[p].encode())
    return h.hexdigest()


def route_file(path: str) -> list[str]:
    """Le suite che UN file instrada (prima rotta che combacia, come route())."""
    norm = path.replace("\\", "/")
    for prefix, names in ROUTES:
        if norm.startswith(prefix):
            return names
    return []


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
    # ⭐ 2026-08-27: `migrate-idempotent` NON e' piu' in questo elenco, e non e' una
    # dimenticanza. Da quando la sua prova gira sul gemello, su una copia usa-e-getta,
    # non tocca piu' il database di produzione — che e' cio' che questo lucchetto
    # protegge. Tenercela avrebbe bloccato una prova innocua ogni volta che la
    # produzione era occupata, cioe' proprio quando serve poterla lanciare.
    if any(n in ("test-api",) for n in names):
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
            # D-88 ①: e' l'impronta del CONTENUTO COPERTO dalla suite, la stessa
            # grandezza che `check` confronta. Prima era l'impronta dei soli file
            # non committati che la instradavano: a valle di un commit quell'insieme
            # e' vuoto, e l'impronta del vuoto e' sempre uguale a se stessa — cioe'
            # un verdetto che si dichiarava valido su qualunque contenuto.
            "scope": impronta_suite(name),
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
        # D-88 ①: il confronto e' sull'impronta del CONTENUTO COPERTO, non piu' su
        # quella dei soli file non committati — che dopo un commit era l'impronta
        # dell'insieme vuoto, uguale per tutti e sempre soddisfatta.
        if not r or r.get("scope") != impronta_suite(s):
            stale.append(s)
        elif r["exit"] != 0:
            red.append(s)
        else:
            fresh.append(s)
    return fresh, stale, red


def suite_da_verificare(files: list[str]) -> list[str]:
    """Le suite che questo stato dell'albero obbliga a verificare.

    ⚠ UNA SOLA definizione, usata da `check` E da `run`. Averne due era un difetto
    misurato il 2026-09-09: `check` chiedeva sette suite e `run` — che instradava
    sul solo `route(files)` — ne eseguiva due, poi riscriveva il verdetto GREEN.
    Il comando che il cancello suggerisce deve fare esattamente cio' che il
    cancello chiede, altrimenti il verdetto e' d'accordo con se stesso e con
    nient'altro.

    Quattro ragioni per cui una suite entra, e le ultime due sono le due meta'
    di D-88 che mancavano:
      ① un file che la instrada e' cambiato adesso (il routing di sempre);
      ② il suo ultimo esito era rosso;
      ③ l'impronta del contenuto che copre non e' quella su cui e' stata
         verificata — committare o meno non c'entra piu' niente;
      ④ NON COMPARE nel verdetto pur coprendo file che esistono. Questa era la
         piu' larga delle tre falle, e la piu' silenziosa: il 2026-09-09 il
         verdetto certificava 2 suite su 12 — `typecheck` (1418 file coperti),
         `lint` (367), `db-health` (555) e altre sette non c'erano affatto — e
         il cancello rispondeva VERDE. Una suite assente non e' una suite
         verde: e' una suite di cui non si sa niente, e un cancello che non
         distingue le due cose e' il difetto che D-88 descrive.

    Una suite che non copre NESSUN file resta fuori, e non e' un buco: e' il
    caso di una suite il cui perimetro non esiste in questo albero.
    """
    prev = {r["suite"]: r for r in load_verdict().get("results", [])}
    needed = list(route(files))

    # quante suite coprono almeno un file tracciato: una passata sola su ls-files
    copre: dict[str, int] = {}
    for f in git("ls-files").splitlines():
        for s in route_file(f):
            copre[s] = copre.get(s, 0) + 1

    for s in SUITES:
        if s in needed:
            continue
        r = prev.get(s)
        if r is None:
            if copre.get(s):
                needed.append(s)
        elif r.get("scope") != impronta_suite(s) or r.get("exit") != 0:
            needed.append(s)
    return needed


def check() -> tuple[bool, str]:
    """(ok, motivo). ok=True significa: si puo' chiudere il turno."""
    if BRAKE.exists():
        return True, "freno tirato (.zp/verify-off)"

    files = changed_files()
    needed = suite_da_verificare(files)

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


# --- Il selftest del ROUTER (S1093) -------------------------------------
#
# Nasce da un difetto misurato: `db/scripts/` non instradava la prova generale, e un seed
# poteva entrare in main senza che nessuno lo provasse su una copia. La riga e' stata
# corretta — ma una riga corretta a mano si ri-rompe a mano, e nessuno se ne accorge finche'
# il difetto non torna.
#
# ⚠ I casi NEGATIVI qui sotto non sono decorazione: senza di essi un router che instradasse
# TUTTO su TUTTO passerebbe ogni caso positivo. Una prova che non puo' fallire non e' una prova.
CASI_ROUTER: list[tuple[str, list[str], list[str]]] = [
    # (file,                              deve instradare,          NON deve instradare)
    ("db/migrations/000382_x.sql",         ["migrate-idempotent",
                                            "handoff-lint"],         []),
    # ⭐ il caso che ha fatto nascere questo selftest
    ("db/scripts/seed-test-admin.ts",      ["migrate-idempotent"],   ["handoff-lint"]),
    ("db/seeds/rtl-rebuild/x.sql",         ["migrate-idempotent"],   []),
    ("db/scripts/qualunque-cosa.sh",       ["migrate-idempotent"],   []),
    # negativi: il router deve saper dire di NO, o direbbe di si' a tutto
    ("apps/api/src/modules/auth/x.ts",     [],                       ["migrate-idempotent",
                                                                      "db-health"]),
    ("README.md",                          [],                       ["migrate-idempotent",
                                                                      "typecheck",
                                                                      "handoff-lint"]),
    ("apps/web/tests/e2e/fixtures.ts",     [],                       ["migrate-idempotent"]),
    # il router instrada se stesso, o modificarlo resta il punto cieco che era
    ("docs/kb/tools/verify_gate.py",       ["router-selftest"],      ["migrate-idempotent"]),
    ("docs/kb/tools/chi_sorveglia.py",     ["chi-sorveglia"],        ["migrate-idempotent"]),
    # aprire un perimetro deve far girare il test che confronta decisi e mappa
    ("docs/kb/agent-perimetri.json",       ["agent-gateway-test"],   ["migrate-idempotent"]),
]


def selftest() -> int:
    """Il router instrada cio' che deve, e NON instrada cio' che non deve."""
    errori: list[str] = []
    for f, attese, vietate in CASI_ROUTER:
        got = route([f])
        for s in attese:
            if s not in got:
                errori.append(f"{f}: manca '{s}' (instrada: {got or 'niente'})")
        for s in vietate:
            if s in got:
                errori.append(f"{f}: instrada '{s}' e NON dovrebbe (instrada: {got})")

    # La controprova del selftest stesso: se `route` restituisse sempre tutto, i casi
    # positivi passerebbero e i negativi no. Se restituisse sempre niente, il contrario.
    # Questo verifica che la funzione DISCRIMINI davvero, non che risponda.
    tutto = set(route(["db/migrations/x.sql"]))
    niente = set(route(["README.md"]))
    if not tutto:
        errori.append("controprova: `route` non instrada nulla nemmeno su una migrazione")
    if niente:
        errori.append(f"controprova: `route` instrada {sorted(niente)} su un README")

    errori += selftest_impronta()

    if errori:
        print("SELFTEST ROUTER — ROSSO")
        for e in errori:
            print(f"  ✗ {e}")
        return 1
    print(f"SELFTEST ROUTER — verde ({len(CASI_ROUTER)} casi, positivi e negativi, "
          f"piu' la controprova che il router discrimini, piu' 4 casi sull'impronta "
          f"invariante al commit)")
    return 0


# --- La prova di D-88 ①, su un repo USA-E-GETTA -----------------------------
#
# Perche' un repo-fixture e non il repo vero: la proprieta' da provare e' «un
# COMMIT non cambia l'impronta», e provarla qui significherebbe committare nel
# repository di lavoro a ogni selftest. E' la stessa ragione di C4 — una prova
# che scrive gira su una copia usa-e-getta — applicata a git invece che al
# database. Il fixture nasce in una directory temporanea e non tocca nulla.
#
# I quattro casi, e sono due coppie a esiti opposti perche' una prova che sa solo
# dire di si' non e' una prova:
#   ① dopo `git add` + `git commit` l'impronta e' IDENTICA   <- il difetto di D-88
#   ② modificando un file coperto l'impronta CAMBIA          <- non e' una costante
#   ③ un file NON coperto dalla suite non la influenza       <- discrimina per rotta
#   ④ cancellare un file coperto CAMBIA l'impronta           <- non solo aggiunte

def selftest_impronta() -> list[str]:
    import tempfile
    errori: list[str] = []
    global REPO
    originale = REPO
    tmp = tempfile.mkdtemp(prefix="vg-impronta-")
    try:
        base = Path(tmp)
        (base / "apps" / "api" / "src").mkdir(parents=True)
        (base / "docs").mkdir(parents=True)
        (base / "apps" / "api" / "src" / "a.ts").write_text("uno\n", encoding="utf-8")
        (base / "apps" / "api" / "src" / "b.ts").write_text("due\n", encoding="utf-8")
        (base / "docs" / "nota.md").write_text("fuori rotta\n", encoding="utf-8")

        def g(*a: str) -> None:
            subprocess.run(["git", "-C", str(base), *a],
                           capture_output=True, text=True, check=False)

        g("init", "-q")
        g("config", "user.email", "selftest@local")
        g("config", "user.name", "selftest")
        g("add", "-A")
        g("commit", "-q", "-m", "base")
        g("add", "-A")   # niente da aggiungere: parte pulito

        REPO = base
        # ①  il commit non deve spostare l'impronta
        (base / "apps" / "api" / "src" / "a.ts").write_text("uno modificato\n", encoding="utf-8")
        prima = impronta_suite("test-api")
        g("add", "-A")
        g("commit", "-q", "-m", "modifica")
        dopo = impronta_suite("test-api")
        if prima != dopo:
            errori.append("impronta ①: il COMMIT ha cambiato l'impronta "
                          f"({prima[:12]} -> {dopo[:12]}) — deve essere invariante")

        # ②  ma una modifica vera deve spostarla
        (base / "apps" / "api" / "src" / "b.ts").write_text("due modificato\n", encoding="utf-8")
        cambiata = impronta_suite("test-api")
        if cambiata == dopo:
            errori.append("impronta ②: modificando un file coperto l'impronta NON e' cambiata "
                          "— sarebbe una costante travestita da misura")

        # ③  un file fuori dalle rotte della suite non la riguarda
        g("add", "-A"); g("commit", "-q", "-m", "b")
        riferimento = impronta_suite("test-api")
        (base / "docs" / "nota.md").write_text("cambiata fuori rotta\n", encoding="utf-8")
        if impronta_suite("test-api") != riferimento:
            errori.append("impronta ③: un file fuori dalle rotte di `test-api` "
                          "ne ha cambiato l'impronta")

        # ④  togliere un file coperto e' un cambiamento quanto modificarlo
        (base / "apps" / "api" / "src" / "b.ts").unlink()
        if impronta_suite("test-api") == riferimento:
            errori.append("impronta ④: CANCELLARE un file coperto non ha cambiato "
                          "l'impronta — una suite potrebbe perdere un test e restare verde")
    except Exception as e:                                   # noqa: BLE001
        errori.append(f"impronta: il fixture non e' stato eseguibile: {e!r}")
    finally:
        REPO = originale
    return errori


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["route", "run", "check", "selftest"])
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

    if args.cmd == "selftest":
        return selftest()

    if args.cmd == "run":
        files = changed_files()
        # La STESSA definizione che usa `check`, non `route(files)`: vedi
        # `suite_da_verificare`. Con due definizioni diverse il cancello chiedeva
        # sette suite e il comando che suggeriva ne eseguiva due.
        needed = suite_da_verificare(files)
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
            # ⚠ `keep` porta avanti OGNI risultato precedente che non si riesegue,
            # non solo quelli fra le suite instradate adesso. Prima erano solo le
            # `fresh` di `needed`, e il verdetto PERDEVA le altre: una suite uscita
            # dal file spariva anche dall'obbligo, perche' `check` non puo'
            # distinguere «mai verificata» da «verificata e poi dimenticata».
            # E' D-88 in una terza forma — l'assenza di misura letta come assenza
            # di obbligo — misurata il 2026-09-09 su un verdetto GREEN scritto
            # dopo aver eseguito 2 suite delle 7 richieste.
            keep = [r for s, r in prev.items() if s not in to_run]
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
