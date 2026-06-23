# Authentication & Authorization Security Plan
## Heuresys Advanced — Auth Foundation Design

> **Status:** Planning deliverable #8 of 10.
> **Scope:** the 11 auth tables (`sys.sys_auth_*` + `sys.sys_user_auth_roles`), password hashing, token model, cookie/CSRF defenses, refresh rotation + replay detection, role matrix, permission catalog, audit logging, MFA foundation, tenant isolation.
> **Sources:** `AUTH_STACK_SPEC.md`, `AUTH_POLICY_MATRIX.md`, `SECURITY_AND_PRIVACY_BOUNDARIES.md`, ADR‑0005, ADR‑0006.

---

## 1. Threat Model

The admin platform faces:

| Threat | Mitigation |
|--------|------------|
| Credential stuffing / brute force | Argon2id (slow by design) + per‑IP + per‑user rate limit on `/auth/login` and `/auth/password-reset` |
| Offline hash cracking (DB compromise) | Argon2id memory‑hardness; salts per credential; never log hashes |
| XSS exfiltrating session token | JWT in `HttpOnly` cookie — JS cannot read |
| CSRF on state‑changing endpoints | Double‑submit cookie + `SameSite=Lax`/`Strict` + Origin check |
| Stolen refresh token replay | Single‑use rotation + family invalidation on replay detection |
| Compromised session not invalidated on logout | Refresh family revocation on logout; 15‑min access TTL caps worst‑case window |
| Privilege escalation via tampered JWT | RS256 (asymmetric); private key never on client; signature verified per request |
| Tenant boundary violation | JWT carries `tenantId`; middleware injects into every query; **no RLS** (per I5) |
| Sensitive data in logs | Pino redaction list (`req.headers.cookie`, `req.body.password`, hashes) |
| MFA bypass | MFA schema present; enforcement post‑MVP; design prevents skip when enabled |
| Insecure password reset | Opaque token (32 bytes), hashed in DB, 15‑min TTL, single use, IP/UA logged |

---

## 2. Auth Tables — Full DDL Outline (Migration 000005)

All tables in `sys` schema. FKs to `sys.sys_users` and `sys.sys_tenancies`. Idempotent via `IF NOT EXISTS`.

### 2.1 `sys.sys_auth_identities`

The auth identity layer separates "who you are" (user) from "how you authenticate" (identity provider).

```sql
CREATE TABLE IF NOT EXISTS sys.sys_auth_identities (
  auth_identity_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_identity_user_id       uuid NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  auth_identity_provider      varchar(32) NOT NULL DEFAULT 'LOCAL',   -- LOCAL | SSO_OIDC | SSO_SAML (future)
  auth_identity_provider_subject varchar(255),                         -- external sub for SSO; NULL for LOCAL
  auth_identity_email_verified  boolean NOT NULL DEFAULT false,
  auth_identity_is_active     boolean NOT NULL DEFAULT true,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_auth_identities_user_provider_uq
  ON sys.sys_auth_identities(auth_identity_user_id, auth_identity_provider);
CREATE UNIQUE INDEX IF NOT EXISTS sys_auth_identities_provider_subject_uq
  ON sys.sys_auth_identities(auth_identity_provider, auth_identity_provider_subject)
  WHERE auth_identity_provider_subject IS NOT NULL;
```

### 2.2 `sys.sys_auth_credentials`

Hash storage. Multiple records per identity allow rotation (old hash kept until new one verified).

```sql
CREATE TABLE IF NOT EXISTS sys.sys_auth_credentials (
  auth_credential_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_credential_identity_id uuid NOT NULL REFERENCES sys.sys_auth_identities(auth_identity_id) ON DELETE CASCADE,
  auth_credential_algorithm   varchar(32) NOT NULL DEFAULT 'ARGON2ID',
  auth_credential_hash        text NOT NULL,                            -- full encoded: $argon2id$v=19$m=65536,t=3,p=4$salt$hash
  auth_credential_is_current  boolean NOT NULL DEFAULT true,
  auth_credential_must_rotate boolean NOT NULL DEFAULT false,           -- forces rotation at next login
  created_at                  timestamptz NOT NULL DEFAULT now(),
  rotated_at                  timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_auth_credentials_one_current_per_identity
  ON sys.sys_auth_credentials(auth_credential_identity_id)
  WHERE auth_credential_is_current = true;
```

Partial unique index: at most one current credential per identity.

### 2.3 `sys.sys_auth_sessions` (optional — placeholder for SSO/server sessions)

```sql
CREATE TABLE IF NOT EXISTS sys.sys_auth_sessions (
  auth_session_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_session_user_id uuid NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  auth_session_tenant_id uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  auth_session_ip     inet,
  auth_session_user_agent text,
  auth_session_revoked_at timestamptz,
  auth_session_expires_at timestamptz NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sys_auth_sessions_user_active
  ON sys.sys_auth_sessions(auth_session_user_id)
  WHERE auth_session_revoked_at IS NULL;
```

MVP does **not** use server sessions for the JWT flow; this table is reserved for future SSO/server‑session strategies and is not on the hot path.

### 2.4 `sys.sys_auth_refresh_tokens` — **the rotation core**

```sql
CREATE TABLE IF NOT EXISTS sys.sys_auth_refresh_tokens (
  auth_refresh_token_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_refresh_token_user_id      uuid NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  auth_refresh_token_tenant_id    uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  auth_refresh_token_family_id    uuid NOT NULL,                       -- rotation chain id
  auth_refresh_token_previous_id  uuid REFERENCES sys.sys_auth_refresh_tokens(auth_refresh_token_id) ON DELETE SET NULL,
  auth_refresh_token_hash         char(64) NOT NULL,                   -- SHA-256 of opaque 32-byte secret
  auth_refresh_token_issued_at    timestamptz NOT NULL DEFAULT now(),
  auth_refresh_token_expires_at   timestamptz NOT NULL,
  auth_refresh_token_used_at      timestamptz,                          -- non-NULL = already rotated (replay window opens)
  auth_refresh_token_revoked_at   timestamptz,                          -- explicit revoke (logout, admin action, family invalidation)
  auth_refresh_token_revoke_reason varchar(64),
  auth_refresh_token_ip           inet,
  auth_refresh_token_user_agent   text
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_auth_refresh_tokens_hash_uq ON sys.sys_auth_refresh_tokens(auth_refresh_token_hash);
CREATE INDEX IF NOT EXISTS sys_auth_refresh_tokens_user_family_idx ON sys.sys_auth_refresh_tokens(auth_refresh_token_user_id, auth_refresh_token_family_id);
CREATE INDEX IF NOT EXISTS sys_auth_refresh_tokens_active_idx
  ON sys.sys_auth_refresh_tokens(auth_refresh_token_user_id)
  WHERE auth_refresh_token_used_at IS NULL AND auth_refresh_token_revoked_at IS NULL;
```

- `auth_refresh_token_family_id` ties all rotations originating from one login session.
- `auth_refresh_token_previous_id` chains parent → child for forensics.
- `auth_refresh_token_hash` stores SHA‑256 of the opaque token; the secret never lives in DB plaintext.
- A token is **valid** only when `used_at IS NULL AND revoked_at IS NULL AND expires_at > now()`.

### 2.5 `sys.sys_auth_login_events`

```sql
CREATE TABLE IF NOT EXISTS sys.sys_auth_login_events (
  auth_login_event_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_login_event_user_id  uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,   -- NULL on failed login (user not resolved)
  auth_login_event_tenant_id uuid REFERENCES sys.sys_tenancies(tenant_id) ON DELETE SET NULL,
  auth_login_event_type     varchar(64) NOT NULL,    -- LOGIN_SUCCESS | LOGIN_FAILED | LOGOUT | REFRESH_OK | REFRESH_REPLAY_DETECTED | REFRESH_EXPIRED | PASSWORD_RESET_REQUESTED | PASSWORD_RESET_COMPLETED | REVOKED_BY_ADMIN | MFA_FAIL | MFA_OK | ACCOUNT_LOCKED
  auth_login_event_ip       inet,
  auth_login_event_user_agent text,
  auth_login_event_details  jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sys_auth_login_events_user_idx ON sys.sys_auth_login_events(auth_login_event_user_id, created_at);
CREATE INDEX IF NOT EXISTS sys_auth_login_events_type_idx ON sys.sys_auth_login_events(auth_login_event_type, created_at);
```

Every auth state change is recorded. Used by Fastify middleware and by post‑hoc forensics.

### 2.6 `sys.sys_auth_password_reset_tokens`

```sql
CREATE TABLE IF NOT EXISTS sys.sys_auth_password_reset_tokens (
  auth_password_reset_token_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_password_reset_user_id    uuid NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  auth_password_reset_token_hash char(64) NOT NULL,                    -- SHA-256 of opaque token sent by email
  auth_password_reset_expires_at timestamptz NOT NULL,                  -- typically now() + 15 minutes
  auth_password_reset_used_at    timestamptz,                            -- single use
  auth_password_reset_requester_ip inet,
  created_at                     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_auth_password_reset_token_hash_uq ON sys.sys_auth_password_reset_tokens(auth_password_reset_token_hash);
CREATE INDEX IF NOT EXISTS sys_auth_password_reset_user_active_idx
  ON sys.sys_auth_password_reset_tokens(auth_password_reset_user_id)
  WHERE auth_password_reset_used_at IS NULL;
```

### 2.7 `sys.sys_auth_mfa_factors` (foundation; enforcement post‑MVP)

```sql
CREATE TABLE IF NOT EXISTS sys.sys_auth_mfa_factors (
  auth_mfa_factor_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_mfa_factor_user_id   uuid NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  auth_mfa_factor_kind      varchar(32) NOT NULL,    -- TOTP | WEBAUTHN | EMAIL_OTP | SMS_OTP (future)
  auth_mfa_factor_secret    text,                     -- encrypted; never plain
  auth_mfa_factor_metadata  jsonb NOT NULL DEFAULT '{}'::jsonb,
  auth_mfa_factor_verified  boolean NOT NULL DEFAULT false,
  auth_mfa_factor_last_used_at timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sys_auth_mfa_factors_user_idx ON sys.sys_auth_mfa_factors(auth_mfa_factor_user_id);
```

### 2.8 `sys.sys_auth_roles`

```sql
CREATE TABLE IF NOT EXISTS sys.sys_auth_roles (
  auth_role_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_role_code         varchar(64) NOT NULL,
  auth_role_name         varchar(128) NOT NULL,
  auth_role_description  text,
  auth_role_is_platform  boolean NOT NULL DEFAULT false,   -- PLATFORM_ADMIN is platform-wide; others tenant-scoped
  created_at             timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_auth_roles_code_uq ON sys.sys_auth_roles(auth_role_code);

-- Bootstrap seed (8 canonical roles)
INSERT INTO sys.sys_auth_roles (auth_role_code, auth_role_name, auth_role_description, auth_role_is_platform) VALUES
  ('PLATFORM_ADMIN',    'Platform Administrator',  'Cross-tenant administration of the platform itself.', true),
  ('TENANT_ADMIN',      'Tenant Administrator',    'Full administration within a single tenant.',         false),
  ('BLUEPRINT_MANAGER', 'Blueprint Manager',       'Manages enterprise typing and blueprint activation.', false),
  ('HRMS_MANAGER',      'HRMS Manager',            'Manages positions, skills, KPIs, learning, gaps.',    false),
  ('PROCESS_OWNER',     'Process Owner',           'Owns specific BPM processes.',                        false),
  ('MANAGER',           'Line Manager',            'Manages a team / set of positions.',                  false),
  ('USER',              'Standard User',           'Authenticated user with self-service access.',        false),
  ('READ_ONLY',         'Read-Only Observer',      'Read-only access to in-scope resources.',             false)
ON CONFLICT (auth_role_code) DO NOTHING;
```

### 2.9 `sys.sys_auth_permissions`

```sql
CREATE TABLE IF NOT EXISTS sys.sys_auth_permissions (
  auth_permission_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_permission_code  varchar(128) NOT NULL,    -- e.g. 'position:create', 'tenant:read', 'seed:approve'
  auth_permission_name  varchar(128) NOT NULL,
  auth_permission_resource varchar(64) NOT NULL,
  auth_permission_action varchar(32) NOT NULL,
  auth_permission_description text,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_auth_permissions_code_uq ON sys.sys_auth_permissions(auth_permission_code);
```

Seed (≈ 100 permissions (≈ 81 admin incl. `auth:revoke_user` + 19 ESS `*:self` per ADR‑0011)) — pattern `<resource>:<action>`:

```text
Resources (22):
  tenant, user, user_profile, user_position_assignment,
  enterprise_typing, blueprint, bpm_process, organization_unit,
  position, job_role, skill, kpi, learning, training_initiative,
  assessment, gap_analysis, career_succession, compensation_intelligence,
  visualization, seed_acquisition, brownfield_adaptation, role

Actions: read, list, create, update, delete, approve (where applicable)
```

### 2.10 `sys.sys_auth_role_permissions`

```sql
CREATE TABLE IF NOT EXISTS sys.sys_auth_role_permissions (
  auth_role_id        uuid NOT NULL REFERENCES sys.sys_auth_roles(auth_role_id) ON DELETE CASCADE,
  auth_permission_id  uuid NOT NULL REFERENCES sys.sys_auth_permissions(auth_permission_id) ON DELETE CASCADE,
  granted_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (auth_role_id, auth_permission_id)
);
```

Seed mapping is defined in §6 (Role × Permission matrix).

### 2.11 `sys.sys_user_auth_roles`

```sql
CREATE TABLE IF NOT EXISTS sys.sys_user_auth_roles (
  user_auth_role_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_auth_role_user_id      uuid NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  user_auth_role_role_id      uuid NOT NULL REFERENCES sys.sys_auth_roles(auth_role_id) ON DELETE CASCADE,
  user_auth_role_tenant_id    uuid REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,  -- NULL for platform roles
  user_auth_role_granted_by   uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  user_auth_role_granted_at   timestamptz NOT NULL DEFAULT now(),
  user_auth_role_revoked_at   timestamptz
);
CREATE INDEX IF NOT EXISTS sys_user_auth_roles_user_idx ON sys.sys_user_auth_roles(user_auth_role_user_id);
CREATE INDEX IF NOT EXISTS sys_user_auth_roles_role_idx ON sys.sys_user_auth_roles(user_auth_role_role_id);
CREATE UNIQUE INDEX IF NOT EXISTS sys_user_auth_roles_active_uq
  ON sys.sys_user_auth_roles(user_auth_role_user_id, user_auth_role_role_id, COALESCE(user_auth_role_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE user_auth_role_revoked_at IS NULL;
```

A user can hold:
- 0..1 platform role (PLATFORM_ADMIN) — `user_auth_role_tenant_id IS NULL`.
- 1..N tenant‑scoped roles — `user_auth_role_tenant_id = <tenant>`.

---

## 3. Password Hashing (Argon2id) — Implementation

Per ADR‑0005:

```ts
// apps/api/src/modules/auth/service/password.ts
import argon2 from "argon2";

export const ARGON2_PARAMS = {
  type: argon2.argon2id,
  memoryCost: 65536,        // 64 MiB
  timeCost: 3,              // 3 iterations
  parallelism: 4,           // 4 lanes
  hashLength: 32,           // 32-byte output
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_PARAMS);
}

export async function verifyPassword(stored: string, input: string): Promise<{
  ok: boolean;
  needsRehash: boolean;
}> {
  const ok = await argon2.verify(stored, input);
  const needsRehash = ok && argon2.needsRehash(stored, ARGON2_PARAMS);
  return { ok, needsRehash };
}
```

Rules enforced:

1. Password hashing only happens in the `auth/service/password.ts` module.
2. Routes never see the plain password after the validation step.
3. On successful login, if `needsRehash` returns true, re‑hash with current params and upsert into `sys.sys_auth_credentials` (mark old `is_current = false`).
4. No plain password is ever logged. Pino is configured with redaction:

```ts
pino({
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'req.body.password',
      'req.body.newPassword',
      'req.body.confirmPassword',
      'res.body.token',
      'res.body.refreshToken',
      '*.password',
      '*.hash',
      '*.secret',
    ],
    censor: '[REDACTED]',
  },
});
```

5. Password complexity policy (enforced in Zod schema, not in DB):

```ts
z.string().min(12).max(128).refine(p =>
  /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p),
  "Password must contain upper, lower, digit, symbol");
```

---

## 4. Token Model — JWT + Refresh

### 4.1 Access JWT

- **Algorithm:** RS256 (asymmetric).
- **TTL:** 15 minutes.
- **Claims:**

```jsonc
{
  "sub": "<user_id uuid>",
  "tenant_id": "<tenant_id uuid>",   // NULL for PLATFORM_ADMIN platform-wide endpoints
  "roles": ["TENANT_ADMIN", "HRMS_MANAGER"],
  "iat": 1735689600,
  "exp": 1735690500,
  "iss": "heuresys-advanced",
  "aud": "heuresys-advanced-api",
  "jti": "<uuid>"
}
```

- **Private key:** stored in `.env` (`JWT_PRIVATE_KEY` as PEM block). In production, rotated via `JWT_PRIVATE_KEY_PREVIOUS` + grace period.
- **Public key:** published at `GET /.well-known/jwks.json` (future‑ready for federated verifiers).
- **Verification:** Fastify `@fastify/jwt` plugin validates signature, expiration, audience, issuer.

### 4.2 Refresh token

- **Format:** opaque 32‑byte random (base64url).
- **TTL:** 30 days.
- **Storage:** SHA‑256 hash in `sys.sys_auth_refresh_tokens.auth_refresh_token_hash`.
- **Rotation:** every successful `/auth/refresh` invalidates the presented token (sets `used_at = now()`) and issues a new one with same `family_id`, `previous_id = current.id`.
- **Replay detection:** if a presented refresh token has `used_at IS NOT NULL`:
  1. Invalidate the entire family (`UPDATE sys.sys_auth_refresh_tokens SET revoked_at = now(), revoke_reason = 'REPLAY_DETECTED' WHERE family_id = :fam`).
  2. Log `REFRESH_REPLAY_DETECTED` event.
  3. Return 401 with no new token; client must re‑authenticate.

### 4.3 Cookie configuration

Two cookies per session:

```ts
// Access JWT cookie
reply.setCookie('hrx_access', accessJwt, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 15,   // 15 min
});

// Refresh token cookie. ERRATA D-26 (2026-06-13, S986): path MUST be "/",
// NOT the API route prefix "/v1/auth" as originally planned. The browser
// only reaches the API through prefix-stripping proxies (Next rewrite
// `/api/:path*` → `/:path*` in dev; nginx → next → same rewrite in PROD),
// so a cookie scoped to the API-side prefix never matches the
// browser-visible URL `/api/v1/auth/refresh`: the silent refresh could
// never fire and every session died at the 15-min access TTL.
// Compensating controls for the wider scope: HttpOnly + Secure +
// SameSite=Lax, TLS end-to-end, pino cookie redaction, single-use rotation
// with family-revoking replay detection, CSRF double-submit on /refresh.
reply.setCookie('hrx_refresh', refreshTokenOpaque, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 24 * 30,   // 30 days
});

// CSRF token (non-HttpOnly so JS can read it)
reply.setCookie('hrx_csrf', csrfToken, {
  httpOnly: false,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 24,   // 24 hours
});
```

- `HttpOnly` on auth cookies — JS cannot read them, mitigates XSS exfiltration.
- `Secure` in production — HTTPS only.
- `SameSite=Lax` for the admin app — cross‑site POSTs blocked, top‑level GET navigations allowed (so deep‑link to `/dashboard` works).
- `Path=/auth` for the refresh cookie — sent only to `/auth/refresh` and `/auth/logout`, not to every request.

### 4.4 Stateless validation flow

```text
Client request
  │
  ▼
Fastify middleware: extract `hrx_access` cookie
  │
  ▼
@fastify/jwt verify (signature + exp + aud + iss)
  │
  ├─ INVALID/EXPIRED → 401 + WWW-Authenticate hint to refresh
  │
  └─ VALID → request.user = { userId, tenantId, roles, jti }
                │
                ▼
              RBAC middleware (per-route required permissions)
                │
                ▼
              Repository layer (every query filters by request.user.tenantId)
```

### 4.5 Refresh flow

```text
Client POST /auth/refresh (sends hrx_refresh cookie + X-CSRF-Token header)
  │
  ▼
1. Validate CSRF header == hrx_csrf cookie     (rejects cross-site)
  │
  ▼
2. Hash the presented refresh token (SHA-256)
  │
  ▼
3. SELECT FROM sys.sys_auth_refresh_tokens WHERE hash = :hash
  │
  ├─ NOT FOUND → 401 (token unknown)
  │
  ├─ FOUND but used_at IS NOT NULL → REPLAY DETECTED:
  │     UPDATE sys.sys_auth_refresh_tokens SET revoked_at = now(), revoke_reason = 'REPLAY_DETECTED' WHERE family_id = :fam;
  │     INSERT into sys.sys_auth_login_events (event_type = 'REFRESH_REPLAY_DETECTED');
  │     reply.clearCookie('hrx_access'); reply.clearCookie('hrx_refresh');
  │     return 401;
  │
  ├─ FOUND, valid, but revoked_at IS NOT NULL OR expires_at < now() → 401
  │
  └─ FOUND, valid, fresh →
        UPDATE sys.sys_auth_refresh_tokens SET used_at = now() WHERE id = :id;
        Generate new opaque refresh token (32 bytes random);
        INSERT new row with previous_id = :current_id, family_id = :fam;
        Issue new access JWT;
        Set hrx_access + hrx_refresh + rotate hrx_csrf;
        INSERT into sys.sys_auth_login_events (event_type = 'REFRESH_OK');
        return 200 + { user, roles };
```

### 4.6 Logout flow

```text
Client POST /auth/logout (with X-CSRF-Token header)
  │
  ▼
1. Validate CSRF.
2. UPDATE sys.sys_auth_refresh_tokens SET revoked_at = now(), revoke_reason = 'LOGOUT' WHERE family_id = :fam AND revoked_at IS NULL;
3. reply.clearCookie('hrx_access'); reply.clearCookie('hrx_refresh'); reply.clearCookie('hrx_csrf');
4. INSERT into sys.sys_auth_login_events (event_type = 'LOGOUT');
5. return 204.
```

### 4.7 Admin revocation

`POST /auth/admin/revoke-user/{userId}` (requires `user:admin` permission):

```sql
UPDATE sys.sys_auth_refresh_tokens
   SET revoked_at = now(), revoke_reason = 'REVOKED_BY_ADMIN'
WHERE auth_refresh_token_user_id = :userId
  AND revoked_at IS NULL;
```

Worst case: the user has at most 15 minutes (current access JWT TTL) before fully locked out.

---

## 5. CSRF Protection — Double‑Submit Cookie

### 5.1 Token generation

On login:

```ts
const csrfToken = crypto.randomBytes(32).toString('base64url');
// Stored in 'hrx_csrf' cookie (non-HttpOnly) + returned in login response body for SPA to grab immediately
```

### 5.2 Verification middleware

```ts
async function csrfMiddleware(req, reply) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;   // exempt safe methods

  const cookieCsrf = req.cookies.hrx_csrf;
  const headerCsrf = req.headers['x-csrf-token'];

  if (!cookieCsrf || !headerCsrf || cookieCsrf !== headerCsrf) {
    reply.code(403).send({ error: { code: 'CSRF_FAIL', message: 'CSRF token missing or mismatched.' } });
    return reply;
  }

  // Origin check (second line of defence)
  const origin = req.headers.origin || req.headers.referer;
  if (origin && !origin.startsWith(process.env.ADMIN_ORIGIN!)) {
    reply.code(403).send({ error: { code: 'ORIGIN_MISMATCH', message: 'Request origin not allowed.' } });
    return reply;
  }
}
```

### 5.3 Token rotation

The CSRF token rotates on:

- Login (new token).
- Refresh (new token in the same response that rotates JWT/refresh).
- Privilege escalation (when admin grants role).

Multi‑tab clients use a `BroadcastChannel` listener to receive new tokens and update their in‑memory copy:

```ts
// apps/web/src/lib/auth/csrf.ts
const channel = new BroadcastChannel('hrx_csrf_rotation');
channel.addEventListener('message', (event) => {
  if (event.data?.type === 'CSRF_ROTATED') {
    csrfTokenStore.set(event.data.token);
  }
});
```

---

## 6. Role × Permission Matrix

8 canonical roles × ≈ 100 permissions (≈ 81 admin incl. `auth:revoke_user` + 19 ESS `*:self` per ADR‑0011). Below the curated grid (✔ = granted; • = granted only on own/team resource via additional scope filter; — = not granted).

| Resource:Action | PLATFORM_ADMIN | TENANT_ADMIN | BLUEPRINT_MANAGER | HRMS_MANAGER | PROCESS_OWNER | MANAGER | USER | READ_ONLY |
|------------------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| tenant:create | ✔ | — | — | — | — | — | — | — |
| tenant:read | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ (own) | ✔ |
| tenant:update | ✔ | ✔ | — | — | — | — | — | — |
| tenant:delete | ✔ | — | — | — | — | — | — | — |
| user:create | ✔ | ✔ | — | — | — | — | — | — |
| user:read | ✔ | ✔ | ✔ | ✔ | ✔ (team) | ✔ (team) | ✔ (self) | ✔ |
| user:update | ✔ | ✔ | — | — | — | • (team) | • (self) | — |
| user:delete | ✔ | ✔ | — | — | — | — | — | — |
| user_profile:read | ✔ | ✔ | — | ✔ | • | • | ✔ (self) | ✔ |
| user_profile:update | ✔ | ✔ | — | — | — | • | • (self) | — |
| user_position_assignment:create | ✔ | ✔ | — | ✔ | — | • (team) | — | — |
| user_position_assignment:read | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ (team) | ✔ (self) | ✔ |
| user_position_assignment:update | ✔ | ✔ | — | ✔ | — | • | — | — |
| user_position_assignment:delete | ✔ | ✔ | — | ✔ | — | — | — | — |
| enterprise_typing:create | ✔ | ✔ | ✔ | — | — | — | — | — |
| enterprise_typing:update | ✔ | ✔ | ✔ | — | — | — | — | — |
| enterprise_typing:read | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| blueprint:read | ✔ | ✔ | ✔ | ✔ | ✔ (own process) | ✔ | ✔ | ✔ |
| blueprint:activate | ✔ | ✔ | ✔ | — | — | — | — | — |
| bpm_process:read | ✔ | ✔ | ✔ | ✔ | ✔ (own) | ✔ | ✔ | ✔ |
| bpm_process:update | ✔ | ✔ | ✔ | — | ✔ (own) | — | — | — |
| organization_unit:create | ✔ | ✔ | — | ✔ | — | — | — | — |
| organization_unit:read | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| organization_unit:update | ✔ | ✔ | — | ✔ | — | • (own unit) | — | — |
| position:create | ✔ | ✔ | — | ✔ | — | — | — | — |
| position:read | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| position:update | ✔ | ✔ | — | ✔ | — | • (owned) | — | — |
| position:delete | ✔ | ✔ | — | ✔ | — | — | — | — |
| job_role:read | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| job_role:create/update | ✔ | ✔ | — | ✔ | — | — | — | — |
| skill:read | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| skill:create/update | ✔ | ✔ | — | ✔ | — | — | — | — |
| kpi:read | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ (own) | ✔ |
| kpi:create/update | ✔ | ✔ | — | ✔ | • (process) | — | — | — |
| learning:read | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| learning:create/update | ✔ | ✔ | — | ✔ | — | — | — | — |
| training_initiative:create | ✔ | ✔ | — | ✔ | — | — | — | — |
| training_initiative:read | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| assessment:create | ✔ | ✔ | — | ✔ | — | • (team) | — | — |
| assessment:read | ✔ | ✔ | — | ✔ | — | ✔ (team) | ✔ (self) | ✔ |
| gap_analysis:read | ✔ | ✔ | — | ✔ | — | • (team) | • (self) | ✔ |
| career_succession:read | ✔ | ✔ | — | ✔ | — | • (team) | • (self) | ✔ |
| career_succession:update | ✔ | ✔ | — | ✔ | — | — | — | — |
| compensation_intelligence:read | ✔ | ✔ | — | ✔ (restricted) | — | — | — | — |
| compensation_intelligence:update | ✔ | ✔ | — | — | — | — | — | — |
| visualization:read | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| visualization:update_layout | ✔ | ✔ | ✔ | ✔ | • | • | — | — |
| seed_acquisition:trigger | ✔ | ✔ | — | — | — | — | — | — |
| seed_acquisition:approve | ✔ | ✔ | — | — | — | — | — | — |
| brownfield_adaptation:trigger | ✔ | ✔ | — | — | — | — | — | — |
| brownfield_adaptation:approve | ✔ | — | — | — | — | — | — | — |
| role:read | ✔ | ✔ | — | — | — | — | — | — |
| role:create/update | ✔ | — | — | — | — | — | — | — |
| role:assign | ✔ | ✔ | — | — | — | — | — | — |
| auth:revoke_user | ✔ | ✔ (own tenant) | — | — | — | — | — | — |

**Scope filters** (`•` rows) are enforced in the repository layer, not by another permission. The middleware grants the permission only when:

- The acting user owns the resource (`position_owner_user_id = req.user.userId`).
- The acting user is the line manager of the target user (via `sys.sys_user_position_assignments` + `sys.sys_positions.position_reports_to_position_id`).
- The acting user is the target user (`self`).

The seed of `sys.sys_auth_role_permissions` is generated from this matrix (one row per ✔ pair). `•` rows generate the same permission row, with the scope filter enforced at the repository call site.

### 6.1 Employee Self‑Service Portal — `self`‑scope permissions (MVP‑2b)

The ESS routes under `/v1/me/*` and the corresponding frontend route group `(ess)` require a dedicated set of permissions with **hard‑coded self scope**: the API never reads `userId` from the URL; it always uses `req.user.userId`. ESLint rule `no-untenanted-or-cross-user-self-route` flags any `/v1/me/*` handler that references a userId other than `req.user.userId`.

| ESS permission | Granted to | Action behind it |
|----------------|------------|------------------|
| `user_profile:read:self` | USER, READ_ONLY (own only) | `GET /v1/me/profile` |
| `user_profile:update:self` | USER | `PATCH /v1/me/profile` (display_name, locale, timezone, contact prefs only) |
| `user_position_assignment:read:self` | USER, READ_ONLY | `GET /v1/me/positions` (own current + history) |
| `skill:read:self` | USER, READ_ONLY | `GET /v1/me/skills` |
| `skill:self_assess` | USER | `POST /v1/me/skills/self-assessments` → creates `sys.sys_user_skill_evidence` row with `evidence_source = SELF_ASSESSMENT` |
| `learning:read:self` | USER, READ_ONLY | `GET /v1/me/learning` (assignments) |
| `learning:browse_catalogue` | USER, READ_ONLY | `GET /v1/learning` (filtered for tenant) |
| `learning:enroll:self` | USER | `POST /v1/me/learning/enrollments` (non‑mandatory courses only; mandatory courses are assigned by `HRMS_MANAGER` or `MANAGER` via main API) |
| `kpi:read:self` | USER, READ_ONLY | `GET /v1/me/kpis` (own targets + measurements) |
| `gap_analysis:read:self` | USER, READ_ONLY | `GET /v1/me/gaps` |
| `career_succession:read:self` | USER, READ_ONLY | `GET /v1/me/career` |
| `career:request_target:self` | USER | `POST /v1/me/career/target-positions` → creates a record in `sys.sys_user_target_positions` for manager review |
| `assessment:read:self` | USER, READ_ONLY | `GET /v1/me/assessments` (own received feedback) |
| `certification:read:self` | USER, READ_ONLY | `GET /v1/me/certifications` |
| `certification:upload:self` | USER | `POST /v1/me/certifications` (URI metadata + issuer + expiry; no binary) |
| `document:read:self` | USER, READ_ONLY | `GET /v1/me/documents` (URI metadata) |
| `document:upload:self` | USER | `POST /v1/me/documents` (URI metadata only; no binary upload to DB) |
| `notification:read:self` | USER, READ_ONLY | `GET /v1/me/inbox` |
| `notification:mark_read:self` | USER | `PATCH /v1/me/inbox/:id` (mark read/acknowledged) |

**Permission seed addition**: migration 000005 seeds these 19 ESS permissions alongside the existing ≈ 81 admin permissions (≈ 100 total), and assigns them to the `USER` role (`READ_ONLY` gets only the `:read:self` subset).

**Self‑scope enforcement at API**: every route under `/v1/me/*` has a `requireSelfScope()` preHandler that ensures the resolved target is the same as `req.user.userId`. Any attempt to pass a userId via URL is rejected at routing time (the routes do not declare `:userId` params; they implicitly use the authenticated user).

**Audit**: every ESS mutation writes to `audit.user_self_service_actions(action_id, user_id, tenant_id, action_type, resource_id, payload_summary, created_at)` for forensics. Reads are not audited (volume too high), only mutations.

---

## 7. Tenant Isolation Strategy

Per ADR‑0006 + I5: **no RLS, ever**. Tenant isolation lives at the API layer.

### 7.1 Middleware

```ts
async function tenantContextMiddleware(req) {
  if (!req.user) return;   // unauthenticated route (e.g. /login, /healthz)
  if (!req.user.tenantId && !req.user.roles.includes('PLATFORM_ADMIN')) {
    throw new ForbiddenError('Tenant context required.');
  }
  req.tenantId = req.user.tenantId;   // injected for repository layer
}
```

### 7.2 Repository pattern

```ts
// apps/api/src/modules/positions/repository.ts
export class PositionsRepository {
  constructor(private db: NodePgDatabase) {}

  async listForTenant(tenantId: string) {
    return this.db.select().from(positions)
      .where(eq(positions.position_tenant_id, tenantId));
  }

  async getById(tenantId: string, positionId: string) {
    return this.db.select().from(positions)
      .where(and(
        eq(positions.position_id, positionId),
        eq(positions.position_tenant_id, tenantId),
      ))
      .limit(1)
      .then(r => r[0] ?? null);
  }
  // ...
}
```

The `tenantId` is **always** the first argument. The service layer never passes it from user input; it always pulls from `req.tenantId` injected by middleware. Lint rule (custom ESLint plugin) flags any repository method whose first arg isn't `tenantId: string`.

### 7.3 PLATFORM_ADMIN exception

`PLATFORM_ADMIN` may operate cross‑tenant. Such endpoints (e.g. `GET /tenants`, `POST /tenants`) check `req.user.roles.includes('PLATFORM_ADMIN')` and skip the tenant filter on the SQL query, **explicitly logging** the cross‑tenant access:

```ts
if (isPlatformOp) {
  req.log.warn({ userId: req.user.userId, route: req.url }, 'cross-tenant platform op');
}
```

---

## 8. Rate Limiting

Per‑IP and per‑user, enforced at the Fastify layer via `@fastify/rate-limit`:

| Endpoint | Per‑IP limit | Per‑user limit | Window |
|----------|------:|------:|-------:|
| `POST /auth/login` | 10 | 5 | 5 min |
| `POST /auth/password-reset/request` | 5 | 3 | 1 hour |
| `POST /auth/password-reset/complete` | 10 | 5 | 1 hour |
| `POST /auth/refresh` | 60 | 30 | 5 min |
| `GET /auth/me` | 600 | 120 | 1 min |
| Other routes | 600 | 300 | 1 min |

Exceeding the limit returns `429 Too Many Requests` with `Retry-After` header. Locking semantics (account lockout after N failed logins) is deferred to MVP‑1 follow‑up — current state: warn at 5 failures, no lock.

---

## 9. Password Reset Flow

```text
POST /auth/password-reset/request  body = { email }
  │
  ▼
1. Resolve user by tenant-scoped email lookup (sys.sys_users).
2. If found → generate 32-byte opaque token, hash with SHA-256, store in sys.sys_auth_password_reset_tokens (expires now() + 15min, used_at=NULL).
3. Send email with link `https://admin.heuresys.local/reset?token=<plain>` (plain in URL, never in DB).
4. Always return 204 regardless of email found/not (avoid enumeration).
5. Log PASSWORD_RESET_REQUESTED event with requester IP.

POST /auth/password-reset/complete  body = { token, newPassword, confirmPassword }
  │
  ▼
1. Validate Zod schema (password complexity).
2. Hash token, look up sys.sys_auth_password_reset_tokens WHERE hash AND used_at IS NULL AND expires_at > now().
3. If NOT FOUND → 400 (generic message; no enumeration).
4. Set used_at = now() (atomic, single-use).
5. Hash newPassword with Argon2id.
6. Mark all existing credentials for this user identity as is_current = false.
7. INSERT new credential.
8. Invalidate all refresh token families (force re-login).
9. Log PASSWORD_RESET_COMPLETED event.
10. Return 204.
```

---

## 10. MFA Foundation (post‑MVP enforcement)

The schema (`sys.sys_auth_mfa_factors`) is created in MVP‑0 but not enforced. The MFA enforcement design (post‑MVP):

1. Login flow checks `EXISTS (SELECT 1 FROM sys.sys_auth_mfa_factors WHERE user_id = :u AND verified = true)`.
2. If yes, after password verification, issue a short‑lived "MFA challenge" JWT (1‑min TTL) and prompt for OTP.
3. Verify OTP (TOTP via `otplib` or WebAuthn via `@simplewebauthn/server`).
4. Issue final access JWT + refresh token.
5. Update `auth_mfa_factor_last_used_at`.

Schema design is forward‑compatible: enforcement adds middleware + endpoint, no canonical table change.

---

## 11. Audit Logging — What Gets Recorded

Every auth state change writes to `sys.sys_auth_login_events`:

| Event | Trigger |
|-------|---------|
| `LOGIN_SUCCESS` | Successful credential verification |
| `LOGIN_FAILED` | Credential mismatch (user resolved, but wrong password) |
| `LOGIN_UNKNOWN_USER` | Login attempt for non‑existent email (logged but `user_id IS NULL`) |
| `LOGOUT` | Explicit logout |
| `REFRESH_OK` | Successful refresh rotation |
| `REFRESH_REPLAY_DETECTED` | Already‑used refresh token presented; family revoked |
| `REFRESH_EXPIRED` | Refresh token past expiry |
| `PASSWORD_RESET_REQUESTED` | Reset email sent |
| `PASSWORD_RESET_COMPLETED` | Password changed via reset link |
| `PASSWORD_CHANGED_BY_USER` | User self‑service change (not via reset) |
| `MFA_OK` | MFA challenge passed (post‑MVP) |
| `MFA_FAIL` | MFA challenge failed (post‑MVP) |
| `REVOKED_BY_ADMIN` | Admin‑initiated revocation |
| `ACCOUNT_LOCKED` | Rate limit / lockout policy triggered (post‑MVP) |
| `ROLE_GRANTED` | Role assignment via `user_auth_role` insert |
| `ROLE_REVOKED` | Role assignment revoked |

Audit log retention: indefinite (legal/compliance). Volume mitigation: partition `sys.sys_auth_login_events` by month if needed (post‑MVP).

---

## 12. Secrets Hygiene

| Secret type | Storage | Lifetime |
|-------------|---------|----------|
| Password (plain) | Never stored | Verified once, discarded |
| Password (Argon2id hash) | `sys.sys_auth_credentials` | Until rotation |
| Refresh token (plain opaque) | Returned via cookie only | 30 days, single‑use per rotation |
| Refresh token (SHA‑256 hash) | `sys.sys_auth_refresh_tokens.hash` | Until used/revoked/expired |
| Access JWT signing key (private) | `.env` (`JWT_PRIVATE_KEY`) | Rotated on policy |
| Access JWT signing key (public) | `.env` or `/.well-known/jwks.json` | Long‑lived |
| Password reset token (plain) | URL in email only | 15 min, single‑use |
| Password reset token (hash) | `sys.sys_auth_password_reset_tokens.token_hash` | Until used/expired |
| MFA secret (TOTP) | `sys.sys_auth_mfa_factors.secret` encrypted with `MFA_ENCRYPTION_KEY` from `.env` | Until factor revoked |
| Session cookie | Browser cookie store | Per cookie TTL |
| CSRF token | Cookie (non‑HttpOnly) + JS in‑memory | Per session |

**Rules:**

- Hashes never in logs (pino redaction).
- Plain passwords never in API responses, never in `req.body` after auth service consumes them.
- `.env` files never committed (`.gitignore` rule already in place).
- Database `pg_dump` for backups must be encrypted at rest; restoring restores hashes, never plain.

---

## 13. Acceptance Checklist (for MVP‑1 auth module)

- [ ] All 11 `sys.sys_auth_*` tables created idempotently in migration 000005.
- [ ] 8 canonical roles seeded; ~100 permissions seeded (≈ 81 admin + 19 ESS `*:self`); role‑permission matrix from §6 + §6.1 applied.
- [ ] `POST /auth/login` accepts `{email, password}`, returns **200** + sets `hrx_access` + `hrx_refresh` + `hrx_csrf` cookies, plus body `{user, roles, csrfToken}`. *(Earlier drafts said 204; HTTP forbids a body on 204 and Fastify strips it, so login + refresh return 200 with body. Logout + password-reset endpoints remain 204 — they have no body.)*
- [ ] `POST /auth/refresh` reads `hrx_refresh` cookie + `X-CSRF-Token` header; rotates; returns **200** + sets new cookies; or returns 401 on replay.
- [ ] `POST /auth/logout` revokes family + clears cookies.
- [ ] `GET /auth/me` returns the current user payload (no hash leaked).
- [ ] CSRF middleware blocks state‑changing requests without `X-CSRF-Token`.
- [ ] Refresh replay test: present the same refresh token twice → family revoked, `REFRESH_REPLAY_DETECTED` logged.
- [ ] Rate limit test: 11 logins in 5 min from same IP → 429.
- [ ] Pino redaction test: log a request body containing `password` → log shows `[REDACTED]`.
- [ ] Tenant isolation test: user from tenant A cannot GET `/positions/{id}` belonging to tenant B (404).
- [ ] Validation view (000023) `sys.v_canonical_outside_sys` returns 0 rows. (NB: `sys.v_synthetic_user_flag_consistency` was retired by 000154/ADR-0026.)
- [ ] Argon2id parameters match §3 baseline; `needsRehash` triggers re‑hash on login when params change.

---

## 14. Open Items (post‑MVP)

- MFA enforcement (TOTP first, WebAuthn next).
- SSO (OIDC / SAML) via `sys.sys_auth_identities.provider`.
- Account lockout after N failed logins.
- Hardened security headers via `@fastify/helmet` (CSP fine‑tuning per route).
- Audit log partitioning if volume exceeds 50 M rows.
- Per‑tenant JWT signing key rotation (out of MVP scope; single key initially).

---

## 15. Verification Checklist (planning deliverable)

- [x] 11 auth tables DDL outlined (§2)
- [x] Argon2id parameters + implementation pattern (§3)
- [x] JWT + refresh token model with rotation chain (§4)
- [x] Cookie security: HttpOnly + Secure + SameSite (§4.3)
- [x] CSRF double‑submit (§5)
- [x] Refresh replay detection (§4.2, §4.5)
- [x] Session revocation (§4.6, §4.7)
- [x] Role × Permission matrix (§6) — 8 roles, ≈ 100 permissions (≈ 81 admin incl. `auth:revoke_user` + 19 ESS `*:self` per ADR‑0011), with scope notes
- [x] Tenant isolation strategy: FK + middleware + repository pattern, no RLS (§7)
- [x] Rate limiting (§8)
- [x] Password reset (§9)
- [x] MFA foundation (§10)
- [x] Audit log events catalogued (§11)
- [x] Secrets hygiene (§12)
- [x] Acceptance checklist (§13)
- [x] Aligned with ADR‑0005 and ADR‑0006
