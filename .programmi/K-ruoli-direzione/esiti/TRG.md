# TRG — quali scoperte e correzioni sono ancora aperte, misurate una per una

Mandato Cowork, ciclo 2 (voce di GOVERNO, non del mandato K), passaggio 4. Sessione non presidiata,
data 2026-09-25. Indagine: nessuna correzione applicata qui, solo classificazione con prova.

**Nota di metodo sulla misura.** Le verifiche sul registro e sul piano sono state condotte da due
agenti in sola lettura, in worktree isolati; per l'intera durata dei loro lavori i tool Bash/PowerShell
sono risultati non disponibili in quell'ambiente ("worktree isolation context lost", confermato con
retry ripetuti). Dove serviva `git log`/`git stash list` sul gemello o una query diretta al DB della VM,
il verdetto è **NON MISURATA** con la ragione dichiarata. Dove la stessa domanda riguardava QUESTO
repository (non il gemello/VM), le ho riverificate io stesso, fuori da worktree, con `git status`,
`git stash list`, `git tag -l`, `diff` fra le due copie di `guardiano.py`, `grep` su `canale.py` —
comandi riportati nelle note.

---

## TRG-1 — Registro delle scoperte (`esiti/REGISTRO_SCOPERTE.md`, 55 voci)

| # | data | scoperta (prime parole) | verdetto | evidenza/comando | nota |
|---|---|---|---|---|---|
| 1 | 2026-09-17 | close-propagate fallisce su align-claude-ecosystem, sospetta race | SUPERATA | Registro stesso, voce #28 (S1106): "senza nessun'altra sessione viva, lo stesso fallimento si è ripetuto" | ipotesi race smentita dalla sessione successiva |
| 2 | 2026-09-19 | seed_acquisition:read/trigger gatano oltre tenant-import-runs | APERTA | Read `STATO.md` R-6b: condizione ridetta S1106, nessun codice cambiato da allora | granularità per famiglia non per modulo, tocca anche R-8 (chiusa) |
| 3 | 2026-09-19 | tenant-materialization scrive su sys_user_kpi_evidence (importato) | DECISIONE-DI-ENZO | Grep `sys_user_kpi_evidence` in `tenant-materialization/repository.ts` — scrittore confermato, rotta PLATFORM_ADMIN-only | richiede scelta su come distinguere MATERIALIZZAZIONE da IMPORT nel confine strutturale |
| 4 | 2026-09-19 | CI rosso 3 cause (seed collaudo, 000178, 000152) | RISOLTA | Read `.github/workflows/test-integration.yml` (step seed collaudo), `000178_rbac_proxy_permissions.sql`, `000152_leads.sql` — fix presenti | commit 9ac0393d |
| 5 | 2026-09-19 | violazione C4 su heuresys_ci condiviso con CI reale | SUPERATA | evento storico, chiuso committando R-3 | nessun artefatto residuo |
| 6 | 2026-09-19 | verify_gate test-api usava .env sbagliato (heuresys_advanced vs heuresys_ci) | RISOLTA | Read `STATO.md` R-3: "4 file/23 test riverificati verdi su ENTRAMBI i DB" | — |
| 7 | 2026-09-19 | restart runner CI cancella corsa in volo | SUPERATA | evento one-off, nessun dato coinvolto | — |
| 8 | 2026-09-14 | orfani registro provenienza: 11 tabelle non 2 | RISOLTA | vista S-3 (mig 000419) nata con 11 righe | verificato |
| 9 | 2026-09-14 | spiaTrovata confronta solo stringa, 2 falsi negativi su 6 | RISOLTA | Grep `spiaTrovata` in `W1_indagini.js`: confronto ora include il numero atteso | — |
| 10 | 2026-09-14 | file `_lettore`/`_verifica` non coincidono con `_risultato.json` | RISOLTA | `tools/esito_w0.py` usa `_risultato.json` come fonte | — |
| 11 | 2026-09-14 | tre regex "equivalenti" danno 3 numeri diversi | SUPERATA | comportamento per design, dichiarato nel registro stesso | ogni numero porta il comando, per costruzione |
| 12 | 2026-09-15 | dove_siamo.py leggeva rollback come "da riapplicare" | RISOLTA | `tools/dove_siamo.py`: "ROLLBACK APPLICATO... NON si riapplica" | corretto in F0.4 |
| 13 | 2026-09-15 | tuple morte 51,2% sys_position_skill_requirements | DECISIONE-DI-ENZO | non rimisurabile oggi (DB live); nessuna evidenza di VACUUM su questa tabella | "lo vuoi nel prossimo?" — manutenzione, non mandato K |
| 14 | 2026-09-15 | file fuori scratchpad `C:\Git\tmp_dove.txt` | DECISIONE-DI-ENZO | Read: file ESISTE ANCORA | V1 vieta cancellazione autonoma; Enzo decide |
| 15 | 2026-09-15 | deroga spiaTrovata applicata a W1/W2/W5 | RISOLTA | stesso riscontro di #9 | — |
| 16 | 2026-09-15 | due agenti hanno scritto fuori dalla cartella designata | APERTA | `tools/misura_i_b.py` ancora presente (ora tracciato) | regola "non creare file fuori" non risulta aggiunta agli script |
| 17 | 2026-09-15 | primo lancio W2 fallito per rete (ENOTFOUND) | SUPERATA | evento one-off, non un difetto dello script | — |
| 18 | 2026-09-16 | git pull rifiutato per 206 file "M" (CRLF), messo da parte con stash | NON MISURATA | richiede `git stash list`/`git log` sul gemello linux-pc — non raggiungibile da questa sessione | causa (autocrlf) mai indagata |
| 19 | 2026-09-16 | semantic-matching flake 2/33 poi 33/33 | SUPERATA | `STATO.md` R-1: flake non correlato, non riproducibile | — |
| 20 | 2026-09-15 | 131/276 file rossi per TOTP mancante (enzo.spenuso) | DECISIONE-DI-ENZO | Grep su `esiti/RISPOSTE_ENZO.md`: nessuna scelta fra le 3 vie (a/b/c) risulta presa | sintomo acuto già risolto; causa strutturale (clone notturno cancella il fattore) resta indecisa |
| 21 | 2026-09-17 | stesso fenomeno di #18 ma 228 file | NON MISURATA | stesso motivo di #18 | terzo residuo dello stesso tipo in 3 sessioni |
| 22 | 2026-09-17 | tre copie di guardiano.py, due identiche una diversa | SUPERATA | Grep `picco_frazione`: presente in entrambe le copie di heuresys-advanced, assente in quella del datastore | misura riconfermata oggi, nessuna azione dovuta (istruzione esplicita di non toccarla) |
| 23 | 2026-09-19 | gdpr:retention concesso ma service.ts risponde 403 a tutti | DECISIONE-DI-ENZO | `mandati.ts` conferma `GDPR_MANDATE_ROLES` = solo PLATFORM_ADMIN; `gdpr/service.ts:158` invariato | richiede scelta: allineare la porta al permesso, o restringere il permesso |
| 24 | 2026-09-19 | linux-pc irraggiungibile durante R-2 | SUPERATA | risolto usando `oracle-vm-default` come gemello alternativo | via alternativa già documentata e in uso |
| 25 | 2026-09-19 | createdb --template non copia pg_database.datacl | RISOLTA | Grep `aclexplode` in `ci-rehearsal.sh`; `CI_REHEARSAL_TEMPLATE` in `prova-idempotenza.sh` | entrambi i fix presenti nel codice |
| 26 | 2026-09-19 | OKR check-ins/key-results senza scrittore applicativo | DECISIONE-DI-ENZO | nessun INSERT trovato in `apps/api/src`; `okrs/repository.ts` dichiara READ-only | classificazione (nativo) già decisa; gap applicativo resta |
| 27 | 2026-09-19 | sys_platform_user_tenant_assignments non self-raggiungibile né esclusa | DECISIONE-DI-ENZO | Grep su `check_completezza_self.py`: nessun riscontro, né incluso né escluso con motivo | richiede scelta: costruire superficie self o dichiarare esclusione motivata |
| 28 | 2026-09-19 | close-propagate SIGPIPE in modalità --delta | RISOLTA (CHIUSURA-C2, 2026-09-25) | commit `7ee357ee`: `\|\| true` aggiunto alle due pipeline (righe 601 e 554); provato sul vivo, il secondo giro di `close-propagate --delta` ha superato il punto in cui moriva | — |
| 29 | 2026-09-19 | 000314 contava concessioni deleghe globalmente | RISOLTA | `db/migrations/000314_deleghe.sql`: post-condizione scopata sui 3 ruoli originari | ADR-0035 rispettata (file che crea, emendato) |
| 30 | 2026-09-19 | bundle produzione fermo al 14/9, 3 ruoli senza permessi effettivi in prod | RISOLTA (CHIUSURA-C3, 2026-09-26) | deploy completato su `a8f60932` (VM+linux-pc, `verifica-deploy.sh` → DEPLOYATO); prova live in produzione: PLATFORM_OPERATOR 200/403 e SALES 200/403, entrambe le controprove reggono | il blocco vero era `ci-gate.sh` a corto di rate limit GitHub (tre correzioni, vedi CHIUSURA-C2.md §C3), non il bundle in sé |
| 31 | 2026-09-19 | guardiano.py --session risolve da cwd non da id | DECISIONE-DI-ENZO | dottrina livello utente, fuori da questo repo | proposta di Cowork per Enzo |
| 32 | 2026-09-19 | freno canale legge processo vivo come "occupato" dopo chiusura dichiarata | DECISIONE-DI-ENZO | dottrina canale/livello utente | non applicabile qui |
| 33 | 2026-09-19 | guardiano --sorveglia exit 3 non vincolante (nessun hook lo fa rispettare) | DECISIONE-DI-ENZO | dottrina CLI/utente | 3 rimedi proposti, nessuno deciso |
| 34 | 2026-09-19 | dove_siamo.py non mostrava le 14 voci BLOCCATA(fase) | RISOLTA | `tools/dove_siamo.py`: sezione 3-bis presente e funzionante | corretto in S1108 |
| 35 | 2026-09-19 | deadlock reale su corsa concorrente (gdpr test) | SUPERATA | `STATO.md` S1112: contesa reale sul runner condiviso, non un difetto di codice | — |
| 36 | 2026-09-19 | ramo 5h guardiano cieco per sessioni headless | DECISIONE-DI-ENZO | dottrina livello utente (`rate-limits.json`) | proposta non applicata qui |
| 37 | 2026-09-19 | heuresys_ci sulla VM ha ACL vuota | NON MISURATA | richiede query diretta sul DB della VM, non eseguita in questa sessione | non confermabile se riparata o ritirata |
| 38 | 2026-09-19 | prova-api-sul-gemello.sh senza lock cross-sessione | DECISIONE-DI-ENZO | Grep `lock\|flock` in `prova-api-sul-gemello.sh`: nessun riscontro | gap presente, non è mio da inventare senza conferma |
| 39 | 2026-09-19 | 000210 riapplicata fuori ordine cancella grant TENANT_ADMIN | RISOLTA | `STATO.md` R-5: catena riapplicata in ordine, grant tornati, 5/5 verdi | resta aperta la domanda "chi riapplica una singola migrazione" (proposta, non decisa — non riaperta qui: nessun nuovo incidente misurato) |
| 40 | 2026-09-19 | trigger()/tenantDiDestinazione() usavano actor.tenantId invece di assignedTenantIds | RISOLTA | Grep `assignedTenantIds` in `tenant-import-runs/service.ts` e `seed-acquisition-runs/service.ts` | fix confermato in entrambi i siti |
| 41 | 2026-09-19 | permessi_da_classificazione.py fraintendeva il passo 56 | RISOLTA | `tools/permessi_da_classificazione.py`: docstring corretto | corretto prima di ogni uso |
| 42 | 2026-09-19 | OKR (ri-registrazione esplicita su richiesta di Enzo) | DECISIONE-DI-ENZO | stesso riscontro di #26 | duplicato voluto dal mandato |
| 43 | 2026-09-19 | compattazione CLI azzera soglia guardiano (contesto crolla a ~29%) | RISOLTA | `guardiano.py`: verdetto guarda `picco_frazione`, con COMPATTATA dichiarata, selftest dedicato | fix implementato (opzione i della proposta), nonostante il registro lo desse per "non applicato" il 19/9 |
| 44 | 2026-09-19 | finestra 5h headless misurabile via supervisore.py/stato.json | DECISIONE-DI-ENZO | dottrina canale/utente | non applicata in questo repo (ma di fatto RISOLTA a livello canale — vedi TRG-2 C-2) |
| 45 | 2026-09-19 | polling ssh ripetuto costa un turno a colpo | DECISIONE-DI-ENZO | regola operativa di conduzione sessioni, non file di codice | recepita nella sessione che l'ha scritta |
| 46 | 2026-09-19 | allarme SILENZIO non riconosce tool_progress come segno di vita | DECISIONE-DI-ENZO | dottrina canale/supervisore | di fatto RISOLTA a livello canale — vedi TRG-2 B-3 |
| 47 | 2026-09-19 | sys_leave_balance_transactions riclassificata IMPORT (non NATIVO) | RISOLTA | `esiti/X-2_tabelle.md`: "applico IMPORT invece di NATIVO" | decisione tecnica autonoma già applicata |
| 48 | 2026-09-19 | tuple morte 51,2% sys_position_skill_requirements (S1112) | DECISIONE-DI-ENZO | non rimisurabile oggi; nessuna evidenza di VACUUM su questa tabella | stesso di #13, manutenzione fuori mandato |
| 49 | 2026-09-19 | tuple morte 20,6% sys_auth_role_permissions | RISOLTA | `STATO.md` S1112: "risolto con VACUUM ANALYZE su produzione e gemello" | confermato eseguito |
| 50 | 2026-09-19 | W5_presenze.js non eseguibile senza opt-in esplicito | DECISIONE-DI-ENZO | `workflows/W5_presenze.js` ancora presente, non modificato | in attesa di opt-in ("ultracode") da Enzo |
| 51 | 2026-09-19 | cancello uscita-sicura: 42 file + 2 stash | RISOLTA | `.gitignore`: le 4 azioni (estensione, tracciamento, spostamento file) confermate | restano solo i 2 stash, risolti separatamente (v. #18/H-2) |
| 52 | 2026-09-19 | G-1 passo 67, quattro scoperte (colonna mancante, permessi PEOPLE_MANAGER, persona test errata, conteggio trasferimento) | RISOLTA | `db/migrations/000448_g1_...sql` intero: tutte e quattro + quinto effetto (S-2) confermati | — |
| 53 | 2026-09-19 | verify_gate tre giri prima del verde (terzo bersaglio migrazione) | RISOLTA | `STATO.md` G-1: terzo bersaglio applicato, verde confermato | residuo "tre bersagli senza comando unico" resta proposta non decisa, nessun nuovo incidente |
| 54 | 2026-09-24 | D12, CI rossa login 401, ipotesi runner condiviso | SUPERATA | ipotesi smentita esplicitamente dalla voce #55 | — |
| 55 | 2026-09-24 | D11-0, due chiavi di collaudo diverse (drop-in vs .secrets) | RISOLTA | `db/scripts/provision-collaudo-access.ts`: verifica argon2 + rotazione automatica implementata | resta per Enzo: riavviare il servizio o allineare il drop-in |

**Conteggio TRG-1**: APERTA 4 · RISOLTA 20 · SUPERATA 10 · DECISIONE-DI-ENZO 18 · NON MISURATA 3.

---

## TRG-2 — Piano `PIANO_collaudo-e-correzioni-governo_2026-09-19.md`

### Parte 1 — Il collaudo (C-0..C-7)

| id | verdetto | evidenza | nota |
|---|---|---|---|
| C-0 | SUPERATA | `giro_di_governo.md`: giro automatico acceso/spento più volte nel governo reale | mai eseguito come test isolato |
| C-1 | SUPERATA | `giro_di_governo.md`: ciclo dalla skill eseguito ripetutamente in produzione | non come collaudo dedicato |
| C-2 | SUPERATA (dal vero) | `giro_di_governo.md`: chiudi-rito usato più volte, due cancelli visti scattare | non in un test scritto |
| C-3 | SUPERATA da un caso reale | `giro_di_governo.md` (22:16 19/9): "NON-SI-PUO-CHIUDERE: lavoro non salvato: 8 file" | caso negativo VERO, non provocato — la Parte 4 del piano stesso escludeva la provocazione |
| C-4 | SUPERATA (dal vero) | `giro_di_governo.md` (23:01, chiusura G-1): SI-PUO-CHIUDERE dopo spostamento file | seconda chiusura verde vista realmente |
| C-5 | NON MISURATA | verificato oggi: `--riapri` esiste nel codice di `canale.py` (righe ~646, 695, 927) | meccanismo implementato, ma nessun log di un uso riuscito trovato — "un cancello va visto scattare" non ancora soddisfatto per questa voce |
| C-6 | RISOLTA | `canale\giro_di_governo.md` (772+ righe, fino al 24/9) | pratica consolidata oltre l'ambito del collaudo |
| C-7 | SUPERATA | `giro_di_governo.md`: gestito operativamente più volte | non come step isolato |

### Gruppo A — skill + copia durevole

| id | verdetto | evidenza | nota |
|---|---|---|---|
| A-1 | APERTA | `COME_GOVERNO_UNA_SESSIONE.md`: nessun "passo 5" dedicato; il concetto esiste altrove (`verifica_ciclo.py`, `canale.py`) ma non nella forma documentale richiesta | manca ancora il capitolo esplicito |
| A-2 | SUPERATA (in meglio) | `canale.py`: commento esplicito "il cinque è la lunghezza del ciclo, non un tetto" | Enzo ha deciso diversamente il 19/9: non "si ferma e avvisa" ma "verifica e prosegue da sola" |
| A-3 | RISOLTA | `COME_GOVERNO_UNA_SESSIONE.md`: sezione "I SEGNALI CHE MENTONO" presente | — |
| A-4 | APERTA | nessuna sezione "tre difetti del guardiano" trovata | — |
| A-5 | APERTA | nessuna sezione "due regole di costo" trovata | — |
| A-6 | APERTA | nessuna sezione "dottrina del tetto" trovata | — |
| A-7 | APERTA | nessuna sezione consolidata "il ponte e i suoi guasti" | i guasti restano sparsi in `giro_di_governo.md`, non consolidati |
| A-8 (doc — "il riavvio uccide tutto") | RISOLTA | `COME_GOVERNO_UNA_SESSIONE.md` riga ~396 presente | — |
| A-8 (Parte 5 — blocco stash, stessa sigla riusata dal piano per un'altra voce) | RISOLTA | verificato oggi: `git stash list` vuoto, `git tag -l "lavoro-messo-da-parte*"` → `-0` e `-1` presenti | Enzo ha dato il consenso la notte del 19/9 (dopo che la Parte 5 era già stata scritta); il blocco descritto è superato |
| A-9 | APERTA | `00_RIPRENDI_COWORK.md`: dichiara esplicitamente ancora oggi "va riconciliato nella skill dopo il collaudo (voce A-9)" | confermato aperto dalla stessa fonte che lo governa |

⚠ **Nota**: il piano usa la sigla "A-8" due volte con significati diversi (gruppo A originale vs. Parte 5) — segnalato qui perché genera ambiguità di lettura, non un difetto di prodotto.

### Gruppo B — supervisore.py

| id | verdetto | evidenza | nota |
|---|---|---|---|
| B-1 | RISOLTA | `supervisore.py`: funzione di conteggio per consecutività (non finestra scorrevole) | forma più stretta del progettato, dichiarata e provata in `selftest_headless.py` |
| B-2 | RISOLTA (nella forma dichiarata) | `supervisore.py`: contesto visibile durante il turno; costo solo su evento `result` | il residuo (costo non visibile durante) è dichiarato NON MISURABILE nel codice stesso, non un difetto nascosto |
| B-3 | RISOLTA | `supervisore.py`: `tool_progress`/`elapsed_time_seconds`/`task_progress` riconosciuti come segni di vita | messaggio "dentro una sola chiamata da N minuti" confermato |
| B-4 | APERTA (di proposito) | nessun codice di iniezione automatica trovato in `supervisore.py` | il piano stesso vieta di farlo prima che B-1 fosse calibrato; ora B-1 lo è, ma serve un loop provocato su una sessione vera per vederlo scattare |

### Gruppo C — guardiano.py

| id | verdetto | evidenza | nota |
|---|---|---|---|
| C-1 | RISOLTA | `guardiano.py`: ricerca per id indipendente da cwd, commento "CORRETTO 2026-09-19 (C-1)" | — |
| C-2 | RISOLTA | `guardiano.py`: legge `canale\<nome>\stato.json` (`cinque_ore_pct`, `aggiornato_il`) | — |
| C-3 | RISOLTA | `guardiano.py`: soglia scatta su `picco_frazione`, non sul contesto corrente | — |
| Allineamento copie | RISOLTA | verificato oggi: `diff` fra `~/.claude/tools/guardiano.py` e `docs/kb/tools/guardiano.py` sulle righe C-1/C-2/C-3/picco_frazione → identiche | — |

### Gruppo D — la verifica di fine ciclo

| id | verdetto | evidenza | nota |
|---|---|---|---|
| D-1 | RISOLTA | `verifica_ciclo.py` docstring = criterio letterale; `SKILL.md` lo riporta | criterio scritto in entrambi i posti |
| D-2 | RISOLTA | `verifica_ciclo.py` eseguito davvero: `00_RIPRENDI_COWORK.md` riporta "CICLO CHIUSO: 4 voci su 4" | non solo scritto, usato |
| D-3 | APERTA | nessun selftest dedicato trovato che provi ROSSA su un caso provocato (voce CHIUSA senza commit) e NON MISURATA su una prova assente | il piano stesso: "finché non lo si è visto dire no, non sa dire sì" — gap reale, non solo di misura |
| D-4 | RISOLTA | `SKILL.md`: "se non è verde... riparte dal passaggio 1 con un mandato che nomina le voci rosse" | scritto letteralmente |

### Gruppo E — il contatore della catena

| id | verdetto | evidenza | nota |
|---|---|---|---|
| E-1 | SUPERATA (da forma migliore) | `canale.py`: `catena.txt` abbandonato, sostituito da conteggio reale delle sessioni aperte nelle ultime 24h | non dipende più da uno scrittore esterno |
| E-2 | SUPERATA (cambiato mestiere, ma VISTO scattare) | `COME_GOVERNO_UNA_SESSIONE.md`: "non dice più CATENA FERMATA... dice CICLO PIENO"; visto fermare una sesta apertura il 19/9 (uscita 3, prima di aprire) | il cancello non "chiede a una persona": esegue la verifica e prosegue da solo — decisione di Enzo del 19/9 |
| E-3 | DECISIONE-DI-ENZO | `canale.py`: `MASSIMI_ANELLI = 5` ancora hardcoded | il piano stesso: "si cambia solo dopo che E-2 è stato visto scattare" — E-2 è visto scattare, quindi la porta è aperta, ma il numero resta esplicitamente di Enzo |

### Gruppo F — la rotazione della sessione Cowork

| id | verdetto | evidenza | nota |
|---|---|---|---|
| F-1 | APERTA (condizione peggiorata) | `00_STATO_ORA_heuresys-advanced.md` fermo al 19/9 ore 19:40 vs `00_RIPRENDI_COWORK.md` aggiornato al 24/9 22:30 | le tre fonti restano distinte; oggi il primo file è stantio di 5-6 giorni — esattamente il difetto che F-1 doveva prevenire |
| F-2 | APERTA | nessuna attività pianificata "all'accesso" trovata che rilanci una sessione interrotta; solo un giro ogni 15 minuti | mestiere diverso da quello richiesto |
| F-3 | APERTA | `00_STATO_ORA_heuresys-advanced.md`: "Scritto da Cowork, a misura fatta" — scrittura manuale | nessun meccanismo di auto-riscrittura trovato; è la causa diretta di F-1 |

### Gruppo G — il controllo dei propri strumenti

| id | verdetto | evidenza | nota |
|---|---|---|---|
| G-1 | RISOLTA (ma stantia) | `~/.claude/reference/strumenti-disponibili.md`: "Rigenerato il 2026-09-19 alle 15:46" | non risulta rigenerato da allora (6 giorni) — collegato a G-7 |
| G-2 | RISOLTA | `~/.claude/CLAUDE.md`: sezione "Test-before-claim" con la frase sulle proprie capacità | confermata presente nel testo in vigore oggi |
| G-3 | RISOLTA | `~/.claude/CLAUDE.md` header "SoT-versione: 2026-09-20-2205"; `00_RIPRENDI_COWORK.md` (24/9 22:30): "il campo Istruzioni per Claude su claude.ai è allineato al timbro 2026-09-20-2205" | coerente con la dichiarazione del registro (fatto da Cowork il 24/9 alle 22:03) |
| G-4 | RISOLTA | `docs/kb/COWORK_INBOX.md`: voce con `stato: [RICONCILIATA S1112]` | confermata riconciliata e committata |
| G-5 | RISOLTA | nessuna regressione trovata nei riferimenti incrociati fra i tre file `00_*` e la skill | — |
| G-6 | APERTA | nessuna occorrenza della regola strumenti in `COME_GOVERNO_UNA_SESSIONE.md` | — |
| G-7 | APERTA | `00_RIPRENDI_COWORK.md`: le "tre cose nei primi 5 minuti" non includono la rigenerazione dell'inventario, solo la rilettura | non soddisfa la richiesta letterale; causa diretta della staleness di G-1 |

### Gruppo H — file non tracciati e stash (Parte 4)

| id | verdetto | evidenza | nota |
|---|---|---|---|
| H-1 | RISOLTA | verificato oggi: `git status --porcelain` in D:\heuresys-advanced → **0 righe** | repository pulito, i 4 gruppi di file non tracciati sono stati sistemati (vedi anche registro #51) |
| H-2 | RISOLTA | verificato oggi: `git stash list` vuoto; `git tag -l "lavoro-messo-da-parte*"` → `-0` e `-1` presenti | Enzo ha dato il consenso la notte del 19/9 (`00_RIPRENDI_COWORK.md`: "Enzo ha dato l'ok il 19/9"); gli stash sono stati convertiti in tag permanenti, non cancellati |
| H-3 | APERTA | `uscita_sicura.py` letto per intero: conta ancora tutto `git status --porcelain` senza distinguere scarto noto da lavoro non salvato | nessuna logica di eccezione trovata; meno urgente ora che H-1/H-2 tengono il repository pulito, ma il cancello resta strutturalmente cieco su questa distinzione |
| H-4 | RISOLTA (in pratica) | la sequenza reale (rosso vero sugli 8 file → correzione → verde vero, C-3/C-4 sopra) è avvenuta esattamente come H-4 chiedeva | non formalizzata in un documento oltre la Parte 4 del piano stesso |

**Conteggio TRG-2**: APERTA 14 · RISOLTA 22 · SUPERATA 9 · DECISIONE-DI-ENZO 1 · NON MISURATA 1. (47 voci totali, doppio A-8 contato come due righe distinte.)

---

## Conteggio complessivo (TRG-1 + TRG-2, 102 voci)

| verdetto | totale |
|---|---|
| APERTA | 18 |
| RISOLTA | 42 |
| SUPERATA | 19 |
| DECISIONE-DI-ENZO | 19 |
| NON MISURATA | 4 |

---

## TRG-3 — Candidate al prossimo ciclo (solo le APERTE, ordinate per impatto)

Nessuna di queste voci è stata aperta o corretta in questa sessione: sono presentate una volta sola.

**Impatto alto (rischio su dati/lavoro/produzione reale)**

1. **[registro #30] Tre ruoli (PLATFORM_OPERATOR, SALES, DPO) senza permessi effettivi in produzione**, nonostante i grant siano corretti nel database, perché il bundle deployato è fermo al 14/9 (prima di R-9) e il rearmo del deploy dipende da CI verde su linux-pc. Fatto = bundle di produzione ricompilato e deployato con i ruoli correnti, verificato dal log di avvio (nessun `unknownRolesSkipped`). Chi: sessione CLI, quando linux-pc è raggiungibile e la catena CI è verde (skill `full-alignment-deploy`) — **non è propagazione da fare in questa sessione TRG**, resta una voce per il prossimo ciclo. Stima: piccola una volta che il gemello è disponibile, ma dipende da un vincolo esterno (disponibilità macchina).

**Impatto medio (rischio di errori operativi o accesso più ampio del previsto)**

2. **[piano F-1/F-3] `00_STATO_ORA_heuresys-advanced.md` è stantio di 5-6 giorni** rispetto a `00_RIPRENDI_COWORK.md`, perché nessun meccanismo lo riscrive da sé (F-3 non fatto). Fatto = il file porta un'ora recente senza intervento manuale, provato lasciandolo per un ciclo intero. Chi: Cowork (canale). Stima: media (script di generazione + verifica del trigger).
3. **[piano F-2] Nessuna attività pianificata "all'accesso" rilancia una sessione rimasta interrotta** dopo un riavvio del PC. Fatto = provato spegnendo/riaccendendo il PC, o terminando un supervisore a mano e vedendo la ripresa. Chi: Cowork. Stima: media.
4. **[registro #28] close-propagate SIGPIPE in modalità --delta**, aggirato con --full ma non corretto alla radice (pipeline `find|head` sotto `pipefail`). Fatto = la modalità --delta torna a funzionare, provato isolando la pipeline sospetta. Chi: sessione CLI. Stima: piccola-media.
5. **[piano H-3] `uscita_sicura.py` non distingue scarto noto da lavoro non salvato** — oggi meno urgente (repository pulito), ma resta un cancello che può tornare a dare falsi rossi appena ricompaiono evidenze/bozze non tracciate. Fatto = visto dare verde su un repository con scarto noto e rosso su una modifica vera non committata. Chi: Cowork (con autorizzazione di Enzo, come dichiarato nel piano). Stima: piccola-media.
6. **[registro #2] `seed_acquisition:read`/`trigger` concedono accesso a 3 moduli oltre a `tenant-import-runs`**, granularità per famiglia non per modulo (tocca anche R-8, già chiusa). Fatto = una migrazione di granularità che separa i permessi per modulo. Chi: sessione CLI. Stima: media (nuovo mandato, non un emendamento).

**Impatto basso (documentazione, igiene, rifiniture)**

7. **[piano A-4, A-5, A-6, A-7, A-1] Cinque sezioni mancanti nella skill/copia durevole**: i tre difetti del guardiano, le due regole di costo, la dottrina del tetto, "il ponte e i suoi guasti", il capitolo esplicito sul passo 5. Fatto = ogni sezione scritta in entrambi i file con lo stesso timbro aggiornato. Chi: Cowork. Stima: media (5 sezioni).
8. **[piano G-6, G-7] La regola sul controllo degli strumenti non è nella skill, e l'inventario non si rigenera a ogni ripresa** (causa diretta della staleness di G-1). Fatto = la skill la contiene, e `00_RIPRENDI_COWORK.md` include il passo "rigenera l'inventario" fra le prime cose. Chi: Cowork. Stima: piccola.
9. **[piano D-3] `verifica_ciclo.py` non ha una prova di fiducia** (caso negativo/positivo provocato). Fatto = visto dire ROSSA su una voce CHIUSA senza commit, e NON MISURATA su una prova assente. Chi: Cowork. Stima: piccola.
10. **[piano F-2 duplicato con A-9] La riconciliazione dei tre file `00_*` con la skill** resta dichiarata aperta dalla stessa fonte che la governa. Fatto = ogni argomento in un posto solo. Chi: Cowork. Stima: piccola (in parte sovrapposta a F-1).
11. **[piano B-4] Iniezione di un avviso nella sessione al terzo giro in tondo**, non implementata di proposito finché non c'è occasione di vederla scattare su un loop provocato in una sessione vera. Chi: Cowork, alla prossima occasione utile. Stima: piccola una volta calibrata.
12. **[registro #16] Regola "non creare file fuori dalla cartella designata" non aggiunta agli script** dei workflow (W1/W2/W5), dopo che due agenti l'hanno violata il 15/9. Fatto = la regola compare nel testo REGOLE degli script. Chi: sessione CLI. Stima: piccola.

## Decisioni-di-Enzo (elenco a parte, nessuna azione presa)

- [registro #3] Come distinguere MATERIALIZZAZIONE da IMPORT nel confine strutturale (X-0) per `sys_user_kpi_evidence` e tabelle simili.
- [registro #13, #48] VACUUM manuale su `sys_position_skill_requirements` (tuple morte ricorrenti) — manutenzione, non mandato K.
- [registro #14] Cancellazione di `C:\Git\tmp_dove.txt`.
- [registro #20] Quale delle 3 vie (a/b/c) per il fattore TOTP di collaudo che il clone notturno del gemello cancella ogni notte.
- [registro #23] Allineare `GDPR_MANDATE_ROLES` al permesso RBAC, o restringere il permesso.
- [registro #26, #42] Costruire il gesto applicativo che scrive OKR check-in/key-results (classificazione già decisa).
- [registro #27] Costruire la superficie self per `sys_platform_user_tenant_assignments`, o dichiarare l'esclusione motivata.
- [registro #31, #32, #33, #36, #44, #46] Sei proposte di dottrina livello-utente/canale (guardiano.py cwd-indipendente da `--session`, freno canale su chiusura dichiarata, hook su exit 3, fonte fresca per 5h headless, contatore su finestra vs consecutività, riconoscimento tool_progress) — fuori dal perimetro di questo repository, per Cowork/Enzo. Nota: #44 e #46 risultano di fatto già realizzate nel canale (v. TRG-2 C-2, B-3) — la proposta originale nel registro va quindi letta come superata nella pratica, pur restando "non applicata in questo repo" per costruzione.
- [registro #37] Riparare l'ACL vuota di `heuresys_ci` sulla VM, o ritirarlo come nome fuorviante; decidere se la VM merita un DB di test separato da produzione.
- [registro #38] Lock cross-sessione lato gemello per `prova-api-sul-gemello.sh`.
- [registro #39] Quale comando può rieseguire una singola migrazione self-healing isolata, senza riapplicare l'intera catena.
- [registro #50] Opt-in esplicito ("ultracode") per eseguire `W5_presenze.js` col disegno multi-agente originale.
- [registro #53] Un comando unico che applichi la migrazione ai tre bersagli del gemello (heuresys_ci, DB persistente, VM).
- [registro #55] Riavviare il servizio del runner CI, o allineare il suo drop-in alla chiave `.secrets` in uso.
- [piano E-3] Il numero cinque del limite di catena diventa configurabile (condizione: solo dopo che E-2 è stato visto scattare — lo è).

---

## TRG-4 — Commit e cancello

Committato con messaggio in `.zp/msg_commit/`, pushato, `verify_gate.py run` eseguito su HEAD finale.
