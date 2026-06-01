#!/usr/bin/env python3
"""B-51 generator: re-derive the 162 RTL/Heuresys position_title + wire position_job_role_id
from the REAL legacy profession (employees.job_title), employee-centric (ADR-0024 / I14).

Reads:
  - db/seeds/rtl-rebuild/extracted/employees.csv  (gitignored no-PII extract, ADR-0023)
  - sys.sys_positions live (via psql, tunnel :5433) for position_metadata->>'legacy_employee_id'
Writes:
  - db/migrations/000048_b51_rederive_position_titles_and_job_roles.sql  (self-contained, baked VALUES)

The map is baked as static rows so the migration is CI-reproducible (no \\copy, no file dep at apply time).
Re-run this generator to regenerate 000048 after a fresh legacy extract.
"""
import csv, re, subprocess, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))  # repo root (file is at db/seeds/rtl-rebuild/)
CSV  = os.path.join(ROOT, 'db', 'seeds', 'rtl-rebuild', 'extracted', 'employees.csv')
OUT  = os.path.join(ROOT, 'db', 'migrations', '000048_b51_rederive_position_titles_and_job_roles.sql')

# Explicit canonical normalization of the 25 distinct legacy job_titles (evidence-only; NO
# heuristic title-caser, which would mangle acronyms 'IT Director'->'It Director' and
# 'CEO & Founder'->'Ceo & Founder'). The 7 lowercase legacy values are proper-cased; the
# other 18 are already canonical (identity).
CANON = {
    'Risk analyst': 'Risk Analyst',
    'Bank teller': 'Bank Teller',
    'Financial analyst': 'Financial Analyst',
    'Compliance officer': 'Compliance Officer',
    'Bank manager': 'Bank Manager',
    'Investment advisor': 'Investment Advisor',
    'Securities dealer': 'Securities Dealer',
    'Back Office Specialist': 'Back Office Specialist',
    'Software Developer': 'Software Developer',
    'Payment Specialist': 'Payment Specialist',
    'Operations Director': 'Operations Director',
    'IT Director': 'IT Director',
    'System Administrator': 'System Administrator',
    'HR Director': 'HR Director',
    'Head of Product': 'Head of Product',
    'Chief Risk Officer': 'Chief Risk Officer',
    'CEO & Founder': 'CEO & Founder',
    'CEO': 'CEO',
    'COO': 'COO',
    'Line Manager - Operations': 'Line Manager - Operations',
    'HR Manager': 'HR Manager',
    'Retail Director': 'Retail Director',
    'Tenant Owner': 'Tenant Owner',
    'Finance Director': 'Finance Director',
    'Head of Commercial Banking': 'Head of Commercial Banking',
}


def code_for(canon: str) -> str:
    slug = re.sub(r'[^A-Za-z0-9]+', '-', canon).strip('-').upper()
    return 'RTL-ROLE-' + slug


def q(s: str) -> str:
    return s.replace("'", "''")


def main() -> int:
    emp = {}
    with open(CSV, newline='', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            emp[row['id']] = row['job_title']

    raw = subprocess.run(
        ['psql', '-h', 'localhost', '-p', '5433', '-U', 'heuresys', '-d', 'heuresys_advanced',
         '-tAF', '\t', '-c',
         "SELECT position_metadata->>'legacy_employee_id', position_id::text, position_title "
         "FROM sys.sys_positions ORDER BY 1"],
        capture_output=True, text=True, check=True,
    ).stdout

    positions = [ln.split('\t') for ln in raw.splitlines() if ln.strip()]

    rows, unmatched, uncanon = [], [], set()
    for parts in positions:
        lid = parts[0]
        cur = parts[2] if len(parts) > 2 else ''
        legacy = emp.get(lid)
        if legacy is None:
            unmatched.append(lid); continue
        canon = CANON.get(legacy)
        if canon is None:
            uncanon.add(legacy); continue
        rows.append((lid, canon, code_for(canon), legacy))

    assert not unmatched, f"UNMATCHED positions (no CSV employee): {unmatched}"
    assert not uncanon, f"RAW job_titles missing from CANON map: {sorted(uncanon)}"
    assert len(rows) == 162, f"expected 162 positions, got {len(rows)}"
    assert len({r[0] for r in rows}) == 162, "legacy_employee_id not 1:1 across positions"
    roles = sorted({(c, n, lg) for (_, n, c, lg) in rows})
    assert len(roles) == 25, f"expected 25 distinct roles, got {len(roles)}"

    values = ",\n".join(
        f"  ('{lid}', '{q(canon)}', '{code}', '{q(lg)}')" for (lid, canon, code, lg) in rows
    )

    sql = f"""-- 000048_b51_rederive_position_titles_and_job_roles.sql
-- B-51 (2026-06-01): re-derive the 162 RTL/Heuresys position_title and wire
-- position_job_role_id from the REAL legacy profession (employees.job_title), employee-centric.
--
-- DOCTRINE (ADR-0024 / I14): the person is legacy `employees`, not `users`. Each v5 position
-- already carries its incumbent's legacy id at position_metadata->>'legacy_employee_id'
-- (162/162 present, verified 162/162 exact join). We join that to legacy employees.job_title
-- to obtain the real profession. The previous P2 proposal was INVALIDATED (it keyed the
-- pre-000046 user-centric graph); this is re-derived from zero on the post-000046 graph.
--
-- SOURCE: db/seeds/rtl-rebuild/extracted/employees.csv (gitignored generated extract,
-- synthetic no-PII data per ADR-0023). The legacy_employee_id -> (title, role) map is baked as
-- static rows below so the migration is self-contained and CI-reproducible (no \\copy, no
-- external-file dependency at apply time). Regenerate via
-- db/seeds/rtl-rebuild/11_rederive_b51_titles_roles.py.
--
-- The 7 coarse v5 buckets (Compliance Officer / Risk Analyst / Financial Analyst / Bank Manager
-- / Bank Teller / Investment Advisor / Security Specialist) are replaced by the 25 real
-- fine-grained titles (e.g. Security Specialist -> Securities Dealer; the Compliance Officer
-- bucket splits into Compliance Officer / Back Office Specialist / Payment Specialist). The
-- coarse bucket stays in position_metadata.legacy_position_text for lineage.
--
-- 25 new job_roles use the distinctive GLOBAL code prefix RTL-ROLE-<SLUG> (0 pre-existing,
-- verified) with job_role_family_id = NULL and job_role_seniority_level = NULL (evidence-only:
-- the legacy data carries no reliable family/seniority signal -- no guessing). The 202
-- pre-existing roles (incl. 91 corrupt OLDDB::) are intentionally NOT touched (P3/B-50 scope).
--
-- IDEMPOTENT: roles INSERT ... ON CONFLICT (job_role_code) DO NOTHING; position UPDATEs guarded
-- by IS DISTINCT FROM. Second run = 0 mutations = empty pg_dump diff. Applied by migrate.sh
-- under `psql -1 -f` (single transaction); the ON COMMIT DROP temp table is scoped to it.

CREATE TEMP TABLE _b51_derivation (
  legacy_employee_id text NOT NULL,
  new_title          text NOT NULL,
  role_code          text NOT NULL,
  raw_legacy_title   text NOT NULL
) ON COMMIT DROP;

INSERT INTO _b51_derivation (legacy_employee_id, new_title, role_code, raw_legacy_title) VALUES
{values};

-- Fail loud if the baked block was truncated on write (defensive integrity gate).
DO $$
DECLARE n int; r int;
BEGIN
  SELECT count(*), count(DISTINCT role_code) INTO n, r FROM _b51_derivation;
  IF n <> 162 THEN RAISE EXCEPTION 'B-51: expected 162 derivation rows, got %', n; END IF;
  IF r <> 25  THEN RAISE EXCEPTION 'B-51: expected 25 distinct roles, got %', r; END IF;
END $$;

-- STEP B: create the 25 clean global job_roles (idempotent).
INSERT INTO sys.sys_job_roles (job_role_code, job_role_name, job_role_metadata)
SELECT DISTINCT d.role_code, d.new_title,
       jsonb_build_object('source', 'b51-rederive', 'legacy_job_title', d.raw_legacy_title)
FROM _b51_derivation d
ON CONFLICT (job_role_code) DO NOTHING;

-- STEP C1: re-derive position_title from the real legacy job_title (idempotent guard).
UPDATE sys.sys_positions p
SET position_title = d.new_title
FROM _b51_derivation d
WHERE p.position_metadata->>'legacy_employee_id' = d.legacy_employee_id
  AND p.position_title IS DISTINCT FROM d.new_title;

-- STEP C2: wire position_job_role_id to the matching RTL-ROLE-* role (idempotent guard).
UPDATE sys.sys_positions p
SET position_job_role_id = r.job_role_id
FROM _b51_derivation d
JOIN sys.sys_job_roles r ON r.job_role_code = d.role_code
WHERE p.position_metadata->>'legacy_employee_id' = d.legacy_employee_id
  AND p.position_job_role_id IS DISTINCT FROM r.job_role_id;

-- Verification (NOTICE only; does not fail the migration).
DO $$
DECLARE total int; wired int; titled int; roles_created int;
BEGIN
  SELECT count(*) INTO total FROM sys.sys_positions;
  SELECT count(position_job_role_id) INTO wired FROM sys.sys_positions;
  SELECT count(*) INTO titled FROM sys.sys_positions p
    JOIN _b51_derivation d ON p.position_metadata->>'legacy_employee_id' = d.legacy_employee_id
   WHERE p.position_title = d.new_title;
  SELECT count(*) INTO roles_created FROM sys.sys_job_roles WHERE job_role_code LIKE 'RTL-ROLE-%';
  RAISE NOTICE 'B-51 done: % positions total, % role-wired (expect 162), % titled-correct (expect 162), % RTL-ROLE-* roles (expect 25)',
    total, wired, titled, roles_created;
END $$;
"""

    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(sql)

    print(f"WROTE {OUT}")
    print(f"  derivation rows = {len(rows)}  |  distinct roles = {len(roles)}")
    print("=== 25 new job_roles (code | name | raw legacy job_title) ===")
    for c, n, lg in roles:
        print(f"  {c:38s} | {n:28s} | {lg}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
