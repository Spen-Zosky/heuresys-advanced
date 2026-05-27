# heuresys-advanced — STATE

**Updated**: 2026-05-27 (S940 — MVP-4 stream 2.4 SDBI Phase 2 opened: infra + PerformanceReviews design pilot).
**Branch**: `main` — HEAD `<handoff>` (local, **NOT pushed**). 7 commit ahead of `origin/main` @ `aa4cb8f`.
**Last tag**: `v0.4.1-housekeeping-closed` (@ `01340ae`).
**CI**: verde all'ultimo push (aa4cb8f). **0 alert Dependabot.** Tunnel 5433 up. Test API **345 pass / 5 skip / 0 fail**.

## Last session brief

S940: aperto **MVP-4 stream 2.4 — SDBI Phase 2** (CLI-owned, no Cowork). **ADR-0014 → ACCEPTED** (sign-off Enzo, evidenze §5). Infra SDBI completata: migration **000045** (4 colonne provenance SDBI su `sys.sys_source_lineage_records`), **8 audit rule_codes SDBI** in `audit-rule-codes.ts`, **`docs/sdbi/RUNBOOK.md`** scaffold 6-fasi. **Pilot PerformanceReviews = DESIGN pilot**: mapping card `PERFREV-MAP-01` (`cowork_reserved/sdbi_mapping_cards/`) + migration **000046** (8 tabelle target `sys.sys_performance_*`/`sys_review_*`). zod4 (#3+#5) **differito** (rischio HIGH, irrilevante a questa sessione). Bonus R3: **fix idempotency migration 000007** (re-asserzione strict del `scheme_check` clobberava il relax di 000032 → catena rotta).

## 🔴 Carry-over BLOCCANTI (decisione Enzo)

1. **Source PerformanceReviews vuoto** — tutte le 8 source `heuresys_platform.public` (e le altre 7 macro-aree candidate) hanno **0 righe**. I pilot Goals/OKRs+Time/Leave funzionarono perché i dati erano in `legacy_mirror` (export `db-export-2026-05-15`); le perf-review non furono mai mirate. → **Phase 3-6 (import dati) DIFFERITE**. Per importare: localizzare i dati nel dump heuresys-evo originale + estendere l'extract per mirarli in `legacy_mirror`. (Dato confermato 2026-05-27.)

2. **Catena migration non ri-eseguibile end-to-end** — `bash db/scripts/migrate.sh` si ferma a **000033** con `must be owner of table tenant_id_mappings` (l'utente `heuresys` non possiede `brownfield.tenant_id_mappings`; serve superuser o reassign owner). 000007 fixato questa sessione, ma a valle restano break di ownership. **000045/000046 applicate direttamente via psql** (self-contained, idempotenti 2×, audit registrato in `sys.sys_schema_migrations`). Remediation full-chain = work item separato (verificare anche altri ALTER post-000033 che richiedono ownership/superuser).

## Top priorities (next session)

1. **Decisione carry-over #1**: localizzare source dati PerformanceReviews (o switch a un'altra macro-area con dati) per sbloccare Phase 3-6 → PROMPT 028.
2. **Decisione carry-over #2**: remediation idempotency full-chain (ownership 000033+) — sessione dedicata DB hygiene.
3. **TODO(CHECK)**: completare i value-CHECK whitelist in 000046 (`review_type`, `review_status`, `cycle_type`/`status`, `phase_status`, `template_type`, `potential_rating`, `*_rating_scale_type`, `ksaba_dimension`) quando si osservano valori reali.
4. (minori) Dependabot residui: #6 react-i18next 15→17, #16 gh-pages 3→4. zod4 (#3+#5) mini-milestone dedicato prima di SDBI Phase 3 API.

## Stack snapshot

- **HEAD**: 7 commit locali su `main` (ADR accept · fix 000007 · mig 000045 · 8 audit codes · RUNBOOK · mapping card · mig 000046). **Non pushati** (gate Enzo).
- **SDBI**: ADR-0014 ACCEPTED. temp_sdbi schema (000036). Lineage SDBI cols (000045). 8 target PerfReviews (000046, 0-row). 2 pilot dati shipped (Goals/OKRs 5939, Time/Leave).
- **Migration max**: 000046. Runner full-chain rotto a 000033 (ownership) — vedi carry-over #2.
- **SoT viva**: `docs/kb/` (CLI-owned). **KB**: wiki `heuresys-advanced-wiki` + graph hub in `wiki-space`.

## Verification (next session)

```bash
ssh -o BatchMode=yes oracle-vm-default 'echo OK'   # key in agent
nc -z localhost 5433 || ssh -fN -L 5433:localhost:5432 oracle-vm-default
git log origin/main..HEAD --oneline               # 7 commit (se non ancora pushati)
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "\dt sys.sys_performance_*"  # 8 target
cd apps/api && pnpm exec vitest run                # 345 pass / 5 skip
```
