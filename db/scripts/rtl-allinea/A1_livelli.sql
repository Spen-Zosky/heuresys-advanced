-- Blocco A / livelli (mandato RTL 2026-11-11, decisione 2): ognuno prende il livello CCNL Credito del posto della corsa;
-- la retribuzione segue il livello solo per chi cambia livello. Idempotente. Giornale: staging.rtl_allinea_livelli_undo.
-- Convenzioni: «Area unificata» non e' un livello della scala Credito: chi sta su quei posti tiene il livello attuale.
-- QD1 e QD2 non esistono ancora nei dati RTL: retribuzione di riferimento 66000 e 70000 (assunzione, tra 3A4L e QD3).
-- Le buste paga gia' emesse (storico) non si toccano.
-- Rollback: UPDATE dai valori *_prima del giornale.
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.rtl_allinea_livelli_undo (
  salvato_il timestamptz NOT NULL DEFAULT now(), user_id uuid PRIMARY KEY,
  contratto_livello_prima text, contratto_salario_prima numeric, impiego_livello_prima text, impiego_salario_prima numeric);
CREATE TEMP TABLE bersaglio(persona text, codice_corsa text, livello text) ON COMMIT DROP;
INSERT INTO bersaglio VALUES
('Amato, Gabriele','R051','3A2L'),
('Barbieri, Paolo','R092','QD2'),
('Barbieri, Pietro','R051','3A2L'),
('Barbieri, Riccardo','R020','3A3L'),
('Bellini, Quintino','R084','Dirigente'),
('Bernardi, Antonio','R051','3A2L'),
('Bianchi, Luca','R027','Dirigente'),
('Bianco, Valentina','R059','3A3L'),
('Bruno, Marco','R094','3A2L'),
('Bruno, Noemi','R051','3A2L'),
('Caputo, Paolo','R062','Dirigente'),
('Caputo, Roberta','R077','QD3'),
('Caputo, Sergio','R021','Dirigente'),
('Caruso, Giulia','R070','QD2'),
('Caruso, Martina','R048','QD2'),
('Caruso, Simone','R048','QD2'),
('Castaldi, Paolo','R051','3A2L'),
('Cattaneo, Benedetta','R069','QD3'),
('Cattaneo, Davide','R050','QD3'),
('Colombo, Alberto','R039','3A3L'),
('Colombo, Filippo','R048','QD2'),
('Colombo, Maria','R102','QD2'),
('Colombo, Silvia','R048','QD2'),
('Conte, Tatiana','R082','3A3L'),
('Conti, Luca','R066','3A4L'),
('Conti, Marco','R066','3A4L'),
('Conti, Tommaso','R055','3A2L'),
('Conti, Valentina','R090','Dirigente'),
('Costa, Alessio','R064','QD2'),
('Costa, Alice','R086','QD1'),
('Costa, Cristina','R047','QD3'),
('Costa, Filippo','R050','QD3'),
('D''Angelo, Luca','R023','3A1L'),
('Dangelo, Carlo','R099','3A2L'),
('De Rosa, Federica','R068','Dirigente'),
('De Santis, Claudia','R048','QD2'),
('De Santis, Marco','R014','Dirigente'),
('De Santis, Riccardo','R019','QD2'),
('De Santis, Tommaso','R055','3A2L'),
('Deluca, Umberto','R048','QD2'),
('Donati, Filippo','R049','3A1L'),
('Esposito, Alice','R010','Dirigente'),
('Esposito, Laura','R055','3A2L'),
('Esposito, Matteo','R050','QD3'),
('Esposito, Tommaso','R048','QD2'),
('Fabbri, Daniela','R045','QD3'),
('Fabbri, Giorgio','R048','QD2'),
('Ferrara, Gabriele','R051','3A2L'),
('Ferrara, Paolo','R050','QD3'),
('Ferrari, Laura','R049','3A1L'),
('Ferri, Giuseppe','R081','QD3'),
('Ferri, Marco','R053','3A1L'),
('Ferri, Veronica','R051','3A2L'),
('Fiore, Elena','R049','3A1L'),
('Fiore, Gabriele','R051','3A2L'),
('Fiore, Tommaso','R045','QD3'),
('Fontana, Dario','R064','QD2'),
('Fontana, Diego','R020','3A3L'),
('Fontana, Gabriele','R065','3A3L'),
('Gallo, Francesca','R099','3A2L'),
('Gallo, Pietro','R085','QD2'),
('Gallo, Roberta','R049','3A1L'),
('Gallo, Sara','R033','QD4'),
('Gatti, Alessandro','R045','QD3'),
('Gatti, Cristina','R045','QD3'),
('Gatti, Marta','R048','QD2'),
('Gatti, Pietro','R088','3A1L'),
('Gentile, Beatrice','R049','3A1L'),
('Gentile, Emanuele','R034','QD3'),
('Gentile, Martina','R011','QD3'),
('Giordano, Gabriele','R057','3A1L'),
('Giordano, Luca','R044','3A3L'),
('Giuliani, Walter','R012','3A3L'),
('Greco, Andrea','R023','3A1L'),
('Greco, Filippo','R051','3A2L'),
('Greco, Marta','R046','QD3'),
('Greco, Sara','R087','3A3L'),
('Leone, Luca','R043','QD3'),
('Leone, Simone','R049','3A1L'),
('Leone, Xenia','R050','QD3'),
('Lombardi, Cristina','R063','QD3'),
('Lombardi, Matteo','R018','Dirigente'),
('Longo, Yuri','R049','3A1L'),
('Mancini, Silvia','R049','3A1L'),
('Marchetti, Federica','R001','Dirigente'),
('Marchetti, Giovanni','R051','3A2L'),
('Marchetti, Ilaria','R082','3A3L'),
('Marchetti, Noemi','R050','QD3'),
('Mariani, Daniele','R050','QD3'),
('Mariani, Elisa','R050','QD3'),
('Mariani, Luca','R087','3A3L'),
('Mariani, Paolo','R099','3A2L'),
('Marino, Antonio','R051','3A2L'),
('Martelli, Silvia','R049','3A1L'),
('Martini, Riccardo','R022','QD4'),
('Martini, Silvia','R049','3A1L'),
('Martini, Zelda','R051','3A2L'),
('Martino, Andrea','R006','Dirigente'),
('Messina, Alberto','R070','QD2'),
('Monti, Elisa','R045','QD3'),
('Monti, Michele','R049','3A1L'),
('Monti, Stefano','R073','3A4L'),
('Moretti, Alice','R048','QD2'),
('Moretti, Laura','R053','3A1L'),
('Moretti, Valentina','R039','3A3L'),
('Negri, Helena','R008','3A3L'),
('Orlando, Ignazio','R044','3A3L'),
('Pagano, Jessica','R065','3A3L'),
('Pagano, Matteo','R050','QD3'),
('Palmieri, Cristina','R051','3A2L'),
('Parisi, Antonio','R065','3A3L'),
('Pellegrini, Alessandro','R049','3A1L'),
('Pellegrini, Marta','R042','QD3'),
('Ricci, Giorgio','R065','3A3L'),
('Ricci, Martina','R065','3A3L'),
('Rinaldi, Davide','R049','3A1L'),
('Rinaldi, Lorenzo','R051','3A2L'),
('Rinaldi, Stefano','R088','3A1L'),
('Romano, Claudia','R050','QD3'),
('Romano, Cristina','R057','3A1L'),
('Rossi, Alice','R013','3A2L'),
('Rossi, Cristina','R082','3A3L'),
('Rossi, Roberta','R070','QD2'),
('Russo, Beatrice','R095','3A1L'),
('Russo, Martina','R051','3A2L'),
('Russo, Simone','R049','3A1L'),
('Sala, Martina','R098','QD2'),
('Sanna, Pietro','R039','3A3L'),
('Santoro, Gabriele','R045','QD3'),
('Santoro, Laura','R007','QD3'),
('Santoro, Martina','R045','QD3'),
('Santoro, Noemi','R039','3A3L'),
('Serra, Alberto','R045','QD3'),
('Serra, Claudia','R063','QD3'),
('Testa, Nicola','R049','3A1L'),
('Zanetti, Chiara','R087','3A3L');
CREATE TEMP TABLE ref(livello text PRIMARY KEY, salario numeric) ON COMMIT DROP;
INSERT INTO ref VALUES ('3A1L',36421),('3A2L',38966),('3A3L',49583),('3A4L',62571),('QD1',66000),('QD2',70000),('QD3',74013),('QD4',93178),('Dirigente',142426);
CREATE TEMP TABLE chi ON COMMIT DROP AS
SELECT u.user_id, b.livello, r.salario FROM bersaglio b
  JOIN sys.sys_users u ON u.user_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND u.user_last_name || ', ' || u.user_first_name = b.persona
  JOIN ref r ON r.livello = b.livello;
DO $$ DECLARE n int; m int; BEGIN
  SELECT count(*) INTO n FROM bersaglio; SELECT count(*) INTO m FROM chi;
  IF n <> m THEN RAISE EXCEPTION 'A/livelli: % persone nel bersaglio, % abbinate', n, m; END IF; END $$;
INSERT INTO staging.rtl_allinea_livelli_undo (user_id, contratto_livello_prima, contratto_salario_prima, impiego_livello_prima, impiego_salario_prima)
SELECT c.user_id, k.user_contract_ccnl_level, k.user_contract_gross_annual_salary, e.user_employment_pay_scale_level, e.user_employment_salary
FROM chi c LEFT JOIN sys.sys_user_contracts k ON k.user_contract_user_id=c.user_id AND k.user_contract_status='ACTIVE'
           LEFT JOIN sys.sys_user_employment e ON e.user_employment_user_id=c.user_id
ON CONFLICT (user_id) DO NOTHING;
UPDATE sys.sys_user_contracts k SET user_contract_ccnl_level=c.livello,
  user_contract_gross_annual_salary = CASE WHEN k.user_contract_ccnl_level IS DISTINCT FROM c.livello THEN c.salario ELSE k.user_contract_gross_annual_salary END
FROM chi c WHERE k.user_contract_user_id=c.user_id AND k.user_contract_status='ACTIVE' AND k.user_contract_ccnl_level IS DISTINCT FROM c.livello;
UPDATE sys.sys_user_employment e SET user_employment_pay_scale_level=c.livello,
  user_employment_salary = CASE WHEN e.user_employment_pay_scale_level IS DISTINCT FROM c.livello THEN c.salario ELSE e.user_employment_salary END
FROM chi c WHERE e.user_employment_user_id=c.user_id AND e.user_employment_pay_scale_level IS DISTINCT FROM c.livello;
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM sys.sys_user_contracts k JOIN chi c ON c.user_id=k.user_contract_user_id
   WHERE k.user_contract_status='ACTIVE' AND k.user_contract_ccnl_level <> c.livello;
  IF n > 0 THEN RAISE EXCEPTION 'A/livelli: % contratti non allineati', n; END IF; END $$;
COMMIT;
SELECT 'A/livelli ok' esito, (SELECT count(*) FROM staging.rtl_allinea_livelli_undo) nel_giornale,
  (SELECT count(*) FROM sys.sys_user_contracts WHERE user_contract_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND user_contract_ccnl_level='Dirigente') dirigenti;
