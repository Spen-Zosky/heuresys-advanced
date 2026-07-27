# RTL Bank — 36 mesi di storia: piano di popolamento integrale del DBMS

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (esecuzione per cluster, sessione per sessione). Gli step usano checkbox (`- [ ]`); lo stato vivo è in `.storia36/PROGRESS.md`, NON qui.

**Goal:** ogni tabella del DBMS popolata in modo armonico e coerente per il tenant RTL Bank, con 36 mesi di storia d'uso (2023-08-01 → 2026-07-31) trattata come reale (ADR-0026), verificata da una batteria di coerenza eseguibile.

**Architecture:** lavoro per **cluster di business** (non per tabella): ogni cluster attraversa le tabelle specializzate che insieme raccontano un ciclo (obiettivi→check-in→valutazioni; contratti→presenze→buste paga→variabile; …). Ogni cluster segue lo stesso ciclo in 6 passi: analisi schema+codice+API → ricerca dominio → post-condizioni SQL PRIMA dei dati (falliscono oggi: sono la spec) → seed idempotente → doppia esecuzione provata → verifica live E2E + commit atomico. La conoscenza si estrae dal DB/codice/API, mai dalla doc (feedback `code_over_docs`).

**Tech Stack:** PostgreSQL 16 via tunnel :5433 · seed SQL idempotenti (pattern `db/seeds/rtl-rebuild/`) + generatori TS (`tsx`, pattern `db/scripts/seed-test-admin.ts`) · `uuid_generate_v5` per id deterministici · WebSearch/WebFetch (+ Apify `rag-web-browser` se serve) per la ricerca dominio · Agent Explore per gli sweep schema/codice · vitest + Playwright per la rete di sicurezza.

## Contesto per chi parte da zero

Mandato di Enzo (S1033, 2026-07-27): il DBMS deve rappresentare dati che la piattaforma gestisce già da tempo — siamo in fase di presentazione a potenziali clienti e investitori; un solo tenant (RTL Bank) va bene, ma per quel tenant e i suoi utenti la storia deve esserci. Fattispecie di dominio (es. come funziona il premio variabile di una banca) si **ricercano sul web**, non si inventano.

**Decisioni già prese da Enzo — NON richiedere:**
| Decisione | Valore |
|---|---|
| Profondità storica | **36 mesi**: 2023-08-01 → 2026-07-31 |
| Carattere del periodo | crescita moderata e stabile |
| Discontinuità | UNA riorganizzazione a metà periodo (effective **2025-03-01**) |
| Aree delicate (whistleblowing, GDPR, respinte, uscite) | popolate a volumi bassi e realistici, nessun caso drammatico |
| Pubblico | bilanciato investitore/cliente, leggermente a favore del cliente |
| Rete di sicurezza | dump completo PRIMA di qualsiasi scrittura |

**Stato misurato (audit S1033, non fidarsi — rimisurare al C0):** 206 tabelle `sys.*`, 37 vuote, 16 con 1-5 righe, 448.558 righe totali. Copertura per-utente 96-99% sulle dimensioni core. 162 utenti attivi (161 RTL + `admin@heuresys.com` service account, l'unico senza posizione). Assunzioni reali 2003→2024 (le assunzioni 2023-08→2024-12 CADONO nella finestra: sono la narrativa di crescita — **non si creano utenti nuovi**, la popolazione è chiusa). Incoerenza nota: buste paga → 2026-06 ma presenze → 2025-12-08.

## Global Constraints

- **ADR-0026 / OUTPUT RULE**: i dati si trattano e si descrivono come reali; vietato il qualificatore "synthetic/no-PII/safe-to-publish".
- **Invarianti I1-I20** (CLAUDE.md): position-centric (owner ≠ incumbent, l'occupazione vive in `sys_user_position_assignments`); tenant isolation via FK+middleware, MAI RLS; bi-assiale I16-I20 (org gates sensibile, funzionale MAI).
- **RD-08**: categorie = `varchar + CHECK`, MAI ENUM · **RD-09**: `date` per date-only.
- **Id deterministici** = `uuid_generate_v5(ns, chiave)` con namespace fisso storia36; **MAI** `md5()::uuid` (memoria `reference_deterministic_seed_uuid_rfc4122`: zod4 rifiuta → 500 sul read).
- **Idempotenza twice-run**: ogni seed rieseguito due volte → delta 0. Ogni seed ha post-condizioni fail-loud in coda.
- **Provenance**: ogni run di seed si registra in `staging.storia36_runs` (tabella creata al C0). Chiavi naturali con prefisso `STORIA36::` dove esiste una colonna external-code.
- **Vincoli esistenti da NON violare**: CCNL floors (`seed_ccnl_floors.sql`, S1025) · straordinari QD/Dirigente esenti + NIGHT solo IT-ops (S1028) · invariante offboarding mig 000188 · RACI 105 righe (`54_raci_*`) · il custode whistleblowing è andrea.martino (mig 000205).
- **Timestamp storici**: la scrittura via API imprime `now()` — quindi **storico = SQL che replica esattamente la macchina a stati del service** (validata dalle post-condizioni), **recente (ultime ~2 settimane) = via API reale** dove esiste una logica applicativa (approvals). Mai stati che il codice non potrebbe produrre.
- **Gate esterni**: `sys_process_participants` resta VUOTA (attende decisione RACI di Enzo — register #24); non aggirare.
- **Dati personali oltre la finestra**: nessun record con data > 2026-07-31; nessun evento per-utente precedente alla sua `hire_date`.
- **Ambiente**: UNO solo ed è produzione. Blocchi reversibili, dump preventivo, `pnpm db:validate` verde dopo ogni cluster.
- **Test**: la suite non deve MAI dipendere da conteggi esatti pre-storia (feedback `no_hardcoded_test_data`); la guardia `actors-profile.integration.test.ts` (9 profili) deve restare verde dopo ogni cluster.
- **`docs/kb/DATA_PATTERNS.md`**: ogni cluster vi registra i pattern riusabili scoperti (registro nato S1032).

## Verifica su quattro assi (vincolante per OGNI cluster — aggiunto su domanda di Enzo, S1033)

I tre strati originari (post-condizioni per cluster · batteria globale G1-G6 · audit C12) sono
**verticali**: provano che ogni ciclo sia coerente al suo interno. Non bastano. Quattro assi:

1. **Asse orizzontale — i DOSSIER per-entità** (precisazione di Enzo, S1033: la persona è UNA
   istanza di una classe generale). Ogni entità che AGGREGA altre entità è un dossier che deve
   reggere letto per intero. Il registro dei dossier **non si elenca a mano: si DERIVA dal grafo
   delle FK** (`pg_constraint` — le entità-hub sono quelle su cui convergono famiglie di
   riferimenti), perché un elenco a mano vale quanto la fantasia di chi lo scrive — è l'anti-pattern
   AP-03 già pagato dal progetto (il gate GDPR che guardava 74 FK su 248 filtrando per nome).
   Deliverable C0: `docs/kb/storia36/DOSSIER_REGISTRY.md` + query di derivazione + **check di
   completezza falsificabile**: ogni tabella `sys.*` appartiene ad ALMENO un dossier — una tabella
   non mappata = registro ROSSO. Dossier attesi dalla derivazione (verificare, non assumere):
   - **Persona** (`verify-storia36-person.sql`, 162/162 mai a campione): età alla nomina >= minimo
     del ruolo · fine studi <= inizio prima esperienza · progressione senza salti implausibili ·
     retribuzione nella banda dell'inquadramento CCNL E coerente con la seniority · skill ⊇
     requisiti posizione · certificazioni obbligatorie valide · valutazioni per ogni anno di
     presenza. Esempio-guida: il Direttore Crediti regge il dossier INTERO come una storia unica.
   - **Processo di business** (esempio-guida di Enzo): il processo definisce le OU responsabili e i
     ruoli aggregati attorno → ogni OU referenziata ESISTE ed è nella struttura corrente · ogni
     ruolo/responsabilità del processo è assegnato a uno user ATTIVO · il tutto si rispecchia
     nell'organigramma (l'owner sta in una OU responsabile del processo) · KPI template del
     processo → requisiti delle posizioni coinvolte.
   - **Unità organizzativa**: manager definito · posizioni afferenti con titolare o vacancy
     dichiarata · responsabilità di processo · history continua (C6).
   - **Posizione**: requisiti (skill/KPI/learning) · comp profile · incumbent · riporto · rilevanza
     successoria · il PIP (vista) coerente con le sue sorgenti.
   - **Team**: lead singolo in sync con la membership · membri = utenti attivi · derivazione da OU.
   - **Cascata KPI** (dossier di catena): definizione → template processo/OU → requisito posizione
     → target utente → misurazioni, coerenti a ogni gradino della discesa.
   - **Tenant**: ogni riga di ogni dossier dentro il perimetro (I5).
   Le batterie vivono in `db/scripts/verify-storia36-dossier.sql` (una sezione per dossier); ogni
   cluster esegue le batterie dei dossier che TOCCA, e il C6 (riorg) ri-esegue i dossier di TUTTE
   le entità toccate dalla trasformazione — le rotture da cascade nascono lì.
2. **Review adversarial a fine cluster**: TRE revisori indipendenti col mandato di DEMOLIRE
   l'evidenza (modello zero-pending, che ha già demolito evidenze in S1030/S1032/S1033), lenti
   distinte: (a) coerenza temporale · (b) realismo di dominio bancario (con la ricerca in mano) ·
   (c) integrazione cross-cluster + dossier di K persone estratte a caso lette per intero.
   Rilievi confermati = si correggono PRIMA di chiudere il cluster.
3. **Self-test di ogni check** (feedback `evidence_must_be_falsifiable`): per ogni post-condizione
   nuova, iniettare in transazione una violazione deliberata → il check DEVE scattare → rollback.
   Un check mai visto fallire non prova nulla. Il self-test vive in coda a `verify-storia36.sql`
   (sezione `-- SELFTEST`, eseguita con flag psql `-v selftest=1`).
4. **Riconciliazione degli aggregati** (C8 per engagement, C12 per tutto): i numeri che le
   dashboard/analytics servono via API vengono RICALCOLATI dalle righe sottostanti e confrontati
   (headcount per trimestre, media engagement per ciclo, distribuzione comp per banda): un
   aggregato che non torna con le proprie righe è il primo posto dove un occhio attento scava.

Nel ciclo dei cluster, questi assi entrano così: lo Step "post-condizioni" di ogni cluster include
le asserzioni per-persona pertinenti + il self-test; dopo lo step "live" e PRIMA del commit si
esegue la review adversarial (passo 7 implicito di ogni Task). PROGRESS registra i rilievi.

## Ripetibilità: tre modi (richiesta di Enzo, S1033 — il processo non è una tantum)

Il DBMS evolve: il processo deve poter essere RI-lanciato in sessioni successive per verificare se
tutto regge ancora e riparare le rotture. Tre modi, un solo punto d'ingresso:

- **`bash db/scripts/storia36.sh costruzione`** — l'esecuzione C0→C12 di questo piano (una tantum;
  internamente = i seed dei cluster nell'ordine, ognuno già idempotente).
- **`bash db/scripts/storia36.sh custodia [--repair-missing]`** — ri-esegue TUTTE le batterie
  (globale + dossier + persona + aggregati) sul DB com'è OGGI e produce un report
  (`qa_artifacts/storia36/custodia-<data>.md`) con **triage obbligatorio a tre esiti** per ogni
  check rosso: (a) **dato mancante** → `--repair-missing` ri-esegue il seed pertinente (idempotente:
  ricrea SOLO ciò che manca, `ON CONFLICT DO NOTHING`); (b) **asserzione troppo rigida** smentita
  da un'evoluzione legittima → si corregge il CHECK, non il dato (con nota nel report); (c)
  **rottura vera** → item di riparazione nel register. MAI riparazione automatica di righe
  modificate: il registro di provenienza `staging.storia36_runs` + le chiavi `STORIA36::` dicono al
  triage cosa era seminato e cosa è organico.
- **`bash db/scripts/storia36.sh avanzamento`** (opzionale, mensile) — estende la storia al mese
  corrente (presenze, buste, handoff payroll, approvazioni del mese nuovo, pulse) così la demo non
  invecchia: la finestra diventa MOBILE (start fisso 2023-08-01, end = fine mese precedente).

**Vincolo di progettazione che ne discende (vale da C0 in poi):** ogni check è un'ASSERZIONE DI
PROPRIETÀ, mai una fotografia — niente conteggi esatti attesi, e la fine-finestra è un PARAMETRO
(`psql -v window_end=...`, default = fine mese precedente), non una costante nei check: altrimenti
la prima custodia su un DB vivo segnalerebbe come rottura l'evoluzione legittima. Il check G1
("nessun record oltre la finestra") in custodia usa il parametro corrente.

**Schedulazione (deliverable C12):** la custodia entra nel pattern operativo esistente — timer
systemd sul linux-pc (dopo il refresh settimanale del clone, rif. Z-022/Z-253) con `OnFailure` nel
registro dei job che il dashboard di sessione già legge (pattern Z-015, oggi 9 job): una rottura
della storia si presenta al boot della sessione successiva, non quando qualcuno se ne accorge in demo.

## Bootstrap della fresh session (ogni sessione del programma)

```bash
# 1. infra (se il boot hook non l'ha già fatto)
ssh -fN -L 5433:localhost:5432 oracle-vm-default
# 2. stato del programma — la SOLA fonte di avanzamento
cat .storia36/PROGRESS.md
# 3. riprendi dal primo cluster non spuntato; a fine sessione aggiorna PROGRESS + commit
```

Regola di ripresa: **un cluster non si lascia a metà** — se il contesto sta finendo, chiudere il passo in corso, marcare `INTERROTTO al passo N` in PROGRESS con l'evidenza, committare.

---

### Task C0: Fondazioni — dump, registro, batteria di coerenza, calendario

**Files:**
- Create: `.storia36/PROGRESS.md` (già creato insieme a questo piano)
- Create: `db/seeds/storia36/00_foundation.sql`
- Create: `db/scripts/verify-storia36.sql`

**Interfaces — Produces:** `staging.storia36_runs` (registro provenance) · `staging.storia36_calendar` (giorni lavorativi IT 2023-08→2026-07) · funzione-convenzione per gli id: `uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'STORIA36::<cluster>::<chiave-naturale>')` · batteria `verify-storia36.sql` che ogni cluster estende.

- [ ] **Step 0.1: dump completo (fuori repo)**
```bash
mkdir -p /c/Users/enzospenuso/heuresys-backups
pg_dump -h localhost -p 5433 -U heuresys -d heuresys_advanced -Fc \
  -f /c/Users/enzospenuso/heuresys-backups/pre-storia36.dump
ls -la /c/Users/enzospenuso/heuresys-backups/   # attesi >100MB
```
- [ ] **Step 0.2: rimisura la baseline** (l'audit S1033 può essere invecchiato): riesegui il conteggio 206-tabelle/37-vuote (query `pg_class`+`query_to_xml` nell'audit S1033, ricostruibile: count reale per ogni relazione `sys.*` relkind='r') e salva l'output in `.storia36/baseline-YYYYMMDD.txt`.
- [ ] **Step 0.3: `00_foundation.sql`** — idempotente, crea in `staging`:
```sql
CREATE TABLE IF NOT EXISTS staging.storia36_runs (
  run_id        uuid PRIMARY KEY,
  cluster_code  varchar(8)  NOT NULL,          -- 'C1'..'C12'
  seed_file     text        NOT NULL,
  rows_written  bigint      NOT NULL,
  executed_at   timestamptz NOT NULL DEFAULT now(),
  twice_run_delta bigint    NOT NULL            -- DEVE essere 0 alla seconda corsa
);
CREATE TABLE IF NOT EXISTS staging.storia36_calendar (
  cal_date date PRIMARY KEY,
  is_workday boolean NOT NULL,                  -- lun-ven MENO festività IT + patrono
  holiday_name text
);
-- popola 2023-08-01..2026-07-31 con generate_series; festività nazionali IT
-- (1/1, 6/1, Pasquetta 2024-04-01/2025-04-21/2026-04-06, 25/4, 1/5, 2/6,
--  15/8, 1/11, 8/12, 25/12, 26/12) + patrono della sede RTL (deciderlo dal
--  dato: città sede legale in sys_tenancies/OU — verificare al C0, non assumere).
```
- [ ] **Step 0.4a: registro dei dossier** — deriva le entità-hub dal grafo FK (`pg_constraint`: conta per ogni tabella le famiglie di tabelle che la referenziano), scrivi `docs/kb/storia36/DOSSIER_REGISTRY.md` (dossier → tabelle afferenti) e il check di completezza in `verify-storia36-dossier.sql`: `ogni tabella sys.* ∈ almeno un dossier`, ROSSO se una resta fuori. Confronta l'esito della derivazione con l'elenco atteso nella sezione "Verifica su quattro assi": ogni differenza va capita, non zittita.
- [ ] **Step 0.4: `verify-storia36.sql` v1** — la batteria globale (fallisce = `RAISE EXCEPTION` in blocchi `DO`). Checks iniziali, tutti scrivibili ORA:
```sql
-- G1: nessun record oltre la finestra (per ogni tabella con colonna data nota)
-- G2: nessun evento per-utente prima della hire_date (attendance, pay_slips,
--     goals, reviews, learning_evidence, pulse_checks vs sys_user_employment)
-- G3: parità busta↔presenze: ogni mese con pay slip ha >=1 giorno di attendance
--     nel mese per lo stesso utente (esenti esclusi secondo regole S1028)
-- G4: sequenzialità: created < resolved (approvals), start <= end (contracts,
--     assignments), goal start < due
-- G5: le 6 viste strutturali di integrità = 0 righe (pnpm db:validate)
-- G6: staging.storia36_runs: ogni cluster chiuso ha run con twice_run_delta=0
```
- [ ] **Step 0.5: esegui foundation due volte + verify** — `psql -v ON_ERROR_STOP=1 -f db/seeds/storia36/00_foundation.sql` ×2, poi `-f db/scripts/verify-storia36.sql`: G1-G6 devono già passare sul dato attuale **tranne G3** (l'incoerenza nota buste/presenze): G3 va scritto e lasciato ROSSO — è la prima post-condizione che C1 farà diventare verde.
- [ ] **Step 0.5b: entrypoint `db/scripts/storia36.sh`** — nasce SUBITO con i tre modi (costruzione/custodia/avanzamento; i modi non ancora implementati falliscono ESPLICITI con "non ancora disponibile — cluster X richiesto", mai in silenzio). La custodia funziona da subito sui check esistenti: ogni cluster successivo la arricchisce senza toccarne l'interfaccia. Finestra SEMPRE via parametro (`-v window_end=`), default = fine mese precedente.
- [ ] **Step 0.6: commit** `feat(db): storia36 C0 — fondazioni (registro, calendario, batteria di coerenza, entrypoint)` + spunta C0 in PROGRESS.

### Task C1: Coerenza dell'esistente — presenze, assenze, ferie (backfill + forward-fill)

**Files:** Create: `db/seeds/storia36/01_attendance_timeoff.sql` · Modify: `db/scripts/verify-storia36.sql` (G3 diventa verde + check C1)

**Obiettivo:** presenze per tutti i non-esenti su TUTTA la finestra (backfill 2023-08-01→2024-09-30, forward 2025-12-09→2026-07-31); `time_off_requests`/`balances` multi-anno (maturazione/goduto/residuo per anno, ferie estive + natalizie realistiche); busta 2026-07.

- [ ] **Step 1.1: analisi** — schema reale di `sys_attendance`/`sys_time_off_*` (colonne, CHECK, pattern delle righe esistenti: `SELECT * ... LIMIT 20` su mesi già popolati) + come le legge l'API (`apps/api/src/modules/` attendance/time-off) — le righe nuove devono essere indistinguibili da quelle esistenti.
- [ ] **Step 1.2: regole già in casa** — rileggi `seed_residual_user_coherence.sql` (S1028): straordinari QD/Dirigente esenti, NIGHT solo IT-ops, 51 pattern corretti. Il backfill DEVE rispettarle (G-check dedicato).
- [ ] **Step 1.3: ricerca dominio** (prompt pronto): *"tasso di assenteismo medio settore credito Italia per anno 2023 2024 2025 (ABI, ISTAT, rapporti HR banche), giorni medi malattia per dipendente bancario, distribuzione ferie estive agosto chiusure sportelli"* → parametrizza densità assenze/malattia per ruolo.
- [ ] **Step 1.4: post-condizioni PRIMA del seed** — aggiungi a verify: C1a ogni utente attivo non-esente ha attendance in ogni mese della finestra dalla sua hire; C1b nessuna attendance in giorno non-workday senza flag straordinario; C1c balances: maturato-goduto=residuo per anno; C1d G3 verde. Esegui: devono FALLIRE.
- [ ] **Step 1.5: seed** — id `uuid_generate_v5` su `STORIA36::C1::<user>::<date>`; volumi: ~157 utenti × ~250 workday/anno; INSERT … ON CONFLICT DO NOTHING; run twice → delta 0 registrato in storia36_runs.
- [ ] **Step 1.6: verifica live** — API su :3001, login persona reale (manager), pagina presenze/team con mesi 2023-2024 visibili; `pnpm db:validate`; vitest file attendance; spunta PROGRESS; commit `feat(db): storia36 C1 — presenze e assenze su 36 mesi`.

### Task C2: Performance — obiettivi, check-in, valutazioni, 360, calibrazione

**Files:** Create: `db/seeds/storia36/02_performance.sql` · Modify: verify (check C2)

**Obiettivo:** 3 cicli annuali completi (2023 H2 innesto, 2024, 2025) + 2026 in corso: `sys_goals`+`goal_check_ins` trimestrali → `sys_assessments`/runs → `sys_performance_reviews` → `sys_feedback_360_responses` → calibrazione. Distribuzione esiti realistica (curva ~10/70/20), correlata alla catena gerarchica reale.

- [ ] **Step 2.1: misura l'esistente** — range date attuali di goals/reviews/assessments (il recente c'è già: NON duplicare; il backfill si innesta PRIMA del primo record esistente per utente).
- [ ] **Step 2.2: analisi codice** — macchina a stati di assessment run/review in `apps/api/src/modules/` (assessments, performance): stati leciti, transizioni, chi scrive cosa; `sys_assessment_methods` (5 righe) e `sys_kpi_assessment_methods` come cataloghi.
- [ ] **Step 2.3: ricerca dominio**: *"ciclo di performance management banca retail italiana: calendario tipico (goal setting gen-feb, mid-year review giu-lug, year-end nov-dic), scala di valutazione 5 livelli distribuzione forzata, percentuale 360 nelle banche medie"*.
- [ ] **Step 2.4: post-condizioni** — C2a ogni utente attivo (hire permettendo) ha >=1 review per anno pieno; C2b ogni review year-end preceduta da >=2 check-in nell'anno; C2c reviewer = manager gerarchico reale alla data (usare la catena `position_reports_to`); C2d nessun 360 con reviewer==subject. FALLIRE prima, verde dopo.
- [ ] **Step 2.5: seed + twice-run + registro.**
- [ ] **Step 2.6: live** — login manager reale, storico valutazioni di un riporto su 3 anni visibile; commit `feat(db): storia36 C2 — tre cicli di performance`.

### Task C3: Compensation — premio variabile, adeguamenti, handoff payroll, buste storiche

**Files:** Create: `db/seeds/storia36/03_compensation.sql` + `docs/kb/storia36/DOMINIO_PREMIO_VARIABILE.md` (esito ricerca, con fonti) · Modify: verify

**Obiettivo:** il motore variabile configurato e USATO: `sys_reward_gates` + `sys_payout_curves` (configurazione), `sys_reward_gate_results` (3 esercizi), adeguamenti CCNL annuali coerenti coi floors S1025, `sys_payroll_handoff_records` (36 mensilità), buste paga backfill 2023-08→2025-08 + 2026-07 (generatore esistente `db/scripts/gen-pay-slips-seed.sql` come base).

- [ ] **Step 3.1: ricerca dominio (il cuore — prompt pronti, salvare esito con fonti nel doc DOMINIO):**
  - *"CCNL Credito premio variabile di risultato VAP banche italiane: indicatori tipici (utile lordo, cost/income, NPS, raccolta), soglie di accesso, importi medi per inquadramento 3A1-QD4, erogazione a giugno anno successivo"*
  - *"sistema incentivante MBO banca retail italiana ruoli commerciali: peso % su RAL per gestore/consulente/direttore filiale, curva di payout (soglia 80%, target 100%, cap 150%), gate di conformità"*
  - *"vincoli remunerazione variabile banche: disposizioni Banca d'Italia/EBA su risk takers, rapporto variabile/fisso, malus e claw-back"*
- [ ] **Step 3.2: analisi codice** — moduli comp/reward in `apps/api/src/modules/` (che shape hanno gates/curves/results; chi li legge in UI); `sys_position_compensation_profiles` esistenti come aggancio.
- [ ] **Step 3.3: post-condizioni** — C3a ogni mensilità nella finestra ha handoff record; C3b busta ⇒ presenze quel mese (G3 esteso all'indietro); C3c nessuna retribuzione sotto floor CCNL alla data; C3d result ⇒ gate+curve esistenti e coerenti (payout ∈ curva); C3e variabile erogato solo a giugno N+1 per l'esercizio N.
- [ ] **Step 3.4: seed + twice-run** (buste: riusare/estendere il generatore esistente con parametri storici).
- [ ] **Step 3.5: live** — login HRMS manager reale, distribuzione comp + storico buste di un utente 36 mesi; commit `feat(db): storia36 C3 — compensation e premio variabile su 3 esercizi`.

### Task C4: Formazione — iniziative, assegnazioni storiche, certificazioni

**Files:** Create: `db/seeds/storia36/04_learning.sql` · Modify: verify

**Obiettivo:** `sys_training_initiatives` (piani formativi annuali 2023/24/25/26 agganciati ai gap reali) + assignments/evidence distribuiti sulla finestra + certificazioni con scadenze (IVASS/antiriciclaggio rinnovate annualmente — verificare i moduli reali del catalogo S1025).

- [ ] **Step 4.1: analisi** — catalogo esistente (15 moduli S1025 + mapping skill→formazione), range date attuali di `user_learning_*` (il recente c'è: innestare all'indietro).
- [ ] **Step 4.2: ricerca**: *"ore di formazione annue per dipendente settore bancario Italia (ABI, bilanci sociali), formazione obbligatoria banche: antiriciclaggio, IVASS 30 ore, MiFID, D.Lgs 81 sicurezza, cadenze di rinnovo"*.
- [ ] **Step 4.3: post-condizioni** — C4a ogni utente ha ore/anno in un range realistico dalla ricerca; C4b obbligatorie rinnovate nei termini per i ruoli soggetti; C4c evidence date ∈ assignment window; C4d iniziativa ⇒ gap o requisito di ruolo che la giustifica.
- [ ] **Step 4.4: seed + twice-run + live** (login utente reale, `/me` formazione con storico) + commit `feat(db): storia36 C4 — formazione su 36 mesi`.

### Task C5: Carriera — esperienze pregresse, target, successione, mobilità

**Files:** Create: `db/seeds/storia36/05_career.sql` · Modify: verify

**Obiettivo:** `sys_user_professional_experiences` (carriere PRE-RTL coerenti con età/anzianità/ruolo — oggi il profilo di ognuno inizia all'assunzione), `sys_user_target_positions` + career plans, `sys_successor_readiness` (per le posizioni critiche esistenti), `sys_position_skill_requirement_history` (evoluzione requisiti, incl. delta della riorg C6).

- [ ] **Step 5.1: analisi** — anagrafiche reali (età, titoli S1028, hire) per vincolare le carriere pregresse; `sys_critical_positions` esistenti; succession pools attuali.
- [ ] **Step 5.2: ricerca**: *"percorso di carriera tipico banca italiana: teller→gestore→vice direttore→direttore filiale, anni per passaggio, mobilità interfunzionale sede/rete, employer precedenti tipici per profili risk/IT/legal in banche medie italiane"*.
- [ ] **Step 5.3: post-condizioni** — C5a esperienze pregresse: fine ultima esperienza <= hire RTL, nessun buco >18 mesi non spiegato, età coerente (prima esperienza >= 19 anni del soggetto); C5b ogni posizione critica ha >=1 successor con readiness; C5c target position ∈ stesso tenant e career path plausibile.
- [ ] **Step 5.4: seed + twice-run + live** (pagina carriera/successione con dati) + commit `feat(db): storia36 C5 — carriera e successione`.

### Task C6: Riorganizzazione 2025-03 — storia organizzativa e blueprint

**Files:** Create: `db/seeds/storia36/06_reorg.sql` · Modify: verify

**Obiettivo:** la discontinuità decisa da Enzo. La struttura ATTUALE (28 OU) è lo stato POST: la storia si costruisce all'indietro — `sys_organization_unit_history` registra lo stato PRE (es. due direzioni poi accorpate + una nata col riordino: scegliere dal dato reale quale trasformazione è più plausibile guardando le OU attuali), spostamenti di posizioni con assignments ENDED/ACTIVE coerenti, `sys_blueprint_activations`/`overrides` che documentano l'adozione del blueprint post-riorg (`sys_blueprint_families`/`variants` esistono con 1 riga).

- [ ] **Step 6.1: analisi** — albero OU attuale completo, posizioni per OU, date assignment esistenti a cavallo del 2025-03 (gli ENDED reali già presenti possono ancorare la narrativa).
- [ ] **Step 6.2: disegno della trasformazione** (CLASSE A, dal dato): scritto in 10 righe in testa al seed — quali OU nascono/muoiono, quali posizioni migrano, chi cambia riporto.
- [ ] **Step 6.3: post-condizioni** — C6a history: catena continua per ogni OU toccata (nessun periodo scoperto); C6b nessun assignment orfano a cavallo; C6c la gerarchia POST = esattamente l'attuale (il seed non deve MODIFICARE il presente, solo raccontare il passato); C6d G-check globali ancora verdi.
- [ ] **Step 6.4: seed + twice-run + live** (organigramma attuale invariato + storia visibile dove la UI la espone) + commit `feat(db): storia36 C6 — riorganizzazione 2025-03`.

### Task C7: Approvazioni e workflow — lo strato transazionale

**Files:** Create: `db/seeds/storia36/07_approvals.sql` + `db/scripts/storia36-approvals-live.ts` · Modify: verify

**Obiettivo:** `sys_approval_requests`+`steps` popolati su 36 mesi (approvazioni ferie, comp, formazione — agganciate ai record VERI dei cluster C1/C3/C4 via resource_type/resource_id) + `sys_process_kpi_templates` (cascata KPI sui processi esistenti — RACI 105 righe come aggancio) + `sys_notification_preferences` per tutti gli utenti.

- [ ] **Step 7.1: analisi** — handler approvals reale (S1022: "handler reale+testato, 0 persistiti"): macchina a stati esatta da `apps/api/src/modules/`, shape di steps/decision_policy.
- [ ] **Step 7.2: doppio binario** — STORICO via SQL fedele alla macchina a stati (created<resolved, step order, quorum policy rispettata); RECENTE (ultime 2 settimane, ~10 richieste) via API con `storia36-approvals-live.ts` (login con password derivata, pattern `seed-test-admin.ts`) così esiste traffico prodotto dal codice vero.
- [ ] **Step 7.3: post-condizioni** — C7a ogni approval risolta ha steps coerenti con la policy; C7b resource_id ESISTE nella tabella target (FK semantica); C7c volumi: ~0.5-1 richieste/utente/anno; C7d `sys_process_participants` ancora VUOTA (gate Enzo intatto).
- [ ] **Step 7.4: seed + script live + twice-run + live UI** (inbox approvazioni di un manager con storico) + commit `feat(db): storia36 C7 — approvazioni su 36 mesi`.

### Task C8: Engagement — cicli survey, azioni, clima con narrativa

**Files:** Create: `db/seeds/storia36/08_engagement.sql` · Modify: verify

**Obiettivo:** cicli survey semestrali sulla finestra (i template esistono; responses/pulse esistenti come innesto), `sys_engagement_action_plans` conseguenti ai risultati, trend del clima che RACCONTA: leggera flessione attorno alla riorg 2025-03, recupero nei trimestri successivi (crescita moderata e stabile).

- [ ] **Step 8.1: misura** — range/volumi esistenti (3792 responses, 862 engagement, 733+2101 pulse: COSA coprono già temporalmente).
- [ ] **Step 8.2: ricerca**: *"benchmark engagement score settore bancario Italia, eNPS medio banche, tasso di risposta survey interne, impatto riorganizzazioni sul clima (letteratura HR)"*.
- [ ] **Step 8.3: post-condizioni** — C8a >=2 cicli/anno con response rate 60-85%; C8b dip misurabile Q1-Q2 2025 e recupero (asserzione su medie per trimestre); C8c ogni ciclo con score sotto soglia ha action plan; C8d insights `recompute` gira dopo il seed (`POST /v1/insights/recompute` come in S1028) e rescoring documentato nel registro.
- [ ] **Step 8.4: seed + twice-run + live** (dashboard engagement con trend 36 mesi) + commit `feat(db): storia36 C8 — engagement e clima`.

### Task C9: Contenuti — handbook, policy, comunicazione interna

**Files:** Create: `db/seeds/storia36/09_content.sql` · Modify: verify

**Obiettivo:** `sys_content_categories`/`media` + versioni/review-publish storicizzati (handbook con revisioni annuali, policy aggiornate post-riorg, comunicazioni). Il modulo content esiste ed è testato; i vuoti sono categories/media.

- [ ] **Step 9.1: analisi** — shape content_documents/versions esistenti (1 riga: modello), workflow publish reale nel modulo.
- [ ] **Step 9.2: contenuti da scrivere** — 8-12 documenti da banca vera: codice etico, policy ferie, smart working, spese, sicurezza, whistleblowing procedure, welfare; versioni: v1 pre-finestra, revisioni annuali, revisione post-riorg per le policy organizzative.
- [ ] **Step 9.3: post-condizioni** — C9a ogni documento published ha catena versioni con date crescenti; C9b categorie non vuote e ogni documento categorizzato; C9c la pagina handbook ESS rende i contenuti (live).
- [ ] **Step 9.4: seed + twice-run + live + commit** `feat(db): storia36 C9 — handbook e contenuti`.

### Task C10: Accessi, consensi, GDPR, whistleblowing — la coda sensibile

**Files:** Create: `db/seeds/storia36/10_security_privacy.sql` · Modify: verify

**Obiettivo (volumi bassi, decisione Enzo):** `sys_user_consents` per TUTTI (consensi al trattamento all'onboarding — questo non è "basso volume", è dovuto); `sys_gdpr_requests` 3-5 chiuse (accesso/rettifica); `sys_whistleblowing_reports` 1-2 chiuse, contenuto neutro (processo, non persone); `sys_auth_login_events` campionati realisticamente sulla finestra (densità per ruolo, non ogni login); `sys_auth_sessions` solo coda recente plausibile (+ revocate); recovery codes per una manciata di utenti.

- [ ] **Step 10.1: analisi** — shape consents/gdpr nel modulo compliance; il custode whistleblowing reale (andrea.martino) come handler dei casi.
- [ ] **Step 10.2: ricerca**: *"volumi tipici richieste GDPR data subject per azienda 150-200 dipendenti anno, segnalazioni whistleblowing per dipendente anno settore bancario (ANAC relazioni annuali)"*.
- [ ] **Step 10.3: post-condizioni** — C10a consent coverage 162/162 con data <= hire+30gg (o inizio finestra per gli storici); C10b ogni GDPR request chiusa nei 30gg di legge; C10c whistleblowing: stati coerenti col modulo, handler = custode; C10d login_events: nessuno prima della hire, densità mensile > 0 per utenti attivi.
- [ ] **Step 10.4: seed + twice-run + live** (console custode con storico; admin GDPR) + commit `feat(db): storia36 C10 — consensi, GDPR, whistleblowing, accessi`.

### Task C11: Configurazione residua — visualizzazioni, classificazioni, lead, pipeline seed

**Files:** Create: `db/seeds/storia36/11_platform_config.sql` · Modify: verify

**Obiettivo:** `sys_visualization_layouts`/`node_layouts`/`styles`/`exports` (viste salvate dagli admin: org chart custom, 2-3 export storici); `sys_occupation_classification_mappings` + `sys_activity_classification_mappings` (crosswalk ISCO↔CP2021 derivabile dai cataloghi già caricati — 2121 occupazioni; per NACE rispettare il vincolo FK mig 000187); `sys_leads` (5-8 lead GTM plausibili dal canale pubblico); `sys_seed_acquisition_runs`/`candidate_records`/`validation_results`/`approval_decisions`/`source_evidence` — **auto-referenziale**: la pipeline di acquisizione registra LE RUN DI QUESTO PROGRAMMA (ogni cluster = una acquisition run con validazioni e approvazione), così il modulo è dimostrabile con dati veri per costruzione.

- [ ] **Step 11.1: analisi** — shape visualization (graphs ha 1 riga modello) + moduli seed-pipeline (che semantica hanno le 5 tabelle: leggerla dal codice).
- [ ] **Step 11.2: post-condizioni** — C11a ogni graph_type attivo ha >=1 layout salvato; C11b mapping: ogni riga rispetta FK e schema-vintage (no ATECO legacy orfano nuovo); C11c seed-pipeline: una run per cluster C1-C11 con esiti.
- [ ] **Step 11.3: seed + twice-run + live + commit** `feat(db): storia36 C11 — configurazione piattaforma`.

### Task C12: Audit semantico trasversale + chiusura

**Files:** Create: `docs/kb/storia36/AUDIT_FINALE.md` · Modify: `db/scripts/verify-storia36.sql` (consolidato)

- [ ] **Step 12.1: batteria completa** — `verify-storia36.sql` intero VERDE (self-test inclusi) + TUTTI i dossier di `verify-storia36-dossier.sql` (persona 162/162, processi, OU, posizioni, team, cascata KPI, tenant — col check di completezza 206/206 tabelle mappate) + riconciliazione aggregati (API vs righe) + `pnpm db:validate` + le 6 viste = 0.
- [ ] **Step 12.2: audit semantico su TUTTE le 206 tabelle** (mandato Enzo: "il secondo passaggio va fatto su tutte") — per ogni tabella: regola di dominio applicabile (range plausibili, date, correlazioni) eseguita e verbalizzata in AUDIT_FINALE con esito; le tabelle senza regola sensata dichiarate esplicitamente con il perché. Fan-out con agenti Explore per gruppi di tabelle se il contesto lo richiede.
- [ ] **Step 12.3: rete di sicurezza intera** — vitest completa + Playwright `test:e2e:prod:node22` + guardia attori 9/9.
- [ ] **Step 12.4: demo live** — percorso investitore/cliente: login federica.marchetti (TENANT_ADMIN) → dashboard con trend 36 mesi → un utente con storia completa (carriera, comp, formazione, valutazioni) → inbox approvazioni → engagement. Screenshot in `qa_artifacts/`.
- [ ] **Step 12.5: manutenzione ecosistema** — rigenera `heuresys_ci` (clone PROD per la CI — `db/scripts/setup-ci-database.sh` sul linux-pc, rif. Z-253) + `bash scripts/align-clones.sh all --deploy` + CI verde su main.
- [ ] **Step 12.5b: custodia schedulata** — timer systemd sul linux-pc (settimanale, DOPO il refresh del clone) che esegue `storia36.sh custodia` con `OnFailure=heuresys-unit-failure@` e report in `qa_artifacts/storia36/`; registrato fra i job che il dashboard legge. Prova: farlo scattare una volta con una violazione iniettata (unit di prova, come Z-015) e vederla nel registro.
- [ ] **Step 12.6: skill `storia36-custodia`** (decisione Enzo S1033: DOPO che primo run e ripetibilità sono provati, mai prima — la skill codifica il procedimento ESERCITATO, non quello sperato). Scriverla con `superpowers:writing-skills`. Perimetro: SOLO ciò che ricorre — custodia, avanzamento, triage a tre esiti — MAI la costruzione (una tantum, resta nel piano che si archivia). Trigger: "custodia storia36" · "verifica la storia" · "avanza la storia" · "la demo è rotta". Regola anti-drift AP-01: la skill PUNTA a `storia36.sh`, `DOSSIER_REGISTRY.md` e ai doc di dominio, non li duplica. Precondizione di scrittura: almeno UNA custodia reale eseguita con almeno un rilievo triagato, e un avanzamento mensile riuscito.
- [ ] **Step 12.7: chiusura** — AUDIT_FINALE.md completo, PROGRESS tutto spuntato, register #77 → DONE al handoff, eventuali cluster Z-* del piano zero-pendenze (W3 dati) chiusi da questo lavoro annotati per il prossimo handoff.

---

## Stime (da ricalibrare dopo C1 — misurare, non promettere)

| Cluster | Stima | Cluster | Stima |
|---|---|---|---|
| C0 | 0.5 sessione | C7 | 1 sessione |
| C1 | 1-1.5 | C8 | 1 |
| C2 | 1.5 | C9 | 0.5-1 |
| C3 | 1.5-2 | C10 | 1 |
| C4 | 1 | C11 | 1 |
| C5 | 1 | C12 | 1 |
| C6 | 1 | **Totale** | **~12-14 sessioni** |

## Self-review (fatto alla stesura)

- Copertura vs mandato: tutte le 37 tabelle vuote hanno un cluster proprietario (C1 nessuna·già coperta, C3: reward_gates/payout_curves/reward_gate_results/payroll_handoff · C4: training_initiatives · C5: professional_experiences/target_positions/successor_readiness/position_skill_requirement_history · C6: organization_unit_history/blueprint_activations/blueprint_overrides · C7: approval_requests/approval_steps/process_kpi_templates/notification_preferences · C9: content_categories/content_media · C10: user_consents/gdpr(no — già 1 riga, estesa)/whistleblowing_reports/auth_sessions/auth_mfa_otp_challenges(si popola con l'uso EMAIL_OTP: resta vuota finché il transport email è gated #8 — dichiarato, non dimenticato)/auth_mfa_recovery_codes/auth_mfa_exemptions(+audit: SOLO se serve un'esenzione di servizio reale, altrimenti vuote e dichiarate) · C11: visualization×4/leads/seed_×5/occupation_mappings/activity_mappings). `sys_process_participants` = gate Enzo, esclusa esplicitamente.
- Vincolo timestamp-storici via API: risolto col doppio binario (C7).
- Popolazione chiusa (no utenti nuovi): dichiarato in Contesto.
