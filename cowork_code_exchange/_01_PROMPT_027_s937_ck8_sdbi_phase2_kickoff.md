# PROMPT 027 — SDBI Phase 2 kick-off (MVP-4 stream 2.4, scaling 7-9 macro-aree TRUE GAP)

**Goal ID**: 027 · **Slug**: `s937_ck8_sdbi_phase2_kickoff`
**Origin**: Cowork S937 CK-8 — Enzo decision MVP-4 stream selection = 2.4 SDBI Phase 2.
**Expected duration CLI**: 1-2 sessioni iniziali (pilot macro-area + setup); full stream 3-5 focused-weeks across multiple sessions.
**Predecessor HEAD**: `0c53fdf` (S937 partial closure pushed) + tag `v0.4.0a-s937-partial-checkpoint`.
**Reference docs (read FIRST)**:
- `docs/MVP_4_ROADMAP.md` §2.4 (scope + acceptance criteria + risks)
- `docs/architecture/adr/0014_sdbi_semantic_driven_brownfield_import.md` (paradigm, 6-phase workflow, status PROPOSED → da portare ad ACCEPTED)
- `cowork_reserved/bias_registry.md` §CW-B16..B21 (lessons embedded in ADR-0014 §3.8)

---

## §0 — Pre-condizioni operative

1. SSH agent loaded per oracle-vm-default. Verifica `ssh-add -l` shows ED25519. Se BLOCKED: vedi HANDOFF.md §S937 CK-1 — Enzo deve eseguire manualmente `& 'C:\Users\enzospenuso\Claude Desktop\scripts\s937-ck1-load-ssh-key.ps1'` in PowerShell aperto a mano.
2. Tunnel SSH 5433 up: `ssh -fN -L 5433:localhost:5432 oracle-vm-default`.
3. Smoke DB: `psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT now()"`.
4. Working tree clean su `main` HEAD `0c53fdf` o descendant.
5. pnpm install green su tutti i workspace.

---

## §1 — Scope Phase 2 (rif. MVP_4_ROADMAP §2.4)

7-9 macro-aree HRMS con **target schema MISSING** in `sys.*`, da inserire via SDBI workflow:

| # | Macro-area | Status | Effort stimato |
|---|---|---|---|
| 1 | **PerformanceReviews** (4-tier multi-rater) | IN scope — pilot consigliato | 8-10h |
| 2 | **Surveys/Engagement** (PULSAR cluster mid-overlap Wave 4) | IN scope | 7-9h |
| 3 | **Feedback** (peer 360, mentorship loops) | IN scope | 7-8h |
| 4 | **Mentorship** (pairing + sessions evidence) | IN scope | 7-8h |
| 5 | **PredictionsML** (churn / promotion-readiness scores) | IN scope | 8-10h |
| 6 | **Compensation** (bands già coperti, manca history) | IN scope (incremental) | 7-9h |
| 7 | **Documents** (metadata only, URI ref, no binaries) | IN scope | 7-8h |
| 8 | **TalentPool** (cross-tenant succession candidates) | IN scope | 7-8h |
| 9 | RecruitingHiring | OUT-of-scope I8 — marker only | <1h |
| 10 | Onboarding | OUT-of-scope I8 — marker only | <1h |

**Totale macro-aree IN scope reale**: 7-8 (escludendo marker). Effort cumulato 50-70h. Sommando AI confidence calibration + temp_sdbi management + audit rule_codes + runbook = **75-125h totali** come da MVP_4_ROADMAP.

---

## §2 — Workflow SDBI (6 fasi per macro-area, da ADR-0014 §4)

Per **ciascuna** macro-area IN scope:

**Phase A — Mapping_card authoring (Cowork)**:
- Cowork analizza brownfield source tables candidate per la macro-area.
- Cowork emette `cowork_reserved/sdbi_mapping_cards/<macro_area>_card.md` con: target sys.* schema (DDL proposal) + column mappings + transform codes + AI confidence per mapping.
- Enzo reviews + signs.

**Phase B — Migration sys.<target> (CLI)**:
- CLI crea migration nuova `db/migrations/000<NN>_sdbi_<macro_area>_target.sql` idempotente.
- Crea sys.* tables + indexes + FK + UQ constraints come da card.
- `pnpm db:migrate` su VM OCI tunnel 5433.

**Phase C — temp_sdbi staging (CLI)**:
- CLI popola `temp_sdbi.<macro_area>` con dati estratti via SDBI extractor (lexicon-based + AI mapping).
- Verifica rowcount + sample.

**Phase D — Consolidation (CLI)**:
- CLI esegue SDBI consolidator script (riferimento `apps/api/src/modules/sdbi-consolidator/` se esiste o da creare in pilot Phase A).
- Output: rows in `sys.<target>` + `sys.sys_source_lineage_records` con SDBI columns populated.

**Phase E — Audit + verify (CLI)**:
- Esegui audit rule_codes SDBI family per la macro-area.
- Verifica count source-vs-target + acceptance threshold da card.
- Cleanup `temp_sdbi.<macro_area>`.

**Phase F — REPORT + REVIEW**:
- CLI emette `cowork_code_exchange/_04_REPORT_027_<macro_area>.md`.
- Cowork emette `_05_REVIEW_027_<macro_area>.md` + decide pass/fail/iterate.

---

## §3 — Sequenza CLI raccomandata per kick-off

**Sessione 1 (questa)**:

1. **Pre-flight**: §0 + `git pull --ff-only origin main` (espected HEAD `0c53fdf` o descendant + tag `v0.4.0a-s937-partial-checkpoint`).
2. **ADR-0014 → ACCEPTED**: Cowork (NON CLI) deve preparare il diff status PROPOSED → ACCEPTED + sign-off note da Enzo. Se non ancora fatto, fermati e segnala in halt notify `__027__halt_adr_0014_not_accepted.md`.
3. **Migration 000034 (temp_sdbi schema) + 000035 (lineage SDBI columns extension)**: applica i migration drafts già presenti in ADR-0014 §4.2 / §4.3. Verifica idempotency `pnpm db:migrate` × 2 → pg_dump diff vuoto. Se non ancora draft-ati come file SQL, generali da ADR-0014 spec.
4. **Audit rule_codes SDBI family**: extend `apps/api/src/modules/brownfield-wave-executor/audit-rule-codes.ts` con SDBI rule_codes (~10-15 codes da ADR-0014 §3.8). TypeScript constants only, no DB impact.
5. **SDBI runbook scaffold**: crea `docs/sdbi/RUNBOOK.md` con TOC + Phase A-F template + esempio pilot.
6. **Pilot macro-area = PerformanceReviews**: avvia Phase A (mapping_card authoring) — questa è competenza Cowork; in questo PROMPT CLI si limita a setup infrastrutturale per ricevere il card.

**Commit policy**: 1 atomic commit per item §3.x. Commit prefix `feat(sdbi): MVP-4 2.4.<N> — <item>`. NO push autonomo (rispetta R12 git safety; Enzo autorizza push esplicitamente).

**Sessione 2+** (out-of-scope di questo PROMPT, sarà PROMPT 028+): pilot PerformanceReviews end-to-end Phase A-F; lessons learned; setup template per le altre 6-7 macro-aree.

---

## §4 — Acceptance Sessione 1 (questo PROMPT)

1. ADR-0014 status = ACCEPTED (Cowork ship + Enzo sign).
2. Migration 000034 + 000035 applied successfully on OCI VM DB. `pnpm db:validate` green (twice-run idempotency).
3. SDBI audit rule_codes shipped in `audit-rule-codes.ts` (compile + lint clean).
4. `docs/sdbi/RUNBOOK.md` scaffold committed (con TOC + template Phase A-F).
5. PROMPT 027 chiuso con `_04_REPORT_027_*.md` che enumera deliverable + carry-over per PROMPT 028.
6. Test suite globale: ≥ baseline (no regression — 341 PASS + 1 pre-esistente skills:131 fail accettato).
7. NO push (Enzo gate finale).

---

## §5 — Vincoli + Anti-bias

- **I3/I4 schema discipline**: nuove tabelle in `sys.sys_<plural>`. Aux schemas `staging/brownfield/audit/temp_sdbi` only.
- **I5 no RLS**: tenant isolation via FK + middleware.
- **RD-08 no PG ENUM**: nuove categorical columns → `varchar(N) + CHECK`.
- **R10 no hallucination**: verifica path/version/flag prima di asserzioni. Per ADR-0014 schema details rileggi il file effettivo.
- **R11 secret hygiene**: nessun secret in commit. JWT keys, DB password, OCI passphrase mai loggati.
- **R12 git safety**: nessun `--force`, `--no-verify`, `git reset --hard` senza explicit ask.
- **R14 anti-bias**: time-box pilot macro-area Phase A-F max 12h. Se inconclusive → REPORT halt + Cowork re-scope.
- **R23 autonomy**: zero delega evitabile per task tool-disponibili (filesystem, git, DB queries via psql). User-delegated solo: ADR sign-off, push autorizzazione finale.

---

## §6 — Halt protocol

Halt se:
- ADR-0014 non ACCEPTED al pre-flight → halt notify `__027__halt_adr_0014_not_accepted.md` + sospendi.
- Migration apply fallisce o non idempotente → halt notify `__027__halt_migration_apply_fail.md` + rollback safe.
- Audit rule_codes typecheck/lint failure → fix in-loop (R3), no halt.
- SSH tunnel down post pre-flight → halt notify `__027__halt_ssh_tunnel_lost.md` + tentativo riconnect 3× before halt.

---

## §7 — Carry-over expected (per PROMPT 028)

- Pilot PerformanceReviews mapping_card.md (Cowork authored, atteso fra S938 e S939).
- Phase B-F pilot run.
- Lessons learned → template per altre 6 macro-aree.
- Audit query per cross-check lineage SDBI columns populated correctly.

---

*Created Cowork S937 CK-8 — autonomia non-presidiata ereditata da S935+S936+S937; R23 enforcement pieno; ADR-0014 status flip è atomic decision Enzo (Cowork edit, Enzo sign-off note inline).*
