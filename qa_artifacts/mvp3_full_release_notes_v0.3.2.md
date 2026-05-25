# MVP-3 full — Release Notes v0.3.2-mvp3-full

**Tag**: `v0.3.2-mvp3-full`
**Commit**: `3fc9443`
**Date**: 2026-05-25
**Predecessor**: `v0.3.1-mvp3-final` (X18 Tappa F pragmatic close)

## Summary

MVP-3 complete end-to-end. Tutte le 7 Tappe shipped: A · B · C · D-pragmatic (13/19 IMPORT, 6 residual CW-B60 deferred) · E-full (MFA login-gating) · F-pragmatic (/showcase DEFER-F) · G. Sequenza C19 chiude tre batch addizionali post-X18: X19.A security (uuid CVE), X19 Brownfield Wave 1 re-run (Tappa D), X20 MFA full scope (Tappa E).

## Highlights C19 sequenza (delta vs v0.3.1)

### X19.A — Dependabot CVE quick win (`b01c331`)

- `uuid` bump via scoped pnpm override `exceljs>uuid >=11.1.1` → uuid@14.0.0 single version (8.3.2 eliminato dal lockfile, deduplicato con mermaid)
- `qs` già fixato da commit `c304b02` (CVE-2026-8723 pre-X19.A)
- Critical thinking CW-B58 aware: scoped vs global override = blast radius minimo, zero regression risk inutile su mermaid charting
- vitest API 336/342 baseline (0 regression), typecheck API+web PASS, web build PASS
- CVE-2026-41907 (uuid <11.1.1) → RESOLVED

### X19 — Brownfield Wave 1 re-run post CW-B49 (`e13eb73`)

- Full Wave-1 re-run dopo CW-B49 patch (X10 `upsert-sql.ts split-on-COALESCE`): primo end-to-end con engine patchato
- Run `6f531559`: COMPLETED clean (47min, 34509 upserted, 0 failed, R-A2 sys_users=433 intatto)
- **MVP-3 Tappa D FINAL status: 13/19 IMPORT targets populated (68%)**, 6 residual classified per **CW-B60** in 2 categorie deferred:
  - **(A) Engine silent-filter** (3 target: `sys_skill_categories` + `sys_activity_classification_mappings` + `sys_process_kpi_templates`) → 0 upserted silenzioso + 0 log WARNING/ERROR, oltre CW-B49 patch. Deferred a forensic session dedicata "CW-B60-A"
  - **(B) Scope gap** (3 target: `sys_blueprint_overrides` + `sys_position_learning_requirements` + `sys_position_skill_requirements`) → nessuna `staging.wave1_*` source, probabilmente derived/computed o Wave 2. Deferred a "CW-B60-B Wave 2 / computed views ADR"
- Acceptance `≥75/134 sys.*` originale del PROMPT 023 era **IRRAGGIUNGIBILE** (CW-B52 staleness Cowork acknowledged): solo 19 distinct IMPORT target esistono in Wave 1, max teorico 62/134. Cowork C19.1 decision: accept-as-residual + procedi a X20

### X20 — MFA login-gating Tappa E full (`3fc9443`)

- `mfaService.beginLoginChallenge` composto in `auth.service.login()`: gate dopo verifica password, return `{status:'mfa_required', challengeToken, availableKinds}` step-1 / verify + bundle issue step-2
- Schema Zod `LoginResultResponseSchema = discriminatedUnion("status", [success, mfa_required])`
- Codici errore typed: `MFA_CODE_REQUIRED`, `MFA_INVALID`, `MFA_TOTP_INVALID`
- Frontend `/login` UI 2-step (password → MFA code), primitive `@heuresys/ui` (no duplicazione), testid stabili (`login-mfa-form/code/submit`)
- i18n `auth.login.mfa.*` (title/prompt/codeLabel/submit/invalid/expired) it+en, parity 23 keys × 2 locale
- 5 nuovi integration test MFA: no-MFA→success+3 cookie / step1→mfa_required (no cookie) / step2 TOTP valid→success / step2 TOTP errato→401 MFA_TOTP_INVALID / step2 no code→401 MFA_CODE_REQUIRED
- Playwright `login-mfa.spec.ts` **2/2 PASS** (regression no-MFA + full real-TOTP 2-step end-to-end con TOTP reale via OTPAuth)
- vitest API: **341 passed / 1 failed (skills:131 pre-existing non-uuid, non-MFA) / 5 skipped** = 336 baseline + 5 new MFA, **0 regression**
- Critical thinking applied: login-events MFA omessi (evitato CHECK-constraint risk su `login_events.type`); cleanup MFA factor verificato post-run (`sys_auth_mfa_factors=0`); Playwright env workaround `--no-deps` + `expect(page).toHaveURL` polling per CW-B54 flaky auth.setup

## MVP-3 final scorecard (all 7 Tappe)

| Tappa | Status | Notes |
|---|---|---|
| **A** | ✅ shipped | (pre-X18) |
| **B** | ✅ shipped | Mermaid renderer in /visualizations/[graphId] via @heuresys/ui (X16 era) |
| **C** | ✅ shipped | (pre-X18) |
| **D** | ✅ pragmatic | 13/19 IMPORT populated (68%), 6 residual CW-B60 deferred (A engine forensic / B Wave 2 ADR) — X19 |
| **E backend** | ✅ shipped | mfaService + TOTP + recovery codes (X17 era) |
| **E-UI** | ✅ shipped | TOTP enrollment page /me/security (X17 Tappa E-UI commit `a0d4545`) |
| **E full** | ✅ shipped | MFA login-gating composed + /login UI 2-step (X20 questo tag) |
| **F-pragmatic** | ✅ shipped | @heuresys/ui@0.1.1 published + admin core versioned migration. /showcase routes DEFER-F (Next 15 RSC bundle threshold workaround `_disabled_showcase_X18`) — X18 |
| **G** | ✅ shipped | (pre-X18) |

## State residual / deferred (next session candidates)

| ID | Scope | Estimated effort |
|---|---|---|
| **CW-B60-A** | Forensic engine silent-filter: 3 target AUTO_APPROVED + 0 upserted silenzioso + 0 log. Deep-dive `executeUpsert` filter logic oltre CW-B49 + add observability (log WARNING per silent-skip) + unit tests | ~2-3h dedicated |
| **CW-B60-B** | Wave 2 / computed views scope ADR: 3 target senza staging.wave1_* source. Definire derivazione (computed views) OR Wave 2 import scope | ~2-3h ADR + impl |
| **DEFER-F** | `/showcase` Next 15 RSC bundle threshold proper fix: Path A git bisect ux-design-shared commits OR Path F split `@heuresys/ui` in subpackages (core/dashboard/brand) OR Path E Next 16 upgrade. Restore `apps/web/src/_disabled_showcase_X18` → `src/app/showcase` + rm tsconfig exclude. PROMPT 025 ready. HIGH-RISK (X18 ha consumato 5 amendment cascade + 12 bisect iter inconclusive) | ~3-4h CLI con Cowork attiva |
| **PRE-EXIST skills test** | `skills.integration.test.ts:131` createdSkillIds list visibility/pagination bug — NON correlato uuid (verified X19.A), pre-esistente nel baseline 336/342 | ~30-60 min |
| **DEPENDABOT-77** | Eventuali ulteriori vuln moderate post-X19.A (cache propagation GitHub ongoing) | ~30 min monitoring |

## Bias catalog state (final v0.3.2)

| # | Title | Status |
|---|---|---|
| CW-B55 | npm-publish-migration subpath exports gap | mitigated (C18.1) |
| CW-B56 | npm publish pre-flight (org existence + 2FA mode + GAT) | mitigated (C18.2) |
| CW-B57 | tsup external minimal default = dual-package hazard | **WITHDRAWN** (misdiagnosis, CLI counter-evidence X18.4) |
| CW-B58 | Misdiagnosis-via-assumption + outExtension config gap (meta+concrete) | mitigated (C18.3, reinforced cross-batch X18.4/X18.5/X19/X20) |
| CW-B59 | Bisect methodology contamination + Next 15 RSC bundle threshold | mitigated workaround (C18.5), proper fix DEFER-F |
| CW-B60 | Engine silent-filter Wave 1 (3 target) + scope gap (3 target) — Brownfield Tappa D residual | claimed (X19), deferred A/B forensic+scope |

**Tally**: 59 actively catalogued (CW-B17 → CW-B60, B57 withdrawn) / 40 mitigated / 1 withdrawn / 2 deferred architectural (B59 + B60) / next CW-B61.

## Pattern memo C19 updates (`COWORK_CLI_PROMPT_PATTERN.md §20`)

5 lessons cross-batch X18 + cross-batch C19 reinforced:
1. CW-B58 meta-rule: "empirical test matrix > narrative diagnosis"
2. CW-B59 bisect time-box (max 8-10 iter OR 60-90 min) + source-impl-replacement canonical (NOT export-list manipulation)
3. npm-publish-migration end-to-end checklist (10-step: whoami / 2FA mode / GAT / view registry / org ls / consumer scan / bundle inspection / outExtension / bump / deprecate)
4. GAT lifecycle policy (rotate / scope per-package / expiration)
5. Next 15 RSC bundle threshold workaround pattern (Path B force-dynamic + Path C scope reduction tier-list)

## X19+X20 close metrics

- **3 batch sequenza autonoma C19**: X19.A (~25min) + X19 (~50min) + X20 (~50min) = ~2h CLI cumulativo
- **1 halt P1 caught e gestito** (X19 6-target residual → Cowork C19.1 accept-residual decision)
- **6 spec drift Cowork-side adapted inline da CLI** (4 in X19 + 2 in X20: schema column names, paths, locale files, signatures) — CW-B40/B52 pattern recurring, Cowork to absorb in future PROMPT authoring
- **0 push autonomi** (R12 rispettato cross-batch)
- **0 new bias atomici claimed da X20** (CW-B61 NOT used)

## Acceptance per `NEXT_SESSION_MVP_2A.md §5`

| Criterion | Status |
|---|---|
| MVP-3 7/7 Tappe shipped (incl. Tappa E full) | ✅ |
| @heuresys/ui published su npm pubblico | ✅ 0.1.1 latest, 0.1.0 deprecated |
| apps/web admin core builds + Playwright admin PASS | ✅ |
| MFA login-gating shipped (compose + UI 2-step) | ✅ |
| Brownfield Wave 1 SQL upsert | ✅ pragmatic 13/19 (6 residual CW-B60 deferred) |
| `/showcase/*` routes static build | ❌ DEFER-F session |
| 2 Dependabot CVE moderate | ✅ both fixed (uuid X19.A + qs c304b02) |

## Tag stamp

- **Tag**: `v0.3.2-mvp3-full` annotated
- **Target commit**: `3fc9443`
- **Date**: 2026-05-25
- **Repos state**: heuresys-advanced HEAD `3fc9443` su origin/main, ux-design-shared HEAD `dfa2e81` su origin/main

## Post-tag work / next session candidates

- **CW-B60-A session** (forensic engine silent-filter) — priority a discrezione
- **CW-B60-B session** (Wave 2 / computed views ADR) — priority a discrezione
- **DEFER-F session** (HIGH-RISK, PROMPT 025 ready) — Cowork attiva
- **PRE-EXIST skills test fix** (mini-batch)
- **PM-C19 pattern memo full consolidation** (parzialmente fatto in §20 update)

---

*End release notes — MVP-3 full shipped, 7/7 Tappe, sequenza C19 chiusa (X19.A + X19 + X20). Restano open: CW-B60 A+B residual, DEFER-F /showcase architectural, skills pre-existing bug, Dependabot ongoing monitoring.*
