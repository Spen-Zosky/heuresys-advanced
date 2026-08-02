-- 000233_leads_gdpr_retention.sql
-- #4 W4 — l'informativa promette 24 mesi, il sistema non li applicava.
--
-- Misurato (2026-08-03): `sys_leads` NON era nel registro `sys_gdpr_data_map`, quindi la
-- sweep di retention (GDPR F4) non l'ha mai toccata. L'informativa pubblica su /privacy
-- dichiara però, dal primo deliverable GTM, che i dati «non sono conservati oltre 24 mesi
-- dalla raccolta». Era una promessa senza meccanismo: non ancora violata soltanto perché
-- il lead più vecchio risale a pochi mesi fa.
--
-- Non è un difetto che un cancello automatico potesse cogliere: nessuno confronta ciò che
-- un'informativa dichiara con ciò che il registro applica. È emerso guardando il testo
-- pubblico e chiedendosi se fosse vero.
--
-- La finestra qui NON è una scelta nuova: è esattamente quella già dichiarata al pubblico.
-- 730 giorni = 24 mesi. Cambiarla richiederebbe prima di cambiare l'informativa.
--
-- `subject_fk` è `lead_email`: nei lead il soggetto è una persona esterna, senza riga in
-- `sys_users`, e l'e-mail è ciò che la identifica in questa tabella. Il registro verifica
-- che la colonna esista, ed esiste.
--
-- Idempotente: ON CONFLICT sulla chiave naturale del registro.

INSERT INTO sys.sys_gdpr_data_map (
  gdpr_map_table_schema, gdpr_map_table_name, gdpr_map_subject_fk,
  gdpr_map_data_class, gdpr_map_erasure_strategy, gdpr_map_reference_kind,
  gdpr_map_retention_days, gdpr_map_age_column, gdpr_map_legal_basis
) VALUES (
  'sys', 'sys_leads', 'lead_email',
  'IDENTITY', 'DELETE', 'SUBJECT',
  730, 'created_at',
  'Consenso esplicito dell''interessato (art. 6, par. 1, lett. a GDPR). Finestra di 24 mesi come dichiarato nell''informativa pubblica su /privacy.'
)
ON CONFLICT (gdpr_map_table_schema, gdpr_map_table_name, gdpr_map_subject_fk) DO UPDATE
SET gdpr_map_data_class        = EXCLUDED.gdpr_map_data_class,
    gdpr_map_erasure_strategy  = EXCLUDED.gdpr_map_erasure_strategy,
    gdpr_map_reference_kind    = EXCLUDED.gdpr_map_reference_kind,
    gdpr_map_retention_days    = EXCLUDED.gdpr_map_retention_days,
    gdpr_map_age_column        = EXCLUDED.gdpr_map_age_column,
    gdpr_map_legal_basis       = EXCLUDED.gdpr_map_legal_basis,
    updated_at                 = now();
