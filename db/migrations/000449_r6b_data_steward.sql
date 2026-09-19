-- 000449 — Mandato K, R-6 sessione 2 (R-6b nel tabellone): DATA_STEWARD (D2=A, passo 57).
--
-- IL PERCHE'. DATA_STEWARD e' il ruolo di CLIENTE per il custode del dato che ARRIVA da
-- fuori: lettura/scrittura sui moduli tenant-import-runs, reference-sync, provenance,
-- generated-origins, il registro di provenienza, e il registro dei conflitti sugli ibridi
-- (X-4, permesso NUOVO `conflitto_ibrido:resolve` — X-4 e' gia' chiusa, mig. 000446, senza
-- crearlo: lo crea questa migrazione, come previsto dal testo del passo 57 per il caso in
-- cui X-4 non lo abbia ancora fatto).
--
-- MISURATO SUL CODICE VIVO (S1113), non assunto: le rotte reali dei quattro moduli sono
--   tenant-import-runs  -> seed_acquisition:read (GET) + seed_acquisition:trigger (POST)
--   reference-sync       -> reference_sync:read (GET) + reference_sync:trigger (POST)
--   provenance            -> provenance:read (GET, sola lettura: nessuna rotta di scrittura)
--   generated-origins    -> provenance:read (GET, sola lettura: nessuna rotta di scrittura)
-- "lettura e scrittura" sui quattro moduli e' quindi, per costruzione del codice, questi
-- CINQUE permessi (provenance/generated-origins non hanno rotte di scrittura: il confine e'
-- l'assenza della rotta, come per PEOPLE_MANAGER sulle tabelle importate) + il permesso
-- nuovo. NIENTE scrittura sui dati nativi: nessuno dei sei permessi tocca una tabella
-- nativa/ibrida di X-1 (goal/skill/position/organization_unit/...).
--
-- conflitto_ibrido:resolve NON ha ancora una rotta (X-4 non ha costruito un modulo
-- applicativo: "la funzione e' pronta per il primo connettore reale" — sua nota di
-- chiusura). Si congela in permessi-senza-rotta.allowlist.json (S-2), stesso trattamento
-- gia' dato a user_position_assignment:delete prima di G-1.
--
-- LETTURA MASCHERATA DEI DATI PERSONALI (passo 57). Misurato sul codice: provenance/
-- generated-origins sono METADATA di provenienza per decisione D-51 esplicita
-- (routes.ts: "lineage rows are record-provenance metadata... not person-level content"),
-- zero campi personali in risposta. reference-sync e' tassonomia globale (ESCO/ATECO), zero
-- campi personali. tenant-import-runs pero' SI': `TenantImportCandidateSchema` (dentro
-- `GET /:id`) porta email/displayName/naturalKey in chiaro, e le sei regole di validazione
-- (`TenantImportValidation[].message/payload`) li ripetono (es. PERSON_EMAIL.payload.email,
-- POSITION_VACANT.message con l'email dell'occupante). Mascherare SOLO email/displayName a
-- livello del singolo campo lascerebbe la stessa email leggibile dentro naturalKey e dentro
-- almeno quattro payload/messaggi diversi delle regole — la stessa classe di estensione
-- architetturale che R-8 ha dichiarato fuori scope (REGISTRO_SCOPERTE, 2026-09-19): qui pero'
-- il costo e' contenuto (un servizio, non il resolver core I16/I18/I20), quindi la scelta
-- CONSERVATIVA presa in questa sessione e' mascherare l'intero campo `candidates` in
-- `GET /:id` per DATA_STEWARD (mask.ts, maskFields: per-FIELD, DICHIARATO, STABILE — la
-- corsa resta visibile con referto/stato/conteggi, la lista delle persone no). Implementato
-- in apps/api/src/modules/tenant-import-runs/service.ts (dettaglio()), non nella migrazione:
-- nessun oggetto di schema coinvolto.
--
-- Effetto per dove_siamo.py:
--   select 1 from sys.sys_auth_roles where auth_role_code='DATA_STEWARD' and retired_at is null
--
\set ON_ERROR_STOP on

BEGIN;

-- 1. Il ruolo, famiglia dichiarata subito (000414 la pretende). Tenant-scoped come
--    PEOPLE_MANAGER/TAXONOMY_STEWARD: is_platform=false.
INSERT INTO sys.sys_auth_roles
  (auth_role_code, auth_role_name, auth_role_description, auth_role_is_platform, auth_role_category)
VALUES
  ('DATA_STEWARD', 'Data Steward',
   'Custode del dato che ARRIVA da fuori: lettura/scrittura sui moduli tenant-import-runs, reference-sync, provenance, generated-origins e sul registro dei conflitti ibridi (conflitto_ibrido:resolve, X-4). NIENTE scrittura sui dati nativi: il confine e'' l''assenza della rotta. Nato mandato K, R-6 sessione 2, 2026-09-19.',
   false, 'functional')
ON CONFLICT (auth_role_code) DO UPDATE
  SET auth_role_category = EXCLUDED.auth_role_category,
      auth_role_is_platform = EXCLUDED.auth_role_is_platform;

-- 2. Il permesso nuovo: conflitto_ibrido:resolve (X-4 non lo aveva creato).
INSERT INTO sys.sys_auth_permissions
  (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action,
   auth_permission_description)
VALUES
  ('conflitto_ibrido:resolve', 'Resolve hybrid data conflicts',
   'conflitto_ibrido', 'resolve',
   'Risolve un conflitto in sys.sys_conflitti_ibridi (X-4, mig. 000446): un saldo nato qui che non coincide con l''importazione. Nessuna rotta ancora (X-4 non ha costruito un modulo applicativo, congelato in permessi-senza-rotta.allowlist.json). Nato mandato K, R-6 sessione 2, 2026-09-19.')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- 3. Grant a DATA_STEWARD: i sei permessi (vedi commento di testa).
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  CROSS JOIN sys.sys_auth_permissions p
 WHERE r.auth_role_code = 'DATA_STEWARD'
   AND p.auth_permission_code IN (
    ('seed_acquisition:read'),
    ('seed_acquisition:trigger'),
    ('reference_sync:read'),
    ('reference_sync:trigger'),
    ('provenance:read'),
    ('conflitto_ibrido:resolve')
   )
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- 4. Le traduzioni inglesi (guardia 000255: copertura EN totale su ruoli/permessi).
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_auth_roles', r.auth_role_id, x.campo, 'en', x.testo, 'LLM'
  FROM sys.sys_auth_roles r
  JOIN (VALUES
    ('DATA_STEWARD', 'name', 'Data Steward'),
    ('DATA_STEWARD', 'description',
     'Steward of data that ARRIVES from outside: read/write on the tenant-import-runs, reference-sync, provenance and generated-origins modules, plus the hybrid-conflict registry (conflitto_ibrido:resolve, X-4). NO write access to native data: the boundary is the absent route. Born mandato K, R-6 session 2, 2026-09-19.')
  ) AS x(codice, campo, testo) ON x.codice = r.auth_role_code
ON CONFLICT (entity_table, entity_id, field, locale)
  DO UPDATE SET text = EXCLUDED.text, source = 'MANUAL', updated_at = now();

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_auth_permissions', p.auth_permission_id, x.campo, 'en', x.testo, 'LLM'
  FROM sys.sys_auth_permissions p
  JOIN (VALUES
    ('conflitto_ibrido:resolve', 'name', 'Resolve hybrid data conflicts'),
    ('conflitto_ibrido:resolve', 'description',
     'Resolves a conflict in sys.sys_conflitti_ibridi (X-4, mig. 000446): a native-born balance that disagrees with an import. No route yet (X-4 has not built an application module). Born mandato K, R-6 session 2, 2026-09-19.')
  ) AS x(codice, campo, testo) ON x.codice = p.auth_permission_code
ON CONFLICT (entity_table, entity_id, field, locale)
  DO UPDATE SET text = EXCLUDED.text, source = 'MANUAL', updated_at = now();

-- 5. Post-condizione: la migrazione fallisce se qualcosa non torna.
--
-- ⚠ STESSA classe di difetto gia' pagata da 000432/PEOPLE_MANAGER: il floor universale
-- I17 (9 permessi `:self`, ogni ruolo li ha da migrazioni PRIMA di questa — 000186,
-- 000053, 000089, 000101, 000135, 000202, mai filtrate per ruolo) non vede DATA_STEWARD
-- al primissimo giro (nasce qui, dopo di loro): 0 derivati al primo apply, 9 dal secondo
-- giro completo della catena in poi. DATA_STEWARD non ha skill:update ne' leads:read,
-- quindi i due mirror noti (skill:delete su skill:update, leads:update su leads:read)
-- NON si applicano: misurato sul codice dei due file (000177, 000232), nessun terzo
-- mirror trovato per i sei permessi qui concessi (nessuna migrazione li usa come sorgente
-- di un mirror, cercato su tutto db/migrations/).
CREATE TEMP TABLE _ds_espliciti(code text PRIMARY KEY);
INSERT INTO _ds_espliciti(code) VALUES
  ('seed_acquisition:read'),('seed_acquisition:trigger'),
  ('reference_sync:read'),('reference_sync:trigger'),
  ('provenance:read'),('conflitto_ibrido:resolve');

CREATE TEMP TABLE _ds_derivati(code text PRIMARY KEY);
INSERT INTO _ds_derivati(code) VALUES
  ('consent:manage:self'),('gdpr:export:self'),('leave:request:self'),
  ('me:content:read'),('me:preferences:read'),('me:preferences:update'),
  ('me:sessions:manage'),('surveys:respond:self'),('team:read:self');

DO $$
DECLARE
  n_ds int; n_senza_cat int; n_platform_true int;
  n_espliciti int; n_derivati_attesi int; n_mancanti_espliciti int;
  n_derivati_presenti int; n_fuori_elenco int; n_vietati int;
BEGIN
  SELECT count(*) INTO n_espliciti FROM _ds_espliciti;
  IF n_espliciti <> 6 THEN
    RAISE EXCEPTION '000449: l''elenco _ds_espliciti ha % righe, attese 6 (duplicato interno?)', n_espliciti;
  END IF;
  SELECT count(*) INTO n_derivati_attesi FROM _ds_derivati;
  IF n_derivati_attesi <> 9 THEN
    RAISE EXCEPTION '000449: l''elenco _ds_derivati ha % righe, attese 9 (duplicato interno?)', n_derivati_attesi;
  END IF;

  -- i 6 espliciti DEVONO esserci SEMPRE: li concede questa stessa migrazione,
  -- incondizionatamente, un blocco sopra.
  SELECT count(*) INTO n_mancanti_espliciti
    FROM _ds_espliciti e
   WHERE NOT EXISTS (
     SELECT 1 FROM sys.sys_auth_role_permissions rp
       JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
       JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
      WHERE r.auth_role_code = 'DATA_STEWARD' AND rp.revoked_at IS NULL
        AND p.auth_permission_code = e.code
   );
  IF n_mancanti_espliciti <> 0 THEN
    RAISE EXCEPTION '000449: % permessi ESPLICITI mancano a DATA_STEWARD (dovrebbero esserci sempre, concessi da questa stessa migrazione)', n_mancanti_espliciti;
  END IF;

  -- nessun codice FUORI dall'unione 6+9: un codice fuori e' un self-healing nuovo o un
  -- errore, non si scopre da un totale che coincide per caso (DIF-4: enumera, non contare).
  SELECT count(*) INTO n_fuori_elenco
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'DATA_STEWARD' AND rp.revoked_at IS NULL
     AND p.auth_permission_code NOT IN (SELECT code FROM _ds_espliciti
                                         UNION ALL SELECT code FROM _ds_derivati);
  IF n_fuori_elenco <> 0 THEN
    RAISE EXCEPTION '000449: DATA_STEWARD ha % permessi fuori dall''unione espliciti+derivati (nuovo self-healing/mirror da investigare)', n_fuori_elenco;
  END IF;

  -- i 9 derivati sono informativi: 0 al primo giro, 9 dai giri successivi.
  SELECT count(*) INTO n_derivati_presenti
    FROM _ds_derivati d
   WHERE EXISTS (
     SELECT 1 FROM sys.sys_auth_role_permissions rp
       JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
       JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
      WHERE r.auth_role_code = 'DATA_STEWARD' AND rp.revoked_at IS NULL
        AND p.auth_permission_code = d.code
   );
  IF n_derivati_presenti NOT IN (0, 9) THEN
    RAISE EXCEPTION '000449: % derivati su 9 presenti — un self-healing e'' scattato a meta'' (atteso 0 al primo giro, 9 dai successivi)', n_derivati_presenti;
  END IF;

  SELECT count(*) INTO n_ds
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
   WHERE r.auth_role_code = 'DATA_STEWARD' AND rp.revoked_at IS NULL;

  -- Niente scrittura sui dati nativi: typo-guard esplicito su ogni dominio nativo/ibrido
  -- noto (stessa lista di domini presenti in PEOPLE_MANAGER, R-6 sessione 1, 000432).
  SELECT count(*) INTO n_vietati
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'DATA_STEWARD' AND rp.revoked_at IS NULL
     AND (
       p.auth_permission_code LIKE 'goal:%' OR p.auth_permission_code LIKE 'skill:%'
       OR p.auth_permission_code LIKE 'position:%' OR p.auth_permission_code LIKE 'organization_unit%'
       OR p.auth_permission_code LIKE 'career_succession:%' OR p.auth_permission_code LIKE 'kpi:%'
       OR p.auth_permission_code LIKE 'okr:%' OR p.auth_permission_code LIKE 'learning:%'
       OR p.auth_permission_code LIKE 'mentorship:%' OR p.auth_permission_code LIKE 'engagement_feedback:%'
       OR p.auth_permission_code LIKE 'training_initiative:%' OR p.auth_permission_code LIKE 'user:%'
       OR p.auth_permission_code LIKE 'gap_analysis:%' OR p.auth_permission_code LIKE 'assessment:%'
       OR p.auth_permission_code LIKE 'gdpr:%' OR p.auth_permission_code = 'role:assign'
       OR p.auth_permission_code = 'whistleblowing:manage' OR p.auth_permission_code = 'delegation:manage'
       OR p.auth_permission_code IN ('candidate:write','interview:feedback','offer:manage','requisition:manage')
       OR p.auth_permission_code = 'tenant_materialization:execute'
     );
  IF n_vietati <> 0 THEN
    RAISE EXCEPTION '000449: DATA_STEWARD non deve avere permessi di scrittura sui dati nativi/altri domini, ne ha %', n_vietati;
  END IF;

  IF EXISTS (SELECT 1 FROM sys.v_permessi_ritirati_a_ruoli_preesistenti) THEN
    RAISE EXCEPTION '000449: G-D2 non e'' vuota dopo una migrazione senza ritiri previsti';
  END IF;

  SELECT count(*) INTO n_senza_cat
    FROM sys.sys_auth_roles
   WHERE auth_role_category IS NULL OR btrim(auth_role_category) = '';
  IF n_senza_cat <> 0 THEN
    RAISE EXCEPTION '000449: % ruoli senza famiglia dichiarata dopo questa migrazione', n_senza_cat;
  END IF;

  SELECT count(*) INTO n_platform_true FROM sys.sys_auth_roles WHERE auth_role_is_platform;
  IF n_platform_true <> 1 THEN
    RAISE EXCEPTION '000449: auth_role_is_platform=true deve restare su UN solo ruolo (PLATFORM_ADMIN), ne ha %', n_platform_true;
  END IF;

  RAISE NOTICE '000449: DATA_STEWARD creato (% permessi live: 6 espliciti + % derivati su 9 self-floor); 0 permessi vietati; G-D2 a zero; 0 ruoli senza famiglia; is_platform invariato su PLATFORM_ADMIN.', n_ds, n_derivati_presenti;
END $$;

DROP TABLE _ds_espliciti;
DROP TABLE _ds_derivati;

COMMIT;

-- FINE 000449
