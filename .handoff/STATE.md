# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-09 (S980).

> **Vista rapida** dello stato di lavoro (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura, delta per-sessione) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui.

## Last session brief (S980 — batch #1-5: 4/5 shipped, full-gated)

Eseguito in autonomia il batch del menu **#1+#2+#3+#5** (decision-authority session-scoped), ognuno con ciclo completo (integration + E2E live + typecheck + i18n parity) e atomic commit locale su `main`:
- **#1 cap④ CMS P3 search-box** (`46cadc9`) — box FTS su `/content` (FE-only; API `/v1/content/search` già live).
- **#2 cap④ CMS P3 content↔blueprint cross-link** (`663deef`, mig 000100) — modulo `content-blueprint-links`, 5 endpoint, pannello attach/detach + tab "documentation".
- **#3 MVP-4 §2.5 ESS session management** (`27cb01e`, mig 000101) — `/me/security/sessions` list+revoke+revoke-others. **Fix architetturale reale**: il cookie refresh (path `/v1/auth`) non passa il proxy `/api/*` → "current device" non si rilevava → risolto con **claim `fam` nell'access JWT** (path `/`), 0 regressioni su 79 test auth.
- **#5 MVP-4 §2.5 WebAuthn passkey** (`8c9c2c1`, mig 000102) — `@simplewebauthn`, modulo + 4 ceremony route + tabella credenziali; enroll live (E2E con virtual-authenticator). Auth-ceremony al login = dormiente finché #4 non chiude il flusso.

**Sessione chiusa su decisione context-budget di Enzo (71%)** — #4 NON iniziata (solo letto il login hot-path). Ripresa fresh.

## Top priorities (next session)

1. **#4 mandatory-MFA policy** (MVP-4 §2.5, ~M-L) — la **keystone più rischiosa** (login hot-path, ~80 file di test sensibili al response-shape). **Finding S980**: il gate MFA al login è **GIÀ cablato** (§3b `service.ts`, il commento "not wired" in `mfa-routes.ts` è stale) → serve solo lo stato `mfa_enrollment_required` per utenti in-scope senza fattore + il **flusso enrollment pre-sessione** (token limitato / claim JWT, riusa l'infra `fam`). Chiude anche l'auth-ceremony WebAuthn + il "use passkey" nella login page. Default OFF (no lockout). Sessione dedicata consigliata.
2. **Ciclo-2 (deciso S980)**: **#10 SMS_OTP** buildable code-only (mirror EMAIL_OTP + `ConsoleSmsSender`, CHECK kind ammette già SMS_OTP; attivazione PROD = provider+costo PM) · **#9 media object-store** = local-disk-default OK'd da Enzo (S3/MinIO config-swap) · **#11/#12/#13** = unblock-package (no fabbricazione dati).
3. **MFA login web**: cablare "use passkey" + il terzo stato login nella login page (accoppiato a #4).

## Open questions

- **#4 enrollment-flow**: token-limitato (claim `enr` JWT, accettato solo da enroll/verify-setup) vs token-store opaco — decidere all'implementazione.
- **#10 SMS_OTP**: provider + costo (PM) per l'attivazione PROD.
- **#9 media object-store**: confermato local-disk-default (Enzo S980); S3/MinIO = infra/costo PM se si vuole.
- **#11 cap⑤ 2ª sorgente** ISTAT/ATECO: sign-off ToS (legale). **#12 B-50 3 DEFER / #13 Wave-2**: bridge PM o Wave-2 con `position_id`.
- **linux-pc** nelle regole align/deploy (B-52) — come integrarlo (decisione Enzo).

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
curl -s -o /dev/null -w 'VM %{http_code}\n' http://80.225.82.207:8013/readyz
PGPASSWORD="$(grep -m1 localhost:5433 ~/.pgpass|cut -d: -f5)" psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "SELECT count(*) FROM sys.sys_auth_mfa_webauthn_credentials"  # tabella #5 esiste
```
