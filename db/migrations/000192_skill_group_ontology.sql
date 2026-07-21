-- ============================================================================
-- Migration 000192 — Ontologia competenze ESCO come cittadino di prim'ordine.
-- Mandato forense S1023 Fase 2.5; decisione Enzo S1024 = ontologia COMPLETA 100%.
--
-- Problema misurato (census F2.5 + S1024): 8.360 skill ISOLATE (0 edge
-- tassonomici); i `skill_group_uri` in skill_metadata sono STALE (400 distinti,
-- 0 match col dataset ESCO ufficiale v1.2.0). L'autorità corretta è il dump
-- ESCO (broaderRelationsSkillPillar): 13.717 skill→gruppo, 6.456 skill→skill
-- IS-A, 636 gruppo→gruppo, tutti ancorati a `skill_esco_uri`.
--
-- Questa migration crea SOLO lo schema (i nodi-gruppo di prim'ordine + il
-- legame skill→gruppo). Il popolamento dal dump vive in
-- db/scripts/populate-skill-ontology-it.sql (dati, non schema — pattern seed).
--
--   1. sys.sys_skill_groups — i gruppi ESCO (reference data globale, come le
--      skill globali): id deterministico v5 dall'URI, label/descrizione IT,
--      code, gerarchia self-FK (parent). NO tenant (reference data condiviso).
--   2. sys.sys_skills.skill_group_id — FK nullable → sys_skill_groups
--      (il gruppo primario della skill, dal broaderHierarchyConcept ESCO).
--   3. Gli edge skill→skill IS-A si appoggiano alla tabella esistente
--      sys_skill_taxonomy_edges (kind 'IS_A' già ammesso) — nessuno schema nuovo.
--
-- Idempotente + twice-run: IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- Authored: 2026-07-21 (S1024).
-- ============================================================================

CREATE TABLE IF NOT EXISTS sys.sys_skill_groups (
  skill_group_id          uuid PRIMARY KEY,
  skill_group_esco_uri    text        NOT NULL UNIQUE,
  skill_group_name        text        NOT NULL,
  skill_group_description text,
  skill_group_code        text,
  skill_group_parent_id   uuid        REFERENCES sys.sys_skill_groups (skill_group_id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_skill_groups_name_nonblank CHECK (length(trim(skill_group_name)) > 0)
);

CREATE INDEX IF NOT EXISTS sys_skill_groups_parent_idx
  ON sys.sys_skill_groups (skill_group_parent_id);

-- Legame skill → gruppo primario (broaderHierarchyConcept ESCO)
ALTER TABLE sys.sys_skills
  ADD COLUMN IF NOT EXISTS skill_group_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sys_skills_skill_group_fk'
  ) THEN
    ALTER TABLE sys.sys_skills
      ADD CONSTRAINT sys_skills_skill_group_fk
      FOREIGN KEY (skill_group_id) REFERENCES sys.sys_skill_groups (skill_group_id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS sys_skills_skill_group_idx
  ON sys.sys_skills (skill_group_id);

-- Twice-run invariant: le tabelle archivio create con `LIKE sys.sys_skills`
-- (000160 skills_junk_archive, 000189 skill_dedup_archive) hanno lo schema
-- CONGELATO al momento della creazione; i loro `INSERT ... SELECT s.*` al re-run
-- fallirebbero ("more expressions than target columns") ora che sys_skills ha
-- una colonna in più. Le allineo (additivo, idempotente).
DO $$
BEGIN
  IF to_regclass('audit.skills_junk_archive') IS NOT NULL THEN
    ALTER TABLE audit.skills_junk_archive ADD COLUMN IF NOT EXISTS skill_group_id uuid;
  END IF;
  IF to_regclass('audit.skill_dedup_archive') IS NOT NULL THEN
    ALTER TABLE audit.skill_dedup_archive ADD COLUMN IF NOT EXISTS skill_group_id uuid;
  END IF;
END $$;

-- Registra sys_skill_groups come entità traducibile (name/description IT-canonici,
-- EN dal dump inglese quando disponibile) — coerente con ADR-0029.
INSERT INTO sys.sys_translatable_field
  (entity_table, entity_pk_column, field, entity_field_column, note)
VALUES
  ('sys_skill_groups','skill_group_id','name','skill_group_name','gruppi competenze ESCO'),
  ('sys_skill_groups','skill_group_id','description','skill_group_description','gruppi competenze ESCO')
ON CONFLICT (entity_table, field) DO NOTHING;

-- Post-condition
DO $$
BEGIN
  IF to_regclass('sys.sys_skill_groups') IS NULL THEN
    RAISE EXCEPTION '000192: sys_skill_groups assente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='sys' AND table_name='sys_skills'
                    AND column_name='skill_group_id') THEN
    RAISE EXCEPTION '000192: sys_skills.skill_group_id assente';
  END IF;
END $$;
