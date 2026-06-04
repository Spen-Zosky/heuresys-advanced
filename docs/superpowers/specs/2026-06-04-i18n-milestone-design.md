# i18n Milestone — Design Spec (IT default + EN)

> **Status**: DESIGN (S962, 2026-06-04). Milestone to make the web app genuinely bilingual (Italian default + English), replacing the pervasive hardcoded-Italian pattern. **No code until reviewed + approved.**
> **Core principle**: behavior-preserving extraction — the Italian default text stays byte-identical, so the existing E2E suite stays green. i18n *enables*, l10n *fills*; this spec does both for IT (already de-facto) + EN.

## 1. Problem statement

The app has react-i18next wired (`src/lib/i18n.ts`, `src/locales/{it,en}/common.json`, ~23 keys) but **only `login/page.tsx` uses it**. The other **70 pages render hardcoded Italian** in JSX. `en` is nearly empty. The platform is de-facto Italian-only except the login. The fix is an **i18n extraction** (engineering) + **EN localization** (translation).

## 2. Measured scope (fan-out over all of apps/web, S962)

| Area | Pages | RSC w/ text | Raw strings |
|---|---|---|---|
| analytics + system | 10 | 0 | 142 |
| admin-org | 13 | 0 | 180 |
| blueprints-data | 8 | 0 | 122 |
| hr-talent | 8 | 0 | 110 |
| ess-me (`/me/*`) | 17 | 0 | 250 |
| shell (layout + data-table-panel) | — | 0 | ~25 |
| *showcase (18 pages)* | *18* | *19* | *19 — EXCLUDED* |

`(authenticated)/layout.tsx` is counted once per area (it is shared — done once). **Net: ~750 raw strings → ~600 distinct keys** after deduping repo-wide repeats (`Caricamento…`, `Errore`, table headers, `sì/no`, back-links), across **~50 app pages**.

### 2.1 The two feared blockers — measured away

- **RSC / server-side i18n — eliminated.** All **19 RSC are in the showcase** (design-system docs, mostly English, dev-only, `noindex`, gated behind `NEXT_PUBLIC_ENABLE_SHOWCASE`). The **50 real app pages are all client components**; the only app RSC (`system-health/layout.tsx`) has **0 strings**. → **No server-side i18next instance is needed.** `useTranslation` (client) suffices everywhere once the showcase is out of scope.
- **E2E coupling — low and mapped.** All coupling is ~20 regexes matching a **single word** inside count-badges (`/\d+\s+ruoli/`, `/\d+\s+totali/`, …). Keep those ~20 IT words byte-identical → **zero spec edits**. Everything else asserts on `data-testid` / live API data.

## 3. Architecture decisions (locked)

1. **Client-only i18n** — `react-i18next` + `useTranslation` in every page (all client). **No server-side i18next instance** (the only RSC with text is the excluded showcase). Removes the #1 architectural risk entirely.
2. **Namespaces per area** — split the single `common.json` into: `common` (loading/error/actions/table-headers/yes-no/pagination), `shell` (nav groups, perspective chips, logout), `analytics`, `admin`, `blueprints`, `hr`, `ess`. Files: `src/locales/{it,en}/<ns>.json`. **Separate files per area → extraction fans out without merge conflicts.**
3. **Default locale = IT**, fallback IT. EN is the second locale.
4. **Locale persistence** — a `NEXT_LOCALE` cookie drives rendering; the user choice is also stored in `sys_user_preferences` (alongside theme/palette, mig 000053) for cross-device persistence, via the existing `PATCH /v1/me/preferences` (extended with a `locale` field).
5. **Language switcher** — a small client control in the authenticated shell (and login), composing `@heuresys/ui` primitives; flips locale + persists.
6. **Lint guardrail** — an ESLint rule (eslint-plugin-i18next `no-literal-string` or a scoped custom rule) on `apps/web/src/app/**` to block *new* hardcoded user-facing strings → the debt cannot re-form. Introduced in Fase 0, tuned to ignore non-UI literals (testids, classNames, units).
7. **i18n-parity gate** — already repointed to `src/locales/**` (S962 fix `6573a17`); extended to cover every namespace.

## 4. Refactor patterns (the real work)

The cost is structural, not architectural — three repeated patterns:

- **Module-scope string arrays** (`COLUMNS`/`GROUP_LABELS`/`FILTERS`/`TABS`/`THEME_OPTIONS`…) live outside the component, so `t()` (a hook) is out of scope. → Convert to a **factory inside the component** (`const COLUMNS = useMemo(() => buildColumns(t), [t])`) or store i18n **keys** in the array and resolve with `t()` in the render/map. Dominant pattern (~6 files per area).
- **Interpolated count-badges** (`${total} varianti`, `${total} KPI definiti`…) → `t('ns.count', { count })` with **ICU plural** (`_one`/`_other`) for correct EN ("1 module" vs "N modules"). ~20 keys.
- **ECharts option builders** (`monthlyLineOption`, `bandingBoxplotOption`…) hold series/axis/`ariaLabel` text at module scope → pass `t` as a parameter, or inline into the component. ~10 `ariaLabel` a11y strings across analytics.

Number/currency: `compensation/page.tsx` hardcodes `Intl.NumberFormat("it-IT")` → follow the active locale. Dates are mostly raw API slices (out of string-extraction scope; locale-aware dates are a later enhancement).

## 5. Behavior-preserving E2E strategy

The IT locale value = today's literal, byte-identical. **Words that MUST be preserved** (count-badge regex coupling), keep identical in `it/*.json` → zero spec edits:

`ruoli · totali · unità · grafici · varianti · processi · run · skill · KPI · moduli · pianificate · gap · reward gate · assegnazioni · evidenze · percorsi · aperti · obiettivi · certificazioni · documenti · notifiche` + page titles `Sicurezza account` (mfa-enroll) and link `Il mio team` (me-team).

Everything else (titles, headings, empty-states, descriptions, table headers, tab/nav/perspective labels) is asserted by `data-testid`/API data → **freely translatable**. Cleaner long-term option (optional, per area): decouple the ~20 count regexes to `data-testid` + numeric match, removing even this constraint.

## 6. Localization (EN)

EN values generated as **AI-assisted technical translation** (HR/BPM/HRMS terminology), one pass per namespace, reviewed against the IT source for parity (the i18n-parity gate enforces key parity, not quality). Marked reviewable if human QA is wanted. ICU plurals authored for the count keys.

## 7. Phased plan

| Fase | Scope | Exit criteria |
|---|---|---|
| **0 — Infra** | namespaces, client i18n config, language switcher, `locale` in `sys_user_preferences` (migration + `/v1/me/preferences`), ESLint guardrail, shared `common`+`shell` namespaces extracted | typecheck/lint/i18n-parity green; switcher flips a sample; E2E green |
| **1 — Pilot: analytics** | 5 analytics pages (incl. ECharts-option `t` refactor) → `analytics` ns + EN | analytics E2E green (IT identical); EN keys present; CI green |
| **2 — admin-org** | 13 pages → `admin` ns + EN | area E2E green; CI green |
| **3 — blueprints-data** | 8 pages → `blueprints` ns + EN | area E2E green; CI green |
| **4 — hr-talent** | 8 pages → `hr` ns + EN | area E2E green; CI green |
| **5 — ess-me** | 17 pages → `ess` ns + EN | area E2E green; CI green |
| **Final — EN gate** | one Playwright spec navigating with `?lng=en`, asserting the locale actually flips; i18n-parity over all namespaces | EN E2E green; full parity |

Fasi 2–5 are **parallelizable** (separate namespace files → fan-out with worktree isolation, no conflicts). Shell strings (`layout.tsx`, `data-table-panel.tsx`) are done in Fase 0 (cross-cutting).

**Showcase: out of scope** (18 RSC dev-doc pages, mostly English; migrating = inventing translations of English docs). Optional separate sub-phase if ever wanted.

## 8. Risk register

| Risk | P | I | Mitigation |
|---|---|---|---|
| RSC server-side i18n | — | — | **eliminated** (all RSC in excluded showcase; app 100% client) |
| E2E text coupling | low | med | preserve ~20 IT count-words (mapped file:line); or decouple regex→testid |
| Module-const refactor breaks render | med | med | `buildColumns(t)` factory pattern, per-area E2E catches regressions |
| EN translation quality | med | low | AI-assisted technical pass + parity gate; human review optional |
| Plurals IT/EN | low | low | i18next ICU plural on count keys (~20); rest are flat |
| Number/currency format | low | low | locale-aware `Intl` (single point: compensation) |
| Scope creep mid-area | med | low | one namespace per fase, E2E + CI green before next |

## 9. Testing

- Per fase: the area's existing Playwright specs stay **green with IT identical** (behavior-preserving); integration/typecheck/lint/i18n-parity green.
- Final: a new EN E2E (`?lng=en` or switcher) asserting representative chrome flips to English; i18n-parity over all 7 namespaces.

## 10. Out of scope

Showcase pages (English dev docs); locale-aware date formatting (later enhancement); RTL languages; translating live API data (tenant/user/skill names are data, not chrome); the `SystemHealthDashboard.tsx` English demo fixtures.
