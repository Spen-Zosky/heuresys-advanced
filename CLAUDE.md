# CLAUDE.md — heuresys-advanced

## Che cos'è

Heuresys Advanced HRMS/BPM Platform v5: monorepo pnpm. API Fastify 5 su PostgreSQL 16 con contratti Zod condivisi con l'SPA di amministrazione Next.js 16 e il portale ESS. Baseline `v1.0.0` GA dal 2026-06-02. La VM gira in modalità produzione (API `node dist/server.js`, web `next start`).

I conteggi (moduli, migrazioni, endpoint, test, permessi) non stanno qui perché cambiano: si ricavano da `docs/kb/SOT_STATE.md`, che li rigenera. Lo stesso vale per ogni dato che varia: prima di usarlo si misura, e nei documenti si scrive il comando che lo produce, non il numero.

I dati sono produzione reale. Esiste un solo ambiente, di produzione, con due tenant: RTL Bank (un cliente modello, con il dataset popolato) e Heuresys System (piattaforma) — ADR-0026. L'ingestione dal vecchio `heuresys-evo` è chiusa dal 2026-08-14 (ADR-0038): ciò che manca si costruisce o si ricava da `sys.*`; il legacy si consulta per i concetti, mai per le righe (`python docs/kb/tools/check_no_legacy_ingest.py`). Un dato si descrive per ciò che è (una busta paga, un IBAN), senza etichette rassicuranti tipo «sintetico» o «senza PII».

## Quando un lavoro è finito

Un passo si chiude solo con una dimostrazione dal vivo su dati reali: comando, output, percorso e orario (ADR-0026). Un test verde o un mock che funziona significano «in corso». Per le pagine autenticate la dimostrazione è un login con una persona reale del tenant e l'uso secondo il suo profilo. Se manca un input che solo Enzo può dare, lo stato è `blocked-on-Enzo: <cosa, perché>`. Nessun mock, fixture o endpoint finto nel frontend: ogni dato arriva da una chiamata `/v1/*` reale.

## Fonti di verità

- Stato: `.handoff/STATE.md` (vista rapida) e `docs/kb/SOT_STATE.md` (dettaglio), riscritti dalla skill `handoff` a fine sessione. Backlog: `docs/kb/SOT_BACKLOG.md`. Debiti: `docs/kb/DEBT_REGISTER.md`. Percorsi: `docs/kb/INDEX_PATHS.md`. Prodotto: `docs/product/`. Non si creano altri file di stato.
- Stati di una voce (insieme chiuso): `ACTIVE`, `GATED`, `WAIT-INPUT`, `HOLD`, `INTERRUPTED`, `DONE`/`FATTO`/`WON'T-DO`. Il controllo di integrità è `docs/kb/tools/handoff_lint.py`.
- Chi scrive: l'unico che scrive e committa `docs/kb/` è Claude Code CLI. Cowork scrive solo in fondo a `docs/kb/COWORK_INBOX.md` (una voce datata `### YYYY-MM-DD | tipo | titolo`); la CLI la riconcilia e la marca `stato: [RICONCILIATA <commit>]`. Su questo progetto non si usano `cowork_code_exchange/` né le skill `cowork-cli-protocol`/`cowork-cli-orchestrator`. Voci aperte: `python docs/kb/tools/check_canale_cowork.py`.

## Avvio di sessione

Il primo messaggio sceglie la modalità (`docs/kb/xtras/SESSION_MODES.md`): `avvia sessione` apre una sessione canonica; `avvia sessione lab` una sessione di sola analisi in parallelo, con scritture bloccate e artefatti in `<cartella superiore>/heuresys-design-lab/`, senza menu. Qualunque altro messaggio vale come canonica.

In una sessione canonica, se il primo messaggio non nomina già un compito, costruisci il menu con `python docs/kb/tools/session_start.py` (menu dal register e cruscotto di salute), aggiungi i debiti e le voci di roadmap che il register non copre, metti in cima le voci `INTERRUPTED` e chiedi: «Scegli #, aggrega (es. 1+4), o nuovo». Non leggere interi `SOT_BACKLOG.md`, `SOT_STATE.md` e `DEBT_REGISTER.md` all'avvio: lo script li riassume, e si aprono solo sulla voce scelta.

Il programma `project-dream` (`docs/vision/**`) e i `.programmi/**` hanno sessioni dedicate: una sessione con un altro mandato non li prende in carico; se un controllo segnala un rosso nato da quei file, manda un messaggio alla sessione dedicata e prosegui nel tuo perimetro.

## Dove si esegue il lavoro sul database

Il database di produzione è sulla VM Oracle; il linux-pc ne tiene una copia (il gemello); Windows ci arriva via tunnel, quindi da qui i lavori pesanti costano due ordini di grandezza in più.

| lavoro | dove | comando |
|---|---|---|
| provare una migrazione | gemello, su copia usa-e-getta | `bash db/scripts/prova-idempotenza.sh` |
| prova generale della CI, prima di pushare un tocco a `db/` | gemello | `ssh linux-pc 'cd ~/heuresys-advanced && bash db/scripts/ci-rehearsal.sh'` (circa 26 s) |
| applicare alla produzione | VM | `pnpm db:migrate:vm` |
| validare lo schema | gemello | `pnpm db:validate:vm` |
| test di integrazione API | gemello | `pnpm test:api:vm` |
| altro lavoro pesante | gemello o VM | `bash db/scripts/sul-gemello.sh '<cmd>'` (`HOST=oracle-vm-default` per la VM) |
| leggere, interrogare, diagnosticare | Windows, via tunnel | `psql`, `db_health.py`, i `check_*.py` |

Questi comandi escono rossi se l'host non risponde e non ripiegano su Windows. Se un'operazione sul database è molto più lenta del previsto, chiediti se la stai eseguendo nel posto sbagliato. Tunnel: `ssh -fN -L 5433:localhost:5432 oracle-vm-default`; il runtime attivo è l'opzione B di `.env.example` (VM, tunnel 5433).

## Comandi non ovvi

| cosa | comando |
|---|---|
| un file di test | `cd apps/api && pnpm exec vitest run test/<name>.integration.test.ts` |
| suite E2E web completa | `cd apps/web && pnpm test:e2e:prod` (su Node ≥ 23: `pnpm test:e2e:prod:node22`) |
| typecheck dei test | `cd apps/api && pnpm typecheck:test` |
| reset del DB (distruttivo) | `pnpm db:reset`, solo con il sì di Enzo |
| storia RTL 36 mesi | `bash db/scripts/storia36.sh custodia` / `avanzamento` (skill `storia36-custodia`) |
| rigenerare l'atlante | `python docs/kb/tools/build_atlas.py` |
| perimetri dell'agente | `python docs/kb/tools/check_concetti_agente.py` |
| cruscotto completo | `pnpm status` |
| plancia web | `pnpm plancia` (:8481); `pnpm plancia:zp` (:8477) è l'unica che agisce |

Gli script PowerShell sono quelli canonici su Windows; i gemelli `.sh` servono in bash e via SSH. Gli script in `db/scripts/` sono idempotenti.

## Invarianti

Si cambiano solo con un nuovo ADR. Se un requisito sembra contraddirli, fermati e chiedi.

- I1: il modello è centrato sulla posizione, non sul dipendente; proprietario della posizione e titolare sono distinti.
- I3/I4: le tabelle di business stanno in `sys.sys_<plurale>`; gli schemi ausiliari sono `staging`, `reference_sync`, `audit`.
- I5: isolamento dei tenant con FK e filtro nel middleware dell'API; mai RLS.
- I7: l'autenticazione è separata da `sys.sys_users`, nelle tabelle `sys.sys_auth_*`.
- I9: il PIP è una VIEW o MATERIALIZED VIEW, mai un blob JSONB (ADR-0008).
- I13: PostgreSQL 16 nativo, niente Docker nel runtime (ADR-0004, ADR-0010).
- RD-08: campi categorici `varchar(N) + CHECK`, mai ENUM di PostgreSQL. RD-09: `date` per le sole date, `timestamptz` solo quando serve l'ora.
- I12: niente import dal legacy (ADR-0038). I14: nel legacy l'entità persona è `employees`, non `users` (ADR-0024, `docs/brownfield/EMPLOYEE_CENTRIC_MAPPING_DOCTRINE.md`).
- ADR-0011: l'ESS (`/me/*`, `/v1/me/*`) vive in un modulo dedicato.
- I15: un solo ambiente di produzione con due tenant (ADR-0026).
- I16–I20, I22: accesso come intersezione di perimetro gerarchico (albero delle unità) e modalità funzionale `edit/read/mask/none`; ognuno vede i propri dati; i dati sensibili altrui solo per catena organizzativa; chi è a capo di una catena vede tutto ciò che le sta sotto e niente delle catene sorelle; i mandati HR (`TENANT_ADMIN`, `HRMS_MANAGER`) vedono tutto il tenant salvo le cinque eccezioni di ADR-0036 §5; `PLATFORM_ADMIN` è un mandato tecnico e vede `COMPENSATION`/`EVALUATION` mascherate (`apps/api/src/lib/scope/mask.ts`); `DPO` ha il perimetro tenant-wide mascherato. Dettaglio in ADR-0036 e ADR-0032.
- I21: i dati che derivano dall'industria di un tenant sono coerenti con essa; le tassonomie (ESCO, ISCO, NACE, ATECO, CCNL, modelli operativi) restano aperte a tutte le industrie.
- I23: ogni tabella di dati del cliente è nativa, importata o ibrida (ADR-0041).

## Lavorare sui dati e sul codice

Il database e il codice portano strati di due anni di costruzione, e il residuo va bonificato: servono strumenti per modificare in profondità, con prudenza e possibilità di tornare indietro.

- Prima di toccare un oggetto condiviso (tabella, colonna, vista, script, seed, anche un database di collaudo) esegui `python docs/kb/tools/chi_sorveglia.py <nome>`: elenca sentinelle, cancelli, test, altri scrittori e il file che lo crea. Dice chi guarda, non se puoi toccarlo.
- Ritirare non è cancellare (ADR-0035): la catena delle migrazioni si riapplica a ogni deploy, quindi si emenda il file che crea l'oggetto (o lo si marca `-- @migrate: once`) e solo in aggiunta si rimuove l'esemplare esistente.
- Una scrittura di massa porta la misura prima, una guardia che ricontrolla la precondizione al momento dell'esecuzione, una post-condizione su ciò che non doveva cambiare e un rollback dichiarato (giornale `staging.*_undo` o la ragione per cui non c'è). Quando si cancella, l'elenco è esplicito.
- Le prove che cancellano, sovrascrivono o rigenerano girano su una copia usa-e-getta, mai sull'originale: `heuresys_ci` è il database della CI e può avere una corsa in volo.
- Un seed porta a uno stato dichiarato, invece di adattarsi a ciò che trova; un seed che impone uno stato ha una guardia a due condizioni (l'ambiente lo dichiara e il nome del database dice che è di collaudo).
- Una prova nuova si vede rossa prima e verde dopo. Quando correggi un rosso in una batteria, rilanciala: spesso ne compare un altro che il primo nascondeva.

Frontend: i componenti UI riutilizzabili e le dipendenze UI di runtime (Radix, framer-motion, recharts…) vivono nel repo `ux-design-shared` (`@heuresys/ui`), non qui. Dottrina in `.claude/rules/design-system-ui.md` e `.claude/rules/frontend-live-data.md`.

TypeScript: `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters` attivi (i parametri inutilizzati si prefissano con `_`); `exactOptionalPropertyTypes` è spento di proposito. Il lavoro su un modulo API segue il pattern in 7 passi con un commit atomico. Stile dei commit: `feat(api): …`, `chore(db): …`, `docs(handoff): …`, `test(api): …`.

## Git, CI e rilascio

- Commit e push su `main` sono autorizzati in ogni sessione: pubblicare ogni pezzo chiuso lo mette al sicuro e fa partire la CI, e non tocca la produzione, perche' il deploy parte solo da `refs/heads/prod`. Muovere `refs/heads/prod` e propagare restano decisioni di Enzo.
- Una CI rossa si corregge; `gh run list` e `gh run watch` danno l'evidenza.
- Il rilascio lo decide Enzo. `scripts/close-propagate.sh` arma il deploy (`refs/heads/prod`) e ritorna; il rollout lo fa `heuresys-advanced-deploy-watch.timer` quando la CI è verde (ADR-0028). Dopo la chiusura si dice «armato», non «deployato», e si legge l'esito con `scripts/verifica-deploy.sh` (DEPLOYATO, IN-VOLO, CI-ROSSA, DISALLINEATO, NON-VERIFICATO). La verifica lunga di chiusura gira sul linux-pc: propaga, rinfresca il clone (`scripts/clone-vm-db.sh`), verifica lì (skill `full-alignment-deploy`).
- `.codex/`, `.codex-review/`, `.agents/` e `AGENTS.md` sono il canale di audit di Codex: non sono file da pulire né da mantenere, e non si usano le sue credenziali (`.codex-review/service/access/`).

## Cosa non toccare

`.env`, `.secrets/`, `*.pem`, `*.key` (segreti, gitignored); `docs/source_bundle/brownfield/extracted/` e `docs/brownfield/_inspection_artifacts/` (generati, non si committano); `node_modules/`, `dist/`, `.next/`, `*.tsbuildinfo`; il codice legacy in `D:\evo.heuresys.com\` e `/home/ubuntu/heuresys-evo` (solo lettura, senza committare percorsi assoluti).

## Dove sta il resto

| cosa | dove |
|---|---|
| pattern dei moduli API | `.claude/rules/api-module-pattern.md` (si carica in `apps/api/**`, `packages/shared/**`) |
| sicurezza e autenticazione | `.claude/rules/security-auth.md` |
| migrazioni | `.claude/rules/db-migrations.md` |
| test | `.claude/rules/tests.md` |
| design system e dati vivi nel frontend | `.claude/rules/design-system-ui.md`, `.claude/rules/frontend-live-data.md` |
| allineamento cloni e deploy | skill `full-alignment-deploy` |
| autonomia specifica del progetto | `docs/kb/xtras/AUTONOMY_R23_PROJECT.md` |
| regole fatte rispettare dal motore (git, segreti, cancellazioni, scritture sul DB vivo) | plugin `enzo-guard` (`D:\claude-imbracatura\plugin\enzo-guard\`), regole del progetto in `.claude/enzo-guard.json`; non vale in Cowork |
| perché esistono queste regole | `docs/kb/xtras/PERCHE_LE_REGOLE.md` |
