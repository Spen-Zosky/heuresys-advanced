# PROMPT 024 — CLI Batch X20 (MFA login-gating — compose mfaService into auth.login + /login UI 2-step)

**Goal ID**: 024 · **Slug**: `batch_x20_mfa_login_gating`
**Origin**: residual MVP-3 Tappa E (backend MFA + frontend TOTP enroll shipped X17 commit `a0d4545`, login-gating compose pending). Cowork C19 Enzo decision "voglio tutto e subito".
**Expected duration**: 2-3h CLI
**Predecessor**: HEAD origin/main `82a30a1` (post-X18 close).
**Scope**: compose `mfaService.beginLoginChallenge` in `auth.service.login()` flow + frontend `/login` UI 2-step (password → optional MFA challenge). Backend MFA service + TOTP enrollment già shipped; questo batch chiude Tappa E full scope.
**Out of scope**: refactor JWT, refactor RBAC, change MFA algorithm (TOTP RFC 6238 mantenuto), MFA recovery codes UI (separate batch).

---

## §0 — Identity + context

**Background MFA stato pre-X20** (verifica con grep):
- `apps/api/src/modules/auth/` — auth module shipped MVP-1 (Argon2id + JWT RS256 + CSRF double-submit, vedi CLAUDE.md project §Security model)
- `apps/api/src/modules/mfa/` — MFA backend service shipped X17 (mfaService.beginLoginChallenge, verifyChallenge, TOTP RFC 6238, recovery codes generate/verify)
- `apps/web/src/app/me/security/` — TOTP enrollment page UI shipped X17 Tappa E-UI commit `a0d4545`
- **PENDING**: `auth.service.login()` non compone `mfaService.beginLoginChallenge` — login completa sempre con JWT/cookies senza MFA gate
- **PENDING**: `apps/web/src/app/login/` UI è single-step (email+password), no MFA challenge UI

DB stato MFA tables (sys.sys_auth_mfa_*): verify presence + schema compatible con beginLoginChallenge.

---

## §1 — Pre-flight live-state

```bash
ssh -fN -L 5433:localhost:5432 oracle-vm-default
cd /d/heuresys-advanced
git log --oneline -3   # expected HEAD: 82a30a1 or descendant

# Auth module current state
ls apps/api/src/modules/auth/
grep -n 'function.*login\|export.*login' apps/api/src/modules/auth/service.ts 2>&1 | head -10

# MFA service state (verify shipped)
ls apps/api/src/modules/mfa/ 2>&1
grep -n 'beginLoginChallenge\|verifyChallenge' apps/api/src/modules/mfa/*.ts 2>&1 | head -10

# DB MFA tables
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "\dt sys.sys_auth_mfa*" 2>&1

# Frontend login UI
ls apps/web/src/app/login/
grep -n 'useState\|password\|email' apps/web/src/app/login/page.tsx 2>&1 | head -15

# Test baseline
cd apps/api && pnpm exec vitest run test/auth.integration.test.ts 2>&1 | tail -5
cd /d/heuresys-advanced
```

### HALT P0 conditions
| Trigger | Action |
|---|---|
| SSH tunnel down | HALT |
| `sys.sys_users < 433` | HALT R-A2 regression |
| HEAD ≠ descendant of `82a30a1` | HALT staleness |
| `mfa` module NOT present | HALT — backend MFA service è prerequisite, deve essere shipped X17 |
| MFA DB tables missing | HALT, escalate (migration mancante) |

---

## §2 — Block A: API — compose MFA in login flow

### A.1 — Read current login flow

```bash
cat apps/api/src/modules/auth/service.ts | grep -A 30 'function login\|async login'
```

Identify return type del `login()` corrente (probabilmente `{ accessToken, refreshToken, user }` o cookie-only response).

### A.2 — Compose mfaService.beginLoginChallenge

Edit `apps/api/src/modules/auth/service.ts` per aggiungere flow MFA-gated:

```typescript
// Pseudocode delta:
async function login(input: LoginInput): Promise<LoginResponse> {
  const user = await authRepository.findByEmail(input.email);
  if (!user) throw new UnauthorizedError('LOGIN_INVALID');

  const passwordValid = await argon2id.verify(user.password_hash, input.password);
  if (!passwordValid) throw new UnauthorizedError('LOGIN_INVALID');

  // NEW: check if user has MFA enabled
  const mfaState = await mfaService.getUserMfaState(user.id);
  if (mfaState.enabled && !input.mfaToken) {
    // First step complete, request MFA token
    const challenge = await mfaService.beginLoginChallenge(user.id);
    return {
      status: 'mfa_required',
      challengeId: challenge.id,
      expiresAt: challenge.expires_at,
    };
  }

  if (mfaState.enabled && input.mfaToken) {
    // Second step: verify MFA token
    const valid = await mfaService.verifyChallenge(input.challengeId!, input.mfaToken);
    if (!valid) throw new UnauthorizedError('MFA_INVALID');
  }

  // Complete login (JWT + cookies as before)
  return completeLogin(user);
}
```

Adapt to actual signatures. Use `withTransaction` pattern from `auth/repository.ts` per MFA verify + login completion atomic.

### A.3 — Update route schema + Zod

`apps/api/src/modules/auth/routes.ts` + `packages/shared/src/schemas/auth.ts`:
- LoginInput: add optional `challengeId?: string`, `mfaToken?: string`
- LoginResponse union: `{ status: 'success', user, ... }` | `{ status: 'mfa_required', challengeId, expiresAt }`

### A.4 — Integration tests

`apps/api/test/auth.integration.test.ts` (extend existing):
- Test login with no-MFA user → `status: 'success'`
- Test login with MFA-enabled user (step 1) → `status: 'mfa_required'` + challengeId
- Test login step 2 with valid TOTP → `status: 'success'`
- Test login step 2 with invalid TOTP → 401 `MFA_INVALID`
- Test login step 2 with expired challengeId → 401 + appropriate error code

```bash
cd apps/api && pnpm exec vitest run test/auth.integration.test.ts 2>&1 | tail -10
```

Acceptance: ≥4 new tests PASS + 0 regression existing.

---

## §3 — Block B: Frontend — /login UI 2-step

### B.1 — Update /login page

`apps/web/src/app/login/page.tsx`:
- Current: single form (email + password) → POST `/v1/auth/login` → redirect on 200
- New: handle 200 response with `status: 'mfa_required'` → show MFA token input → POST `/v1/auth/login` again with `challengeId + mfaToken`

Use `@heuresys/ui` primitives (Input, Button, Card, ecc.) per UI. NO new component duplication in apps/web — solo composition.

### B.2 — i18n keys

`apps/web/src/locales/it.json` + `en.json`:
- `login.mfa.title`: "Autenticazione a due fattori" / "Two-factor authentication"
- `login.mfa.prompt`: "Inserisci il codice dal tuo authenticator" / "Enter the code from your authenticator"
- `login.mfa.invalid`: "Codice MFA non valido o scaduto" / "Invalid or expired MFA code"
- `login.mfa.submit`: "Verifica" / "Verify"
- `login.mfa.expired`: "La sfida MFA è scaduta, riaccedi" / "MFA challenge expired, please log in again"

### B.3 — Playwright spec

`apps/web/tests/e2e/login-mfa.spec.ts` (new):
- Test no-MFA user login flow → dashboard redirect (regression baseline)
- Test MFA-enabled user (seed via DB hook o test admin con MFA pre-enrolled): step 1 password → step 2 MFA → success
- Test invalid MFA → error state visible + retry

Note: test data MFA-enabled user requires seed extension OR mock. Coordina con `db/seeds/seed_test_admin.ts` se necessario aggiungere test persona MFA-enabled.

---

## §4 — Block C: Build + verify

```bash
cd /d/heuresys-advanced
pnpm --filter @heuresys/api exec tsc --noEmit
pnpm --filter @heuresys/web exec tsc --noEmit
NEXT_PUBLIC_ENABLE_SHOWCASE=1 pnpm --filter @heuresys/web build 2>&1 | tail -10

# Playwright vs prod (existing spec + new login-mfa)
NEXT_PUBLIC_ENABLE_SHOWCASE=1 node apps/web/node_modules/next/dist/bin/next start apps/web -p 3000 &
sleep 30
pnpm --filter @heuresys/web exec playwright test 2>&1 | tee qa_artifacts/x20_playwright.txt | tail -15
```

Acceptance: typecheck PASS (0 errors), build PASS, Playwright auth + login-mfa specs PASS.

---

## §5 — Block D: REPORT + commit

```bash
git add packages/shared/src/schemas/auth.ts \
        apps/api/src/modules/auth/{service,routes}.ts \
        apps/api/test/auth.integration.test.ts \
        apps/web/src/app/login/page.tsx \
        apps/web/src/locales/{it,en}.json \
        apps/web/tests/e2e/login-mfa.spec.ts \
        qa_artifacts/x20_playwright.txt \
        cowork_code_exchange/_01_PROMPT_024_batch_x20_mfa_login_gating.md \
        cowork_code_exchange/_04_REPORT_024_batch_x20.md \
        cowork_reserved/HANDOFF_FRESH_SESSION.md

git commit -m "feat(auth): MVP-3 Tappa E full — MFA login-gating composed in auth.service.login + /login UI 2-step (TOTP RFC 6238)"
```

REPORT 024 sezioni §0-§9 standard.

---

## §6 — Halt + critical thinking

- HALT P0: API auth test regression > 0 (compromette security), build break frontend
- HALT P1: backend mfa service signatures non match prescription → escalate per signature alignment
- Critical thinking: se backend MFA shipped X17 ha API diversa da `beginLoginChallenge/verifyChallenge` (es. nome diverso), adatta + documenta in REPORT §6

---

## §7 — Out of scope X20

- Brownfield Wave 1 (PROMPT 023)
- DEFER-F /showcase fix (PROMPT 025)
- Dependabot CVE (PROMPT 026)
- MFA recovery codes flow UI (separate batch future)
- WebAuthn / hardware key (separate ADR)

---

## §8 — Reference

| Path | Purpose |
|---|---|
| `apps/api/src/modules/mfa/` | shipped X17 backend (verify API) |
| `apps/api/src/modules/auth/service.ts` | login() target compose |
| `apps/web/src/app/me/security/` | TOTP enroll page X17 (companion) |
| `CLAUDE.md` project §Security model | Argon2id + JWT RS256 + CSRF doctrine |
| `packages/shared/src/schemas/auth.ts` | Zod schema target update |

---

*End PROMPT 024 — closes MVP-3 Tappa E full scope.*
