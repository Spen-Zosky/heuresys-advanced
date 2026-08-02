-- 000229_timeline_permission_i18n.sql
-- Colma l'unica lacuna di traduzione EN rimasta sui dati di riferimento (ADR-0029).
--
-- Misurato: `sys.v_reference_translation_coverage` segnalava 2 righe mancanti su
-- sys_auth_permissions.name, e sono i due permessi introdotti con la timeline (000223).
--
-- I difetti erano DUE, non uno. Oltre alla traduzione assente, il nome base era scritto
-- in INGLESE, mentre la convenzione dei dati di riferimento è italiano canonico + traduzione
-- EN a fianco (verificato su goal:read:self, approval:read:self, position:update,
-- whistleblowing:read). Il cancello vedeva solo la traduzione mancante: l'idioma del nome
-- base non lo misura nessuno, quindi correggere solo la traduzione avrebbe lasciato due
-- righe inglesi dichiarate italiane, con il cancello verde.
--
-- Verificato che il caso è isolato: nessun altro permesso ha un nome base che inizia con un
-- verbo inglese (Read/Update/Create/Delete/Manage/View/Write/List/Approve/Export).
--
-- Idempotente: UPDATE mirati per codice + upsert delle traduzioni sulla chiave naturale.

-- 1) Nome base in italiano, come tutti gli altri permessi.
UPDATE sys.sys_auth_permissions
   SET auth_permission_name = 'Lettura della storia di una persona'
 WHERE auth_permission_code = 'timeline:read';

UPDATE sys.sys_auth_permissions
   SET auth_permission_name = 'Lettura della propria storia (ESS)'
 WHERE auth_permission_code = 'timeline:read:self';

-- 2) Traduzione EN a fianco, con la stessa formulazione che il nome base aveva prima.
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_auth_permissions', p.auth_permission_id, 'name', 'en', v.en, 'MANUAL'
  FROM (VALUES
          ('timeline:read',      'Read a person''s timeline'),
          ('timeline:read:self', 'Read own timeline (ESS)')
       ) AS v(code, en)
  JOIN sys.sys_auth_permissions p ON p.auth_permission_code = v.code
 WHERE NOT EXISTS (
   SELECT 1 FROM sys.sys_reference_translations t
    WHERE t.entity_table = 'sys_auth_permissions'
      AND t.entity_id = p.auth_permission_id
      AND t.field = 'name'
      AND t.locale = 'en'
 );
