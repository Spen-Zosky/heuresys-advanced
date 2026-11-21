-- 000505 — Le competenze e le mansioni del catalogo che si vedono in pagina sono in italiano.
--
-- Il seguito della 000504, per i testi che hanno un vettore semantico: 85 valori in inglese
-- (descrizioni di competenze, nomi e descrizioni di mansioni) misurati il 2026-11-21 in sola lettura.
-- Stanno in un file a sé perché sys_skill_embeddings e sys_job_role_embeddings portano l'impronta
-- del testo (nome || ' ' || descrizione) e la sentinella 000342 pretende che combaci: dopo questo
-- file si ricalcolano i vettori con `pnpm embeddings:backfill`, che salta per impronta e rifà solo
-- questi. Finché il ricalcolo non è fatto, il deploy successivo si ferma sulla 000342: è voluto.
--
-- COSA FA, come la 000504: l'inglese resta come traduzione «en» dove manca; il valore base diventa
-- italiano solo se è ancora esattamente quell'inglese; prima e dopo vanno nel giornale
-- staging.testi_italiani_20261121_undo (stessa tabella, chiavi diverse).
--
-- ANNULLARE: UPDATE sys.<tabella> SET <colonna> = u.prima FROM staging.testi_italiani_20261121_undo u
--   WHERE <chiave> = u.chiave AND <colonna> = u.dopo AND u.tabella IN ('sys_skills','sys_job_roles');
--   poi di nuovo `pnpm embeddings:backfill`, e togliere questo file dalla catena.

CREATE TABLE IF NOT EXISTS staging.testi_italiani_20261121_undo (
  tabella   text NOT NULL,
  colonna   text NOT NULL,
  chiave    uuid NOT NULL,
  prima     text NOT NULL,
  dopo      text NOT NULL,
  scritto_il timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tabella, colonna, chiave)
);

CREATE TEMP TABLE tmp_testi_italiani (tabella text, colonna text, chiave uuid, en text, it text, campo text) ON COMMIT DROP;
INSERT INTO tmp_testi_italiani VALUES
  ('sys_job_roles', 'job_role_name', '88299e6d-d50b-43ac-ae2d-522728e98cc5'::uuid, 'Head of Product', 'Responsabile Prodotto', 'name'),
  ('sys_job_roles', 'job_role_name', 'ad55ad24-0a83-4f33-8287-e671d3119401'::uuid, 'Bank Manager', 'Direttore di banca', 'name'),
  ('sys_job_roles', 'job_role_name', '94994d60-e279-4bbd-9add-9dcccee172cd'::uuid, 'System Administrator', 'Amministratore di sistema', 'name'),
  ('sys_job_roles', 'job_role_description', '70cf8a95-e867-41f0-ae4a-1572b5b93931'::uuid, 'Deputy division director', 'Vicedirettore di divisione', 'description'),
  ('sys_job_roles', 'job_role_description', '2af5d327-5dd5-4069-9a5a-e0c901e8f533'::uuid, 'Division director role', 'Ruolo di direttore di divisione', 'description'),
  ('sys_job_roles', 'job_role_description', '4f4c3e55-667e-463a-ac4e-3c3beb2ece70'::uuid, 'Division director role', 'Ruolo di direttore di divisione', 'description'),
  ('sys_job_roles', 'job_role_description', '1f541b30-9b29-44b6-bb95-3877e56d1a84'::uuid, 'Executive leadership role', 'Ruolo di alta direzione', 'description'),
  ('sys_job_roles', 'job_role_description', 'a65949c6-29ba-44fe-ba6e-706f80ab50d3'::uuid, 'Deputy division director', 'Vicedirettore di divisione', 'description'),
  ('sys_job_roles', 'job_role_description', '6964ff8a-8a44-4f7d-b44c-e8c948db5f5a'::uuid, 'Deputy division director', 'Vicedirettore di divisione', 'description'),
  ('sys_job_roles', 'job_role_description', '60ad96aa-f704-4578-8710-2bac7af11495'::uuid, 'Division director role', 'Ruolo di direttore di divisione', 'description'),
  ('sys_job_roles', 'job_role_description', '5556af19-75c3-4d5b-b836-73f5ccd0f25e'::uuid, 'Division director role', 'Ruolo di direttore di divisione', 'description'),
  ('sys_job_roles', 'job_role_description', 'ddf75bb7-b3d4-4e3d-9a1d-4251113f582f'::uuid, 'Deputy division director', 'Vicedirettore di divisione', 'description'),
  ('sys_job_roles', 'job_role_description', '92767c25-4c75-4b80-8f52-6bf7e4e42d9f'::uuid, 'Division director role', 'Ruolo di direttore di divisione', 'description'),
  ('sys_job_roles', 'job_role_description', 'cd3284f2-bb1d-4ab8-ab37-f6d89fbe0adb'::uuid, 'Deputy division director', 'Vicedirettore di divisione', 'description'),
  ('sys_job_roles', 'job_role_description', 'ca16f70b-b7de-49e0-8040-7587c02eeaa1'::uuid, 'Division director role', 'Ruolo di direttore di divisione', 'description'),
  ('sys_job_roles', 'job_role_description', 'b9dcc7f6-8c4a-437f-9913-021ab10465f3'::uuid, 'Deputy division director', 'Vicedirettore di divisione', 'description'),
  ('sys_job_roles', 'job_role_description', '41506270-8d82-4212-9aa9-16f72bf7cb2d'::uuid, 'Division director role', 'Ruolo di direttore di divisione', 'description'),
  ('sys_job_roles', 'job_role_description', 'cf19901f-6e7b-409d-baa0-7055703dced9'::uuid, 'Deputy division director', 'Vicedirettore di divisione', 'description'),
  ('sys_job_roles', 'job_role_description', '9f1e2ece-bab8-4d54-ab80-1816f14add45'::uuid, 'Division director role', 'Ruolo di direttore di divisione', 'description'),
  ('sys_job_roles', 'job_role_description', 'eb3c01e2-b1f1-48a6-b541-856062ca89f0'::uuid, 'Deputy division director', 'Vicedirettore di divisione', 'description'),
  ('sys_skills', 'skill_description', 'c42516b1-4caf-484b-973e-db8774173bab'::uuid, 'Working across departments', 'Lavorare tra funzioni diverse', 'description'),
  ('sys_skills', 'skill_description', '204c7cf6-72c2-4855-8efe-e287acbd3993'::uuid, 'Setting SMART goals', 'Fissare obiettivi SMART', 'description'),
  ('sys_skills', 'skill_description', 'f319989e-ea70-4f53-a9c7-edd3335da027'::uuid, 'Message queue systems', 'Sistemi di code di messaggi', 'description'),
  ('sys_skills', 'skill_description', 'e0cdffc3-6b61-4691-8c2e-34a6928ed1b1'::uuid, 'CI/CD pipeline tool', 'Strumento di pipeline CI/CD', 'description'),
  ('sys_skills', 'skill_description', 'c2e5ca5c-351e-4d02-ac8c-3b23033c3361'::uuid, 'Distributed ledger technology development', 'Sviluppo di tecnologie a registro distribuito', 'description'),
  ('sys_skills', 'skill_description', 'e9d27a75-ddc3-45ad-bceb-8946b515e62a'::uuid, 'Container orchestration platform', 'Piattaforma di orchestrazione dei container', 'description'),
  ('sys_skills', 'skill_description', 'c60d4a53-b233-401a-9905-724a247f1a34'::uuid, 'JavaScript runtime for server-side development', 'Ambiente di esecuzione JavaScript per lo sviluppo lato server', 'description'),
  ('sys_skills', 'skill_description', '5d73363d-3ed7-424e-8b22-b849e111d550'::uuid, 'JavaScript library for building user interfaces', 'Libreria JavaScript per costruire interfacce utente', 'description'),
  ('sys_skills', 'skill_description', 'e511c50b-314a-461e-b663-540a8d53c328'::uuid, 'Managing and maintaining IT systems', 'Gestire e mantenere i sistemi IT', 'description'),
  ('sys_skills', 'skill_description', 'ba879ce8-45a2-41fb-a777-e6cfbb0a37fd'::uuid, 'Analyze and interpret complex data', 'Analizzare e interpretare dati complessi', 'description'),
  ('sys_skills', 'skill_description', '80593e55-184a-4292-b3da-539ef79de142'::uuid, 'Organize and prioritize tasks effectively', 'Organizzare i compiti e dare le priorità con efficacia', 'description'),
  ('sys_skills', 'skill_description', 'aba8b410-c504-4f42-8831-f645b76a42ef'::uuid, 'German language proficiency', 'Conoscenza della lingua tedesca', 'description'),
  ('sys_skills', 'skill_description', '3ae84ed7-4d21-4e78-a9db-98bc9552e9f6'::uuid, 'Finding solutions to challenges', 'Trovare soluzioni ai problemi', 'description'),
  ('sys_skills', 'skill_description', '529690d9-b4c4-4205-9e5d-50d2f0e367ed'::uuid, 'Business negotiation', 'Negoziazione commerciale', 'description'),
  ('sys_skills', 'skill_description', '45c3fb48-5d76-4d23-8885-2174636c9821'::uuid, 'Data protection regulations', 'Normativa sulla protezione dei dati', 'description'),
  ('sys_skills', 'skill_description', '4ca8c1ac-2de2-49cc-a339-c6b045608826'::uuid, 'Windows server management', 'Gestione dei server Windows', 'description'),
  ('sys_skills', 'skill_description', '064ed40e-6b9b-4903-a63a-7aa301b6c3a4'::uuid, 'Apple mobile platform development', 'Sviluppo per la piattaforma mobile Apple', 'description'),
  ('sys_skills', 'skill_description', 'b989ea8f-df04-4046-ba47-27d06eb826e8'::uuid, 'Design user interfaces', 'Progettare interfacce utente', 'description'),
  ('sys_skills', 'skill_description', '6a4609b9-e047-45ac-b40e-5173ff4ce280'::uuid, 'Develop brand identities', 'Sviluppare l''identità dei marchi', 'description'),
  ('sys_skills', 'skill_description', '8657c1dc-4957-4732-8393-055c6465c808'::uuid, 'Business Process Model Notation', 'Notazione BPMN dei processi aziendali', 'description'),
  ('sys_skills', 'skill_description', 'a9f66442-fca1-4a9b-9ec7-a05ecba0604b'::uuid, 'Apache Kafka expertise', 'Competenza in Apache Kafka', 'description'),
  ('sys_skills', 'skill_description', 'fdf73ac8-9f71-4103-8d1b-e64b0b1efcea'::uuid, 'Creating UI wireframes', 'Disegnare i wireframe dell''interfaccia', 'description'),
  ('sys_skills', 'skill_description', '60aa8a4b-d20c-43f1-ac87-8a85fc4cc7f8'::uuid, 'Managing intellectual property', 'Gestire la proprietà intellettuale', 'description'),
  ('sys_skills', 'skill_description', '418f26c0-da0e-470a-ae6b-43a14143142a'::uuid, 'Identify and mitigate financial risks', 'Individuare e mitigare i rischi finanziari', 'description'),
  ('sys_skills', 'skill_description', 'd43a3430-ef45-44aa-8301-eb2c6cd0073a'::uuid, 'Progressive JavaScript framework for UIs', 'Framework JavaScript progressivo per interfacce utente', 'description'),
  ('sys_skills', 'skill_description', '717485a4-054d-442a-ad83-1a42a26417a5'::uuid, 'Platform for containerized application development', 'Piattaforma per lo sviluppo di applicazioni in container', 'description'),
  ('sys_skills', 'skill_description', '5a2d08bb-cf35-483a-94c8-8430065475f0'::uuid, 'Information security standard', 'Standard di sicurezza delle informazioni', 'description'),
  ('sys_skills', 'skill_description', '80d054a9-00fa-4be8-9899-134e0bf4e882'::uuid, 'TypeScript-based web application framework', 'Framework per applicazioni web basato su TypeScript', 'description'),
  ('sys_skills', 'skill_description', '2901aca9-3bad-415b-aa09-b97359766b77'::uuid, 'Server-side application development', 'Sviluppo di applicazioni lato server', 'description'),
  ('sys_skills', 'skill_description', '4d751d4a-4e0d-41af-8ede-f0bce2595963'::uuid, 'Google mobile platform development', 'Sviluppo per la piattaforma mobile Google', 'description'),
  ('sys_skills', 'skill_description', '59c79ab6-397b-4a08-a4c9-dcac3e1f0b56'::uuid, 'Forecasting with data', 'Fare previsioni con i dati', 'description'),
  ('sys_skills', 'skill_description', '5c9a6827-c5f1-4456-bd79-d61e05eb770c'::uuid, 'Planning and executing projects', 'Pianificare ed eseguire progetti', 'description'),
  ('sys_skills', 'skill_description', '7cb5446d-3193-45b0-b407-5acd73cfb527'::uuid, 'Client-side web development', 'Sviluppo web lato client', 'description'),
  ('sys_skills', 'skill_description', 'aa4c1951-af13-485a-923a-4e520caa79d7'::uuid, 'Managing regulatory compliance', 'Gestire la conformità normativa', 'description'),
  ('sys_skills', 'skill_description', 'd8a93d88-4552-44c5-b1f2-43bda5365dfb'::uuid, 'Structured Query Language for database management', 'Linguaggio SQL per la gestione delle basi di dati', 'description'),
  ('sys_skills', 'skill_description', 'de18be78-1eb9-4b6b-89d7-a53708cae725'::uuid, 'Creating visual designs', 'Realizzare progetti grafici', 'description'),
  ('sys_skills', 'skill_description', 'e551f28f-96d5-40b4-8474-c5fb96224a3f'::uuid, 'Negotiating with vendors', 'Negoziare con i fornitori', 'description'),
  ('sys_skills', 'skill_description', 'f742edbe-e686-4efc-b886-f67cdcf2a280'::uuid, 'IT support services', 'Servizi di supporto IT', 'description'),
  ('sys_skills', 'skill_description', '574cbc2d-a5f6-4600-b703-36c65c5a5836'::uuid, 'Google cloud computing services', 'Servizi di cloud computing di Google', 'description'),
  ('sys_skills', 'skill_description', '2223994b-be54-42c9-96b3-c7495075bae4'::uuid, 'Managing computer networks', 'Gestire le reti informatiche', 'description'),
  ('sys_skills', 'skill_description', '78598055-192c-4d31-8190-15564d1592cb'::uuid, 'Building and training ML models', 'Costruire e addestrare modelli di machine learning', 'description'),
  ('sys_skills', 'skill_description', 'f5589de6-1dcb-49c6-872a-9d37ac939885'::uuid, 'Visual workflow management', 'Gestione visuale dei flussi di lavoro', 'description'),
  ('sys_skills', 'skill_description', '1e6f34a6-6da3-40a6-9c3f-322b0c25f443'::uuid, 'Infrastructure as code', 'Infrastruttura come codice', 'description'),
  ('sys_skills', 'skill_description', 'f1d7eea9-ff40-457a-90b3-e11450ccd171'::uuid, 'Development and operations practices', 'Pratiche di sviluppo e gestione operativa (DevOps)', 'description'),
  ('sys_skills', 'skill_description', '9c591e8e-11aa-4743-954c-f1fccaa4c51e'::uuid, 'Designing microservice-based applications', 'Progettare applicazioni a microservizi', 'description'),
  ('sys_skills', 'skill_description', '111d92b0-ebc1-4a8e-b290-4da4409548f9'::uuid, 'Unified Modeling Language', 'Linguaggio di modellazione UML', 'description'),
  ('sys_skills', 'skill_description', '6eeb488a-ce46-4cff-8550-1c16c199941e'::uuid, 'Building online communities', 'Costruire comunità online', 'description'),
  ('sys_skills', 'skill_description', 'e91720fd-be73-44ab-b582-374de66c0844'::uuid, 'Analyze information objectively', 'Analizzare le informazioni con obiettività', 'description'),
  ('sys_skills', 'skill_description', '55fa2deb-d2a1-442a-90ab-d54340bd6a98'::uuid, 'Monitoring systems', 'Sistemi di monitoraggio', 'description'),
  ('sys_skills', 'skill_description', '32266c28-2521-4b33-9905-91af1eb1af24'::uuid, 'Leading Scrum ceremonies', 'Condurre le cerimonie Scrum', 'description'),
  ('sys_skills', 'skill_description', '3672b3fb-d8c2-41fa-86b6-763af8d8ee69'::uuid, 'Linux server management', 'Gestione dei server Linux', 'description'),
  ('sys_skills', 'skill_description', '9e8c4a79-887d-4725-8103-f0e931076c61'::uuid, 'Adjust to new conditions', 'Adattarsi a nuove condizioni', 'description'),
  ('sys_skills', 'skill_description', '06c2b5b1-3642-4f42-b661-7d89da29cff9'::uuid, 'Testing user experience', 'Collaudare l''esperienza d''uso', 'description'),
  ('sys_skills', 'skill_description', 'b994ebe2-00e1-47e0-8507-6dd035db920e'::uuid, 'Tableau visualization tool', 'Strumento di visualizzazione Tableau', 'description'),
  ('sys_skills', 'skill_description', '3c650f06-3749-4ce9-818a-f5c8436e33a4'::uuid, 'Detect and prevent financial crimes', 'Individuare e prevenire i reati finanziari', 'description'),
  ('sys_skills', 'skill_description', 'c3a90c04-655c-44ee-9f0a-47e8609dbf9d'::uuid, 'French language proficiency', 'Conoscenza della lingua francese', 'description'),
  ('sys_skills', 'skill_description', '60df481c-d55e-4e04-b85c-3faf7c8d2579'::uuid, 'Mapping customer experiences', 'Mappare l''esperienza dei clienti', 'description'),
  ('sys_skills', 'skill_description', 'cc454dde-de87-4e2e-a33d-925533db0f99'::uuid, 'Managing remote teams', 'Gestire squadre da remoto', 'description'),
  ('sys_skills', 'skill_description', '82278484-33f7-4106-9f67-c0f1836313f0'::uuid, 'User interface and experience design', 'Progettazione di interfaccia ed esperienza d''uso', 'description'),
  ('sys_skills', 'skill_description', '9d799c0a-a559-4470-8641-8d081872c287'::uuid, 'Test and verify product quality', 'Collaudare e verificare la qualità dei prodotti', 'description'),
  ('sys_skills', 'skill_description', '150b60ea-3172-4ceb-b5d1-f2368559494a'::uuid, 'Query language for APIs', 'Linguaggio di interrogazione per API', 'description'),
  ('sys_skills', 'skill_description', '4e00c6e8-1450-4ab4-a07c-3fc6fe7d2472'::uuid, 'Search engine expertise', 'Competenza nei motori di ricerca', 'description'),
  ('sys_skills', 'skill_description', '2a5ba236-6606-41e5-af06-52ded001c048'::uuid, 'Scrum project management methodology', 'Metodo Scrum di gestione dei progetti', 'description'),
  ('sys_skills', 'skill_description', '17d1dcbb-0b87-4d0a-abb7-83e9576099c4'::uuid, 'Microsoft Power BI expertise', 'Competenza in Microsoft Power BI', 'description'),
  ('sys_skills', 'skill_description', 'f2f2ebbf-ede3-4708-b7ae-9329caced6fb'::uuid, 'Microsoft cloud computing platform', 'Piattaforma di cloud computing Microsoft', 'description');

-- (1) l'inglese resta come traduzione «en» dove non c'è ancora: solo per i campi registrati come
--     traducibili (sys_translatable_field) e solo se la riga esiste in questo database, così non
--     nasce nessuna traduzione orfana (sys.v_reference_translation_orphans) né su una copia ridotta.
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT s.tabella, s.chiave, f.field, 'en', s.en, 'MANUAL'
  FROM tmp_testi_italiani s
  JOIN sys.sys_job_roles x ON x.job_role_id = s.chiave
  JOIN sys.sys_translatable_field f ON f.entity_table = s.tabella AND f.entity_field_column = s.colonna
 WHERE s.tabella = 'sys_job_roles' AND s.colonna = 'job_role_description'
   AND NOT EXISTS (SELECT 1 FROM sys.sys_reference_translations r
                    WHERE r.entity_table = s.tabella AND r.entity_id = s.chiave AND r.field = f.field AND r.locale = 'en');
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT s.tabella, s.chiave, f.field, 'en', s.en, 'MANUAL'
  FROM tmp_testi_italiani s
  JOIN sys.sys_job_roles x ON x.job_role_id = s.chiave
  JOIN sys.sys_translatable_field f ON f.entity_table = s.tabella AND f.entity_field_column = s.colonna
 WHERE s.tabella = 'sys_job_roles' AND s.colonna = 'job_role_name'
   AND NOT EXISTS (SELECT 1 FROM sys.sys_reference_translations r
                    WHERE r.entity_table = s.tabella AND r.entity_id = s.chiave AND r.field = f.field AND r.locale = 'en');
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT s.tabella, s.chiave, f.field, 'en', s.en, 'MANUAL'
  FROM tmp_testi_italiani s
  JOIN sys.sys_skills x ON x.skill_id = s.chiave
  JOIN sys.sys_translatable_field f ON f.entity_table = s.tabella AND f.entity_field_column = s.colonna
 WHERE s.tabella = 'sys_skills' AND s.colonna = 'skill_description'
   AND NOT EXISTS (SELECT 1 FROM sys.sys_reference_translations r
                    WHERE r.entity_table = s.tabella AND r.entity_id = s.chiave AND r.field = f.field AND r.locale = 'en');

-- (3) il giornale, prima di scrivere: solo dove il valore è ancora l'inglese
INSERT INTO staging.testi_italiani_20261121_undo (tabella, colonna, chiave, prima, dopo) SELECT s.tabella, s.colonna, s.chiave, s.en, s.it FROM tmp_testi_italiani s JOIN sys.sys_job_roles x ON x.job_role_id = s.chiave AND x.job_role_description = s.en WHERE s.tabella = 'sys_job_roles' AND s.colonna = 'job_role_description' ON CONFLICT DO NOTHING;
INSERT INTO staging.testi_italiani_20261121_undo (tabella, colonna, chiave, prima, dopo) SELECT s.tabella, s.colonna, s.chiave, s.en, s.it FROM tmp_testi_italiani s JOIN sys.sys_job_roles x ON x.job_role_id = s.chiave AND x.job_role_name = s.en WHERE s.tabella = 'sys_job_roles' AND s.colonna = 'job_role_name' ON CONFLICT DO NOTHING;
INSERT INTO staging.testi_italiani_20261121_undo (tabella, colonna, chiave, prima, dopo) SELECT s.tabella, s.colonna, s.chiave, s.en, s.it FROM tmp_testi_italiani s JOIN sys.sys_skills x ON x.skill_id = s.chiave AND x.skill_description = s.en WHERE s.tabella = 'sys_skills' AND s.colonna = 'skill_description' ON CONFLICT DO NOTHING;

-- (2) il valore base in italiano, con la guardia sul valore inglese
UPDATE sys.sys_job_roles x SET job_role_description = s.it FROM tmp_testi_italiani s
 WHERE s.tabella = 'sys_job_roles' AND s.colonna = 'job_role_description' AND x.job_role_id = s.chiave AND x.job_role_description = s.en;
UPDATE sys.sys_job_roles x SET job_role_name = s.it FROM tmp_testi_italiani s
 WHERE s.tabella = 'sys_job_roles' AND s.colonna = 'job_role_name' AND x.job_role_id = s.chiave AND x.job_role_name = s.en;
UPDATE sys.sys_skills x SET skill_description = s.it FROM tmp_testi_italiani s
 WHERE s.tabella = 'sys_skills' AND s.colonna = 'skill_description' AND x.skill_id = s.chiave AND x.skill_description = s.en;

-- POST-CONDIZIONE: nessuno dei valori di questo file è rimasto in inglese
DO $post$
DECLARE n int := 0; parz int;
BEGIN
  SELECT count(*) INTO parz FROM tmp_testi_italiani s JOIN sys.sys_job_roles x ON x.job_role_id = s.chiave AND x.job_role_description = s.en WHERE s.tabella = 'sys_job_roles' AND s.colonna = 'job_role_description'; n := n + parz;
  SELECT count(*) INTO parz FROM tmp_testi_italiani s JOIN sys.sys_job_roles x ON x.job_role_id = s.chiave AND x.job_role_name = s.en WHERE s.tabella = 'sys_job_roles' AND s.colonna = 'job_role_name'; n := n + parz;
  SELECT count(*) INTO parz FROM tmp_testi_italiani s JOIN sys.sys_skills x ON x.skill_id = s.chiave AND x.skill_description = s.en WHERE s.tabella = 'sys_skills' AND s.colonna = 'skill_description'; n := n + parz;
  IF n > 0 THEN RAISE EXCEPTION '000505: % valori ancora in inglese', n; END IF;
END $post$;
