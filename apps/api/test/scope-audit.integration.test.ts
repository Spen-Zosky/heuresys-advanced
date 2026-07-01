/**
 * apps/api/test/scope-audit.integration.test.ts — F6 of ADR-0027 (scope-access audit).
 *
 * Proves the two resolver primitives RECORD the authorizing axis for every organizational decision,
 * on the real RTL roles: a review can reconstruct WHY a sensitive access was granted (self /
 * hr_mandate / org_subtree / platform), not just who. Uses the tests-only in-memory capture; the
 * production transport is the pino "scope.access" line.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { pool } from "../src/db/client.js";
import { resolveOrgReadScope, canReadOrgTarget } from "../src/lib/scope/resolver.js";
import {
  enableScopeAuditCapture,
  drainScopeAuditCapture,
  type ScopeAccessEvent,
} from "../src/lib/scope/audit.js";
import type { ActorContext } from "../src/lib/actor.js";
import type { RoleCode } from "../src/config/constants.js";

async function actorFor(email: string): Promise<ActorContext> {
  const u = (
    await pool.query<{ user_id: string; tenant_id: string | null }>(
      `SELECT user_id, user_tenant_id AS tenant_id FROM sys.sys_users WHERE user_email = $1`,
      [email],
    )
  ).rows[0];
  if (!u) throw new Error(`fixture user not found: ${email}`);
  const roles = (
    await pool.query<{ code: string }>(
      `SELECT ro.auth_role_code AS code FROM sys.sys_user_auth_roles ur
         JOIN sys.sys_auth_roles ro ON ro.auth_role_id = ur.user_auth_role_role_id
        WHERE ur.user_auth_role_user_id = $1 AND ur.user_auth_role_revoked_at IS NULL`,
      [u.user_id],
    )
  ).rows.map((r) => r.code as RoleCode);
  return { userId: u.user_id, tenantId: u.tenant_id, roles };
}

/** Run fn while capturing scope-audit events, return them. */
async function captured(fn: () => Promise<unknown>): Promise<ScopeAccessEvent[]> {
  enableScopeAuditCapture();
  await fn();
  return drainScopeAuditCapture();
}

describe("scope/audit — the authorizing axis is recorded (F6, ADR-0027)", () => {
  let admin: ActorContext;
  let federica: ActorContext;
  let paolo: ActorContext;
  let tommaso: ActorContext;
  let antonio: ActorContext;

  beforeAll(async () => {
    [admin, federica, paolo, tommaso, antonio] = await Promise.all([
      actorFor("admin@heuresys.com"),
      actorFor("federica.marchetti@rtl-bank.org"),
      actorFor("paolo.caputo@rtl-bank.org"),
      actorFor("tommaso.fiore@rtl-bank.org"),
      actorFor("antonio.parisi@rtl-bank.org"),
    ]);
  });

  it("resolve records platform / hr_mandate / org_subtree / self", async () => {
    const p = await captured(() => resolveOrgReadScope(pool, admin));
    expect(p.at(-1)).toMatchObject({ op: "resolve", axis: "platform", granted: true, actorUserId: admin.userId });
    const h = await captured(() => resolveOrgReadScope(pool, federica));
    expect(h.at(-1)).toMatchObject({ op: "resolve", axis: "hr_mandate", granted: true });
    const s = await captured(() => resolveOrgReadScope(pool, paolo));
    expect(s.at(-1)).toMatchObject({ op: "resolve", axis: "org_subtree", granted: true });
    const self = await captured(() => resolveOrgReadScope(pool, tommaso));
    expect(self.at(-1)).toMatchObject({ op: "resolve", axis: "self", granted: true });
  });

  it("per-target read records the axis that granted OR denied it", async () => {
    const granted = await captured(() => canReadOrgTarget(pool, paolo, tommaso.userId, paolo.tenantId));
    expect(granted.at(-1)).toMatchObject({ op: "target", axis: "org_subtree", granted: true, targetUserId: tommaso.userId });

    const denied = await captured(() => canReadOrgTarget(pool, paolo, antonio.userId, paolo.tenantId));
    expect(denied.at(-1)).toMatchObject({ op: "target", axis: "denied", granted: false, targetUserId: antonio.userId });

    const mandate = await captured(() => canReadOrgTarget(pool, federica, antonio.userId, federica.tenantId));
    expect(mandate.at(-1)).toMatchObject({ op: "target", axis: "hr_mandate", granted: true });

    const platform = await captured(() => canReadOrgTarget(pool, admin, antonio.userId, admin.tenantId));
    expect(platform.at(-1)).toMatchObject({ op: "target", axis: "platform", granted: true });

    const selfRead = await captured(() => canReadOrgTarget(pool, tommaso, tommaso.userId, tommaso.tenantId));
    expect(selfRead.at(-1)).toMatchObject({ op: "target", axis: "self", granted: true });
  });

  it("capture is off by default (no leakage between runs)", () => {
    // drain without enable → empty; proves production path does not accumulate.
    expect(drainScopeAuditCapture()).toEqual([]);
  });
});
