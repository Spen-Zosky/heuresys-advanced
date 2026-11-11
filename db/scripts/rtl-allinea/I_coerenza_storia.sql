-- Custodia storia36 sulla copia (voce 7): correzioni dei rossi che discendono da A/D, con giornale. Idempotente.
--  C5f  le posizioni del registro delle critiche sono CRITICAL anche nell'anagrafica posti
--  C5l  il bacino di successione porta il nome della posizione servita
--  C6c  la soppressione delle Aree lascia una traccia datata: ultimo spostamento = dove stanno oggi; righe identiche della storia unite
-- Giornale: staging.rtl_allinea_org_undo (riga prima; per le righe inserite 'ins:' + tabella con riga vuota, per le righe tolte la riga intera).
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.rtl_allinea_org_undo (
  salvato_il timestamptz NOT NULL DEFAULT now(), tabella text NOT NULL, chiave uuid NOT NULL, riga jsonb NOT NULL, PRIMARY KEY (tabella, chiave));
-- C5f
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga)
SELECT 'sys_positions', p.position_id, to_jsonb(p) FROM sys.sys_positions p JOIN sys.sys_critical_positions c ON c.critical_position_position_id=p.position_id
 WHERE p.position_criticality IS DISTINCT FROM 'CRITICAL' ON CONFLICT DO NOTHING;
UPDATE sys.sys_positions p SET position_criticality='CRITICAL' FROM sys.sys_critical_positions c WHERE c.critical_position_position_id=p.position_id AND p.position_criticality IS DISTINCT FROM 'CRITICAL';
-- C5l
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga)
SELECT 'sys_succession_pools', s.succession_pool_id, to_jsonb(s) FROM sys.sys_succession_pools s JOIN sys.sys_positions p ON p.position_id=s.succession_pool_position_id
 WHERE s.succession_pool_name <> 'Successione — '||p.position_title ON CONFLICT DO NOTHING;
UPDATE sys.sys_succession_pools s SET succession_pool_name='Successione — '||p.position_title FROM sys.sys_positions p WHERE p.position_id=s.succession_pool_position_id AND s.succession_pool_name <> 'Successione — '||p.position_title;
-- C6c: righe identiche unite (si tiene la prima)
CREATE TEMP TABLE dup ON COMMIT DROP AS
SELECT organization_unit_history_id id FROM (SELECT organization_unit_history_id, row_number() OVER (PARTITION BY organization_unit_history_unit_id, organization_unit_history_change_type, organization_unit_history_old_value::text, organization_unit_history_new_value::text, organization_unit_history_effective_at, coalesce(organization_unit_history_notes,'') ORDER BY created_at, organization_unit_history_id) rn FROM sys.sys_organization_unit_history) x WHERE rn>1;
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'sys_organization_unit_history', h.organization_unit_history_id, to_jsonb(h) FROM sys.sys_organization_unit_history h JOIN dup ON dup.id=h.organization_unit_history_id ON CONFLICT DO NOTHING;
DELETE FROM sys.sys_organization_unit_history WHERE organization_unit_history_id IN (SELECT id FROM dup);
-- C6c: traccia della soppressione delle Aree
CREATE TEMP TABLE ult ON COMMIT DROP AS
SELECT DISTINCT ON (h.organization_unit_history_unit_id) h.organization_unit_history_unit_id u, h.organization_unit_history_tenant_id t, h.organization_unit_history_new_value nv
FROM sys.sys_organization_unit_history h WHERE h.organization_unit_history_change_type='MOVED'
ORDER BY h.organization_unit_history_unit_id, h.organization_unit_history_effective_at DESC, h.created_at DESC;
CREATE TEMP TABLE nuovo ON COMMIT DROP AS
SELECT gen_random_uuid() id, ult.u, ult.t, ult.nv old_v, jsonb_build_object('parent_name', pa.organization_unit_name) new_v
FROM ult JOIN sys.sys_organization_units o ON o.organization_unit_id=ult.u JOIN sys.sys_organization_units pa ON pa.organization_unit_id=o.organization_unit_parent_id
WHERE ult.nv->>'parent_name' IS DISTINCT FROM pa.organization_unit_name;
INSERT INTO sys.sys_organization_unit_history (organization_unit_history_id, organization_unit_history_unit_id, organization_unit_history_tenant_id, organization_unit_history_change_type, organization_unit_history_old_value, organization_unit_history_new_value, organization_unit_history_effective_at, organization_unit_history_actor_user_id, organization_unit_history_notes)
SELECT id, u, t, 'MOVED', old_v, new_v, now(), (SELECT organization_unit_history_actor_user_id FROM sys.sys_organization_unit_history WHERE organization_unit_history_tenant_id=t AND organization_unit_history_actor_user_id IS NOT NULL GROUP BY 1 ORDER BY count(*) DESC LIMIT 1), 'Soppressione del livello di Area: la filiale riporta alla Divisione Retail Banking (decisione 2026-11-10)' FROM nuovo;
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga) SELECT 'ins:sys_organization_unit_history', id, '{}'::jsonb FROM nuovo ON CONFLICT DO NOTHING;
-- nomi tradotti: la storia delle unita' porta gli stessi nomi di oggi (C6c)
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga)
SELECT 'sys_organization_unit_history', h.organization_unit_history_id, to_jsonb(h) FROM sys.sys_organization_unit_history h
 WHERE h.organization_unit_history_old_value::text ~ '(Risk & Compliance|Direzione Risk Management)' OR h.organization_unit_history_new_value::text ~ '(Risk & Compliance|Direzione Risk Management)' ON CONFLICT DO NOTHING;
UPDATE sys.sys_organization_unit_history SET
  organization_unit_history_old_value = replace(replace(organization_unit_history_old_value::text,'Risk & Compliance','Rischi e Compliance'),'Direzione Risk Management','Direzione Gestione dei Rischi')::jsonb,
  organization_unit_history_new_value = replace(replace(organization_unit_history_new_value::text,'Risk & Compliance','Rischi e Compliance'),'Direzione Risk Management','Direzione Gestione dei Rischi')::jsonb
 WHERE organization_unit_history_old_value::text ~ '(Risk & Compliance|Direzione Risk Management)' OR organization_unit_history_new_value::text ~ '(Risk & Compliance|Direzione Risk Management)';
COMMIT;
SELECT 'I ok' esito, (SELECT count(*) FROM staging.rtl_allinea_org_undo WHERE tabella IN ('sys_succession_pools','sys_organization_unit_history','ins:sys_organization_unit_history')) nel_giornale;
