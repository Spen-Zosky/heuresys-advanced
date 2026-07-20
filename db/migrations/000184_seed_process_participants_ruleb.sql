-- ============================================================================
-- Migration 000184 — R2 (audit forense S1022 / F-A04): popolamento di
-- sys.sys_process_participants (asse funzionale ADR-0027 F4, #24).
--
-- PROBLEMA: la 000179 crea la tabella ma non la popola → l'asse funzionale
-- process-ownership era MORTO (functional.ts: un OWNER vede i partecipanti dei
-- processi che possiede, ma con 0 righe nessuno possiede nulla). Il ramo teams
-- dell'asse funziona (sys_team_members popolato); solo il ramo process era vuoto.
--
-- SORGENTE (verificata S1022): il legacy heuresys-evo NON ha una relazione
-- persona↔processo (modella solo template di ruoli + responsabilità OU, già
-- importata in sys_organization_unit_processes). Quindi si DERIVA dai dati live.
--
-- REGOLA = RULE-B differenziata (decisione Enzo S1022):
--   per ogni (OU-process × utente membro-attivo della OU):
--     se l'utente è position_owner di una posizione attiva della OU → OWNER
--     altrimenti                                                     → CONTRIBUTOR
--   (CONSULTED/INFORMED non derivabili: nessun signal per-persona nei dati.)
--
-- Membri = utenti con user_position_assignment ACTIVE su una posizione attiva
-- della org-unit del processo. Distribuzione misurata (dry-run live S1022):
-- 1086 righe (120 OWNER / 966 CONTRIBUTOR), 30/105 org-unit-process con OWNER
-- (i restanti 75 non hanno un position_owner tra i membri = proprietà dei dati
-- reali, non un difetto: quei processi restano senza owner nell'asse funzionale).
--
-- IDEMPOTENTE: ON CONFLICT (org_unit_process_id, user_id) DO NOTHING sul
-- unique index sys_process_participants_process_user_uq. Additivo, reversibile
-- (DELETE WHERE metadata->>'derived'='RULE-B'). Authored: 2026-07-20 (S1022).
-- ============================================================================

INSERT INTO sys.sys_process_participants (
  process_participant_tenant_id,
  process_participant_org_unit_process_id,
  process_participant_user_id,
  process_participant_role,
  process_participant_is_active,
  process_participant_metadata
)
WITH members AS (
  SELECT DISTINCT
    p.position_organization_unit_id           AS org_unit_id,
    upa.user_position_assignment_user_id       AS user_id
  FROM sys.sys_positions p
  JOIN sys.sys_user_position_assignments upa
    ON upa.user_position_assignment_position_id = p.position_id
   AND upa.user_position_assignment_status = 'ACTIVE'
  WHERE p.position_is_active
)
SELECT DISTINCT
  oup.org_unit_process_tenant_id,
  oup.organization_unit_process_id,
  m.user_id,
  CASE WHEN EXISTS (
    SELECT 1 FROM sys.sys_positions po
    WHERE po.position_organization_unit_id = oup.org_unit_process_org_unit_id
      AND po.position_owner_user_id = m.user_id
      AND po.position_is_active
  ) THEN 'OWNER' ELSE 'CONTRIBUTOR' END,
  true,
  jsonb_build_object('derived', 'RULE-B', 'session', 'S1022',
                     'rule', 'position_owner->OWNER else CONTRIBUTOR')
FROM sys.sys_organization_unit_processes oup
JOIN members m ON m.org_unit_id = oup.org_unit_process_org_unit_id
ON CONFLICT (process_participant_org_unit_process_id, process_participant_user_id)
  DO NOTHING;
