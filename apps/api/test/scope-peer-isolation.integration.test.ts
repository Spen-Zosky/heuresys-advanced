/**
 * apps/api/test/scope-peer-isolation.integration.test.ts — F5 of ADR-0027.
 *
 * PEER ISOLATION (I19) + organizational prevalence (I20), proven on the REAL RTL org chart with
 * two genuine managers whose sub-trees are disjoint: paolo.caputo and claudia.serra (each a
 * MANAGER with a 31-user sub-tree, intersection = 0 — verified live). Neither may read the other's
 * (or the other's reports') organizationally-gated data — BIDIRECTIONALLY. Everything is derived
 * from the live DB (no hard-coded ids/counts): the disjointness itself is asserted, then the gate
 * (canReadOrgTarget) is checked both directions.
 *
 * This is the sensitive-data half of F5; the cross-tree functional-axis half depends on F4
 * (activity endpoints) and is out of scope here.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { pool } from "../src/db/client.js";
import { resolveOrgReadScope, canReadOrgTarget } from "../src/lib/scope/resolver.js";
import { orgSubtreeUserIds } from "../src/lib/scope/org.js";
import { duePariOrganizzativi } from "./helpers/org-actors.js";
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

describe("scope/peer-isolation — I19/I20 on two real disjoint managers (F5, ADR-0027)", () => {
  let paolo: ActorContext;
  let claudia: ActorContext;
  let paoloSub: string[];
  let claudiaSub: string[];
  let paoloReport: string; // a member of paolo's sub-tree, ≠ paolo
  let claudiaReport: string; // a member of claudia's sub-tree, ≠ claudia

  beforeAll(async () => {
    // [S1045] La coppia NON e' piu' due nomi. `paolo.caputo` e `claudia.serra` erano
    // pari quando questo file fu scritto; oggi non lo sono: la ricostruzione ha messo
    // claudia DENTRO il sotto-albero di paolo (intersezione misurata: 10 persone). Una
    // coppia scelta a mano decade insieme all'organigramma.
    //
    // La coppia si sceglie ora sull'albero delle UNITA' (disgiunzione fra unita'
    // dirette) e il test la verifica sull'albero delle POSIZIONI: due strutture
    // diverse, quindi l'asserzione di disgiunzione puo' cadere davvero — ed e' cio'
    // che e' successo, e che il test doveva dire.
    const pari = await duePariOrganizzativi(pool);
    [paolo, claudia] = await Promise.all([actorFor(pari.a.email), actorFor(pari.b.email)]);
    [paoloSub, claudiaSub] = await Promise.all([
      orgSubtreeUserIds(pool, paolo.userId),
      orgSubtreeUserIds(pool, claudia.userId),
    ]);
    paoloReport = paoloSub.find((id) => id !== paolo.userId)!;
    claudiaReport = claudiaSub.find((id) => id !== claudia.userId)!;
  });

  it("both are genuine managers (resolve to a sub-tree, not self)", async () => {
    expect((await resolveOrgReadScope(pool, paolo)).kind).toBe("subtree");
    expect((await resolveOrgReadScope(pool, claudia)).kind).toBe("subtree");
    expect(paoloReport).toBeTruthy();
    expect(claudiaReport).toBeTruthy();
  });

  it("I19: the two sub-trees are disjoint (peers on the org chart)", () => {
    const cset = new Set(claudiaSub);
    expect(paoloSub.some((id) => cset.has(id))).toBe(false);
  });

  it("I19: paolo cannot read claudia (peer) nor any of claudia's reports (sensitive)", async () => {
    expect(await canReadOrgTarget(pool, paolo, claudia.userId, paolo.tenantId)).toBe(false);
    for (const member of claudiaSub) {
      expect(await canReadOrgTarget(pool, paolo, member, paolo.tenantId), `paolo must NOT read ${member}`).toBe(false);
    }
  });

  it("I19: claudia cannot read paolo (peer) nor any of paolo's reports — BIDIRECTIONAL", async () => {
    expect(await canReadOrgTarget(pool, claudia, paolo.userId, claudia.tenantId)).toBe(false);
    for (const member of paoloSub) {
      expect(await canReadOrgTarget(pool, claudia, member, claudia.tenantId), `claudia must NOT read ${member}`).toBe(false);
    }
  });

  it("sanity: each manager DOES read their own report + self (the fix is not blanket-deny)", async () => {
    expect(await canReadOrgTarget(pool, paolo, paoloReport, paolo.tenantId)).toBe(true);
    expect(await canReadOrgTarget(pool, paolo, paolo.userId, paolo.tenantId)).toBe(true);
    expect(await canReadOrgTarget(pool, claudia, claudiaReport, claudia.tenantId)).toBe(true);
    expect(await canReadOrgTarget(pool, claudia, claudia.userId, claudia.tenantId)).toBe(true);
  });
});
