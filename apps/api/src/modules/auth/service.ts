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
import { pool } from "../../db/client.js";

import { hashPassword, verifyPassword } from "./password.js";
import { generateOpaqueToken, sha256Hex } from "./tokens.js";
import type { IMailer } from "./mailer.js";
import * as repo from "./repository.js";

/* === Public types ======================================================== */

export interface LoginInput {
  email: string;
  password: string;
  ip: string | null;
  userAgent: string | null;
}

export interface LoginSuccess {
  accessJwt: string;
  refreshToken: string;
  csrfToken: string;
  user: { userId: string; email: string };
  roles: RoleCode[];
  jwtTenantId: string | null;
}

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

/* === Dependencies ======================================================== */

export interface AuthServiceDeps {
  jwtSign: (payload: {
    sub: string;
    tenant_id: string | null;
    roles: RoleCode[];
    jti: string;
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
}

/* === Service factory ===================================================== */

export interface AuthService {
  login(input: LoginInput): Promise<LoginSuccess>;
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
    const accessJwt = await deps.jwtSign({
      sub: args.userId,
      tenant_id: jwtTenantId,
      roles: roleCodes,
      jti,
    });

    const refreshToken = generateOpaqueToken();
    const refreshHash = sha256Hex(refreshToken);
    const familyId = args.familyId ?? randomUUID();
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
      // 1. Lookup candidate(s). Generic 401 for 0 or >1 to avoid enumeration
      //    of email existence or multi-tenant collision.
      const candidates = await repo.findLoginCandidatesByEmail(
        pool,
        input.email,
      );

      if (candidates.length === 0) {
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
        await repo.insertLoginEvent(pool, {
          userId: candidate.userId,
          tenantId: candidate.userTenantId,
          type: "LOGIN_FAILED",
          ip: input.ip,
          userAgent: input.userAgent,
        });
        throw new UnauthorizedError("Invalid email or password", "LOGIN_INVALID");
      }

      // 3. Rehash transparently if Argon2 params have evolved.
      if (needsRehash) {
        const newHash = await hashPassword(input.password);
        await repo.withTransaction(async (tx) => {
          await repo.markCredentialNotCurrent(tx, candidate.credentialId);
          await repo.insertCredential(tx, {
            identityId: candidate.identityId,
            hash: newHash,
          });
        });
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

    /* --- refresh ------------------------------------------------------ */
    async refresh(input) {
      const tokenHash = sha256Hex(input.refreshToken);
      const row = await repo.findRefreshTokenByHash(pool, tokenHash);

      if (!row) {
        throw new UnauthorizedError("Refresh token invalid", "REFRESH_INVALID");
      }

      // Replay detection: token already used → revoke whole family.
      if (row.usedAt !== null) {
        await repo.withTransaction(async (tx) => {
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
        await repo.withTransaction(async (tx) => {
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
      await repo.withTransaction(async (tx) => {
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
      await repo.withTransaction(async (tx) => {
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

    /* --- role-permission matrix (read-only) -------------------------- */
    async listRolePermissions() {
      const items = await repo.listRolePermissions(pool);
      return { items, total: items.length };
    },
  };
}

