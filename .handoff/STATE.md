# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-08 (S978).

> **Vista rapida** dello stato di lavoro (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura, delta per-sessione) → `docs/kb/SOT_STATE.md` (§0-duodecies = S978). Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui.

## Last session brief (S978 — ultracode, aggregato item #1-8 dal menu, decisioni delegate)

Eseguiti **8 item in autonomia** (Enzo ha delegato le decisioni semantiche/architetturali per questa sessione). **7 commit nuovi pushati** (`0ea045b`..`385e74e`), full API suite **837/6**, web typecheck+build verdi. **#4** category-heatmap era già shippato (`5ec1c6d`, solo verificato). **#3** insights scheduled-recompute (CLI + systemd daily timer, `0ea045b`). **#1** cap⑤ ESCO **full-catalogue 2942** (era 100; fix paging single-page, `3663371`, live-verified). **#5** cap② Fase 3 **PSR-population** 844 righe via derivazione peer-group (`93e4b45`, mig 000096). **#2** cap② B-10b **m2b normalized cluster** (`afdfd64`, mig 000097 + seed 48: 8 surveys/3792 responses/733 pulse, modulo `/v1/engagement`). **#6** cap④ CMS P3 **full-text search** (`4e85281`, mig 000098). **#7** MVP-4 §2.5 MFA **recovery codes** (`9ba2fba`, mig 000099). **#8** MVP-4 §2.7 WCAG 3.1.1 `<html lang>` dinamico (`385e74e`). Granulare → `SOT_STATE.md` §0-duodecies.

## Top priorities (next session)

1. **Deploy verify + CI** — confermare CI verde sui 7 commit + vm-deploy PROD eseguito (S978 close in corso); smoke endpoint nuovi (`/v1/engagement/surveys`, `/v1/content/search`, `/v1/auth/mfa/recovery-codes`). ~S.
2. **cap④ CMS P3 residuo** — BPM cross-link (content↔blueprint) + search-UI box su `/content` (API full-text già live). Media object-store ⛔ decisione infra/costo (PM). ~M.
3. **MFA §2.5 residuo** (WEBAUTHN `@simplewebauthn` + ceremony · session-enum UI `/me/security/sessions` · mandatory-MFA policy; SMS_OTP ⛔ provider+costo PM) · **WCAG §2.7 tail** (axe serious/moderate/minor per-route + mobile sweep, multi-sessione ~37-62h, critical=0 già gated) · **cap⑤ 2ª sorgente** ISTAT/ATECO (⛔ ToS). Multi-sessione.

## Open questions

- **Media object-store** (cap④ P3): dove archiviare i media (S3/MinIO/disk) — decisione infra/costo PM.
- **SMS_OTP** (MFA §2.5): scelta provider + costo — decisione PM.
- **cap⑤ 2ª sorgente**: sign-off ToS ISTAT/ATECO.

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
gh run list --limit 8                                          # main CI verde (7 commit S978)
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT count(*) FROM sys.sys_survey_responses"  # 3792 (m2b)
curl -s -o /dev/null -w '%{http_code}\n' http://80.225.82.207:8013/v1/engagement/surveys  # 401 = live PROD
MSYS_NO_PATHCONV=1 ssh oracle-vm-default 'systemctl list-timers heuresys-advanced-insights.timer --no-pager'  # daily timer
```
