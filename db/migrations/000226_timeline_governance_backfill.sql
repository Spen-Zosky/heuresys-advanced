-- 000226 — #49 (D5): completa la governance della storia della persona.
--
-- La mig 000222 ha creato `sys.sys_user_timeline_events` e la 000223 ha creato i due
-- permessi `timeline:read` / `timeline:read:self` concedendoli anche a TENANT_ADMIN, ma
-- due registri trasversali sono rimasti indietro. Entrambi i buchi sono stati scoperti
-- dalla CI (Test (api integration) rossa da e4acd6d7) e NON erano visibili in locale.
--
-- 1) MAPPA DATI GDPR. Il test `gdpr.integration.test.ts` deriva il grafo delle FK verso
--    `sys_users` da `pg_constraint` — la SoT e' il catalogo, non un elenco scritto a mano —
--    e pretende che ogni FK di SOGGETTO su una tabella `sys_user_*` sia classificata.
--    `user_timeline_event_user_id` non lo era: la storia di una persona sarebbe rimasta
--    fuori da export e cancellazione GDPR.
--    Classe **PERSONAL** + strategia **DELETE**, come le altre `sys_user_*` di dominio
--    persona (skills, certifications). NON `FINANCIAL_LEGAL`/RETAIN: la timeline contiene
--    eventi retributivi ma non e' un documento con obbligo di conservazione — quelli sono
--    i cedolini (`sys_user_pay_slips`, gia' RETAIN).
--
-- 2) ALLOWLIST TENANT_ADMIN (D-57 deny-by-default). Il test
--    `rbac-tenant-admin-allowlist.test.ts` confronta l'audience viva di TENANT_ADMIN con
--    l'allowlist della 000210 piu' i codici marcati `TENANT_ADMIN-ALLOWLIST-EXTEND` nelle
--    migration successive. I due permessi timeline sono arrivati a TENANT_ADMIN senza
--    marker, che e' esattamente la "silent absorption" che la guardia esiste per impedire.
--    Il grant e' voluto (il mandato HR vede la storia del tenant): qui si dichiara, non si
--    cambia il comportamento.
--
-- Idempotente + twice-run safe.

-- ---------------------------------------------------------------- 1) GDPR data map
INSERT INTO sys.sys_gdpr_data_map (
  gdpr_map_table_schema, gdpr_map_table_name, gdpr_map_subject_fk,
  gdpr_map_data_class, gdpr_map_erasure_strategy, gdpr_map_reference_kind, gdpr_map_legal_basis
) VALUES (
  'sys', 'sys_user_timeline_events', 'user_timeline_event_user_id',
  'PERSONAL', 'DELETE', 'SUBJECT',
  'Storia consultiva della persona (D5 #49), importata dal legacy employee_timeline. Dato personale del soggetto: esportabile su richiesta di accesso e cancellabile su richiesta di cancellazione.'
)
ON CONFLICT (gdpr_map_table_schema, gdpr_map_table_name, gdpr_map_subject_fk) DO NOTHING;

-- ------------------------------------------------- 2) allowlist TENANT_ADMIN (dichiarazione)
-- TENANT_ADMIN-ALLOWLIST-EXTEND
CREATE TEMP TABLE _ta_extend_000226(code text PRIMARY KEY);
INSERT INTO _ta_extend_000226(code) VALUES
    ('timeline:read'),
    ('timeline:read:self');
DROP TABLE _ta_extend_000226;

DO $$
DECLARE n_map int; n_unmapped int;
BEGIN
  SELECT count(*) INTO n_map FROM sys.sys_gdpr_data_map
   WHERE gdpr_map_table_name = 'sys_user_timeline_events';
  IF n_map <> 1 THEN
    RAISE EXCEPTION '000226: attesa 1 riga di mappa GDPR per sys_user_timeline_events, trovate %', n_map;
  END IF;

  -- Nessuna FK di soggetto su sys_user_* puo' restare senza classificazione: stessa regola
  -- che applica il test, verificata qui cosi' la migration fallisce forte se qualcuno
  -- aggiunge una tabella persona senza mapparla.
  SELECT count(*) INTO n_unmapped
    FROM (
      SELECT c.conrelid::regclass::text AS tbl, a.attname AS col
        FROM pg_constraint c
        JOIN LATERAL unnest(c.conkey) k ON true
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k
       WHERE c.contype = 'f' AND c.confrelid = 'sys.sys_users'::regclass
         AND c.conrelid::regclass::text LIKE 'sys.sys\_user\_%'
         AND a.attname !~ '(^|_)(created_by|updated_by)$|_by$|assessor|reviewer|verified'
    ) fk
   WHERE NOT EXISTS (
     SELECT 1 FROM sys.sys_gdpr_data_map m
      WHERE m.gdpr_map_table_name = replace(fk.tbl, 'sys.', '')
        AND m.gdpr_map_subject_fk = fk.col
   );
  IF n_unmapped <> 0 THEN
    RAISE EXCEPTION '000226: % FK di soggetto su sys_user_* senza classificazione GDPR', n_unmapped;
  END IF;

  RAISE NOTICE '000226: timeline mappata GDPR (PERSONAL/DELETE) + allowlist TENANT_ADMIN dichiarata.';
END $$;
