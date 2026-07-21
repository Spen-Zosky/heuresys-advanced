-- ============================================================================
-- Migration 000194 — REVERT dell'unique index preventivo di 000189.
--
-- 000189 ha (a) deduplicato le skill esistenti [MANTENUTO] e (b) aggiunto
-- l'unique index `sys_skills_natural_key_uq` su (COALESCE(tenant,nil),
-- lower(trim(name))) [RIMOSSO QUI]. Il vincolo (b) rompe i path che INSERISCONO
-- skill senza gestire il conflitto — `tenant-materialization` e i
-- `reconciliation-*` fallivano con "duplicate key ... natural_key_uq" sia in CI
-- sia (potenzialmente) in PROD alla creazione di un tenant.
--
-- Decisione (S1024, de-risking): rimuovere il vincolo preventivo. Il dedup dei
-- duplicati già esistenti resta valido (le righe rimosse non tornano). La
-- prevenzione futura andrà re-introdotta CORRETTAMENTE — ON CONFLICT DO NOTHING
-- nei repository che inseriscono skill (materialize/reconciliation) PRIMA di
-- ripristinare l'index — in una sessione dedicata (backlog #72).
--
-- Idempotente. Authored: 2026-07-21 (S1024).
-- ============================================================================

DROP INDEX IF EXISTS sys.sys_skills_natural_key_uq;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='sys' AND indexname='sys_skills_natural_key_uq') THEN
    RAISE EXCEPTION '000194: unique index ancora presente';
  END IF;
END $$;
