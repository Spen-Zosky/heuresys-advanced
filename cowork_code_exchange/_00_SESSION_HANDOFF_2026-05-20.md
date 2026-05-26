# Session Handoff — 2026-05-20 (Cowork side)

**Sessione**: Cowork lunga 2026-05-18 → 2026-05-20 (S900→S923-equivalent)
**Stato chiusura**: SUSPENDED_PENDING_STRATEGIC_PIVOT
**Lock Cowork**: da rilasciare al termine di questo handoff
**Branch**: `main` — 8 commit ahead di `origin/main` (push deferred pending strategic decision)
**Last commit**: `7a432a9` chore: handoff S923 — Goal 003 EXEC HALT awaiting Cowork Z-decision (5 INFEASIBLE)

---

## §1 — Riassunto compatto

Goal 003 (brownfield-seeding-complete) iniziato come single-shot Wave 1+2+3+4, già una volta narrowed (v1→v2) a Wave-1-only, poi ulteriormente narrowed in 3 scope corrections successive durante EXEC mid-flight:

| Step | C5 bar | Trigger |
|---|---|---|
| Originale v2 | ≥15/15 | PROMPT v2 |
| v2→v3 | ≥12/15 | Class B sub-discovery (CW-B18 registry completeness gap) |
| E1 verbal | ≥11/15 | Semantic verify (CW-B19 source-side FK availability gap) |
| Z1 verbal | ≥10/15 | UQ block (CW-B20 registry UQ + JSON_EXTRACT systemic constraint) |

**Pattern emergente**: ogni "fix" rivela un livello più profondo della stessa lacuna concettuale. Enzo (2026-05-20T01:30) ha riconosciuto che l'**approccio brownfield rigido è strutturalmente sbagliato** e ha proposto **pivot a SDBI** (Semantic-Driven Brownfield Import, nomenclatura provvisoria) — approccio interpretativo AI-led con temp_ schema staging.

CLI istruito a HALT + chiudere sessione. Goal 003 NON chiude formalmente — viene **sospeso** pending decisione strategica complessiva.

---

## §2 — Stato concreto Goal 003 al momento sospensione

### 2.1 Commits shipped (7 + 1 handoff) ahead di origin/main

| SHA | Commit | Item Goal 003 |
|---|---|---|
| `f065ef2` | chore(api): test fix Goal 002 LOOKUP_FK PK_OVERRIDES regression | step 0 baseline hotfix |
| `9c8cb1f` | chore(api): TYPE_CAST_MAP completeness + applyTypeCoerceWrap helper | Item K |
| `6a43157` | chore(db): migration 000032 — relax sys_activity_classifications _scheme_check | Item C |
| `2c2bf6e` | feat(brownfield): migration 000033 — tenant_id_mappings table + validate_lookup_fk_payload trigger | Items D+M (CP-v2-1 / CP2) |
| `2b0e2da` | feat(api): LOOKUP_FK fallback-only path for legacy_<X>_id | Item A (scope-lock) |
| `c56ff18` | feat(api): CAST_* compat-target auto-wrap | Item B |
| `127e1a7` | feat(api): LOOKUP_FK form (b) lineage-records JOIN | Item F P1 (post-diagnostic) |
| `7a432a9` | chore: handoff S923 (CLI session-end) | — |

### 2.2 Migrations applied on VM `oracle-vm-default` DB `heuresys_advanced`

- **000032** (migration_id 385): sys_activity_classifications._scheme_check relaxed
- **000033** (migration_id 386): brownfield.tenant_id_mappings table + validate_lookup_fk_payload() trigger
- **Migration 000031** (Goal 002) già applicata
- **pg_stat_statements 1.10** già abilitato

### 2.3 Tests state

318 passed | 5 skipped | 0 failed (+29 vs Goal 002 baseline 289).
72/72 transform-compiler. 23/23 upsert-sql-type-coerce.

### 2.4 Wave 1 retry run (single completato pre-HALT)

- runId: `08d3bc9f-e16d-418d-8414-17873ef170aa`
- Wall-clock: 2896s (48 min, recalibrated rate 3.9 lineage rows/sec sostenuto)
- COMPLETED status
- Results: 6/15 baseline + sys_activity_classifications 3276 (Item C) + 4 Class-A P1-fixed via P1 commit `127e1a7` (sys_skill_aliases, sys_skill_taxonomy_edges, sys_skill_learning_mappings, sys_process_kpi_templates) = expected 10/15 popolati post-retry
- 5/15 INFEASIBLE documentati (vedi §2.5)
- Backup pre-Goal-003: `/home/ubuntu/backups/heuresys_advanced_pre_goal003_*.dump` (252MB)

### 2.5 5 INFEASIBLE targets identificati (Goal 004 prerequisite-dependent)

| # | Target | Bias surfaced | Root cause |
|---|---|---|---|
| 1 | sys_skill_categories | CW-B20 | UQ + JSON_EXTRACT pre-mapping forbids additive LOOKUP_FK |
| 2 | sys_learning_path_steps | CW-B19 | Wave 1 doesn't import legacy `courses` table; course_id has no lineage to sys_learning_modules |
| 3 | sys_blueprint_process_registry | CW-B18 | sys_blueprint_variants (1 seed) NOT in any wave + no source variant_id col |
| 4 | sys_job_roles | CW-B18 | sys_job_families (0 rows) NOT in any wave + no source family_id col |
| 5 | sys_esco_occupation_mappings | CW-B18 | cascade dep on sys_job_roles + no source job_role_id col |

### 2.6 Bias catalog (CW-B16 → CW-B20)

| Bias | Topic | Goal di scoperta |
|---|---|---|
| CW-B16 | PLAN wall-clock targets derived from broken-baseline runs systematically underestimate Goal-N wall-clock when fix N→N+1 unlocks full volume | Goal 003 Item F first run |
| CW-B17 | WHERE-skip filter silenzia rows che violano NOT NULL FK senza emettere audit class → forensic blind spot | Goal 003 Item F diagnostic |
| CW-B18 | DISCOVERY enumerates KNOWN broken mappings but doesn't verify registry COMPLETENESS (per target, ogni NOT NULL FK column ha ≥1 mapping?) | Goal 003 Class B findings |
| CW-B19 | DISCOVERY assumes source data has FK lookup keys; doesn't verify source-side availability (per (target, FK column, source_table), source row carries value lineage can resolve?) | Goal 003 semantic verify |
| CW-B20 | Registry design UQ `(table_mapping, source_column)` + JSON_EXTRACT pre-mapping forbids additive LOOKUP_FK insertion. Architectural constraint surfaced only at apply-time | Goal 003 Class B UQ block |

---

## §3 — Strategic pivot (Enzo direttiva 2026-05-20T01:30)

### 3.1 Verbatim direttiva (preserved as evidence)

> *"cli sta eseguendo ma io ho completamente perso la bussola e il controllo della situazione. non voglio procedere in questo modo e devo rivedere strategia e tattica del seeding intelligente e adattivo del dbms target attraverso i dati presenti nel dbms source. è concettualmente sbagliato applicare criteri di coerenza e integrità tra i due dbms: la strategia deve basarsi sulla 'interpretazione' (anche semantica) dei dati source per riuscire a collocarli in tabelle e campi coerenti nel target, eventualmente ricostruendo strutture, indici, relazioni a posteriori. Sperare che i dati possano semplicemente corrispondere tra source e target è del tutto sbagliato. Il processo logico è:
> 1- Leggo una tabella source, CAPISCO quali dati tratta e quali relazioni intrattiene con altre tabelle/dati
> 2- cerco la tabella target che SOMIGLIA di più (per analogia) a quella source; interpreto i campi in comune (ancora una volta per similitudine/analogia) che posso popolare con i dati source e faccio il seeding
> 3- percorro le relazioni della tabella source e, per ogni tabella source ad essa correlata, rifaccio 1 e 2 e così via
> 4- al termine del ciclo ricostruisco indici/relazioni anche nella dbms target.
> Tutto questo processo deve prevedere la creazione di tabelle target con schema temp_ per non contaminare i dati target sys_ già consolidati. In una fase successiva si definirà la strategia di consolidamento in sys_ e l'eliminazione delle tabelle temp_.
> è un lavoro tipico per AI e agenti.
> Al momento l'idea è questa ma devo ancora affinarla"*

### 3.2 Cowork strawman SDBI v0.1 (proposto da Cowork in chat, NOT yet approved/discussed)

**Nomenclatura provvisoria**: SDBI — Semantic-Driven Brownfield Import. Da rivedere.

**6 fasi proposte**:

1. **SOURCE DISCOVERY (per-table)**: schema introspect + sample data extract + AI semantic analysis → output `source_table_card` (JSON/markdown semantic descriptor)
2. **TARGET ANALOGY MATCHING (per-table, AI-led + human review)**: candidates top-N sys.* by analogy + field-by-field mapping con confidence (HIGH/MEDIUM/LOW) + reasoning → human checkpoint → `mapping_card` approved
3. **TEMP_ SEEDING (mechanical, post-approval)**: crea `temp_<sys_table>` senza FK constraints, INSERT-SELECT applicando mapping. Idempotent, traceable.
4. **RELATIONSHIP TRAVERSAL (per-FK ricorsivo)**: per ogni FK source, ripeti 1+2+3 per la source table puntata. Build graph nodes/edges. Detect cycles.
5. **CONSOLIDATION REVIEW (separata, human-gated)**: diff temp_ vs sys_, AI proposta consolidation plan (INSERT/UPDATE/SKIP), human approves, build/rebuild indici+FK in sys_
6. **TEMP_ CLEANUP** (post-consolidation human-confirmed): DROP o ARCHIVE in audit schema

**Affinamenti chiave open**:
- Confidence threshold per autopilot vs human checkpoint
- Bidirectional mapping (1 source → N target)
- Field synthesis (computed/default/lookup/derived per NOT NULL target)
- Lineage tracking enriched (source_record_id + mapping_card_id + confidence + human_approver + timestamp)
- Adaptive learning (memorizzare correzioni umane per pattern recognition future)
- Sample diversity (stratified, non solo top-N)
- Cross-tenant boundary awareness
- Idempotent re-runs
- AI failure modes mitigation (hallucinations detection)
- Provenance dual-write per consolidation diff

### 3.3 Open questions Q1-Q4 (NOT yet answered by Enzo)

**Q1 — Goal 003 in corso**: a) HALT immediato, b) Lascia completare Item F retry+REPORT, c) Lascia completare Goal 003 totale con REPORT documenta pivot.
**Risposta Enzo (2026-05-20T01:35)**: HALT immediato + close session. Goal 003 NON completato formalmente. Memorize state + reprende in altra sessione.

**Q2 — Quanto del lavoro shipped serve nello SDBI?** (NOT YET DISCUSSED)
- P1 commit `127e1a7` (compiler form b → lineage JOIN): potenzialmente riusabile come "mechanical executor of AI-generated mapping cards"
- Migration 000031 (UQ sys_user_certifications): schema hardening neutrale, resta
- Migration 000032 (sys_activity_classifications CHECK relax): semantic data quality decision, resta
- Migration 000033 (brownfield.tenant_id_mappings + validate_lookup_fk_payload trigger): trigger potrebbe restare come safety net o deprecato
- `brownfield.column_mappings` rows shipped: probabilmente da archiviare; SDBI starts fresh
- transform-compiler.ts logic: parzialmente riusabile come mechanical executor
- audit infrastructure: fully riusabile (concetti diversi: CASCADE_PREREQUISITE_MISSING diventa AI_LOW_CONFIDENCE_NEEDS_REVIEW o equivalente)

**Q3 — Chi è "AI" nello SDBI?** (NOT YET DISCUSSED)
- (α) AI = Cowork Claude come supervisor che genera mapping_cards via session, CLI esegue mechanical seed
- (β) AI = CLI Claude Code direttamente con prompt engineering agentic + human-in-the-loop checkpoint
- (γ) AI = entrambi: Cowork pianifica strategia per source table, CLI esegue + AI infer specifica per source data
- Cowork inclination: γ con prevalente α nella fase pilota (prime 5-10 tabelle), poi scalare verso β

**Q4 — Pilot scope** (NOT YET DISCUSSED):
- Una source table FACILE per validare flow
- Una MEDIA per stress-test confidence
- Una DIFFICILE (`business_processes` / `onet_occupations`) per validare edge cases

---

## §4 — Cosa preservare vs riconsiderare nella prossima sessione

### 4.1 PRESERVE (assets riusabili)

- **Protocollo Cowork↔CLI v2.2** (cowork_code_exchange/README.md): 7 fasi + STATE + inbox + R1-R8 strutturali — concettualmente robusto, va adattato per SDBI workflow (DISCOVERY/PROMPT/PLAN/APPROVAL/EXEC/REPORT/REVIEW restano, contenuto cambia)
- **Inbox tunneling system** (.inbox/cowork/cli/) + notify/inbox scripts — valgono identici per SDBI
- **Lock system** (.cowork-active.lock, locks.mjs) — valgono identici
- **Validator + pre-commit hook** — restano (preservano integrità file artifacts)
- **session-start.mjs + session-end.mjs** — restano
- **Bias catalog CW-B1..B20** — è esperienza accumulata cross-Goal, riutilizzabile per SDBI DISCOVERY checklist
- **Migrations 000031/32/33 applied** — restano (schema neutrale/hardening)
- **API tests 318 passed** — restano (regressioni Goal 002+003 fix protected)
- **Audit infrastructure** (audit.import_validation_results) — riusabile con nuove rule_codes per SDBI

### 4.2 RICONSIDERARE (architetturale, SDBI-dependent)

- **brownfield.column_mappings registry design**: UQ + JSON_EXTRACT pre-mapping (CW-B20) ha rivelato design constraint per LOOKUP_FK additivo. SDBI potrebbe by-pass questo registry completamente OR ridisegnarlo per supportare AI-generated mapping cards
- **brownfield.table_mappings registry**: SDBI generato AI vs hand-authored — quale resta?
- **transform-compiler.ts**: 14 transform codes (12 mechanical + JSON_EXTRACT + LINEAGE_SOURCE_NK + LOOKUP_FK form a/b). SDBI potrebbe richiedere NUOVI transform codes (es. AI_SEMANTIC_TRANSFORM con embedded LLM prompt) OR il compiler diventa mechanical executor di SQL pre-generato dall'AI
- **Wave concept (1/2/3/4)**: nello SDBI le "wave" potrebbero diventare obsolete — l'ordine è dettato dal FK traversal AI-led, non da pre-definizione waves
- **brownfield.import_runs + import_run_status**: utile, ma SDBI sessions sono iterative + AI-led, semantica leggermente diversa
- **upsert-sql.ts WHERE skip filter (lines 238-269)**: la silent-skip su NULL FK era la causa CW-B17. SDBI dovrebbe NON usare silent-skip — temp_ schema + audit + human review

### 4.3 OPEN DECISIONS (sospese)

- 8 commit Goal 003 ahead di origin/main: push o reset?
  - **Inclinazione Cowork**: NON push fino a strategic clarity. I commit sono validi (test verdi + migration applicate sul DB), ma reflectono approccio rigido che stiamo pivotando. Pushare poi pivotare crea narrative confusing. Lasciare in local main + decidere in next session.
- `brownfield.column_mappings` DB state (rows applicate dai mappings JSON_EXTRACT Goal 002): keep o truncate?
  - **Inclinazione**: keep (preservano traceability). SDBI usa temp_ schema separato — nessun conflict.
- Backup pg_dump pre-Goal-003 (252MB su VM): retain, è recovery point pulito.

---

## §5 — Resume protocol prossima sessione

### 5.1 Pre-flight

```bash
# 1. SSH tunnel
ssh -fN -L 5433:localhost:5432 oracle-vm-default

# 2. DB smoke
PGPASSWORD=heuresys psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "\dt sys.sys_auth*"

# 3. Repo state
cd D:/heuresys-advanced
git status -sb                # expect: 8 commit ahead origin/main (Goal 003)
git log --oneline -10
ls cowork_code_exchange/      # this handoff + all Goal 003 artefacts
```

### 5.2 First read (Cowork side)

1. **`_00_SESSION_HANDOFF_2026-05-20.md`** (questo file) — full context
2. **`_03_EXEC_003_CLASSB_UQ_BLOCK_Item_F.md`** — ultimo CLI halt finding (CW-B20)
3. **`_00_STATE_003.md`** — D15/D16/D17/D18 decisions locked + EXEC phase frozen
4. **`.handoff/STATE.md`** (repo root) — CLI side handoff S923 (mirror context)

### 5.3 First action (Cowork side)

**NON eseguire Goal 003 closure.** Aprire sessione strategica dedicata SDBI:

1. Conversare con Enzo su Q1-Q4 affinement
2. Convergere su SDBI v0.x architecture spec
3. Decidere fate of 8 commits Goal 003 (push/reset/cherry-pick parziale per assets riusabili)
4. Decidere fate of registry data (brownfield.column_mappings/table_mappings)
5. Emit DISCOVERY 004 SDBI come PROMPT supervisor-side
6. CLI prossima sessione fa PLAN 004 SDBI

### 5.4 First action (CLI side, se la prossima sessione è CLI)

Se Enzo apre fresh session CLI prima di sessione Cowork SDBI:
1. **NON eseguire Z1 retry P1-only** (sospeso pending strategic decision)
2. **NON pushare 8 commits** (pending strategic decision)
3. Leggere `_00_SESSION_HANDOFF_2026-05-20.md`
4. Saluta con riassunto + attendi direttiva Cowork strategica

---

## §6 — Files inventory cowork_code_exchange/ Goal 003

| File | Status |
|---|---|
| `_00_DISCOVERY_003_brownfield-seeding-complete.md` | Goal 003 DISCOVERY (incomplete per CW-B18/B19/B20, ma resta come storico) |
| `_01_PROMPT_003_brownfield-seeding-complete.md` | PROMPT v3 canonical (sha 42a70f92) |
| `_01_PROMPT_003_v1.md` | PROMPT v1 archive (sha dfa5eee6) |
| `_01_PROMPT_003_v2.md` | PROMPT v2 archive (sha 59a1fe63) |
| `_02_PLAN_003_brownfield-seeding-complete.md` | PLAN v2 canonical (sha ecd21b78), remains operative for shipped Items K/A/B/C/D/M |
| `_02_PLAN_003_v1.md` | PLAN v1 archive (sha bf0d9e12) |
| `_02b_APPROVAL_003.md` | APPROVAL PLAN v2 (sha a55e144e) |
| `_03_EXEC_003_brownfield-seeding-complete.md` | EXEC log Goal 003 (partial, fino a step F semantic_verify) |
| `_03_EXEC_003_DIAGNOSTIC_REPORT_Item_F.md` | Class A diagnostic + P1 fix shipped |
| `_03_EXEC_003_CLASSB_FINDINGS_Item_F.md` | Class B registry gap findings |
| `_03_EXEC_003_CLASSB_SUBDISCOVERY_Item_F.md` | Class B sub-discovery (3 INFEASIBLE confirmed) |
| `_03_EXEC_003_CLASSB_SEMANTIC_FAIL_Item_F.md` | Class C surfaced (CW-B19) + 4° INFEASIBLE |
| `_03_EXEC_003_CLASSB_UQ_BLOCK_Item_F.md` | Class B UQ block (CW-B20) + 5° INFEASIBLE |
| `_00_STATE_003.md` | STATE 003 frozen at EXEC phase post-Z-block |
| `_00_SESSION_HANDOFF_2026-05-20.md` | **THIS FILE** — Cowork session handoff with strategic pivot context |
| `_04_REPORT_003_*` | **NOT created** (Goal 003 suspended, no formal closure) |
| `_05_REVIEW_003_*` | **NOT created** (depends on REPORT 003) |

Inbox state:
- `.inbox/cli/pending/` — 1 message pending: `2026-05-19T23-25-00Z__003__exec_directive_E1.md` (Z1 directive irrilevante post-pivot, lascia in pending o move to read)
- `.inbox/cowork/pending/` — 8 exec_progress messages da CLI (riferimento storico, mantieni)

---

## §7 — Cowork lock release

Al completamento di questa sessione, Cowork rilascia il lock `.cowork-active.lock`. Sessione successiva ripartirà clean.

---

## §8 — Promemoria per next session (TL;DR per pigri)

1. **Non sei tornato a fare seeding rigido**. Stai per discutere SDBI con Enzo.
2. Leggi questo file completo + UQ_BLOCK file (CW-B20 è il finding più importante).
3. Non pushare commit Goal 003 senza strategic decision.
4. Q1 risposto (HALT). Q2/Q3/Q4 ancora aperti.
5. Lo strawman SDBI v0.1 in §3.2 è solo proposta — Enzo può riscriverlo da zero o adottarlo.
6. La promessa "DBMS ready for functional development" è SUSPENDED, non rotta. Cambierà forma con SDBI.
7. Tutti i 5 INFEASIBLE targets diventano use cases pilot ideali per SDBI (sono i casi che il rigid brownfield NON poteva gestire — SDBI deve dimostrare che li gestisce).
8. Pattern CW-B16..B20 sono input prezioso per SDBI DISCOVERY checklist. Non scartarli.

---

*End of _00_SESSION_HANDOFF_2026-05-20.md*
