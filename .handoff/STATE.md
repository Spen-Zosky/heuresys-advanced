# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-13 (S985).

> **Vista rapida** dello stato di lavoro (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura, delta per-sessione) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui.

## Last session brief (S985 — batch 1+2+5: D-24/D-25 chiusi · dossier roadmap · D-26 scoperto)

D-24+D-25 RISOLTI: la full suite E2E ha ora un entrypoint canonico su build prod (`pnpm test:e2e:prod`, config dedicato con re-login mid-suite e assert anti-vacuità; gate verde end-to-end). La diagnosi ha corretto la finestra reale (15 min, non 45) e **scoperto D-26**: il silent-refresh è strutturalmente rotto dietro i proxy `/api` → **gli utenti reali in PROD vengono sloggati ogni 15 minuti** con re-login TOTP (mandatory-MFA). L'anti-vacuità ha inoltre smascherato 2 violazioni a11y serious reali nascoste dai census storici vacui → fixate (`@heuresys/ui@0.1.5` upstream + matrice `/admin/roles`). Scritto il **dossier roadmap post-v1.0 decision-ready** (`docs/kb/POST_V1_ROADMAP_DOSSIER.md`); F7 verificato terminale (label storica rimossa da questa lista). I 3 fattori MFA throwaway di tommaso si erano già autopuliti (verificato).

## Top priorities (next session)

1. **D-26 — fix silent-refresh / hard-logout 15min in PROD** (🔴, ~2-4h, sessione dedicata): decisione di design (cookie path vs proxy rewrite vs route handler) + fix + integration + E2E sessione >15min. È UX rotta in produzione live: precede ogni item di roadmap. Vedi `DEBT_REGISTER.md` D-26.
2. **Decisioni dossier roadmap post-v1.0** (PM): `docs/kb/POST_V1_ROADMAP_DOSSIER.md` — domanda madre = go-to-market (§3.1, prezza SF/Wave-3/GDPR); quick-wins CLASSE A eseguibili senza decisione (R5 backup DB + R7 timer reindex + DR drill, ~1 sessione aggregata).
3. **Attivazioni dormienti** (config-only, ⛔ PM, invariata): SMS_OTP (provider+costo) · TOFU v2/SMTP (creds nel `.env` VM).

## Open questions

- **D-26**: greenlight sessione dedicata? E quale opzione di design (a/b/c/d in DEBT_REGISTER)?
- **Go-to-market** (dossier §3.1): pilota reale o reference case-study permanente? — decide il peso di SuccessFactors/Wave-3/GDPR.
- **SMS provider** (quale, costo) per SMS_OTP in PROD — PM (invariata).
- **Creds SMTP** nel `.env` VM per TOFU v2 — Enzo (invariata).

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
curl -s -o /dev/null -w 'PROD %{http_code}\n' https://www.heuresys.com/login   # 200
# full suite E2E canonica (build prod + re-login mid-suite, ~10min):
cd /d/heuresys-advanced/apps/web && pnpm run test:e2e:prod
# D-25 guard: dopo qualsiasi crash run, il locale torna 'it' al setup successivo
PGPASSWORD="$(grep -m1 localhost:5433 ~/.pgpass|cut -d: -f5)" psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "SELECT user_preference_locale FROM sys.sys_user_preferences p JOIN sys.sys_users u ON u.user_id=p.user_preference_user_id WHERE u.user_email='admin@heuresys.com'"   # it
```
