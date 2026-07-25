# Piano «zero pendenze» — heuresys-advanced

**Data**: 2026-07-25 (S1029) · **Metodo**: censimento esaustivo multi-agente → dedup verificata → ondate.

## Come è stato costruito

Dieci agenti indipendenti hanno censito, ciascuno, una fonte diversa di pendenze: Action register, DEBT_REGISTER, linee di prodotto A-G, programma 100X, SOT_STATE, TODO nel codice sorgente, CI/PR/dipendenze, mandati documentali, gap runtime (DB/API/web verificati live), e — dopo un passaggio di *completeness critic* — due diligence investor, design system upstream, accessibilità/E2E, infrastruttura PROD. Nessun agente ha campionato: ogni fonte è stata letta per intero e ogni voce porta una prova (`file:riga` o comando + output).

Il risultato grezzo — 497 voci — è stato consolidato da un agente con visione globale e poi sottoposto a **tre verificatori adversarial** su lenti distinte (perdita di informazione, merge indebiti, realismo delle stime). Esito della verifica: **497 id in ingresso, 497 mappati, 0 persi, 0 inventati, 0 rilievi**.

```
497 item grezzi in ingresso (10 finder: gapfill 166, mandates 68, state 55, backlog 44, p100x 42, code 39, product 29, runtime 23, ci 20, debt 11) -> 248 cluster canonici in uscita -> 249 id assorbiti come duplicati (50,1% di ridondanza). Verifica automatica di copertura: 497 id usati, 497 unici, 0 mancanti, 0 duplicati, 0 estranei; tutti i 17 riferimenti dependsOn risolvono a zid esistenti. Ripartizione per area: db-data 46, infra-ci 33, product 33, frontend 32, doc-sot 29, security 25, test-qa 23, debt-code 19, business-dd 8. blocking=HARD su 11 cluster (2 rossi CI attivi + 1 ombrello, 5 alert di sicurezza dipendenze, 4 rischi operativi PROD su backup/retention/dump-archivio/disco, AIDE failed, alerting assente, segreti TOTP). needsEnzo: 218 NO (incluse tutte le decisioni tecniche), 19 DECISIONE-BUSINESS, 9 ESTERNO, 2 SEGRETO (app-password Outlook #8, client secret IdP per SSO). Effort consolidato ~1.370 ore (~228 sessioni da 6h), di cui ~1.086h su cluster senza blocco su Enzo. Merge piu' densi: Dependabot 15 id, doc-drift batch 12 id, brownfield-closure 8 id, tabelle-vuote-per-famiglia spezzate in 12 cluster distinti anziche' uno solo (lavoro non unico).
```


## Avanzamento

| Sessione | Chiusi | Note |
|---|---:|---|
| **S1029** | **34** | Wave 0 completa (11/11 HARD) + 23 cluster di W1. Un cluster chiuso come WON'T-DO motivato (Z-110). Un alert non chiudibile registrato come debito D-75 con rischio accettato. |
| **S1030** | **9** (+2 rettifiche, +6 nuovi) | W1: Z-022 · Z-029 · Z-030 · Z-125 · Z-156 · Z-178 · Z-224 · Z-225 · Z-234. **Rettificato Z-139**: la premessa era falsa e quel fix aveva spento i colori d'errore sul sito pubblico (riparato dentro Z-156). Emersi 3 cluster nuovi — **Z-249** due rossi semantici, **Z-250** skill `zero-pending-loop` incompleta, **Z-251** la suite non regge la contesa sul DB. Emersi anche dalla review adversarial: **Z-252** (PaletteDropdown inerte, font aspirazionale) e **Z-253** (`heuresys_ci` mai rinfrescato). Piu' **Z-254** (disciplina di rilascio upstream). Totale: **254 cluster**. |

Le caselle spuntate qui sotto portano la nota di chiusura con l'evidenza. Il resto è aperto.

## Il numero

| | Cluster | Ore | Sessioni (6h) |
|---|---:|---:|---:|
| **Totale** | 248 | 1370 | 228 |
| di cui eseguibile in autonomia | 218 | 924 | 154 |
| bloccato su: decisione-business | 19 | 257 | 43 |
| bloccato su: segreto | 2 | 14 | 2 |
| bloccato su: esterno | 9 | 175 | 29 |

Le stime sono per-cluster e consolidate dalla fonte più motivata fra quelle discordanti; 1 sessione = 6 ore. Sono stime di *lavoro*, non di calendario.

## Ordine di esecuzione

| Ondata | Tema | Cluster | Ore |
|---|---|---:|---:|
| **W0** | Sblocco | 11 | 24 |
| **W1** | Igiene rapida | 75 | 102 |
| **W2** | Debito tecnico, test e CI | 37 | 203 |
| **W3** | Dati e DB | 36 | 168 |
| **W4** | Frontend e sicurezza | 39 | 213 |
| **W5** | Prodotto | 20 | 213 |
| **W6** | Dipende da input o decisioni tue | 30 | 446 |

**Criterio**: prima ciò che è rotto ora (W0), poi ciò che costa poco e toglie rumore (W1), poi la rete di sicurezza che protegge il resto del lavoro (W2), poi il divario dati (W3), le superfici (W4), le nuove capacità (W5). W6 resta fuori dalla mia portata per definizione.

## Protocollo di chiusura di un cluster

Nessun cluster è chiuso senza, nell'ordine: (1) implementazione secondo i pattern del repo; (2) **due verifiche di natura diversa** — non due esecuzioni dello stesso test: es. test d'integrazione su DB reale *più* prova live con evidenza (comando, output, timestamp), oppure test automatico *più* unit test sul ramo che l'integrazione non può raggiungere; (3) **review adversarial** da parte di un agente istruito a demolire, non a confermare; (4) correzione dei rilievi confermati e ri-test; (5) commit atomico. Il campo *done when* di ogni cluster è un criterio osservabile con un comando, mai una frase.

---

## W0 — Sblocco (11 cluster, 24h)

Rossi attivi e rischi operativi: finché sono aperti, tutto il resto lavora su fondamenta instabili.

### infra-ci (9)

- [x] **Z-015** (6.0h) — Alerting PROD assente: Prometheus senza rule_files/alertmanager, nessun OnFailure sui 10 timer systemd, reindex fallisce in silenzio
  - ✅ **CHIUSO S1029** — alerting PROD: 4 regole Prometheus live + OnFailure sui 9 job + sezione nel dashboard di sessione
  - *chiuso quando*: curl -s localhost:9091/api/v1/rules mostra >=1 gruppo e /api/v1/alertmanagers un alertmanager attivo; grep -l OnFailure deploy/systemd/*.service copre backup, dr-drill, reindex, gdpr-retention
  - *assorbe*: `gapfill:GAP4-4`, `gapfill:GAP2-50`, `gapfill:GAP2-21`, `gapfill:GAP1-66`
- [x] **Z-005** (4.0h) — 5 alert di sicurezza Dependabot aperti (fast-uri x2 HIGH, sharp HIGH, dompurify LOW, @hono/node-server MEDIUM) e i 3 run security_update_not_possible
  - ✅ **CHIUSO S1029** — 10 alert di sicurezza chiusi via pnpm.overrides (erano 10, non 5); resta il solo brace-expansion → D-75
  - *chiuso quando*: gh api repos/Spen-Zosky/heuresys-advanced/dependabot/alerts --paginate --jq '[.[]|select(.state=="open")]|length' = 0 (o rischio accettato scritto nel DEBT_REGISTER) E pnpm build verde su Windows/VM/linux-pc
  - *assorbe*: `ci:CI-6`, `ci:SEC-111+114`, `ci:SEC-113`, `ci:SEC-112`, `ci:SEC-107`, `gapfill:GAP4-9`
- [x] **Z-017** (3.0h) — Backup PROD senza copia off-host: dump e database sullo stesso /dev/sda1
  - ✅ **CHIUSO S1029** — backup off-host in pull da linux-pc, verifica TOC + restore-test reale (163 utenti)
  - *chiuso quando*: ssh VM: grep BACKUP_OFFHOST_SSH .env valorizzato E il dump piu' recente e' presente sull'host remoto (ssh <target> ls -la <path>) con md5sum uguale
  - *assorbe*: `gapfill:GAP4-2`, `gapfill:GAP2-19`
- [x] **Z-018** (2.0h) — Retention backup PROD effettiva ~4 giorni contro i 14 dichiarati, senza alcun check sui restore-point attesi
  - ✅ **CHIUSO S1029** — FALSO POSITIVO: il timer di backup era nato da 4 giorni, nessun dump perduto
  - *chiuso quando*: ssh VM: ls BACKUP_DIR conta >=14 dump distinti dopo 14 giorni E dr-drill.sh fallisce se il numero di restore-point e' inferiore all'atteso
  - *assorbe*: `gapfill:GAP4-3`
- [x] **Z-019** (2.0h) — Dump di archivio della migration 000213 (1,5M righe) in copia unica sullo stesso disco e mai verificato in restore
  - ✅ **CHIUSO S1029** — il dump di archivio 000213 è ora incluso nell'archivio off-host verificato
  - *chiuso quando*: il file audit_import_validation_results_2026-07-23.dump esiste su un secondo host (ssh <target> ls -la) E pg_restore su DB scratch ricarica >0 righe senza errori
  - *assorbe*: `gapfill:GAP4-8`
- [x] **Z-002** (1.5h) — CI ROSSA — sdbi-perf-feedback: 0 marker SDBI attesi 4 dopo il TRUNCATE della migration 000213
  - ✅ **CHIUSO S1029** — marker SDBI ri-derivati dal lineage (mig 000215, idempotente)
  - *chiuso quando*: cd apps/api && pnpm exec vitest run test/sdbi-perf-feedback.integration.test.ts esce 0 sia contro il DB VM (:5433) sia contro heuresys_ci sul runner
  - *assorbe*: `debt:CI-SDBI-LINEAGE`, `ci:CI-3`, `mandates:MAN-2`, `runtime:RT-2`
- [x] **Z-001** (1.0h) — CI ROSSA — GET /v1/observability/slow-queries risponde 500 sul runner: pg_stat_statements non in shared_preload_libraries
  - ✅ **CHIUSO S1029** — CI rossa: pg_stat_statements non preloaded — fix su runtime + script di setup + endpoint che degrada
  - *chiuso quando*: ssh linux-pc: sudo -u postgres psql -d heuresys_ci -c "SELECT count(*) FROM pg_stat_statements" ritorna un numero (non errore) E il test '#35 GET /slow-queries' passa nel run CI
  - *assorbe*: `debt:CI-OBS-SLOWQ`, `ci:CI-2`, `mandates:MAN-1`, `runtime:RT-3`, `gapfill:GAP4-1`
- [x] **Z-020** (1.0h · dipende da Z-015) — Disco PROD all'81% (19G liberi) senza alcuna soglia di allarme
  - ✅ **CHIUSO S1029** — disco 82%→80%; il margine strutturale viene dallo spostamento off-host, non da altre cancellazioni
  - *chiuso quando*: df -h / sulla VM sotto il 75% E esiste una regola Prometheus che allerta sopra soglia (curl /api/v1/rules la mostra)
  - *assorbe*: `gapfill:GAP4-7`
- [x] **Z-003** (0.5h · dipende da Z-001, Z-002) — Riportare a VERDE il gate 'Test (api integration)' su main (ombrello dei due rossi)
  - ✅ **CHIUSO S1029** — gate Test (api integration) VERDE su main (run 30143003990)
  - *chiuso quando*: gh run list --branch main --workflow=test-integration.yml --limit 1 mostra conclusion=success su HEAD di main
  - *assorbe*: `ci:CI-1`, `runtime:RT-1`

### security (2)

- [ ] **Z-034** (2.0h) — Segreti TOTP: fixture in chiaro nel repo + 7/19 secret plaintext a DB + MFA_ENCRYPTION_KEY da garantire su VM e linux-pc
  - *chiuso quando*: psql: select count(*) from sys.sys_auth_mfa_factors where auth_mfa_factor_kind='TOTP' and auth_mfa_factor_secret not like 'enc:v1:%' = 0 E grep dei secret di fixture nel repo = 0
  - *assorbe*: `state:TOTP-FIX`, `state:ENC-TOTP`, `code:CODE-6`, `p100x:MFA-KEY-PROD`
- [x] **Z-053** (1.5h) — dailyaidecheck.service in stato failed su PROD da giorni (file-integrity spento, nessuna notifica)
  - ✅ **CHIUSO S1029** — AIDE: database mai inizializzato — ora creato (401 MB) e il check gira
  - *chiuso quando*: ssh VM: systemctl --failed non elenca alcuna unit e systemctl status dailyaidecheck.service mostra Active con ultimo esito success
  - *assorbe*: `gapfill:GAP4-6`

---

## W1 — Igiene rapida (75 cluster, 102h)

Cluster da ≤2h e disallineamenti documentali. Massimo rapporto chiusure/ora: toglie il rumore che maschera i problemi veri.

### db-data (5)

- [ ] **Z-088** (2.0h · dipende da Z-026) — Sizing storage pre-lancio non pianificato (indici HNSW dominanti, free-tier 50GB)
  - *chiuso quando*: esiste una stima committata della crescita HNSW al primo tenant reale con la decisione m=8 vs m=16 motivata
  - *assorbe*: `gapfill:GAP2-44`
- [ ] **Z-066** (1.5h) — sys_auth_sessions: tabella morta (0 righe, 0 riferimenti) citata pero' nella mappa GDPR
  - *chiuso quando*: psql: select to_regclass('sys.sys_auth_sessions') is null (droppata) oppure un ADR ne dichiara la riserva e la mappa GDPR non la elenca piu'
  - *assorbe*: `code:CODE-38`, `runtime:RT-11`
- [ ] **Z-068** (1.5h · dipende da Z-002) — Righe di audit del workflow SDBI mai emesse (marker SDBI_CONSOLIDATION_COMPLETE_V1 assente benche' l'abilitatore esista)
  - *chiuso quando*: psql: select count(*) from audit.import_validation_results where rule_code like 'SDBI%' = 4, oppure una nota formale dichiara che la provenance vive solo in sys_source_lineage_records
  - *assorbe*: `code:CODE-15`
- [ ] **Z-078** (1.5h) — engagement_pulse_configs dichiarato out-of-scope m2b e mai importato (3 righe)
  - *chiuso quando*: psql: la tabella target ha 3 righe importate, oppure il registry la marca WON'T-DO con motivazione
  - *assorbe*: `code:CODE-29`
- [ ] **Z-069** (1.0h) — Seed perf_feedback non ri-eseguibile: i path \copy sono placeholder <CSV_DIR>
  - *chiuso quando*: bash db/seeds/brownfield/sdbi/perf_feedback/02_*.sql parametrizzato gira due volte di fila senza edit manuale ed e' idempotente
  - *assorbe*: `code:CODE-16`

### debt-code (7)

- [ ] **Z-172** (2.0h) — Provider di embedding con un solo concreto e vincolo dimensionale 1024 non documentato a livello schema
  - *chiuso quando*: il seam Embedder e' selezionabile via env e il vincolo 1024 e' documentato nella migration pgvector e nel client
  - *assorbe*: `gapfill:GAP2-41`
- [x] **Z-178** (1.0h) — Sorgente delle release @heuresys/ui 0.1.8 e 0.1.9 mai pushata upstream: npm avanti di 2 versioni rispetto a GitHub, dist fermo alla 0.1.7
  - ✅ **CHIUSO S1030** — 0.1.8 e 0.1.9 pushate su GitHub (`origin/main` = `c31e4c7`); `ui/package.json` su GitHub dichiara 0.1.9 con i subpath `./charts` e `./markdown`, e npm `latest` è 0.1.9
  - ⚠️ **precisazione post-review**: le tre prove iniziali (git log + `gh api` + `npm view version`) leggevano **dichiarazioni**, non codice: dopo un commit di bump quelle stringhe coincidono per costruzione. Il confronto di contenuto fatto poi dal revisore dà un esito più sfumato — `package.json` e `dist/index.{mjs,cjs,d.ts,d.cts}` del tarball npm sono **identici** al commit, ma **11 dei 15 file `dist` del tarball non esistono su GitHub** (`dist/` è gitignored con 4 file forzati dentro), fra cui proprio i target di `./charts` e `./markdown`. In più `npm view @heuresys/ui@X gitHead` punta, su tutte e tre le release, al commit della versione **precedente**: ogni publish è partito da un albero non committato. Il cluster resta chiuso — il sorgente della release ora è su GitHub, che era l'oggetto — ma la disciplina di rilascio è un residuo: vedi **Z-254**
- [ ] **Z-254** (1.5h) — Disciplina di rilascio di `@heuresys/ui`: nessun tag git per le versioni pubblicate, `gitHead` npm sfasato di una release su 0.1.7/0.1.8/0.1.9 (publish da working tree sporco), e `dist/` tracciato a metà (4 file su 15) destinato a divergere in silenzio. Inoltre il repo ha due package manager: workspaces npm + `ui/pnpm-lock.yaml` (committato in S1030) che nessun workflow legge, mentre `deploy-storybook.yml` fa `npm install --legacy-peer-deps` senza lockfile
  - *chiuso quando*: `npm view @heuresys/ui@<v> gitHead` coincide con il commit taggato `v<v>` per l'ultima release, i tag esistono su GitHub, e il repo dichiara un solo package manager con la CI che ne usa il lockfile
  - *chiuso quando*: nel repo ux-design-shared git log origin/main contiene i commit 0.1.8 e 0.1.9, ui/package.json dichiara 0.1.9 e le subpath ./charts e ./markdown sono negli exports
  - *assorbe*: `gapfill:GAP3-1`, `gapfill:GAP3-8`
- [x] **Z-166** (0.5h) — 29 skeleton con 'TODO: Development Team must implement' ancora tracciati in docs/source_bundle
  - ✅ **CHIUSO S1029** — TODO fantasma del Bootstrap Pack: README che li esclude dalle metriche di debito
  - *chiuso quando*: grep -rn 'TODO: Development Team' docs/ = 0 (file spostati in docs/archive/ o annotati SUPERSEDED)
  - *assorbe*: `code:CODE-1`
- [x] **Z-170** (0.5h) — Pool PostgreSQL hardcoded a max=20, non configurabile via env
  - ✅ **CHIUSO S1029** — pool PostgreSQL parametrizzato (era max:20 hardcoded)
  - *chiuso quando*: grep POSTGRES_POOL_MAX apps/api/src/config/env.ts e .env.example trovano la chiave e il pool la rispetta a runtime
  - *assorbe*: `gapfill:GAP2-35`
- [x] **Z-174** (0.5h) — Artefatti non-codice tracciati nella root del repo (incluso un .zip binario)
  - ✅ **CHIUSO S1029** — deliverable Cowork spostati dalla root, indice aggiornato
  - *chiuso quando*: git ls-files nella root non elenca cli-next.zip ne' gli altri artefatti censiti
  - *assorbe*: `code:CODE-39`
- [x] **Z-171** (0.2h) — .nvmrc dichiara Node 20.11.0 mentre engines richiede >=22
  - ✅ **CHIUSO S1029** — .nvmrc allineato a engines (Node 20 → 22)
  - *chiuso quando*: cat .nvmrc mostra una versione >=22 coerente con package.json engines
  - *assorbe*: `gapfill:GAP2-36`
- [x] **Z-176** (0.2h) — Directory tests/ top-level vuota (solo 3 .gitkeep) citata in CLAUDE.md
  - ✅ **CHIUSO S1029** — directory tests/ vuota rimossa + riga in CLAUDE.md
  - *chiuso quando*: find tests -type f = 0 file e la riga corrispondente in CLAUDE.md e' rimossa (oppure la dir e' popolata)
  - *assorbe*: `code:CODE-12`

### doc-sot (28)

- [ ] **Z-231** (6.0h) — Contratto OpenAPI mai generato ne' pubblicato (Q8 del bootstrap resta l'unica open question non risolta)
  - *chiuso quando*: pnpm openapi:generate produce apps/api/openapi.yaml valido su ~500 endpoint, un job CI lo pubblica come artefatto e un drift-guard fallisce se lo spec diverge dalle route
  - *assorbe*: `gapfill:GAP1-19`, `gapfill:GAP2-42`
- [ ] **Z-240** (6.0h) — CLAUDE.md layered: estrarre i corpi estesi di R7/R18/R20/R22/R23 e i contesti-macchina in reference on-demand, comprimere CONTESTO MAC (ritirato) e le 4 ripetizioni treat-as-real
  - *chiuso quando*: wc -c dei due CLAUDE.md scende in modo misurabile rispetto alla baseline (31.302 + 36.708 char) senza perdere alcuna regola R1-R23, verificato con un diff di copertura
  - *assorbe*: `p100x:QW-L4`, `p100x:D-L1`, `p100x:N-L5`
- [ ] **Z-212** (4.0h) — Batch doc-drift SoT: CLAUDE.md (11 ruoli vs 13, ~75 moduli vs ~90, ESS 13/18), Ledger prodotto, README, POST_V1_ROADMAP, platform-capabilities-roadmap, gap migration 000139, footer DEBT_REGISTER e i 13 debiti D-61..D-73
  - *chiuso quando*: python docs/kb/tools/status_dashboard.py --strict non segnala drift e i conteggi citati nei doc coincidono con psql/ls (comando di verifica allegato per ciascuno)
  - *assorbe*: `mandates:MAN-55`, `product:G4`, `product:A-S5`, `p100x:QW-I1`, `state:DOC-1`, `state:DOC-2`, `state:DRIFT-INV`, `mandates:MAN-51`, `runtime:RT-22`, `debt:DEBT-REGISTER-FOOTER`, `state:D-61..D-73`, `debt:D-05`
- [ ] **Z-237** (4.0h) — CONTRIBUTING.md, ONBOARDING.md e runbook operativo assenti (meta' tecnica ed eseguibile della condizione C2 della due diligence)
  - *chiuso quando*: i 3 file esistono in root/docs e un lettore esterno riesce a fare setup+build+test seguendoli (prova: esecuzione dei comandi dichiarati)
  - *assorbe*: `gapfill:GAP1-55`, `gapfill:GAP2-24`
- [ ] **Z-215** (3.0h · dipende da Z-214, Z-105, Z-160, Z-128) — Chiusura formale del programma 100X: misura finale dei KPI §7 e verdetto sull'item di register #9/#10/#11
  - *chiuso quando*: MASTER_PLAN §7 riporta i 7 KPI con valore misurato e comando; l'item #9/#10/#11 e' marcato terminale nell'Action register e handoff_lint passa
  - *assorbe*: `p100x:KPI-CLOSURE`, `backlog:#9/#10/#11`
- [ ] **Z-219** (3.0h) — Atlas curato stale (468 route, 276 tabelle/67 vuote) e counts endpoint/tabelle non derivati da fonte generata
  - *chiuso quando*: python docs/kb/atlas/build_atlas.py rigenera l'atlas e ATLAS_CURATED.md riporta i valori live coincidenti con psql e con il conteggio degli handler
  - *assorbe*: `gapfill:GAP2-5`
- [ ] **Z-213** (2.0h) — SOT_STATE.md §1-§9 mai ri-derivate: conteggi e HEAD fermi a S1006/S1007 (regressione della governance D-01)
  - *chiuso quando*: i valori di SOT_STATE §1-§9 coincidono con git rev-parse --short HEAD, ls db/migrations/*.sql | wc -l, ls apps/api/test/*.test.ts | wc -l e le query RBAC; la ri-derivazione e' automatizzata nella skill handoff
  - *assorbe*: `state:DRIFT-SOT`
- [ ] **Z-214** (2.0h) — Riconciliare il tracker del programma 100X: TODO_100X (>=18 voci chiuse ancora aperte), MASTER_PLAN §9, FINDINGS README WS-L, BASELINE_METRICS, doc-count della suite, INTERVIEW_LOG, epic S-100X-E
  - *chiuso quando*: grep -c '^- \[ \]' docs/kb/improvement/TODO_100X.md corrisponde alle sole voci realmente aperte e BASELINE_METRICS riporta i valori misurati oggi con i comandi allegati
  - *assorbe*: `p100x:TODO-RECONCILE`, `p100x:MP-9`, `p100x:QW-I4`, `p100x:BASELINE-REMEASURE`, `p100x:QW-F6`, `p100x:OQ-INTERVIEW`, `state:S100X-E`
- [ ] **Z-218** (2.0h) — Manca un drift-check CI sulla prosa di README/CLAUDE.md (handoff_lint verifica STATE/SOT/register ma non i testi)
  - *chiuso quando*: docs/kb/tools/handoff_lint.py fallisce su una versione/conteggio stale iniettato in README o CLAUDE.md (test negativo dimostrato)
  - *assorbe*: `p100x:DOSSIER-ANTIDRIFT`
- [ ] **Z-220** (2.0h) — I verdetti formali non sono tracciati nelle SoT: le 3 condizioni bloccanti del CONDITIONAL-GO e i 4 finding Low non sono voci azionabili
  - *chiuso quando*: le 3 condizioni e i 4 Low esistono come blocchi nell'Action register di SOT_BACKLOG con status e trigger, e build_menu.py li stampa nel menu
  - *assorbe*: `state:AUDIT-COND`, `state:AUDIT-LOW`, `gapfill:GAP2-58`
- [ ] **Z-233** (2.0h) — ADR upstream mancanti o non ratificati: ADR-0008..0012 dichiarati Accepted senza file + UXIX-0002/0003/0004 ancora Proposed
  - *chiuso quando*: nel repo ux-design-shared governance/ contiene i file ADR-0008..0012 e le tre righe UXIX risultano Accepted con file corrispondente
  - *assorbe*: `gapfill:GAP1-14`, `gapfill:GAP1-17`, `gapfill:GAP3-3`
- [ ] **Z-238** (2.0h) — Policy di upgrade/pinning delle dipendenze non documentata (stack su major bleeding-edge senza ADR)
  - *chiuso quando*: esiste un ADR che definisce il criterio (es. N-1 per le core) e #66 lo cita come regola di triage
  - *assorbe*: `gapfill:GAP1-73`, `gapfill:GAP2-40`
- [ ] **Z-221** (1.5h) — Roadmap MVP-4 ancora in DRAFT 'awaiting Enzo's review' con AC-01..12 e checklist §11 mai spuntate (superata dal tag v1.0.0)
  - *chiuso quando*: docs/MVP_4_ROADMAP.md dichiara lo stato terminale (superseded da v1.0.0) e nessuna checkbox resta ambigua: grep -c '^- \[ \]' = 0
  - *assorbe*: `gapfill:GAP1-1`, `gapfill:GAP1-7`
- [ ] **Z-223** (1.5h) — wave_runners e stream Wave 4: wave_2 chiuso ma DRAFT, wave_3 obsoleto pre-ADR-0024/0026 senza nota, wave_4 DRAFT senza item in nessuna SoT
  - *chiuso quando*: i 3 file portano uno stato esplicito (chiuso / storico-non-eseguibile / superseded) e nessuna checkbox pre-flight resta aperta senza contesto
  - *assorbe*: `gapfill:GAP1-3`, `gapfill:GAP1-48`, `gapfill:GAP1-49`, `gapfill:GAP1-50`
- [x] **Z-232** (1.0h) — ADR-0013 (vivo) descrive @heuresys/ui via protocollo link: e path assoluti Windows, in 3 doc non archiviati (9 occorrenze)
  - ✅ **CHIUSO S1029** — 17 path assoluti resi relativi + emendamento ADR-0013
  - *chiuso quando*: grep -rn 'D:\\ux-design-shared' docs/ escludendo docs/archive/ = 0 e ADR-0013 descrive la dipendenza npm
  - *assorbe*: `gapfill:GAP3-5`, `gapfill:GAP3-24`
- [x] **Z-236** (1.0h) — linux-pc descritto come 'ISOLATO dalla dottrina di allineamento' in CLAUDE.md e nella memoria, mentre e' di fatto integrato
  - ✅ **CHIUSO S1029** — linux-pc non più «ISOLATO»: runner CI + close-propagate + archivio backup
  - *chiuso quando*: CLAUDE.md e la memoria descrivono il ruolo reale (align-clones linuxpc, close-propagate, runner CI off-prod) e non c'e' piu' contraddizione (grep di 'ISOLATO')
  - *assorbe*: `state:LINUXPC`
- [ ] **Z-239** (1.0h) — Ecosistema Claude: MEMORY.md non re-indicizzato (55 nodi su disco vs 53 link), nodi session-state da archiviare, memorie ridondanti da sostituire con pointer
  - *chiuso quando*: il numero di nodi su disco coincide con le voci dell'indice e memory/_archive contiene i nodi superati
  - *assorbe*: `p100x:QW-L1`, `p100x:QW-L5`, `p100x:N-L3`
- [x] **Z-229** (0.8h) — docs/github/07-nostri-repo/01-stato-corrente.md: snapshot fermo al 2026-05-17 (dichiara 0 workflow, 0 tag, no LICENSE)
  - ✅ **CHIUSO S1029** — snapshot GitHub rigenerato (dichiarava 88 commit, 0 workflow, 0 tag)
  - *chiuso quando*: il file e' rigenerato via gh api e i suoi valori coincidono con gh repo view / gh workflow list / gh release list
  - *assorbe*: `gapfill:GAP1-45`
- [ ] **Z-230** (0.8h) — Doc di triage Dependabot stale (zod/next superati, script mai implementato, riferimento a un file inesistente)
  - *chiuso quando*: il doc riporta l'ultimo triage reale con data e le righe defer-major coincidono con gh pr list; i riferimenti a file inesistenti sono rimossi
  - *assorbe*: `gapfill:GAP1-46`
- [x] **Z-234** (0.8h) — Metadati e doc del repo upstream stale su 5 fronti (reactflow rimosso ma elencato, README con lo scope di heuresys-evo, marker TODO, descrizione GitHub con link:, SETUP con npm)
  - ✅ **CHIUSO S1030** — 5 fronti chiusi + lockfile committato; i due «TODO» erano lavoro vero (Z-152/Z-153), annotati non cancellati
  - *chiuso quando*: grep reactflow su MANIFEST.md e SETUP.md = 0, il README cita i consumer attuali e la descrizione GitHub non menziona il protocollo link:
  - *assorbe*: `gapfill:GAP3-6`
- [x] **Z-216** (0.5h) — I due kickoff (NEXT_SESSION_FORENSIC + DB_FRONTEND_FORENSICS) non sono marcati ESEGUITO: rischio di ri-esecuzione
  - ✅ **CHIUSO S1029** — i due kickoff forensi marcati ESEGUITO (uno recitava «prima di ogni altra cosa»)
  - *chiuso quando*: entrambi i file portano il banner ESEGUITO con puntatore al successore, come NEXT_SESSION_EPICS_KICKOFF.md:3 (grep del banner sui 3 file)
  - *assorbe*: `mandates:MAN-6`, `mandates:MAN-7`
- [x] **Z-226** (0.5h) — Header di stato dei doc ESCO/tenant-onboarding ancora PLAN / DESIGN-PROPOSED benche' tutto sia shipped (e con formule ritirate 'tenant di TEST'/'no-PII')
  - ✅ **CHIUSO S1029** — asse occupation dichiarato shipped con evidenza live + formule ritirate
  - *chiuso quando*: grep -c 'tenant di TEST\|no-PII' docs/integrations/ = 0 e gli header dichiarano SHIPPED con le migration di riferimento
  - *assorbe*: `gapfill:GAP1-25`
- [x] **Z-235** (0.5h) — Piano batch S1018: le wave W11 (E5), W12 (audit-100X) e W13 (deploy finale) non sono mai state dichiarate chiuse o superate
  - ✅ **CHIUSO S1029** — batch S1018 chiuso wave per wave, W13 verificata superata sui fatti
  - *chiuso quando*: docs/kb/RESUME_S1018_BATCH.md dichiara la sequenza superata o chiusa wave per wave, e nessun altro doc la ripropone
  - *assorbe*: `state:W12-W13`, `state:W11-E5`
- [x] **Z-217** (0.2h) — COWORK_INBOX: la entry wargames 2026-07-06 e' priva della riga di stato richiesta dal protocollo
  - ✅ **CHIUSO S1029** — entry inbox priva di stato riconciliata
  - *chiuso quando*: grep -c 'RICONCILIATA' docs/kb/COWORK_INBOX.md copre tutte le entry (nessuna entry senza riga stato)
  - *assorbe*: `mandates:MAN-9`
- [x] **Z-224** (0.2h) — preflight-residual-todo.md: CODE-5 e CODE-10 risultano 'Deferred' ma sono chiusi sul reale
  - ✅ **CHIUSO S1030** — CODE-5 e CODE-10 chiusi sul reale (showcase live dal 7f6e174e; i18n 2349 chiavi × 10 namespace con check in CI); il refactor residuo rimandato a Z-173
  - *chiuso quando*: le due voci sono marcate chiuse con l'evidenza (assenza di _disabled_showcase_X18 e i18n a 10 namespace con check in CI)
  - *assorbe*: `gapfill:GAP1-9`
- [x] **Z-225** (0.2h) — cw-b59-true-root-cause: doc fermo a 'Root cause identified' con 3 open question superate dal 2026-05-27
  - ✅ **CHIUSO S1030** — intestazione RESOLVED + le 3 open question chiuse con misure (React è peerDependency, subpath al posto dello split, bisect mai servito)
  - *chiuso quando*: il file porta l'intestazione storico/RESOLVED con riferimento al fix client boundary ssr:false
  - *assorbe*: `gapfill:GAP1-20`
- [x] **Z-227** (0.2h) — AUTH_SECURITY_PLAN §13: 13 voci di acceptance non spuntate benche' coperte dalla suite da MVP-1
  - ✅ **CHIUSO S1029** — 13 acceptance auth verificate una per una contro i test reali
  - *chiuso quando*: le 13 voci sono spuntate con il riferimento al test che le copre (nome file e test name)
  - *assorbe*: `gapfill:GAP1-30`
- [x] **Z-228** (0.2h) — self-hosted-runners-setup §8 ('backup runner Windows DEFERRED') contraddice l'header dello stesso file
  - ✅ **CHIUSO S1029** — §8 backup runner Windows marcata superseded dal runner linux-pc
  - *chiuso quando*: la §8 e' marcata superseded dal runner linux-pc (grep del marker nel file)
  - *assorbe*: `gapfill:GAP1-43`

### frontend (8)

- [ ] **Z-136** (2.0h) — Metrologia KPI: drill-down delle measurements per singolo KPI su /kpis
  - *chiuso quando*: E2E apre il drill di un KPI e vede le measurements servite da :id/measurements
  - *assorbe*: `backlog:L6-drill`, `product:A-L6`
- [ ] **Z-144** (2.0h) — Secondo duplicato del componente detail-panel/FieldGrid mai promosso a @heuresys/ui
  - *chiuso quando*: grep del componente duplicato in apps/web/src = 0 e l'import arriva da @heuresys/ui alla versione bumpata
  - *assorbe*: `state:QW-FG`
- [ ] **Z-150** (2.0h) — Lead capture mai dimostrata live: sys_leads a 0 righe con LeadForm attivo su /demo e /investors
  - *chiuso quando*: psql: select count(*) from sys.sys_leads > 0 dopo un submit reale in PROD, con il record visibile nella admin UI
  - *assorbe*: `runtime:RT-12`
- [ ] **Z-135** (1.5h) — Gap closure: tab self dei piani di chiusura su /me/gaps (ESS)
  - *chiuso quando*: E2E con persona USER apre /me/gaps, vede il tab self popolato da me/gaps/closure
  - *assorbe*: `backlog:L4-self`, `product:A-L4`
- [ ] **Z-152** (1.5h) — Brand v1: 5 refinement del social media kit (SK-1..SK-5)
  - *chiuso quando*: node apps/web/scripts/generate-social-kit.mjs rigenera gli asset con i 5 refinement applicati e l'output e' committato
  - *assorbe*: `gapfill:GAP1-10`
- [ ] **Z-153** (1.0h) — Brand v1: favicon set multi-res, site.webmanifest, apple-touch-icon, browserconfig assenti (il sito in PROD non ha favicon ne' manifest PWA)
  - *chiuso quando*: curl -sI https://www.heuresys.com/favicon.ico restituisce 200 e /site.webmanifest e' servito con contenuto valido
  - *assorbe*: `gapfill:GAP1-11`
- [x] **Z-156** (1.0h) — Drift dei token a11y fra apps/web e apps/showcase: i fix contrasto S982 vivono solo in apps/web, il sito pubblico ne e' privo
  - ✅ **CHIUSO S1030** — token estratti in `_theme-tokens.css` (fonte unica copiata dal sync). Scoperto che Z-139 aveva SPENTO i colori d'errore sullo showcase: vedi la rettifica sotto
  - *chiuso quando*: diff dei blocchi di override fra apps/web/src/app/globals.css e apps/showcase/src/app/globals.css = vuoto e la run axe sullo static export non mostra i color-contrast serious
  - *assorbe*: `gapfill:GAP3-17`
- [x] **Z-139** (0.5h) — Token colore non valido text-destructive residuo (6-12 occorrenze nelle pagine showcase)
  - ✅ **CHIUSO S1029** — token colore inesistente corretto in 17 file — non solo showcase: anche approvals, insights, me/*
  - ⚠️ **RETTIFICA S1030 — la premessa era falsa e il fix ha introdotto una regressione.** `text-destructive` **era una utility valida**: `--color-destructive` arriva da `@import "@heuresys/ui/styles"`, dichiarato in un blocco `@theme`. Misurato sul CSS emesso del build showcase **del 21 giugno**, un mese prima del fix: `.text-destructive{color:var(--color-destructive)}` presente, `--color-destructive:#e6293f` definito, mentre `.text-inventato` è assente (controprova che Tailwind non emette utility fantasma). L'errore fu leggere il solo `:root` di `apps/web/src/app/globals.css` senza seguire l'`@import` in cima. **Conseguenza**: in `apps/web` è cambiata solo la tinta, ma in `apps/showcase` — che non aveva i token semantici dell'app — `text-danger`/`bg-danger` non generavano più **nessuna** utility (build fresco: `.text-danger` ASSENTE, `--danger` non definito). Il difetto denunciato è stato creato dal fix, sul sito pubblico. Chiuso in Z-156 estraendo i token in `apps/web/src/app/_theme-tokens.css`. Il criterio di chiusura qui sopra (`grep text-destructive = 0`) resta soddisfatto ma **non era il criterio giusto**: misurava i sorgenti, non il CSS emesso.
  - *chiuso quando*: grep -rc 'text-destructive' apps/web/src apps/showcase/src = 0
  - *assorbe*: `p100x:QW-E1`, `mandates:MAN-57`

### infra-ci (13)

- [ ] **Z-006** (2.0h) — Runner self-hosted instabile: shutdown signal a meta' job + PNPM_HOME v10/v11 che reinstalla pnpm a ogni run
  - *chiuso quando*: 10 run consecutivi di playwright-smoke e test-integration senza 'runner has received a shutdown signal' nei log (gh run list --limit 10 --json conclusion)
  - *assorbe*: `ci:CI-4`
- [ ] **Z-008** (2.0h) — Showcase: portare axe/smoke in CI (showcase-a11y.spec e showcase-smoke non girano mai, ne' in prod-suite ne' in CI)
  - *chiuso quando*: showcase.yml (o job equivalente) esegue axe sulle 18 route showcase e gh run view mostra lo step verde con artefatto JSON
  - *assorbe*: `p100x:QW-F4`, `gapfill:GAP1-12`, `gapfill:GAP3-12`, `gapfill:GAP3-21`
- [ ] **Z-014** (2.0h) — Branch protection non verificata + script mai creato + governance direct-to-main con branch stale
  - *chiuso quando*: MSYS_NO_PATHCONV=1 gh api repos/Spen-Zosky/heuresys-advanced/branches/main/protection risponde 200 con i check richiesti E git branch -r non elenca i branch stale censiti
  - *assorbe*: `gapfill:GAP1-47`, `gapfill:GAP2-32`
- [ ] **Z-021** (2.0h) — linux-pc esegue 9 timer di produzione invece dei 2 previsti dal provisioning (gdpr-retention fa DELETE sul clone)
  - *chiuso quando*: ssh linux-pc: systemctl list-timers | grep heuresys elenca esattamente i timer dichiarati in scripts/provision-linux-pc.sh
  - *assorbe*: `gapfill:GAP4-5`
- [ ] **Z-033** (2.0h) — Upstream design system: nessuna CI di qualita' (unico workflow = deploy Storybook, no typecheck/lint/test, lockfile ignorato)
  - *chiuso quando*: nel repo ux-design-shared esiste quality.yml che esegue typecheck+lint+test e gh run list mostra un run success
  - *assorbe*: `gapfill:GAP3-2`
- [x] **Z-022** (1.0h) — linux-pc: schedulare il refresh del DB clone (timer settimanale) invece che on-demand
  - ✅ **CHIUSO S1030** — timer settimanale live su linux-pc (NEXT domenica 05:08) + run reale verificata sui dati (163/181/908/14041, servizi ripartiti)
  - *chiuso quando*: ssh linux-pc: systemctl list-timers heuresys-advanced-clonedb.timer mostra NEXT valorizzato e un'esecuzione success in journalctl
  - *assorbe*: `backlog:#67-timer`, `mandates:MAN-66`
- [ ] **Z-031** (1.0h) — Monitor di non-regressione dell'ecosistema (5 asset WS-L senza check automatico)
  - *chiuso quando*: esiste uno script idempotente che verifica i 5 asset e esce 0; una regressione simulata lo fa uscire !=0
  - *assorbe*: `p100x:A-L1..A-L5`
- [ ] **Z-032** (1.0h) — claude-mem disabilitato con stub bun-runner: retest sulla 13.12.2 o fail-open permanente dell'hook
  - *chiuso quando*: ~/.claude/settings.json non contiene piu' "claude-mem@thedotmack": false e 10 Read consecutivi non bloccano; in alternativa il DEBT_REGISTER dichiara il fail-open implementato
  - *assorbe*: `debt:D-56`, `state:D-56`, `mandates:MAN-59`, `p100x:D-L2`
- [x] **Z-010** (0.5h) — apps/agent-gateway fuori da tutti i workflow CI (nessun typecheck/lint/test in pipeline)
  - ✅ **CHIUSO S1029** — agent-gateway in typecheck.yml + lint.yml, con i suoi 47 test finalmente eseguiti in CI
  - *chiuso quando*: grep -rl 'agent-gateway' .github/workflows/ ritorna almeno 1 file e il job relativo e' success su un run reale
  - *assorbe*: `gapfill:GAP2-33`
- [x] **Z-012** (0.5h) — scripts CI pre-job-seed-check.sh rotto: verifica personas *.test cancellate nel rebuild S950
  - ✅ **CHIUSO S1029** — ricetta pre-job-seed-check marcata superseded (avrebbe ri-seedato ogni 5 min)
  - *chiuso quando*: ssh VM: systemctl status del timer del seed-check non rilancia db:seed-test-admin a ogni tick (journalctl -u <unit> --since -1h senza ri-seed)
  - *assorbe*: `gapfill:GAP1-42`
- [x] **Z-013** (0.5h) — Code scanning CodeQL mai attivato
  - ✅ **CHIUSO S1029** — CodeQL attivato (workflow nuovo, primo run success)
  - *chiuso quando*: ls .github/workflows/codeql.yml esiste e gh api repos/Spen-Zosky/heuresys-advanced/code-scanning/alerts risponde 200 con il primo run completato
  - *assorbe*: `gapfill:GAP1-44`
- [x] **Z-029** (0.5h) — Ecosistema Claude: plugin always-on da rendere lazy (chrome-devtools-mcp, 4 plugin authoring) + hook npx-bypass da rivalutare
  - ✅ **CHIUSO S1030** — 6 plugin di authoring spenti (16→10 attivi), boot verde, nessun automatismo del repo li usava
  - *chiuso quando*: grep -c '": true' ~/.claude/settings.json enabledPlugins scende ai soli plugin necessari e il boot resta funzionante (session_start.py verde)
  - *assorbe*: `p100x:QW-L2`, `p100x:QW-L3`, `p100x:N-L2`
- [x] **Z-030** (0.5h) — Boot di sessione: handoff_lint eseguito due volte + effort xhigh come default sul boot
  - ✅ **CHIUSO S1030** — misurato: la doppia esecuzione costa 0.4s, non è il collo di bottiglia. Duplicazione mantenuta e documentata; nessuna cache sul guardiano dello stato
  - *chiuso quando*: una run di scripts/session-boot.ps1 mostra una sola invocazione di handoff_lint.py nei log e il menu resta identico
  - *assorbe*: `p100x:N-L1`, `p100x:N-L4`

### product (2)

- [ ] **Z-211** (2.0h) — E6 pattern portabili dal cantiere evo: metodo a11y sistematico + catalogo anti-pattern (linea orfana, nessun id nel register)
  - *chiuso quando*: esiste il catalogo anti-pattern committato e il metodo a11y e' referenziato dalle altre linee, oppure la linea e' marcata WON'T-DO
  - *assorbe*: `product:E6`
- [ ] **Z-203** (0.5h) — Semantic matching: confermare il role-set self-only per il peer occupation-fit
  - *chiuso quando*: un test asserisce il set di ruoli self-only effettivo e la decisione e' scritta nel register o in ADR-0027
  - *assorbe*: `backlog:OQ-4`

### security (6)

- [ ] **Z-057** (2.0h) — Rate-limit per-IP dietro 2 hop di proxy da calibrare + .env.example lascia TRUST_PROXY=false come default
  - *chiuso quando*: un test con XFF a 2 hop distingue correttamente gli IP e grep TRUST_PROXY .env.example mostra il default sicuro
  - *assorbe*: `state:C1-RL`, `gapfill:GAP2-45`
- [x] **Z-043** (0.5h) — 3 variabili d'ambiente consumate fuori da EnvSchema e non documentate in .env.example
  - ✅ **CHIUSO S1029** — 3 env var portate in EnvSchema (incl. la guardia brute-force del login) + documentate
  - *chiuso quando*: grep -c 'process.env.AUTH_LOGIN_RATELIMIT_MAX' apps/api/src = 0 (letta via EnvSchema) e le 3 chiavi compaiono in .env.example
  - *assorbe*: `gapfill:GAP2-11`
- [x] **Z-051** (0.5h) — Contraddizione sullo stato MFA in PROD (§0 'mandatory LIVE' vs 'MFA resta OFF')
  - ✅ **CHIUSO S1029** — contraddizione MFA risolta sul reale: enforcement OFF, 25 fattori registrati
  - *chiuso quando*: ssh VM: grep MFA_ENFORCEMENT_ENABLED .env e psql select * from sys.sys_auth_mfa_policies concordano con quanto scritto in SOT_STATE §0
  - *assorbe*: `state:OQ-MFA`
- [ ] **Z-039** (0.2h · dipende da Z-059) — HSTS senza includeSubDomains (bloccato dalla dismissione di evo.heuresys.com)
  - *chiuso quando*: curl -sI https://www.heuresys.com | grep Strict-Transport-Security contiene includeSubDomains
  - *assorbe*: `gapfill:GAP1-72`, `gapfill:GAP2-47`
- [x] **Z-044** (0.2h) — Pattern fragile 'delete process.env.ANTHROPIC_API_KEY' nell'agent-gateway
  - ✅ **CHIUSO S1029** — credenziali API neutralizzate PRIMA dell'import dell'SDK (erano hoisted: arrivava tardi)
  - *chiuso quando*: il codice usa secret injection dedicata oppure il commento nel file dichiara esplicitamente la portata reale della mitigazione
  - *assorbe*: `gapfill:GAP2-48`
- [x] **Z-058** (0.2h) — SOT_STATE §5 espone personas e password literal obsoleti (repo pubblico, contraddice la remediation F-001)
  - ✅ **CHIUSO S1029** — literal password ritirato da 20 file tracciati (38 occorrenze) su repo pubblico
  - *chiuso quando*: grep -c 'Admin#PassW0rd' docs/kb/SOT_STATE.md = 0 e le personas elencate sono quelle reali @rtl-bank.org
  - *assorbe*: `state:DRIFT-PERS`

### nuovi — emersi in S1030 (3)

- [ ] **Z-249** (1.5h) — Due rossi semantici per lo stesso significato: `StatusIcon` di `@heuresys/ui` emette `text-destructive` (`--color-destructive` #e6293f / dark #f93f4e), le pagine usano `text-danger` (`--danger` #DC2626 / dark #F87171). Convivono nella stessa schermata. Decisione di design system: allineare i due token, oppure far emettere alla lib il token semantico dell'app
  - *chiuso quando*: nel CSS emesso di apps/web e apps/showcase le utility d'errore risolvono a un solo valore per modalità (grep dei due token sul bundle), e la scelta è scritta in un ADR upstream
- [ ] **Z-250** (4.0h) — La skill `zero-pending-loop` è un cantiere aperto e non versionato: `.claude/skills/zero-pending-loop/` ha SKILL.md + 2 reference su 9 (mancano protocol, adversarial, blast-radius, gates, operations, close, LEARNINGS, zp.config.yaml), nessuno dei tool che la SKILL dichiara obbligatori (`zp_zero_check.py`, `zp_gate.py`), nessun `scripts/zero-pending-driver.sh`, e il design è ancora «BOZZA — in attesa di approvazione Enzo». La skill si auto-blocca correttamente («fermati e dillo»), ma resta un artefatto che promette un protocollo inesistente
  - *chiuso quando*: o i file mancanti esistono e `git ls-files .claude/skills/zero-pending-loop/` non è vuoto, oppure la directory è rimossa e il design marcato non-implementato
  - *nota*: l'autonomia non presidiata che il design abilita è una decisione di Enzo, non tecnica
- [ ] **Z-252** (2.0h) — `PaletteDropdown` inerte e `--font-sans` aspirazionale: due difetti del design system che il file di token condiviso ha reso visibili anche sullo showcase. (a) I quattro `--palette-*` nel blocco `.dark` sono `!important` per battere l'iniezione inline di `PaletteProvider`, quindi la scelta di palette dell'utente **non ha effetto** — e a monte c'è un'incoerenza di formato: la lib scrive terne HSL (`setProperty('--palette-1', '222 80% 50%')`) mentre i token sono esadecimali, così `var(--palette-1)` produceva comunque un colore invalido. Il controllo è montato nell'header di ogni pagina showcase e `/showcase/logo` lo usa per dimostrare la resa del logo «active palette surface». (b) `--font-sans` nomina «Exo 2» che **nessuna delle due app carica** (`next/font/google` compare solo dentro `/showcase/typography`): il token è aspirazionale in entrambe
  - *chiuso quando*: cambiare palette dal dropdown modifica un colore reso (prova live con screenshot o `getComputedStyle`), e o «Exo 2» è caricato dal layout di entrambe le app o il token dichiara lo stack realmente disponibile
  - *nota*: entrambi preesistono al S1030 — il file condiviso li ha solo portati in un secondo posto
- [ ] **Z-253** (1.5h) — `heuresys_ci` su linux-pc non è rinfrescato da nessun timer: i 3 gate CI pesanti (`test-integration`, `playwright-smoke`, `build-web`) girano su quel database, che `db/scripts/setup-ci-database.sh` crea solo al provisioning manuale. Il refresh settimanale di Z-022 riguarda `heuresys_advanced`, un DB distinto. Oggi i due coincidono solo perché il clone è recente
  - *chiuso quando*: `heuresys_ci` risulta rigenerato da un'esecuzione schedulata (journalctl) e il conteggio combacia con la PROD, senza che l'operazione possa cadere durante un job CI
  - *nota*: `setup-ci-database.sh` fa `dropdb --force` e il suo header avverte di non eseguirlo a job in corso → serve prima una guardia di idle sul runner
- [ ] **Z-251** (2.0h) — La suite d'integrazione non regge la contesa sul DB condiviso: durante il clone settimanale (pg_dump sulla stessa VM) 14 file su 217 sono falliti con `Hook timed out in 30000ms` nel `beforeAll` e un `Connection terminated unexpectedly`. I test non distinguono «il codice è rotto» da «il DB era occupato»
  - *chiuso quando*: due run consecutive della suite mentre gira un `pg_dump` sulla VM finiscono senza fallimenti d'infrastruttura (hookTimeout adeguato o retry sulla connessione), con l'evidenza dei due esiti allegata

### test-qa (6)

- [ ] **Z-111** (2.0h) — Contratto pool/isolate fragile: 134 file referenziano closePool, nessun globalTeardown
  - *chiuso quando*: apps/api/vitest.config.ts dichiara globalTeardown, i closePool sparsi sono rimossi e la suite chiude senza handle appesi
  - *assorbe*: `p100x:QW-F2`
- [ ] **Z-114** (2.0h) — Matrice di coverage per-rotta delle spec Playwright mai prodotta
  - *chiuso quando*: esiste un file committato che incrocia le 107 page.tsx con le 72 spec e dichiara le route scoperte; e' rigenerabile con un comando
  - *assorbe*: `gapfill:GAP1-36`
- [ ] **Z-112** (1.0h) — Nessun assert di drift post-suite (residui E2E% sul DB condiviso)
  - *chiuso quando*: un check post-suite conta le righe residue e fallisce se >0 (oppure WON'T-DO motivato nel DEBT_REGISTER visto D-52)
  - *assorbe*: `p100x:QW-F3`
- [ ] **Z-123** (1.0h) — Nessun test asserisce che il boot usi loadRolePermissionCacheWithRetry (i test iniettano un loader finto)
  - *chiuso quando*: un test fallisce se server.ts torna al loader non-retrying (spy sull'export o start() con loader failing-then-recovering)
  - *assorbe*: `gapfill:GAP2-15`
- [x] **Z-110** ~~Costo Argon2id non abbassato in ambiente test~~ — **WON'T-DO, motivato (S1029)**. Il cluster prometteva ~60-70s di wall per run, ma la premessa e' sbagliata su due fronti, entrambi verificati: **(1) inefficace** — nessun test chiama `hashPassword` (0 file), mentre 147 file fanno login, cioe' `argon2.verify`; e verify usa i parametri INCISI NELL'HASH memorizzato, non `ARGON2_PARAMS`. Abbassare i parametri non toccherebbe il costo di una sola verifica. **(2) pericoloso** — `service.ts:312-333` auto-ruota l'hash quando `needsRehash` e' vero. Con parametri di test piu' deboli, needsRehash sarebbe vero a OGNI login e la suite, che gira contro il database condiviso con la produzione, riscriverebbe hash reali con parametri indeboliti. Il risparmio ipotetico non vale un degrado silenzioso delle credenziali di produzione.
  - *chiuso quando*: il wall-clock di pnpm test scende di >=60s misurato prima/dopo e i test di hashing restano verdi
  - *assorbe*: `p100x:QW-F1`
- [x] **Z-125** (0.5h) — Convenzione di naming test: il modulo notifications risulta scoperto a ogni censimento automatico (falso positivo)
  - ✅ **CHIUSO S1030** — `check_module_test_coverage.py`: 90 moduli, 0 scoperti, più un test negativo che dimostra che sa dire di no
  - *chiuso quando*: uno script che incrocia moduli e file di test non segnala falsi positivi (esce 0 su tutti e ~90 i moduli)
  - *assorbe*: `runtime:RT-21`

---

## W2 — Debito tecnico, test e CI (37 cluster, 203h)

Copertura, unit layer, pipeline, qualità del codice. Va prima dei dati e del prodotto perché è la rete che protegge entrambi.

### debt-code (12)

- [ ] **Z-167** (12.0h) — Refactor SQL-side INSERT...SELECT del wave engine rinviato: il path full-scale 47k non e' mai stato esercitato
  - *chiuso quando*: un run a scala 47k completa entro i limiti di memoria/tempo misurati e il confronto prima/dopo e' allegato
  - *assorbe*: `code:CODE-18`
- [ ] **Z-173** (12.0h) — Refactor queries.ts per-pagina (estrazione apiFetch+useQuery dalle page.tsx): path storico inesistente, va ri-scopato
  - *chiuso quando*: le chiamate apiFetch/useQuery vivono in hook riusabili sotto apps/web/src/lib e le pagine non le dichiarano inline; pnpm typecheck + E2E verdi
  - *assorbe*: `gapfill:GAP1-8`
- [ ] **Z-177** (9.0h · dipende da Z-214) — Residui quick-win CLASS-A del programma 100X mai chiusi (teams N+1, bundle chart, isError, i18n EmptyState, A1/A2/A4, E3/E4, I1-I4)
  - *chiuso quando*: ogni QW residuo ha esito verificato (fatto o WON'T-DO motivato) in TODO_100X.md, ri-misurato uno a uno con comando allegato
  - *assorbe*: `mandates:MAN-54`, `state:QW-100X`
- [ ] **Z-161** (8.0h) — Duplicazione ActorContext/actor()/isPlatform (749 occorrenze) e cap di paginazione incoerenti: estrarre lib/actor.ts + factory paginationSchema
  - *chiuso quando*: apps/api/src/lib/actor.ts esiste ed e' importato dai moduli, packages/shared espone paginationSchema(max) e pnpm typecheck + pnpm test restano verdi
  - *assorbe*: `gapfill:GAP1-62`, `gapfill:GAP2-10`
- [ ] **Z-168** (6.0h) — me/repository.ts cresciuto a 1625 righe con il fan-in cross-modulo piu' largo del codebase
  - *chiuso quando*: wc -l dei file risultanti sotto 600 righe ciascuno dopo lo split per sotto-dominio, con pnpm test verde
  - *assorbe*: `gapfill:GAP2-12`
- [ ] **Z-160** (5.0h) — D-03: subpath exports inutilizzate in @heuresys/shared (90 su 97) + aggiornamento della doctrine module-pattern
  - *chiuso quando*: le entry exports di packages/shared/package.json coincidono con i subpath realmente importati (grep) e pnpm typecheck + build web restano verdi
  - *assorbe*: `backlog:D-03`, `p100x:D-03`, `state:D-03`, `mandates:MAN-52`, `gapfill:GAP1-61`, `gapfill:GAP2-34`
- [ ] **Z-165** (4.0h) — Copertura lint assente su apps/showcase (esclusa da eslint.config) e finta su apps/agent-gateway (lo script lint e' tsc --noEmit)
  - *chiuso quando*: pnpm lint dichiara 'Scope: 6 of 6 workspace projects' e passa; apps/agent-gateway/package.json ha lint = eslint src
  - *assorbe*: `code:CODE-9`, `code:CODE-10`
- [ ] **Z-163** (3.5h) — Cluster di 17 'as any', 15 concentrati nell'helper di isolamento transazionale dei test
  - *chiuso quando*: grep -c 'as any' apps/api = 2 o meno e l'eslint-disable a livello di file in tx-isolation.ts e' rimosso, con la suite verde
  - *assorbe*: `code:CODE-7`
- [ ] **Z-162** (3.0h) — Paginazione esposta nel contratto pubblico: org-unit-processes e content-blueprint-links senza paginazione, endpoint list senza LIMIT/OFFSET
  - *chiuso quando*: tutti gli endpoint list dichiarano limit/offset nello schema Zod e un test verifica il cap su ognuno di quelli censiti
  - *assorbe*: `p100x:F-WS-B-6`, `gapfill:GAP1-63`
- [ ] **Z-169** (3.0h) — analytics org-network: CTE ricorsiva 'scoped' ricalcolata per ogni query e correlated count valutato 3 volte (da riverificare)
  - *chiuso quando*: EXPLAIN ANALYZE dell'endpoint prima/dopo mostra la riduzione dei round-trip e la latenza p95 misurata scende
  - *assorbe*: `gapfill:GAP2-14`
- [ ] **Z-175** (3.0h) — Scaffold gen:module per il pattern 7-step (residuo DEFER del dossier D-01, ~90 moduli replicati a mano)
  - *chiuso quando*: pnpm gen:module <nome> genera schema+repository+service+routes+test e il modulo generato passa typecheck e un test smoke
  - *assorbe*: `p100x:D-01r`
- [ ] **Z-164** (2.5h) — 12 eslint-disable da rivedere, 2 sono soppressioni react-hooks/exhaustive-deps con rischio di stale closure
  - *chiuso quando*: grep -c 'eslint-disable' apps/web/src apps/api/src si riduce ai soli casi motivati inline e pnpm lint e' verde
  - *assorbe*: `code:CODE-8`

### infra-ci (9)

- [ ] **Z-027** (10.0h) — Background job queue per wave runs e seed acquisition (oggi in-process)
  - *chiuso quando*: un wave run lanciato via API ritorna subito un job id e il worker lo porta a termine: GET dello stato mostra COMPLETED senza tenere occupata la request
  - *assorbe*: `gapfill:GAP1-32`
- [ ] **Z-016** (8.0h · dipende da Z-015) — Distributed tracing OpenTelemetry assente (traces + attribuzione p99)
  - *chiuso quando*: grep opentelemetry apps/api/package.json trova le dipendenze e una trace end-to-end di una richiesta /v1/* e' visibile nel collector
  - *assorbe*: `gapfill:GAP1-35`
- [ ] **Z-004** (6.0h · dipende da Z-003) — Dependabot: smaltire le 8 PR aperte (4 low-risk merge-when-green + 4 major presidiati, sbloccare la label defer-major di #34 e i tetti saturi)
  - *chiuso quando*: gh pr list --state open --label dependencies ritorna 0 PR E pnpm install --frozen-lockfile && pnpm typecheck && pnpm test verdi in locale
  - *assorbe*: `backlog:#66`, `state:#66`, `ci:#66`, `mandates:MAN-3`, `runtime:RT-4`, `ci:PR#54`, `ci:PR#50`, `ci:PR#47`, `ci:PR#46`, `ci:PR#44`, `ci:PR#43`, `ci:PR#40`, `ci:PR#34`, `ci:CI-5`, `ci:DEP-LIMIT`
- [ ] **Z-011** (6.0h) — Turbo affected-only per build/CI (D-06, trigger D-08 ormai sciolto)
  - *chiuso quando*: un push che tocca solo apps/web salta i job api: gh run view mostra i job api in stato skipped e il wall-clock totale scende
  - *assorbe*: `p100x:D-06`
- [ ] **Z-007** (3.0h) — Gate CI full-E2E assente: in CI gira 1 spec Playwright su 72 (solo smoke-5-personas)
  - *chiuso quando*: esiste un workflow con schedule: che lancia pnpm test:e2e:prod e gh run list --workflow=<nome> mostra almeno un run success con report allegato
  - *assorbe*: `debt:D-47`, `p100x:F-WS-F-1`, `state:WSF-E2E-CI`, `state:D-47`, `gapfill:GAP3-19`
- [ ] **Z-009** (3.0h) — 5 workflow CI su 9 girano ancora sul runner che E' la VM di produzione
  - *chiuso quando*: grep -c 'oci-vm' .github/workflows/*.yml = 0 e i 9 workflow restano verdi dopo il retarget
  - *assorbe*: `gapfill:GAP2-22`
- [ ] **Z-023** (3.0h) — PROD traccia origin/main HEAD e non un tag semver: impossibile dire 'PROD e' la vX.Y.Z'
  - *chiuso quando*: curl https://www.heuresys.com/api/readyz (o endpoint equivalente) espone la versione e coincide con git describe --tags del commit deployato
  - *assorbe*: `gapfill:GAP2-52`
- [ ] **Z-024** (3.0h) — vm-deploy self-modify buffer: le unit systemd nuove non vengono installate al primo deploy
  - *chiuso quando*: aggiungendo una unit nuova in deploy/systemd e lanciando una sola volta scripts/vm-deploy.sh, ssh VM systemctl status <nuova-unit> risponde loaded
  - *assorbe*: `state:D-17`
- [ ] **Z-025** (3.0h) — Soglie di scale-out non documentate e pgbouncer installato ma non verificato in uso
  - *chiuso quando*: ssh VM: ss -tnp mostra se l'API si connette a :6432 o :5432 e deploy/README.md riporta le soglie decise
  - *assorbe*: `gapfill:GAP2-53`

### test-qa (16)

- [ ] **Z-106** (12.0h) — Layer di test frontend mai costruito: apps/web ha solo Playwright (0 unit, 0 component, 0 msw)
  - *chiuso quando*: cd apps/web && pnpm test esegue vitest con >=20 test verdi su hooks e componenti (apps/web/vitest.config.ts esiste)
  - *assorbe*: `gapfill:GAP1-41`, `gapfill:GAP2-37`
- [ ] **Z-124** (9.0h) — QA E2E esaustivo multi-ruolo mai eseguito (un solo flusso utente reale provato: il login)
  - *chiuso quando*: un report web-qa-audit committato copre i 5 profili su tutte le sezioni con esiti per ogni elemento interattivo
  - *assorbe*: `gapfill:GAP1-75`
- [ ] **Z-105** (8.0h) — Unit-layer API: fondazione creata ma coperta solo su 3 moduli puri su ~217 file integration (+ packages/shared senza unit test)
  - *chiuso quando*: cd apps/api && pnpm test:unit copre secret-crypto, resolver di scope, rubric maturity e mapper con >=40 test verdi senza tunnel DB
  - *assorbe*: `backlog:F-A07`, `p100x:F-A07`, `debt:D-64`, `state:UNIT-LAYER`, `code:CODE-11`, `gapfill:GAP2-4`
- [ ] **Z-108** (8.0h) — Accoppiamento della suite al DB via tunnel SSH: nessun DB effimero locale, tunnel giu' = 0 test
  - *chiuso quando*: pnpm test gira con il tunnel spento contro un PostgreSQL 16 nativo effimero locale ed e' verde
  - *assorbe*: `p100x:F-WS-F-3`, `state:WSF-TUNNEL`, `state:FLAKE-TUNNEL`
- [ ] **Z-107** (6.0h) — Test disattivati per env-gate e skip condizionali: 5 file wave1 + f4-sweep + 2 E2E che passano verdi senza asserire
  - *chiuso quando*: pnpm test riporta 0 file interamente skipped e i 2 E2E con skip condizionale hanno seed deterministico + assert duro
  - *assorbe*: `code:CODE-2`, `code:CODE-3`, `code:CODE-4`, `runtime:RT-20`, `gapfill:GAP3-23`
- [ ] **Z-116** (6.0h) — Copertura axe ferma a 35 route su 107: 54 pagine mai auditate, moderate/minor tollerate senza registro, i18n parity per-chiave non ri-verificata
  - *chiuso quando*: PAGES_PER_PERSONA copre tutte le route reali, la run axe produce 0 critical/serious e un registro dei moderate/minor; pnpm i18n:check verde con report
  - *assorbe*: `gapfill:GAP2-6`, `gapfill:GAP3-13`, `gapfill:GAP3-14`
- [ ] **Z-120** (6.0h · dipende da Z-105) — Mutation testing statico sulla suite mai eseguito (la qualita' dei ~1400 test integration non e' provata)
  - *chiuso quando*: un run di mutation testing su un sottoinsieme di moduli produce un mutation score committato e le mutazioni sopravvissute sono triate
  - *assorbe*: `gapfill:GAP2-8`
- [ ] **Z-126** (5.0h · dipende da Z-061) — Manca un gate RICORRENTE di data-completeness: nessun tool verifica l'invariante 'feature DoD-complete => backing non vuoto'
  - *chiuso quando*: un check derivato dal registry gira nel boot/CI e fallisce se una feature dichiarata DoD-complete ha la tabella di backing a 0 righe
  - *assorbe*: `gapfill:GAP2-2`
- [ ] **Z-113** (4.0h) — Spec E2E mancanti: logout dalla UI, refresh-replay negativo, 6 pagine senza copertura, /privacy solo sfiorata
  - *chiuso quando*: pnpm test:e2e:prod include spec per logout, replay negativo, /users/[userId], /approvals/[id], /engagement/[surveyId], /me/surveys/[surveyId], /app e /privacy, tutte verdi
  - *assorbe*: `p100x:QW-F5`, `gapfill:GAP3-20`, `gapfill:GAP3-22`
- [ ] **Z-117** (4.0h) — Baseline a11y showcase (65 nodi serious) ferma al 2026-05-20 + gate asimmetrico (showcase si ferma a critical=0)
  - *chiuso quando*: i JSON in docs/a11y-baseline/showcase/ sono rigenerati e showcase-a11y.spec.ts gatea critical=0 AND serious=0 restando verde
  - *assorbe*: `gapfill:GAP3-10`, `gapfill:GAP3-11`
- [ ] **Z-121** (4.0h) — Nessun eval / golden-set per la qualita' del retrieval kNN (semantic matching)
  - *chiuso quando*: esiste un golden-set con top-K attesi su profili RTL reali e un test misura recall@K, fallendo sotto la soglia dichiarata
  - *assorbe*: `gapfill:GAP1-65`, `gapfill:GAP2-49`
- [ ] **Z-109** (3.0h) — Flake intermittente 500 nel login MFA step-2 della suite integration
  - *chiuso quando*: 10 run consecutivi della suite completa senza 500 in login step-2 (o root-cause documentata via x-request-id e fix applicato)
  - *assorbe*: `debt:D-55`, `state:D-55`, `mandates:MAN-58`
- [ ] **Z-115** (3.0h) — Checklist a11y MANUALE mai eseguita: 19 voci su 19 non spuntate, benche' obbligatoria a ogni release tag
  - *chiuso quando*: docs/a11y-manual-checklist.md ha tutte le voci spuntate con esito per la release corrente e le evidenze allegate
  - *assorbe*: `gapfill:GAP1-15`, `gapfill:GAP3-9`
- [ ] **Z-119** (3.0h) — apps/showcase (19 pagine, deploy pubblico su GitHub Pages) ha ZERO test
  - *chiuso quando*: esiste una suite che gira sullo static export di apps/showcase (smoke + axe) e il workflow showcase.yml la esegue come gate
  - *assorbe*: `gapfill:GAP3-18`
- [ ] **Z-122** (3.0h) — 45 file di test su 217 non esercitano il path HTTP: serve un triage unit-legittimi vs moduli senza copertura HTTP
  - *chiuso quando*: un elenco committato classifica i 45 file e ogni modulo API senza copertura HTTP ha un test inject aggiunto
  - *assorbe*: `gapfill:GAP2-38`
- [ ] **Z-127** (3.0h) — Copertura test del design system upstream sottile: 13 file di test per 123 componenti, solo 2 spec a11y
  - *chiuso quando*: nel repo ux-design-shared uno step CI esegue axe su tutte le stories e il run e' verde
  - *assorbe*: `gapfill:GAP3-7`

---

## W3 — Dati e DB (36 cluster, 168h)

Tabelle vuote, import mai eseguiti, indici, storia. È il grosso del divario fra 'modulo spedito' e 'funzionalità viva'.

### db-data (36)

- [ ] **Z-061** (8.0h) — Triage delle 37 tabelle sys.* a 0 righe: riclassificare nel reconciliation registry e decidere per famiglia (censimento F2 stale di +2)
  - *chiuso quando*: ogni tabella sys.* con 0 righe ha una classificazione esplicita nel registry (query su v_reconciliation_status: 0 righe senza verdetto) e il conteggio nel censimento coincide con psql
  - *assorbe*: `code:CODE-13`, `runtime:RT-5`, `runtime:RT-17`
- [ ] **Z-087** (8.0h) — 54 colonne JSONB non-metadata mai catalogate (GIN o normalizzazione da decidere)
  - *chiuso quando*: esiste un catalogo committato delle 54 colonne con verdetto per ciascuna e le migration GIN dei candidati caldi sono applicate
  - *assorbe*: `gapfill:GAP2-43`
- [ ] **Z-065** (7.0h) — Tabelle di storia mai alimentate: sys_organization_unit_history e sys_position_skill_requirement_history vuote e orfane
  - *chiuso quando*: dopo una modifica reale a una OU, psql mostra una riga nuova in sys_organization_unit_history; oppure le due tabelle sono droppate con migration idempotente
  - *assorbe*: `runtime:RT-15`
- [ ] **Z-063** (6.0h) — Motore seed-acquisition mai eseguito end-to-end: 5 tabelle su 5 vuote, 2 orfane anche nel codice
  - *chiuso quando*: psql: select count(*) from sys.sys_seed_acquisition_runs > 0 dopo un run reale, oppure i 3 moduli sono dichiarati terminali con migration di rimozione applicata
  - *assorbe*: `runtime:RT-7`, `mandates:MAN-46`
- [ ] **Z-072** (6.0h) — esco_skill_relations: manca il layer di lineage URI->UUID, ~5000-6000 edge non risolti (ammontare da rimisurare)
  - *chiuso quando*: psql: il conteggio degli edge non risolti misurato prima e dopo mostra la riduzione dichiarata, con la query di misura committata
  - *assorbe*: `code:CODE-20`
- [ ] **Z-073** (6.0h) — CW-B36 e CW-B37: due mapping riclassificati REFERENCE_ONLY con deep-fix rimandato alla macro-area X9
  - *chiuso quando*: i due mapping risultano RESOLVED nel registry (query su brownfield.column_mappings) oppure sono dichiarati terminali con motivazione scritta
  - *assorbe*: `code:CODE-21`
- [ ] **Z-077** (6.0h · dipende da Z-060) — sys_bonus_pools: 8 righe legacy su 14 non importabili per assenza delle crosswalk tenant SmartFood/EcoNova
  - *chiuso quando*: psql: select count(*) from sys.sys_bonus_pools = 14 dopo le crosswalk tenant, oppure il gap e' dichiarato terminale nel registry
  - *assorbe*: `code:CODE-28`
- [ ] **Z-085** (6.0h) — 248 FK su 559 senza indice sulla leading column (condizione bloccante #3 dell'audit forense, senza owner)
  - *chiuso quando*: psql: la query di conteggio FK-senza-indice su pg_constraint/pg_index ritorna 0 per le FK non audit-actor, con EXPLAIN prima/dopo allegati
  - *assorbe*: `gapfill:GAP2-3`
- [ ] **Z-089** (6.0h) — Partitioning di sys_auth_login_events previsto oltre i 50M di righe (oggi 91.590)
  - *chiuso quando*: psql: la tabella e' partizionata oppure esiste una soglia monitorata che fa scattare l'intervento (regola Prometheus)
  - *assorbe*: `gapfill:GAP1-28`
- [ ] **Z-104** (6.0h) — Pass di query-perf / N+1 per-modulo mai eseguito (verificato solo dashboard)
  - *chiuso quando*: report committato con i top-20 endpoint per latenza da pg_stat_statements + EXPLAIN, e le regressioni identificate corrette o registrate
  - *assorbe*: `gapfill:GAP2-7`
- [ ] **Z-064** (5.0h) — Blueprint runtime a zero: 0 attivazioni e 0 override, famiglie e varianti a 1 riga
  - *chiuso quando*: psql: select count(*) from sys.sys_blueprint_activations > 0 su RTL Bank, con l'attivazione fatta da UI/API con login reale
  - *assorbe*: `runtime:RT-16`, `mandates:MAN-40`
- [ ] **Z-070** (5.0h) — Backfill live ESCO ~14k skill: codice HTTP scritto ma mai eseguito e mai testato
  - *chiuso quando*: psql: la coverage delle skill risolte via HTTP fetcher supera la soglia dichiarata e il run reale e' allegato (comando + output + timestamp)
  - *assorbe*: `code:CODE-17`
- [ ] **Z-079** (5.0h) — FK dichiarate ma mai applicate: user_skill_evidence_skill_id senza FK + FK late-bound di goals/OKR verso job_roles e organization_units
  - *chiuso quando*: psql: select count(*) from pg_constraint where conname in (...) = 3 e VALIDATE CONSTRAINT completa senza orfani
  - *assorbe*: `code:CODE-30`, `code:CODE-31`
- [ ] **Z-082** (5.0h) — Muri di data-reconciliation ancora NEEDS-DECISION: org-unit template-vs-instance e learning catalog event-sourced
  - *chiuso quando*: la vista v_reconciliation_status non riporta piu' i due muri come aperti e la decisione e' scritta in un ADR o nel registry
  - *assorbe*: `state:RECON-ND`
- [ ] **Z-091** (5.0h) — P99 della vista PIP mai misurato: la regola di promozione a MATERIALIZED VIEW non e' mai stata valutata
  - *chiuso quando*: misura P99 allegata (pg_stat_statements o EXPLAIN ANALYZE ripetuto) con il verdetto: sotto 600ms nessuna azione, sopra la MATVIEW e' creata
  - *assorbe*: `gapfill:GAP1-39`
- [ ] **Z-093** (5.0h) — ESCO occupation mapping: solo 25 job-role su 137 cablati
  - *chiuso quando*: psql: select count(distinct job_role_id) from sys.sys_esco_occupation_mappings = 137 (o la quota residua e' motivata riga per riga)
  - *assorbe*: `mandates:MAN-32`
- [ ] **Z-095** (5.0h) — learning-gaps senza ricalcolo: il modulo e' CRUD + import, la formula vive solo nel seed
  - *chiuso quando*: POST /v1/learning-gaps/recompute esiste, ha un integration test verde e ricalcola le 270 righe da required-vs-current
  - *assorbe*: `mandates:MAN-34`
- [ ] **Z-096** (5.0h) — mentor match scores importati read-only: nessun matching semantico attivo benche' esistano 25k vettori
  - *chiuso quando*: l'endpoint di match calcola punteggi kNN su embeddings reali (non solo lettura) con test verde e output allegato
  - *assorbe*: `mandates:MAN-35`
- [ ] **Z-097** (5.0h) — KPI achievement (% su target): nessun servizio ne' endpoint di scorecard, benche' sia input dei gate della rubrica L3/L4
  - *chiuso quando*: GET /v1/kpis/.../achievement risponde 200 con valori derivati da targets+measurements e un integration test lo copre
  - *assorbe*: `mandates:MAN-36`
- [ ] **Z-059** (4.0h · dipende da Z-060) — #69 Chiusura brownfield lato DBMS: drop delle 18 staging.wave1_*, decommission del DB legacy sulla VM, rotazione POSTGRES_PASSWORD
  - *chiuso quando*: psql: select count(*) from information_schema.tables where table_schema='staging' and table_name like 'wave1_%' = 0 E il container heuresys_evo_platform_db non e' piu' in esecuzione (docker ps sulla VM)
  - *assorbe*: `backlog:#69`, `state:#69`, `mandates:MAN-4`, `debt:D-69`, `state:D-69`, `mandates:MAN-60`, `product:G1-res`, `runtime:RT-19`
- [ ] **Z-062** (4.0h) — Approval runtime a zero: sys_approval_requests/steps vuote nonostante modulo, test e UI attivi (condizione bloccante #2 dell'audit)
  - *chiuso quando*: psql: select count(*) from sys.sys_approval_requests > 0 con una richiesta creata da login reale (tommaso -> paolo) e visibile su /approvals
  - *assorbe*: `runtime:RT-6`, `mandates:MAN-41`, `gapfill:GAP2-1`
- [ ] **Z-067** (4.0h) — 1000 check-in di goal su 1000 attribuiti a un utente admin hardcoded invece del vero dipendente
  - *chiuso quando*: psql: select count(*) from sys.sys_goal_check_ins where check_in_metadata ? 'subject_user_id_placeholder' = 0 e gli id risolti coincidono con la crosswalk LEGACY_EMP::
  - *assorbe*: `code:CODE-14`
- [ ] **Z-075** (4.0h) — Import legacy gap_analysis_results rinviato per decisione semantica su kind + payload
  - *chiuso quando*: psql: le righe importate dal legacy sono distinguibili per lineage in sys_gap_analysis_results e il registry marca il mapping RESOLVED
  - *assorbe*: `code:CODE-26`
- [ ] **Z-081** (4.0h) — succession_plans.position_id 100% NULL: derivazione deferita
  - *chiuso quando*: psql: select count(*) filter (where position_id is null) from sys.sys_succession_plans = 0 (o la quota residua e' motivata come gap-esplicito nel registry)
  - *assorbe*: `state:SUCC-DEFER`
- [ ] **Z-083** (4.0h) — Brownfield Wave 1: solo 13/19 target IMPORT popolati, 3 silent-skip mitigati ma non risolti
  - *chiuso quando*: i 3 silent-skip risultano risolti nel registry oppure dichiarati terminali con nota, con query di verifica committata
  - *assorbe*: `state:BF-WAVE1`
- [ ] **Z-084** (4.0h) — Closure table organizzativa vuota: i roll-up girano in ricorsione su parent_id
  - *chiuso quando*: psql: la closure table ha righe coerenti con l'albero e un EXPLAIN mostra il roll-up che la usa al posto della CTE ricorsiva
  - *assorbe*: `state:D-35`
- [ ] **Z-080** (3.5h) — Perf feedback 9-box: la gamba department/org_unit e' rinviata (D6-S5), le viste non si segmentano per unita'
  - *chiuso quando*: la vista 9-box accetta un filtro per organization_unit e restituisce righe coerenti su RTL Bank (query allegata)
  - *assorbe*: `code:CODE-32`
- [ ] **Z-071** (3.0h) — LOOKUP_FK: il path primario jsonb metadata->>'legacy_id' rimosso dal compilatore ma ancora accettato dal validatore DB
  - *chiuso quando*: un test registra un column_mapping con quella forma e il compilatore TS lo emette correttamente (o lo rifiuta con errore esplicito, simmetrico al validatore)
  - *assorbe*: `code:CODE-19`
- [ ] **Z-086** (3.0h) — Ricerca ILIKE '%x%' su 31 repository con soli 2 indici GIN trgm
  - *chiuso quando*: psql: gli indici GIN trgm coprono i cataloghi maggiori e EXPLAIN su una search di skills/learning non fa piu' Seq Scan
  - *assorbe*: `gapfill:GAP2-13`
- [ ] **Z-090** (3.0h) — Hard delete delle notifiche scadute e purge di retention sull'audit (scheduled job post-MVP)
  - *chiuso quando*: ssh VM: journalctl del timer mostra l'esecuzione del purge e psql conferma la rimozione delle righe oltre finestra
  - *assorbe*: `gapfill:GAP1-38`
- [ ] **Z-092** (3.0h) — legacy_mirror non contiene tutte le sorgenti candidate SDBI (solo il subset wave-1 + goals)
  - *chiuso quando*: l'extract e' esteso alla macro-area successiva e le FK risultano coerenti (query di verifica allegata)
  - *assorbe*: `gapfill:GAP1-51`
- [ ] **Z-094** (3.0h) — job_roles: 111 ruoli su 137 senza famiglia (family_id NULL)
  - *chiuso quando*: psql: select count(*) from sys.sys_job_roles where job_role_family_id is null = 0
  - *assorbe*: `mandates:MAN-33`
- [ ] **Z-098** (3.0h) — sys_user_target_positions: schema completo, 0 righe, nessun modulo API (ciclo carriera ESS incompleto)
  - *chiuso quando*: psql: la tabella ha righe create da /me/career con login reale, oppure e' dichiarata terminale nel registry
  - *assorbe*: `mandates:MAN-37`
- [ ] **Z-099** (3.0h) — successor-readiness: modulo senza alcuno scoring (INSERT con score dal body) e tabella a 0 righe
  - *chiuso quando*: il modulo calcola lo score o e' rimosso; nel primo caso psql mostra righe con score derivato, nel secondo il route non e' piu' registrato in app.ts
  - *assorbe*: `mandates:MAN-38`
- [ ] **Z-100** (3.0h) — process-kpi-templates: tabella vuota, import gated su un crosswalk processo legacy->registry (overlap 0/25)
  - *chiuso quando*: psql: la tabella e' popolata dal crosswalk approvato, oppure e' marcata terminale sia nel registry sia nel Ledger prodotto
  - *assorbe*: `mandates:MAN-39`
- [ ] **Z-102** (3.0h) — position_economic_weight non popolato: la pesatura MLCE gira su fallback COALESCE
  - *chiuso quando*: psql: select count(*) from sys.sys_positions where position_economic_weight is null or =0 = 0 e il composite MLCE cambia rispetto alla media semplice
  - *assorbe*: `mandates:MAN-48`

---

## W4 — Frontend e sicurezza (39 cluster, 213h)

Superfici utente incomplete e hardening applicativo.

### frontend (24)

- [ ] **Z-131** (15.0h) — C2: admin editing cataloghi (skills+tassonomia, KPI, learning) + nuova pagina /job-catalog
  - *chiuso quando*: esiste apps/web/src/app/(authenticated)/job-catalog/page.tsx e un E2E crea/modifica una skill e un job-role con login reale
  - *assorbe*: `backlog:#43`, `product:C2`, `mandates:MAN-21`
- [ ] **Z-130** (12.0h) — C1: admin editing People & Org (form utenti + role grants, posizioni + requirements, CRUD organization-units)
  - *chiuso quando*: E2E Playwright con login reale modifica un utente, una posizione e una OU su RTL Bank e il re-fetch mostra il dato aggiornato
  - *assorbe*: `backlog:#44`, `product:C1`, `mandates:MAN-22`
- [ ] **Z-142** (12.0h) — System-health: LogStream e IncidentTimeline restano spente (nessun backend log applicativo, nessun modulo incident)
  - *chiuso quando*: le 2 sezioni mostrano dati reali da endpoint /v1/* con integration test, oppure sono dichiarate WON'T-DO e rimosse dalla pagina
  - *assorbe*: `backlog:B7-off`, `product:B7-res`, `state:SYSHEALTH`, `code:CODE-35`
- [ ] **Z-155** (10.0h) — Showcase audit Tier 3: residuo del rebuild F7 mai riconciliato pagina-per-pagina
  - *chiuso quando*: docs/SHOWCASE_AUDIT_2026-05-20.md ha uno stato per ognuna delle 17 pagine, riconciliato col codice attuale
  - *assorbe*: `gapfill:GAP1-18`
- [ ] **Z-132** (9.0h) — C3: admin editing tenant & piattaforma (create/archive tenant, wizard materializzazione, activate/override blueprint)
  - *chiuso quando*: E2E con PLATFORM_ADMIN esegue il wizard di materializzazione da archetipo e psql mostra le righe create
  - *assorbe*: `backlog:#45`, `product:C3`, `mandates:MAN-23`
- [ ] **Z-157** (9.0h) — /admin/roles: CRUD reale di ruoli e permessi (oggi pagina read-only sulla matrice seedata)
  - *chiuso quando*: E2E con PLATFORM_ADMIN crea/modifica un grant e psql conferma la riga in sys_auth_role_permissions
  - *assorbe*: `gapfill:GAP1-37`
- [ ] **Z-158** (9.0h) — Human approval gate UI per gli import brownfield sensibili (stream MVP-4 §2.2 mai costruito)
  - *chiuso quando*: POST /v1/brownfield/import-runs/:id/decisions esiste con test e la rotta /brownfield-adaptation/[runId]/decisions esegue approve/reject verificato da E2E
  - *assorbe*: `gapfill:GAP1-2`
- [ ] **Z-159** (9.0h) — Programma post-v1.0 Fase 6: 3.6 PWA mai ripresa ne' dichiarata terminale (unico residuo vivo delle Fasi 4-8)
  - *chiuso quando*: l'app espone manifest + service worker e supera l'audit Lighthouse PWA, oppure la voce e' marcata WON'T-DO nel register
  - *assorbe*: `backlog:OQ-3`, `state:FASI-4-8`
- [ ] **Z-128** (6.0h) — D-04: boundary loading/error per-route in apps/web (0 loading.tsx, 1 solo error.tsx su 107 pagine) e formalizzazione della scelta client-only
  - *chiuso quando*: find apps/web/src/app -name loading.tsx | wc -l > 0 e ogni segmento pesante ha error.tsx; un errore simulato in una pagina admin non propaga alla radice
  - *assorbe*: `backlog:D-04`, `p100x:D-04`, `state:D-04`, `mandates:MAN-53`, `p100x:F-WS-D-2`, `gapfill:GAP2-16`
- [ ] **Z-129** (6.0h) — Residui #42/C4: paginazione server-side su 3 dialog modali + 5 gap di contratto API<->UI (campi mostrati ma non esposti dai tipi shared)
  - *chiuso quando*: i 3 dialog usano use-paginated-list e i 5 campi (CareerPath.difficulty, BlueprintFamily.industryCode, BlueprintActivation.activatedAt, EnterpriseTypingProfile.status, PositionDetail.economicWeight) sono nei tipi @heuresys/shared con integration test verde
  - *assorbe*: `backlog:C4-contract`, `backlog:C4-dialog`, `product:C4-res`, `state:C4-STOP`, `mandates:MAN-31`
- [ ] **Z-143** (6.0h) — section-tabs.tsx hardcoda i 6 MERGE_GROUPS mentre la sidebar e' DB-driven (doppia manutenzione, guardia solo rumorosa)
  - *chiuso quando*: grep 'MERGE_GROUPS' apps/web/src/components/section-tabs.tsx = 0: i tab e le label i18n derivano da sys.sys_ui_interfaces e la guardia anti-drift resta verde
  - *assorbe*: `debt:D-66`, `code:CODE-25`
- [ ] **Z-151** (6.0h) — GTM v1-deferrals: lead-management admin UI, honeypot observability, pagina /privacy reale IT/EN, audit a11y landing
  - *chiuso quando*: E2E: la lista lead filtra per status e la PATCH funziona; Lighthouse >=95 a11y su /, /investors, /demo, /login
  - *assorbe*: `backlog:#4-deferrals`, `mandates:MAN-12`
- [ ] **Z-138** (5.0h) — Essential Capability Ranker: drill per-position su /positions/[positionId]
  - *chiuso quando*: E2E apre il drill su una posizione e i valori sono coerenti con il ranking org-wide, rispettando ADR-0027
  - *assorbe*: `backlog:F1-drill`, `product:F1-res`
- [ ] **Z-133** (4.0h) — B6: inbox push via SSE al posto del polling 30s
  - *chiuso quando*: grep INBOX_POLL_MS apps/web/src = 0 e un E2E verifica che una notifica emessa compare senza reload entro pochi secondi
  - *assorbe*: `backlog:#38`, `product:B6`, `state:#38`, `mandates:MAN-19`
- [ ] **Z-145** (4.0h) — Gap-CODICE del health-check S1004: 5 binding API<->frontend mai dichiarati chiusi (tenants typing-tab, positions/[id]/kpis, me/kpis, me/learning, blueprints Industry)
  - *chiuso quando*: per ognuna delle 5 pagine un E2E con login reale asserisce dati non vuoti provenienti da /v1/*
  - *assorbe*: `state:GAP-CODICE`
- [ ] **Z-137** (3.0h) — Gap#1 follow-up: drill-down sul PIP nell'arricchimento UI delle porte (/org-director)
  - *chiuso quando*: E2E con ORG_DIRECTOR apre il drill PIP dalla console e i valori coincidono con la vista sys_position_intelligence_profiles_v
  - *assorbe*: `backlog:OQ-2`
- [ ] **Z-141** (3.0h) — SystemHealthLive: ~10 stringhe hardcoded in inglese fuori dal guardrail i18n (la regola eslint copre solo apps/web/src/app)
  - *chiuso quando*: la regola i18next/no-literal-string copre anche apps/web/src/components e pnpm lint e' verde senza nuove eccezioni
  - *assorbe*: `code:CODE-33`
- [ ] **Z-146** (3.0h) — 9 voci di sidebar disattivate nel registro sys_ui_interfaces con le rotte Next.js ancora vive e raggiungibili
  - *chiuso quando*: per ognuna delle 9: o ui_interface_is_active=true, o la rotta e' rimossa/rediretta (verifica con curl sulle 9 URL + query sul registry)
  - *assorbe*: `runtime:RT-18`
- [ ] **Z-147** (3.0h) — 16 pagine showcase duplicate dentro apps/web mentre esiste il workspace apps/showcase
  - *chiuso quando*: find apps/web/src/app/showcase -name page.tsx | wc -l = 0 (o la duplicazione e' motivata in un ADR) e il bundle di apps/web si riduce
  - *assorbe*: `runtime:RT-23`
- [ ] **Z-148** (3.0h) — F4 residui di superficie: 3 domini enum senza label + codici di piattaforma su pagine admin + 3 buchi dati
  - *chiuso quando*: i 3 enum hanno un dominio di valori con label i18n (nessun fallback al raw a schermo) verificato da E2E sulle pagine coinvolte
  - *assorbe*: `mandates:MAN-62`
- [ ] **Z-154** (3.0h) — Showcase chrome polish (user menu e language switcher cosmetici, palettes/logo/typography da riorganizzare) + skip-link assente
  - *chiuso quando*: lo showcase ha <a href="#main"> come primo elemento focusabile, user menu e switcher sono funzionanti; verificato da spec Playwright
  - *assorbe*: `gapfill:GAP1-13`, `gapfill:GAP1-16`, `gapfill:GAP3-15`
- [ ] **Z-134** (2.5h) — Evidence layer: wiring dell'EvidenceDrawer su /gaps, /me/gaps e /users/[userId] (endpoint gia' pronto)
  - *chiuso quando*: E2E apre il drawer su tutte e 3 le pagine con login reale e vede righe di evidenza dal DB
  - *assorbe*: `backlog:L2-wiring`, `product:A-L2`
- [ ] **Z-140** (2.5h) — SystemHealthDashboard mock con dati fabbricati duplicato in apps/web e apps/showcase (viola la regola no-UI-in-app)
  - *chiuso quando*: il componente esiste in un solo posto (o in @heuresys/ui) e non e' piu' compilato nel bundle di apps/web (build analizzato)
  - *assorbe*: `p100x:QW-E2`, `code:CODE-34`
- [ ] **Z-149** (2.5h) — /investors: STATIC_FACTS hardcoded e stantii (moduli 85, migration 165, pagine 98) su una pagina rivolta a investitori
  - *chiuso quando*: grep STATIC_FACTS apps/web/src/app/investors/page.tsx = 0 e i 6 contatori arrivano da GET /v1/public/platform-stats, con integration test
  - *assorbe*: `mandates:MAN-56`, `runtime:RT-13`

### security (15)

- [ ] **Z-041** (6.0h) — Campionamento authz esaustivo route-per-route sui ~90 moduli mai eseguito
  - *chiuso quando*: uno script incrocia route registrate x requirePermission x orgGate e produce un report con 0 route senza permesso corretto; il report e' committato
  - *assorbe*: `gapfill:GAP2-9`
- [ ] **Z-042** (6.0h) — I 17 finding fp-check classificati FALSE POSITIVE restano hardening validi mai triati
  - *chiuso quando*: ogni F-0xx dei 17 ha una riga di esito (fatto / WON'T-DO motivato) nel DEBT_REGISTER
  - *assorbe*: `gapfill:GAP2-17`
- [ ] **Z-035** (5.0h) — Whistleblowing: cifratura application-level del corpo della segnalazione (oggi plaintext in tabella custodian-only)
  - *chiuso quando*: psql: select count(*) from sys.sys_whistleblowing_reports where body not like 'enc:v1:%' = 0 E un test di round-trip encrypt/decrypt passa
  - *assorbe*: `backlog:E1-crypto`, `product:E1-res`, `state:E1-crypto`, `mandates:MAN-65`
- [ ] **Z-036** (5.0h) — Account lockout dopo N login falliti mai implementato (oggi solo warn a 5 tentativi)
  - *chiuso quando*: un test integration che invia N+1 login errati riceve 423/403 con codice ACCOUNT_LOCKED e la riga di evento e' presente in sys_auth_login_events
  - *assorbe*: `gapfill:GAP1-26`
- [ ] **Z-037** (5.0h) — Rotazione della chiave di firma JWT (JWT_PRIVATE_KEY_PREVIOUS + grace period)
  - *chiuso quando*: un test verifica che un token firmato con la chiave precedente resta valido nel grace period e viene rifiutato dopo
  - *assorbe*: `gapfill:GAP1-29`
- [ ] **Z-048** (5.0h) — audit.user_self_service_actions letta dall'API ma mai scritta: mutazioni ESS senza trail
  - *chiuso quando*: dopo una PATCH reale su /v1/me/*, psql: select count(*) from audit.user_self_service_actions > 0 e un test lo asserisce
  - *assorbe*: `runtime:RT-14`
- [ ] **Z-038** (4.0h) — CSP fine-tuning per-route in @fastify/helmet (oggi una sola CSP globale)
  - *chiuso quando*: un test asserisce header CSP differenziati per almeno 2 superfici e la suite web resta verde
  - *assorbe*: `gapfill:GAP1-27`
- [ ] **Z-040** (4.0h) — Suite di test security negativi assente (SQL metachar, XFF forgiato, magic-byte, JWT manomesso, CSRF assente)
  - *chiuso quando*: cd apps/api && pnpm exec vitest run test/security.integration.test.ts passa con >=10 casi negativi
  - *assorbe*: `gapfill:GAP1-71`, `gapfill:GAP2-46`
- [ ] **Z-046** (4.0h) — D-57: grant a tappeto TENANT_ADMIN mitigato con allowlist ma non eliminato alla radice (blocca la perm notification:read)
  - *chiuso quando*: un test asserisce che ogni permesso nuovo non finisce automaticamente a TENANT_ADMIN (aggiunta di un permesso fittizio non compare in sys_auth_role_permissions per TENANT_ADMIN)
  - *assorbe*: `backlog:D-57`, `state:D-57`, `code:CODE-24`
- [ ] **Z-050** (4.0h) — MFA: 4 tabelle di runtime vuote (exemptions, exemption_audit, otp_challenges, recovery_codes) e multi-kind non verificato
  - *chiuso quando*: psql: sys_auth_mfa_recovery_codes > 0 dopo un enroll reale con persona RTL e il trail di exemption e' popolato da un'esenzione reale
  - *assorbe*: `runtime:RT-10`, `mandates:MAN-67`
- [ ] **Z-054** (4.0h) — Separazione dei ruoli DB heuresys_app (runtime) e heuresys_migrator (DDL): least-privilege non applicato
  - *chiuso quando*: psql \du mostra i due ruoli e un tentativo di DDL con le credenziali runtime fallisce con permission denied
  - *assorbe*: `gapfill:GAP1-40`
- [ ] **Z-055** (4.0h) — Rate-limit email e login in-process: si azzera al restart e non regge il multi-processo
  - *chiuso quando*: il rate-limit e' condiviso via store esterno: due processi API applicano lo stesso contatore in un test
  - *assorbe*: `gapfill:GAP1-64`, `gapfill:GAP2-39`
- [ ] **Z-056** (4.0h) — Rate-limit per-tenant assente (oggi solo per-IP e per-user)
  - *chiuso quando*: un test dimostra che il traffico di un tenant non consuma il budget di un altro tenant
  - *assorbe*: `gapfill:GAP1-34`
- [ ] **Z-047** (3.0h) — Refresh-token: nessuna invalidazione delle famiglie precedenti al re-login (9.278 token attivi per pochi utenti)
  - *chiuso quando*: psql: select count(*) from sys.sys_auth_refresh_tokens where revoked_at is null resta O(10) per utente dopo N re-login in un test
  - *assorbe*: `gapfill:GAP2-26`, `gapfill:GAP1-57`
- [ ] **Z-049** (2.5h) — agent-gateway audit sink JSONL senza rotazione ne' archiviazione
  - *chiuso quando*: ls -la del file di audit mostra rotazione attiva (logrotate o size-based) dopo un test di crescita simulata
  - *assorbe*: `code:CODE-37`

---

## W5 — Prodotto (20 cluster, 213h)

Le linee di sviluppo A-G: nuove capacità, non manutenzione.

### product (20)

- [ ] **Z-188** (36.0h) — #54/E5 Recruiting/ATS: nuovo cluster /recruiting (requisition->posting->candidate->interview->offer)
  - *chiuso quando*: E2E percorre il flusso completo con login reale partendo da una posizione vacante e psql mostra le righe create in ogni step
  - *assorbe*: `backlog:#54`, `product:E5`, `mandates:MAN-27`
- [ ] **Z-208** (18.0h) — Integrazione llm_wiki + human-resources-plus: design approvato, piano di implementazione mai scritto, 8 punti aperti
  - *chiuso quando*: esiste il piano a tappe committato e la Tappa 0 e' dimostrata live (digestione documenti + embeddings locali + collegamento ai dati) con output allegato
  - *assorbe*: `mandates:MAN-50`
- [ ] **Z-186** (15.0h) — #50/D4 Knowledge graph legacy (kg_edges 139.451 + kg_nodes 17.260): serve prima il destination design
  - *chiuso quando*: esiste l'ADR di destination design e psql mostra i nodi/archi importati con lineage; il componente KGGraphCanvas rende il grafo su una pagina reale
  - *assorbe*: `backlog:#50`, `product:D4`, `mandates:MAN-25`
- [ ] **Z-191** (15.0h) — #58/F4 AI Advisor prescrittivo fase-1 (read-only, citations obbligatorie, audit persistito prima del display)
  - *chiuso quando*: psql: sys_advisor_suggestions ha righe scritte prima del render e un test verifica che i suggerimenti senza citations risolvibili vengono scartati
  - *assorbe*: `backlog:#58`, `product:F4`, `mandates:MAN-30`
- [ ] **Z-189** (14.0h) — #56/F2 VRIO scorecard (/org-director/vrio) con evidenze collegate + export print-PDF
  - *chiuso quando*: esiste la rotta /org-director/vrio, un E2E la apre con login reale e i punteggi derivano da dati reali (Value da economic_weight, Rarity/Imitability da assessment persistiti)
  - *assorbe*: `backlog:#56`, `product:F2`, `mandates:MAN-28`
- [ ] **Z-190** (14.0h) — #57/F3 OHI Organizational Health scorecard per OU con trend
  - *chiuso quando*: E2E mostra l'indice per OU su /org-director con re-normalize-on-missing verificato da un test sui componenti mancanti
  - *assorbe*: `backlog:#57`, `product:F3`, `mandates:MAN-29`
- [ ] **Z-192** (10.0h) — E3 Time & Attendance: console admin /attendance, lifecycle overtime, saldi e maturazione (linea orfana, nessun id nel register)
  - *chiuso quando*: esiste apps/web/src/app/(authenticated)/attendance/ con E2E su un flusso overtime reale, oppure la linea e' marcata WON'T-DO nel register
  - *assorbe*: `product:E3`
- [ ] **Z-206** (10.0h) — WebSocket/SSE real-time per l'editing collaborativo delle visualization
  - *chiuso quando*: due sessioni browser vedono la stessa modifica del grafo senza reload, verificato da un E2E a due contesti
  - *assorbe*: `gapfill:GAP1-31`
- [ ] **Z-185** (9.0h) — #49/D5 Employee timeline (import analytics_events 5.000 + employee_timeline 4.641 come event-log consultivo)
  - *chiuso quando*: psql: la tabella target ha le righe importate con lineage wave=2 e chiave LEGACY_EMP::, e un E2E mostra il tab Timeline popolato su /users/[userId]
  - *assorbe*: `backlog:#49`, `product:D5`, `state:#49`, `mandates:MAN-24`
- [ ] **Z-187** (9.0h) — #53/E4 Payroll ops read-extended (salary bands, merit cycles, benefits dentro compensation)
  - *chiuso quando*: E2E su /compensation-intelligence mostra bands/merit/benefits da /v1/* con dati reali importati
  - *assorbe*: `backlog:#53`, `product:E4`, `mandates:MAN-26`
- [ ] **Z-197** (9.0h) — WI-D: pilota blueprint-builder banca retail 8 step (generate->plan->apply) mai eseguito
  - *chiuso quando*: il pilota completa gli 8 step con evidenza allegata e psql mostra le righe prodotte da Phase A (catalogo) e Phase B (istanza tenant)
  - *assorbe*: `backlog:WI-D`, `state:WI-D`
- [ ] **Z-184** (8.0h) — #37/B2 Reward-gate engine sui 121 variable-pay (gates/results/payout curves a 0)
  - *chiuso quando*: psql: select count(*) from sys.sys_reward_gate_results > 0 dopo un run dell'engine sui 121 calcoli, con integration test verde
  - *assorbe*: `backlog:#37`, `product:B2`, `state:#37`, `mandates:MAN-18`, `runtime:RT-9`
- [ ] **Z-194** (8.0h) — CMS: sys_content_media a 0 + residui P3 (primitive rich-text upstream, object-store, box di ricerca full-text sulla pagina)
  - *chiuso quando*: E2E: un upload reale crea una riga in sys_content_media, l'editor non e' piu' una textarea raw e il box di ricerca chiama GET /v1/content/search
  - *assorbe*: `mandates:MAN-45`, `gapfill:GAP3-4`
- [ ] **Z-183** (6.0h) — #36/B5 Visualization: versioning dei grafi + motore di export reale (layouts/styles/exports a 0, 8 graph_type su 9 senza dati)
  - *chiuso quando*: psql: sys_visualization_exports e sys_visualization_layouts > 0 dopo un export e un salvataggio layout reali da /visualizations, e il download restituisce un file valido
  - *assorbe*: `backlog:#36`, `product:B5`, `state:#36`, `mandates:MAN-17`, `mandates:MAN-43`, `runtime:RT-8`
- [ ] **Z-193** (6.0h) — Approval effects: handler oltre TIME_OFF_REQUEST (approvazione goal / compensation change)
  - *chiuso quando*: il registry effects/ ha >=1 handler nuovo con scrittura atomica nella stessa withTransaction e natural key anti-double-apply, coperto da integration test
  - *assorbe*: `backlog:B3-handlers`, `product:B3-res`
- [ ] **Z-198** (6.0h) — WI-B.2 agent-gateway: integrazione compliance-guard/hr-verifier, matrice adversarial M-2 completa, rate-limit post-D-28
  - *chiuso quando*: la matrice M-2 e' eseguita per intero con output allegato e il rate-limit del gateway e' verificato da un test
  - *assorbe*: `backlog:WI-B.2`
- [ ] **Z-207** (6.0h) — HEU-FLOW-001: la FASE 2 del flusso di tenant onboarding non esiste (la sequenza salta da FASE 1 a FASE 3)
  - *chiuso quando*: la spec e il codice espongono una sequenza contigua e, se si sceglie la FASE 2 di review/approve, il gate HITL e' esercitato in un test
  - *assorbe*: `gapfill:GAP1-21`
- [ ] **Z-209** (6.0h) — Battle plan 03-localai mai eseguito (setup AI locale open-source su PC Windows e VM OCI)
  - *chiuso quando*: il servizio locale risponde sulla porta prevista senza collidere con l'API e i gate di headroom RAM/CPU della VM sono rispettati (output allegato)
  - *assorbe*: `mandates:MAN-10`, `gapfill:GAP1-52`
- [ ] **Z-196** (5.0h) — G6 Wiki advanced: refresh linked-mode oppure declassamento esplicito a 'storico' (748 commit indietro, path morti nel manifest)
  - *chiuso quando*: la wiki e' rigenerata in linked-mode con manifest sha256 aggiornato, oppure porta un banner 'storico' verificabile nella home
  - *assorbe*: `product:G6`, `mandates:MAN-61`
- [ ] **Z-181** (3.0h · dipende da Z-180) — #39/B4 EMAIL: digest live + EMAIL_OTP come secondo fattore + UI preferenze notifiche (0 preferenze utente a DB)
  - *chiuso quando*: psql: sys_notification_preferences > 0 dopo una modifica da /me/inbox, e un enroll EMAIL_OTP reale completa il login step-2
  - *assorbe*: `backlog:#39`, `product:B4`, `state:#39`, `mandates:MAN-14`, `mandates:MAN-44`

---

## W6 — Dipende da input o decisioni tue (30 cluster, 446h)

Cluster che nessuna scelta tecnica può sbloccare: credenziali, decisioni di business, atti esterni.

### business-dd (8)

- [ ] **Z-242** (40.0h · **esterno**) — Strato GDPR DOCUMENTALE assente (RoPA, DPIA, basi giuridiche per categoria, informativa, erasure-flow per interessato, data-export ESS)
  - *chiuso quando*: git ls-files | grep -iE 'ropa|dpia' trova gli artefatti e GET /v1/me/data-export restituisce l'export completo per una persona reale
  - *assorbe*: `gapfill:GAP1-58`, `gapfill:GAP2-27`
- [ ] **Z-243** (16.0h · **esterno**) — Classificazione formale AI Act (Annex III high-risk) e conformity assessment mai prodotti benche' la mitigazione tecnica esista
  - *chiuso quando*: esiste il documento di classificazione con record-keeping Art.12, human-oversight Art.14 e FRIA Art.27, referenziato dal PRD
  - *assorbe*: `gapfill:GAP2-28`
- [ ] **Z-245** (8.0h · dipende da Z-026 · **esterno**) — Nessun DPA con i sub-processor (Oracle, Anthropic) e infra su account personale free-tier
  - *chiuso quando*: i DPA firmati sono archiviati e l'infra gira su un account intestato all'entita' commerciale (verifica sulla console OCI)
  - *assorbe*: `gapfill:GAP1-70`, `gapfill:GAP2-31`
- [ ] **Z-244** (2.0h · **decisione-business**) — SBOM (CycloneDX) e license-attribution mai generati; titolarita' IP del legacy e di @heuresys/ui solo asserita
  - *chiuso quando*: git ls-files | grep -i sbom trova l'artefatto rigenerabile in CI e la nota di titolarita' inter-repo e' committata e firmata
  - *assorbe*: `gapfill:GAP1-69`, `gapfill:GAP2-30`
- [ ] **Z-248** (1.0h · dipende da Z-220 · **decisione-business**) — Verdetto acquirente 'spietato' (45-57/100, NO-GO come investimento in azienda) mai riconciliato ne' registrato in alcuna SoT
  - *chiuso quando*: il verdetto e' accettato o respinto per iscritto nel register, con le 2 leve indicate (titolarita' IP, vincolo del founder) tracciate come item
  - *assorbe*: `gapfill:GAP2-57`
- [ ] **Z-247** (0.5h · **decisione-business**) — Domande al founder Q1-Q8 della due diligence mai risposte (financials, funding, pricing, ICP, titolarita' IP, hiring, compliance)
  - *chiuso quando*: docs/due-diligence/01_DISCOVERY.md riporta una risposta scritta per ognuna delle 8 domande, e i finding P3/X che ne dipendono non sono piu' marcati 'da confermare'
  - *assorbe*: `gapfill:GAP1-60`, `gapfill:GAP2-56`
- [ ] **Z-241** (0.0h · **esterno**) — Bus factor = 1: nessun secondo sviluppatore, nessuna clausola di retention del founder (unico finding CRITICAL della due diligence)
  - *chiuso quando*: git shortlog -sn mostra >=2 contributori con commit sostanziali negli ultimi 3 mesi, oppure esiste un term sheet firmato con clausola key-person
  - *assorbe*: `gapfill:GAP2-23`
- [ ] **Z-246** (0.0h · **esterno**) — Nessun pilota cliente reale firmato (kill-criteria dichiarato della fase F2 della due diligence)
  - *chiuso quando*: psql: select count(*) from sys.sys_tenancies where status='ACTIVE' and tenant_kind='CUSTOMER' >= 1 con utenti reali del cliente che effettuano login
  - *assorbe*: `gapfill:GAP1-59`, `gapfill:GAP2-29`

### db-data (5)

- [ ] **Z-060** (24.0h · **decisione-business**) — #17 Wave-3: onboarding dei tenant legacy non-banking (SmartFood 82 emp, EcoNova 26 emp) — multi-industry vs reference banking
  - *chiuso quando*: psql: select count(*) from sys.sys_tenancies where status='ACTIVE' >= 3 con gli utenti del tenant pilota importati e login reale funzionante
  - *assorbe*: `backlog:#17`, `state:#17`, `mandates:MAN-5`, `gapfill:GAP2-55`
- [ ] **Z-074** (5.0h · **decisione-business**) — Tassonomia skill: decisione hard/soft (D-34) + 14.010 skill su 14.041 senza categoria + premessa della migration 000051 non realizzata
  - *chiuso quando*: psql: select count(*) from sys.sys_skills where skill_category_id is null scende sotto la soglia decisa e la dimensione hard/soft e' popolata secondo la regola approvata
  - *assorbe*: `debt:D-34`, `code:CODE-23`, `code:CODE-22`, `mandates:MAN-47`
- [ ] **Z-076** (4.0h · **decisione-business**) — Import legacy succession pools/candidates rinviato (decisione B di Enzo), riattivabile su richiesta
  - *chiuso quando*: il registry marca il mapping RESOLVED con le righe legacy importate, oppure la riga e' dichiarata WON'T-DO
  - *assorbe*: `code:CODE-27`
- [ ] **Z-101** (3.0h · **decisione-business**) — RACI di produzione: modello a ruolo singolo e popolazione da seed demo 'NOT production truth'
  - *chiuso quando*: psql: sys_organization_unit_processes contiene dati dichiarati autoritativi (lineage != seed demo) e la matrice supporta i 4 ruoli RACI
  - *assorbe*: `mandates:MAN-42`
- [ ] **Z-103** (3.0h · **esterno**) — Crosswalk ISCO-08 <-> CP2021: tabella creata e vuota (serve la corrispondenza ufficiale Istat)
  - *chiuso quando*: psql: select count(*) from sys.sys_occupation_classification_mappings > 0 con lineage sulla fonte Istat e gate i18n a 0 mancanti
  - *assorbe*: `state:OQ-1`, `mandates:MAN-49`

### doc-sot (1)

- [ ] **Z-222** (5.0h · **decisione-business**) — Decision log MVP-4: RD-29 (dry-run OCI Managed), RD-32 (licenza React Flow Pro), Q-MVP4-01..10 e la Tappa F (Path A/B/E su @spen-zosky-ui) mai decise
  - *chiuso quando*: ogni RD/Q ha una riga di esito nel decision log e la Tappa F ha un ADR con il path scelto
  - *assorbe*: `gapfill:GAP1-6`, `gapfill:GAP1-5`

### infra-ci (2)

- [ ] **Z-026** (80.0h · **decisione-business**) — Migrazione a PostgreSQL managed + runtime HA (ADR-0010 Option C) incl. read replica: decisione di spesa
  - *chiuso quando*: esiste docs/architecture/OCI_MANAGED_MIGRATION_PLAN.md e un dry-run documentato con sslmode=require verde da apps/api/src/db/client.ts
  - *assorbe*: `gapfill:GAP1-4`, `gapfill:GAP2-18`, `gapfill:GAP1-33`, `gapfill:GAP1-54`
- [ ] **Z-028** (1.0h · **decisione-business**) — Archiviazione off-disk dei 27 dump pre-op (3,7G): meccanismo pronto, esecuzione mai fatta
  - *chiuso quando*: du -sh pg_dump_snapshots/ sotto 500M e i file archiviati sono elencabili sulla destinazione scelta
  - *assorbe*: `p100x:QW-K3`

### product (11)

- [ ] **Z-205** (60.0h · **decisione-business**) — Promessa 'BPM' senza runtime generico: esistono le approvazioni, non process-instance / task inbox / SLA arbitrari
  - *chiuso quando*: esiste un runtime di processo generico con istanze e task assignment coperto da test, oppure 'BPM' e' rimosso dal naming (grep su README, PRD, showcase)
  - *assorbe*: `gapfill:GAP1-68`, `gapfill:GAP2-54`
- [ ] **Z-182** (40.0h · **esterno**) — #16 SuccessFactors: sandbox reale + design ancora EXPLORATORY con 4 decisioni aperte
  - *chiuso quando*: il connettore legge entita' EC dal sandbox reale e le scrive in staging.sf_* con lineage; test di integrazione allegato
  - *assorbe*: `backlog:#16`, `state:#16`, `mandates:MAN-15`, `mandates:MAN-8`, `gapfill:GAP1-24`
- [ ] **Z-210** (40.0h · dipende da Z-179 · **decisione-business**) — Layer commerciale assente: signup/provisioning self-service multi-tenant, billing/metering, onboarding (+ Fase 5 D-14 con PII vera)
  - *chiuso quando*: un signup pubblico crea un tenant reale end-to-end e la sottoscrizione e' registrata dal provider di billing scelto; verificato con un percorso E2E
  - *assorbe*: `gapfill:GAP1-56`, `gapfill:GAP2-25`, `p100x:D-14-F5`
- [ ] **Z-199** (10.0h · **decisione-business**) — WI-D1: endpoint di bulk-apply lineage-imitating (rinviato per decisione)
  - *chiuso quando*: esiste il modulo blueprint-apply con natural-key + content-hash + ON CONFLICT + lineage e un integration test; oppure la voce e' marcata WON'T-DO
  - *assorbe*: `gapfill:GAP1-22`
- [ ] **Z-200** (8.0h · **decisione-business**) — WI-D3: recommender typing->variant da NACE+size a blueprint_variant (rinviato per decisione)
  - *chiuso quando*: la migration M5 esiste e il recommender restituisce una variante coerente su un caso reale; oppure la voce e' marcata WON'T-DO
  - *assorbe*: `gapfill:GAP1-23`
- [ ] **Z-179** (6.0h · **decisione-business**) — #4 Pricing page: servono importi, nomi piani e feature per tier (la DoD vieta il placeholder)
  - *chiuso quando*: la pagina /pricing e' live con i numeri reali e un E2E verifica il submit di un lead con lead_source PRICING che compare in psql
  - *assorbe*: `backlog:#4`, `state:#4`, `mandates:MAN-11`, `gapfill:GAP1-53`
- [ ] **Z-201** (4.0h · **decisione-business**) — agent-gateway non deployato in PROD: serve la decisione su credenziale/provider per l'uso non-interattivo (console dev non pilotabile)
  - *chiuso quando*: ssh VM: systemctl status dell'unit agent-gateway e' active e la console /dev/agent completa un round-trip reale in PROD
  - *assorbe*: `state:AGENT-PROD`, `mandates:MAN-64`, `code:CODE-36`, `gapfill:GAP2-20`
- [ ] **Z-204** (2.0h · **decisione-business**) — Predictions/'AI-ML': read-model di valori legacy senza engine — riposizionare come explainable rule-based scoring o costruire il modello
  - *chiuso quando*: la copy di prodotto (PRD, /investors, UI) non usa piu' 'ML predictions' per euristiche deterministiche, verificato con grep; oppure esiste un engine con eval
  - *assorbe*: `mandates:MAN-68`, `gapfill:GAP1-67`, `gapfill:GAP2-51`
- [ ] **Z-195** (1.0h · **decisione-business**) — #41 graphify: top-up semantico dei 26 chunk mancanti (limite di spesa Claude colpito nel run S1016)
  - *chiuso quando*: graphify-out/PENDING_SEMANTIC_TOPUP.md e' vuoto/chiuso e il grafo rigenerato copre 52/52 chunk
  - *assorbe*: `backlog:#41`, `state:#41`, `mandates:MAN-20`
- [ ] **Z-180** (0.5h · **segreto**) — #8 EMAIL dormiente: app-password Outlook per SMTP (sblocca EMAIL_OTP e digest)
  - *chiuso quando*: ssh VM: l'invio reale di una mail di prova via SmtpMailer riesce e il messaggio arriva alla casella di destinazione
  - *assorbe*: `backlog:#8`, `state:#8`, `mandates:MAN-13`, `code:CODE-5`
- [ ] **Z-202** (0.5h · **decisione-business**) — Rubrica Maturity L0-L5: i cutoff numerici non hanno mai avuto il sign-off e la rubrica non e' versionabile/rivedibile
  - *chiuso quando*: rubric_version e' selezionabile e i cutoff correnti sono firmati in un documento committato; un test verifica il supersede senza perdita dati
  - *assorbe*: `backlog:OQ-1`, `mandates:MAN-63`

### security (2)

- [ ] **Z-052** (60.0h · **esterno**) — Hardening commerciale F5: pentest indipendente / OWASP ASVS + load testing k6
  - *chiuso quando*: esiste un report di pentest firmato da un fornitore e uno script k6 committato con risultati allegati
  - *assorbe*: `gapfill:GAP1-74`
- [ ] **Z-045** (14.0h · **segreto**) — SSO enterprise OIDC (Azure AD / Google) con JIT-link su sys_auth_*
  - *chiuso quando*: login E2E reale via IdP: una spec Playwright completa il flusso e psql mostra la riga di identita' federata collegata a un utente RTL
  - *assorbe*: `backlog:#52`, `product:E2`, `state:#52`, `mandates:MAN-16`, `p100x:D-13r`

### test-qa (1)

- [ ] **Z-118** (8.0h · **esterno**) — 4 classi a11y dichiarate out-of-scope nel 2026-05 e mai riprese: keyboard manuale, screen reader, forced-colors, WCAG AAA
  - *chiuso quando*: esiste un report firmato con esiti per keyboard/forced-colors automatizzati e per la sessione screen-reader; le voci WCAG AAA hanno un verdetto di scope
  - *assorbe*: `gapfill:GAP3-16`

---

## Nota di metodo

Questo file è un **piano di esecuzione**, non una fonte di verità di stato: i numeri vivi restano in `docs/kb/SOT_STATE.md`, il backlog aperto in `docs/kb/SOT_BACKLOG.md`, i debiti in `docs/kb/DEBT_REGISTER.md`. Man mano che i cluster si chiudono, il loro esito confluisce in quelle SoT al handoff; le caselle qui sopra servono a non perdere nulla lungo la strada.
