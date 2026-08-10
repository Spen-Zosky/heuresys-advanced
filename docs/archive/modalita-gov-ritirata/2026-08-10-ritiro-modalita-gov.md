# Ritiro della modalità `gov` — tornare a due sole sessioni: `canonical` e `lab`

**Deciso da Enzo**: 2026-08-10, S1053 — *«abbandonare completamente lo sviluppo
dell'imbracatura e dei processi che costituiscono la tipologia di sessione gov»*.

**Stato di questo file**: PROGRAMMA, non eseguito. Ogni numero qui sotto è misurato oggi
sul repo, non ricordato.

---

## 1. Cosa c'è da togliere — il censimento

### A. File che esistono **solo** per `gov` (rimozione integrale) — **3.011 righe**

| file | righe | cos'è |
|---|---:|---|
| `scripts/gov-lib.sh` | 433 | la libreria: alberi di lavoro, identità DB declassata, assegnazione, perimetro |
| `scripts/hooks/gov_worker_guard.py` | 355 | il recinto sui comandi del lavoratore + il diario |
| `scripts/hooks/gov_divieti.py` | 270 | i divieti assoluti |
| `scripts/test/gov-lib-tests.sh` | 254 | prove della libreria |
| `scripts/gov-chiudi.sh` | 242 | l'istruttoria: 5 cancelli e il verdetto |
| `scripts/test/gov-worker-guard-tests.sh` | 231 | 50 prove del recinto |
| `docs/kb/tools/gov_rientro.py` | 196 | il punto di rientro di una sessione gov |
| `db/scripts/crea-ruolo-gov-worker.sh` | 104 | crea il ruolo PostgreSQL in sola lettura |
| `scripts/test/gov-riallineo-tests.sh` | 43 | 3 prove del riallineamento alberi |
| 5 piani in `docs/superpowers/plans/2026-08-*gov*.md` + `2026-08-10-corsa-181-*` | 883 | documentazione di progetto |

### B. File **condivisi**: si emendano, non si cancellano

| file | righe che nominano gov | cosa va tolto |
|---|---:|---|
| `scripts/hooks/session_mode.py` | 77 su 1.119 | costanti `GOV`/`WORKER`, `GOV_BRIEF`, `rientro_gov()`, `diagnosi_gov()`, `GOV_VIETATI`, `_decide_gov()`, `_casi_gov()` (**15 prove**), e il comando di avvio `avvia sessione gov` |
| `scripts/zp_panel.py` | 32 | la vista dei lavoratori nella plancia |
| `scripts/zero-pending-driver.sh` | 24 | `--lavoratori`, `--prepara-alberi`, l'intero ramo multi-lavoratore |
| `docs/kb/SOT_BACKLOG.md` | 23 | le voci `#173` `#175` `#176` `#179` `#180` |
| `docs/kb/tools/zp_state.py` | 12 | i comandi `perimetri`, `stato-gov`, `perimetro-json` |
| `docs/kb/xtras/SESSION_MODES.md` | 6 | da tre modalità a due |
| `.handoff/STATE.md` | 5 | la narrativa di S1052 |
| `docs/kb/tools/zp_selftest.py` | 4 | le prove 15-21 (i perimetri) |
| `scripts/test/run-shell-tests.sh` | 3 | **la sezione Z che invoca le batterie gov** ⚠️ vedi §3 |
| `scripts/hooks/hook.sh` | 3 | il routing `gov-recinto` e `gov-diario` |
| `zp.config.yaml` | 3 | la sezione `gov:` e le voci `perimetro:` |
| `CLAUDE.md` | 2 | la sezione «Session start» |
| `.claude/settings.local.json` | 2 | **due hook registrati**: `gov-recinto` (PreToolUse) e `gov-diario` (PostToolUse) |
| `.claude/skills/zero-pending-loop/{SKILL.md,references/selection.md}` | 2 | riferimenti |

### C. Stato e artefatti fuori dai sorgenti

- alberi di lavoro `D:/heuresys-gov-workers/w1` e `w2`
- **4 rami**: `gov/w1`, `gov/w2`, `gov/w1-recuperato`, `gov/w2-recuperato`
- `.zp/GOV-DA-FARE.md` (versionato oggi), `.zp/RIENTRO-GOV.md`, `.zp/verdetti/`, `.zp/locks/`
- **ruolo PostgreSQL `gov_worker`** — verificato oggi: esiste, con login, in sola lettura
- `.secrets/gov-worker.pass`

### D. Falsi positivi — **NON toccare**

`db/migrations/000226_timeline_governance_backfill.sql` · `db/scripts/populate-reference-translations-governance.sql` · `ux-design/**/governance/*`. Sono *governance di prodotto*, non la modalità.

---

## 2. Cosa NON muore con `gov`

- **`#181`** (i 7 rilievi sul controllo di drift) e **`#182`** (473 righe su rami mai
  entrate in main) sono **indipendenti**: descrivono difetti del codice dei test e lavoro
  non integrato. Restano validi e aperti dopo il ritiro.
- **`Z-112`** resta chiuso: il suo criterio è soddisfatto dal lavoro che è in main.
- **`Z-250`** resta chiuso, ma la sua nota di chiusura **cita la corsa presidiata**: va
  aggiunta una riga che dice che quell'impianto è stato poi ritirato, altrimenti fra un mese
  la nota manda a cercare script che non esistono più.

---

## 3. L'ordine è obbligato — e la ragione è misurata

**Se si cancellano i file di A prima di emendare B, il cancello di verifica diventa rosso.**

`scripts/test/run-shell-tests.sh:606-618` invoca `gov-worker-guard-tests.sh`,
`zp-review-tests.sh` e `gov-riallineo-tests.sh` — e la voce `#180` che le ha aggiunte lo ha
fatto **apposta perché una batteria mancante FALLISCA invece di essere saltata**. È lo stesso
motivo per cui quelle prove erano rimaste rosse per giorni senza che nessuno lo sapesse.

Quindi: **prima si toglie il richiamo, poi si cancella il richiamato.** Vale anche per le 15
prove `_casi_gov()` dentro il selftest della guardia e per le prove 15-21 di `zp_selftest.py`.

---

## 4. Il programma — una riga per consegna

| id | cosa | chi | fatto quando | stato |
|---|---|---|---|---|
| **R1** | Togliere i richiami alle batterie gov da `run-shell-tests.sh` e le prove `_casi_gov()`/15-21 dai due selftest | Claude | `bash scripts/test/run-shell-tests.sh` verde, `python docs/kb/tools/zp_selftest.py` verde, `sh scripts/hooks/hook.sh selftest` verde, con i conteggi nuovi dichiarati | da fare |
| **R2** | Rimuovere i **due hook** `gov-recinto` e `gov-diario` da `settings.local.json` e il loro routing da `hook.sh` | Claude | nessun hook nomina gov; una sessione nuova si apre e nessun PreToolUse/PostToolUse gov compare | da fare |
| **R3** | Amputare `session_mode.py`: da 4 modalità (`canonical`/`lab`/`gov`/`worker`) a 2. Il comando `avvia sessione gov` deve **degradare a `canonical`**, non fallire | Claude | `sh scripts/hooks/hook.sh selftest` verde; `avvia sessione gov` → modalità `canonical`; `avvia sessione lab` → `lab` invariata | da fare |
| **R4** | Riportare `zero-pending-driver.sh` a un lavoratore solo: via `--lavoratori`, `--prepara-alberi`, il ramo multi-worker | Claude | `bash scripts/zero-pending-driver.sh --dry-run` gira come prima di #173 | da fare |
| **R5** | Togliere da `zp_state.py` i comandi `perimetri`/`stato-gov`/`perimetro-json` e da `zp.config.yaml` la sezione `gov:` | Claude | `python docs/kb/tools/zp_state.py --help` non li elenca più; `zp_selftest` verde | da fare |
| **R6** | Togliere dalla plancia (`zp_panel.py`) la vista dei lavoratori | Claude | `pnpm plancia:zp` si apre e non mostra più lavoratori né verdetti | da fare |
| **R7** | Cancellare i 9 file del gruppo A (codice e prove) | Claude | i file non esistono; R1 e R2 già fatti, quindi nessun cancello si accende | da fare |
| **R8** | Archiviare i 5 piani gov in `docs/archive/` invece di cancellarli — sono il resoconto di cosa è stato provato e perché è stato ritirato | Claude | i piani stanno in `docs/archive/`, `docs/superpowers/plans/` non ne ha più | da fare |
| **R9** | Documentazione: `CLAUDE.md`, `SESSION_MODES.md`, `STATE.md` tornano a due modalità | Claude | nessuno dei tre nomina `gov`; `handoff_lint` 0 fail | da fare |
| **R10** | Registro: chiudere `#173` `#175` `#176` `#179` `#180` come **WON'T-DO con motivazione**, e aggiungere a `Z-250` la riga che dice che l'impianto è stato ritirato | Claude | `handoff_lint` 0 fail; il menu non propone più voci gov | da fare |
| **R11** | I 4 rami `gov/*` e i 2 alberi di lavoro | **Enzo decide**, Claude esegue | vedi §5 — è la sola voce che contiene una perdita possibile | **bloccata su Enzo** |
| **R12** | Il ruolo PostgreSQL `gov_worker` e `.secrets/gov-worker.pass` | **Enzo decide**, Claude esegue | vedi §5 | **bloccata su Enzo** |
| **R13** | `.zp/GOV-DA-FARE.md`, `.zp/RIENTRO-GOV.md`, `.zp/verdetti/`, `.zp/locks/` | Claude | rimossi, e l'eccezione `!.zp/GOV-DA-FARE.md` tolta dal `.gitignore` | da fare |
| **R14** | Verifica finale: sessione nuova, entrambe le modalità, cancelli verdi | Claude | `avvia sessione` e `avvia sessione lab` funzionano; `run-shell-tests` + `zp_selftest` + `hook.sh selftest` verdi; `handoff_lint` 0 fail | da fare |

---

## 5. Le due decisioni che restano a Enzo

**R11 — i rami e gli alberi.** I 4 rami `gov/*` contengono **473 righe mai entrate in main**
(misurato con `git cherry`, per contenuto): 317 sono il versante E2E di `Z-112`, 156 il
triage Dependabot di `Z-230`. **Ritirare `gov` non implica buttare quel lavoro**: sono due
decisioni diverse, ed è la voce `#182`. Tre strade: recuperarlo prima di cancellare i rami ·
cancellare i rami dichiarando che si perde · lasciare i rami e togliere solo l'impianto.

**R12 — il ruolo di database.** `gov_worker` esiste e ha login. È in sola lettura per
costruzione, quindi lasciarlo non apre nulla; ma è superficie che nessuno userà più.
Revocarlo è una `DROP ROLE` sulla produzione — reversibile solo rilanciando lo script che
questo stesso programma cancella (`crea-ruolo-gov-worker.sh`). Se si decide di revocarlo,
va fatto **prima** di R7, o va conservata una copia dello script.

---

## 6. Simulazione — le cinque domande, per le voci che ne hanno bisogno

**R3 (l'amputazione di `session_mode.py`)** — è la voce più rischiosa.
- *Precondizioni*: R1 e R2 già fatte, altrimenti gli hook chiamano codice che sto togliendo.
- *Meccanismo*: il file ha 1.119 righe di cui 77 nominano gov, ma non sono contigue: sono
  costanti, due funzioni di briefing, il decisore `_decide_gov`, 15 casi di prova e il
  riconoscimento del comando di avvio. **Va letta ogni occorrenza**, non cancellata a blocchi.
- *Propagazione*: il file è tracciato; i cloni lo ricevono con `git pull`. Nessuna copia fuori.
- *Chi*: Claude.
- *Guardia*: `sh scripts/hooks/hook.sh selftest` **prima e dopo**, con il numero di prove
  dichiarato in entrambi i casi. Un selftest che passa da 106 a 91 va bene; uno che passa a 0
  è un file rotto che non esegue più niente — e passerebbe lo stesso.

**R7 (cancellare i 9 file)** — distruttiva.
- *Guardia*: R1 e R2 devono essere già verdi. Elenco esplicito dei file, **mai un carattere
  jolly**: nel repo esistono file `*governance*` che non c'entrano (§1.D).
- *Rollback*: i file sono in git, si recuperano con `git checkout <sha>~1 -- <path>`. La
  cancellazione è un commit, non una perdita.

**R11/R12** — non si simulano: aspettano una decisione.

---

## 7. Confine di sessione, dichiarato adesso

Questo programma **non entra in una sessione sola**. R1→R10 e R13→R14 sono ~14 consegne su
codice che gira dentro gli hook di ogni sessione: un errore in R3 rompe l'apertura di
*tutte* le sessioni future, incluse quelle che dovrebbero ripararlo.

Ordine consigliato: **R1+R2 in una sessione** (togliere i richiami, spegnere gli hook — è
ciò che rende inerte l'impianto anche se il resto non si facesse mai), poi **R3+R4** in una
seconda, poi il resto. Dopo R1+R2 la modalità `gov` è già di fatto spenta: il resto è pulizia.
