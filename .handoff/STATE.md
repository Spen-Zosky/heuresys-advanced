# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-08 (S979).

> **Vista rapida** dello stato di lavoro (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura, delta per-sessione) → `docs/kb/SOT_STATE.md` (§0-duodecies = S978). Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui.

## Last session brief (S979 — tooling, no repo changes)

Sessione di manutenzione setup Claude Code (zero modifiche al repo): risolti i fail `/doctor` MCP — `context7` plugin disabilitato (ridondante col connettore remoto `claude.ai Context7`, verificato live), `chrome-devtools-mcp` spostato da `npx` (cold-start Windows lento → timeout 30s) a binario `node` globale (handshake MCP verde) + hook SessionStart self-healing che ri-applica il bypass dopo ogni update del plugin. Dettaglio in memoria `reference_chrome_devtools_npx_bypass`. I 5 connettori `claude.ai` restano OAuth-only. **Priorità di progetto invariate da S978** (sotto; dettaglio S978 → `SOT_STATE.md` §0-duodecies).

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
