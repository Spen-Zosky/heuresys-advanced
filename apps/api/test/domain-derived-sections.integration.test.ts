/**
 * apps/api/test/domain-derived-sections.integration.test.ts
 *
 * #119 — the administrative sections are offered on DOMAINS, not on a list of
 * role names.
 *
 * THE TRAP THIS FILE IS BUILT AROUND. The obvious assertion — "the CEO sees the
 * admin sections" — does NOT discriminate: the only CEO in the data also holds
 * `TENANT_ADMIN`, so she passes even under the old hand-written list. The lab
 * flagged the same masking on #116. The discriminating population is the people
 * who hold a DOMAIN but NONE of the seven roles the old list named: if anyone
 * re-introduces a role list, those people lose their sections and this file goes
 * red. Measured on the live map 2026-08-04: 37 such people.
 *
 * Every actor here is DERIVED from the database. No email, no role name and no
 * expected count is written into this file.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";
import { meService } from "../src/modules/me/service.js";
import { scopeTierOf, activeDomainsOf, NoScopeTierError } from "../src/lib/scope/domains.js";
import type { RoleCode } from "../src/config/constants.js";

/** The seven role names the retired `UI_ADMIN_ROLES` listed — named ONLY so the
 *  test can select the population the list would have excluded. */
const RETIRED_ADMIN_LIST = [
  "PLATFORM_ADMIN", "TENANT_ADMIN", "BLUEPRINT_MANAGER",
  "HRMS_MANAGER", "PROCESS_OWNER", "MANAGER", "ORG_DIRECTOR",
];

interface Candidate {
  user_id: string;
  user_email: string;
  tenant_id: string;
  roles: string[];
}

/** Active users, with their roles and whether the data gives them any domain. */
async function candidates(sql: string, params: unknown[] = []): Promise<Candidate[]> {
  const { rows } = await pool.query<Candidate>(sql, params);
  return rows;
}

const DOMAIN_PREDICATE = `(
     EXISTS (SELECT 1 FROM sys.sys_organization_units o
              WHERE o.organization_unit_manager_user_id = u.user_id AND o.organization_unit_is_active)
  OR EXISTS (SELECT 1 FROM sys.sys_teams t WHERE t.team_lead_user_id = u.user_id)
  OR EXISTS (SELECT 1 FROM sys.sys_process_participants p
              WHERE p.process_participant_user_id = u.user_id
                AND p.process_participant_role = 'OWNER' AND p.process_participant_is_active)
  OR EXISTS (SELECT 1 FROM sys.sys_user_auth_roles ur
               JOIN sys.sys_auth_roles rr ON rr.auth_role_id = ur.user_auth_role_role_id
              WHERE ur.user_auth_role_user_id = u.user_id AND ur.user_auth_role_revoked_at IS NULL
                AND rr.auth_role_code IN ('PLATFORM_ADMIN','TENANT_ADMIN','HRMS_MANAGER'))
)`;

const BASE = `
  SELECT u.user_id, u.user_email, u.user_tenant_id AS tenant_id,
         array_agg(r.auth_role_code::text ORDER BY r.auth_role_code) AS roles
    FROM sys.sys_users u
    JOIN sys.sys_user_auth_roles uar
      ON uar.user_auth_role_user_id = u.user_id AND uar.user_auth_role_revoked_at IS NULL
    JOIN sys.sys_auth_roles r ON r.auth_role_id = uar.user_auth_role_role_id
   WHERE u.user_status = 'ACTIVE'`;

let t: TestApp;
/** People with a domain but none of the retired list's roles — the discriminating set. */
let gainers: Candidate[] = [];
/** People with no domain at all. */
let domainless: Candidate[] = [];
/** Whoever holds the CEO role, however many that is. */
let ceos: Candidate[] = [];

function actorOf(c: Candidate) {
  return { userId: c.user_id, tenantId: c.tenant_id, roles: c.roles as RoleCode[] };
}

/**
 * Codes of the sidebar entries that carry `requires_admin`. Read from the DB
 * once — counting ALL returned entries would be useless, because the five
 * sections are always returned and the ESS entries are always visible, so the
 * total is never zero no matter which gate is in force. (That mistake was made
 * and caught here: the first version of this file passed while a hard-coded role
 * list was deliberately re-introduced.)
 */
let adminCodes = new Set<string>();

async function adminSectionCount(c: Candidate): Promise<number> {
  const res = await meService.getInterfaces(actorOf(c));
  return res.perspectives.reduce(
    (n, p) => n + p.interfaces.filter((i) => adminCodes.has(i.code)).length,
    0,
  );
}

beforeAll(async () => {
  t = await buildTestApp();
  const { rows: adminRows } = await pool.query<{ code: string }>(
    `SELECT ui_interface_code AS code FROM sys.sys_ui_interfaces
      WHERE ui_interface_is_active AND ui_interface_requires_admin`,
  );
  adminCodes = new Set(adminRows.map((r) => r.code));
  gainers = await candidates(
    `${BASE} AND ${DOMAIN_PREDICATE}
       AND NOT EXISTS (SELECT 1 FROM sys.sys_user_auth_roles ur2
                         JOIN sys.sys_auth_roles rr2 ON rr2.auth_role_id = ur2.user_auth_role_role_id
                        WHERE ur2.user_auth_role_user_id = u.user_id
                          AND ur2.user_auth_role_revoked_at IS NULL
                          AND rr2.auth_role_code = ANY($1::text[]))
     GROUP BY u.user_id, u.user_email, u.user_tenant_id`,
    [RETIRED_ADMIN_LIST],
  );
  domainless = await candidates(
    `${BASE} AND NOT ${DOMAIN_PREDICATE}
     GROUP BY u.user_id, u.user_email, u.user_tenant_id`,
  );
  ceos = await candidates(
    `${BASE} AND EXISTS (SELECT 1 FROM sys.sys_user_auth_roles ur3
                           JOIN sys.sys_auth_roles rr3 ON rr3.auth_role_id = ur3.user_auth_role_role_id
                          WHERE ur3.user_auth_role_user_id = u.user_id
                            AND ur3.user_auth_role_revoked_at IS NULL
                            AND rr3.auth_role_code = 'CEO')
     GROUP BY u.user_id, u.user_email, u.user_tenant_id`,
  );
});

afterAll(async () => {
  await t.app.close();
  await closePool();
});

describe("#119 — the sections follow the domains", () => {
  it("runs on a universe where it CAN fail", () => {
    expect(gainers.length,
      "nobody holds a domain outside the retired role list — re-hardcoding it would pass unnoticed",
    ).toBeGreaterThan(0);
    expect(domainless.length,
      "everybody holds a domain — the negative half of the rule is untested",
    ).toBeGreaterThan(0);
    expect(ceos.length, "no CEO in the data").toBeGreaterThan(0);
    expect(adminCodes.size,
      "no sidebar entry is flagged requires_admin — the admin counter would always read zero",
    ).toBeGreaterThan(0);
  });

  /**
   * The discriminating assertion. These people are invisible to any role list:
   * a unit manager whose only roles are TEAM_LEADER/TEAM_MEMBER/USER. They hold
   * the sections because of what they RUN.
   */
  it("offers sections to people whose only claim is a domain", async () => {
    const empty: string[] = [];
    for (const c of gainers) {
      if ((await adminSectionCount(c)) === 0) empty.push(c.user_email);
    }
    expect(empty,
      "these people hold a domain and were offered nothing — a role list is back in the path",
    ).toEqual([]);
  });

  it("gives every one of them a domain the data can name", async () => {
    for (const c of gainers) {
      const domains = await activeDomainsOf(pool, actorOf(c));
      expect(domains.size, `${c.user_email} was selected as a domain holder but resolves to none`)
        .toBeGreaterThan(0);
    }
  });

  /** The CEO, stated as the closure criterion words it — without CEO appearing
   *  anywhere in the decision. It passes because she manages an org unit. */
  it("gives the CEO the administrative sections", async () => {
    for (const c of ceos) {
      const domains = await activeDomainsOf(pool, actorOf(c));
      expect(domains.has("line_management"), `${c.user_email} runs no org unit`).toBe(true);
      expect(await adminSectionCount(c)).toBeGreaterThan(0);
    }
  });

  /** #119 D4 — the fallback is gone: no silent tier for someone with no domain. */
  it("refuses a scope tier instead of quietly returning TEAM", async () => {
    const c = domainless[0]!;
    await expect(scopeTierOf(pool, actorOf(c), "dashboard")).rejects.toThrow(NoScopeTierError);
  });

  /** ...and still places everyone who does hold one. */
  it("places every domain holder on a tier", async () => {
    for (const c of gainers) {
      await expect(scopeTierOf(pool, actorOf(c), "dashboard")).resolves.toBeTruthy();
    }
  });
});
