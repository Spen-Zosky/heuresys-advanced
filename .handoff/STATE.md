# heuresys-advanced — STATE

**Updated**: 2026-06-04 (S963). Baseline **v1.0.0 GA**. main synced (`9ab5547`), migration `000068`. **PROD live su `https://www.heuresys.com` (TLS).** Mac + VM allineati e deployati.

## Last session brief (S963 — ultracode; BI P2 + i18n Fase 0a + login-prod + TLS)

- **① BI Analytics P2** ✅ — 3 viste full-stack `/v1/analytics/{attendance,compensation,skills}` (nav mig `000066/067/068`, E2E live, **adversarial 3/3 PASS**). `e1b74df`/`73a69ca`/`8983788`.
- **Milestone i18n** (IT default + EN) avviata: design `docs/superpowers/specs/2026-06-04-i18n-milestone-design.md` (~600 chiavi/50 pagine, RSC eliminato). **Fase 0a ✅** (`be5c1ab`): i18n 7-namespace client-only + switcher IT/EN + shell estratta. + `i18n-parity` gate fix (`src/i18n`→`src/locales`, `6573a17`) + `sync-showcase` prune react-i18next (`6a1897f`).
- **Login prod fix** (`9ab5547`): cookie auth `Secure` scartati su HTTP → env **`COOKIE_SECURE`** (disaccoppiato da NODE_ENV).
- **TLS production ✅**: nginx (già sulla VM) **ripuntato `www.heuresys.com`/`heuresys.com` da legacy evo (:3012) a heuresys-advanced (:3013)** via HTTPS Let's Encrypt (cert esistente, zero nuovo DNS). `COOKIE_SECURE=true`. Login HTTPS verificato (Chrome → dashboard). **evo legacy intatto su `evo.heuresys.com`** (:3200).

## Top priorities (next session)

1. **i18n Fase 0b + Fase 1 pilota** (~M): locale in `sys_user_preferences` + `/v1/me/preferences` + `PreferencesApplier` + ESLint guardrail; poi pilota **analytics** (5 pagine).
2. **② AI semantic-matching P1** (~L): backfill Voyage. **Gated su `VOYAGE_API_KEY` nel `.env`**.
3. **① BI P3** (~M) org-network · **6 proposte F7** · *(minore)* versionare la nginx conf prod in `deploy/`.

## Open questions

- **`VOYAGE_API_KEY`** nel `.env` VM → sblocca ② P1 (unico gate). ~$0.05.
- Versionare la config nginx `www.heuresys.com.conf` (oggi solo sulla VM) nel repo?

## Stack snapshot

- **PROD = `https://www.heuresys.com`** (+ `heuresys.com`) → nginx TLS Let's Encrypt → web `:3013` (proxa `/api`→`:8013` internamente). `COOKIE_SECURE=true`, `ADMIN_ORIGIN=https://www.heuresys.com`. nginx conf **non versionata** (`/etc/nginx/sites-enabled/www.heuresys.com.conf`; backup evo in `/home/ubuntu/*.bak-s962`). evo legacy = `evo.heuresys.com` (:3200). **Deploy = `scripts/vm-deploy.sh`** (non tocca nginx/.env). SSH ops: vedi memoria `reference_remote_ssh_deploy_ops`.
- migration `000068`, ~284 endpoint, API suite 650/6. i18n 7 namespace (common/shell estratti). Reconciliation 112/147 POPULATED.

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline      # vuoto = synced
curl -s -o /dev/null -w "%{http_code}\n" https://www.heuresys.com/login   # 200
cd apps/web && pnpm i18n:check                                    # parity 58 x2 x7 ns
```
