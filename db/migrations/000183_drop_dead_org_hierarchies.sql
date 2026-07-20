-- ============================================================================
-- Migration 000183 — R4 (audit forense S1022 / F-A03): drop del dead schema
-- sys.sys_organization_hierarchies (closure-table OU).
--
-- VERIFY-FIRST (S1022, live): 0 righe (mai popolata dalla sua creazione in
-- 000009) + 0 riferimenti nel codice runtime (git grep su apps/api/src e
-- db/scripts = 0 match). La gerarchia OU e' navigata via adjacency
-- (organization_unit_parent_id), non via questa closure-table -> schema morto.
--
-- Reversibile: la definizione originale (ancestor/descendant/depth) vive in
-- 000009 e puo' essere ripristinata da li' se una closure-table servisse in
-- futuro per performance gerarchica. Idempotente (IF EXISTS).
-- Authored: 2026-07-20 (S1022).
-- ============================================================================

DROP TABLE IF EXISTS sys.sys_organization_hierarchies;
