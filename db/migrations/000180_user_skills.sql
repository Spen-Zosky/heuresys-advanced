-- ============================================================================
-- 000180_user_skills.sql — #46 D/D1: possesso skill per-dipendente.
--
-- Wave-1 aveva importato la TASSONOMIA delle skill, non il POSSESSO: chi sa
-- fare cosa non esisteva nel modello. Senza quel dato, skill-gap e
-- people-analytics ragionano su requisiti senza controparte reale.
--
-- RAPPORTO CON L'EVIDENCE LAYER (sys_user_skill_evidence, gia' presente):
--   - sys_user_skill_evidence = traccia append-only degli accertamenti (chi ha
--     dichiarato/valutato cosa e quando). Molte righe per utente x skill.
--   - sys_user_skills (questa) = STATO CORRENTE del possesso. UNA riga per
--     utente x skill, che e' cio' che gap analysis e matching interrogano.
--   Non si sostituiscono: la prima e' la storia, la seconda la fotografia.
--
-- LIVELLI: si riusa il vocabolario gia' in sys_skill_proficiency_levels
-- (NOVICE/BASIC/COMPETENT/PROFICIENT/EXPERT/MASTER, rank 1..6) invece di
-- introdurne uno nuovo. Il legacy usa un intero 1..5 che mappa sui rank 1..5;
-- MASTER (6) resta non usato perche' il legacy non ha un sesto livello.
--
-- SCELTA DI ENZO (2026-07-19) sul dato legacy contraddittorio: employee_skills
-- porta sia `proficiency_level` (intero 1-5) sia `proficiency_label` (testo
-- libero bilingue) e i due DISCORDANO su 457 righe di 1445 (32%; correlazione
-- 0,468 a distribuzioni marginali quasi identiche → campi popolati in modo
-- indipendente). Autoritativo = il NUMERICO. L'etichetta originale viene
-- conservata in `user_skill_metadata.legacy_proficiency_label`, cosi' la scelta
-- resta REVERSIBILE senza rifare l'estrazione.
--
-- INVARIANTI: I3/I4 (sys.sys_<plural>) · RD-08 (varchar + CHECK, mai ENUM) ·
-- RD-09 (`date` per date senza orario) · I5 (tenant via FK + filtro app, no RLS).
--
-- IDEMPOTENTE: CREATE ... IF NOT EXISTS. Authored: 2026-07-19.
-- ============================================================================

CREATE TABLE IF NOT EXISTS sys.sys_user_skills (
  user_skill_id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_skill_tenant_id          uuid NOT NULL,
  user_skill_user_id            uuid NOT NULL,
  user_skill_skill_id           uuid NOT NULL,
  user_skill_proficiency        varchar(32) NOT NULL,
  user_skill_years_experience   numeric(4,1),
  user_skill_is_primary         boolean NOT NULL DEFAULT false,
  user_skill_is_verified        boolean NOT NULL DEFAULT false,
  user_skill_verified_by_user_id uuid,
  user_skill_verified_at        timestamptz,
  user_skill_source             varchar(64) NOT NULL DEFAULT 'SELF_ASSESSMENT',
  user_skill_confidence         numeric(3,2),
  user_skill_last_used_on       date,
  user_skill_notes              text,
  -- Crosswalk verso la riga legacy (employee_skills.id): rende il re-import
  -- idempotente e ogni riga tracciabile alla sua origine.
  user_skill_external_code      varchar(128),
  user_skill_metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  created_by                    uuid,
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  updated_by                    uuid,
  CONSTRAINT sys_user_skills_proficiency_check
    CHECK (user_skill_proficiency IN ('NOVICE','BASIC','COMPETENT','PROFICIENT','EXPERT','MASTER')),
  CONSTRAINT sys_user_skills_confidence_check
    CHECK (user_skill_confidence IS NULL OR (user_skill_confidence >= 0 AND user_skill_confidence <= 1)),
  CONSTRAINT sys_user_skills_years_check
    CHECK (user_skill_years_experience IS NULL OR user_skill_years_experience >= 0),
  CONSTRAINT sys_user_skills_updated_after CHECK (updated_at >= created_at),
  CONSTRAINT sys_user_skills_tenant_fk FOREIGN KEY (user_skill_tenant_id)
    REFERENCES sys.sys_tenancies (tenant_id) ON DELETE CASCADE,
  CONSTRAINT sys_user_skills_user_fk FOREIGN KEY (user_skill_user_id)
    REFERENCES sys.sys_users (user_id) ON DELETE CASCADE,
  CONSTRAINT sys_user_skills_skill_fk FOREIGN KEY (user_skill_skill_id)
    REFERENCES sys.sys_skills (skill_id) ON DELETE CASCADE,
  CONSTRAINT sys_user_skills_verifier_fk FOREIGN KEY (user_skill_verified_by_user_id)
    REFERENCES sys.sys_users (user_id) ON DELETE SET NULL
);

-- Lo stato corrente e' UNO per utente x skill (la storia sta nell'evidence layer).
CREATE UNIQUE INDEX IF NOT EXISTS sys_user_skills_user_skill_uq
  ON sys.sys_user_skills (user_skill_user_id, user_skill_skill_id);

-- Re-import idempotente per riga legacy.
CREATE UNIQUE INDEX IF NOT EXISTS sys_user_skills_external_code_uq
  ON sys.sys_user_skills (user_skill_external_code)
  WHERE user_skill_external_code IS NOT NULL;

-- "chi possiede questa skill" (matching / gap analysis)
CREATE INDEX IF NOT EXISTS sys_user_skills_skill_idx
  ON sys.sys_user_skills (user_skill_skill_id, user_skill_proficiency);

CREATE INDEX IF NOT EXISTS sys_user_skills_tenant_idx
  ON sys.sys_user_skills (user_skill_tenant_id);

-- Reconciliation registry — obbligatorio per ogni nuova sys.* (assert 0 UNCLASSIFIED
-- in 000062). Bucket A/IMPORT: a differenza delle tabelle app-authored, questa HA una
-- sorgente legacy misurabile.
INSERT INTO sys.sys_reconciliation_registry
  (reconciliation_registry_table_name, reconciliation_registry_bucket,
   reconciliation_registry_declared_status, reconciliation_registry_legacy_source,
   reconciliation_registry_rationale)
VALUES
  ('sys_user_skills', 'A', 'IMPORT', 'employee_skills',
   '[sign-off: IMPORT — per-employee skill possession (mig 000180, #46 D1). Legacy employee_skills: 1445 rows / 264 employees / 61 distinct ESCO skills. Crosswalk measured live before import: ESCO uri 61/61 resolved against sys_skills; employee crosswalk (LEGACY_EMP:: per I14) covers 156 of the 162 advanced users (96.3%) — the legacy holds more employees than the advanced RTL subset by design.]')
ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;
