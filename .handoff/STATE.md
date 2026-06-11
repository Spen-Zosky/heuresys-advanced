# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-10 (S982).

> **Vista rapida** dello stato di lavoro (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura, delta per-sessione) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui.

## Last session brief (S982 — mega-batch da piano approvato, 9 task tutti consegnati)

Piano `docs/superpowers/plans/2026-06-10-s982-mega-batch.md` eseguito end-to-end: **Wave-2/B-50 CHIUSO** (import branches+succession su decisioni PM in-session, registry a 0 NEEDS_DECISION — la riconciliazione legacy→advanced non ha più tavoli in stato aperto), **§2.5 MFA completo code-side** (SMS_OTP code-only, TOFU v2 confirm out-of-band env-gated, UI admin policy) e **mandatory-MFA ATTIVATA in PROD su RTL** (slice 4 ruoli senza personas E2E; gate verificato live), **cap④ CMS chiusa** (ESS-media serve), **color-contrast a11y risolto** (0 serious su tutta la matrice, gate CI alzato), engines→22 (#30 chiusa). Push, CI verde, align 3 cloni + vm-deploy, smoke PROD ok. **Coda di sessione**: refresh dati del twin `linux-pc` (clone-vm-db + restart) — anche il twin ora ha Wave-2, policy MFA attiva e gate live; tutti e 4 gli ambienti correnti.

## Top priorities (next session)

1. **Estensione mandatory-MFA agli altri ruoli RTL** (TENANT_ADMIN/MANAGER/USER…): 1 PUT o via UI `/admin/mfa-policy`, ⛔ decisione comunicazione utenti (Enzo); se include le personas E2E serve l'adattamento auth.setup (TOTP fixture, ~2-3h).
2. **Attivazioni gated dei meccanismi già code-complete**: TOFU v2 confirm in PROD = ⛔ creds SMTP nel `.env` VM (item #8 storico) · SMS_OTP in PROD = ⛔ provider+costo (PM); a valle solo config, zero codice.
3. **Mobile a11y sweep** (§2.7, unico tail a11y residuo, mai iniziato): multi-sessione (~37-62h storici, da ri-stimare — il serious desktop è a 0 e il gate CI ora copre serious).

## Open questions

- **Comunicazione utenti per estendere la policy MFA** (vedi priorità 1) — quando/come, autorità Enzo.
- **#11 cap⑤ 2ª sorgente ISTAT/ATECO**: sign-off ToS (legale) — invariata.
- **SMS provider** (quale, costo) per l'attivazione PROD di SMS_OTP — PM.

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
curl -s -o /dev/null -w 'VM %{http_code}\n' http://80.225.82.207:8013/readyz
PGPASSWORD="$(grep -m1 localhost:5433 ~/.pgpass|cut -d: -f5)" psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "SELECT auth_mfa_policy_enabled, auth_mfa_policy_role_codes FROM sys.sys_auth_mfa_policies WHERE auth_mfa_policy_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0'"   # t | {BLUEPRINT_MANAGER,HRMS_MANAGER,PROCESS_OWNER,READ_ONLY}
bash db/scripts/migrate.sh | tail -1   # OK: 107 migrations applied (idempotente)
```
