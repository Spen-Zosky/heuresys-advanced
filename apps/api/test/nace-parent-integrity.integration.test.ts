/**
 * apps/api/test/nace-parent-integrity.integration.test.ts
 * #65 / audit F-A06 (mig 000187) — prospective parent integrity on the
 * NACE/ATECO adjacency: new orphan rows are REJECTED by the NOT VALID
 * composite FK, valid children pass, and the monitoring view reports zero
 * orphans outside the documented ATECO-partial exception.
 */
import { describe, it, expect, afterAll } from "vitest";
import { pool, closePool } from "../src/db/client.js";

describe("#65 activity-classification parent integrity (mig 000187)", () => {
  afterAll(async () => {
    await closePool();
  });

  it("a NEW row with a non-existent parent is rejected (FK, prospective enforcement)", async () => {
    await expect(
      pool.query(
        `INSERT INTO sys.sys_activity_classifications
           (activity_classification_scheme, activity_classification_code,
            activity_classification_parent_code, activity_classification_name,
            activity_classification_level)
         VALUES ('NACE', 'ZZ.99', 'ZZ', 'orphan probe', 2)`,
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("a NEW row with an existing parent is accepted", async () => {
    const parent = await pool.query<{ code: string; lvl: number }>(
      `SELECT activity_classification_code AS code, activity_classification_level AS lvl
         FROM sys.sys_activity_classifications
        WHERE activity_classification_scheme = 'NACE' AND activity_classification_level = 1
        LIMIT 1`,
    );
    const p = parent.rows[0]!;
    const ins = await pool.query(
      `INSERT INTO sys.sys_activity_classifications
         (activity_classification_scheme, activity_classification_code,
          activity_classification_parent_code, activity_classification_name,
          activity_classification_level)
       VALUES ('NACE', 'ZZ.OK', $1, 'valid child probe', $2)
       RETURNING activity_classification_id`,
      [p.code, p.lvl + 1],
    );
    expect(ins.rows.length).toBe(1);
    // D-52 rolls the file tx back — no residue on the shared DB.
  });

  it("the monitoring view reports ZERO orphans outside the documented ATECO-partial exception", async () => {
    const res = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.v_activity_classification_parent_orphans`,
    );
    expect(res.rows[0]!.n).toBe(0);
  });

  it("the documented exception is exactly the 920 ATECO level-5 legacy rows (drift tripwire)", async () => {
    const res = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n
         FROM sys.sys_activity_classifications c
        WHERE c.activity_classification_parent_code IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM sys.sys_activity_classifications p
             WHERE p.activity_classification_scheme = c.activity_classification_scheme
               AND p.activity_classification_code   = c.activity_classification_parent_code)`,
    );
    // if this number MOVES, either legacy rows were touched or a new orphan
    // class appeared with the FK disabled — both demand investigation.
    expect(res.rows[0]!.n).toBe(920);
  });
});
