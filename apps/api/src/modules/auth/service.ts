/**
 * apps/api/src/modules/auth/service.ts
 * Business logic for the auth module. Composed by routes.ts; the service is
 * a factory that takes its dependencies (jwt signer, mailer, logger, env)
 * so it stays unit-testable in isolation.
 *
 * Per AUTH_SECURITY_PLAN §3, §4, §5, §9, §13.
 */

import { randomUUID } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";

import { env } from "../../config/env.js";
import {
  REFRESH_TOKEN_TTL_SECONDS,
  type RoleCode,
} from "../../config/constants.js";
import { UnauthorizedError, NotFoundError, ForbiddenError } from "../../errors/index.js";
import { pool, withTransaction } from "../../db/client.js";

import { hashPassword, verifyPassword } from "./password.js";
import { generateOpaqueToken, sha256Hex } from "./tokens.js";
import type { IMailer } from "./mailer.js";
import * as repo from "./repository.js";
import {
  type EmailRateLimiter,
  sharedEmailRateLimiter,
} from "./email-rate-limit.js";
import { type MfaService, sharedMfaService } from "./mfa-service.js";

/* === Public types ======================================================== */

export interface LoginInput {
  email: string;
  password: string;
  ip: string | null;
  userAgent: string | null;
  /** MFA second-step: opaque challenge handle from the first-step response. */
  challengeToken?: string | undefined;
  /** MFA second-step: 6-digit TOTP code. */
  mfaCode?: string | undefined;
}

export interface LoginSuccess {
  status: "success";
  accessJwt: string;
  refreshToken: string;
  csrfToken: string;
  user: { userId: string; email: string };
  roles: RoleCode[];
  jwtTenantId: string | null;
}

/**
 * First-step result when the account has a verified MFA factor. No tokens are
 * issued; the caller must re-submit /login with `challengeToken` + `mfaCode`.
 */
export interface LoginMfaRequired {
  status: "mfa_required";
  challengeToken: string;
  availableKinds: string[];
}

/**
 * First-step result when the tenant's mandatory-MFA policy is enabled, the user
 * is in scope, and they have NO verified factor (MVP-4 par.2.5 #4). A RESTRICTED
 * enrollment-only access JWT is issued (claim `enr`, roles []) so the client can
 * reach ONLY the MFA self-service enrollment surface; no refresh token is created.
 */
export interface LoginEnrollmentRequired {
  status: "mfa_enrollment_required";
  accessJwt: string;
  csrfToken: string;
  /** Factor kinds the user may enroll (UI hint). */
  allowedKinds: string[];
}

export type LoginResult = LoginSuccess | LoginMfaRequired | LoginEnrollmentRequired;

export interface RefreshInput {
  refreshToken: string;
  ip: string | null;
  userAgent: string | null;
}

export interface RefreshSuccess extends LoginSuccess {}

export interface LogoutInput {
  refreshToken: string | undefined;
  userId: string | undefined;
  tenantId: string | undefined;
  ip: string | null;
  userAgent: string | null;
}

export interface PasswordResetRequestInput {
  email: string;
  ip: string | null;
}

export interface PasswordResetCompleteInput {
  token: string;
  newPassword: string;
  ip: string | null;
}

export interface AdminRevokeInput {
  actorUserId: string;
  actorTenantId: string | null;
  actorRoles: RoleCode[];
  targetUserId: string;
}

export interface AdminListSessionsInput {
  actorUserId: string;
  actorTenantId: string | null;
  actorRoles: RoleCode[];
  targetUserId: string;
}

export interface AdminListSessionsOutput {
  items: Array<{
    familyId: string;
    tenantId: string;
    firstIssuedAt: string;
    lastIssuedAt: string;
    expiresAt: string;
    ip: string | null;
    userAgent: string | null;
  }>;
  total: number;
}

/* === Dependencies ======================================================== */

export interface AuthServiceDeps {
  jwtSign: (payload: {
    sub: string;
    tenant_id: string | null;
    roles: RoleCode[];
    jti: string;
    fam: string;
    /** Enrollment-only restricted session (mandatory-MFA gate, MVP-4 par.2.5 #4). */
    enr?: boolean;
  }) => Promise<string> | string;
  mailer: IMailer;
  log: FastifyBaseLogger;
  /**
   * Base URL used to build the password-reset link sent in the email.
   * Defaults to env.ADMIN_ORIGIN. Override useful for tests.
   */
  resetBaseUrl?: string;
  /** Overridable for tests. */
  now?: () => Date;
  /**
   * Per-email rate limiter for /login. Defaults to the module-singleton; tests
   * can pass their own to isolate state (each integration test seeds its own).
   */
  emailRateLimiter?: EmailRateLimiter;
  /**
   * MFA service used to gate login. Defaults to the module singleton
   * (`sharedMfaService`); tests can inject a service bound to an isolated
   * in-memory challenge store.
   */
  mfaService?: MfaService;
  /**
   * Mandatory-MFA login enforcement (S989 neutralization seam). When false the
   * §3b login gate is bypassed ENTIRELY (no mfa_required / mfa_enrollment_required)
   * so dev/test can proceed without a second factor — the MFA capability, enrolled
   * factors and per-tenant policy data are untouched. Defaults to
   * env.MFA_ENFORCEMENT_ENABLED (true). buildTestApp pins it true so existing
   * suites are unaffected; the dedicated bypass test passes false.
   */
  mfaEnforcement?: boolean;
}

/* === Service factory ===================================================== */

export interface AuthService {
  login(input: LoginInput): Promise<LoginResult>;
  /**
   * Completes a login whose second factor was verified OUT-OF-BAND of /login
   * (today: the WebAuthn authentication ceremony, which consumes the login
   * challengeToken itself). Issues the full session bundle for the user.
   */
  completeMfaLogin(input: {
    userId: string;
    ip: string | null;
    userAgent: string | null;
  }): Promise<LoginSuccess>;
  refresh(input: RefreshInput): Promise<RefreshSuccess>;
  logout(input: LogoutInput): Promise<void>;
  getMe(userId: string): Promise<{
    userId: string;
    email: string;
    roles: RoleCode[];
    tenantId: string | null;
  }>;
  requestPasswordReset(input: PasswordResetRequestInput): Promise<void>;
  completePasswordReset(input: PasswordResetCompleteInput): Promise<void>;
  adminRevokeUser(input: AdminRevokeInput): Promise<void>;
  adminListSessions(input: AdminListSessionsInput): Promise<AdminListSessionsOutput>;
  listRolePermissions(): Promise<{
    items: Array<{
      roleCode: string;
      permissionCode: string;
      permissionResource: string;
      permissionAction: string;
    }>;
    total: number;
  }>;
}

export function createAuthService(deps: AuthServiceDeps): AuthService {
  const now = deps.now ?? (() => new Date());
  const resetBaseUrl = deps.resetBaseUrl ?? env.ADMIN_ORIGIN;
  const emailRateLimiter = deps.emailRateLimiter ?? sharedEmailRateLimiter;
  const mfaService = deps.mfaService ?? sharedMfaService;
  const mfaEnforcement = deps.mfaEnforcement ?? env.MFA_ENFORCEMENT_ENABLED;

  async function issueLoginBundle(args: {
    userId: string;
    userEmail: string;
    userTenantId: string;
    grants: repo.UserRoleGrant[];
    familyId: string | null; // null → start a new family
    previousRefreshId: string | null;
    ip: string | null;
    userAgent: string | null;
  }): Promise<LoginSuccess> {
    const platformGrant = args.grants.find((g) => g.isPlatform && g.tenantId === null);
    const jwtTenantId = platformGrant ? null : args.userTenantId;
    const roleCodes = [...new Set(args.grants.map((g) => g.roleCode))];

    const jti = randomUUID();
    const familyId = args.familyId ?? randomUUID();
    const accessJwt = await deps.jwtSign({
      sub: args.userId,
      tenant_id: jwtTenantId,
      roles: roleCodes,
      jti,
      fam: familyId,
    });

    const refreshToken = generateOpaqueToken();
    const refreshHash = sha256Hex(refreshToken);
    const expiresAt = new Date(now().getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000);

    await repo.insertRefreshToken(pool, {
      userId: args.userId,
      tenantId: args.userTenantId,
      familyId,
      previousId: args.previousRefreshId,
      tokenHash: refreshHash,
      expiresAt,
      ip: args.ip,
      userAgent: args.userAgent,
    } satisfies repo.InsertRefreshTokenParams);

    const csrfToken = generateOpaqueToken();

    return {
      status: "success",
      accessJwt,
      refreshToken,
      csrfToken,
      user: { userId: args.userId, email: args.userEmail },
      roles: roleCodes,
      jwtTenantId,
    };
  }

  return {
    /* --- login -------------------------------------------------------- */
    async login(input) {
      // 0. Per-email rate limit (defense vs credential stuffing across IPs).
      //    Throws TooManyRequestsError → 429 with Retry-After. The /login
      //    route also has a per-IP rate limit (10/5min, see routes.ts).
      emailRateLimiter.check(input.email);

      // 1. Lookup candidate(s). Generic 401 for 0 or >1 to avoid enumeration
      //    of email existence or multi-tenant collision.
      const candidates = await repo.findLoginCandidatesByEmail(
        pool,
        input.email,
      );

      if (candidates.length === 0) {
        emailRateLimiter.recordFailure(input.email);
        await repo.insertLoginEvent(pool, {
          userId: null,
          tenantId: null,
          type: "LOGIN_UNKNOWN_USER",
          ip: input.ip,
          userAgent: input.userAgent,
          details: { email: input.email },
        });
        throw new UnauthorizedError("Invalid email or password", "LOGIN_INVALID");
      }
      if (candidates.length > 1) {
        emailRateLimiter.recordFailure(input.email);
        deps.log.warn(
          { email: input.email, matches: candidates.length },
          "Login email matched multiple tenants — rejecting as ambiguous",
        );
        throw new UnauthorizedError("Invalid email or password", "LOGIN_INVALID");
      }

      const candidate = candidates[0]!;

      // 2. Verify password (constant-time via argon2.verify).
      const { ok, needsRehash } = await verifyPassword(
        candidate.credentialHash,
        input.password,
      );

      if (!ok) {
        emailRateLimiter.recordFailure(input.email);
        await repo.insertLoginEvent(pool, {
          userId: candidate.userId,
          tenantId: candidate.userTenantId,
          type: "LOGIN_FAILED",
          ip: input.ip,
          userAgent: input.userAgent,
        });
        throw new UnauthorizedError("Invalid email or password", "LOGIN_INVALID");
      }

      // Successful credential verification → reset the per-email counter.
      emailRateLimiter.recordSuccess(input.email);

      // 3. Rehash transparently if Argon2 params have evolved.
      if (needsRehash) {
        const newHash = await hashPassword(input.password);
        await withTransaction(async (tx) => {
          await repo.markCredentialNotCurrent(tx, candidate.credentialId);
          await repo.insertCredential(tx, {
            identityId: candidate.identityId,
            hash: newHash,
          });
        });
      }

      // 3b. MFA gate (MVP-3 Tappa E). Composed AFTER password verification so
      //     the second factor only applies to otherwise-valid credentials.
      //     - First step (no challengeToken): if the account has a verified
      //       MFA factor, return `mfa_required` WITHOUT issuing tokens.
      //     - Second step (challengeToken + mfaCode): verify the TOTP challenge
      //       (single-use, short-TTL) before falling through to token issuance.
      //     Accounts with no verified factor skip the gate entirely.
      //     DEV/TEST NEUTRALIZATION (S989): when mfaEnforcement is false (env
      //     MFA_ENFORCEMENT_ENABLED=false) the WHOLE gate is bypassed — login
      //     falls straight through to token issuance, no second factor. PROD
      //     keeps it true (default); enrolled factors + the per-tenant policy
      //     are untouched, only login-time enforcement is suspended.
      if (mfaEnforcement && input.challengeToken) {
        if (!input.mfaCode) {
          throw new UnauthorizedError("MFA code required", "MFA_CODE_REQUIRED");
        }
        const verified = await mfaService.verifyLoginChallenge({
          challengeToken: input.challengeToken,
          code: input.mfaCode,
        });
        if (verified.userId !== candidate.userId) {
          // Challenge token resolved to a different identity → reject.
          throw new UnauthorizedError("Invalid MFA challenge", "MFA_INVALID");
        }
      } else if (mfaEnforcement && !(await repo.isUserMfaExempt(pool, candidate.userId))) {
        // #9 WI-A: a user with an ACTIVE MFA exemption (headless service account,
        // sys_auth_mfa_exemptions / mig 000116) skips the WHOLE gate (no
        // mfa_required, no mfa_enrollment_required) and falls through to full
        // token issuance. Empty table = no exemptions = behaviour identical to
        // pre-000116. Invariant I7: exemption is an auth-only table.
        const challenge = await mfaService.beginLoginChallenge(candidate.userId);
        if (challenge) {
          return {
            status: "mfa_required",
            challengeToken: challenge.challengeToken,
            availableKinds: challenge.availableKinds,
          };
        }
        // Mandatory-MFA policy gate (MVP-4 par.2.5 #4): the user has NO verified
        // factor. If the tenant policy is enabled and the user's roles are in
        // scope, issue a RESTRICTED enrollment-only session instead of tokens.
        // KNOWN LIMIT (trust-on-first-use): a password-only attacker hitting a
        // never-enrolled in-scope account can enroll THEIR OWN factor through
        // this gate — same exposure as pre-#4 (then they got a full session
        // outright), but the gate adds an auditable LOGIN_MFA_ENROLLMENT_REQUIRED
        // event. Out-of-band confirmation on first enrollment is the v2 hardening.
        // (claim `enr`, roles [] -> every requirePermission() denies; the only
        // usable surface is /v1/auth/mfa self-service). Default OFF: with no
        // policy row (or enabled=false) behaviour is identical to pre-#4.
        const policy = await repo.findMfaPolicyForTenant(pool, candidate.userTenantId);
        if (policy?.enabled) {
          const grants = await repo.getUserRoleGrants(pool, candidate.userId);
          const roleCodes = [...new Set(grants.map((g) => g.roleCode))];
          const inScope =
            policy.roleCodes === null ||
            roleCodes.some((r) => policy.roleCodes!.includes(r));
          if (inScope) {
            const accessJwt = await deps.jwtSign({
              sub: candidate.userId,
              tenant_id: candidate.userTenantId,
              roles: [],
              jti: randomUUID(),
              fam: randomUUID(), // namespace only - no refresh row is created
              enr: true,
            });
            const csrfToken = generateOpaqueToken();
            await repo.insertLoginEvent(pool, {
              userId: candidate.userId,
              tenantId: candidate.userTenantId,
              type: "LOGIN_MFA_ENROLLMENT_REQUIRED",
              ip: input.ip,
              userAgent: input.userAgent,
            });
            return {
              status: "mfa_enrollment_required",
              accessJwt,
              csrfToken,
              // Enrollable kinds are provider-aware (SMS_OTP appears only when
              // a production-capable SMS sender is configured).
              allowedKinds: mfaService.enrollableKinds(),
            };
          }
        }
      }

      // 4. Resolve roles + issue tokens.
      const grants = await repo.getUserRoleGrants(pool, candidate.userId);
      const bundle = await issueLoginBundle({
        userId: candidate.userId,
        userEmail: candidate.userEmail,
        userTenantId: candidate.userTenantId,
        grants,
        familyId: null,
        previousRefreshId: null,
        ip: input.ip,
        userAgent: input.userAgent,
      });

      await repo.insertLoginEvent(pool, {
        userId: candidate.userId,
        tenantId: candidate.userTenantId,
        type: "LOGIN_SUCCESS",
        ip: input.ip,
        userAgent: input.userAgent,
      });

      return bundle;
    },

    /* --- complete MFA login out-of-band (WebAuthn ceremony) ----------- */
    async completeMfaLogin(input) {
      const me = await repo.findUserForMe(pool, input.userId);
      if (!me) {
        throw new UnauthorizedError("User no longer active", "USER_INACTIVE");
      }
      const grants = await repo.getUserRoleGrants(pool, input.userId);
      const bundle = await issueLoginBundle({
        userId: me.userId,
        userEmail: me.email,
        userTenantId: me.userTenantId,
        grants,
        familyId: null,
        previousRefreshId: null,
        ip: input.ip,
        userAgent: input.userAgent,
      });
      await repo.insertLoginEvent(pool, {
        userId: me.userId,
        tenantId: me.userTenantId,
        type: "LOGIN_SUCCESS",
        ip: input.ip,
        userAgent: input.userAgent,
        details: { method: "WEBAUTHN" },
      });
      return bundle;
    },

    /* --- refresh ------------------------------------------------------ */
    async refresh(input) {
      const tokenHash = sha256Hex(input.refreshToken);
      const row = await repo.findRefreshTokenByHash(pool, tokenHash);

      if (!row) {
        throw new UnauthorizedError("Refresh token invalid", "REFRESH_INVALID");
      }

      // Replay detection: token already used → revoke whole family.
      if (row.usedAt !== null) {
        await withTransaction(async (tx) => {
          await repo.revokeRefreshFamily(tx, row.familyId, "REPLAY_DETECTED");
          await repo.insertLoginEvent(tx, {
            userId: row.userId,
            tenantId: row.tenantId,
            type: "REFRESH_REPLAY_DETECTED",
            ip: input.ip,
            userAgent: input.userAgent,
            details: { familyId: row.familyId, replayedTokenId: row.refreshTokenId },
          });
        });
        throw new UnauthorizedError(
          "Refresh token replay detected",
          "REFRESH_REPLAY_DETECTED",
        );
      }

      if (row.revokedAt !== null || row.expiresAt <= now()) {
        await repo.insertLoginEvent(pool, {
          userId: row.userId,
          tenantId: row.tenantId,
          type: "REFRESH_EXPIRED",
          ip: input.ip,
          userAgent: input.userAgent,
        });
        throw new UnauthorizedError("Refresh token expired", "REFRESH_EXPIRED");
      }

      // Atomically mark used; if race lost (concurrent refresh) treat as replay.
      const marked = await repo.tryMarkRefreshTokenUsed(
        pool,
        row.refreshTokenId,
      );
      if (!marked) {
        await withTransaction(async (tx) => {
          await repo.revokeRefreshFamily(tx, row.familyId, "REPLAY_DETECTED");
          await repo.insertLoginEvent(tx, {
            userId: row.userId,
            tenantId: row.tenantId,
            type: "REFRESH_REPLAY_DETECTED",
            ip: input.ip,
            userAgent: input.userAgent,
            details: { familyId: row.familyId, raceLost: true },
          });
        });
        throw new UnauthorizedError(
          "Refresh token replay detected",
          "REFRESH_REPLAY_DETECTED",
        );
      }

      // Look up user + roles to rebuild the JWT.
      const me = await repo.findUserForMe(pool, row.userId);
      if (!me) {
        // User deactivated since the refresh was issued — block.
        await repo.revokeRefreshFamily(
          pool,
          row.familyId,
          "USER_INACTIVE",
        );
        throw new UnauthorizedError("User no longer active", "USER_INACTIVE");
      }
      const grants = await repo.getUserRoleGrants(pool, row.userId);

      const bundle = await issueLoginBundle({
        userId: me.userId,
        userEmail: me.email,
        userTenantId: me.userTenantId,
        grants,
        familyId: row.familyId,
        previousRefreshId: row.refreshTokenId,
        ip: input.ip,
        userAgent: input.userAgent,
      });

      await repo.insertLoginEvent(pool, {
        userId: row.userId,
        tenantId: row.tenantId,
        type: "REFRESH_OK",
        ip: input.ip,
        userAgent: input.userAgent,
        details: { familyId: row.familyId },
      });

      return bundle;
    },

    /* --- logout ------------------------------------------------------- */
    async logout(input) {
      if (input.refreshToken) {
        const tokenHash = sha256Hex(input.refreshToken);
        const row = await repo.findRefreshTokenByHash(pool, tokenHash);
        if (row) {
          await repo.revokeRefreshFamily(pool, row.familyId, "LOGOUT");
        }
      }
      // Always log even without a refresh cookie — best-effort forensics.
      await repo.insertLoginEvent(pool, {
        userId: input.userId ?? null,
        tenantId: input.tenantId ?? null,
        type: "LOGOUT",
        ip: input.ip,
        userAgent: input.userAgent,
      });
    },

    /* --- /auth/me ----------------------------------------------------- */
    async getMe(userId) {
      const me = await repo.findUserForMe(pool, userId);
      if (!me) throw new NotFoundError("User");
      const grants = await repo.getUserRoleGrants(pool, userId);
      const roles = [...new Set(grants.map((g) => g.roleCode))];
      const platformGrant = grants.find((g) => g.isPlatform && g.tenantId === null);
      const tenantId = platformGrant ? null : me.userTenantId;
      return { userId: me.userId, email: me.email, roles, tenantId };
    },

    /* --- password reset request -------------------------------------- */
    async requestPasswordReset(input) {
      const users = await repo.findUsersByEmailForReset(pool, input.email);
      // Always return 204 regardless of match count to prevent enumeration.
      for (const u of users) {
        const plain = generateOpaqueToken();
        const hash = sha256Hex(plain);
        const expiresAt = new Date(now().getTime() + 15 * 60 * 1000); // 15 min
        await repo.insertPasswordResetToken(pool, {
          userId: u.userId,
          tokenHash: hash,
          expiresAt,
          requesterIp: input.ip,
        });
        const resetUrl = `${resetBaseUrl}/reset?token=${plain}`;
        await deps.mailer.sendPasswordResetEmail(input.email, resetUrl);
        await repo.insertLoginEvent(pool, {
          userId: u.userId,
          tenantId: u.tenantId,
          type: "PASSWORD_RESET_REQUESTED",
          ip: input.ip,
          userAgent: null,
        });
      }
    },

    /* --- password reset complete ------------------------------------- */
    async completePasswordReset(input) {
      const hash = sha256Hex(input.token);
      const rec = await repo.findActivePasswordResetByHash(pool, hash);
      if (!rec) {
        throw new UnauthorizedError("Reset token invalid or expired", "RESET_INVALID");
      }

      const marked = await repo.tryMarkPasswordResetUsed(
        pool,
        rec.tokenId,
      );
      if (!marked) {
        throw new UnauthorizedError("Reset token invalid or expired", "RESET_INVALID");
      }

      const identity = await repo.findLocalIdentityForUser(
        pool,
        rec.userId,
      );
      if (!identity) {
        throw new UnauthorizedError("Reset target identity missing", "RESET_INVALID");
      }

      const newHash = await hashPassword(input.newPassword);
      await withTransaction(async (tx) => {
        await repo.markAllCredentialsNotCurrentForUser(tx, rec.userId);
        await repo.insertCredential(tx, {
          identityId: identity.identityId,
          hash: newHash,
        });
        await repo.revokeAllRefreshTokensForUser(tx, rec.userId, "PASSWORD_RESET");
        await repo.insertLoginEvent(tx, {
          userId: rec.userId,
          tenantId: null,
          type: "PASSWORD_RESET_COMPLETED",
          ip: input.ip,
          userAgent: null,
        });
      });
    },

    /* --- admin revoke user ------------------------------------------- */
    async adminRevokeUser(input) {
      // AUTH §6 matrix: PLATFORM_ADMIN may revoke any user; TENANT_ADMIN
      // may only revoke users in their own tenant. The route preHandler
      // already gates by 'auth:revoke_user' permission — here we enforce
      // the per-target tenant scope filter.
      const isPlatform = input.actorRoles.includes("PLATFORM_ADMIN");
      if (!isPlatform) {
        if (input.actorTenantId === null) {
          throw new ForbiddenError("Tenant context required to revoke users");
        }
        const target = await repo.findUserForMe(pool, input.targetUserId);
        if (!target) throw new NotFoundError("User");
        if (target.userTenantId !== input.actorTenantId) {
          throw new ForbiddenError("Cannot revoke users outside your tenant");
        }
      }
      await withTransaction(async (tx) => {
        await repo.revokeAllRefreshTokensForUser(tx, input.targetUserId, "REVOKED_BY_ADMIN");
        await repo.insertLoginEvent(tx, {
          userId: input.targetUserId,
          tenantId: null,
          type: "REVOKED_BY_ADMIN",
          ip: null,
          userAgent: null,
          details: { actorUserId: input.actorUserId },
        });
      });
    },

    /* --- admin list sessions (MVP-3 Tappa E) ------------------------- */
    async adminListSessions(input) {
      // Same tenant-scope policy as adminRevokeUser: PLATFORM_ADMIN sees every
      // user's sessions; TENANT_ADMIN only own-tenant users. Route preHandler
      // already gates by 'auth:revoke_user' permission (reusing the perm —
      // see AUTH_SECURITY_PLAN §6 matrix; viewing sessions is a strict subset
      // of being able to revoke them, so no new permission code is needed).
      const isPlatform = input.actorRoles.includes("PLATFORM_ADMIN");
      if (!isPlatform) {
        if (input.actorTenantId === null) {
          throw new ForbiddenError("Tenant context required to list sessions");
        }
        const target = await repo.findUserForMe(pool, input.targetUserId);
        if (!target) throw new NotFoundError("User");
        if (target.userTenantId !== input.actorTenantId) {
          throw new ForbiddenError("Cannot list sessions outside your tenant");
        }
      }
      const rows = await repo.listActiveRefreshTokenFamiliesForUser(
        pool,
        input.targetUserId,
      );
      const items = rows.map((r) => ({
        familyId: r.familyId,
        tenantId: r.tenantId,
        firstIssuedAt: r.firstIssuedAt.toISOString(),
        lastIssuedAt: r.lastIssuedAt.toISOString(),
        expiresAt: r.expiresAt.toISOString(),
        ip: r.ip,
        userAgent: r.userAgent,
      }));
      return { items, total: items.length };
    },

    /* --- role-permission matrix (read-only) -------------------------- */
    async listRolePermissions() {
      const items = await repo.listRolePermissions(pool);
      return { items, total: items.length };
    },
  };
}

