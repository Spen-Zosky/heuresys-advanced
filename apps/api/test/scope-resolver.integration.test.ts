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
import { attoriDiScena } from "./helpers/attori-di-scena.js";
/**
 * I cinque ruoli di scena, derivati dal dato di oggi invece che scritti a mano (#147).
 * Non sono cinque persone: sono cinque CARATTERISTICHE, e ognuna e' verificata alla
 * risoluzione — se domani non esiste piu' un capo con sottoposti, questo file si ferma
 * dicendo cosa manca, invece di misurare un caso limite in silenzio.
 */
const ATTORI = await attoriDiScena();


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

/**
 * I riporti secondo l'albero delle POSIZIONI (`position_reports_to_position_id`), che dal
 * 2026-08-14 NON è più la fonte del perimetro. Serve a tenere il vincolo verificabile: senza
 * un universo non vuoto, l'asserzione «vede solo sé stesso» non distinguerebbe una regola che
 * funziona da una che non ha nulla da negare.
 */
async function reportsNellAlberoDellePosizioni(userId: string): Promise<string[]> {
  const r = await pool.query<{ user_id: string }>(
    `WITH RECURSIVE mie AS (
       SELECT a.user_position_assignment_position_id AS pid
         FROM sys.sys_user_position_assignments a
        WHERE a.user_position_assignment_user_id = $1
          AND a.user_position_assignment_status = 'ACTIVE'
     ),
     sotto AS (
       SELECT p.position_id AS pid
         FROM sys.sys_positions p JOIN mie m ON p.position_reports_to_position_id = m.pid
       UNION
       SELECT p.position_id
         FROM sys.sys_positions p JOIN sotto s ON p.position_reports_to_position_id = s.pid
     )
     SELECT DISTINCT a.user_position_assignment_user_id AS user_id
       FROM sys.sys_user_position_assignments a
       JOIN sotto s ON s.pid = a.user_position_assignment_position_id
      WHERE a.user_position_assignment_status = 'ACTIVE'
        AND a.user_position_assignment_user_id <> $1`,
    [userId],
  );
  return r.rows.map((x) => x.user_id);
}

/** Dirige almeno un'unità dell'organigramma: dal 2026-08-14 è QUESTO il segnale di capo. */
async function dirigeUnUnita(userId: string): Promise<boolean> {
  const r = await pool.query<{ hit: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM sys.sys_organization_units
                     WHERE organization_unit_manager_user_id = $1
                       AND organization_unit_is_active) AS hit`,
    [userId],
  );
  return r.rows[0]?.hit ?? false;
}

describe("scope/resolver — org read scope + managerial constraint (F1, ADR-0027)", () => {
  let admin: ActorContext;
  let federica: ActorContext;
  let paolo: ActorContext;
  let tommaso: ActorContext;
  let antonio: ActorContext;

  beforeAll(async () => {
    [admin, federica, paolo] = await Promise.all([
      actorFor(ATTORI.piattaforma.email),
      actorFor(ATTORI.hr.email),
      actorFor(ATTORI.capo.email),
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

  it("VINCOLO: chi non dirige un'unità vede solo sé stesso — anche con riporti fra le POSIZIONI", async () => {
    // [#99 F3, decisione di Enzo 2026-08-14] Il capo è chi dirige un'unità
    // dell'organigramma; il ruolo RBAC è un'aggiunta, non una condizione. La stesura
    // precedente derivava «ha riporti» da `orgSubtreeUserIds`, che ora percorre le UNITÀ:
    // l'universo si sarebbe svuotato e il test sarebbe passato senza guardare niente.
    // L'universo si deriva quindi dall'albero delle POSIZIONI, che esiste ancora nei dati
    // ed è esattamente ciò che NON deve più aprire un perimetro.
    const riportiPosizionali = await reportsNellAlberoDellePosizioni(tommaso.userId);
    expect(riportiPosizionali.length).toBeGreaterThan(0); // la fixture li ha creati davvero
    expect(await dirigeUnUnita(tommaso.userId)).toBe(false); // e non dirige nulla

    const s = await resolveOrgReadScope(pool, tommaso);
    expect(s.kind).toBe("self");
    if (s.kind === "self") expect(s.userIdAllowList).toEqual([tommaso.userId]);
  });

  it("canReadOrgTarget: a manager reads a report, not an outsider", async () => {
    expect(await canReadOrgTarget(pool, paolo, tommaso.userId, paolo.tenantId)).toBe(true);
    expect(await canReadOrgTarget(pool, paolo, antonio.userId, paolo.tenantId)).toBe(false);
  });

  it("VINCOLO: e non legge la scheda di quel riporto — solo la propria", async () => {
    const riportiPosizionali = await reportsNellAlberoDellePosizioni(tommaso.userId);
    expect(riportiPosizionali.length).toBeGreaterThan(0);
    expect(await canReadOrgTarget(pool, tommaso, riportiPosizionali[0]!, tommaso.tenantId)).toBe(false);
    expect(await canReadOrgTarget(pool, tommaso, tommaso.userId, tommaso.tenantId)).toBe(true);
  });
});
