# Censimento pass-2 — Lotto B: cowork_code_exchange + cowork_reserved

Letto per intero, file per file, il 2026-08-25. Directory dichiarate READ-ONLY/congelate dal CLAUDE.md di progetto (`.env`/`.secrets` a parte, non pertinenti qui). Nessuna scrittura effettuata fuori da questo file.

## Conteggio

| Directory | Conteggio pass-1 (dichiarato) | Conteggio ri-misurato ora | Delta | Comando |
|---|---:|---:|---:|---|
| `cowork_code_exchange/` | 172 | 172 | 0 | `find cowork_code_exchange -name "*.md" \| wc -l` |
| `cowork_reserved/` | 100 | 100 | 0 | `find cowork_reserved -name "*.md" \| wc -l` |

Nessuna differenza: le due directory sono ferme esattamente ai conteggi della prima passata. Tutti i 272 file sono stati letti per intero in questa sessione (0 esclusioni da "non letto per volume").

## Digesti — cowork_code_exchange/

Ruolo dominante atteso: **cronaca**. Verificato file per file: confermato per la stragrande maggioranza, con alcune eccezioni segnalate (regola, spec, stato-vivo).

### Meta / root-level (17 file)

| File | Ruolo | Digesto |
|---|---|---|
| `README.md` | regola | SoT del protocollo Cowork↔CLI v2.2. Definisce 8 regole strutturali R1-R8 (modello di concorrenza 90% CLI-only / 9% Cowork+CLI simultaneo / 1% Cowork-only), matrice di ownership per classe di file, activity lock, STATE-file come superficie di sync atomica, `.gitattributes` per EOL, hook pre-commit di sanificazione, pattern di handover a manifest pendenti, sistema di messaggistica inbox (`.inbox/{cowork,cli}/{pending,read}/`). Definisce il round-trip a 7 fasi: DISCOVERY → PROMPT → PLAN → APPROVAL (firmata sha256) → EXEC (log append-only + events.jsonl) → REPORT → REVIEW. Convenzione di naming `_<step>_<TYPE>_<NNN>[<resume>]_<slug>.md`; contatore obiettivo `<NNN>` monotono; versioning via `_v<N>.md`; `_interim.md` per REPORT rifiutati in chiusura. Si autodichiara "Authoritative project-level SoT". |
| `_00_ARCHIVE_READONLY_NOTICE.md` | stato-vivo | Dichiara il freeze: *"Dal 2026-05-27 (S939)"* — verificato via git-log, commit datato 2026-05-27, coerente. |
| `cli-prompt.md` | spec | Proposta di Cowork (Claude Opus, "read-only sulla SoT") per l'asse professione ISCO-08 + CP2021 bilingue. **git-log conferma commit datato 2026-07-25** — ~2 mesi dopo il freeze dichiarato in `_00_ARCHIVE_READONLY_NOTICE.md`. Il file stesso dichiara esplicitamente, al proprio interno: *"per heuresys-advanced il ciclo `cowork_code_exchange` (PROMPT/PLAN/EXEC/REPORT) è **congelato**; lavori in diretta"* e istruisce la riconciliazione via `docs/kb/COWORK_INBOX.md`. Non prescrive nulla in modo vincolante ("Questo NON è un mandato... sei libero di modificarla, spezzarla, rinviarla o rifiutarne parti"). Vedi sezione Contraddizioni. |
| `_00_STATE_001.md`, `_00_STATE_002.md`, `_00_STATE_003.md` | stato-vivo (storico) | Tracker YAML-frontmatter dello stato live durante i cicli iniziali. `_00_STATE_003.md` è il più ricco: `decisions_locked: D1...D20`, narra l'intera escalation dei blocker di Classe B fino al pivot SDBI. |
| `_00_SESSION_HANDOFF_2026-05-18.md` | cronaca | Handoff di fine sessione 2026-05-18. |
| `_00_SESSION_HANDOFF_2026-05-19.md` | cronaca | Handoff di fine sessione 2026-05-19. |
| `_00_SESSION_HANDOFF_2026-05-20.md` | cronaca | Contiene, verbatim al §3.1, la direttiva strategica di Enzo che abbandona il brownfield rigido a favore di SDBI (Semantic-Driven Brownfield Import). Citazione riportata anche in `_04_REPORT_003_brownfield-seeding-complete.md` §7. |
| `_00_HANDOVER_CLI_2026-05-26_post_S937.md` | stato-vivo (storico, 1512 righe/91KB) | Fotografia integrale del progetto a S937: versioni stack, elenco 43 migrazioni (000001-000044 con salto 000035), 58 moduli API/~272 endpoint, RBAC 388×8, tabella 20 ADR, tally bias registry (61 catalogati/43 mitigati a quel momento), catalogo regole R1-R23, documentazione del blocker SSH-passphrase (CW-B62). |
| `_00_DISCOVERY_002_json-extract-lineage-fullscale.md` | spec | Fase DISCOVERY (solo fatti) precedente al ciclo 002. |
| `_00_DISCOVERY_003_brownfield-seeding-complete.md` | spec | Fase DISCOVERY precedente al ciclo 003. §4 elenca **"4: RTL_BANK + SmartFood + EcoNova + Heuresys System"** come tenant target per Wave 2 — vedi Contraddizioni (SmartFood non è più tenant corrente per CLAUDE.md/I21/I15). |
| `GOAL_B_REPORT_2026-05-18.md` | report | Report del "Goal B" pre-numerazione formale dei cicli. |
| `MIGRATION_STATUS_2026-05-18.md` (67KB, 719 righe) | report | Inventario completo source/target, tabella di mapping Wave-1 a 94 righe con domain code ESKAP/H2R/INDOOR/ITLAB/OPOURSKA/PROGOV/SKILGRO, tabella data-parity che mostra ~62/94 mapping a 0 righe (MISMATCH) al momento della stesura. |
| `_SKILL_UPDATE_MEMO.md` | cronaca | Nota di aggiornamento skill. |
| `_99_archive_DRAFT_PROMPT_022_tappa_f.md` | cronaca (archivio) | Bozza precedente del ciclo 022 (Tappa F), poi promossa a formale (vedi cycle 022). |
| `_99_DB_INVENTORY_2026-05-20.md` (versione CORRECTED) | report | Identifica `heuresys_platform` (1112MB, 582 tabelle) come vera fonte vs `heuresys_advanced` (609MB, 113 tabelle sys.* a quel momento). §4.2 enumera 10 macro-aree con "TARGET GAP DESIGN": Goals/OKRs, Recruiting&hiring, Onboarding/preboarding, Surveys/engagement/wellbeing, Time/leave/attendance, CCNL/diritto del lavoro italiano, News/social, Mentorship, Predictions/ML, Feedback systems. |
| `_templates/_00_DISCOVERY.template.md` | regola | Scaffold puro. |
| `_templates/_00_STATE.template.md` | regola | Scaffold puro. |
| `_templates/_01_PROMPT.template.md` | regola | Scaffold puro. |
| `_templates/_02_PLAN.template.md` | regola | Scaffold puro. |
| `_templates/_02b_APPROVAL.template.md` | regola | Scaffold puro. |
| `_templates/_03_EXEC.template.md` | regola | Scaffold puro. |
| `_templates/_04_REPORT.template.md` | regola | Scaffold puro. |
| `_templates/_05_REVIEW.template.md` | regola | Scaffold puro. |
| `baselines/INDEX.md` | generato | Registro auto-mantenuto. |
| `.inbox/INDEX.md` | generato | Registro auto-mantenuto. |

Nota di conteggio: la tabella sopra elenca 17 voci raggruppando `_templates/` (8 file) e i due `INDEX.md` in righe distinte — totale file fisici = 8+8+1(README)+... = 17 nominali secondo la classificazione pass-1; qui ogni file `_templates/*` e i due INDEX sono comunque nominati singolarmente, nessuno omesso.

### `.inbox/cli/pending/` + `.inbox/cli/read/` (28 file — digesto di gruppo)

Ruolo: **generato** (notifiche automatiche del protocollo). Tutti i 28 file sono notifiche `prompt_ready` / `approval_ready` / `review_ready` / `prompt_amended` / `exec_directive` per i goal 002-027, incrociate con i corrispondenti PROMPT/PLAN alla radice. File elencati singolarmente (nessuna aggregazione silenziosa):

- 27 file processati (spostati in `read/` a fine ciclo).
- **1 file ancora in `pending/`**: `.inbox/cli/pending/2026-05-25T00-07-39Z__025__prompt_ready.md` — notifica per PROMPT 025 (X21 DEFER-F /showcase fix), mai processata. Coerente con l'assenza del corrispondente REPORT 025 (vedi cycle 025 sotto): **lavoro interrotto/mai eseguito**, non un'esclusione di questa lettura.

### `.inbox/cowork/read/` (35 file — digesto di gruppo)

Ruolo: **generato**. Notifiche `pending_applied` / `session_handoff` / `plan_ready` / `exec_progress` / `report_ready` / `exec_halt` per i goal 002-023, tutte già processate (in `read/`, nessuna in `pending/`). Contengono, in forma verbatim, 7 notifiche di halt per il Goal 022 (saga npm-publish) e 1 per il Goal 023 — il cui contenuto testuale coincide con quanto riportato nei rispettivi REPORT (cycle 022 e 023 sotto), quindi non ripetuto qui per non duplicare la citazione. Elenco dei file di halt Goal-022 nominati esplicitamente più sotto nel digesto del ciclo 022.

### Ciclo 001/001a — "audit_upsert_refactor" (11 file, digesto di ciclo)

Ruolo: **cronaca** (con elementi di **regola** impliciti — codifica pattern comportamentali poi adottati come standard). File del ciclo, tutti nominati:
`_01_PROMPT_001_audit_upsert_refactor.md` · `_02_PLAN_001_v3-bis.md` · `_02_PLAN_001_v4.md` · `_02_PLAN_001_audit_upsert_refactor.md` (canonico = v5) · `_02b_APPROVAL_001.md` · `_02b_APPROVAL_001_v5.md` · `_03_EXEC_001_audit_upsert_refactor.md` (snapshot HALTED) · `_03_EXEC_001a_audit_upsert_refactor.md` (log turno-per-turno, 530 righe) · `_04_REPORT_001a_interim.md` · `_04_REPORT_001a_audit_upsert_refactor.md` (finale) · `_05_REVIEW_001a_audit_upsert_refactor.md`.

Digesto: il PLAN ha raggiunto v5 attraverso 5 revisioni; il supervisore (Cowork) ha catalogato 12 propri errori nel processo di authoring. L'esecutore (CLI) ha codificato in questo ciclo 3 pattern comportamentali poi adottati come standard cross-progetto: E1 (halt evidence-gated), E2 (deferral di scope trasparente), E3 (segnalazione proattiva di edge-case). La regola G11 (cross-check bidirezionale step↔criterio-di-accettazione) nasce qui dal gap osservato tra PLAN v4 e v5.

### Ciclo 002 — "json-extract-lineage-fullscale" (6 file, digesto di ciclo)

Ruolo: **cronaca**. File: `_01_PROMPT_002_json-extract-lineage-fullscale.md` · `_02_PLAN_002_json-extract-lineage-fullscale.md` · `_02b_APPROVAL_002.md` · `_03_EXEC_002_json-extract-lineage-fullscale.md` · `_04_REPORT_002_json-extract-lineage-fullscale.md` · `_05_REVIEW_002_json-extract-lineage-fullscale.md`.

Digesto: chiuso PARZIALE (13/15 criteri di accettazione). Causa radice: il payload `match_on=legacy_tenant_id` veniva trattato dal compilatore come nome di colonna target letterale, ma `sys_tenancies` non ha tale colonna — mismatch semantico. Diventa il bias catalogato CW-B13.

### Ciclo 003 — "brownfield-seeding-complete" (14 file, digesto di ciclo)

Ruolo: **cronaca**, con **1 estratto di regola** (vedi Contraddizioni per l'estratto su `user_is_synthetic`). File: `_01_PROMPT_003_v1.md` · `_01_PROMPT_003_v2.md` · `_01_PROMPT_003_brownfield-seeding-complete.md` (v3, canonico) · `_02_PLAN_003_v1.md` · `_02_PLAN_003_brownfield-seeding-complete.md` (v2, canonico) · `_02b_APPROVAL_003.md` · `_03_EXEC_003_brownfield-seeding-complete.md` (principale, 488 righe) · `_03_EXEC_003_DIAGNOSTIC_REPORT_Item_F.md` · `_03_EXEC_003_CLASSB_FINDINGS_Item_F.md` · `_03_EXEC_003_CLASSB_SUBDISCOVERY_Item_F.md` · `_03_EXEC_003_CLASSB_SEMANTIC_FAIL_Item_F.md` · `_03_EXEC_003_CLASSB_UQ_BLOCK_Item_F.md` · `_04_REPORT_003_brownfield-seeding-complete.md` (autorato retroattivamente il 2026-05-26, `report_type: FORMAL_CLOSURE_AT_SUSPENSION`) · `_05_REVIEW_003_brownfield-seeding-complete.md` (retroattivo, `verdict: ACCEPTED_AS_SUSPENSION`).

Digesto: `PROMPT_003_v1` §2 Problem 7 / §2.6 specifica esplicitamente, come regola vincolante di quel ciclo, il tagging `user_is_synthetic=true` + `user_type='SYNTHETIC_REFERENCE'` (regole A16-W3/A18-W3) per i controlli di sicurezza-dati sintetici. **Citazione verbatim conservata in Contraddizioni** perché confligge testualmente con la OUTPUT RULE corrente (S1011) e con I15/ADR-0026 del CLAUDE.md vigente. Il Goal 003 ha ristretto progressivamente la barra C5 (15→12→11→10) attraverso 4 correzioni di scope, poi è stato formalmente SOSPESO (non chiuso) in seguito al pivot SDBI di Enzo, la cui direttiva è ri-citata verbatim al §7 del REPORT_003.

### Cicli 004-021 — batch X1-X17 (ruolo: cronaca per tutti; ogni file nominato)

**Ciclo 004 / X1** — PROMPT_004 + REPORT_004_batch_x1. Patch audit CW-B17 (audit-rule-codes.ts nuovo file, rule code WHERE_SKIP_FILTER_EXCLUDED_V1), bootstrap sys_job_families 0-27 (migrazione 000034), fix MIRROR GAP di skill_adjacencies (0-11634), sys_skills 6037-20048 (+14011 via mirror gap esco_skills). Nuovi bias CW-B22/23/24.

**Ciclo 005 / X2** — PROMPT_005 + REPORT_005_batch_x2. Block A: patch motore CW-B22 (buildNkJoinPredicate, IS NOT DISTINCT FROM sostituito da uguale), CW-B23 (ANALYZE post-load), CW-B24 (dedup lineage DISTINCT ON) - Wave1 da 55 minuti a 3 minuti. Block B cascade parziale (fantasma FK semantico su sys_job_roles, CW-B26). Block C pilota SDBI Goals/OKRs riuscito: migrazioni 000036/000037, 10 nuove tabelle sys popolate 1 a 1 (sys_goals 1067, sys_goal_updates 1811, sys_goal_check_ins 1000, sys_goal_milestones 1000, sys_goal_comments 856, sys_goal_alignments 100, sys_goal_templates 40, sys_okrs 20, sys_okr_key_results 20, sys_okr_check_ins 25).

**Review 004/005** — REVIEW_004_batch_x1, REVIEW_005_batch_x2. Review formali retroattive datate 2026-05-26; REVIEW_005 verdetto ACCEPTED PARTIAL WITH PIVOT AUTHORIZED.

**Ciclo 006 / X3** — PROMPT_006 + REPORT_006_batch_x3. ADR-0015 migrazione 000038 (job_role_family_id nullable) piu edit companion; migrazione 000039 (source_table_id nullable); sys_job_roles 0-91. Completamento lineage Goals/OKRs +4832 righe. Estratte legacy_mirror users/employees_core/employees_pii/employees_hr/employees_payroll (270 righe ciascuna). Bias CW-B28.

**Ciclo 007 / X4** — PROMPT_007 + REPORT_007_batch_x4. Fix CW-B31 dedup su INSERT principale. Retry cascade ESCO fallito 0 su 5, proposto ADR-0016. Bias CW-B32 e CW-B33.

**Ciclo 008 / X5 Block A** — PROMPT_008 + REPORT_008_batch_x5. Fix CW-B32 via CAST_ENUM, sys_job_roles 91-202. ADR-0016 migrazione 000041 applicata ma sys_esco_occupation_mappings resta a zero, HALT P0. Bias CW-B34.

**Ciclo 009 / X6A** — REPORT_009_batch_x6a (nessun PROMPT separato, via inbox exec_directive). Patch motore per CW-B34: mappa columnNullable in engine.ts, WHERE-skip nullable-aware. sys_esco_occupation_mappings 0-7645. ADR-0016 accettato.

**Ciclo 010 / X5B** — REPORT_010_batch_x5b (nessun PROMPT separato). Pilota SDBI Time and Leave, migrazione 000040, sei nuove tabelle per 6220 righe totali. Merge ibrido sys_users 163-433, con check R-A2 passato. Bias CW-B35, CW-B36, CW-B37.

**Ciclo 011 / X7** — PROMPT_011 + REPORT_011_batch_x7. Fix CW-B35 (dieci mapping aggiunti su sys_skill_taxonomy_edges, 0-11965). Fix CW-B36 (due mapping riclassificati REFERENCE ONLY). Fix CW-B37. Bias CW-B38, CW-B39, CW-B40.

**Ciclo 012 / X8** — PROMPT_012 + REPORT_012_batch_x8. Verifica audit CW-B38 confermata pulita. Pulizia CW-B39.

**Ciclo 013 / X9 mega bundle SKILGRO cinque blocchi** — PROMPT_013 + REPORT_013_batch_x9. Block A: ADR-0017 LOOKUP_FK_2HOP spedito, migrazione 000043, transform totali 17. Block B fallisce con zero upsert, scoperto CW-B49 P0 bloccante. Block C bloccato dallo stesso bias. Block D pulizia CW-B35. Block E rinviato. Bias CW-B46, CW-B47, CW-B48.

**Ciclo 014 / X10** — PROMPT_014 + REPORT_014_batch_x10. Fix CW-B49, nuovo helper replaceTargetColsInConflictInference. Sblocco sys_learning_paths 3227-3354, sys_learning_modules 4488-5052, piu sblocco incidentale a livello motore di 13851 righe.

**Ciclo 015 / X11 hardening quattro blocchi** — PROMPT_015 + REPORT_015_batch_x11. Block A risolve CW-B47. Block C performance reviews parziale, 517 righe riclassificate REFERENCE ONLY, bias CW-B50. Conclusione strategica: dati source SDBI esauriti, REPORT paragrafo 8 raccomanda pivot a MVP-2 frontend.

**Ciclo 016 / X12** — PROMPT_016 + REPORT_016_batch_x12. Cowork pivota autonomamente su audit gap API MVP-2a fase 0, ma la misura live rivela che MVP-2a era gia strutturalmente completa (41 pagine, 272 endpoint, 50 test, 61 schemi Zod, 42 migrazioni) da lavoro svolto fuori dal protocollo tracciato. Bias CW-B52, staleness della spec.

**Ciclo 017 / X13 coverage hardening sprint** — PROMPT_017 + REPORT_017_batch_x13. Chiusa lultima lacuna di copertura E2E su system-health. Parita i18n 100 per cento. Bias CW-B53.

**Ciclo 018 / X14 final live validation** — PROMPT_018 + REPORT_018_batch_x14. Run Playwright completo contro next dev: 125 test, 67 pass solidi, 6 flaky pass, 52 fail tutti tracciati a contention JIT non strutturale. Bias CW-B54.

**Ciclo 019 / X15** — PROMPT_019 + REPORT_019_batch_x15. Rerun contro pnpm start: 118 su 125 pass in 5,3 minuti contro 73 su 125 in un ora in dev mode. Bias CW-B54 confermato massicciamente. Sette fallimenti residui sono gate ambientali by design.

**Ciclo 020 / X16 final certification** — PROMPT_020 + REPORT_020_batch_x16. Rebuild con showcase env attiva: 124 su 125 pass, 99,2 per cento. Un fallimento residuo preesistente non correlato. Tag annotato v0.2.1-mvp2a-final creato localmente, nessun push.

**Ciclo 021 / X17 combo D piu B** — PROMPT_021 + REPORT_021_batch_x17. Push del tag e fix del contratto DOM residuo risultano gia fatti al momento dellesecuzione, ricorrenza di CW-B52. Lavoro residuo: release notes piu fallback manuale per gh release create, gh non autenticato, deferred a Enzo.

### Ciclo 022 / X18 — la saga npm publish di heuresys/ui (7 file principali, digesto di ciclo unico, ogni file nominato)

Ruolo: cronaca (con una parte di stato-vivo dentro il REPORT, che si aggiorna in place attraverso 5 sezioni RESUMED). File:
PROMPT_022_batch_x18.md (base) - PROMPT_022.1_batch_x18_amendment.md - PROMPT_022.2_batch_x18_amendment.md - PROMPT_022.3_batch_x18_amendment.md - PROMPT_022.4_batch_x18_amendment.md - PROMPT_022.5_batch_x18_amendment.md - REPORT_022_batch_x18.md (unico file di report, aggiornato incrementalmente con 5 sezioni RESUMED invece di un nuovo file per amendment).

Digesto narrativo (5 ore, 6 halt, 12 iterazioni di bisect):
1. PROMPT base: pubblicare heuresys/ui su npm come pacchetto scoped, build dual ESM piu CJS via tsup, versione 0.1.0, migrare apps/web da link a versione pubblicata.
2. Halt 1 (npm not logged in): risolto da Enzo con npm login.
3. Halt 2 (exports map subpath gap): il CLI ha bloccato il lavoro PRIMA di eseguire Block A perche uno scan sui consumer reali ha trovato 3 subpath (./styles, ./brand/candidates, ./assets/brand) non preservati nella mappa exports proposta dal PROMPT. Nessun file toccato, nessun danno. Amendment 022.1 corregge la mappa exports.
4. Halt 3 (dual package hazard): dopo la pubblicazione 0.1.0, la build di apps/web fallisce con Class extends value undefined. Diagnosi Cowork: tsup bundlava le librerie pesanti (Radix, framer motion) inline. Amendment 022.2 prescrive una external list aggressiva e bump a 0.1.1.
5. Halt 4 (CW-B57 misdiagnosis): il CLI verifica empiricamente via ispezione del bundle che tsup 8.x auto-esternalizza gia le dipendenze by default, quindi la external list era ridondante, non la causa. Bundle byte-identico prima e dopo. Vera causa: mismatch di estensione file (outExtension), il manifest dichiara dist/index.mjs ma tsup con type module produce dist/index.js. Cowork ritira CW-B57 e riconosce esplicitamente il critical thinking del CLI. Amendment 022.3 applica il fix outExtension.
6. Halt 5 (persistent build fail, HALT-022-05): il fix outExtension da solo NON risolve il problema. Test matrix su 3 configurazioni tutte fallite. Amendment 022.4 prescrive un bisect logaritmico (Path beta) sulle esportazioni di src/index.ts di heuresys/ui.
7. Halt 6 (bisect inconclusive, HALT-022-06): 12 iterazioni di bisect, nessun singolo componente colpevole isolabile, contaminazione di metodologia (rimozione di export blocca il typecheck del consumer prima di raggiungere il runtime). Root cause reale: soglia di complessita del bundle Next 15 RSC, non un singolo componente. Amendment 022.5 chiude PRAGMATICAMENTE: force-dynamic sulla route showcase (insufficiente), poi Path C, la cartella showcase viene spostata fuori dalla App Router (rinominata in _disabled_showcase_X18) ed esclusa dal tsconfig. Le route admin (40 piu route, incluso system-health con tutti i widget di osservabilita) buildano correttamente con la 0.1.1 versionata.
8. Verdetto finale: MVP-3 Tappa F spedita in modalita pragmatica. heuresys/ui 0.1.1 pubblicato (0.1.0 deprecato). Showcase route DEFERRED (etichetta DEFER-F), non cancellate: la cartella e ancora nel repo, solo rinominata e esclusa dalla build finche non arriva il fix proprio.
9. Bias finali di questo ciclo: CW-B55 (subpath scan mandatorio pre-pubblicazione npm), CW-B56 (pre-flight 2FA/org/GAT), CW-B58 (gap di outExtension piu meta-bias sulla diagnosi teorica senza verifica empirica), CW-B59 (contaminazione di metodologia bisect piu soglia architetturale Next 15, deferred). CW-B57 ufficialmente RITIRATO.

Nota importante per il registro Menzioni di funzionalita: DEFER-F e un lavoro di prodotto INTERROTTO (le pagine /showcase/* sono state tolte dalla build attiva), non abbandonato: vedi sezione dedicata piu sotto.

### Cicli 023-027 (9 file, ogni file nominato)

**Ciclo 023 / X19 - Brownfield Wave 1 full 47k** - PROMPT_023_batch_x19_brownfield_wave1.md + REPORT_023_batch_x19.md. Il rerun completo gira end-to-end e COMPLETA senza errori (34509 righe upserted, 0 falliti, sys_users invariato a 433), ma NON popola nessuna tabella nuova (59 su 134 prima e dopo). 6 target IMPORT restano vuoti per due cause strutturali distinte: (A) 3 target con filtro silenzioso nel motore (0 upsert, 0 log, oltre il fix precedente CW-B49), (B) 3 target senza alcuna sorgente di staging Wave-1 (nessun dato source mai esistito per loro). HALT P1, non P0: nessun regressione, ma il criterio di accettazione del PROMPT (soglia 75 su 134) era IRRAGGIUNGIBILE per costruzione (solo 19 target distinti hanno mapping Wave-1). Nuovo bias CW-B60 in due parti.

**Ciclo 024 / X20 - MFA login gating** - PROMPT_024_batch_x20_mfa_login_gating.md + REPORT_024_batch_x20.md. Composto mfaService.beginLoginChallenge dentro auth.service.login, risposta login trasformata in unione discriminata success/mfa_required. Pagina /login riscritta a due passi (password poi codice TOTP). 5 nuovi test di integrazione con TOTP reale, piu 2 test Playwright end-to-end (incluso un login MFA reale con codice generato via libreria OTP). Zero regressioni sulla suite esistente. Chiude la Tappa E di MVP-3 per intero.

**Ciclo 025 / X21 - DEFER-F fix proprio, ORFANO** - PROMPT_025_batch_x21_defer_f_showcase_fix.md. NESSUN REPORT esiste per questo ciclo: verificato via listato diretto della directory. Il PROMPT descrive un tentativo pianificato di fix definitivo per la soglia RSC di Next 15 tramite git bisect sui commit del repository heuresys-ui-shared oppure split del pacchetto in sotto-pacchetti piu piccoli. La notifica di inbox corrispondente (.inbox/cli/pending/2026-05-25T00-07-39Z__025__prompt_ready.md) e ancora in pending, mai processata. Lavoro pianificato e MAI eseguito in questo protocollo, per quanto risulta da questi 172 file.

**Ciclo 026 / X19a - Dependabot CVE uuid e qs** - PROMPT_026_batch_x19a_dependabot_cve.md + REPORT_026_batch_x19a.md. Scope reale ridotto rispetto al PROMPT: qs risultava gia corretto da un commit precedente (c304b02). Fix scoped (non globale) dellovveride uuid solo sul percorso di dipendenza di exceljs, per non toccare la versione gia sicura usata da mermaid. Deviazione motivata esplicitamente nel report, non nascosta. Nessuna regressione.

**Ciclo 027 / SDBI Fase 2 kickoff, ORFANO** - PROMPT_027_s937_ck8_sdbi_phase2_kickoff.md. NESSUN REPORT esiste. E il file cronologicamente piu recente di tutta la directory (data del file 26 maggio, sessione S937), immediatamente precedente al freeze dell'intero ciclo dichiarato per il 27 maggio (S939). Descrive un piano per riprendere lo stream MVP-4 numero 2.4 (SDBI Fase 2) su 7-9 macro-aree rimaste, con pilota su Performance Reviews. Il piano prevede che ADR-0014 passi da PROPOSED ad ACCEPTED e la creazione delle migrazioni 000034 e 000035 (numerazione indicativa, da riassegnare). Non essendoci REPORT, questo lavoro risulta PIANIFICATO e MAI iniziato in questo protocollo: coincide con il momento del freeze.

## Digesti - cowork_reserved/

Directory di lavoro dellagente Cowork: audit forense iniziale (2026-05-20, 12 fasi F0-F12), poi 12 batch di specifiche SDBI e forensic sui bias del motore brownfield (batch_c1 fino a batch_c12), piu 3 file cross-cutting (registro bias, memo dei pattern per scrivere PROMPT, handoff). Ruolo dominante: report (analisi dello stato) e piano/spec (proposte SDBI non ancora eseguite dal CLI o eseguite solo in parte). Nessuna esclusione.

### Blocco iniziale: Knowledge Base forense (18 file, F0-F12)

| File | Ruolo | Digesto |
|---|---|---|
| _ARCHIVE_READONLY.md | regola | Dichiara il freeze dal 27 maggio 2026 (S939). Precisa che bias_registry.md resta APPEND-ONLY anche dopo il freeze (prossimo numero CW-B64 al momento della lettura), unica eccezione allo stop totale della directory. |
| 00_README_KB.md | report | Indice della Knowledge Base, 12 fasi tutte completate. Raccomandazione finale: Opzione 3 Hybrid Pragmatic (confidenza alta), 148-222 ore stimate, preserva il 100 per cento dellinvestimento gia fatto in brownfield. Elenca 10 finding critici, tra cui: corruzione del working tree (878 righe cancellate accidentalmente in 5 file, poi ripristinate), silent-skip quantificato al 59 per cento in un run, 4 mirror-gap critici (poi risolti), 4 tenant legacy collassati su 1 solo tenant target. |
| 01_DB_PLATFORM_INVENTORY.md | report | Inventario del database sorgente heuresys_platform: 582 tabelle, 1112 MB, 240 migrazioni applicate su 5 mesi, 4 tenant attivi con gli id UUID esatti (RTL Bank, SmartFood, EcoNova, Heuresys System). Elenco delle 100 tabelle piu popolate. 64 tabelle vuote per design (sessioni, framework SAP non attivato, plugin). |
| 02a_ADV_SYS.md | report | Inventario dello schema sys.* target: 118 tabelle piu 11 viste, 38 popolate al momento della misura, 319 FK interne, sys_users e sys_tenancies i due target FK piu referenziati. Le 80 tabelle vuote sono elencate per macro-area (KPI, skills detail, learning detail, job/career, position detail eccetera). |
| 02b_ADV_LEGACY_MIRROR.md | report | Inventario legacy_mirror: 93 tabelle, 81 popolate (87 per cento), circa 200k righe. 4 mirror-gap critici identificati (poi chiusi da C1.4): esco_skills, business_processes, industry_ccnl_mapping, tenant_industry_classifications. |
| 02c_ADV_STAGING.md | report | Inventario dello schema staging: 17 tabelle jsonb-uniformi per il buffer di Wave 1, 41285 righe totali. Descrive il ciclo di vita del wave executor in 5 passi. |
| 02d_ADV_BROWNFIELD.md | report | Inventario del registro di controllo brownfield: 1177 column_mappings, 94 table_mappings, distribuzione dei 14 transform code (JSON_EXTRACT domina al 65 per cento). Segnala il vincolo UQ su (table_mapping, source_column) come limitazione strutturale, poi diventato bias CW-B20. |
| 02e_ADV_AUDIT.md | report | Inventario audit: 207276 righe di validazione, 355 approvazioni tutte automatiche, 50 eventi di ciclo di vita. Fase di upsert e il collo di bottiglia (97 per cento del tempo totale di un run). |
| 02f_ADV_PUBLIC.md | report | Schema public di heuresys_advanced non contiene dati applicativi, solo estensioni Postgres (pg_stat_statements). |
| 04_MIGRATIONS_TIMELINE.md | report | Analisi riga per riga delle 33 migrazioni allepoca esistenti (000001-000033), pattern di late-binding FK documentato, le 3 migrazioni hotfix 000031-000033 analizzate in profondita con motivazione storica per ciascuna. |
| 05_EXTRACT_SCRIPTS_FORENSIC.md | report | Ricostruisce chi ha popolato cosa e quando oltre alle migrazioni. Cronologia in 7 passi dal bootstrap del cluster fino al hotfix Goal 003. Segnala un gap di automazione: lo script di estrazione produce solo i file SQL, il passo di restore in legacy_mirror non e scriptato nel repo. |
| 06_BROWNFIELD_REGISTRY_DEEP_DIVE.md | report | Approfondimento sul registro brownfield: distribuzione dei transform code, hit-ratio per target, 6 target popolati su 20 con mapping. |
| 07_TRANSFORM_COMPILER_ANALYSIS.md | report | Audit di codice completo su transform-compiler.ts e upsert-sql.ts. Trova la corruzione del working tree (878 righe cancellate su 5 file), il gap di osservabilita del WHERE-skip-filter (poi diventato CW-B17), circa 230 righe di codice morto lato JS mai rimosso in questo periodo. |
| 08_AUDIT_TRAIL_ANALYSIS.md | report | Deep-dive sui 207mila record di audit. Quantifica il pattern silent-skip: 24552 righe su 41285 (59 per cento) passano la validazione ma non vengono mai scritte nel target, senza alcuna traccia dedicata nellaudit. Determinismo perfetto verificato su 5 run identici. |
| 09_LEXICON_DOMAINS_MAPPING.md | report | Mappa i 16 domini lessicali CASCADIA ereditati da heuresys-evo contro cio che Wave 1 copre davvero (7 su 16, 44 per cento). Elenca i 4 mirror-gap critici. |
| 10_GAPS_ANALYSIS.md | piano | Framework di classificazione a 5 livelli (A popolato, B import-gap, C mirror-gap, D vero-gap, E intenzionale) applicato a circa 40 macro-aree. Stima leffort delle 3 opzioni strategiche: 188-282 ore (Opzione 1 solo brownfield), 258-352 ore (Opzione 2 SDBI puro), 148-222 ore (Opzione 3 ibrida, raccomandata). |
| 11_STRATEGIC_REFORMULATION.md | piano | Il documento di raccomandazione formale che confronta le 3 opzioni con tabelle di rischio quantificato. Raccomanda esplicitamente Opzione 3, citando testualmente la direttiva di Enzo su SDBI come strumento complementare non sostitutivo. Dichiara che la decisione finale resta a Enzo. |
| 12_TODO_LIST_GRANULARE.md | piano | Piano operativo granulare per tutte e 3 le opzioni, con criteri di accettazione e matrice di rischio quantitativa per ciascuna fase. |

### batch_c1 (30 file)

| File | Ruolo | Digesto |
|---|---|---|
| C1_4_MIRROR_GAP_fix_report.md | report | Conferma lesecuzione riuscita del fix dei 4 mirror-gap: 14051 righe totali ripristinate in legacy_mirror (esco_skills 14011, business_processes 26, industry_ccnl_mapping 14, tenant_industry_classifications gia presente). Eseguito autonomamente da Cowork via SSH, nessun intervento CLI richiesto per questo passo. |
| class_b_diagnostics/00_SUMMARY.md | report | Tabella diagnostica master per i 12 target silent-skip identificati nel run Wave 1 del 19 maggio. Ordina per priorita ed effort stimato. sys_job_families indicato come radice della catena a piu alta priorita. |
| class_b_diagnostics/sys_blueprint_overrides.md | report | Diagnosi: 4 sorgenti eterogenee, nessuna semanticamente coerente con blueprint override. Raccomandazione: differire a SDBI, non forzare un fix tattico. |
| class_b_diagnostics/sys_esco_occupation_mappings.md | report | Diagnosi: bloccato a cascata da sys_job_roles vuoto, zero mapping LOOKUP_FK presenti. Piu grande silent-skip singolo del run (7645 righe). |
| class_b_diagnostics/sys_job_families.md | report | Diagnosi: vero-gap alla radice, nessun mapping mai autorato per questa tabella nonostante 27 righe disponibili in piattaforma. Priorita massima perche blocca 3 target a valle. |
| class_b_diagnostics/sys_job_roles.md | report | Diagnosi: bloccato dalla catena sys_job_families vuota, zero mapping LOOKUP_FK. |
| class_b_diagnostics/sys_learning_path_steps.md | report | Diagnosi: zero mapping FK per entrambe le colonne obbligatorie nonostante i dati sorgente contengano gia gli UUID necessari. |
| class_b_diagnostics/sys_position_learning_requirements.md | report | Diagnosi: caso legittimo di sorgente vuota (0 righe sia in mirror sia in piattaforma), nessun fix necessario, solo documentazione. |
| class_b_diagnostics/sys_position_skill_requirements.md | report | Diagnosi: la tabella di staging per questo target non esiste proprio nella whitelist del wave executor, nonostante 53 column_mappings gia autorati. Rango 2 per priorita, il piu grande volume sorgente singolo (quasi 31k righe). |
| class_b_diagnostics/sys_process_kpi_templates.md | report | Diagnosi: bloccato a cascata dallassenza totale di sys_kpi_definitions, che a sua volta e un vero-gap non ancora progettato. |
| class_b_diagnostics/sys_skill_aliases.md | report | Diagnosi: il fix teorico gia esiste nel codice (commit P1) ma resta inefficace finche esco_skills non viene importato in sys_skills con relativa lineage. Il caso piu semplice della batteria. |
| class_b_diagnostics/sys_skill_categories.md | report | Diagnosi: manca del tutto il mapping per la colonna obbligatoria family_id nonostante il genitore sys_skill_families sia gia popolato. Fix autocontenuto, nessuna dipendenza. |
| class_b_diagnostics/sys_skill_learning_mappings.md | report | Diagnosi: solo 1 sorgente su 3 ha un mapping FK, e quel mapping punta a una colonna semanticamente sbagliata (un titolo di ruolo scambiato per un nome di competenza). |
| class_b_diagnostics/sys_skill_taxonomy_edges.md | report | Diagnosi piu complessa della batteria: 11 sorgenti, solo 1 con FK mappato, piu un quinto mirror-gap non documentato altrove (skill_adjacencies). |
| cw_b17_patches/CW_B17_PATCH_SPEC.md | spec | Specifica di codice pronta allapplicazione per chiudere il buco di osservabilita del silent-skip: nuovo file audit-rule-codes.ts, nuovo blocco SQL prima dellINSERT principale, 6 casi di test elencati esplicitamente. Poi effettivamente applicata nel ciclo 004/X1. |
| goals_pilot/00_README_GOALS_PILOT.md | piano | Indice del primo pilota SDBI completo (Goals/OKRs), con 8 checkpoint umani espliciti (HC-1 fino a HC-8) in attesa di conferma da Enzo prima dellesecuzione CLI. |
| goals_pilot/01_SOURCE_DISCOVERY.md | report | Analisi dal vivo di 11 tabelle sorgente (10 target dopo merge di okr_check_ins con okr_checkins), con distribuzione per tenant, campioni di righe reali e verifica di integrita referenziale a zero righe orfane. |
| goals_pilot/02_TARGET_SCHEMA_PROPOSAL.md | spec | Progetto DDL completo per 10 nuove tabelle sys.sys_goals* e sys.sys_okr*, con convenzioni di naming, chiavi naturali e vincoli CHECK, tutto poi effettivamente creato nelle migrazioni 000036/000037. |
| goals_pilot/04_PHASE3_TEMP_SDBI_DDL.md | spec | DDL per le tabelle di staging temp_sdbi.* usate per il caricamento a 2 passate (per risolvere le auto-relazioni gerarchiche). |
| goals_pilot/05_PHASE5_CONSOLIDATION_PLAN.md | spec | Piano SQL completo di consolidamento da temp_sdbi verso sys.*, comprensivo di query di verifica dry-run e procedura di rollback esplicita. |
| goals_pilot/mapping_cards/goal_alignments_sys_goal_alignments.md | spec | Mapping card, confidenza 0,95, autoapprovabile. |
| goals_pilot/mapping_cards/goal_check_ins_sys_goal_check_ins.md | spec | Mapping card, confidenza 0,90, autoapprovabile. |
| goals_pilot/mapping_cards/goal_comments_sys_goal_comments.md | spec | Mapping card, confidenza 0,93, autoapprovabile. |
| goals_pilot/mapping_cards/goal_milestones_sys_goal_milestones.md | spec | Mapping card, confidenza 0,95, autoapprovabile. |
| goals_pilot/mapping_cards/goal_templates_sys_goal_templates.md | spec | Mapping card, confidenza 0,85; segnala 4 colonne sorgente 100 per cento nulle, incluse come nullable per compatibilita futura. |
| goals_pilot/mapping_cards/goal_updates_sys_goal_updates.md | spec | Mapping card, confidenza 0,92, tabella piu grande del pilota (1811 righe). |
| goals_pilot/mapping_cards/goals_sys_goals.md | spec | Mapping card principale, confidenza 0,90. Contiene la decisione esplicita di ancorare goal_subject_user_id a un utente (sys_users) invece che a una posizione, per coerenza con gli invarianti I1 e I7. |
| goals_pilot/mapping_cards/key_results_sys_okr_key_results.md | spec | Mapping card, confidenza 0,92. |
| goals_pilot/mapping_cards/okr_check_ins_AND_okr_checkins_sys_okr_check_ins.md | spec | Mapping card per un merge di 2 tabelle sorgente distinte in un unico target con colonna discriminante, pattern inedito in questo pilota. |
| goals_pilot/mapping_cards/okrs_sys_okrs.md | spec | Mapping card, confidenza 0,88. Introduce una trasformazione inedita che deriva anno e trimestre fiscale da una data quando i campi sorgente sono nulli al 100 per cento. |
| P5_heuresys_test_decision.md | report | Corregge una conclusione iniziale sbagliata: heuresys_test NON e un semplice snapshot equivalente alla piattaforma, ma un database stantio di 7 giorni con 25 migrazioni mancanti. Decisione finale: non usarlo mai come sandbox SDBI, usare invece lo schema temp_sdbi dentro heuresys_advanced. Il documento riconosce esplicitamente il merito di Enzo per aver sollevato il dubbio prima che linvestigatore procedesse con lassunzione sbagliata. |

### batch_c2 (5 file)

| File | Ruolo | Digesto |
|---|---|---|
| cascade_fixes/00_README_CASCADE_FIXES.md | piano | Piano di autoring per sbloccare 4 target Classe B tramite alias sintetici di colonne sorgente, per non violare il vincolo assoluto A1 (mai UPDATE o DELETE dei mapping wave 1 esistenti). Segnala esplicitamente un rischio non ancora verificato (se il codice di staging sa risolvere gli alias). |
| engine_patches/00_README_ENGINE_PATCHES.md | piano | Indice di 3 patch al motore (CW-B22, CW-B23, CW-B24), con ordine di applicazione raccomandato e matrice di interazione tra le 3. Tutte e 3 poi effettivamente applicate nel ciclo 005/X2. |
| engine_patches/CW_B22_PATCH_SPEC.md | spec | Specifica dettagliata del fix per sostituire IS NOT DISTINCT FROM con un uguale index-friendly, con 3 alternative esplicitamente valutate e scartate motivando ciascun rifiuto. |
| engine_patches/CW_B23_PATCH_SPEC.md | spec | Specifica del fix ANALYZE post-stage, con spiegazione del meccanismo di staleness delle statistiche Postgres dopo un TRUNCATE. |
| engine_patches/CW_B24_PATCH_SPEC.md | spec | Specifica del fix di deduplicazione DISTINCT ON per la scrittura di lineage, con 2 cause radice distinte identificate (chiavi primarie composte collassate, espansione da JOIN su colonne nulle). |

### batch_c3 (12 file)

| File | Ruolo | Digesto |
|---|---|---|
| sdbi_scale/00_MASTER_INDEX.md | piano | Piano di scala per le restanti 11 macro-aree Tier D, con priorita a 3 livelli e stima di 60-90 ore cumulative su 3 wave future (mai eseguite in questo protocollo, vedi sotto). |
| sdbi_scale/01_PerformanceReviews.md | spec | Mini-specifica per la macro-area Performance Reviews, mai eseguita come pilota completo in questo protocollo (solo un tentativo parziale nel ciclo 015/X11). |
| sdbi_scale/02_RecruitingHiring.md | spec | Mini-specifica per Recruiting, MAI eseguita in questo protocollo. |
| sdbi_scale/03_OnboardingPreboarding.md | spec | Mini-specifica per Onboarding, MAI eseguita in questo protocollo. |
| sdbi_scale/04_SurveysEngagementWellbeing.md | spec | Mini-specifica per Surveys/Engagement, MAI eseguita in questo protocollo. |
| sdbi_scale/05_TimeLeaveAttendance.md | spec | Mini-specifica per Time/Leave, poi effettivamente eseguita come pilota completo nel ciclo 010/X5B (vedi batch_c4/time_leave_pilot). |
| sdbi_scale/06_FeedbackSystems.md | spec | Mini-specifica per Feedback systems, MAI eseguita in questo protocollo. |
| sdbi_scale/07_Mentorship.md | spec | Mini-specifica per Mentorship, MAI eseguita in questo protocollo. |
| sdbi_scale/08_PredictionsML.md | spec | Mini-specifica per Predictions/ML, MAI eseguita in questo protocollo. |
| sdbi_scale/09_CompensationExt.md | spec | Mini-specifica per Compensation extension, MAI eseguita in questo protocollo. |
| sdbi_scale/10_DocumentsSignatures.md | spec | Mini-specifica per Documents/Signatures, MAI eseguita in questo protocollo. |
| sdbi_scale/11_TalentPoolExt.md | spec | Mini-specifica per Talent Pool extension, MAI eseguita in questo protocollo. |

### batch_c4 (16 file)

| File | Ruolo | Digesto |
|---|---|---|
| cross_os_fixes/README.md | spec | Formalizza in 3 mitigazioni riusabili i problemi cross-OS scoperti nel ciclo 006/X3 (pg_dump con token restrict incompatibile con Windows, convenzione di migrazione, accoppiamento di build tra pacchetti). |
| esco_cascade/02_sys_esco_occupation_mappings_RETRY.md | spec | Piano di retry per sbloccare sys_esco_occupation_mappings dopo che sys_job_roles risulta finalmente popolato, con una query di verifica campione a 5 righe prima di procedere. |
| investigations/01_job_templates_failure_root_cause.md | report | Indagine forense che identifica la causa esatta del fallimento a zero upsert di job_templates: codici duplicati nella sorgente che violano il vincolo ON CONFLICT quando piu righe condividono lo stesso codice. Diventa il bias CW-B31. |
| sys_users_sdbi/00_README_SYS_USERS_SDBI.md | piano | Indice del pilota di estensione di sys_users, il primo caso SDBI dove il target esiste gia con dati (163 righe di seed CASCADIA). Popolazione finale stimata 433-437. |
| sys_users_sdbi/01_SOURCE_ANALYSIS.md | report | Analisi dal vivo di legacy_mirror.users (274 righe) incrociato con employees_core ed employees_pii, con enumerazione di tutti i casi limite (superuser senza dipendente collegato, utenti disattivati, id dipendente riusato da piu utenti). |
| sys_users_sdbi/02_MAPPING_STRATEGY.md | spec | Strategia di merge ibrida con legacy_mirror.users come tabella guida, tutte e 4 le decisioni di checkpoint umano gia risolte con un default motivato. |
| sys_users_sdbi/03_PHASE3_TEMP_SDBI_DDL.md | spec | DDL per lo staging temp_sdbi.sys_users con verifiche di pre-flight prima del caricamento. |
| sys_users_sdbi/04_PHASE5_CONSOLIDATION_PLAN.md | spec | Piano di upsert finale con garanzia esplicita di preservazione dei 5 amministratori di test tramite ON CONFLICT DO NOTHING, mai DO UPDATE. Poi effettivamente eseguito nel ciclo 010/X5B, risultato finale 433 utenti. |
| time_leave_pilot/00_README_TIME_LEAVE_PILOT.md | piano | Indice del secondo pilota SDBI, scelto per validare il motore su un dominio diverso da Goals (dati evento ad alto volume invece di entita gerarchiche). 8 checkpoint umani. |
| time_leave_pilot/01_SOURCE_DISCOVERY.md | report | Analisi dal vivo di 6 tabelle sorgente, 6267 righe totali, con distinzione tra le 3 in-scope e le 3 bonus. |
| time_leave_pilot/02_TARGET_SCHEMA_PROPOSAL.md | spec | Progetto DDL per 6 nuove tabelle sys.*, inclusa una colonna calcolata GENERATED ALWAYS per il totale ore che replica esattamente lespressione della sorgente. |
| time_leave_pilot/03_PHASE3_TEMP_SDBI_DDL.md | spec | DDL di staging con pattern a 2 passate per risolvere lauto-riferimento tra transazioni di saldo e saldi stessi. |
| time_leave_pilot/04_PHASE5_CONSOLIDATION_PLAN.md | spec | Piano di consolidamento in 6 passi con ordine di dipendenza FK esplicito, poi effettivamente eseguito nel ciclo 010/X5B con risultato 6220 righe totali distribuite su 6 nuove tabelle. |
| time_leave_pilot/mapping_cards/employee_attendance__sys_attendance.md | spec | Mapping card per la tabella piu grande del pilota (5237 righe), confidenza 0,90. |
| time_leave_pilot/mapping_cards/employee_overtime__sys_overtime.md | spec | Mapping card, confidenza 0,85; il campo payroll_job_id viene salvato solo nei metadati perche non esiste ancora un target sys per il payroll. |
| time_leave_pilot/mapping_cards/employee_time_off_balances__sys_time_off_balances.md | spec | Mapping card, confidenza 0,90. |

### batch_c5 (3 file)

| File | Ruolo | Digesto |
|---|---|---|
| enum_fix/CW_B32_PATCH_SPEC.md | spec | Specifica del nuovo transform code CAST_ENUM per convertire interi legacy in etichette di enum testuali, con verifica dry-run esplicita del SQL emesso prima di autorizzarne la spedizione. Poi effettivamente applicata nel ciclo 008/X5. |
| x4b_retrigger/README.md | piano | Riepiloga il lavoro gia autorato in batch_c4 ancora valido dopo il ciclo X4.A e definisce esplicitamente il controllo difensivo R-A2 (mai meno di 5 amministratori canonici) prima non definito con precisione. |
| xos_lib/README.md | spec | Libreria bash riusabile per generalizzare il pattern di estrazione cross-OS, con API documentata a 7 funzioni. Adozione dichiarata parziale: lo script gia esistente non viene refattorizzato, resta cosi comera. |

### batch_c6 (1 file)

| File | Ruolo | Digesto |
|---|---|---|
| cw_b34_engine_patch/CW_B34_PATCH_SPEC.md | spec | Specifica del fix per rendere il filtro WHERE-skip consapevole della nullabilita reale della colonna a livello di database, invece di un elenco fisso di eccezioni per nome colonna. Poi effettivamente applicata, sbloccando sys_esco_occupation_mappings da 0 a 7645 righe nel ciclo 009/X6A. |

### batch_c7 (3 file)

| File | Ruolo | Digesto |
|---|---|---|
| forensic_cw_b35/01_CW_B35_FORENSIC.md | report | Indagine che distingue un vero blocco semantico (fantasma FK) da un semplice buco di mapping: qui i dati sorgente risolvono correttamente 5 righe su 5 via lineage, quindi il problema e solo mapping mancante, non architetturale. Cataloga il nuovo pattern generale Import Mapping Gap. |
| forensic_cw_b36/01_CW_B36_FORENSIC.md | report | Indagine che identifica un pattern diverso: il mapping esiste ma punta a dati sorgente semanticamente sbagliati (metadati per-skill scambiati per una tassonomia di famiglie). Cataloga il pattern Mapping Misclassification. |
| forensic_cw_b37/01_CW_B37_FORENSIC.md | report | Indagine che trova un mix dei 2 pattern precedenti piu un terzo nuovo: un mapping LOOKUP_FK il cui campo match_on non esiste affatto nei dati di staging reali. Cataloga il pattern LOOKUP_FK Payload Misconfigured. |

### batch_c8 (2 file)

| File | Ruolo | Digesto |
|---|---|---|
| cw_b38_generalization/01_CW_B38_GENERALIZATION_SPEC.md | spec | Generalizza preventivamente la lezione di una regressione P0 gia avvenuta e gia mitigata (righe raddoppiate da 7645 a 15290 per la semantica NULL diversa da NULL in Postgres): fornisce un template di migrazione per ogni futura colonna FK resa nullable, cosi che il fix NULLS NOT DISTINCT venga incluso di default. Verifica live conferma che lo stato attuale del database e gia pulito. |
| cw_b39_forensic/01_CW_B39_FORENSIC.md | report | Indagine che scopre un disallineamento architetturale piu ampio nel dominio learning: la tabella sys_learning_modules attuale e popolata da fonti analytics derivate, non dai corsi canonici della sorgente legacy. Conclusione: rimandare a un ciclo dedicato (poi diventato la base del ciclo batch_c9). |

### batch_c9 (3 file)

| File | Ruolo | Digesto |
|---|---|---|
| adr_0017_lookup_fk_2hop/01_ADR_0017_SPEC.md | spec | ADR accettato (stato dichiarato ACCEPTED nellintestazione del file stesso, con riferimento diretto alla verifica CLI di ciclo 013/X9). Introduce un nuovo transform code LOOKUP_FK_2HOP per risolvere riferimenti indiretti a 2 salti (un codice URI che punta a una tabella intermedia il cui id punta poi al target finale via lineage). |
| cw_b35_phase_bc/01_FORENSIC.md | report | Triage delle 331 righe residue dopo la fase A del fix CW-B35: raccomanda un fix a filtro per 100 righe e una riclassificazione REFERENCE_ONLY per le restanti 231, entrambe a basso ritorno sullinvestimento. |
| sys_learning_modules_forensic/01_FORENSIC.md | report | Analisi molto dettagliata e onestamente auto-critica di un piano di remapping del dominio learning che si complica progressivamente durante la stesura stessa del documento: lautore ammette esplicitamente che la tripla entita legacy (corso, modulo di corso, percorso di apprendimento) non mappa in modo pulito sulla tripla di heuresys-advanced, e propone un approccio a fasi con possibilita esplicita di abbandono se la fase 3 risulta troppo complessa. |

### batch_c10 (2 file)

| File | Ruolo | Digesto |
|---|---|---|
| forensic_cw_b49/01_CW_B49_ROOT_CAUSE.md | report | Trova la causa esatta di un bug bloccante P0: uno split ingenuo su virgola di una espressione SQL che contiene una funzione COALESCE con virgole interne, che corrompe la query di deduplicazione. Include una query di verifica empirica eseguibile a mano che riproduce lerrore esatto atteso. Poi effettivamente corretto nel ciclo 014/X10. |
| loop_watchdog/01_LOOP_WATCHDOG_PROMPT.md | spec | Specifica production-ready (dichiarata verificata con test triviale reale il 23 maggio) di un sistema di automazione a 2 lati per ridurre lintermediazione umana tra Cowork e CLI fino a circa il 98 per cento: un watchdog lato CLI con il comando bundle di Claude Code e uno schedulato lato Cowork. Contiene il prompt testuale completo da incollare in una sessione CLI dedicata. |

### batch_c12 (1 file)

| File | Ruolo | Digesto |
|---|---|---|
| 01_STRATEGIC_ANALYSIS.md | piano | Analisi strategica pre-emptive (scritta prima ancora del REPORT del ciclo 015/X11 che lavrebbe dovuta innescare). Fotografa lo stato del database a quel momento (59 tabelle sys popolate su 134) e propone 3 percorsi: continuare SDBI a frammenti, virare su MVP-2 frontend, o un ibrido. Raccomanda esplicitamente librido, con stima di circa 120 ore di esecuzione CLI per completare MVP-2a a pagina per pagina. Le decisioni elencate come necessarie da Enzo non risultano tracciate in nessun file successivo di questa directory: il ciclo storico di questo protocollo si interrompe poco dopo (ultimo file cronologico e PROMPT_027, orfano, prossimo al freeze del 27 maggio). |

### File cross-cutting a fine directory (3 file)

**bias_registry.md** - ruolo: SoT/stato-vivo, con una sezione di regola vincolante innestata. E il registro cronologico di tutti i bias CW-B<N> scoperti durante lintero programma, da CW-B17 fino a CW-B63 al momento in cui il file smette di crescere in questo corpus (il file stesso dichiara di essere ancora vivo oltre il freeze della directory, unica eccezione dichiarata in _ARCHIVE_READONLY.md). Contiene, alla lettera, il protocollo di claim numerico per evitare race condition tra Cowork e CLI in sessioni parallele:
1. Leggi questo file.
2. Trova Next available: CW-B<N+1>.
3. Aggiungi la tua entry, anche solo come abbozzo minimo, nome piu originator piu data.
4. Aggiorna Next available.
5. Fai commit, atomico, riga singola se possibile.
Il file racconta anche una race condition storica realmente accaduta (REPORT 010 paragrafo 5 contro il forensic C7, doppio uso dei numeri CW-B35/36/37 per pattern diversi), poi riconciliata a mano assegnando i secondi ai numeri CW-B41-B45. Tally finale dichiarato nel file: 62 bias catalogati (CW-B17 fino a CW-B63, con CW-B57 ufficialmente RITIRATO), 45 mitigati o risolti, 1 ritirato, 0 differiti in modo permanente (CW-B59 risulta risolto il 27 maggio, fuori dallambito diretto di questo corpus ma documentato dentro il file stesso), 6 riflessivi (solo memo di pattern, nessuna azione di codice), 2 standardizzati, 1 documentato con mitigazione parziale, 3 in attesa di forensic minore, 1 in attesa di miglioramento del motore.

**COWORK_CLI_PROMPT_PATTERN.md** - ruolo: regola. Memo cross-sessione che codifica in modo esplicitamente prescrittivo come scrivere un PROMPT per il CLI, cresciuto per 20 sezioni attraverso lintero programma (changelog interno che arriva fino a 27 anti-pattern e 29 pattern vincenti alla fine del corpus). Contiene, alla lettera, la direttiva fondante che ha originato il memo (citazione di Enzo, 20 maggio): "Per il futuro, ricordati di essere sufficientemente assertivo e direttivo con cli ma utilizza appieno anche le sue capacita critiche di valutare le istruzioni, segnalare criticita, proporre correzioni e azioni eccetera". Contiene inoltre, alla lettera, un secondo richiamo esplicito di Enzo (23 maggio) sanzionando un comportamento scorretto di Cowork che aveva investito 2 ore in un tool prima di verificarne la fattibilita tecnica: "comportamento da dilettante, perche la feasibility e sempre un prerequisito da accertare". Da questo secondo richiamo nasce la sezione 14, Feasibility-before-implementation, con una checklist a 5 domande obbligatoria prima di ogni proposta di tooling con dipendenze esterne. Il memo documenta anche una gerarchia di modelli per sotto-task (Opus per orchestrazione, Sonnet per esecuzione standard, Haiku per query atomiche) e la scoperta della funzionalita bundle /loop di Claude Code come meccanismo di automazione.

**HANDOFF_FRESH_SESSION.md** - ruolo: stato-vivo, ma il file stesso si dichiara ESPLICITAMENTE superato in apertura, con un box di redirect: "questo file NON e piu la SoT" dal 27 maggio (S939), a favore di docs/kb/ nel repository principale. Il corpo del file sotto il redirect resta come archivio storico delle sessioni S933, S934, S935 con tabelle dettagliate di cosa e stato spedito in ciascuna, incluse istruzioni di ship pronte allesecuzione (script PowerShell). Contiene, alla lettera, la lezione operativa piu ripetuta nellintero corpus: "ogni REPORT CLI deve includere HANDOFF refresh come Block D obbligatorio", perche piu volte Cowork e ripartito su uno stato dichiarato stale dal CLI stesso.

## Sospetti superati

Nessuno di questi documenti viene dichiarato errato: si segnala solo la distanza tra la data del documento e lo stato attuale del progetto, come richiesto dal mandato. Non e stato verificato il contenuto contro il codice attuale.

1. **Lintero contenuto SDBI/brownfield di cowork_reserved e cowork_code_exchange (tutti i 272 file, datati 20 maggio - 26 maggio 2026) descrive un flusso di lavoro che oggi e strutturalmente vietato.** Il CLAUDE.md di progetto, invariante I12, dichiara dal 14 agosto 2026: "IL RUBINETTO E CHIUSO... Non si importa piu nulla dal legacy". Ogni file di questo corpus che descrive un piano di estrazione futura dal database legacy (lelenco completo delle 11 mini-specifiche in batch_c3/sdbi_scale, il piano di batch_c12/01_STRATEGIC_ANALYSIS.md, il kickoff PROMPT_027) descrive un modello operativo che il CLAUDE.md attuale definisce esplicitamente come "un piano da riscrivere, non da eseguire". Questo non e un errore dei documenti: sono cronaca di una fase gia dichiarata chiusa dalla stessa fonte normativa vigente.

2. **cowork_code_exchange/cli-prompt.md** e datato dal commit git al 25 luglio 2026, quasi 2 mesi dopo il freeze del 27 maggio 2026 dichiarato in _00_ARCHIVE_READONLY_NOTICE.md e in _ARCHIVE_READONLY.md di cowork_reserved. Il file stesso riconosce il freeze e si comporta di conseguenza (propone, non impone), ma la sua sola presenza fisica dentro una directory dichiarata congelata da 2 mesi, con una data di 2 mesi successiva, e un segnale di attenzione per chiunque legga la directory aspettandosi di trovare solo materiale ante-27-maggio.

3. **cowork_reserved/batch_c3/sdbi_scale/00_MASTER_INDEX.md** (21 maggio 2026) pianifica lesecuzione futura di 4 wave SDBI su 11 macro-aree, con stime di effort dettagliate. Il corpus successivo (fino al 26 maggio, data dellultimo file) mostra lesecuzione reale di sole 2 di quelle 11 macro-aree (Time/Leave completo, Performance Reviews solo parziale). Il piano non risulta mai aggiornato per riflettere questo scarto, ne mai dichiarato abbandonato in modo esplicito da nessun file successivo di questo corpus.

4. **cowork_reserved/batch_c12/01_STRATEGIC_ANALYSIS.md** (23 maggio 2026) elenca al paragrafo 5 un insieme di decisioni esplicitamente richieste a Enzo (scelta tra Percorso A, B o C). Nessun file successivo di questo corpus, fino allultimo file cronologico (PROMPT_027, 26 maggio 2026), registra la risposta di Enzo a questa richiesta o conferma quale percorso sia stato scelto.

## Contraddizioni doc-doc

Riportate senza arbitrare quale versione sia corretta. Le citazioni sono verbatim (traduzione letterale mantenuta dove il testo originale e in inglese, marcato come tale).

### Contraddizione 1 - numero e identita dei tenant di Wave 2

**cowork_code_exchange/_00_DISCOVERY_003_brownfield-seeding-complete.md** paragrafo 4 elenca come tenant target di Wave 2:
> "4: RTL_BANK + SmartFood + EcoNova + Heuresys System"

Il CLAUDE.md di progetto vigente (invariante I15, sezione "Non-negotiable invariants"), citato qui perche e la fonte con cui questi documenti storici entrano in tensione diretta, dichiara:
> "RTL Bank (customer-example tenant... 162 users) and Heuresys System (platform/system tenant) are the current production tenants... The phrases tenant di TEST / mai produzione are retired."

E lo stesso CLAUDE.md, invariante I21, documenta esplicitamente la rimozione storica di SmartFood dal dataset:
> "BP-SF-* purged (named SmartFood)... 35 food/energy learning paths purged (content, no industry hosting them)"

Non si arbitra quale sia corretto: si registra che un documento di pianificazione interno a questo corpus nomina esplicitamente 4 tenant (inclusi SmartFood ed EcoNova) come scope futuro, mentre la fonte normativa vigente del progetto dichiara solo 2 tenant correnti e conferma la rimozione fisica dei dati SmartFood.

### Contraddizione 2 - trattamento del dato come sintetico o come reale

**cowork_code_exchange/_01_PROMPT_003_v1.md** paragrafo 2.6, regole A16-W3/A18-W3, prescrive letteralmente:
> "user_is_synthetic=true" e "user_type='SYNTHETIC_REFERENCE'"

come requisito di sicurezza-dati per il ciclo 003.

Il CLAUDE.md di progetto vigente, sezione "OUTPUT RULE (S1011, Enzo - vincolante)", dichiara:
> "the no-PII / synthetic / ADR-0023 / safe-to-publish qualifier is RETIRED as a descriptor. Never append it as reassurance in messages, commits, docs, ADRs or questions; describe a datum for what it IS... never for what it isnt."

E linvariante I15 conferma:
> "Data is treated as real production data (quality, referential coherence, governance, idempotent/reversible writes)"

Non si arbitra quale sia corretto: si registra che un documento operativo di questo corpus tratta esplicitamente il tagging sintetico come requisito di sicurezza da applicare ai dati, mentre la regola vigente vieta esplicitamente quella stessa etichettatura come descrittore.

### Contraddizione 3 - stato dichiarato del ciclo cowork_code_exchange

**cowork_code_exchange/_00_ARCHIVE_READONLY_NOTICE.md** dichiara:
> "Dal 2026-05-27 (S939) questa directory e archivio storico read-only"

**cowork_code_exchange/cli-prompt.md**, fisicamente presente nella stessa directory con data di commit 2026-07-25, dichiara nel proprio corpo (paragrafo 0):
> "Nota protocollo: per heuresys-advanced il ciclo cowork_code_exchange (PROMPT/PLAN/EXEC/REPORT) e congelato; lavori in diretta."

Le due affermazioni non sono logicamente incompatibili tra loro (entrambe dicono che il ciclo e congelato), ma la loro coesistenza fisica - una notifica di freeze del 27 maggio, e un file operativo datato 25 luglio nella stessa cartella dichiarata chiusa - e di per se il segnale riportato qui senza interpretazione ulteriore.

## Menzioni di funzionalita del prodotto

Ogni voce riporta la citazione grezza con il file di origine. Le decisioni scartate e i lavori interrotti sono segnalati esplicitamente come tali, senza sintesi che ne attenui la portata.

### Funzionalita costruite (con evidenza numerica nel file di origine)

- Modulo Goals/OKRs, 10 nuove tabelle sys.sys_goals e sys.sys_okr, popolate con 5939 righe totali. Fonte: cowork_code_exchange/_04_REPORT_005_batch_x2.md, sezione Block C SDBI Goals/OKRs pilot SUCCESS. Dettaglio schema in cowork_reserved/batch_c1/goals_pilot/02_TARGET_SCHEMA_PROPOSAL.md paragrafo 11.
- Modulo Time/Leave/Attendance, 6 nuove tabelle sys, 6220 righe totali. Fonte: cowork_code_exchange/_04_REPORT_010_batch_x5b.md; schema in cowork_reserved/batch_c4/time_leave_pilot/02_TARGET_SCHEMA_PROPOSAL.md.
- Estensione sys_users da 163 a 433 utenti via merge ibrido da legacy_mirror.users piu employees_pii, con preservazione garantita dei 5 amministratori di test. Fonte: cowork_code_exchange/_04_REPORT_010_batch_x5b.md; piano in cowork_reserved/batch_c4/sys_users_sdbi/04_PHASE5_CONSOLIDATION_PLAN.md.
- MFA login gating, mfaService composto dentro auth.service.login, pagina login riscritta a 2 passi, 5 nuovi test di integrazione con TOTP reale piu 2 test Playwright end to end. Fonte: cowork_code_exchange/_04_REPORT_024_batch_x20.md, sezione MVP-3 Tappa E full scope CHIUSO.
- Pagina admin system-health con widget di osservabilita, ultimo gap di copertura E2E chiuso. Fonte: cowork_code_exchange/_04_REPORT_017_batch_x13.md.
- Pacchetto npm heuresys ui, pubblicato in versione 0.1.1, versione 0.1.0 deprecata, build dual ESM piu CJS via tsup. Fonte: cowork_code_exchange/_04_REPORT_022_batch_x18.md, sezione finale RESUMED numero 5.
- Motore di transform SQL-side del brownfield, 17 transform code totali al termine del corpus, 62 bias catalogati. Fonte: cowork_reserved/bias_registry.md paragrafo 5; cowork_reserved/batch_c9/adr_0017_lookup_fk_2hop/01_ADR_0017_SPEC.md.
- Sistema di automazione dual watchdog, CLI loop piu scheduled lato Cowork, verificato dal vivo con test triviale reale il 23 maggio 2026. Fonte: cowork_reserved/batch_c10/loop_watchdog/01_LOOP_WATCHDOG_PROMPT.md paragrafo 1, dicitura FBI 5 su 5 verified.

### Decisioni scartate, esplicitamente, con motivazione nel file di origine

- Il brownfield rigido come approccio esclusivo e stato scartato a favore del pivot SDBI. Direttiva di Enzo riportata verbatim in cowork_code_exchange/_00_SESSION_HANDOFF_2026-05-20.md paragrafo 3.1 e ri-citata in cowork_code_exchange/_04_REPORT_003_brownfield-seeding-complete.md paragrafo 7. Il Goal 003 e stato chiuso con stato dichiarato report_type FORMAL_CLOSURE_AT_SUSPENSION, non completato, sospeso per decisione strategica.
- Il mapping skill_classifications verso sys_skill_categories e stato riclassificato REFERENCE_ONLY perche semanticamente sbagliato, metadati per skill scambiati per tassonomia di famiglie. Fonte: cowork_reserved/batch_c7/forensic_cw_b36/01_CW_B36_FORENSIC.md paragrafo 4, Action A, con la query SQL di riclassificazione riportata per intero nel file.
- Il mapping job_title_courses verso sys_skill_learning_mappings punto skill_id e stato riclassificato REFERENCE_ONLY perche il campo match_on richiesto non esiste nei dati di staging reali. Fonte: cowork_reserved/batch_c7/forensic_cw_b37/01_CW_B37_FORENSIC.md paragrafo 4, Action A.
- I mapping course_modules e learning_path_courses verso sys_learning_path_steps sono stati riclassificati REFERENCE_ONLY per disallineamento architetturale del dominio learning. Fonte: cowork_reserved/batch_c8/cw_b39_forensic/01_CW_B39_FORENSIC.md paragrafo 5, con la query SQL di riclassificazione riportata per intero. Un tentativo di remapping alternativo e stato poi progettato, non eseguito, in cowork_reserved/batch_c9/sys_learning_modules_forensic/01_FORENSIC.md, che pero conclude ammettendo esplicitamente la propria incertezza sulla fattibilita della fase 3.
- Un tentativo di automazione watchdog PowerShell in modalita headless e stato abbandonato per infeasibilita tecnica verificata a posteriori, OAuth non ereditato in modalita headless. Fonte: cowork_reserved/COWORK_CLI_PROMPT_PATTERN.md paragrafo 14, che riporta il costo esplicito di circa 2 ore sprecate piu pulizia richiesta da Enzo.
- La diagnosi iniziale del bias CW-B57, un presunto dual package hazard causato da bundling inline di librerie pesanti, e stata formalmente ritirata dopo verifica empirica del CLI che ha dimostrato il bundle byte identico prima e dopo il fix proposto. Fonte: cowork_reserved/bias_registry.md, riga della tabella CW-B57, marcata WITHDRAWN 2026-05-24.

### Lavori interrotti, in corso poi fermati, con lo stato in cui sono stati lasciati

- Le pagine showcase dell app web sono state fisicamente spostate fuori dalla App Router di Next.js, rinominate in apps/web/src/_disabled_showcase_X18, ed escluse dal tsconfig, per permettere alle route admin di buildare. Istruzioni di spostamento riportate per intero in cowork_code_exchange/_01_PROMPT_022.5_batch_x18_amendment.md paragrafo 1, blocco D.1-D.3, con istruzioni di restore precise gia scritte per il ripristino futuro. Lo stato interrotto e ribadito in cowork_code_exchange/_00_HANDOVER_CLI_2026-05-26_post_S937.md sotto la voce X18 deferred restore. Il fix proprio, etichettato DEFER-F, e stato pianificato in dettaglio nel PROMPT_025 ma mai eseguito: nessun REPORT_025 esiste in questo corpus, e la notifica di inbox corrispondente risulta ancora in pending, mai processata.
- Il Brownfield Wave 1 a scala piena si e fermato a 13 target IMPORT completati su 19 possibili, 68 per cento. 6 target restano vuoti per 2 cause distinte, categorizzate come bias CW-B60-A, 3 target con filtro silenzioso nel motore poi risolto separatamente da questo corpus, e CW-B60-B, 3 target senza alcuna sorgente Wave-1 mai esistita. Fonte: cowork_code_exchange/_04_REPORT_023_batch_x19.md paragrafo 0. Segnalato come HALT P1, non come fallimento: nessuna azione ulteriore su questi 6 target risulta eseguita nel resto del corpus.
- 9 delle 11 macro-aree SDBI pianificate in cowork_reserved/batch_c3/sdbi_scale/ non risultano mai eseguite in questo corpus: Recruiting e Hiring, Onboarding e Preboarding, Surveys Engagement Wellbeing, Feedback Systems, Mentorship, Predictions ML, Compensation Extension, Documents Signatures, Talent Pool Extension. Ciascuna ha una mini specifica completa di schema DDL proposto, mai tradotta in migrazione. File: 02_RecruitingHiring.md, 03_OnboardingPreboarding.md, 04_SurveysEngagementWellbeing.md, 06_FeedbackSystems.md, 07_Mentorship.md, 08_PredictionsML.md, 09_CompensationExt.md, 10_DocumentsSignatures.md, 11_TalentPoolExt.md, tutti dentro cowork_reserved/batch_c3/sdbi_scale/.
- Il kickoff della Fase 2 SDBI, 7-9 macro-aree residue, pilota su Performance Reviews, e stato pianificato in dettaglio nel PROMPT_027 ma mai eseguito: nessun REPORT_027 esiste, e il file coincide cronologicamente con il momento del freeze dell intero ciclo, 26 maggio, un giorno prima del freeze del 27 maggio. Fonte: cowork_code_exchange/_01_PROMPT_027_s937_ck8_sdbi_phase2_kickoff.md.
- La proposta dell asse professione ISCO-08 piu CP2021 bilingue, cli-prompt.md datato 25 luglio 2026, e presentata esplicitamente come proposta non vincolante, in attesa di valutazione del CLI, con dichiarazione esplicita che la decisione finale di implementazione spetta al CLI. Nessun file di questo corpus registra una risposta o una esecuzione di questa proposta.

## Esclusioni

Target: zero. Nessun file e stato escluso da questa lettura per volume, ruolo o qualsiasi altro motivo. Tutti i 272 file delle due directory del Lotto B (172 in cowork_code_exchange, 100 in cowork_reserved) sono stati letti per intero e digeriti sopra, singolarmente o dentro un digesto di ciclo con ogni file nominato esplicitamente. Nessuna categoria di questo lotto e stata classificata Rumore o Storico ai fini di una esclusione: anche i file piu chiaramente cronaca superata, per esempio le mini specifiche SDBI mai eseguite in batch_c3/sdbi_scale, sono stati letti e digeriti per intero, perche il mandato di questa lettura richiede completezza sulle due directory assegnate, senza soglia di rilevanza.

## Lacune dichiarate

- Nessuna verifica e stata fatta contro lo stato live del database o del codice attuale del repository. Ogni numero, conteggio di righe, nome di tabella o esito di test riportato in questo digesto e una citazione di cio che il documento afferma, non una misura rifatta in questa sessione. Il mandato di questa lettura era registrare cio che i documenti dicono, non validarlo.
- Non e stato verificato se la decisione tra Percorso A, B o C richiesta a Enzo in cowork_reserved/batch_c12/01_STRATEGIC_ANALYSIS.md sia mai stata presa: nessuna risposta risulta in nessuno dei 272 file di questo lotto, ma la risposta potrebbe esistere altrove nel repository, per esempio in docs/kb/, fuori dall ambito di questa lettura.
- Non e stato verificato se il fix proprio di DEFER-F, pianificato ma mai eseguito in PROMPT_025, sia stato poi completato in una sessione successiva al di fuori di questo protocollo Cowork CLI, per esempio direttamente dal CLI in modalita diretta come descritto in cli-prompt.md.
- Il conteggio di 172 e 100 file e stato ri-misurato con find più wc -l in questa sessione ed e risultato identico al conteggio dichiarato dalla prima passata: non e stato pero verificato se il contenuto interno di ciascun file coincida byte per byte con quanto letto nella prima passata, dato che la prima passata non aveva letto il contenuto di questi 272 file.
- La classificazione di ruolo assegnata a ciascun file, in particolare la distinzione tra report e piano per i documenti della Knowledge Base forense iniziale, riflette un giudizio di lettura di questa sessione e non una etichetta dichiarata dai file stessi, salvo dove diversamente specificato con citazione diretta, per esempio lo stato ACCEPTED dichiarato nell intestazione di adr_0017_lookup_fk_2hop/01_ADR_0017_SPEC.md.

---

Fine del censimento pass-2, Lotto B. File compilato da un subagent in sola lettura su richiesta dell orchestratore. Nessuna modifica effettuata a cowork_code_exchange, cowork_reserved o a qualsiasi altro file del repository al di fuori di questo output.
