# heuresys-advanced — STATE

**Updated**: 2026-05-31 (S951). **Branch**: `main` HEAD `95de8f5` (+ questo handoff) = synced with origin. **CI 5/5 GREEN** (i commit S951 sono docs-only → paths-ignored, nessun re-run). Working tree pulito.

## Last session brief

- **🟢 DOTTRINA DATI formalizzata + verificata.** Workflow read-only 7-agent ha CONFERMATO empiricamente la visione di Enzo (advanced `sys.*` = autorità strutturale; legacy Docker `heuresys_evo_platform_db` = sorgente dati canonica no-PII; 97/97 mapping→`sys`, 69.450 lineage, 1225/1225 `pii_disposition=NONE`). 12 commit pushati `23f9bbf..95de8f5`.
- **Nuovo [[ADR-0023]]** (data-source doctrine, ACCEPTED) + **ADR-0014 SDBI** promosso ACCEPTED. **I12** riformulato (enrichment-only → authoritative no-PII source); **I13/ADR-0004** nota source-vs-runtime (Docker legacy = sorgente, non runtime). **No-PII globale** (decisione Enzo) → blocco PII del doc SuccessFactors **RITIRATO**.
- **Doc-drift fix**: personas reali post-S950 (CLAUDE.md), What-NOT-to-touch (hygiene non privacy), provenance header, BOOTSTRAP I12+I14. Self-correzione numero ADR 0022→0023 (0022 stale-reserved da `wave_3_runner.md`). 3 memory CLI aggiornate.

## Top priorities (next session)

1. **Brand-fidelity F5 ESS / F6 admin / F7 showcase** (~6-8h) — sbloccato (ESS ha dati reali). Vedi `memory/project_brand_fidelity_migration.md`.
2. **B-50 full reconciliation legacy→advanced** (oltre ~49%) — item aperto in `SOT_BACKLOG.md`, **esecuzione gated** (sessione lunga dedicata): ~69/134 tab `sys` vuote, 4-5 Wave-1 target a zero, 2 import_run orfani, no delta/watermark. Lega B-10 SDBI Phase 2.
3. **(opz.) Refinement posizioni**: job_role/ESCO sulle 162 posizioni, cycle-detection `reports_to`, 2 posizioni OU NULL.

## Open questions

- **SuccessFactors connector**: doc committato (`c363ef1`), flag PII risolto (no-PII globale ADR-0023); resta da decidere (a) adozione design come item MVP-4 + (b) ⚠️ I3/I4 naming `staging.sf_*`.
- **`wave_3_runner.md` numerazione ADR stale** (0019-0023, già scavalcata da ADR reali) → marcare obsoleto in housekeeping (non urgente).

## Stack snapshot

- DB: 161 utenti / 2 tenant ACTIVE (RTL Bank + Heuresys System; Demo Bank Test ARCHIVED), org reale wired. origin/main `95de8f5`.
- ADR su disco: 0001-0018, 0020, 0021, **0023** (0019/0022 gap; 0022 stale-reserved da wave_3). Full local E2E: `AUTH_LOGIN_RATELIMIT_MAX=<alto>`. Tunnel :5433 hands-off (ADR-0021).

## Verification (next session)
```bash
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "select count(*) from sys.sys_users"  # 161
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
gh run list --limit 6                                         # CI verde
```
