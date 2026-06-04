-- 000069_user_preference_locale.sql
-- i18n milestone Fase 0b — add the per-user UI locale to sys_user_preferences, so the
-- IT/EN language choice persists cross-device alongside theme + palette (mig 000053).
-- SERVER = source of truth: the NEXT_LOCALE cookie is a first-paint client cache; this row
-- is re-applied on every authenticated session (incl. a fresh device) by PreferencesApplier.
--
-- RD-08: categorical field = varchar(N) + CHECK, NEVER PostgreSQL ENUM.
--   - locale : 'it' | 'en'  (default 'it' — DEFAULT_LOCALE in apps/web/src/lib/i18n.ts).
-- Additive + behavior-preserving: existing rows get 'it' (today's de-facto single locale),
-- so no user's rendering changes until they actively flip the switcher.
--
-- IDEMPOTENT: ADD COLUMN IF NOT EXISTS + guarded DROP/ADD CHECK. Second run = empty pg_dump diff.

ALTER TABLE sys.sys_user_preferences
  ADD COLUMN IF NOT EXISTS user_preference_locale varchar(8) NOT NULL DEFAULT 'it';

-- RD-08 CHECK (drop+add guarded so re-run / value-set evolution is safe).
ALTER TABLE sys.sys_user_preferences
  DROP CONSTRAINT IF EXISTS sys_user_preferences_locale_check;
ALTER TABLE sys.sys_user_preferences
  ADD CONSTRAINT sys_user_preferences_locale_check
  CHECK (user_preference_locale IN ('it', 'en'));

-- Verification (NOTICE only).
DO $$
DECLARE has_col bool;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'sys' AND table_name = 'sys_user_preferences'
       AND column_name = 'user_preference_locale'
  ) INTO has_col;
  RAISE NOTICE 'i18n Fase 0b: user_preference_locale present = % (expect t)', has_col;
END $$;
