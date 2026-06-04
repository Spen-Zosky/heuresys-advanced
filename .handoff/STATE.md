# heuresys-advanced — STATE

**Updated**: 2026-06-05 (S964). Baseline **v1.0.0 GA**. main synced (`d074be7`), migration `000069`. **PROD live su `https://www.heuresys.com` (TLS) — NON toccata da questa sessione** (il deploy è un'azione separata; next 16 NON è in prod).

## Last session brief (S964 — i18n Fase 0b + Fase 1 pilota + dependabot sweep)

- **i18n Fase 0b ✅** (`92b7773`, CI verde): `locale` in `sys_user_preferences` (mig **`000069`**, CHECK it|en default it) + `PATCH /v1/me/preferences` esteso + `PreferencesApplier` applica il locale ogni sessione (cross-device) + `LanguageSwitcher` persiste server-side (best-effort). Integration **11/11**, E2E me-preferences (locale server-SoT cross cookie+cache) verde.
- **ESLint guardrail** (decisione Enzo): `i18next/no-literal-string` = **`warn` su TUTTO `apps/web/src/app/**`** (scope globale, non per-area). **876 warning = contatore debito**; → **flip a `error` a fine milestone quando scende a 0** (commento già in `eslint.config.mjs`).
- **i18n Fase 1 ✅** (`1950817`, CI verde): 5 pagine analytics (workforce/kpi/attendance/compensation/skills) → namespace `analytics` (it **byte-identico** + en). i18n-parity **131×2×7**, analytics lint **28→0**, E2E **5/5** (behavior-preserving). ECharts builder ricevono stringhe già risolte (type-safe, niente threading di `TFunction`).
- **Dependabot sweep**: **pino 9.14→10.3.1** (`0184da3`, suite API **653/6**) + **upload-artifact v4→v7** (`f2b76fc`, runner self-hosted **2.334.0** ≥ 2.327.1) applicati su main, PR #23/#18 chiuse. **#26 minor-and-patch group (11 update: react 19.2.7, react-query 5.101, i18next 26.3.1, vitest 4.1.8, …)** MERGED (`d074be7`), typecheck post-merge verde. **3 major DEFERITI** (label `defer-major`) → vedi sotto.

## ⚠ PARZIALI / DA NON DIMENTICARE DI ULTIMARE

1. **next 16 (PR #21) — PRE-VALIDATO VERDE, adozione deferita**: ho provato l'upgrade → build ✓ + typecheck ✓ + lint ✓ + **E2E dev 8/8 ✓** (login 5 personas/auth-cookie + analytics + me-preferences). NON adottato perché è una **micro-migrazione**, non un bump: (a) rimuovere la chiave `eslint` deprecata da `next.config.js`; (b) bump coordinato `eslint-config-next`→16; (c) **decisione `middleware`→`proxy`** (next 16 deprecata il file `middleware`, funziona ancora ma sparirà in next 17); (d) smoke **prod-mode** (`next start`) prima del deploy. ~1 commit dedicato. PR #21 in `defer-major`.
2. **typescript 6 (PR #22) — DEFER**: `TS5101` (deprecation `baseUrl`→errore) su più tsconfig + `typescript-eslint` 8.60 supporta TS ≤5.9. Richiede `ignoreDeprecations`/refactor baseUrl + typescript-eslint TS6-ready. PR in `defer-major`.
3. **vite 8 (PR #20) — DEFER**: peer `@vitest/mocker` richiede vite ^6 (vitest 4.1.x). Upgrade accoppiato vite+vitest. PR in `defer-major`.
4. **i18n guardrail flip**: `no-literal-string` è `warn` → a fine milestone (debito 0) portare a `error` in `eslint.config.mjs`.
5. **i18n number-format locale-aware**: `compensation/page.tsx` usa `Intl.NumberFormat("it-IT")` per il € anche in EN (scelta behavior-preserving). Enhancement: legarlo al locale attivo.
6. **i18n Fasi 2–5 RIMANENTI** (il grosso della milestone): admin-org (13 pag), blueprints-data (8), hr-talent (8), ess-me (17) + **Final EN gate**. Namespace già scaffoldati (vuoti). Il pilota analytics è la blueprint. Design: `docs/superpowers/specs/2026-06-04-i18n-milestone-design.md`.

## Top priorities (next session)

**▶ NEXT SESSION = MONOBLOCK (apri con `ultracode`)**: esegui il piano pronto **`docs/superpowers/plans/2026-06-05-i18n-monoblock-execution-plan.md`** (preparato S964). Chiude **i18n Fasi 2–5 + EN gate** (~45 pagine, fan-out 4 namespace admin/blueprints/hr/ess) → **milestone i18n CLOSED** + guardrail flip `warn`→`error`, poi bundle **next 16** (pre-validato verde) + **① BI P3** org-network + **F7** (6 proposte). Leggi il piano in full + il design spec, esegui §0→§7.
- **🔒 NON in questa sessione (gated su esterni)**: **② AI P1** (`VOYAGE_API_KEY` nel `.env` VM — azione Enzo) · **typescript 6 / vite 8** (attendono upstream typescript-eslint/vitest). Si chiudono quando arriva la condizione, non per effort.

## Open questions (ereditate)

- **`VOYAGE_API_KEY`** nel `.env` VM → sblocca ② P1 (unico gate).
- ~~Versionare la config nginx nel repo?~~ ✅ **FATTO S964** → `deploy/nginx/www.heuresys.com.conf` (mirror documentale).

## Stack snapshot

- **PROD = `https://www.heuresys.com`** → nginx TLS Let's Encrypt → web `:3013` (proxa `/api`→`:8013`). `COOKIE_SECURE=true`, `ADMIN_ORIGIN=https://www.heuresys.com`. nginx conf **versionata** in `deploy/nginx/www.heuresys.com.conf` (mirror documentale S964, non auto-deployata; live su VM). evo legacy = `evo.heuresys.com` (:3200). **Deploy = `scripts/vm-deploy.sh`** (non tocca nginx/.env; next 16 NON deployato).
- migration **`000069`** (locale), ~284 endpoint, API suite **653/6**. i18n **3 namespace popolati** (common/shell/analytics); admin/blueprints/hr/ess scaffoldati vuoti. Reconciliation 112/147 POPULATED.
- Dipendenze post-sweep: pino **10.3.1**, upload-artifact **v7**, react **19.2.7**, react-query **5.101**, i18next **26.3.1**, vitest **4.1.8**. DEFER: next **15.5.18**, typescript **5.7.2**, vite **6.4.2**.

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline                 # vuoto = synced
cd apps/web && pnpm i18n:check                                              # parity 131 x2 x7
pnpm exec eslint "src/app/(authenticated)/analytics/**/*.tsx"               # 0 no-literal-string
```
