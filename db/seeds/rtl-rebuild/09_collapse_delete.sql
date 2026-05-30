-- 09_collapse_delete.sql — D8: THE DESTRUCTIVE STEP. Single transaction, FK-ordered, asserted.
-- Run via psql AFTER 01-08 (+ the persona re-wire in app/web fixtures with known passwords set on real
-- users) and AFTER pausing the OCI self-hosted CI runner + taking a fresh backup.
--
-- Removes the out-of-scope users + their dependents, the synthetic position/OU scaffold, and the
-- synthetic SYSTEM attendance on kept users (D6 Replace). Everything in ONE transaction; hard
-- assertions abort before any irreversible change if the scope counts are wrong.
--
-- SCOPE (verified): total 433 users -> KEEP 161 (rtl-bank.org 158 + heuresys.com 3) / DELETE 272
--   (rtl-bank-reference.example.com 158 + smartfood.org 82 + econova.org 26 + legacy.heuresys.local 2
--    + rtl-bank.test 4). NB: this supersedes the pre-D3 figure 165/268 — D3 moves the 4 rtl-bank.test
--   personas into DELETE (they are re-wired onto real users in fixtures BEFORE this runs).
--   admin@heuresys.com (native PLATFORM_ADMIN) is heuresys.com -> KEEP, untouched.

BEGIN;

CREATE TEMP TABLE del_users ON COMMIT DROP AS
SELECT user_id, user_email FROM sys.sys_users
WHERE split_part(user_email,'@',2) IN
  ('rtl-bank-reference.example.com','smartfood.org','econova.org','legacy.heuresys.local','rtl-bank.test');

-- 0) PRE-FLIGHT ASSERTIONS — abort if scope is not exactly as expected.
DO $$
DECLARE total int; del int; keep int;
BEGIN
  SELECT count(*) INTO total FROM sys.sys_users;
  SELECT count(*) INTO del   FROM del_users;
  SELECT count(*) INTO keep  FROM sys.sys_users
    WHERE split_part(user_email,'@',2) IN ('rtl-bank.org','heuresys.com');
  IF NOT (del = 272 AND keep = 161 AND total = del + keep) THEN
    RAISE EXCEPTION 'SCOPE ASSERTION FAILED: total=% delete=% keep=% (expected 433 / 272 / 161). Aborting.', total, del, keep;
  END IF;
  RAISE NOTICE 'Scope OK: delete=% keep=% total=%', del, keep, total;
END $$;

-- 1) D6 Replace: drop the 2924 SYNTHETIC SYSTEM attendance rows of the KEPT real users
--    (07 already imported the real legacy attendance for them). Overtime/time-off are real -> kept.
DELETE FROM sys.sys_attendance
WHERE attendance_source = 'SYSTEM'
  AND attendance_subject_user_id IN (
    SELECT user_id FROM sys.sys_users WHERE split_part(user_email,'@',2) IN ('rtl-bank.org','heuresys.com'));

-- 2) RESTRICT children of the DELETE users (must precede the user delete).
DELETE FROM sys.sys_user_position_assignments WHERE user_position_assignment_user_id IN (SELECT user_id FROM del_users);
DELETE FROM sys.sys_attendance        WHERE attendance_subject_user_id IN (SELECT user_id FROM del_users);
DELETE FROM sys.sys_overtime          WHERE overtime_subject_user_id   IN (SELECT user_id FROM del_users);
DELETE FROM sys.sys_time_off_requests WHERE request_subject_user_id    IN (SELECT user_id FROM del_users);
DELETE FROM sys.sys_time_off_balances WHERE balance_subject_user_id    IN (SELECT user_id FROM del_users);
DELETE FROM sys.sys_goal_check_ins    WHERE check_in_subject_user_id   IN (SELECT user_id FROM del_users);

-- 3) Delete the users. CASCADE removes ~40 child tables (sys_auth_*, profiles, certifications, evidence,
--    scores, etc.); ~150 created_by/updated_by audit refs are SET NULL by their FKs.
DELETE FROM sys.sys_users WHERE user_id IN (SELECT user_id FROM del_users);

-- 4) Delete the SYNTHETIC positions (the 161 scaffold = positions with no legacy lineage).
--    Their assignments (synthetic + rtl-bank.test) are already gone via step 2.
DELETE FROM sys.sys_user_position_assignments a
  USING sys.sys_positions p
  WHERE a.user_position_assignment_position_id = p.position_id
    AND NOT (p.position_metadata ? 'legacy_employee_id');
DELETE FROM sys.sys_positions p WHERE NOT (p.position_metadata ? 'legacy_employee_id');

-- 5) Delete the SYNTHETIC org units (the 6 HQ/BRANCH scaffold = OUs with no legacy lineage).
--    sys_branches + hierarchies/history/kpi CASCADE; real positions keep their real OUs.
DELETE FROM sys.sys_organization_units ou WHERE NOT (ou.organization_unit_metadata ? 'legacy_org_unit_id');

-- 6) POST ASSERTIONS — verify the end state before COMMIT.
DO $$
DECLARE u int; synth_pos int; synth_ou int; synth_att int;
BEGIN
  SELECT count(*) INTO u FROM sys.sys_users;
  SELECT count(*) INTO synth_pos FROM sys.sys_positions WHERE NOT (position_metadata ? 'legacy_employee_id');
  SELECT count(*) INTO synth_ou  FROM sys.sys_organization_units WHERE NOT (organization_unit_metadata ? 'legacy_org_unit_id');
  SELECT count(*) INTO synth_att FROM sys.sys_attendance WHERE attendance_source='SYSTEM';
  IF NOT (u = 161 AND synth_pos = 0 AND synth_ou = 0 AND synth_att = 0) THEN
    RAISE EXCEPTION 'POST ASSERTION FAILED: users=% synth_positions=% synth_ous=% synth_attendance=% (expected 161/0/0/0). Rolling back.', u, synth_pos, synth_ou, synth_att;
  END IF;
  RAISE NOTICE 'Collapse OK: users=161, no synthetic positions/OUs/attendance remain.';
END $$;

COMMIT;
