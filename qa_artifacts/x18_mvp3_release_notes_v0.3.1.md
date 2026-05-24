# MVP-3 final — Release Notes v0.3.1-mvp3-final

**Tag**: `v0.3.1-mvp3-final`
**Commit**: `754fe35`
**Date**: 2026-05-24
**Predecessor**: `v0.2.1-mvp2a-final` (MVP-2a certification, X16-X17)

## Summary

MVP-3 complete: A/B/C/D/E backend+UI/F-pragmatic/G shipped. Tappa F (npm publish + apps/web versioned migration) landed con close pragmatic. `@heuresys/ui@0.1.1` pubblicato su npm registry pubblico sotto org `@heuresys`. apps/web admin core (40+ routes incluso `/system-health` con full observability widgets) builda clean con dependency versioned. **Known issue deferred**: `/showcase/*` routes hit un Next.js 15 RSC bundle-threshold defect — workaround applicato, proper fix in dedicated future session.

## Highlights MVP-3 Tappa F

- **npm package live**: `@heuresys/ui@0.1.1` su https://www.npmjs.com/package/@heuresys/ui (0.1.0 deprecated)
- **tsup dual build**: `dist/index.{mjs,cjs,d.ts,d.cts}` (ESM + CJS + types per entrambi format)
- **exports map**: full-preservation 3 subpath consumer (`./styles`, `./brand/candidates`, `./assets/brand/*`) + main `.` entry
- **Org @heuresys**: creata su npm Free Unlimited Public Packages tier, owner `spen-zosky`
- **GAT bypass-2fa**: configurato in `~/.npmrc` user-level per future publish (scoped al solo `@heuresys/ui`, revocabile)
- **Consumer migration**: apps/web + apps/showcase + root `package.json` migrati da `link:../ux-design-shared/ui` a `^0.1.1` versioned dep
- **apps/web admin routes**: build OK, 40+ routes incluso `/(authenticated)/*` core (/users, /positions, /processes, /me/*, /system-health con observability widgets full)

## Tappa F decisions (Enzo C18 session)

| # | Decisione | Effective state v0.3.1 |
|---|---|---|
| 1 | A — `@heuresys/ui` scoped | Mantieni nome, org @heuresys creata |
| 2 | Y — tsup dual ESM+CJS | `dist/index.{mjs,cjs}` + dts per entrambi |
| 3 | V1 — version 0.1.0 → escalated to 0.1.1 (CW-B58 fix) | Published 0.1.1 latest |
| 4 | M2 — versioned `^0.1.0` migration | Effective `^0.1.1` (semver covers) |

## Known issue (DEFER-F)

**Next.js 15 RSC bundle-threshold defect**: quando `@heuresys/ui` ha >50 components esportati, la page-data collection di `/showcase/*` routes tripa `d.createContext is not a function` / `TypeError: Class extends value undefined is not a constructor or null` al chunk evaluation server-side (RSC boundary issue).

- **Emergent behavior**: NON un singolo componente — 12 bisect iterations (HALT-022-06) hanno dimostrato che il problema appare al threshold "Mermaid + 7 of 7 obs widgets" ma sparisce a "Mermaid + 3 of 7 obs widgets". Pattern empirically reproducible, single culprit non isolabile.
- **Workaround applicato (Path B+C pragmatic)**: `/showcase/*` routes spostate da `apps/web/src/app/showcase/` a `apps/web/src/_disabled_showcase_X18/` (fuori dal Next.js App Router + escluse da tsconfig). Admin core ships unaffected.
- **apps/showcase static deploy**: anch'esso deferred (same defect).
- **Proper fix DEFERRED** a dedicated session "Next 15 RSC bundle threshold investigation":
  - Path A: `git bisect ux-design-shared` commits tra X16 baseline e HEAD per identificare commit/dep culprit
  - Path F: split `@heuresys/ui` in subpackages (`@heuresys/ui-core` + `@heuresys/ui-dashboard` + `@heuresys/ui-brand`) per ridurre bundle surface per chunk
  - Path E: upgrade Next.js 16 quando disponibile (potrebbe avere fix RSC bundle)
- **Restore procedure**: `mv apps/web/src/_disabled_showcase_X18 apps/web/src/app/showcase` + rm tsconfig exclude, dopo root-cause fix landed
- **Reference**: REPORT 022 §0bis + §10, halt notify cascade `2026-05-24T*__022__*.md`, qa_artifacts/x18_4_bisect_iter_*.txt (12 iter empirical evidence)

## X18 close metrics

- **5 amendment cascade**: PROMPT 022 → 022.1 (CW-B55 subpath) → 022.2 (CW-B57 redundant external, withdrawn) → 022.3 (CW-B58 outExtension) → 022.4 (Path β bisect) → 022.5 (Path B+C pragmatic close)
- **6 halt P0/P1**: npm-not-logged-in, exports-map-subpath-gap, publish-2fa-required, dual-package-hazard (misdiagnosis), cw-b57-misdiagnosis (self-correction), persistent-build-fail (4 hypothesis confutate empirically), bisect-inconclusive (12 iter)
- **4 narrative hypothesis confutate empirically by CLI**
- **12 bisect iterations Path β** (~75 min CLI) — inconclusive, evidence per architectural issue

## Bias mitigated this batch (final)

| # | Title | Status |
|---|---|---|
| CW-B55 | npm-publish-migration subpath exports gap | mitigated (C18.1) |
| CW-B56 | npm publish pre-flight (org existence + 2FA mode + GAT) | mitigated (C18.2) |
| CW-B57 | tsup external minimal default = dual-package hazard | **WITHDRAWN** (misdiagnosis, CLI counter-evidence) |
| CW-B58 | Misdiagnosis-via-assumption + outExtension config gap | mitigated (C18.3, reinforced cross-batch X18.4/X18.5) |
| CW-B59 | Bisect methodology contamination + Next 15 RSC bundle threshold | mitigated workaround (C18.5), proper fix DEFERRED architectural |

**Tally**: 58 actively catalogued (CW-B17 → CW-B59, B57 withdrawn) / 39 mitigated / 1 withdrawn / 1 deferred architectural / next CW-B60.

## Pattern memo C19 tasks accumulated

- Pre-prescription bundle inspection mandatory (`head -30 dist/<entry>.mjs | grep '^import'`)
- Meta-rule "CLI critical thinking overrides Cowork theoretical model when evidence concreta contraddice"
- npm-publish-migration end-to-end checklist (org existence + 2FA mode + GAT setup + consumer scan + bundle inspection + tsup outExtension + bump + deprecate)
- GAT lifecycle policy (rotate, scope per package vs per scope, expiration discipline)
- Bisect methodology canonical: source-file impl replacement (stub IMPL, keep export signature), NOT export-list manipulation
- Bisect time-box: max 8-10 iterations OR 60-90 min budget — beyond escalate scope reassessment
- Next 15 RSC bundle threshold workaround pattern (force-dynamic + scope reduction)

## Acceptance per `NEXT_SESSION_MVP_2A.md §5`

| Criterion | Status |
|---|---|
| MVP-3 6/6 Tappe shipped | ✅ (F pragmatic close, A/B/C/D/E backend+UI/G full) |
| @heuresys/ui published su npm pubblico | ✅ 0.1.1 latest |
| apps/web admin core builds + Playwright admin PASS | ✅ |
| Brownfield Wave 1 full-47k SQL upsert | residual (deferred dedicated session) |
| MFA login-gating | deferred (frontend enroll shipped X17, login compose pending) |
| `/showcase/*` routes static build | ❌ deferred (DEFER-F session) |

## Tag stamp

- **Tag**: `v0.3.1-mvp3-final` annotated
- **Target commit**: `754fe35`
- **Date**: 2026-05-24
- **Repos local state**: `D:/heuresys-advanced` HEAD `754fe35` + pending working tree (21 showcase files + tsconfig + apps/showcase/package.json), `D:/ux-design-shared` HEAD `dfa2e81` (0.1.1 publish-ready)
- **Push state**: NO push effettuato (R12 + project rule, esplicita autorizzazione Enzo richiesta)

## Post-tag work / next session candidates

- **DEFER-F session**: `/showcase/*` proper fix (Path A bisect / Path F split package / Path E Next 16) + restore `_disabled_showcase_X18` → `src/app/showcase`
- **Brownfield Wave 1 full-47k**: Tappa D residual SQL-side upsert (~2-3h dedicated)
- **MFA login-gating**: compose `mfaService.beginLoginChallenge` in `auth.service.login()` + UI `/login` 2-step (frontend enroll già shipped X17 Tappa E-UI a0d4545)
- **Pattern memo C19 consolidation**: tutti i tasks accumulated sopra
- **GitHub release page**: `gh release create v0.3.1-mvp3-final --notes-file qa_artifacts/x18_mvp3_release_notes_v0.3.1.md --title "MVP-3 final"` (analoga a v0.2.1)

---

*End release notes — MVP-3 6/6 shipped (Tappa F pragmatic close), 5 batch C18.x in 1 sessione, 4 bias mitigated, 1 withdrawn, 1 deferred architectural. Brownfield Wave 1 + MFA + DEFER-F session restano open candidates per future iterazioni.*
