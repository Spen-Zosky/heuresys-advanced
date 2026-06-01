# SOT_STATE — Stato reale heuresys-advanced (CLI-owned Source of Truth)

> **Autorità**: questo è il documento di stato **CLI-owned** che il Claude Code CLI mantiene per operare in autonomia, senza dipendere dal protocollo Cowork. Consolida e riconcilia: ricognizione forense 4-root + handover Cowork S937 + `cowork_reserved/bias_registry.md` + segnali live (git/CI/DB).
> **Generato/aggiornato**: 2026-05-27 (S939 CLI — ripresa controllo diretto).
> **Indice file dominio**: `docs/kb/INDEX_PATHS.md` (+ `index_paths.yaml`). **Backlog**: `SOT_BACKLOG.md`. **Debiti**: `DEBT_REGISTER.md`. **Archivio Cowork**: `COWORK_ARCHIVE_NOTE.md`.

## 0. Snapshot in una riga

Monorepo pnpm HRMS/BPM **maturo e oltre MVP-3**: API Fastify 5 con **~58 moduli business + auth (~272 endpoint live)**, web Next.js 15 con **MVP-2a (admin) + MVP-2b (ESS) shipped**, showcase brand v1 deployato, DB PostgreSQL 16 nativo su OCI VM (**161 utenti, 162 posizioni; 3 tenant ACTIVE — RTL_BANK 158 operativo + HEURESYS 3 + RTL_BANK_REFERENCE 0 template-fondazionale by-design; sanificato S954**, vedi §4), **6 workflow CI self-hosted + showcase deploy tutti verdi (5/5)**. HEAD `c363ef1`, working tree pulito, tag `v0.4.1-housekeeping-closed`. **Prossimo**: brand-fidelity F5 ESS / F6 admin / F7 showcase (NEXT #1); decisione connettore SuccessFactors (proposta pending in `docs/integrations/`); position refinement opzionale (job_role/ESCO, cycle-detection OU).

> ⚠️ **Doc drift critico**: il `CLAUDE.md` del repo (sezione "What this is") e il `README.md` descrivono ancora lo stato **MVP-1** ("11/22 moduli, web vuoto"). È **gravemente obsoleto**. Questo SOT_STATE è la verità; vedi `DEBT_REGISTER.md` D-01.

## 1. Git / release

| Item | Valore |
|---|---|
| Repo Windows | `D:\heuresys-advanced` |
| Repo OCI VM | `/home/ubuntu/heuresys-advanced` |
| Remote | `https://github.com/Spen-Zosky/heuresys-advanced` (public) |
| Branch / HEAD | `main` / `c363ef1` (ahead di origin `23f9bbf` di 2 commit docs-only S951, non pushati) |
| Working tree | pulito (verificato S951) |
| Tag corrente | `v0.4.1-housekeeping-closed` (@ `01340ae`) |
| Tag (11 totali) | v0.2.0-mvp2 · v0.2.1-mvp2a-final · v0.3.0-mvp3 · v0.3.1-mvp3-final · v0.3.2-mvp3-full · v0.3.3-preflight-partial · v0.3.4-p0-closed · v0.4.0-brand-v1 · v0.4.0-mvp4-ready · v0.4.0a-s937-partial-checkpoint · v0.4.1-housekeeping-closed |
| Pre-commit hook | `.git/hooks/pre-commit` warn-only → `scripts/cowork-exchange/validate-naming.mjs` su cowork_code_exchange |
| Sibling repo | `D:\ux-design-shared` (HEAD `dfa2e81`) = sorgente di `@heuresys/ui` (npm `^0.1.1`) |
| Legacy read-only | `D:\evo.heuresys.com` (Win) + `/home/ubuntu/heuresys-evo` (VM) — enrichment source, mai committare path assoluti |

## 2. Stack (versioni verified)

- **Root**: pnpm 9.15.0 (pinato), Node ≥20.11, ESLint 9.39.4 flat, typescript-eslint 8.59.4, eslint-config-next 15.5.18. `pnpm.overrides`: react/react-dom **19.2.5** (Path G pinning), @types/react 19.2.14, vite ^6.4.2, postcss ^8.5.10, esbuild ^0.25.0, qs ≥6.15.2.
- **apps/api**: fastify 5.8.5, @fastify/{cookie 11,cors 11.2,helmet 13,jwt 10,rate-limit 10.3}, fastify-type-provider-zod 6.1.0, zod 4.4.3, pg 8.13.1, drizzle-orm 0.45.2 (solo pool wrapper; query business = raw SQL parametrizzato), argon2 0.41.1, otpauth ^9.5.1, pino ^9.14, vitest 4.1.6 (singleThread), tsx 4.19.2, typescript 5.7.2, supertest 7.
- **apps/web**: next 15.5.18, react/react-dom 19.2.5, @heuresys/ui ^0.1.1 (npm, NON link:), @heuresys/shared workspace:*, @tanstack/react-query 5.62.16, react-hook-form 7.55, i18next 23.16.8 + react-i18next 15.4, tailwindcss 4.3.0, @playwright/test 1.55.1 + axe.
- **apps/showcase**: Next 15 static export → GitHub Pages, consuma `@heuresys/ui`.
- **TS invarianti** (`tsconfig.base.json`): `strict`, `noUncheckedIndexedAccess` (narrow `T|undefined` mandatory), `noUnusedLocals/Parameters` (unused → prefix `_`), `exactOptionalPropertyTypes:false` (intenzionale).

## 3. API (apps/api) — heart MVP-1→4

- **Plugin chain fisso 13-step** (non riordinare; vedi `docs/api/API_IMPLEMENTATION_PLAN.md` §3.2): zod compilers → requestId → helmet → cors → cookie → JWT RS256 → rate-limit → auth (decode-only) → CSRF (opt-in) → tenantContext → errorHandler → /healthz+/readyz → module routes.
- **60 route module registrati** in `app.ts:206-265` (~58 business + auth/mfa/me/compensation/dashboard), **~272 endpoint live**. Pattern modulo a 7 step (schema shared → repository raw SQL → service + ActorContext → routes con `requirePermission` + `verifyCsrf` → register → integration test → atomic commit). **Non deviare.**
- **Test API**: **334 `it/test` case** in **52 file** `apps/api/test/*.integration.test.ts` (hit DB live via tunnel, no mock). CI suite = 42. Variabilità storica conteggi (69/334/341) = basi di conteggio diverse (file vs case vs chunk), documentata.
- **Shared**: `packages/shared` — 61 schema module Zod in `src/schemas/` + subpath exports.

## 4. Database (PostgreSQL 16 native — ADR-0004 NO Docker)

> ✅ **EMPLOYEE-CENTRIC ingestion correction DONE 2026-06-01 (S954, ADR-0024 / I14).** Le metodiche di popolamento dal SoT legacy erano **user-centric** (key `LEGACY:<users.id>`, `users → sys_users`); la realtà strutturale è **employee-centric** (207 FK → `employees` vs 45 → `users`). Corretto: `sys_user*` ⟸ legacy `employee*`, `users` → solo `sys_auth_*`, key `LEGACY_EMP::<employees.id>`. **3 fasi tutte chiuse**: Fase 1 doc (`2d87b77`: ADR-0024 + `EMPLOYEE_CENTRIC_MAPPING_DOCTRINE.md` + I14 + correzione plan/map/SOT), Fase 2 re-key 5 seed `rtl-rebuild` via email-join (`10d9923`), **Fase 3 migration `000046` ESEGUITA live** (`10c0cd1`: 160 `LEGACY:`→`LEGACY_EMP::`, relabel puro 0-FK, idempotente, API 359/0 verde, backup `pre-000045-rekey`; il file era inizialmente `000045`, rinominato `000046` per collisione con `000045_rbac_role_category_and_ceo.sql`). Dottrina: `docs/brownfield/EMPLOYEE_CENTRIC_MAPPING_DOCTRINE.md`; debito D-13; backlog B-50(e).

> 🔄 **RTL tenant rebuild EXECUTED 2026-05-30 (S950)** — DB collassato a **161 utenti / 2 tenant ACTIVE** (RTL_BANK ex-`86ba7a65` + nuovo HEURESYS): 158 rtl-bank.org + 3 heuresys.com. Org reale wired: **162 posizioni** (157 owned-by-manager, I1), 160 assignment PRIMARY, 26 OU, 3180 attendance IMPORT, comp/skills/certs/RBAC importati. 272 utenti out-of-scope + scaffold sintetico (161 pos / 6 OU) eliminati (single-tx, assertito). Backup: `pg_dump_snapshots/…pre-09-collapse_a892b81…` + `…pre-rtl-rebuild_eb55058…`. **6 commit PUSHATI** su origin/main (`3df1f6a`/`a892b81`/`db3104b`/`b4f56a0`/`b62b441`/`bad989f`, HEAD `bad989f`); **CI 5/5 verde** (test-integration + playwright-smoke, entrambi rossi a S949, ora verdi). API 354/0, prod E2E 138/0. Inclusi 2 fix pre-esistenti emersi dalla validazione: D4 sidebar (hybrid gate `hasAdminRole`) + login rate-limit env-tunable. I conteggi pre-rebuild qui sotto sono SUPERATI. Dettaglio: `memory/project_rtl_tenant_rebuild.md`.

- **Runtime**: ADR-0010 Option B — PG16 native su `oracle-vm-default`, raggiunto da Windows via tunnel `ssh -L 5433:localhost:5432 oracle-vm-default` (RD-25). Connection: localhost:5433, db `heuresys_advanced`, user `heuresys`, schema `sys`.
- **45 migration** idempotenti `000001..000046` (**gap `000035` cosmetico**, documentato). Ultime `000045_rbac_role_category_and_ceo.sql` (R1a) + `000046_rekey_external_code_employee_centric.sql` (ADR-0024, S954). Contract: `pnpm db:migrate` ×2 → pg_dump diff vuoto.
> 🧹 **DB sanitization 2026-06-01 (S954, commit `169c999`).** Pass di igiene del bare-metal (census→clean, gated da backup `pre-cleanup-s954_20260601_0410`). Fatto: TRUNCATE `staging.rtl_*` + `legacy_rtl_occupations` (14 tab, ~6k righe leftover S950, dati già in `sys.*`); DROP 2 tabelle leftover `temp_sdbi` (pilota SDBI, non migration-managed); import_run orfano RUNNING (fermo 21/05) → CANCELLED (74k validation_results preservati, UPDATE non DELETE) — B-50(c); VACUUM FULL audit+legacy_mirror (compattato ~21 MB bloat reale). **ANALYZE full-DB** (stime planner ri-allineate). **Correzione census (R5)**: `legacy_mirror` (586 MB) e `audit.import_validation_results` (528 MB) NON erano "bloat 0-righe" come erroneamente classificato da `pg_stat.n_live_tup` stale — sono **dati reali** (1.522.455 validation results dei 21 import COMPLETED + cache ESCO 14k skills/pgvector). Nessun ~1 GB da liberare. Verifiche post: db:migrate ×2 idempotente (45 mig), API 359/0, schema intatto. Dettaglio: `qa_artifacts/_census_CORRECTION.md`.
> ℹ️ **3 tenant ACTIVE — CORRETTO e by-design** (investigato S954, NON un'anomalia). Oltre a RTL_BANK (158 utenti, operativo, rebuild S950) + HEURESYS (3), esiste `RTL_BANK_REFERENCE` "Retail Bank Reference" **ACTIVE con 0 utenti**: è il **tenant-template fondazionale** creato dalla migration `000021_seed_reference_bank.sql` (`metadata.purpose=reference_tenant, is_synthetic=true`) insieme al blueprint `FIN_BANKING`/`REGIONAL_RETAIL_BANK_MEDIUM` + 7 reward gates + 23 processi bancari. 0 utenti è normale (è un template, popolabile on-demand da `db/scripts/seed-reference-bank.ts` con 158 Faker users). **NON eliminare**: (a) 0 dipendenze live ma `000021` lo ricrea ad ogni `db:migrate` (un DELETE ritorna); (b) cancellarlo orfanerebbe blueprint/reward-gates/processi che vi sono ancorati; (c) citato come anchor in `auth.integration.test.ts`. Il P1 RTL-stabilization che lo "eliminò" fu un errore poi auto-annullato dal migrate. Verifica forense: `qa_artifacts/_rtlref_deps.txt` (0 righe dipendenti su 92 tabelle FK).

- **DB size**: 1304 MB (post-cleanup). Breakdown: `legacy_mirror` 586 MB (cache legacy ESCO/skills, reale), `audit` 528 MB (1.522.455 validation results dei 21 import), `sys` 167 MB, `staging` 2 MB (svuotato), `brownfield` 1.5 MB.
- **Schemi**: `sys` (134 base tables + 11 views per I3/I4, `sys.sys_<plural>`), `staging` (wave1_* 18 tab migration-managed + rtl_* svuotate), `brownfield` (registry), `audit`, `legacy_mirror` (115 tab cache legacy runtime, rigenerabile via wave-executor loader), `temp_sdbi` (schema da migration 000036; tabelle pilota rimosse).
- **Counts verified (real count(\*), post-ANALYZE 2026-06-01)**: **sys_users 161**, **positions 162**, **org_units 26**, **assignments 160 PRIMARY**, **3 tenant ACTIVE** (RTL_BANK 158 + HEURESYS 3 + RTL_BANK_REFERENCE 0 ⚠), **sys.* populated 65/134**. Lineage: **69.450** rows. Brownfield registry: 93 source_tables, 1164 source_columns, 94 table_mappings, **1271 column_mappings**, 18 staging.wave1_*. import_runs: 21 COMPLETED + 1 CANCELLED + 1 FAILED.
- **Brownfield Wave 1**: 13/19 IMPORT targets popolati (~34509 upserted); 3 reclassed REFERENCE_ONLY (ADR-0020); 3 silent-skip mitigati (CW-B61 observability).

## 5. Auth / Security

- Argon2id 64MiB/3/4 (ADR-0005, auto-rehash). JWT RS256 15min HttpOnly+SameSite=Lax; refresh 30d single-use + replay detection (`401 REFRESH_REPLAY_DETECTED`); keys `.secrets/jwt_*.pem` gitignored. Login **200 con body** (no 204). CSRF double-submit opt-in. MFA TOTP (otpauth, AES-256-GCM `MFA_ENCRYPTION_KEY` ≥32). RBAC 8 ruoli × 394 mapping caricati a server start (`RBAC_NOT_LOADED` se pre-cache). Error classes typed in `src/errors/index.ts`. Logger redaction `LOG_REDACT_PATHS`.
- 8 ruoli: PLATFORM_ADMIN, TENANT_ADMIN, BLUEPRINT_MANAGER, HRMS_MANAGER, PROCESS_OWNER, MANAGER, USER, READ_ONLY.
- Personas seed (`pnpm db:seed-test-admin`, pwd `Admin#PassW0rd!`): admin@heuresys.com (PLATFORM_ADMIN), tenant_admin_test/manager_test/employee_test/outsider_test @rtl-bank.test.

## 6. Web (apps/web) — MVP-2a/2b shipped

- Next 15 App Router + React 19 + Tailwind 4 + @heuresys/ui. **64 route `page.tsx`**: admin (~29) + ESS `/me/*` (~14, ADR-0011 MVP-2b) + system-health + auth + showcase. Tag MVP-2a `v0.2.1-mvp2a-final`.
- **20 Playwright spec** E2E (login reale + assert su dati seed). Dottrina LIVE DATA E2E ONLY (vedi `NEXT_SESSION_MVP_2A.md`): no mock/fixture/placeholder; ogni cella da `/v1/*` reale; nessun page commit senza E2E verde.
- **/showcase**: riabilitato (CW-B59 RESOLVED) via `apps/web/src/app/showcase/_ui-client.tsx` (`next/dynamic ssr:false`); deploy GitHub Pages verde.

## 7. CI / Infrastructure

- **6 workflow self-hosted** su OCI VM runner `oracle-vm-default-runner` (online): typecheck, lint, test-integration (DB+JWT+RBAC), build-web, playwright-smoke (5 personas, web :3100 vs Grafana :3000), i18n-parity. **+1 showcase deploy** (GitHub Pages, ubuntu-hosted). **Tutti verdi** su ultimo commit di codice `7f6e174` (i commit docs-only S938 `c2f95ad`/`9cd906e` sono paths-ignored → nessun re-run, atteso).
- Runner systemd EnvironmentFile `/etc/heuresys-runner.env` (JWT PEM `\\n` double-escape; ADMIN_ORIGIN; NEXT_PUBLIC_API_BASE_URL). Setup: `docs/ci/self-hosted-runners-setup.md`.
- **Host topology**: Windows primario (`DESKTOP-KH728P2`, PS 5.1, Git Bash, `C:\Git\cmd\git.exe`); Mac secondario (`mac-local` 192.168.1.4); OCI VM `oracle-vm-default` 80.225.82.207 (runtime+CI). Chiavi SSH in `C:\Users\enzospenuso\.ssh\` (`oci_recovery_ed25519` passphrase-protected, mac_local, github).
- **Deploy/bootstrap (B-44, 2026-05-28)**: idempotent per-OS scripts in `scripts/` + `deploy/`. `vm-bootstrap.sh` = Linux server (systemd units `heuresys-advanced-{api,web}`, public **:8013/:3013**, Node 22 via nvm, DB local :5432). `dev-bootstrap.sh` (Mac/Linux-desktop) + `dev-bootstrap.ps1` (Windows) = workstation, on-demand `pnpm dev` (:3001/:3000) against the VM DB via tunnel :5433. See `deploy/README.md`. heuresys-advanced **also runs live on the VM** (8013/3013) alongside legacy evo.

## 8. Prerequisiti autonomia unattended (checklist boot CLI)

```bash
ssh -o BatchMode=yes oracle-vm-default 'echo OK'   # key in agent? altrimenti load manuale (CW-B62)
nc -z localhost 5433 && echo tunnel-up             # auto cross-reboot via task HeuresysTunnel5433 (ADR-0021); fallback hook session-boot.ps1
git -C D:/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
pnpm install -r && pnpm --filter @heuresys/web build          # exit 0
gh run list --limit 6                              # main CI verde
```

- **Stato S939 boot**: tunnel 5433 UP ✓, SSH `oracle-vm-default` OK ✓ (key in agent), working tree pulito ✓, CI verde ✓.
- **Push policy**: commit locali su `main` pre-autorizzati (project rule). **Push solo su ok esplicito di Enzo**; l'autorizzazione vale per la sessione fino a revoca, nuova sessione riparte da "ask".
- **SSH tunnel hands-off** (ADR-0021, chiude CW-B62 / B-31): tunnel `:5433` automatico cross-reboot via scheduled task At-Logon `HeuresysTunnel5433` + hook di sessione fallback `scripts/session-boot.ps1`, su service-account key no-passphrase ristretta (`heuresys_tunnel_ed25519`, `permitopen="127.0.0.1:5432"` + forced command, no shell). Setup one-shot idempotente: `scripts/setup-tunnel-automation.ps1`. La chiave admin passphrase-protected resta per il solo accesso interattivo (helper `s937-ck1-load-ssh-key.ps1`).

## 9. Invarianti non negoziabili (override "common patterns")

I1 Position-centric (owner ≠ incumbent) · I3/I4 schema `sys.sys_<plural>` (aux: staging/brownfield/audit) · **I5 tenant isolation = FK + middleware, MAI RLS** · I7 auth separato (`sys_auth_*`) · I9 PIP = VIEW (ADR-0008) · **I13 PostgreSQL 16 NATIVE, NO Docker** (ADR-0004; runtime only — legacy Docker = read-only source) · RD-08 categorical = `varchar+CHECK` (mai ENUM) · RD-09 `date` vs `timestamptz` · **I12 brownfield/legacy = authoritative no-PII data source** (ADR-0023; `sys.*` = structural authority, no-PII global) · **I14 legacy ingestion = EMPLOYEE-centric** (ADR-0024): la persona legacy è `employees` (207 FK), NON `users` (45 FK, auth shell); `sys_user*` ⟸ legacy `employee*`; `users` → solo `sys_auth_*`; key `LEGACY_EMP::<employees.id>`, mai `users.id`; vedi `docs/brownfield/EMPLOYEE_CENTRIC_MAPPING_DOCTRINE.md` · ADR-0011 ESS = MVP-2b. Conflitto con nuovo requisito → **fermarsi e chiedere**.

## 10. Bias / lessons (assorbito da bias_registry.md)

`cowork_reserved/bias_registry.md` = SoT bias storica (read-only archive da ora). **62 catalogati** (CW-B17→B63, B57 withdrawn), **45 mitigated**, **0 deferred-fix** (CW-B59 RESOLVED). Next `CW-B64`. Lezioni meta più importanti per il CLI autonomo: empirical test matrix > narrative diagnosis (B58); time-box 60-90min/8-10 iter su bisect prima di reframe (B59); automazione "shipped" non eseguita NON è validata — il primo run reale è parte del deliverable (B63); pre-flight `git ls-tree HEAD` per evitare spec staleness (B52). **D'ora in poi il CLI emette eventuali nuovi bias direttamente qui (`docs/kb/`), non più via claim race Cowork** — vedi `DEBT_REGISTER.md` per la policy di numerazione post-Cowork.
