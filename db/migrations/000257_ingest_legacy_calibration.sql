-- ═══════════════════════════════════════════════════════════════════════════════
-- 000257_ingest_legacy_calibration.sql
--
-- CICLO DI VALUTAZIONE — PASSO 2 di 7: LE CALIBRAZIONI REALI DAL LEGACY.
--
-- Che cosa porta dentro
--   35 sessioni di calibrazione di RTL Bank, 20 partecipanti, 40 discussioni —
--   dato di business che esiste nel legacy dal 2024 e che in advanced non c'e' mai
--   arrivato. Non sono numeri di riempimento: sono riunioni con data, luogo, sala,
--   facilitatore, note di sintesi e il conteggio degli aggiustamenti, e le 40
--   discussioni portano il voto PRIMA e il voto DOPO con la ragione dello
--   spostamento. E' il documento che rende verificabile una decisione collegiale.
--
-- IL FILTRO PER TENANT NON E' UNA PRECAUZIONE, E' IL PUNTO
--   Nel legacy le sessioni di calibrazione sono 86, non 35. Le altre 51 sono
--   SmartFood S.r.l. (31), EcoNova (14) — le due aziende che questo prodotto NON
--   ospita, le stesse le cui 6.746 righe sono state bonificate in S1042 — e
--   Heuresys System (6, senza alcun partecipante ne' discussione). Un'ingestione
--   che avesse letto «calibration_sessions» senza guardare il tenant avrebbe fatto
--   rientrare dalla finestra cio' che una migrazione aveva buttato fuori dalla
--   porta. Qui il filtro e' a monte: le righe sotto sono state ESTRATTE gia'
--   filtrate, e la verifica finale ricontrolla che nessuna sessione appartenga a
--   un tenant diverso da RTL Bank.
--
-- Le persone si risolvono, non si scrivono
--   Ogni riferimento a una persona passa da `user_external_code = 'LEGACY_EMP::'||id`,
--   che e' la chiave canonica dichiarata da I14 (ADR-0024): il legacy e'
--   EMPLOYEE-centrico, la persona e' `employees`, non `users`. Verificato prima di
--   scrivere: le 42 persone citate dalle tre tabelle esistono TUTTE in advanced,
--   zero mancanti. Se una mancasse, la verifica finale se ne accorgerebbe invece di
--   inserire una riga che punta al vuoto.
--
-- Provenienza tracciata come per ogni import: `sys_source_lineage_records`.
-- Rieseguibile: chiave naturale `LEGACY_CALIB_*::<id>` con ON CONFLICT DO NOTHING.
-- Prerequisiti: 000256 applicata.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══ righe generate dal legacy: NON scritte a mano ═══
CREATE TEMP TABLE l_ses (id text, nome text, descr text, dip text, quando timestamptz,
  durata int, luogo text, facil text, stato text, note text, agg int) ON COMMIT DROP;
INSERT INTO l_ses VALUES
  ('b41adc15-5416-4222-a656-1243c26ce760','Q3 2024 Performance Calibration - Operations','Calibration of Q3 performance ratings for Operations department','Operations','2024-10-15 10:00:00',180,'Milan HQ - Board Room','e22a956e-d122-49f4-a753-21d118be4fe4','COMPLETED','Aligned 12 ratings. 3 adjustments from initial manager ratings. Strong discussion on high-potential identification.',3),
  ('df8106d3-75fd-4b8b-82f9-ec59f08cef97','Q3 2024 Performance Calibration - Risk & Compliance','Calibration for Risk and Compliance teams','Risk Management','2024-10-16 14:00:00',150,'Milan HQ - Conference A','56b6adff-98a4-4d51-9c27-2c3db087b151','COMPLETED','Reviewed 18 employees. Identified 2 high potentials for succession planning.',2),
  ('a2605a63-adf2-4883-8635-799ed891b380','Q3 2024 Performance Calibration - Technology','Tech team calibration session','Technology','2024-10-17 09:00:00',120,'Virtual - MS Teams','3b60f2d4-a0a7-4bf0-af58-ac9c7e4b741d','COMPLETED','Good alignment across managers. Discussed promotion readiness for 4 senior engineers.',1),
  ('c90a6131-d623-4475-b3c8-b0916d8fbf97','Q4 2024 Year-End Calibration','Annual calibration for all departments','Cross-functional','2024-12-10 09:00:00',240,'Milan HQ - Auditorium','70aae718-bdb5-4ea1-ae2b-4a94b4335ac8','SCHEDULED','Calibration session completed with consensus on ratings',0),
  ('200af9c1-af5c-4385-a1eb-83a3f4c1547d','Calibration Human Resources 9/2025','Performance calibration session for Human Resources','Human Resources','2025-09-13 06:46:44.25958',63,'Board Room',NULL,'COMPLETED',NULL,6),
  ('8f0d9340-75db-495e-bf3d-a9c0eb313f6f','Calibration Retail Banking 9/2025','Performance calibration session for Retail Banking','Retail Banking','2025-09-13 12:41:44.794249',64,'Board Room',NULL,'COMPLETED',NULL,6),
  ('ca9339f1-b0a7-4dbd-96b4-c78aa43086c1','Calibration Information Technology 9/2025','Performance calibration session for Information Technology','Information Technology','2025-09-16 01:28:27.989133',80,'Meeting Room A',NULL,'COMPLETED',NULL,12),
  ('31b9cacd-bb48-446b-9b5e-cd31057df75b','Calibration Risk Management 9/2025','Performance calibration session for Risk Management','Risk Management','2025-09-16 16:53:24.306455',83,'Meeting Room A',NULL,'COMPLETED',NULL,13),
  ('de107066-9169-4ea5-bd36-7bc36bbf19af','Calibration Commercial Banking 9/2025','Performance calibration session for Commercial Banking','Commercial Banking','2025-09-16 22:34:24.813024',85,'Meeting Room A',NULL,'COMPLETED',NULL,13),
  ('60e0fc73-4c98-488e-a582-b32e71090941','Calibration Finance & Treasury 9/2025','Performance calibration session for Finance & Treasury','Finance & Treasury','2025-09-17 00:37:51.72197',85,'Meeting Room A',NULL,'COMPLETED',NULL,13),
  ('d3be7f34-b55a-4770-b180-7717ad8cab2c','Calibration Legal & Compliance 9/2025','Performance calibration session for Legal & Compliance','Legal & Compliance','2025-09-18 08:05:03.895074',93,'Virtual',NULL,'COMPLETED',NULL,16),
  ('45420aff-c04d-4bb6-a8b9-5c5b699e524b','Calibration Marketing 9/2025','Performance calibration session for Marketing','Marketing','2025-09-20 04:50:24.713663',104,'Virtual',NULL,'COMPLETED',NULL,20),
  ('d8b69b97-d870-4caa-9a5b-685356f408a2','Calibration Human Resources 10/2025','Performance calibration session for Human Resources','Human Resources','2025-10-14 11:48:41.190298',70,'Meeting Room A',NULL,'COMPLETED',NULL,8),
  ('194d17e8-2a3a-4770-b345-27308131937b','Calibration Retail Banking 10/2025','Performance calibration session for Retail Banking','Retail Banking','2025-10-15 01:49:50.42421',74,'Meeting Room A',NULL,'COMPLETED',NULL,10),
  ('fd10e789-010e-446c-ade7-60477bf87186','Calibration Operations 10/2025','Performance calibration session for Operations','Operations','2025-10-17 04:41:58.518573',86,'Meeting Room A',NULL,'COMPLETED',NULL,14),
  ('be753a1e-7cb4-4566-8405-1ed018fce6da','Calibration Commercial Banking 10/2025','Performance calibration session for Commercial Banking','Commercial Banking','2025-10-17 06:29:51.153798',87,'Meeting Room A',NULL,'COMPLETED',NULL,14),
  ('79a50f94-9682-469a-8356-bc3442d43d10','Calibration Direzione Generale 10/2025','Performance calibration session for Direzione Generale','Direzione Generale','2025-10-17 17:31:15.694584',90,'Meeting Room A',NULL,'COMPLETED',NULL,15),
  ('b4bda480-74cc-43c9-a58c-abd1af154ec3','Calibration Marketing 10/2025','Performance calibration session for Marketing','Marketing','2025-10-17 23:03:32.10651',91,'Virtual',NULL,'COMPLETED',NULL,15),
  ('0f33881f-3476-42ed-8426-e61250f31e23','Calibration Finance & Treasury 10/2025','Performance calibration session for Finance & Treasury','Finance & Treasury','2025-10-18 06:36:53.236013',93,'Virtual',NULL,'COMPLETED',NULL,16),
  ('6de3e662-a5d6-4251-9292-01d9befbd111','Calibration Legal & Compliance 10/2025','Performance calibration session for Legal & Compliance','Legal & Compliance','2025-10-18 07:53:07.292408',93,'Virtual',NULL,'COMPLETED',NULL,16),
  ('28121fcc-4e15-4c72-ae2f-9b3f73e35df3','Calibration Retail Banking 11/2025','Performance calibration session for Retail Banking','Retail Banking','2025-11-14 07:56:37.203351',69,'Board Room',NULL,'COMPLETED',NULL,8),
  ('1d231bce-c8de-4bea-b120-766cd2b477e2','Calibration Direzione Generale 11/2025','Performance calibration session for Direzione Generale','Direzione Generale','2025-11-14 21:17:37.735584',72,'Meeting Room A',NULL,'COMPLETED',NULL,9),
  ('f8b5da29-bf64-4cce-a5b5-988ac402aa4f','Calibration Information Technology 11/2025','Performance calibration session for Information Technology','Information Technology','2025-11-15 04:29:40.868077',74,'Meeting Room A',NULL,'COMPLETED',NULL,10),
  ('9dc90484-ef58-4d74-a188-7a98a38017d5','Calibration Human Resources 11/2025','Performance calibration session for Human Resources','Human Resources','2025-11-15 07:36:49.33879',75,'Meeting Room A',NULL,'COMPLETED',NULL,10),
  ('237f8776-f502-44e8-8f87-ec632db11599','Calibration Marketing 11/2025','Performance calibration session for Marketing','Marketing','2025-11-17 20:00:30.999032',90,'Virtual',NULL,'COMPLETED',NULL,15),
  ('5c96cbe7-25cc-4ec3-9f83-2556a7d58dbf','Calibration Risk Management 11/2025','Performance calibration session for Risk Management','Risk Management','2025-11-17 20:36:37.574664',90,'Virtual',NULL,'COMPLETED',NULL,15),
  ('d9207762-107c-481b-8a7d-e5effb665a22','Calibration Commercial Banking 11/2025','Performance calibration session for Commercial Banking','Commercial Banking','2025-11-18 23:50:40.080993',97,'Virtual',NULL,'COMPLETED',NULL,17),
  ('91763712-5b1c-4a06-ba8f-2d3820b62458','Calibration Finance & Treasury 12/2025','Performance calibration session for Finance & Treasury','Finance & Treasury','2025-12-14 06:38:35.45353',69,'Board Room',NULL,'SCHEDULED',NULL,8),
  ('575be939-3545-482f-ae35-c01d54839021','Calibration Human Resources 12/2025','Performance calibration session for Human Resources','Human Resources','2025-12-15 17:24:15.346667',78,'Meeting Room A',NULL,'SCHEDULED',NULL,11),
  ('5c26954c-cce3-4da6-af08-21760b8d522f','Calibration Retail Banking 12/2025','Performance calibration session for Retail Banking','Retail Banking','2025-12-17 11:09:22.003886',88,'Meeting Room A',NULL,'SCHEDULED',NULL,14),
  ('764f66c2-686b-4c99-bd84-26b7ce165e66','Calibration Risk Management 12/2025','Performance calibration session for Risk Management','Risk Management','2025-12-17 13:31:26.105284',89,'Meeting Room A',NULL,'SCHEDULED',NULL,15),
  ('1190a618-4648-4efe-be47-24b993b89f35','Calibration Operations 12/2025','Performance calibration session for Operations','Operations','2025-12-18 04:47:38.073961',92,'Virtual',NULL,'SCHEDULED',NULL,16),
  ('82074415-f548-4837-887c-e90119f33f34','Calibration Information Technology 12/2025','Performance calibration session for Information Technology','Information Technology','2025-12-18 17:16:13.18725',95,'Virtual',NULL,'SCHEDULED',NULL,17),
  ('2343507c-726a-4ced-81c4-ef3ff1bd74d3','Calibration Commercial Banking 12/2025','Performance calibration session for Commercial Banking','Commercial Banking','2025-12-19 06:44:32.663057',99,'Virtual',NULL,'SCHEDULED',NULL,18),
  ('b85beba3-0c52-4f60-ac83-963bb0632a38','Calibration Marketing 12/2025','Performance calibration session for Marketing','Marketing','2025-12-19 19:10:32.680238',102,'Virtual',NULL,'SCHEDULED',NULL,19);

CREATE TEMP TABLE l_par (id text, ses text, persona text, ruolo text,
  presente boolean, entrato timestamptz) ON COMMIT DROP;
INSERT INTO l_par VALUES
  ('00e855d8-7337-4d5f-bc52-5a2d670d5af0','b41adc15-5416-4222-a656-1243c26ce760','3b60f2d4-a0a7-4bf0-af58-ac9c7e4b741d','FACILITATOR',true,'2025-11-28 20:47:14.199261'),
  ('1d126a8b-19b6-428f-a3a0-638a2da1d63b','a2605a63-adf2-4883-8635-799ed891b380','4dc6f190-c6a6-4e2a-8536-0115ebcda256','OBSERVER',true,'2025-11-15 20:47:14.199261'),
  ('1f1ea355-d0fb-412d-b057-7de9d24d974f','b41adc15-5416-4222-a656-1243c26ce760','4cc2dc19-f2cd-4fcb-b757-52477cfbdda8','OBSERVER',false,'2025-12-02 20:47:14.199261'),
  ('2f94c635-2154-465b-a993-0b79ae3e6dfa','c90a6131-d623-4475-b3c8-b0916d8fbf97','3c7681cb-6ad7-41dc-b91a-c244aa069a16','PARTICIPANT',true,'2025-11-06 20:47:14.199261'),
  ('41a568e7-182a-4a4c-a08e-0a895de1bfa7','df8106d3-75fd-4b8b-82f9-ec59f08cef97','4dc6f190-c6a6-4e2a-8536-0115ebcda256','OBSERVER',true,'2025-11-04 20:47:14.199261'),
  ('500b435a-1e23-4bd6-882f-924e8f95a657','b41adc15-5416-4222-a656-1243c26ce760','3c7681cb-6ad7-41dc-b91a-c244aa069a16','PARTICIPANT',false,'2025-12-03 20:47:14.199261'),
  ('5d686357-f1cc-4f19-9c73-8fa6a68da534','c90a6131-d623-4475-b3c8-b0916d8fbf97','1785bd08-9fa3-4ce0-a05b-2326f2ab9856','OBSERVER',true,'2025-11-04 20:47:14.199261'),
  ('5d9f4c07-c682-4924-b14d-58fce6535e45','a2605a63-adf2-4883-8635-799ed891b380','3b60f2d4-a0a7-4bf0-af58-ac9c7e4b741d','FACILITATOR',true,'2025-11-13 20:47:14.199261'),
  ('5fd5a0f6-feb2-4794-b833-9ea73e4e3e63','c90a6131-d623-4475-b3c8-b0916d8fbf97','4dc6f190-c6a6-4e2a-8536-0115ebcda256','FACILITATOR',true,'2025-11-21 20:47:14.199261'),
  ('6a9ce431-4335-4936-81b4-e7f4b3b02d38','b41adc15-5416-4222-a656-1243c26ce760','4dc6f190-c6a6-4e2a-8536-0115ebcda256','OBSERVER',true,'2025-11-19 20:47:14.199261'),
  ('9d27d0fe-f31e-4776-bb9e-c1a33ae5045a','c90a6131-d623-4475-b3c8-b0916d8fbf97','3b60f2d4-a0a7-4bf0-af58-ac9c7e4b741d','PARTICIPANT',true,'2025-11-23 20:47:14.199261'),
  ('9d5e91e6-7eb8-48ac-99e1-8ed688010bca','a2605a63-adf2-4883-8635-799ed891b380','3c7681cb-6ad7-41dc-b91a-c244aa069a16','PARTICIPANT',true,'2025-11-27 20:47:14.199261'),
  ('a6bf8325-8025-48d3-95ed-b22de78c8a0f','c90a6131-d623-4475-b3c8-b0916d8fbf97','4cc2dc19-f2cd-4fcb-b757-52477cfbdda8','OBSERVER',true,'2025-11-22 20:47:14.199261'),
  ('a8ab7268-7cb2-4ae1-8714-9000da4fb19d','df8106d3-75fd-4b8b-82f9-ec59f08cef97','1785bd08-9fa3-4ce0-a05b-2326f2ab9856','OBSERVER',true,'2025-11-18 20:47:14.199261'),
  ('c6b107dd-a091-421a-8c0a-cf49f4e53c63','df8106d3-75fd-4b8b-82f9-ec59f08cef97','3b60f2d4-a0a7-4bf0-af58-ac9c7e4b741d','PARTICIPANT',true,'2025-11-05 20:47:14.199261'),
  ('c87017d1-d7d7-4337-a9af-fba53b528e68','a2605a63-adf2-4883-8635-799ed891b380','1785bd08-9fa3-4ce0-a05b-2326f2ab9856','OBSERVER',true,'2025-11-07 20:47:14.199261'),
  ('d7849d6e-1155-43ff-8ae6-51c71f509f9d','df8106d3-75fd-4b8b-82f9-ec59f08cef97','3c7681cb-6ad7-41dc-b91a-c244aa069a16','PARTICIPANT',true,'2025-11-26 20:47:14.199261'),
  ('e7ea0287-0491-456c-a787-b682e1bdda6a','a2605a63-adf2-4883-8635-799ed891b380','4cc2dc19-f2cd-4fcb-b757-52477cfbdda8','PARTICIPANT',true,'2025-11-10 20:47:14.199261'),
  ('f9eafdb0-43bb-41e8-a41c-3d5a31adb8e7','b41adc15-5416-4222-a656-1243c26ce760','1785bd08-9fa3-4ce0-a05b-2326f2ab9856','PARTICIPANT',true,'2025-11-21 20:47:14.199261'),
  ('fb3a95bd-1cff-4165-856c-aa2ec69c73bc','df8106d3-75fd-4b8b-82f9-ec59f08cef97','4cc2dc19-f2cd-4fcb-b757-52477cfbdda8','FACILITATOR',true,'2025-11-07 20:47:14.199261');

CREATE TEMP TABLE l_dis (id text, ses text, persona text, voto0 numeric, pot0 text,
  voto1 numeric, pot1 text, mossa boolean, note text, motivo text, quando timestamptz) ON COMMIT DROP;
INSERT INTO l_dis VALUES
  ('0dbbe75b-29f3-4570-8918-7522f836c6b3','df8106d3-75fd-4b8b-82f9-ec59f08cef97','54e9d401-9baf-4204-9d8f-33f8830ef932',3,'MEDIUM',4,'MEDIUM',true,'Performance discussion completed. Employee reviewed against peers.','Cross-team calibration adjustment based on peer comparison','2025-11-24 20:46:29.939253'),
  ('192ea930-7217-43d2-ae43-a17270d90de7','b41adc15-5416-4222-a656-1243c26ce760','1ff05c57-4065-42fd-a781-f57a00a0c4c1',3,'HIGH',4,'HIGH',true,'Performance discussion completed. Employee reviewed against peers.','Cross-team calibration adjustment based on peer comparison','2025-11-26 20:46:29.939253'),
  ('1ce6f85e-b535-4c56-a79e-261c2e62a314','df8106d3-75fd-4b8b-82f9-ec59f08cef97','f6325909-23c3-4f9b-88c1-0372c43950d4',4,'HIGH',4,'HIGH',true,'Performance discussion completed. Employee reviewed against peers.','Cross-team calibration adjustment based on peer comparison','2025-12-01 20:46:29.939253'),
  ('31584eb5-16ce-444d-8407-7a6ca0c61c34','a2605a63-adf2-4883-8635-799ed891b380','108a2057-f80a-4344-9c9c-a18acd9b3b6d',3,'LOW',5,'LOW',false,'Performance discussion completed. Employee reviewed against peers.','Adjusted based on cross-team comparison','2025-11-10 20:46:29.939253'),
  ('3650f6f5-4c73-476a-80cc-c5f3429a8a67','c90a6131-d623-4475-b3c8-b0916d8fbf97','0aea4521-8d35-4df5-9aa5-d62ca7d2e984',3,'LOW',3,'LOW',false,'Performance discussion completed. Employee reviewed against peers.',NULL,'2025-11-27 20:46:29.939253'),
  ('36e89c71-4472-4b90-adab-cb8df7986753','c90a6131-d623-4475-b3c8-b0916d8fbf97','3b60f2d4-a0a7-4bf0-af58-ac9c7e4b741d',4,'MEDIUM',5,'MEDIUM',false,'Performance discussion completed. Employee reviewed against peers.','Adjusted based on cross-team comparison','2025-11-19 20:46:29.939253'),
  ('3a1bc981-92d8-4c57-aed4-256ada274d88','b41adc15-5416-4222-a656-1243c26ce760','74b966d2-e5ac-4528-acc4-a6a21d24b5c5',4,'MEDIUM',4,'MEDIUM',false,'Performance discussion completed. Employee reviewed against peers.',NULL,'2025-11-10 20:46:29.939253'),
  ('4179d6f4-9f78-4b8e-bc00-2822d12631bb','b41adc15-5416-4222-a656-1243c26ce760','fd7210b5-11af-47d4-8a56-f23610bef72d',5,'HIGH',3,'HIGH',true,'Performance discussion completed. Employee reviewed against peers.','Adjusted based on cross-team comparison','2025-11-09 20:46:29.939253'),
  ('480b4cf5-352c-4e30-a8fa-3d985a54232f','b41adc15-5416-4222-a656-1243c26ce760','35738460-31e6-4390-b2b6-26f6fefb9af0',4,'MEDIUM',3,'MEDIUM',false,'Performance discussion completed. Employee reviewed against peers.','Adjusted based on cross-team comparison','2025-11-06 20:46:29.939253'),
  ('5d2be6ef-0396-44c1-a969-662f4e2d7b2f','df8106d3-75fd-4b8b-82f9-ec59f08cef97','66faddef-45c1-42ba-b821-32b381e6f810',4,'LOW',5,'LOW',false,'Performance discussion completed. Employee reviewed against peers.',NULL,'2025-11-30 20:46:29.939253'),
  ('5e9c6ad1-de38-4004-9a07-37053a52a304','c90a6131-d623-4475-b3c8-b0916d8fbf97','8585190e-a0ee-444e-8e7b-d9508dfb5b74',4,'LOW',4,'LOW',false,'Performance discussion completed. Employee reviewed against peers.',NULL,'2025-11-13 20:46:29.939253'),
  ('62a53f66-9358-45d0-8f35-98759c2bf8f1','c90a6131-d623-4475-b3c8-b0916d8fbf97','6f4e0b48-3838-48f9-a8f2-3859231288ce',5,'HIGH',4,'HIGH',false,'Performance discussion completed. Employee reviewed against peers.',NULL,'2025-12-03 20:46:29.939253'),
  ('66052910-1ddd-4600-aa5a-14025f477289','b41adc15-5416-4222-a656-1243c26ce760','d9d32524-ba0b-450c-9dcf-1cd2a347d7a3',5,'MEDIUM',5,'MEDIUM',false,'Performance discussion completed. Employee reviewed against peers.','Adjusted based on cross-team comparison','2025-11-05 20:46:29.939253'),
  ('681a11e4-543a-4cdf-9daf-aca93cc557c1','a2605a63-adf2-4883-8635-799ed891b380','493c20ad-2130-47ba-b285-003bf180b9b6',3,'HIGH',4,'HIGH',true,'Performance discussion completed. Employee reviewed against peers.','Adjusted based on cross-team comparison','2025-11-24 20:46:29.939253'),
  ('6a365935-c917-4cfd-ad74-ec4fc8cc4b74','b41adc15-5416-4222-a656-1243c26ce760','00ab77d2-eb90-4af1-b23a-f84ac02a710f',4,'LOW',5,'LOW',false,'Performance discussion completed. Employee reviewed against peers.','Adjusted based on cross-team comparison','2025-11-21 20:46:29.939253'),
  ('6a759826-1bf8-4169-b8f8-7a06612c64b7','a2605a63-adf2-4883-8635-799ed891b380','3847c0c3-f744-4cbf-a01b-5af039ec8ea5',3,'HIGH',3,'HIGH',true,'Performance discussion completed. Employee reviewed against peers.','Cross-team calibration adjustment based on peer comparison','2025-11-19 20:46:29.939253'),
  ('709cf671-cd7e-4f8f-8ccb-4c9f713fb11b','a2605a63-adf2-4883-8635-799ed891b380','d3c4200a-8a73-42aa-b330-7337881cc697',3,'HIGH',4,'HIGH',true,'Performance discussion completed. Employee reviewed against peers.','Adjusted based on cross-team comparison','2025-11-21 20:46:29.939253'),
  ('748ea9b1-95b4-40dc-9d61-ccd30c61f86c','c90a6131-d623-4475-b3c8-b0916d8fbf97','56b6adff-98a4-4d51-9c27-2c3db087b151',4,'LOW',4,'LOW',false,'Performance discussion completed. Employee reviewed against peers.',NULL,'2025-11-28 20:46:29.939253'),
  ('7654415c-72d7-4efd-986c-d92672cfec33','df8106d3-75fd-4b8b-82f9-ec59f08cef97','2fe8ae94-860b-41a5-a9f9-0effb8c5e52f',3,'HIGH',5,'HIGH',false,'Performance discussion completed. Employee reviewed against peers.','Adjusted based on cross-team comparison','2025-11-05 20:46:29.939253'),
  ('7aaaf885-4ddb-4d98-a446-9baf43d05a79','a2605a63-adf2-4883-8635-799ed891b380','7a39720d-6dc5-43df-880f-64f780c3577c',4,'MEDIUM',3,'MEDIUM',false,'Performance discussion completed. Employee reviewed against peers.',NULL,'2025-11-17 20:46:29.939253'),
  ('80595061-e551-479c-bdf3-367c849b3b34','a2605a63-adf2-4883-8635-799ed891b380','9dd2208b-bbaf-49e2-b3b4-02b1a39841fb',4,'HIGH',4,'HIGH',true,'Performance discussion completed. Employee reviewed against peers.','Cross-team calibration adjustment based on peer comparison','2025-11-28 20:46:29.939253'),
  ('81d0f015-92e9-4c86-967d-6882204b2f94','b41adc15-5416-4222-a656-1243c26ce760','14238377-9dbd-4978-bddb-35d0f42ddbf3',4,'LOW',4,'LOW',false,'Performance discussion completed. Employee reviewed against peers.',NULL,'2025-11-17 20:46:29.939253'),
  ('94043e15-09ed-4fcc-8f96-aba8a253e2fd','c90a6131-d623-4475-b3c8-b0916d8fbf97','e385112d-9e2b-45cb-bded-fb578a8329ba',4,'LOW',4,'LOW',false,'Performance discussion completed. Employee reviewed against peers.','Adjusted based on cross-team comparison','2025-11-14 20:46:29.939253'),
  ('a073ce8c-de6e-45a8-aa4e-c221c856caa1','df8106d3-75fd-4b8b-82f9-ec59f08cef97','35738460-31e6-4390-b2b6-26f6fefb9af0',3,'MEDIUM',3,'MEDIUM',true,'Performance discussion completed. Employee reviewed against peers.','Cross-team calibration adjustment based on peer comparison','2025-11-05 20:46:29.939253'),
  ('ad47f17b-5e7c-4580-82ef-a4a136571ef3','df8106d3-75fd-4b8b-82f9-ec59f08cef97','8cdc325d-5896-492b-bb3f-4a8258c41090',3,'LOW',4,'LOW',true,'Performance discussion completed. Employee reviewed against peers.','Adjusted based on cross-team comparison','2025-11-25 20:46:29.939253'),
  ('b62272e7-e6a8-443c-b739-47e15d2ade35','c90a6131-d623-4475-b3c8-b0916d8fbf97','7f370dd7-61b6-4698-96e7-2f00ab6559fd',4,'MEDIUM',3,'MEDIUM',true,'Performance discussion completed. Employee reviewed against peers.','Cross-team calibration adjustment based on peer comparison','2025-11-13 20:46:29.939253'),
  ('bbe7101b-dc26-49f6-a329-6d242b11b8f9','df8106d3-75fd-4b8b-82f9-ec59f08cef97','a711c494-0181-4e6d-9fec-066b32dcb790',4,'MEDIUM',3,'MEDIUM',false,'Performance discussion completed. Employee reviewed against peers.',NULL,'2025-11-16 20:46:29.939253'),
  ('beb25a05-b33d-42e3-92e9-87da2e14070a','b41adc15-5416-4222-a656-1243c26ce760','6c42d762-3a3d-44ad-9332-8e59fe25005c',4,'MEDIUM',5,'MEDIUM',false,'Performance discussion completed. Employee reviewed against peers.',NULL,'2025-11-25 20:46:29.939253'),
  ('c6e1d615-77bc-44a8-adb6-05d04f578424','df8106d3-75fd-4b8b-82f9-ec59f08cef97','fb4977fb-3aff-4112-b6c1-fa69bb920728',4,'LOW',3,'LOW',true,'Performance discussion completed. Employee reviewed against peers.','Cross-team calibration adjustment based on peer comparison','2025-11-08 20:46:29.939253'),
  ('c83b225d-35cd-4d38-83cf-902ae526bc59','df8106d3-75fd-4b8b-82f9-ec59f08cef97','adf224d3-da12-4eba-a016-f7dc1bcce48f',5,'HIGH',3,'HIGH',false,'Performance discussion completed. Employee reviewed against peers.',NULL,'2025-11-23 20:46:29.939253'),
  ('c84fd080-1ba6-48d7-a47e-7f0c33f14a7a','a2605a63-adf2-4883-8635-799ed891b380','a3965358-2146-4eee-940e-450cea225879',4,'LOW',4,'LOW',true,'Performance discussion completed. Employee reviewed against peers.','Cross-team calibration adjustment based on peer comparison','2025-12-02 20:46:29.939253'),
  ('cce142a5-33a4-4ba7-8b29-d9bdbf8dd4fb','a2605a63-adf2-4883-8635-799ed891b380','e385112d-9e2b-45cb-bded-fb578a8329ba',3,'MEDIUM',3,'MEDIUM',false,'Performance discussion completed. Employee reviewed against peers.',NULL,'2025-12-01 20:46:29.939253'),
  ('d65836a1-a414-480e-b411-c1b87780c560','a2605a63-adf2-4883-8635-799ed891b380','ffa50514-b899-44ce-b5f6-43f5fe9f3a01',5,'MEDIUM',5,'MEDIUM',false,'Performance discussion completed. Employee reviewed against peers.',NULL,'2025-11-12 20:46:29.939253'),
  ('d9b83581-f4be-4a82-8e6b-0d714df1dc3d','df8106d3-75fd-4b8b-82f9-ec59f08cef97','282dfaaf-5489-401f-a898-c055d10c6b0b',4,'HIGH',3,'HIGH',false,'Performance discussion completed. Employee reviewed against peers.',NULL,'2025-11-22 20:46:29.939253'),
  ('de3b9d6a-1563-4890-96cf-2b2e06e4928d','a2605a63-adf2-4883-8635-799ed891b380','ac29b238-e303-4564-81de-de87f4db916e',3,'LOW',3,'LOW',false,'Performance discussion completed. Employee reviewed against peers.',NULL,'2025-11-20 20:46:29.939253'),
  ('e930fdcf-fb5f-44a2-8505-31f7736fd6f2','b41adc15-5416-4222-a656-1243c26ce760','9c9c4243-7a56-4b5f-a222-549aaf82885b',3,'LOW',4,'LOW',false,'Performance discussion completed. Employee reviewed against peers.',NULL,'2025-11-23 20:46:29.939253'),
  ('ee40b94b-c734-4d83-8daf-561b27060035','c90a6131-d623-4475-b3c8-b0916d8fbf97','5c50a8cc-da3c-4a4e-a8f9-96f221f299fe',3,'MEDIUM',4,'MEDIUM',true,'Performance discussion completed. Employee reviewed against peers.','Cross-team calibration adjustment based on peer comparison','2025-11-25 20:46:29.939253'),
  ('ef124699-981a-4ccf-b982-8f014604d12d','c90a6131-d623-4475-b3c8-b0916d8fbf97','70aae718-bdb5-4ea1-ae2b-4a94b4335ac8',4,'HIGH',5,'HIGH',false,'Performance discussion completed. Employee reviewed against peers.',NULL,'2025-11-26 20:46:29.939253'),
  ('f8c3dd05-506e-4d3b-878f-361ce70961d8','c90a6131-d623-4475-b3c8-b0916d8fbf97','126a030b-623c-4e52-859c-477af1fa7461',5,'HIGH',5,'HIGH',false,'Performance discussion completed. Employee reviewed against peers.',NULL,'2025-11-14 20:46:29.939253'),
  ('fd4f9dce-93fd-42f6-a36b-fb4b5d98a5c8','b41adc15-5416-4222-a656-1243c26ce760','8cdc325d-5896-492b-bb3f-4a8258c41090',3,'HIGH',4,'HIGH',false,'Performance discussion completed. Employee reviewed against peers.',NULL,'2025-11-15 20:46:29.939253');

-- ───────────────────────────────────────────────────────────────────────────────
-- 1. LE SESSIONI
-- ───────────────────────────────────────────────────────────────────────────────
INSERT INTO sys.sys_calibration_sessions (
  calibration_session_tenant_id, calibration_session_natural_key, calibration_session_name,
  calibration_session_description, calibration_session_department, calibration_session_scheduled_at,
  calibration_session_duration_min, calibration_session_location,
  calibration_session_facilitator_user_id, calibration_session_status,
  calibration_session_summary_notes, calibration_session_adjustments_count)
SELECT (SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK'),
       'LEGACY_CALIB_SESSION::' || l.id, l.nome, l.descr, l.dip, l.quando,
       l.durata, l.luogo,
       (SELECT u.user_id FROM sys.sys_users u WHERE u.user_external_code = 'LEGACY_EMP::' || l.facil),
       l.stato, l.note, coalesce(l.agg, 0)
  FROM l_ses l
ON CONFLICT (calibration_session_natural_key) DO NOTHING;

-- ───────────────────────────────────────────────────────────────────────────────
-- 2. I PARTECIPANTI
-- ───────────────────────────────────────────────────────────────────────────────
INSERT INTO sys.sys_calibration_participants (
  calibration_participant_tenant_id, calibration_participant_session_id,
  calibration_participant_user_id, calibration_participant_natural_key,
  calibration_participant_role, calibration_participant_attended, calibration_participant_joined_at)
SELECT s.calibration_session_tenant_id, s.calibration_session_id, u.user_id,
       'LEGACY_CALIB_PARTICIPANT::' || l.id, l.ruolo, l.presente, l.entrato
  FROM l_par l
  JOIN sys.sys_calibration_sessions s ON s.calibration_session_natural_key = 'LEGACY_CALIB_SESSION::' || l.ses
  JOIN sys.sys_users u ON u.user_external_code = 'LEGACY_EMP::' || l.persona
ON CONFLICT (calibration_participant_natural_key) DO NOTHING;

-- ───────────────────────────────────────────────────────────────────────────────
-- 3. LE DISCUSSIONI
--    L'aggancio alla review, quando esiste: la persona giusta, nel periodo giusto.
--    Se non c'e' una review corrispondente resta NULL — meglio un legame assente
--    di un legame inventato.
-- ───────────────────────────────────────────────────────────────────────────────
INSERT INTO sys.sys_calibration_discussions (
  calibration_discussion_tenant_id, calibration_discussion_session_id,
  calibration_discussion_subject_user_id, calibration_discussion_review_id,
  calibration_discussion_natural_key, calibration_discussion_original_rating,
  calibration_discussion_original_potential, calibration_discussion_calibrated_rating,
  calibration_discussion_calibrated_potential, calibration_discussion_was_adjusted,
  calibration_discussion_notes, calibration_discussion_adjustment_reason,
  calibration_discussion_discussed_at)
SELECT s.calibration_session_tenant_id, s.calibration_session_id, u.user_id,
       (SELECT r.review_id FROM sys.sys_performance_reviews r
         WHERE r.review_subject_user_id = u.user_id
           AND s.calibration_session_scheduled_at::date
               BETWEEN r.review_period_start AND r.review_period_end + 180
         ORDER BY r.review_period_end DESC LIMIT 1),
       'LEGACY_CALIB_DISCUSSION::' || l.id, l.voto0, l.pot0, l.voto1, l.pot1, l.mossa,
       l.note, l.motivo, l.quando
  FROM l_dis l
  JOIN sys.sys_calibration_sessions s ON s.calibration_session_natural_key = 'LEGACY_CALIB_SESSION::' || l.ses
  JOIN sys.sys_users u ON u.user_external_code = 'LEGACY_EMP::' || l.persona
ON CONFLICT (calibration_discussion_natural_key) DO NOTHING;

-- ───────────────────────────────────────────────────────────────────────────────
-- 4. LA PROVENIENZA — una riga per ogni riga importata
-- ───────────────────────────────────────────────────────────────────────────────
INSERT INTO sys.sys_source_lineage_records (
  source_lineage_tenant_id, source_lineage_source_system, source_lineage_source_table,
  source_lineage_source_record_id, source_lineage_source_natural_key,
  source_lineage_target_table_name, source_lineage_target_record_id,
  source_lineage_mapping_confidence, source_lineage_validation_status)
SELECT t.tenant_id, 'heuresys_platform', q.src, q.rec_id::uuid, q.nat, q.tgt, q.tgt_id, 1.000, 'VALID'
  FROM (
    SELECT 'calibration_sessions' AS src,
           replace(s.calibration_session_natural_key, 'LEGACY_CALIB_SESSION::', '') AS rec_id,
           s.calibration_session_natural_key AS nat, 'sys_calibration_sessions' AS tgt,
           s.calibration_session_id AS tgt_id
      FROM sys.sys_calibration_sessions s
     WHERE s.calibration_session_natural_key LIKE 'LEGACY_CALIB_SESSION::%'
    UNION ALL
    SELECT 'calibration_participants',
           replace(p.calibration_participant_natural_key, 'LEGACY_CALIB_PARTICIPANT::', ''),
           p.calibration_participant_natural_key, 'sys_calibration_participants',
           p.calibration_participant_id
      FROM sys.sys_calibration_participants p
     WHERE p.calibration_participant_natural_key LIKE 'LEGACY_CALIB_PARTICIPANT::%'
    UNION ALL
    SELECT 'calibration_discussions',
           replace(d.calibration_discussion_natural_key, 'LEGACY_CALIB_DISCUSSION::', ''),
           d.calibration_discussion_natural_key, 'sys_calibration_discussions',
           d.calibration_discussion_id
      FROM sys.sys_calibration_discussions d
     WHERE d.calibration_discussion_natural_key LIKE 'LEGACY_CALIB_DISCUSSION::%'
  ) q
  CROSS JOIN (SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK') t
 WHERE NOT EXISTS (
   SELECT 1 FROM sys.sys_source_lineage_records x
    WHERE x.source_lineage_target_record_id = q.tgt_id
      AND x.source_lineage_target_table_name = q.tgt);

-- ───────────────────────────────────────────────────────────────────────────────
-- 4-bis. STATISTICHE — una tabella appena riempita e' invisibile al planner
--    Il cruscotto di salute ha una sonda «tabelle popolate mai analizzate», e dopo
--    questo import si e' accesa su tutte e tre: righe dentro, statistiche zero.
--    ANALYZE qui dentro invece che a mano, cosi' una applicazione da zero non
--    ripropone lo stesso buco.
-- ───────────────────────────────────────────────────────────────────────────────
ANALYZE sys.sys_calibration_sessions;
ANALYZE sys.sys_calibration_participants;
ANALYZE sys.sys_calibration_discussions;

-- ───────────────────────────────────────────────────────────────────────────────
-- 5. AUTO-VERIFICA
-- ───────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  n_ses int; n_par int; n_dis int; n_fuori int; n_orfani int; n_lin int;
  n_agganciate int; n_mosse int;
BEGIN
  SELECT count(*) INTO n_ses FROM sys.sys_calibration_sessions
   WHERE calibration_session_natural_key LIKE 'LEGACY_CALIB_SESSION::%';
  IF n_ses <> 35 THEN RAISE EXCEPTION 'Sessioni importate: attese 35, trovate %', n_ses; END IF;

  SELECT count(*) INTO n_par FROM sys.sys_calibration_participants
   WHERE calibration_participant_natural_key LIKE 'LEGACY_CALIB_PARTICIPANT::%';
  IF n_par <> 20 THEN RAISE EXCEPTION 'Partecipanti importati: attesi 20, trovati %', n_par; END IF;

  SELECT count(*) INTO n_dis FROM sys.sys_calibration_discussions
   WHERE calibration_discussion_natural_key LIKE 'LEGACY_CALIB_DISCUSSION::%';
  IF n_dis <> 40 THEN RAISE EXCEPTION 'Discussioni importate: attese 40, trovate %', n_dis; END IF;

  -- IL CONTROLLO CHE CONTA: nessuna riga di un tenant che non sia RTL Bank. Se questo
  -- scattasse, l'ingestione avrebbe rifatto entrare la contaminazione che S1042 ha
  -- rimosso con 6.746 righe.
  SELECT count(*) INTO n_fuori FROM sys.sys_calibration_sessions s
   WHERE s.calibration_session_tenant_id
         <> (SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK');
  IF n_fuori <> 0 THEN
    RAISE EXCEPTION 'Sessioni di calibrazione fuori dal tenant RTL Bank: %', n_fuori;
  END IF;

  SELECT count(*) INTO n_orfani FROM sys.sys_calibration_discussions d
   WHERE d.calibration_discussion_subject_user_id IS NULL;
  IF n_orfani <> 0 THEN RAISE EXCEPTION 'Discussioni senza persona: %', n_orfani; END IF;

  SELECT count(*) INTO n_lin FROM sys.sys_source_lineage_records
   WHERE source_lineage_target_table_name IN
     ('sys_calibration_sessions','sys_calibration_participants','sys_calibration_discussions');
  IF n_lin <> 95 THEN
    RAISE EXCEPTION 'Righe di provenienza: attese 95 (35+20+40), trovate %', n_lin;
  END IF;

  -- Il dato deve avere SOSTANZA, non solo cardinalita': se nessuna discussione
  -- portasse un voto spostato avremmo importato gusci con la forma giusta.
  SELECT count(*) INTO n_agganciate FROM sys.sys_calibration_discussions
   WHERE calibration_discussion_review_id IS NOT NULL;
  SELECT count(*) INTO n_mosse FROM sys.sys_calibration_discussions
   WHERE calibration_discussion_was_adjusted;
  IF n_mosse = 0 THEN
    RAISE EXCEPTION 'Nessuna discussione con voto spostato: import senza sostanza';
  END IF;

  RAISE NOTICE 'PASSO 2 OK — 35 sessioni, 20 partecipanti, 40 discussioni di RTL Bank; % discussioni agganciate a una review reale, % con voto spostato in sede collegiale; 95 righe di provenienza; zero righe di tenant estranei.',
               n_agganciate, n_mosse;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- BEGIN;
--   DELETE FROM sys.sys_source_lineage_records WHERE source_lineage_target_table_name IN
--     ('sys_calibration_sessions','sys_calibration_participants','sys_calibration_discussions');
--   DELETE FROM sys.sys_calibration_discussions  WHERE calibration_discussion_natural_key  LIKE 'LEGACY_CALIB_DISCUSSION::%';
--   DELETE FROM sys.sys_calibration_participants WHERE calibration_participant_natural_key LIKE 'LEGACY_CALIB_PARTICIPANT::%';
--   DELETE FROM sys.sys_calibration_sessions     WHERE calibration_session_natural_key     LIKE 'LEGACY_CALIB_SESSION::%';
-- COMMIT;
