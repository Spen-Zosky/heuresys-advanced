# S-100X-0 — Recon trasversale (seed, read-only, 2026-06-13)

> Output sintetizzato di 3 sub-agent Explore read-only (backend/arch/data · frontend/ds/test/ci · security/config/repo/docs). **Seed** per le sessioni di audit per-WS: ogni finding va ri-verificato e approfondito nella sessione A relativa. Severità/flag come da `../AUDIT_PROTOCOL.md`.

## Asset confermati (NON toccare senza dossier)
- **Raw SQL data layer**: 0 N+1 reali (i "loop" sono aggregazione in-memory o bounded), set-based JOIN/CTE/LATERAL, `SELECT *` solo 4× e benigni (view/LIMIT 1). Connector discipline pulita (71/72 service threadano `{ pool }` come `DbConnector`).
- **Boot hardened**: RBAC cache caricata prima di `listen()` con retry backoff `[1,2,4,8]s`, fail-fast su empty-cache; pg.Pool con idle-error listener (no crash su ECONNRESET). `server.ts:36`, `auth/cache-loader.ts:35-56`, `db/client.ts:34-45`.
- **Design-system discipline**: 0 primitive UI definite in-repo (grep Button/Input/Badge/… = 0); gli 8 componenti web sono composizione tenant/RBAC legittima su `@heuresys/ui`. `transpilePackages` + `@source` Tailwind corretti.
- **Auth hardened**: Argon2id · JWT RS256 · refresh rotation+replay family-revoke · CSRF double-submit · 4 fattori MFA + policy · `LOG_REDACT_PATHS` single-source test-backed (redige cookie + `code`/`otp` ricorsivi). helmet+CSP+cors+rate-limit ordinati in `app.ts:194-246`.
- **Migration idempotency**: 954 `IF NOT EXISTS`, 145 `ON CONFLICT`, twice-run machine-verificabile; dead schema minimo (`temp_sdbi.*` droppato by-design).
- **Git history sana**: `.git` 23M, size-pack 19.4MiB.
- **Secrets**: 0 segreti reali nel tracked tree (5 hit `BEGIN PRIVATE KEY` = placeholder/doc), 0 dist tracked (anomalia D-16 risolta).

## Top finding (seed, da approfondire in fase A)

| ID | Sev | Flag | Descrizione | Evidenza | WS/Dossier |
|---|---|---|---|---|---|
| R01 | HIGH | DOSSIER | **Runner CI self-hosted unico = la VM prod** (7/8 workflow) → SPOF, CI e prod cadono insieme | `test-integration.yml:40` labels `[self-hosted, oci-vm]` | A1 / D-08 |
| R02 | HIGH | DOSSIER | **Deploy senza rollback**: `vm-deploy.sh` distruttivo in-place (`reset --hard`→build→restart), 0 release-dir/symlink/last-good ref; probe readyz/login rilevano ma non agiscono | `scripts/vm-deploy.sh` | A1 / D-08 |
| R03 | HIGH | DOSSIER | **Vitest single-worker serial** su pool condiviso (anti-race refresh) = soffitto di scaling della suite (901 it) | `apps/api/vitest.config.ts` | A3 / D-B test |
| R04 | MEDIUM | DOSSIER | **Piramide test invertita**: 901 it-block quasi tutti su DB reale, ~10 unit incidentali | grep unit-candidates | A3 / D-B |
| R05 | MEDIUM | DOSSIER | **Playwright serial + re-login mid-suite** (D-24) per 15min single-use refresh; parallelismo bloccato da `tests/.auth/*.json` condiviso | `playwright.prod.config.ts` | A3 / D-C |
| R06 | MEDIUM | DOSSIER | **Frontend 100% client**: ogni pagina reale `"use client"` + `useQuery` → first-paint waterfall (64 pagine); RSC/streaming inutilizzato | `apps/web/src/app/**`, 64 query-hook | A7 / D-04 |
| R07 | HIGH | QUICK-WIN | **27G `.next` + 3.7G dumps** rigenerabili su disco | `du -sh apps/web/.next` = 24G | A10 / QW-2 |
| R08 | MEDIUM | QUICK-WIN | **`drizzle-orm`+`drizzle-kit` dead dep**: 0 importatori del `db` export (83× `{ pool }`) | `db/client.ts:47` | A6 / QW-1 |
| R09 | MEDIUM | QUICK-WIN | **8 env var non documentate** (WebAuthn/SMS/media/MFA-confirm/ratelimit) | `apps/api/src/config/env.ts` vs `.env.example` | A9 / QW-3 |
| R10 | MEDIUM | DOSSIER | **`withTransaction` in auth (leaf)**, 5 consumer → 67 moduli non lo riusano | `auth/repository.ts:542` | A5 / D-03(helper) |
| R11 | INFO | DOSSIER | **Nessun `/metrics` app-level** (solo healthz/readyz + pino redaction) | scan app.ts | A2 / D-09 |
| R12 | LOW | QUICK-WIN | **package.json desc stale** "58 moduli/272 endpoint" vs 72/407 | `apps/api/package.json:6` | A11 / QW-5 |
| R13 | LOW | DOSSIER | **Docs sprawl/drift**: 230 md, `source_bundle` 94 (drift magnet), `cowork_code_exchange/` ~150 log storici | `docs/source_bundle/` | A11 / D-3docs |
| R14 | INFO | DOSSIER | **Module-pattern ~50-60% scaffolding** (routes uniformi `actor()`+requirePermission+verifyCsrf ×72) → candidato codegen, NON runtime-factory | `skills/routes.ts:23-26` | A5/A6 / D-01codegen |
| R15 | LOW | DOSSIER | **Multi-host script duplication** `.sh`/`.ps1` + key-merge host-specifico, lightly tested | `scripts/env-key-merge.sh` | A9 / D-6scripts |

## Migration squash
108 file / 12.4k LOC additivi, idempotenza verificabile, dead schema minimo → squash-to-baseline al tag GA è low-risk (prod già a HEAD). Dossier D-07.

## Brownfield engine
Riconciliazione a **0 stati aperti** (registry 0 UNCLASSIFIED, vista terminale). Il motore wave-executor/transform-compiler/staging è runtime-necessario solo per futuri onboarding (Wave-3) → keep/freeze/extract = dossier D-11.

> Nota: l'hook `claude-mem` PostToolUse era down durante il recon (rumore ambientale, non ha toccato i findings) → tracked in WS-L.
