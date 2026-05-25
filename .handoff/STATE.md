# heuresys-advanced — STATE

**Updated**: 2026-05-25 GMT+2 (C19 sequence close — X19.A/X19/X20)
**Branch**: `main` — synced `d17ee0a` (all pushed). ux-design-shared `dfa2e81`.
**Last tag**: `v0.3.2-mvp3-full` (`d17ee0a`) — Tappa E MFA full + Tappa D pragmatic + 2 CVE

## Last session brief

Sequenza autonoma C19 (3 batch). **X19.A**: uuid CVE-2026-41907 fixed via scoped override `exceljs>uuid >=11.1.1` → uuid@14.0.0 single (qs già done c304b02). **X19**: Brownfield Wave 1 full re-run post-CW-B49 COMPLETED (47min, 34509 upserted, R-A2 433 ✅) ma **0 nuove tabelle** → Tappa D pragmatic 13/19 IMPORT, 6 residual strutturali (CW-B60) accept-as-residual. **X20**: MFA login-gating composto in `auth.service.login()` + `/login` 2-step TOTP → Tappa E full closed (5 vitest real-TOTP + Playwright 2/2 + build PASS, vitest API 341, 0 regression).

## Top priorities (next session)

1. **DEFER-F — fix /showcase RSC bundle-threshold** (~2-3h, HIGH-RISK). PROMPT 025 pronto. Restore `apps/web/src/_disabled_showcase_X18` + Path A bisect / Path F split @heuresys/ui / Path E Next 16. Vedi `_01_PROMPT_022.4` + `qa_artifacts/x18_4_bisect_iter_*.txt`.
2. **CW-B60-A — forensic engine silent-filter** (~2-3h). 3 target AUTO_APPROVED ma 0 upserted senza log (skill_categories / activity_classification_mappings / process_kpi_templates). Deep-dive `executeUpsert` filter + add observability + unit tests.
3. **CW-B60-B — Wave 2 / computed views ADR** (~2-3h). 3 target IMPORT senza staging source (blueprint_overrides / position_learning_requirements / position_skill_requirements).

## Open questions

- **skills.integration.test:131** fallisce (createdSkillIds non in list response) — pre-esistente, NON correlato uuid/MFA, deterministico. Mini-batch ~30-60min.
- **Dependabot**: verificare auto-close CVE-2026-41907 (uuid) + #76 (qs) post-scan d17ee0a.
- DEFER-F: quale Path (A bisect / F split / E Next 16)?

## Stack snapshot (deltas vs X18 close)

- **Tag**: +`v0.3.2-mvp3-full` (`d17ee0a`) pushed
- **MVP-3**: Tappa E **full** MFA login-gating (era ⏳). Tappa D pragmatic 13/19 IMPORT. F/showcase ancora deferred.
- **Auth**: login → discriminated union `status: success|mfa_required`; codici MFA_CODE_REQUIRED/MFA_INVALID/MFA_TOTP_INVALID; challenge store in-memory
- **Bias**: 58 → **59 effettivi** (+CW-B60 brownfield residual: engine silent-filter + scope gap)
- **pnpm overrides**: +`exceljs>uuid >=11.1.1` (uuid@14.0.0 single, 8.3.2 eliminato)
- **DB**: sys.* TRUE populated 59/134, Wave1 IMPORT 13/19 targets. `sys_auth_mfa_factors` schema live (challenge transient in-mem)

## Verification (next session pre-flight)

```bash
ssh -fN -L 5433:localhost:5432 oracle-vm-default
git log origin/main..HEAD --oneline                 # empty (synced d17ee0a)
cd apps/api && pnpm exec vitest run                  # 341 pass / 1 fail (skills:131 pre-esistente) / 5 skip
pnpm audit --audit-level=moderate                    # verifica residui post-uuid/qs fix
```

## Resume protocol

1. Read STATE + `cowork_reserved/HANDOFF_FRESH_SESSION.md` §2 (next-session candidates: DEFER-F / CW-B60-A / CW-B60-B).
2. SSH tunnel + apps/api `:3001` per test/Playwright live.
3. Se DEFER-F: leggi PROMPT 025 + bisect logs prima del root-cause.
