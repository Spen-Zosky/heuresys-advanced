# heuresys-advanced — STATE

**Updated**: 2026-05-25 GMT+2 (X18 close + qs security fix)
**Branch**: `main` — synced `c304b02` (all pushed). ux-design-shared `dfa2e81` pushed.
**Last tag**: `v0.3.1-mvp3-final` (`754fe35`, pushed) + `v0.2.1-mvp2a-final` (X16)

## Last session brief

X18 MVP-3 Tappa F closed pragmatic (5 amendment + 6 halt + 12 bisect iter). `@heuresys/ui@0.1.1` published su npm (0.1.0 deprecated), apps/web admin core (40+ routes) migrato a versioned `^0.1.1`. /showcase routes deferred (Next 15 RSC bundle-threshold defect) → moved a `apps/web/src/_disabled_showcase_X18` + tsconfig exclude. Poi security fix: qs override `>=6.15.2` (Dependabot #76 CVE-2026-8723, test-only scope).

## Top priorities (next session)

1. **DEFER-F — fix /showcase RSC bundle-threshold** (~2-3h). Restore: `mv apps/web/src/_disabled_showcase_X18 apps/web/src/app/showcase` + rm tsconfig exclude. Root-cause via Path A (git bisect ux-design-shared X16-era→`dfa2e81`) / Path F (split @heuresys/ui) / Path E (Next 16). Vedi HALT-022-06 + `qa_artifacts/x18_4_bisect_iter_*.txt`.
2. **Brownfield Wave 1 full-47k SQL-side upsert** (~2-3h) — Tappa D residual.
3. **MFA login-gating** (~2-3h) — compose `mfaService.beginLoginChallenge` into `auth.service.login()` + `/login` UI 2-step.

## Open questions

- **uuid@8.3.2 vuln** (via @heuresys/ui→exceljs, GHSA-w5hq-g745-h8pq moderate): dismiss su GitHub / bump exceljs / override+test? Major 8→11 rischia exceljs breakage.
- **Dependabot #76**: verificare auto-close post re-scan (qs@6.15.2 su main).

## Stack snapshot (deltas vs X17 close)

- **Tag**: +`v0.3.1-mvp3-final` (`754fe35`) pushed, GitHub release LIVE
- **npm**: `@heuresys/ui@0.1.1` published (org @heuresys, GAT bypass-2fa in `~/.npmrc`); 0.1.0 deprecated
- **@heuresys/ui dep**: `link:` → versioned `^0.1.1` (root + apps/showcase). `readlink node_modules/@heuresys/ui` → `.pnpm/@heuresys+ui@0.1.1` (NON più symlink)
- **Bias**: 54 → **58** (CW-B55/56/58 mitigated, B57 withdrawn, B59 deferred-architectural)
- **MVP-3**: F ✅ pragmatic (era ⏳). 6/6 Tappe shipped, /showcase deferred DEFER-F
- **pnpm overrides**: +`qs >=6.15.2` (security)
- **Build**: apps/web admin typecheck+build PASS vs versioned 0.1.1 (X18 Path C); X18 Playwright env-blocked (API+tunnel down)

## Verification (next session pre-flight)

```bash
ssh -fN -L 5433:localhost:5432 oracle-vm-default
git log origin/main..HEAD --oneline                 # empty (synced c304b02)
readlink -f node_modules/@heuresys/ui               # .pnpm/@heuresys+ui@0.1.1 (versioned)
npm view @heuresys/ui dist-tags                      # latest 0.1.1
pnpm audit --audit-level=moderate                    # 1 moderate (uuid, deferred)
```

## Resume protocol

1. Read STATE + `cowork_reserved/HANDOFF_FRESH_SESSION.md` §2 (DEFER-F/C/D menu).
2. If DEFER-F: leggi `_01_PROMPT_022.4_batch_x18_amendment.md` + bisect logs prima di tentare root-cause.
3. SSH tunnel + apps/api `:3001` per Playwright/test live (X18 li ha trovati down).
