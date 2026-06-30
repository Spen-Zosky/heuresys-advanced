/**
 * apps/api/test/scope-org.integration.test.ts — F0 of ADR-0027 (organizational axis).
 *
 * Verifies the recursive org-chart helpers against the REAL RTL hierarchy (no mocks, no
 * hardcoded counts — only invariants derived from real reporting edges):
 *   federica.marchetti ← paolo.caputo ← tommaso.fiore   (a real 2-level chain)
 *   antonio.parisi reports into a DIFFERENT branch (claudia.serra)
 * The transitive assertions (2-hop) are what distinguishes the new chain from the old
 * one-hop `getManagerTeamUserIds` walk.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { pool } from "../src/db/client.js";
import { orgSubtreeUserIds, orgAncestorUserIds, isInOrgSubtree } from "../src/lib/scope/org.js";

async function uid(email: string): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `SELECT user_id AS id FROM sys.sys_users WHERE user_email = $1`,
    [email],
  );
  const id = r.rows[0]?.id;
  if (!id) throw new Error(`fixture user not found: ${email}`);
  return id;
}

describe("scope/org — organizational axis (F0, ADR-0027)", () => {
  let federica: string;
  let paolo: string;
  let tommaso: string;
  let antonio: string;

  beforeAll(async () => {
    [federica, paolo, tommaso, antonio] = await Promise.all([
      uid("federica.marchetti@rtl-bank.org"),
      uid("paolo.caputo@rtl-bank.org"),
      uid("tommaso.fiore@rtl-bank.org"),
      uid("antonio.parisi@rtl-bank.org"),
    ]);
  });

  it("sub-tree includes self + a direct report, excludes an outsider", async () => {
    const sub = await orgSubtreeUserIds(pool, paolo);
    expect(sub).toContain(paolo); // self always present
    expect(sub).toContain(tommaso); // real direct report
    expect(sub).not.toContain(antonio); // different org branch
  });

  it("sub-tree is TRANSITIVE — federica → paolo → tommaso (2 hops)", async () => {
    const sub = await orgSubtreeUserIds(pool, federica);
    expect(sub).toContain(paolo); // 1 hop
    expect(sub).toContain(tommaso); // 2 hops — the old one-hop walk would MISS this
  });

  it("ancestors are transitive — tommaso's managers include paolo AND federica, not self", async () => {
    const anc = await orgAncestorUserIds(pool, tommaso);
    expect(anc).toContain(paolo); // direct manager
    expect(anc).toContain(federica); // 2-hop manager
    expect(anc).not.toContain(tommaso); // ancestors exclude self
  });

  it("peer isolation — an outsider's ancestors exclude paolo (different tree)", async () => {
    const anc = await orgAncestorUserIds(pool, antonio);
    expect(anc).not.toContain(paolo);
  });

  it("isInOrgSubtree — report yes, outsider no, self yes (the cardinal-rule predicate)", async () => {
    expect(await isInOrgSubtree(pool, paolo, tommaso)).toBe(true);
    expect(await isInOrgSubtree(pool, paolo, antonio)).toBe(false);
    expect(await isInOrgSubtree(pool, paolo, paolo)).toBe(true);
  });

  it("integrity — no position reports to itself (recursion cycle-guard precondition)", async () => {
    const r = await pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM sys.sys_positions WHERE position_reports_to_position_id = position_id`,
    );
    expect(Number(r.rows[0]?.n ?? 0)).toBe(0);
  });
});
