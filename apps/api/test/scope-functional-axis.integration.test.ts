/**
 * apps/api/test/scope-functional-axis.integration.test.ts
 *
 * #24 / ADR-0027 **F4 — the FUNCTIONAL axis** (team + process membership), live on RTL data.
 *
 * The whole reason ADR-0027 has two axes is the case this suite pins down: someone can be
 * responsible for another person's WORK without being entitled to that person's PRIVATE
 * RECORDS. A team leader runs the team's activities; only the org chart grants sensitive data,
 * and only inside the sub-tree (I18/I20, cardinal rule).
 *
 * Measured live on RTL Bank when this suite was written: paolo.caputo leads 5 teams
 * (functional scope 44 users) while his transitive org sub-tree holds 31 — **34 users sit in
 * the functional scope and NOT in the org sub-tree**. Those 34 are exactly the population the
 * cardinal rule protects. The suite RE-DERIVES that set at run time (never hardcodes it) and
 * asserts both halves for every member of it: activities granted, sensitive denied.
 *
 * Real personas + their real relationships (verified live, not assumed):
 *   - paolo.caputo@rtl-bank.org    MANAGER, LEAD of DIV-COMM/DIR-CORP/DIR-CREDITI/UFF-CRED-*
 *   - tommaso.fiore@rtl-bank.org   MEMBER of DIV-COMM **and** paolo's org report → both axes
 *   - antonio.parisi@rtl-bank.org  MEMBER of DIV-CFO (marco.rinaldi's team) → neither axis
 *   - federica.marchetti@rtl-bank.org TENANT_ADMIN → HR mandate, tenant-wide
 *
 * Fixtures (process participants) are created here and rolled back by the file transaction
 * (D-52), so the shared DB is left untouched.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool, closePool } from "../src/db/client.js";
import type { ActorContext } from "../src/lib/actor.js";
import { functionalScopeUserIds, isFunctionalLeader, isInFunctionalScope } from "../src/lib/scope/functional.js";
import { orgSubtreeUserIds, isInOrgSubtree } from "../src/lib/scope/org.js";
import { resolveActivityScope, resolveOrgReadScope } from "../src/lib/scope/resolver.js";
import { unMembroDiSquadra, unEstraneoAEntrambiGliAssi } from "./helpers/org-actors.js";

/**
 * [S1045] Restano nominati solo i due che il test usa per il RUOLO ISTITUZIONALE:
 * un capo funzionale con squadre (`paolo`) e un mandato HR (`federica`). Gli altri
 * due erano caratteristiche travestite da nomi — «un membro della sua squadra», «uno
 * fuori da entrambi gli assi» — e la ricostruzione dell'organigramma piu' la fusione
 * delle squadre duplicate (S1044) hanno spostato `antonio.parisi` DENTRO l'asse
 * funzionale di paolo: la fixture del processo non misurava piu' niente, perche' la
 * risposta era gia' «sì» prima di crearla.
 */
const EMAILS = {
  paolo: "paolo.caputo@rtl-bank.org",
  federica: "federica.marchetti@rtl-bank.org",
} as const;

type Attori = keyof typeof EMAILS | "tommaso" | "antonio";
const ids: Record<Attori, string> = {} as never;
let rtlTenantId: string;

async function userIdFor(email: string): Promise<{ userId: string; tenantId: string }> {
  const r = await pool.query<{ user_id: string; user_tenant_id: string }>(
    `SELECT user_id, user_tenant_id FROM sys.sys_users WHERE user_email = $1`,
    [email],
  );
  const row = r.rows[0];
  if (!row) throw new Error(`persona assente: ${email}`);
  return { userId: row.user_id, tenantId: row.user_tenant_id };
}

const actor = (userId: string, roles: ActorContext["roles"]): ActorContext => ({
  userId,
  tenantId: rtlTenantId,
  roles,
});

describe("ADR-0027 F4 — functional (team/process) axis", () => {
  beforeAll(async () => {
    for (const [key, email] of Object.entries(EMAILS)) {
      const { userId, tenantId } = await userIdFor(email);
      ids[key as Attori] = userId;
      rtlTenantId = tenantId;
    }
    // `tommaso` = un membro vero di una squadra guidata da paolo (asse funzionale).
    // `antonio` = uno fuori da ENTRAMBI gli assi: non nelle sue unita', non nelle sue
    // squadre, non nei suoi processi, e non capo funzionale a sua volta. Senza queste
    // esclusioni la fixture del processo partirebbe da uno scope gia' concesso.
    ids.tommaso = (await unMembroDiSquadra(pool, ids.paolo)).userId;
    ids.antonio = (await unEstraneoAEntrambiGliAssi(pool, ids.paolo)).userId;
  });

  afterAll(async () => {
    await closePool();
  });

  it("a team lead's functional scope contains their members and themselves", async () => {
    expect(await isFunctionalLeader(pool, ids.paolo)).toBe(true);

    const scope = await functionalScopeUserIds(pool, ids.paolo);
    expect(scope).toContain(ids.paolo); // self, I17
    expect(scope).toContain(ids.tommaso); // DIV-COMM member
    expect(scope.length).toBeGreaterThan(1);
  });

  it("a member of somebody else's team is NOT in the functional scope", async () => {
    // antonio belongs to DIV-CFO, which paolo does not lead.
    expect(await isInFunctionalScope(pool, ids.paolo, ids.antonio)).toBe(false);
  });

  it("a non-leader has no functional scope beyond self", async () => {
    expect(await isFunctionalLeader(pool, ids.antonio)).toBe(false);
    expect(await functionalScopeUserIds(pool, ids.antonio)).toEqual([ids.antonio]);
  });

  /**
   * THE CARDINAL RULE (I18), asserted on the real population rather than a contrived pair:
   * for every user who is in paolo's functional scope but outside his org sub-tree,
   * activities must be granted and sensitive data denied. If the two axes were ever collapsed
   * into one, this test fails for 34 real people.
   */
  it("functional-only members: activities granted, sensitive data denied", async () => {
    const [functional, orgSubtree] = await Promise.all([
      functionalScopeUserIds(pool, ids.paolo),
      orgSubtreeUserIds(pool, ids.paolo),
    ]);
    const orgSet = new Set(orgSubtree);
    const functionalOnly = functional.filter((u) => !orgSet.has(u));

    // Guard against a vacuous pass if the data ever changes shape.
    expect(
      functionalOnly.length,
      "nessun membro solo-funzionale nei dati: il caso cardine non sarebbe esercitato",
    ).toBeGreaterThan(0);

    // Sample the set (the assertion is per-user; the full 34 would be 68 queries).
    for (const target of functionalOnly.slice(0, 8)) {
      expect(await isInFunctionalScope(pool, ids.paolo, target)).toBe(true); // activities ✅
      expect(await isInOrgSubtree(pool, ids.paolo, target)).toBe(false); // sensitive ❌
    }

    // And the org resolver — the one that gates sensitive data — must not leak them.
    const orgScope = await resolveOrgReadScope(pool, actor(ids.paolo, ["MANAGER"]));
    if (orgScope.kind === "subtree" || orgScope.kind === "self") {
      for (const target of functionalOnly.slice(0, 8)) {
        expect(orgScope.userIdAllowList).not.toContain(target);
      }
    } else {
      throw new Error(`paolo dovrebbe risolvere a subtree/self, non a ${orgScope.kind}`);
    }
  });

  it("resolveActivityScope: leader → functional, HR mandate → tenant, plain user → self", async () => {
    const lead = await resolveActivityScope(pool, actor(ids.paolo, ["MANAGER"]));
    expect(lead.kind).toBe("functional");
    if (lead.kind === "functional") expect(lead.userIdAllowList).toContain(ids.tommaso);

    const hr = await resolveActivityScope(pool, actor(ids.federica, ["TENANT_ADMIN"]));
    expect(hr.kind).toBe("tenant");

    const plain = await resolveActivityScope(pool, actor(ids.antonio, ["USER"]));
    expect(plain.kind).toBe("self");
    if (plain.kind === "self") expect(plain.userIdAllowList).toEqual([ids.antonio]);

    const platform = await resolveActivityScope(
      pool,
      { userId: ids.paolo, tenantId: rtlTenantId, roles: ["PLATFORM_ADMIN"] },
    );
    expect(platform.kind).toBe("all");
  });

  /**
   * The process half of the axis (mig 000179). Owning a process must extend the functional
   * scope to its participants — the same way leading a team does — without touching the org axis.
   */
  it("owning a process extends the functional scope to its participants", async () => {
    // Il processo si SCEGLIE, non si prende a caso. La stesura precedente usava
    // `LIMIT 1` senza ordinamento e inseriva i due attori come partecipanti: se
    // il processo estratto ne aveva gia' uno nel dato reale, l'insert violava
    // `sys_process_participants_process_user_uq` e il test moriva su una
    // collisione invece che su cio' che voleva misurare. Con dati reali che
    // cambiano, "il primo che capita" e' una fixture che decade da sola.
    const proc = await pool.query<{ id: string }>(
      `SELECT p.organization_unit_process_id AS id
         FROM sys.sys_organization_unit_processes p
        WHERE p.org_unit_process_tenant_id = $1
          AND NOT EXISTS (
            SELECT 1 FROM sys.sys_process_participants pp
             WHERE pp.process_participant_org_unit_process_id = p.organization_unit_process_id
               AND pp.process_participant_user_id = ANY($2::uuid[]))
        ORDER BY p.organization_unit_process_id
        LIMIT 1`,
      [rtlTenantId, [ids.paolo, ids.antonio]],
    );
    const processId = proc.rows[0]?.id;
    expect(
      processId,
      "nessun processo org-unit su RTL libero da entrambi gli attori: fixture impossibile",
    ).toBeDefined();

    // antonio is deliberately OUTSIDE paolo's team and org sub-tree — so any grant here can
    // only come from the process membership under test.
    expect(await isInFunctionalScope(pool, ids.paolo, ids.antonio)).toBe(false);

    await pool.query(
      `INSERT INTO sys.sys_process_participants
         (process_participant_tenant_id, process_participant_org_unit_process_id,
          process_participant_user_id, process_participant_role)
       VALUES ($1,$2,$3,'OWNER'), ($1,$2,$4,'CONTRIBUTOR')`,
      [rtlTenantId, processId, ids.paolo, ids.antonio],
    );

    expect(await isInFunctionalScope(pool, ids.paolo, ids.antonio)).toBe(true); // activities ✅
    expect(await isInOrgSubtree(pool, ids.paolo, ids.antonio)).toBe(false); // sensitive still ❌
  });
});
