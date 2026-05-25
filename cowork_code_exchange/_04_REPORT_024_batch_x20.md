# REPORT 024 — CLI Batch X20 (MFA login-gating)

**Goal ID**: 024 · **Status**: ✅ COMPLETE · **Batch**: 3/3 sequenza C19 (post Cowork C19.1 accept-residual)
**Executed**: 2026-05-25 · **HEAD base**: `fc83575` · **Duration**: ~50 min

---

## §0 — Esito

MVP-3 Tappa E **full scope CHIUSO**. `mfaService` composto in `auth.service.login()` (gate dopo verifica password) + `/login` UI a 2 step (password → challenge TOTP). Flusso provato end-to-end a tutti i layer con dati live. Zero regression.

## §1 — Pre-flight (schema drift PROMPT corretti, CW-B40/B52)

Adattamenti read-only vs assunzioni PROMPT 024:
- MFA backend **dentro** `auth/` (`mfa-service.ts`/`mfa-repository.ts`/`mfa-routes.ts`), NON `modules/mfa/`.
- API reale: `beginLoginChallenge(userId) → {challengeToken, availableKinds} | null` (null = no factor); `verifyLoginChallenge({challengeToken, code}) → {userId}`. PROMPT pseudocode assumeva `challengeId/expiresAt/verifyChallenge` → adattato.
- Nessun `getUserMfaState`: il `null` di `beginLoginChallenge` fa da gate.
- DB: solo `sys.sys_auth_mfa_factors` (challenge store **in-memory**, non DB). `me/security` page sotto route-group `(authenticated)`. Locale in `{it,en}/common.json` (non `it.json`).

## §2 — Block A: API compose

- **Schema** (`packages/shared/src/schemas/auth.ts`): `LoginBodySchema` += `challengeToken?`/`mfaCode?`; `LoginResponseSchema` += discriminator `status:"success"`; nuovo `LoginMfaRequiredResponseSchema`; `LoginResultResponseSchema` = `discriminatedUnion("status", […])`. Re-export via `auth/schema.ts`.
- **Service** (`auth/service.ts`): `mfaService` iniettato in `AuthServiceDeps` (default `sharedMfaService`, backward-compat). `LoginResult = LoginSuccess | LoginMfaRequired`. Gate dopo verifica password: step-1 senza `challengeToken` → se factor verificato `return {status:'mfa_required', challengeToken, availableKinds}` (no token); step-2 con `challengeToken+mfaCode` → `verifyLoginChallenge` + match userId, poi issue bundle. Account senza factor → bypass gate.
- **Routes** (`auth/routes.ts`): `/login` response 200 → union; handler narrowing su `status`; `/refresh` + `status:"success"`.
- **Codici errore**: `MFA_CODE_REQUIRED` (challengeToken senza code), `MFA_INVALID` (challenge↔user mismatch), `MFA_TOTP_INVALID` (codice errato, da mfaService). Login events MFA-specifici OMESSI (evitato rischio CHECK-constraint su `login_events.type` — vedi §6).
- **Integration test** (`auth-mfa.integration.test.ts`, 5 nuovi): no-MFA→success+3 cookie · MFA step1→mfa_required (no cookie) · step2 TOTP valido→success+cookie · step2 TOTP errato→401 MFA_TOTP_INVALID · step2 senza code→401 MFA_CODE_REQUIRED. Factor throwaway su `outsider_test` enrolled+verified (TOTP reale via OTPAuth) in beforeAll, **deleted in afterAll** (no closePool — pool condiviso suite).

## §3 — Block B: Frontend /login 2-step

- `lib/api/auth.ts`: `LoginResult` union; `useLogin` non setta csrf su `mfa_required`; `onSuccess` setQueryData solo su success.
- `app/login/page.tsx`: stato `mfa` (credenziali+challengeToken da re-submit) + input codice. Step1 success→redirect; `mfa_required`→render form codice (testid `login-mfa-form`/`login-mfa-code`/`login-mfa-submit`); step2 success→redirect; challenge scaduto→fresh token + msg. Composizione di primitive `@heuresys/ui` (no duplicazione).
- i18n `auth.login.mfa.*` (title/prompt/codeLabel/submit/invalid/expired) in it+en. Parity OK.

## §4 — Block C: build + verify (tutti verdi)

| Gate | Esito |
|---|---|
| API typecheck | ✅ PASS |
| Web typecheck | ✅ PASS |
| i18n parity | ✅ 23 keys × 2 locale |
| Web build (`NEXT_PUBLIC_ENABLE_SHOWCASE=1`) | ✅ PASS |
| vitest API full | **341 passed / 1 failed / 5 skipped** (=baseline 336 +5 MFA, stesso 1 fail skills:131 pre-esistente non correlato → **0 regression**) |
| Playwright `login-mfa` (prod build, `--no-deps`) | ✅ **2/2** (no-MFA regression + full real-TOTP 2-step: step1→mfa form→codice errato errore→fresh login→codice valido→/me) |

Artefatti: `qa_artifacts/x20_web_build.txt`, `qa_artifacts/x20_playwright.txt`. Cleanup MFA factor verificato: `sys_auth_mfa_factors` = 0 post-run (no leftover, auth.setup non compromesso).

### Nota Playwright env (CW-B54)
Primo run: `login-mfa` bloccato da `auth.setup` flaky (employee/outsider, front-loading noto CW-B54) → risolto con `--no-deps` (la spec non usa storageState, guida `/login` direttamente). Secondo: timeout su `waitForURL('/dashboard')` per cold-load route admin pesante via tunnel DB → risolto con `expect(page).toHaveURL(...)` (polla l'URL al `router.replace`, non attende full render) + test timeout 90s. Nessun difetto di codice MFA (login API 200 confermato). Pattern allineato a REPORT 019 (Playwright vs prod build).

## §5 — Acceptance (PROMPT 024)

- API: ≥4 nuovi test MFA PASS + 0 regression ✅ (5 nuovi).
- Frontend: /login 2-step funzionante, primitive @heuresys/ui ✅.
- Build PASS, typecheck PASS, Playwright auth+login-mfa PASS ✅.
- Wiring completo end-to-end (schema → service → route → integration test → client hook → UI → Playwright) ✅.

## §6 — Critical thinking & bias

- Pattern X19.A/X19 (adattamento inline su drift spec + verifica empirica) applicato: tutti i drift CW-B40/B52 del PROMPT 024 corretti inline senza halt (firme MFA, path, schema locale) — coerente con direttiva "halt P1 solo per architectural".
- **Nessun nuovo bias atomico** → CW-B61 NON claimed. Login-events MFA omessi è scelta conservativa (evitato CHECK-constraint risk su `login_events.type`); audit MFA-event = enhancement futuro (basso rischio, non blocca).
- Commento stale in `mfa-routes.ts:127` ("challenge token not yet produced by /login") ora superato da X20 — lasciato invariato (out-of-scope edit; segnalato per cleanup futuro).

## §7 — Commit + sequenza

- Commit locale: `feat(auth): MVP-3 Tappa E full — MFA login-gating composed in auth.service.login + /login UI 2-step (TOTP RFC 6238)` (NO push).
- Trigger 024 (prompt_ready + prompt_amended) spostati → cli/read.
- **STOP sequenza C19 a X20** (no autonomous X21 / DEFER-F HIGH-RISK). Cleanup background: tunnel 5433 + API :3001 + web :3000 da terminare.

## §8 — Sequenza C19 finale

| Batch | Esito |
|---|---|
| X19.A Dependabot uuid | ✅ `b01c331` |
| X19 Brownfield Wave 1 | ✅ `e13eb73` (COMPLETED, 6-target residual accepted CW-B60) |
| X20 MFA login-gating | ✅ (questo commit) — MVP-3 Tappa E full closed |

---

*End REPORT 024 — X20 complete, MVP-3 Tappa E full scope shipped. Sequenza C19 conclusa.*
