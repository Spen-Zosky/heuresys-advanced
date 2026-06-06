-- 44_skill_category_mapping.sql — #5 skill-category heatmap prerequisite (S970, 2026-06-06).
-- DECISION (Enzo): add a 7th 'Technical / Domain Expertise' category + map the 31 referenced skills.
-- 23 clean competency fits into the 6 existing behavioral families + 8 technical/domain skills into the new one.
-- Maps ONLY the 31 skills referenced by sys_user_skill_evidence (not the full 21939-skill catalog).
-- sys_skills.skill_category_id is nullable -> safe additive UPDATE.
-- IDEMPOTENT: category anti-join INSERT (no unique on code); skill UPDATE only where category IS NULL + referenced.
BEGIN;
-- 7th category
INSERT INTO sys.sys_skill_categories (skill_category_code, skill_category_name)
SELECT 'Technical', 'Technical / Domain Expertise'
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_skill_categories WHERE skill_category_code = 'Technical');
-- map the 31 referenced skills (real skill_name values; 23 clean + 8 technical)
WITH m(skill_name, cat_code) AS (VALUES
  ('Data analysis','Cognitive'),
  ('Problem Solving','Cognitive'),
  ('solve problems','Cognitive'),
  ('think analytically','Cognitive'),
  ('Project Management','Leadership'),
  ('apply change management','Leadership'),
  ('leadership principles','Leadership'),
  ('manage accounts','Leadership'),
  ('manage budgets','Leadership'),
  ('personnel management','Leadership'),
  ('supplier management','Leadership'),
  ('Negotiation Skills','External'),
  ('customer service','External'),
  ('implement sales strategies','External'),
  ('Compliance Management','Performance'),
  ('Financial Analysis','Performance'),
  ('GDPR Compliance','Performance'),
  ('ensure compliance with company regulations','Performance'),
  ('internal auditing','Performance'),
  ('prepare financial auditing reports','Performance'),
  ('risk management','Performance'),
  ('apply technical communication skills','Interpersonal'),
  ('Time management','Personal'),
  ('ICT network security risks','Technical'),
  ('ICT sales methodologies','Technical'),
  ('Python (computer programming)','Technical'),
  ('SQL Database Management','Technical'),
  ('advanced materials','Technical'),
  ('cyber security','Technical'),
  ('data visualisation software','Technical'),
  ('parking regulations','Technical')
)
UPDATE sys.sys_skills s
SET skill_category_id = c.skill_category_id
FROM m
JOIN sys.sys_skill_categories c ON c.skill_category_code = m.cat_code
WHERE s.skill_name = m.skill_name
  AND s.skill_category_id IS NULL
  AND s.skill_id IN (SELECT user_skill_evidence_skill_id FROM sys.sys_user_skill_evidence);
DO $$ DECLARE v int; BEGIN
  SELECT count(DISTINCT s.skill_id) INTO v
  FROM sys.sys_user_skill_evidence e JOIN sys.sys_skills s ON s.skill_id = e.user_skill_evidence_skill_id
  WHERE s.skill_category_id IS NOT NULL;
  RAISE NOTICE 'referenced skills categorized: %/31', v;
  IF v < 31 THEN RAISE EXCEPTION 'expected 31 categorized, got %', v; END IF;
END $$;
COMMIT;
