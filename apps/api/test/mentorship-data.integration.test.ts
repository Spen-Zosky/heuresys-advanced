import { describe, it, expect } from "vitest";
import { pool } from "../src/db/client.js";

// S970 #2·m1 — data-level validation of the mentorship import (migration 000072 + seed 45).
// No app/login: queries the live pool directly. RTL-only landing; employee-centric (I14); ESCO-URI skill bridge.

const RTL = "86ba7a65-217f-48ba-8ce5-5c09b40a66b0";
const count = async (sql: string, params: unknown[] = []): Promise<number> => {
  const { rows } = await pool.query<{ n: number }>(sql, params);
  return rows[0]?.n ?? -1;
};

describe("mentorship import (data-level)", () => {
  it("landed the measured RTL row counts (5 / 63 / 150 / 30)", async () => {
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_mentorship_programs`)).toBe(5);
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_mentorships`)).toBe(63);
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_mentorship_sessions`)).toBe(150);
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_mentor_match_scores`)).toBe(30);
  });

  it("I5 tenant isolation — every row belongs to the RTL tenant (no RLS)", async () => {
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_mentorship_programs WHERE program_tenant_id <> $1`, [RTL])).toBe(0);
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_mentorships WHERE mentorship_tenant_id <> $1`, [RTL])).toBe(0);
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_mentorship_sessions WHERE session_tenant_id <> $1`, [RTL])).toBe(0);
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_mentor_match_scores WHERE match_tenant_id <> $1`, [RTL])).toBe(0);
  });

  it("I14 person FK resolution — mentor/mentee resolve to real sys_users (100% in RTL)", async () => {
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_mentorships WHERE mentorship_mentor_user_id IS NOT NULL`)).toBe(63);
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_mentorships WHERE mentorship_mentee_user_id IS NOT NULL`)).toBe(63);
    // no orphan person FK (every non-null FK points at a real user)
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_mentorships m
      WHERE m.mentorship_mentor_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.sys_users u WHERE u.user_id=m.mentorship_mentor_user_id)`)).toBe(0);
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_mentorships m
      WHERE m.mentorship_mentee_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.sys_users u WHERE u.user_id=m.mentorship_mentee_user_id)`)).toBe(0);
  });

  it("skill FK resolves via the ESCO-URI bridge (30/30) — not dropped to NULL", async () => {
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_mentor_match_scores WHERE match_skill_id IS NOT NULL`)).toBe(30);
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_mentor_match_scores m
      WHERE m.match_skill_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.sys_skills s WHERE s.skill_id=m.match_skill_id)`)).toBe(0);
  });

  it("sessions are CASCADE children of pairings — every parent resolves", async () => {
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_mentorship_sessions s
      WHERE NOT EXISTS (SELECT 1 FROM sys.sys_mentorships m WHERE m.mentorship_id=s.session_mentorship_id)`)).toBe(0);
  });

  it("provenance recorded — every row carries its legacy id in metadata", async () => {
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_mentorships WHERE mentorship_metadata->>'legacy_mentorship_id' IS NULL`)).toBe(0);
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_mentor_match_scores WHERE match_metadata->>'legacy_match_id' IS NULL`)).toBe(0);
  });

  it("reconciliation registry — 4 mentorship tables POPULATED, 0 UNCLASSIFIED", async () => {
    expect(await count(`SELECT count(*)::int AS n FROM sys.v_reconciliation_status
      WHERE table_name IN ('sys_mentorship_programs','sys_mentorships','sys_mentorship_sessions','sys_mentor_match_scores')
        AND resolved_status='POPULATED'`)).toBe(4);
    expect(await count(`SELECT count(*)::int AS n FROM sys.v_reconciliation_status WHERE resolved_status='UNCLASSIFIED'`)).toBe(0);
  });
});
