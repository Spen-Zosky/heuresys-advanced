-- ============================================================================
-- 000153_lead_source_enum.sql — segment GTM leads by entry point.
-- The one-pager CTA posts source=INVESTOR, the demo CTA source=DEMO, the
-- landing keeps WEBSITE (default). RD-08: varchar + CHECK, never ENUM. Idempotent.
-- Authored: 2026-06-22 (S1003, #4 go-to-market deliverables 2-3).
-- ============================================================================

-- Normalize the legacy lowercase default + any existing rows to the new enum.
ALTER TABLE sys.sys_leads ALTER COLUMN lead_source SET DEFAULT 'WEBSITE';
UPDATE sys.sys_leads SET lead_source = 'WEBSITE' WHERE lead_source = 'website';

-- Add the CHECK only if absent (guarded — twice-run-safe).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_leads_source_check') THEN
    ALTER TABLE sys.sys_leads
      ADD CONSTRAINT sys_leads_source_check CHECK (lead_source IN ('WEBSITE','INVESTOR','DEMO'));
  END IF;
END $$;

DO $$
DECLARE n_bad int;
BEGIN
  SELECT count(*) INTO n_bad FROM sys.sys_leads WHERE lead_source NOT IN ('WEBSITE','INVESTOR','DEMO');
  IF n_bad <> 0 THEN RAISE EXCEPTION '000153: % rows with invalid lead_source', n_bad; END IF;
  RAISE NOTICE '000153: lead_source enum (WEBSITE/INVESTOR/DEMO) + CHECK.';
END $$;
