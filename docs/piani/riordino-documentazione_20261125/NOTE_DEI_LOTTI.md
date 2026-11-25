# Note dei lotti del censimento (2026-11-25)

Note dei revisori dei lotti, così come le hanno scritte. Il piano è [../PIANO_riordino-documentazione_20261125.md](../PIANO_riordino-documentazione_20261125.md). I lotti D1 e D2 (datastore) sono nel repo heuresys-datastore, il lotto PF nei file del progetto.

## Note A1 (heuresys-advanced: ADR, docs/*, regole, skill, file sparsi)

Righe in out_A1.tsv: 170, quanto il lotto. Verdetti: valido 84, da aggiornare 28, da accorpare 12, superato 46.
Avvertenza sulle date: `git log` dà 2026-11-22 per tutti i 170 file (storia riscritta o tocco di massa del 22/11). La data utile sta dentro i file (Status/Data); la colonna `data` non distingue i documenti.

### Contraddizioni fra documenti
- `.claude/rules/regole-di-progetto.md` (HRMS_MANAGER «scavalca la regola dei due assi (ADR-0027)») vs ADR-0027 (SUPERSEDED da ADR-0036 dal 2026-08-10) e CLAUDE.md I16-I22 (citano 0036/0032). ADR-0032 stesso ha ancora «Builds on ADR-0027».
- ADR-0002 («Fastify 4») e ADR-0007 («Next.js 15») vs `apps/api/package.json` (fastify 5.12.6), `apps/web/package.json` (next 16.4.6), CLAUDE.md e README (Fastify 5, Next 16). AGENTS.md dice ancora Next.js 15.
- AGENTS.md («fonte autorevole il DB legacy heuresys-evo, ADR-0023») e `docs/brownfield/ENGINE_STATUS.md` vs ADR-0038 (che supera ADR-0023) e CLAUDE.md I12. AGENTS.md è canale Codex che CLAUDE.md dice di non mantenere: va deciso da Enzo se resta con questi errori.
- `.claude/rules/tests.md` («i test colpiscono il DB live sulla VM via tunnel») vs CLAUDE.md (test API sul gemello con `pnpm test:api:vm`, CI su `heuresys_ci`).
- `.claude/sessione/AVVIO.md` (hook `session-boot.ps1`, `.claude/settings.local.json`, tunnel Windows) vs `.claude/settings.json` (hook `scripts/hooks/session-boot.sh`, `hook.sh prompt-hook`); `settings.local.json` non esiste.
- `.zp/PROGRESS.md` («46 chiusi su 262», piano del 10/08) vs SOT_BACKLOG #76 (157 aperti al 13/09, programma ACTIVE). Cita anche Z-201 «agent-gateway non deployato, serve decisione su credenziale/provider», in contrasto con la questione modello chiusa (ADR-0056 D3, CLAUDE.md).
- ADR_INDEX: 0040 appare «ACCEPTED» ma il file dice «Superseded in part by ADR-0053»; 0039 senza il «Superseded in part by ADR-0043»; 0033 resta PROPOSED dal 2026-08-07 benché 0040 ne superi §6.1 e 0053 ne usi §5.2. Mancano 0019, 0022, 0058 senza una nota.
- `.handoff/STATE.md` (fuori lotto) dichiara «Updated 2026-10-29» e «ADR-0043…0048 accettati» come ultima sessione, mentre ci sono ADR fino a 0061 (22/11): da verificare dal censore che ha quel file.

### Gruppi da fondere in una pagina di dominio
- Brownfield/ETL (chiuso da ADR-0038, schema brownfield ritirato con mig. 000297, motore in `docs/archive/etl-brownfield-ritirato`): 4 deliverable BROWNFIELD_*, WAVE_1 runbook, 3 wave_runners, ENGINE_STATUS, ADR 0012/0014/0017/0018/0020, DEVELOPMENT_LINES_D = 15 file da archiviare. Va conservato solo EMPLOYEE_CENTRIC_MAPPING_DOCTRINE (I14) e il concetto di «legacy come fonte di concetti».
- Prodotto: le 6 DEVELOPMENT_LINES A/B/C/E/F/G + 3 WORKITEM_GAP1 + LATENT_CAPABILITY_CATALOG + i file 01/02/03 del ciclo DREAM sono tutti dossier di candidati o inventari dello stesso Ledger: una sola pagina «capacità e candidati» (FUNCTIONAL_CAPABILITY_LEDGER §10) e una di mercato (COMPETITIVE_SCORECARD + 03_COMPETITOR).
- Ciclo DREAM 2026-08-25 (chiuso 26/08, traguardi T1/T2 superati da ADR-0054): 00-07, STATO_CICLO e 15 file in `_raccolta` = 25 file, un archivio unico. Il programma `project-dream` ha sessione dedicata (CLAUDE.md): il verdetto è un parere, la mossa spetta a quella sessione.
- Integrazioni di giugno: i quattro `tenant_onboarding_esco_0N` e il piano agent_sdk_mcp sono eseguiti o riassorbiti da ADR-0043/0046/0047/0053/0056/0060.
- Le sei skill di zero-pending-loop (11 file `references/`) e le 7 di project-atlas restano come sono; gli unici ritocchi sono README di zero-pending (percorsi D:\), template legacy di project-atlas e full-alignment-deploy (manca rilascia.sh).

### Documenti vivi che citano file spostati o superati
- README.md, AGENTS.md, `.claude/rules/api-module-pattern.md`: citano `docs/api/API_IMPLEMENTATION_PLAN.md` (ora `docs/archive/`); README cita anche `docs/frontend/FRONTEND_IMPLEMENTATION_PLAN.md` (cartella vuota, il file è in archive), `HANDOFF.md` e `NEXT_SESSION_MVP_2A.md` alla radice (in archive), `cowork_code_exchange` e `scripts/cowork-exchange` come protocollo v2.2 vivo.
- `docs/ci/workflows-overview.md` e `typecheck.yml` citano `cowork_code_exchange/**` come path ignorato; la cartella esiste ancora alla radice, ma il canale è ritirato.
- `docs/architecture/brand-component-contract.md` cita NEXT_SESSION_MVP_2A (archivio); BOOTSTRAP_EXECUTION_PLAN è «archivio storico» ma ospita il decision log RD-01..RD-25, citato come vivo da CLAUDE.md (RD-08, RD-09), ADR e rules: la sua unica sede.
- Commenti in `apps/api/src/**` citano AUTH_SECURITY_PLAN e TARGET_SCHEMA_DESIGN, entrambi «planning deliverable» di maggio con fatti superati (MFA post-MVP, schema «proposta»).
- `.claude/rules/attese-bloccanti.md` cita `attese_debiti.json` come file accanto allo script: non esiste in `docs/kb/tools/` (da verificare se lo crea lo script).
- ADR-0056 conserva nel corpo il rilievo sui termini Anthropic (riga «P24 e le condizioni d'uso»), marcato «Chiarimento 2026-11-10»: coerente con CLAUDE.md. Nessun altro file del lotto solleva la questione della chiave API come blocco (CLAUDE.md, ADR-0056/0061 e i PRINCIPI la citano solo per escluderla).

### Altro
- CLAUDE.md di advanced tratta Windows come postazione canonica («script PowerShell canonici», lettura DB «da Windows via tunnel»); il CLAUDE.md del datastore dice il PC non più in uso dal 2026-10-22. Da confermare per advanced.
- Non toccati e non verdetti: ADR 0019, 0022, 0058 non esistono come file.

## Note del censore A2 (heuresys-advanced: docs/kb, docs/piani, docs/superpowers, .handoff)

Lotto: 218 file. Verdetti: 32 validi, 30 da aggiornare, 6 da accorpare, 150 superati. Dalle date git non si ricava niente: il repo ha la storia schiacciata (111 commit, tutti i file al 2026-11-22); le date reali sono nei nomi dei file e nelle intestazioni.

### Contraddizioni fra documenti
1. **Registri di stato fermi, lavoro di novembre solo nei piani.** `.handoff/STATE.md` (2026-10-29), `SOT_BACKLOG.md` (intestazione 2026-08-10 con voci di ottobre), `DEBT_REGISTER.md` (2026-07-21), `SOT_STATE.md` (ultimo delta S1115 del 2026-09-27, un solo cenno a novembre) e `cruscotto/stato.json` non citano novembre. ADR-0059..0061, il ciclo forense 15/11 e 23-25/11, la scheda Allineamento e le PR fino a #481 stanno solo in `docs/piani/` e negli ADR. CLAUDE.md dice che questi file si riscrivono a fine sessione.
2. **Tabelle di stato dei piani non riconciliate col codice.** I piani di consolidamento (allineamento 16/11, scheda-allineamento 18/11, applicazione 13/11), delle applet e dell'assistente-come-claude hanno 4-25 voci «da fare», ma `scheda-allineamento.tsx`, `tenant-consolidation/allineamento.ts`, `apply-changes`, le applet nei `tenant-processes` esistono nel codice.
3. **`SOT_BACKLOG.md` riga 802** dichiara «blocked-on-Enzo: ANTHROPIC_API_KEY valida» (la riga 807 la risolve, CLAUDE.md la chiude): è il tipo di testo che CLAUDE.md chiede di correggere. Analoga la tabella «Chiave API» in `specs/2026-06-19-integrazione-llmwiki-...` (coerente col contenuto, ma da rileggere).
4. **Fonte legacy.** `xtras/RTL_STABILIZATION_PLAN.md`, `specs/2026-05-30-rtl-tenant-rebuild*.md` indicano il DB legacy della VM come fonte autorevole: contraddicono ADR-0038 (ingestione chiusa dal 2026-08-14).
5. **`PIANO_forense-frontend_20261115` e `forense-frontend_20261115/*`** hanno il piano e i rapporti del primo giro, mentre il ciclo del 23/11 lo riprende e lo sostituisce: il 20261115 è superato, il 20261123 è vivo. `RAPPORTO_ciclo-23-11.md` precede il rapporto finale del 25/11 e ha numeri diversi.
6. **`INDEX_PATHS.md`** (generato 2026-10-17, 3872 file) elenca 186 file di `cowork_code_exchange/`, che CLAUDE.md dichiara ritirato.

### Gruppi da fondere in una pagina di dominio
- **Programma 100X** (`docs/kb/improvement/`, 40 file): chiuso (#9/#10/#11 DONE). Da archiviare in blocco; prima accorpare `DOSSIERS_TRIAGE_S1022.md` in `docs/archive/SOT_BACKLOG_CHIUSI.md` (unica traccia delle decisioni D-01..D-14). `FINDINGS/3.2_ASVS_MAPPING.md` è l'unico documento da tenere (da aggiornare).
- **Forense di luglio** (`db-forensics`, `frontend-forensics`, `full-forensic-audit`, tre `NEXT_SESSION_*`): tutto superato. `NEXT_SESSION_*` è ancora citato da `.claude/rules/frontend-live-data.md`, DEBT_REGISTER, SOT_STATE e dal censimento F4: sistemare i riferimenti prima di spostarli. `full-forensic-audit/INDEX.md` è append-only della skill e segue la sorte dei report.
- **Riconciliazione/SDBI** (`xtras`: DATA_RECONCILIATION_PLAN, RECONCILIATION_WALLS, SDBI_PHASE2_CLOSURE, B50, WAVE2, D4, D6, RTL_STABILIZATION): un'unica pagina storica «riconciliazione brownfield (chiusa)» con rinvio ad ADR-0014/0038.
- **BPM approvazioni**: i due spec (flow design + slice 2-3) da fondere.
- **Piani di sessione di agosto** (`superpowers/plans` 2026-08-*, `specs` 2026-08-*): 40 file di cicli S1045-S1082 con voci DONE nel register; un solo indice storico basta. **Prima di spostarli**: PIANO_pulizia-repo C5 (2/11) li ha lasciati dove sono perché citati da migrazioni applicate, `.storia36/`, seed e dalle skill full-alignment-deploy e zero-pending-loop; i riferimenti nei commenti SQL non vanno rotti (impronte delle migrazioni).
- **Interfacce**: PIANO_interfacce_20261103 (da accorpare), interfaccia-sistematica, interfacce-intelligenti, `xtras/INTERFACCE_INTELLIGENTI.md` e le classi dei difetti sono una sola linea di lavoro: una pagina di dominio frontend-ux.
- **Consolidamento tenant**: quattro piani (allineamento, scheda, applicazione, registro corse) più `A2_distanza_RTL` vanno tenuti in una pagina con una sola tabella di stato.

### Documenti vivi che citano file superati
- CLAUDE.md cita `xtras/PERCHE_LE_REGOLE.md` (storico, valido ma contiene regole ritirate) e `AUTONOMY_R23_PROJECT.md` (da aggiornare, percorso Windows).
- `docs/kb/xtras/SESSION_START_FORENSICS.md` (superato) è citato da AGENTS.md; `docs/kb/improvement/WS-L_*` lo citano.
- `ATLAS_CURATED.md` (da aggiornare) è la base di `.claude/skills/project-atlas`.
- `xtras/POST_V1_ROADMAP_DOSSIER.md` (superato) è citato da SOT_BACKLOG, archive e due-diligence.
- `plans/2026-07-27-rtl-storia-36-mesi.md` (superato come piano) è citato da `db/scripts/storia36.sh`, `verify-storia36.sql`, `.storia36/PROGRESS.md`.

### Altro
- `docs/piani/forense-frontend_20261123/`: tutti i 6 file censiti come validi o da aggiornare, mai superati (giro in corso); `RAPPORTO_ciclo-23-11.md` e `classi-difetti.md` sono da riallineare con i file del 25/11.
- `COWORK_INBOX.md` (223 KB, 937 righe): valido come canale ma pieno di voci riconciliate; `check_canale_cowork.py` dà 0 voci aperte. Le due README di `superpowers/analysis` e `prompts` descrivono un ciclo Cowork→CLI con `cowork_code_exchange`, non più in uso.
- `GLOSSARIO_dieci-oggetti_v0.3.md` è gemello di `heuresys-datastore/src/contratto/v0.3/GLOSSARIO_dieci-oggetti.md`: verificare che restino identici (competenza di chi censisce il datastore).
- `delivery-loop` (spec 2026-07-25): la skill non esiste in `.claude/skills`; giudicata superata, ma è un'ipotesi (design mai costruito) da confermare con Enzo.
- `PIANO_velocita-ci-e-rilasci_20261122` è una proposta senza decisione: tenuta valida; serve un sì o un no di Enzo.

## Note A3 — .programmi/** e .storia36/** (heuresys-advanced, 274 file)

Metodo: stato letto dall'intestazione `> **stato**` di ogni programma, da `python docs/kb/tools/programmi.py`
(aperti: #76 #79 #149 #159 #198 #205 #206 #214 #263 #265 #271 e #254 NON AVVIATO), da SOT_BACKLOG, `.handoff/STATE.md`,
`docs/archive/SOT_BACKLOG_CHIUSI.md`. Tutti i file hanno un solo commit (2026-11-22, migrazione di cartella): la data git non dice nulla sull'età reale; l'età si ricava dal contenuto (luglio-ottobre 2026).

### Quadro
- 12 programmi di voce aperti (valido o da aggiornare), 56 chiusi (CHIUSO nel file, voce DONE in archivio): vanno tolti dalla cartella viva, la conoscenza è già nell'archivio dei backlog chiusi.
- Mandato K (`K-ruoli-direzione/`, ~150 file fra esiti ed evidenze): chiuso, #259 DONE, 53 CHIUSE + 2 RITIRATE. Resta cronaca. Le evidenze grezze (`evidenze/`, `wf_*`) sono output di comandi: da archiviare in blocco.
- `mandati/` e i `S10xx-*`: piani di sessione esauriti (README dei mandati lo dice: «cronaca, non stato»). Quattro portano ancora uno stato falso nell'intestazione (S1067, S1068, S1071 «IN CORSO»; S1073 «DA APRIRE», già eseguito per S1074).
- `consolidamento/` e `onda2/` sono vivi e vanno tenuti, ma i loro file di stato sono indietro.

### Contraddizioni (coppie)
1. `.programmi/consolidamento/00_INDICE.md` e `02_ARCHITETTURA.md` dicono ADR-0047 e ADR-0048 «PROPOSTO» e ADR-0046 «proposto»; `docs/architecture/adr/0047_*.md` e `0048_*.md` sono ACCETTATI il 2026-10-23 e ADR-0046 è ACCETTATO (#269 DONE).
2. `.programmi/consolidamento/agente/06_PIANO.md` dà AC-3 «da fare» e `00_INDICE.md` dà `000464`/`000465` «prenotato»; le migrazioni 000464-000466 e `apps/api/src/modules/tenant-consolidation/` sono su main, pagina `/consolidation` toccata il 2026-11-24.
3. Il programma di consolidamento (codice su main, ADR-0047/0048/0059) non compare né in `docs/kb/SOT_BACKLOG.md` né in `.handoff/STATE.md`: lavoro vivo senza voce di register.
4. `.programmi/271-onda2-advanced.md` lascia F9/F10 (O2-09, O2-10) non spuntate e SOT_BACKLOG #271 dice «O2-01 e O2-03 possono partire subito»; `.handoff/STATE.md` dà O2-01, O2-02, O2-09, O2-10 fatte, #270 DONE (DEPLOYATO 3a323bde, 2026-10-26). `onda2/README.md` tiene O2-07/O2-08 bloccati da ADR-0046 da approvare, ormai ACCETTATO.
5. `.programmi/214-adozione-agente-perimetri.md` dice IN CORSO 6/7, `programmi.py` lo stampa aperto; SOT_BACKLOG #214 è HOLD «superata dalla dottrina ADR-0040» e #254 (NON AVVIATO nel file, ACTIVE nel backlog) ne prende il posto.
6. `.programmi/76-verifica-piano-zero-pendenze.md` è «IN CORSO» ma il backlog dice la sessione preliminare «chiusa» (F2, 2026-09-13); resta aperta solo la F3 a ondate, che vive nel piano zero-pendenze, non qui.
7. `.programmi/esiti-onda0/W0-D.md` (#265 F4 SOSPESA, scelta A/B di Enzo) e `.handoff/STATE.md` («#265 F4 sospesa sul ramo f4-livello-contrattuale, ADR-0045»): la decisione aperta non è nel programma `265-*.md`.

### Gruppi da fondere in una pagina di dominio
- Mandato K (STATO + esiti + RISPOSTE_ENZO + REGISTRO_SCOPERTE): una pagina `direzione del dato` che porti le risposte di Enzo (D5=C, A0, R-2, X-2, D11/D12) dentro ADR-0041; il resto in archivio.
- Consolidamento: `lavoro/A,B,D,F,G` + `02_ARCHITETTURA` → ADR-0047/0048 e `01_RILIEVI`; tenere solo INDICE, RILIEVI, PIANO, VERIFICHE e la cartella `agente/` aggiornati.
- Onda 2: i mandati O2-01/02/09/10 eseguiti e i due piani (PE-6.1, passo 3) → ADR-0044/0049; restano i mandati O2-03…O2-08.
- Storia36: `.storia36/analysis/*.md` (7 file) e `docs/kb/storia36/*` descrivono la stessa cosa in due posti; PROGRESS.md resta vivo (D-STORIA-B, timer di avanzamento).

### Documenti vivi che citano file superati
- `docs/kb/SOT_BACKLOG.md` cita 230, 239, 241, 243, 245, 263, 265 (i primi cinque chiusi); `docs/kb/DEBT_REGISTER.md` cita 246 e S1093.
- ADR-0036, 0041, 0042, 0043, 0044, 0046, 0047, 0049 citano esiti K, esiti-onda0, consolidamento e onda2 come evidenza: spostando i file i rinvii vanno riscritti.
- Migrazioni 000417, 000429-000451 citano `K-ruoli-direzione/esiti/*` nei commenti: non modificabili (impronte), quindi il percorso va preservato o lasciato rotto di proposito.
- `apps/api/src/lib/scope/mandati.ts`, `resolver.ts` e test DPO citano `RISPOSTE_ENZO.md`; `apps/agent-gateway/src/soglie-persone.ts` e `build_soglie_agente.py` citano #251; `apps/api/scripts/collaudo-access.mjs` cita #169; `db/seeds/storia36/*`, `verify-storia36.sql` citano `.storia36/analysis/`.
- `docs/kb/INDEX_PATHS.md` e `index_paths.yaml` elencano tutti i percorsi (generati: si rigenerano dopo la pulizia).

### Altro
- `S1093-mandato-p1-p3-gated.md` riga 209 nomina «la chiave API ruotata»: è la chiave del fornitore di ricerca, non del motore agenti; non solleva la questione chiusa, ma va letta con attenzione.
- `S1101-mandato-riallineamento-consolidato.md` nomina `cowork_code_exchange/` (ritirato da CLAUDE.md): superato con tutto il file.
- `esiti-onda0/lavoro/lettori_per_tabella.json` e `K-ruoli-direzione/evidenze/**/*.json` non erano nel lotto (solo md/txt); stessa sorte dei file accanto.
- Il CLAUDE.md dice che `.programmi/**` ha sessioni dedicate: censito senza toccare; la proposta di rimozione dei programmi CHIUSI va fatta da quella sessione.
- Il match di `REGOLE.md` in CLAUDE.md è `PERCHE_LE_REGOLE.md`, non `esiti-regole/REGOLE.md` (falso positivo del grep).

## Note lotto A4 (cowork_code_exchange, cowork_reserved, sessioni, audit, qa_artifacts) — 371 file

Tutti i file risultano committati il 2026-11-22 (un solo commit): la data git non distingue l'età, che si ricava dai nomi (2026-05-18 / 2026-06).

### Esito generale
Nessun documento del lotto descrive lo stato attuale: sono archivio di cicli chiusi (maggio-giugno 2026). 368 superati, 2 da aggiornare, 1 da accorpare. La conoscenza durevole è già in ADR-0014..0020, `docs/kb/SOT_STATE.md` (§10 bias, delta S1006), `docs/kb/COWORK_INBOX.md`, `docs/archive/`.

### Chi cita ancora il lotto (documenti vivi e script)
- `.github/workflows/{lint,typecheck,test-integration}.yml`: `paths-ignore` su cowork_code_exchange, cowork_reserved, qa_artifacts, sessioni. Se le cartelle spariscono le righe vanno tolte con loro.
- `.gitattributes` (righe 4, 15, 77), `.gitignore` (sezione cowork_code_exchange), `scripts/align-clones.sh` e `docs/kb/tools/build_index.py` (le classificano "archive").
- `db/scripts/_lib/cross_os_pipeline.sh` e `db/scripts/_lib/README.md` puntano a `cowork_reserved/batch_c5/xos_lib/cross_os_pipeline.sh` come percorso canonico dello script (altrimenti non esiste altrove): da portare in `db/scripts/_lib/` o ritirare insieme. Unico file del lotto con dipendenza reale (README marcato da aggiornare).
- `.claude/skills/zero-pending-loop/SKILL.md` riga 22 nomina `cowork_code_exchange` (solo per dire "congelato").
- `README.md` di radice (righe 104-108 e 242) descrive ancora le cinque cartelle come vive e rimanda a `sessioni/.../FORENSIC_STATE_OF_ART_2026-05-26.md` per "what's next": da riscrivere (contraddice CLAUDE.md e `.handoff/STATE.md`).
- `docs/kb/INDEX_PATHS.md` / `index_paths.yaml` (186 voci) elencano `audit/FORENSIC-NOTES-S1006-cli.md` come *live*, e `bias_registry.md` come archive: INDEX_PATHS è generato da `build_index.py`, da rigenerare dopo il ritiro.
- `docs/kb/xtras/` (DATA_RECONCILIATION_PLAN, RECONCILIATION_WALLS_AND_AI_DECISION_DOSSIER, SDBI_PHASE2_CLOSURE) e `SOT_BACKLOG.md` citano `qa_artifacts/F0_reconciliation_triage.md`, `F3_bridge_discovery.md`, `F3b_walls_discovery.md`; `SOT_STATE.md` cita `_census_CORRECTION.md`, `dbms_health_2026-06-22`, `inbox-orphan-cleanup`; `DEBT_REGISTER.md` cita `inbox-orphan-cleanup`.
- 14 migrazioni già applicate citano `cowork_reserved/**` nei commenti (non modificabili: cambierebbe l'impronta) e ADR-0014..0020 citano `cowork_reserved/batch_c*`: se si sposta la cartella, quei rimandi restano non risolvibili (accettabile, sono storia).
- `db/scripts/validate_database.*` e `storia36.sh` scrivono in `qa_artifacts/` (`schema_snapshot_*`, `storia36/custodia-*`), quindi la cartella `qa_artifacts/` come contenitore resta viva; sono i file del lotto (x*.txt, F0/F3, release notes) a essere storici.

### Duplicati verificati con cmp
- `cowork_code_exchange/GOAL_B_REPORT_2026-05-18.md` e `MIGRATION_STATUS_2026-05-18.md` identici a `docs/archive/` omonimi.
- `cowork_code_exchange/_00_HANDOVER_CLI_2026-05-26_post_S937.md` identico a `sessioni/session_2026-05-26_s937_housekeeping/HANDOVER_CLI.md` (91 KB l'uno).
- `qa_artifacts/F3_bridge_discovery.md` e `F3b_walls_discovery.md` hanno lo stesso titolo (due versioni).
- `cowork_code_exchange/_01_PROMPT_003_v1/v2`, `_02_PLAN_001_v3-bis/v4`, `_02_PLAN_003_v1`, `_04_REPORT_001a_interim`, `_99_archive_DRAFT_PROMPT_022`: versioni intermedie degli stessi documenti.

### Contraddizioni
1. `README.md` di radice (cartelle "vive": cowork_code_exchange ~140 file, protocollo v2.2) vs CLAUDE.md ("non si usano cowork_code_exchange né le skill cowork-cli-*").
2. `cowork_reserved/PREFERENCES_v5_FINAL.txt` e `MANDATORY_TOOL_PRELOAD*`/`PREFERENCES_BLOCK_to_paste.txt` (ambiente Windows, tool Desktop_Commander/Windows-MCP, regole R1-R23 in `C:\Users\...`) vs stato attuale (VM, CLAUDE.md di progetto, Cowork che scrive solo in COWORK_INBOX). Sono marcati "live bridge" in `COWORK_ARCHIVE_NOTE.md` §5 ma sono superati: la nota stessa è da aggiornare.
3. `COWORK_ARCHIVE_NOTE.md` §3 + `cowork_reserved/_ARCHIVE_READONLY.md` ("next CW-B64, si appende a bias_registry.md") vs ADR/SOT_STATE: nessuna voce CW-B64 esiste e il protocollo anti-race è decaduto; D-10 in DEBT_REGISTER è la stessa questione.
4. `qa_artifacts/v1.0.0_release_notes.md` ("Next.js 15", "synthetic case-study (no PII, ADR-0023)", conteggi) vs CLAUDE.md (Next 16, nessuna etichetta rassicuranti, nessun conteggio nei documenti); ADR-0023 è SUPERSEDED da ADR-0038.
5. `audit/FORENSIC-NOTES-S1006-cli.md` dichiara a11y e perf "LIB-BLOCKED" e MFA disattivata; SOT_STATE riga ~3072 dice che il gate #21 è stato sciolto: INDEX_PATHS lo tiene però *live*.

### Decisioni ancora valide con unica traccia nel lotto
Non ne ho trovate: la proposta `cowork_code_exchange/cli-prompt.md` (ISCO-08/CP2021, 2026-07-22) è implementata (mig 000206/000208, entry COWORK_INBOX riconciliata S1027). Unico residuo: il catalogo CW-B (bias_registry.md) è citato da SOT_STATE §10 come SoT storica: "da accorpare" (le lezioni nel SOT_STATE, il catalogo in docs/archive).
Nota: nei 63 messaggi `.inbox` gli HALT P0/P1 del batch X18 (npm publish di @heuresys/ui, bisect Next 15) e il PROMPT 025 (X21 DEFER-F, `.inbox/cli/pending`) non sono mai stati eseguiti nel canale: il tema (libreria UI) vive oggi in `ux-design-shared`, quindi superati.

### Raggruppamenti proposti
- Un solo spostamento in `docs/archive/` (o ritiro con il metodo dei campioni di PIANO_pulizia C1/C2/C3): le quattro cartelle cowork_code_exchange, cowork_reserved, sessioni, qa_artifacts (tranne ciò che i due script scrivono), più `audit/`. Prima: aggiornare workflow `paths-ignore`, `.gitattributes`, `.gitignore`, `build_index.py`, README e db/scripts/_lib (vedi sopra), poi rigenerare INDEX_PATHS.
- `docs/kb/COWORK_ARCHIVE_NOTE.md`, `PERCHE_LE_REGOLE.md` e `COWORK_INBOX.md` dicono la storia di questo canale: fonderli in una sola pagina "storia del canale Cowork".
- Fascia "superato per il solo motivo di ritiro del canale" = 63 inbox + ~100 file `_0x_` + templates + baselines; fascia "superato per chiusura ingestione ADR-0038" = tutto cowork_reserved/batch_c*, 0x_*.md.

### Verifiche non fatte
Non ho letto per intero i file oltre 60 righe (handover 91 KB, CODEBOOK, COWORK_CLI_PROMPT_PATTERN 84 KB, x14_playwright_full 313 KB): giudizio da intestazione, titoli, cmp e riferimenti incrociati. Il contenuto di ogni batch_c*/mapping_card è stato giudicato in blocco dopo averne letto titoli/intestazioni e la collocazione (SDBI/brownfield).

## Note A5 (heuresys-advanced: source_bundle, archive, wargames, due-diligence, github, ux-design, db, deploy, apps, scripts, .github)

Lotto: 251 file. Tutte le date git sono 2026-11-22 (un solo commit di import): la data non distingue il vecchio dal nuovo, ha pesato il contenuto.

### Contraddizioni fra documenti
1. **Questione Anthropic/chiave API** (CLAUDE.md: chiusa il 2026-11-10) contro docs/due-diligence/EXECUTIVE_SUMMARY.md (righe 23, 31, 41: «vincolo di licenza», azione C2 P0 «migrare a API key commerciale»), workstreams/WS-T7.md (rischio ToS, «procurare API key Anthropic pay-per-use»), WS-P3.md (righe 40-43) e WS-P4.md. Sono da riformulare come questione di metering per tenant, senza il tema licenza.
2. **apps/agent-gateway/README.md** dice «12 sorgenti, 8 test, Distribuito: no, nessuna unit systemd»; oggi 27 file in src, 25 in test, e deploy/systemd/heuresys-agent-gateway.service esiste (installata da vm-deploy.sh, ruolo giudice del consolidamento, :8790). Il DEBT_REGISTER D-91 ④ lo dà RISOLTO il 2026-09-12, ma lo stato è già di nuovo superato. WS-P4 della due diligence ricalca il vecchio «no».
3. **Percorso spezzato**: `.claude/rules/api-module-pattern.md` (riga 27), AGENTS.md (132) e README.md (94) citano `docs/api/API_IMPLEMENTATION_PLAN.md`, che non esiste (il file è in docs/archive/). Inoltre `.claude/rules/frontend-live-data.md` e AGENTS.md rimandano a docs/archive/NEXT_SESSION_MVP_2A.md come dottrina viva: la parte valida va portata nella regola (verdetto «da accorpare»).
4. **docs/due-diligence/REPORT.md**: titolo «rivalidato 2026-09-28», ma riga 3 dice HEAD ce26608 e «Score 61/100»; EXECUTIVE_SUMMARY e SCORECARD dicono 66/100 su 5faa2bc2.
5. **Curriculum GitHub (docs/github, 23 file con «Applicato ai nostri repo»)**: afferma 0 workflow, nessun dependabot.yml, nessun PR, commit non firmati, repo `public`, `@heuresys/ui` via `pnpm link:`. Realtà: 22 workflow in .github/workflows, dependabot.yml, CODEOWNERS, SECURITY.md, `@heuresys/ui ^1.7.2` da registro; CLAUDE.md dice repo non aperti al pubblico.
6. **deploy/README.md** descrive unit «dev-mode», API :8013/web :3013 da vm-bootstrap.sh, il Mac e il PC Windows come sorgenti dell'allineamento; CLAUDE.md fissa produzione `node dist/server.js`/`next start` da copia rilasciata (rilascio-copia.sh), turni gemelli, rilascia.sh. La mappa porte del 2026-06-12 contiene anche progetti estranei (lalibraiascalza, evo legacy).
7. **db/scripts/README.md** (Model A/B, tunnel 5433, PowerShell su PC Windows, «brownfield wave runs post-MVP») contro la tabella «Dove si esegue il lavoro sul database» di CLAUDE.md e ADR-0038.
8. **db/scripts/rtl-allinea/LEGGIMI.md**: a 15/11 «J3 e J4 NON applicati in produzione»; dal 19-20/11 J3/J3b/J3c risultano applicati (vettori stantii, sentinella 000342). Il registro cronologico non ha uno stato attuale in testa.

### Gruppi da fondere in una pagina di dominio
- **Processi FIN_BANKING** (docs/source_bundle/.../industry_blueprints/FIN_BANKING/processes, 23 file) + `universal_hrms_framework/U01-U08`: **U04-U08 sono byte per byte uguali ai processi 18-22** (verificato con cmp). Il contenuto di dominio (processi bancari, KPI, carriere, compensation) è l'unica copia in repo; andrebbe in una pagina «processi» sotto docs/product, non restare dentro il pacchetto di input. Il datastore ha la famiglia bancaria nella migrazione 0110.
- **Curriculum GitHub**: 36 file di tutorial per un utente unico; accorparli in 2-3 pagine con la sola parte specifica dei repo (branch protection, dependabot triage, secrets), il resto è documentazione GitHub pubblica.
- **Bundle UX/IX v1 (ux-design/)**: 41 file di specifica consegnati il 2026-05-18, realizzati in `@heuresys/ui` e apps/web; la dottrina viva è docs/kb/xtras/DESIGN_SYSTEM_UI.md e `.claude/rules/design-system-ui.md`. Le checklist di governance (a11y, QA visiva, quality gates) vanno unite a docs/a11y-manual-checklist.md.
- **Wargames**: sette battle plan, solo il 15 (pricing, #4 HOLD) è ancora eseguibile; 03-localai non ha item di backlog e cita Mac 2012 e PC Windows.

### Segnalazioni specifiche della brief
- **docs/source_bundle/brownfield/extracted/**: nessun file tracciato (`git ls-files docs/source_bundle | grep extracted/` = 0; la cartella tracciata si chiama `extracted_bootstrap`, è un'altra cosa: il pacchetto di input v5). Anche `docs/brownfield/_inspection_artifacts`: 0 tracciati.
- Tracciato invece `docs/source_bundle/brownfield/db-export.zip` (1 MB, export del DB legacy `heuresys_platform`, 576 tabelle) e il pacchetto v5 `.zip` (222 KB): non fanno parte del lotto (non sono documenti) ma l'export legacy in repo merita una decisione rispetto a I12/ADR-0038 («il legacy si consulta per i concetti, mai per le righe»).
- **docs/archive/** è una cartella di 92 file tracciati; i soli file vivi sono SOT_BACKLOG_CHIUSI.md (destinatario dei rimandi `↦` di SOT_BACKLOG.md) e etl-brownfield-ritirato/README.md (spiega perché il timer di scraping NON è ritirato). `build_index.py` già etichetta la cartella come archivio.
- SECURITY.md riporta un indirizzo email personale del manutentore: da riconfermare con Enzo (non verificabile da qui).
- deploy/postgres/README.md chiude con «.env.example non aggiornato con POSTGRES_APP_USER»: da rimisurare, la nota potrebbe essere superata.
- db/seeds/rtl-rebuild/README.md (bozza 2026-05-30, chiave legacy deprecata) e RETIRED.md (2026-08-07) convivono nella stessa cartella: tenere solo RETIRED.md.
- db/seeds/storia36/README.md: tabella dei file ferma a 05 e 14; mancano 06-13 e `avanzamento/`.
- Il lotto non contiene file che citano cowork_code_exchange se non docs/archive/HANDOFF.md (storico) e nessuno che nomini le skill cowork-cli-*.
