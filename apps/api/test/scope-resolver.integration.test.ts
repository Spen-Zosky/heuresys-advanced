/**
 * apps/api/test/scope-resolver.integration.test.ts — F1 of ADR-0027 (the shared scope resolver).
 *
 * Verifies the single organizational-scope engine against the REAL RTL roles, including Enzo's
 * MANAGERIAL CONSTRAINT: the org sub-tree applies ONLY to explicit managerial roles (RBAC
 * MANAGER/CEO or an org-unit manager). A plain employee who merely has reports in the chart
 * (tommaso: 7 reports, but USER/TEAM_MEMBER, no OU) sees only themselves.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { pool } from "../src/db/client.js";
import { resolveOrgReadScope, canReadOrgTarget } from "../src/lib/scope/resolver.js";
import { orgSubtreeUserIds } from "../src/lib/scope/org.js";
import {
  unSottopostoOrganizzativo,
  unEstraneoOrganizzativo,
  preparaUnRiportoSotto,
} from "./helpers/org-actors.js";
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
      `SELECT ro.auth_role_code AS code
         FROM sys.sys_user_auth_roles ur
         JOIN sys.sys_auth_roles ro ON ro.auth_role_id = ur.user_auth_role_role_id
        WHERE ur.user_auth_role_user_id = $1 AND ur.user_auth_role_revoked_at IS NULL`,
      [u.user_id],
    )
  ).rows.map((r) => r.code as RoleCode);
  return { userId: u.user_id, tenantId: u.tenant_id, roles };
}

describe("scope/resolver — org read scope + managerial constraint (F1, ADR-0027)", () => {
  let admin: ActorContext;
  let federica: ActorContext;
  let paolo: ActorContext;
  let tommaso: ActorContext;
  let antonio: ActorContext;

  beforeAll(async () => {
    [admin, federica, paolo] = await Promise.all([
      actorFor("admin@heuresys.com"),
      actorFor("federica.marchetti@rtl-bank.org"),
      actorFor("paolo.caputo@rtl-bank.org"),
    ]);

    // [S1045] Il riporto e l'estraneo li sceglie l'albero delle UNITA', non due nomi
    // scritti a mano: la ricostruzione dell'organigramma aveva invertito i ruoli di
    // `tommaso.fiore` e `antonio.parisi`, e i test descrivevano l'azienda di ieri.
    const sottoposto = await unSottopostoOrganizzativo(pool, paolo.userId);
    const estraneo = await unEstraneoOrganizzativo(pool, paolo.userId);
    [tommaso, antonio] = await Promise.all([actorFor(sottoposto.email), actorFor(estraneo.email)]);

    // Il vincolo F1 vive su un profilo che il dato reale non offre piu': non
    // manageriale MA con riporti (misurato: zero persone su 163 dopo la
    // ricostruzione). Si prepara, come si fa per i fattori MFA in helpers/actors.ts;
    // D-52 annulla la fixture a fine file.
    await preparaUnRiportoSotto(pool, tommaso.userId);
  });

  it("PLATFORM_ADMIN → all (cross-tenant)", async () => {
    expect((await resolveOrgReadScope(pool, admin)).kind).toBe("all");
  });

  it("HR-mandated (TENANT_ADMIN) → whole tenant", async () => {
    expect((await resolveOrgReadScope(pool, federica)).kind).toBe("tenant");
  });

  it("managerial (MANAGER) → the transitive org sub-tree", async () => {
    const s = await resolveOrgReadScope(pool, paolo);
    expect(s.kind).toBe("subtree");
    if (s.kind === "subtree") {
      const sub = new Set(await orgSubtreeUserIds(pool, paolo.userId));
      expect(new Set(s.userIdAllowList)).toEqual(sub); // exactly the sub-tree, derived (no hardcoding)
    }
  });

  it("CONSTRAINT: a non-managerial user WITH reports → self only (not their sub-tree)", async () => {
    const s = await resolveOrgReadScope(pool, tommaso);
    expect(s.kind).toBe("self");
    if (s.kind === "self") expect(s.userIdAllowList).toEqual([tommaso.userId]);
    // The gate is the managerial role, not the absence of reports — tommaso genuinely has reports.
    const reports = (await orgSubtreeUserIds(pool, tommaso.userId)).filter((id) => id !== tommaso.userId);
    expect(reports.length).toBeGreaterThan(0);
  });

  it("canReadOrgTarget: a manager reads a report, not an outsider", async () => {
    expect(await canReadOrgTarget(pool, paolo, tommaso.userId, paolo.tenantId)).toBe(true);
    expect(await canReadOrgTarget(pool, paolo, antonio.userId, paolo.tenantId)).toBe(false);
  });

  it("CONSTRAINT: a non-managerial user CANNOT read their own report's record — only self", async () => {
    const reports = (await orgSubtreeUserIds(pool, tommaso.userId)).filter((id) => id !== tommaso.userId);
    expect(reports.length).toBeGreaterThan(0);
    expect(await canReadOrgTarget(pool, tommaso, reports[0]!, tommaso.tenantId)).toBe(false); // report → denied
    expect(await canReadOrgTarget(pool, tommaso, tommaso.userId, tommaso.tenantId)).toBe(true); // self → ok
  });
});
