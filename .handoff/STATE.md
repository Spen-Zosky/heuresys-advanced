# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-07-04 (S1014 — audit forense read-only + **remediation security live F-001…F-013**: **F-001 Critical CHIUSO** con rotazione credenziale live; CI 6/6 verde).

> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti. Menu generato da `docs/kb/tools/build_menu.py`.

## Last session brief (S1014)

Audit forense **read-only** (53 finding verificati, gate fp-check 4 TRUE POSITIVE) + **remediation security live F-001…F-013**. **F-001 Critical CHIUSO**: la password personas era un literal committato pubblico (~150 file + CLAUDE.md/README) → admin internet-facing prendibile da chiunque leggesse il repo. Fix: password env-driven fail-closed (helper `personas.ts`, literal rimosso da 139 test + Playwright + seed) + **rotazione live** di tutte le **11 login-personas**, verificata **prod + linux-pc** (vecchia `Admin#PassW0rd!`→401 / nuova→200). **Nuova password in `.secrets/test_admin_password.txt`** (gitignored — serve per login). F-002…F-013 deployate live (open-redirect, CSV-injection, CSRF exact-origin, dashboard N+1, error boundaries, nvm checksum, pnpm build-script allowlist). **CI 6/6 verde** (HEAD `bf7327e0`); VM + linux-pc allineati; secret CI provisionato sul runner. 2 regressioni CI colte+fixate (R2 personas non ruotate + `playwright.config` import.meta). **F-003/F-006 registrati** (D-51/D-52, refactor dedicati). Dettaglio, meccanica e counts → SOT_STATE Delta S1014.

## Top priorities (next session)

1. **pricing page** GTM (#4, ACTIVE — autorità *cosa* = Enzo: servono numeri prezzi/tier).
2. **#8 EMAIL** dormiente (WAIT-INPUT: app-password Outlook) → attiva EMAIL_OTP + digest in una mossa.

## Open questions (autorità *cosa* = Enzo)

- **F4 activity entities**: task model generico vs riuso goals/approvals (sblocca F4).
- **pricing**: numeri prezzi/tier per la pricing page GTM.

## Verification (next session)

```bash
git log origin/main..HEAD --oneline                                  # 0 (tutto pushato)
cd apps/api && pnpm exec vitest run test/csrf-origin.integration.test.ts test/csv-formula-injection.test.ts   # F-007/F-004 regression verdi
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://www.heuresys.com/api/v1/auth/login -H "content-type: application/json" -d '{"email":"admin@heuresys.com","password":"Admin#PassW0rd!"}'   # 401 = vecchia password ruotata (F-001 chiuso)
python docs/kb/tools/handoff_lint.py                                 # OK
```
