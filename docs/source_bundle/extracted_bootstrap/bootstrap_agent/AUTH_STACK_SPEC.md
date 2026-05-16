# Authentication and Authorization Stack Specification

---

# 1. Purpose

The platform must include an authentication and authorization stack from the bootstrap stage.

Authentication must be separate from business user records.

---

# 2. Required Capabilities

- Login with email/username and password.
- Secure password hashing.
- Session or JWT token handling.
- Refresh token handling.
- Password reset flow.
- Login event logging.
- Role-based access control.
- Permission catalogue.
- Future-ready identity provider support.
- Optional MFA foundation.

---

# 3. Required Tables

```text
sys.sys_auth_identities
sys.sys_auth_credentials
sys.sys_auth_sessions
sys.sys_auth_refresh_tokens
sys.sys_auth_login_events
sys.sys_auth_password_reset_tokens
sys.sys_auth_mfa_factors
sys.sys_auth_roles
sys.sys_auth_permissions
sys.sys_auth_role_permissions
sys.sys_user_auth_roles
```

---

# 4. Role Model

Bootstrap roles:

```text
PLATFORM_ADMIN
TENANT_ADMIN
BLUEPRINT_MANAGER
HRMS_MANAGER
PROCESS_OWNER
MANAGER
USER
READ_ONLY
```

---

# 5. Permission Examples

```text
tenant:read
tenant:create
user:read
user:create
user:update
auth:role_assign
blueprint:read
blueprint:activate
position:read
position:create
position:update
skill:read
kpi:read
learning:read
assessment:read
career:read
compensation:read
```

---

# 6. Security Requirements

- Passwords must never be stored as plaintext.
- Auth secrets must not be stored in `sys.sys_users`.
- Password reset tokens must be hashed or securely generated.
- Sessions/refresh tokens must support revocation.
- Login events must be logged.
- Role assignments must be tenant-aware where appropriate.
- Administrative permissions must be auditable.
