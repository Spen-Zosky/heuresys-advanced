# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-12 (S984).

> **Vista rapida** dello stato di lavoro (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura, delta per-sessione) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui.

## Last session brief (S984 — ripresa batch S983 interrotto, chiusura totale P1/P2/P3)

S983 (interrotta da riavvio PC, mai handoffata) recuperata e chiusa in S984. S983 aveva shippato WS-A/B/C/D (mobile-a11y census a zero + gate incondizionato; ISTAT/ATECO 2ª sorgente; vite 8 + TypeScript 6) e WS-E E1-E4 (retrofit dual-mode dell'intera suite, pre-mutazione). S984 ha completato il batch: **E4** push+CI verde (3 fix: lint, porta smoke CI 3100→3187 con guard+identity-check — un next-server estraneo `lalibraiascalza.com` sulla VM aveva occupato :3100 silenziando lo smoke; gap dual-mode in wave2 trovato dalla verifica adversarial pre-mutazione) → **E5** mutazione (6 fattori TOTP fixture + flip policy: **mandatory-MFA copertura totale LIVE su RTL + Heuresys System**, `roles=NULL`; rollback `qa_artifacts/s983_mfa_rollback.sql`, flip `qa_artifacts/s984_mfa_flip.sql`) → gates post-flip tutti verdi (il collasso 97-fail della full Playwright dev-mode era un artefatto finestra-sessione ~45min vs run 90min → DEBT D-24/D-25, rerun prod-build verde in 7min) → **E6** PROD verificato (login TOTP headless completo via `https://www.heuresys.com`: admin tenant HS + tommaso RTL/USER, `/me` 200). P3 chiusi: TS6 era già adottato (S983); SMS_OTP/TOFU-SMTP gates confermati chiusi sul campo → dormienti by-design.

## Top priorities (next session)

1. **D-24 + D-25 remediation** (~1-2h, P3): full-suite Playwright locale oltre la finestra di validità sessione → standardizzare la run su build prod (7min, provato S984) e/o setup re-login per-chunk; rendere crash-resilient il restore server-side di `i18n-en.spec` (leftover `locale=en` ripristinato a mano S984). Vedi `DEBT_REGISTER.md`.
2. **Attivazioni dormienti** (config-only, ⛔ PM): SMS_OTP (provider+costo) · TOFU v2/SMTP (creds nel `.env` VM). Chiavi censite S984: `SMTP_HOST/PORT/SECURE/USER/PASSWORD` + `MFA_ENROLL_CONFIRM`; `SMS_PROVIDER`/`SMS_FROM` + adapter provider.
3. **Nuove direzioni prodotto** (PM): backlog operativo sostanzialmente a zero — roadmap post-v1.0 da definire (candidati storici: connettore SuccessFactors, Wave-3 import, F7 refactor estetico showcase).

## Open questions

- **SMS provider** (quale, costo) per attivare SMS_OTP in PROD — PM (invariata).
- **Creds SMTP** nel `.env` VM per attivare TOFU v2 confirm — Enzo (invariata).
- **Residuo cosmetico**: 3 fattori MFA throwaway di tommaso (`verified=false`, enroll E2E non confermati) — ininfluenti sul gate, ripuliti dal prossimo run delle suite.

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
curl -s -o /dev/null -w 'PROD %{http_code}\n' https://www.heuresys.com/login   # 200 (TLS nginx → :3013)
PGPASSWORD="$(grep -m1 localhost:5433 ~/.pgpass|cut -d: -f5)" psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "SELECT auth_mfa_policy_enabled||'|'||coalesce(auth_mfa_policy_role_codes::text,'ALL') FROM sys.sys_auth_mfa_policies"   # 2 righe: true|ALL (copertura totale)
PGPASSWORD="$(grep -m1 localhost:5433 ~/.pgpass|cut -d: -f5)" psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "SELECT count(*) FROM sys.sys_auth_mfa_factors WHERE auth_mfa_factor_metadata->>'label'='e2e-fixture'"   # 6
bash db/scripts/migrate.sh | tail -1   # OK: 108 migrations applied (idempotente)
```
