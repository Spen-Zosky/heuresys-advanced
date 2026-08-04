-- ═══════════════════════════════════════════════════════════════════════════════
-- 000249_positions_network_staff.sql
--
-- FASE 5b — LE PERSONE DELLA RETE: 54 operativi nelle 10 filiali.
--
-- Dopo la 5a ogni filiale ha il suo direttore, collocato al suo interno. Questa
-- migrazione le popola: vice direttori, consulenti di clientela, gestori delle
-- piccole imprese e cassieri. Tutti riportano alla posizione di comando della
-- propria filiale, quindi ogni riporto sta DENTRO la sua unita — che e' la regola
-- R4 del referto, oggi violata dal 65% delle relazioni.
--
-- Criteri di assegnazione, tutti letti dal database (nessuna scelta discrezionale)
--   · citta di residenza PRINCIPALE per la filiale — quattro filiali su dieci
--     risultano composte al 100% da residenti in citta (Monza, Como, Varese e le
--     tre dell'Area Brescia-Bergamo)
--   · valutazione per la priorita: i migliori agli hub e ai ruoli di contatto
--   · inquadramento per il ruolo: i vice sono 3A4L o quadri, i cassieri 3A1L/3A3L
--
-- 21 persone cambiano mestiere, tutte provenienti dall'eccedenza dei controlli:
-- analisti di rischio e addetti alla conformita che diventano cassieri, consulenti
-- e gestori di imprese. Nessuno esce dalla banca, nessuno perde l'inquadramento.
--
-- Prerequisiti: 000244-000248 applicate.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────────
-- 1. LA MAPPA — persona, filiale, ruolo
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TEMP TABLE rete (email text, filiale text, ruolo text) ON COMMIT DROP;
INSERT INTO rete VALUES
  -- ═══ Area Milano e Provincia ═══
  -- Filiale Milano Centro (hub, 8 persone col direttore)
  ('ignazio.orlando',       'FIL-MI-CEN', 'VICE'),
  ('paolo.castaldi',        'FIL-MI-CEN', 'CONS'),  -- val 4,9
  ('giovanni.marchetti',    'FIL-MI-CEN', 'CONS'),  -- val 4,8
  ('noemi.bruno',           'FIL-MI-CEN', 'GEST'),
  ('alessandro.pellegrini', 'FIL-MI-CEN', 'CASS'),  -- val 4,2
  ('davide.rinaldi',        'FIL-MI-CEN', 'CASS'),
  ('alice.moretti',         'FIL-MI-CEN', 'CASS'),
  -- Filiale Milano Porta Romana (7)
  ('paolo.ferrara',         'FIL-MI-PRO', 'VICE'),
  ('lorenzo.rinaldi',       'FIL-MI-PRO', 'CONS'),
  ('martina.russo',         'FIL-MI-PRO', 'CONS'),
  ('antonio.bernardi',      'FIL-MI-PRO', 'GEST'),
  ('yuri.longo',            'FIL-MI-PRO', 'CASS'),
  ('silvia.colombo',        'FIL-MI-PRO', 'CASS'),
  -- Filiale Milano Sempione (7)
  ('filippo.costa',         'FIL-MI-SEM', 'CONS'),
  ('zelda.martini',         'FIL-MI-SEM', 'CONS'),
  ('veronica.ferri',        'FIL-MI-SEM', 'GEST'),
  ('silvia.martini',        'FIL-MI-SEM', 'CASS'),
  ('silvia.martelli',       'FIL-MI-SEM', 'CASS'),
  ('umberto.deluca',        'FIL-MI-SEM', 'CASS'),
  -- Filiale Sesto San Giovanni (6)
  ('noemi.marchetti',       'FIL-MI-SSG', 'CONS'),
  ('gabriele.amato',        'FIL-MI-SSG', 'GEST'),  -- val 4,9, da Risk Analyst
  ('laura.ferrari',         'FIL-MI-SSG', 'CASS'),
  ('giorgio.fabbri',        'FIL-MI-SSG', 'CASS'),
  ('michele.monti',         'FIL-MI-SSG', 'CASS'),
  -- Filiale Monza (5) — tutti residenti a Monza
  ('elisa.mariani',         'FIL-MB-MON', 'CONS'),
  ('pietro.barbieri',       'FIL-MB-MON', 'GEST'),
  ('elena.fiore',           'FIL-MB-MON', 'CASS'),
  ('beatrice.gentile',      'FIL-MB-MON', 'CASS'),
  -- Filiale Como (5) — tutti residenti a Como
  ('daniele.mariani',       'FIL-CO-CEN', 'CONS'),
  ('gabriele.ferrara',      'FIL-CO-CEN', 'GEST'),  -- val 4,0, da Risk Analyst
  ('filippo.donati',        'FIL-CO-CEN', 'CASS'),
  ('filippo.colombo',       'FIL-CO-CEN', 'CASS'),
  -- Filiale Varese (5) — tutti residenti a Varese
  ('claudia.romano',        'FIL-VA-CEN', 'CONS'),  -- val 4,1
  ('antonio.marino',        'FIL-VA-CEN', 'GEST'),  -- val 4,0
  ('simone.russo',          'FIL-VA-CEN', 'CASS'),  -- val 4,2
  ('simone.caruso',         'FIL-VA-CEN', 'CASS'),
  -- ═══ Area Brescia-Bergamo — interamente locale ═══
  -- Filiale Brescia Centro (hub, 8) — tutti bresciani
  ('davide.cattaneo',       'FIL-BS-CEN', 'VICE'),  -- val 5,0, la piu alta della banca
  ('valentina.bianco',      'FIL-BS-CEN', 'CONS'),
  ('gabriele.fiore',        'FIL-BS-CEN', 'CONS'),
  ('filippo.greco',         'FIL-BS-CEN', 'GEST'),
  ('gabriele.giordano',     'FIL-BS-CEN', 'CASS'),  -- val 4,0
  ('marta.gatti',           'FIL-BS-CEN', 'CASS'),
  ('cristina.romano',       'FIL-BS-CEN', 'CASS'),
  -- Filiale Bergamo Centro (hub, 8) — tutti bergamaschi
  ('matteo.esposito',       'FIL-BG-CEN', 'VICE'),  -- val 4,1
  ('tommaso.desantis',      'FIL-BG-CEN', 'CONS'),
  ('laura.esposito',        'FIL-BG-CEN', 'CONS'),  -- val 4,0
  ('tommaso.conti',         'FIL-BG-CEN', 'GEST'),  -- val 4,0
  ('marco.ferri',           'FIL-BG-CEN', 'CASS'),
  ('laura.moretti',         'FIL-BG-CEN', 'CASS'),
  ('claudia.desantis',      'FIL-BG-CEN', 'CASS'),
  -- Filiale Dalmine (5) — tutti bergamaschi
  ('matteo.pagano',         'FIL-BG-DAL', 'CONS'),
  ('cristina.palmieri',     'FIL-BG-DAL', 'GEST'),  -- val 3,9
  ('tommaso.esposito',      'FIL-BG-DAL', 'CASS'),
  ('silvia.mancini',        'FIL-BG-DAL', 'CASS');

-- ───────────────────────────────────────────────────────────────────────────────
-- 2. LE POSIZIONI — titolo dal ruolo, codice progressivo per filiale e ruolo
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TEMP TABLE rete_pos ON COMMIT DROP AS
SELECT
  r.email,
  r.filiale,
  r.ruolo,
  ou.organization_unit_id     AS unita_id,
  ou.organization_unit_tenant_id AS tenant_id,
  u.user_id                   AS persona_id,
  CASE r.ruolo
    WHEN 'VICE' THEN 'Vice Direttore di Filiale'
    WHEN 'CONS' THEN 'Consulente Clientela'
    WHEN 'GEST' THEN 'Gestore Piccole Imprese'
    WHEN 'CASS' THEN 'Cassiere'
  END                         AS titolo,
  'POS-' || r.filiale || '-' || r.ruolo || '-' ||
    row_number() OVER (PARTITION BY r.filiale, r.ruolo ORDER BY r.email) AS codice
FROM rete r
JOIN sys.sys_users u             ON u.user_email = r.email || '@rtl-bank.org'
JOIN sys.sys_organization_units ou ON ou.organization_unit_code = r.filiale;

INSERT INTO sys.sys_positions (
  position_tenant_id, position_code, position_title,
  position_organization_unit_id, position_reports_to_position_id,
  position_is_active, position_effective_from
)
SELECT rp.tenant_id, rp.codice, rp.titolo, rp.unita_id,
       -- tutti riportano al direttore della propria filiale: il riporto sta
       -- dentro l'unita, come vuole la regola R4
       (SELECT position_id FROM sys.sys_positions
         WHERE position_code = 'POS-CMD-' || rp.filiale),
       true, CURRENT_DATE
FROM rete_pos rp
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_positions p WHERE p.position_code = rp.codice);

-- ───────────────────────────────────────────────────────────────────────────────
-- 3. SPOSTAMENTO DELLE PERSONE — si chiude la vecchia, si apre la nuova
-- ───────────────────────────────────────────────────────────────────────────────
UPDATE sys.sys_user_position_assignments a
   SET user_position_assignment_status   = 'ENDED',
       user_position_assignment_end_date = CURRENT_DATE - 1,
       user_position_assignment_notes    = coalesce(a.user_position_assignment_notes || ' · ', '')
                                           || 'chiusa dalla ricostruzione organigramma (fase 5b): assegnazione alla rete commerciale',
       updated_at                        = now()
  FROM rete_pos rp
 WHERE a.user_position_assignment_user_id = rp.persona_id
   AND a.user_position_assignment_status  = 'ACTIVE'
   -- RIESEGUIBILITA' (vedi 000248): non si chiude l'assegnazione che e' gia' quella
   -- di destinazione, altrimenti ogni deploy riscrive la storia delle persone.
   AND a.user_position_assignment_position_id IS DISTINCT FROM
       (SELECT position_id FROM sys.sys_positions WHERE position_code = rp.codice);

INSERT INTO sys.sys_user_position_assignments (
  user_position_assignment_tenant_id, user_position_assignment_user_id,
  user_position_assignment_position_id, user_position_assignment_kind,
  user_position_assignment_fte, user_position_assignment_start_date,
  user_position_assignment_status, user_position_assignment_notes
)
SELECT rp.tenant_id, rp.persona_id, p.position_id, 'PRIMARY', 1.0, CURRENT_DATE, 'ACTIVE',
       'ricostruzione organigramma (fase 5b): ' || rp.titolo || ' presso ' || rp.filiale
FROM rete_pos rp
JOIN sys.sys_positions p ON p.position_code = rp.codice
WHERE NOT EXISTS (
  SELECT 1 FROM sys.sys_user_position_assignments x
   WHERE x.user_position_assignment_user_id     = rp.persona_id
     AND x.user_position_assignment_position_id = p.position_id
     AND x.user_position_assignment_status      = 'ACTIVE');

-- ───────────────────────────────────────────────────────────────────────────────
-- 4. AUTO-VERIFICA
-- ───────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  n_mappa int; n_pos int; n_attive int; n_doppie int; n_orfane int;
  n_filiali_ok int; n_riporti_fuori int; n_mi_cen int;
BEGIN
  SELECT count(*) INTO n_mappa FROM rete;
  IF n_mappa <> 54 THEN RAISE EXCEPTION 'Mappa rete: attese 54 righe, trovate %', n_mappa; END IF;

  -- Il perimetro dei controlli e' `rete_pos`, cioe' ESATTAMENTE le righe che questa
  -- migrazione crea — non il prefisso `POS-FIL-%`. La prima applicazione reale
  -- (S1043) si e' fermata qui contando 60 invece di 54: nel database esistevano gia'
  -- sei posizioni `POS-FIL-B{G,S}-TELLER-0*` (vacanti, nelle filiali di Bergamo e
  -- Brescia, create il 2026-07-21) che il prefisso cattura e che questa fase non ha
  -- creato. Contare per prefisso significa contare anche cio' che non e' tuo.
  SELECT count(*) INTO n_pos
    FROM sys.sys_positions p JOIN rete_pos rp ON rp.codice = p.position_code;
  IF n_pos <> 54 THEN RAISE EXCEPTION 'Posizioni di rete: attese 54, trovate %', n_pos; END IF;

  -- nessuna posizione senza riporto: se POS-CMD-<filiale> non esistesse, sarebbe NULL
  SELECT count(*) INTO n_orfane
    FROM sys.sys_positions p JOIN rete_pos rp ON rp.codice = p.position_code
   WHERE p.position_reports_to_position_id IS NULL;
  IF n_orfane <> 0 THEN
    RAISE EXCEPTION 'Posizioni di rete senza riporto al direttore: % (manca la 5a?)', n_orfane;
  END IF;

  -- ogni riporto sta dentro la propria unita
  SELECT count(*) INTO n_riporti_fuori
    FROM sys.sys_positions f
    JOIN rete_pos rp ON rp.codice = f.position_code
    JOIN sys.sys_positions s ON s.position_id = f.position_reports_to_position_id
   WHERE f.position_organization_unit_id IS DISTINCT FROM s.position_organization_unit_id;
  IF n_riporti_fuori <> 0 THEN
    RAISE EXCEPTION 'Riporti fuori dalla propria unita: %', n_riporti_fuori;
  END IF;

  SELECT count(*) INTO n_attive FROM sys.sys_user_position_assignments
   WHERE user_position_assignment_status = 'ACTIVE';
  IF n_attive <> 161 THEN
    RAISE EXCEPTION 'Assegnazioni attive: attese 161 invariate, trovate %', n_attive;
  END IF;

  SELECT count(*) INTO n_doppie FROM (
    SELECT user_position_assignment_user_id FROM sys.sys_user_position_assignments
     WHERE user_position_assignment_status = 'ACTIVE' GROUP BY 1 HAVING count(*) > 1) x;
  IF n_doppie <> 0 THEN RAISE EXCEPTION 'Persone con due assegnazioni attive: %', n_doppie; END IF;

  -- L'organico delle filiali. Il piano prevedeva 8,7,7,6,5,5,5,8,8,5 = 64 col direttore.
  -- La prima applicazione reale (S1043) ne ha misurati 65: Milano Centro ha NOVE persone,
  -- non otto. La nona e' roberta.gallo, Bank Teller gia' assegnata a quella filiale e non
  -- presente nella mappa della fase 5b — una persona che il piano non aveva contato, non
  -- una collocata male: sta nella filiale giusta, con una mansione che a una filiale
  -- appartiene. Resta dov'e'.
  -- Il controllo NON viene allargato a «fra 5 e 9»: una tolleranza piu' larga del valore
  -- reale non e' una guardia (e' la stessa correzione che questa serie aveva gia' fatto
  -- una volta, sulla soglia delle persone senza posizione). Si dichiara invece la
  -- distribuzione misurata: nove filiali fra 5 e 8, Milano Centro esattamente a 9.
  SELECT count(*) INTO n_filiali_ok FROM (
    SELECT ou.organization_unit_code, count(a.user_position_assignment_id) AS n
      FROM sys.sys_organization_units ou
      JOIN sys.sys_positions p ON p.position_organization_unit_id = ou.organization_unit_id
      JOIN sys.sys_user_position_assignments a
        ON a.user_position_assignment_position_id = p.position_id
       AND a.user_position_assignment_status = 'ACTIVE'
     WHERE ou.organization_unit_type = 'BRANCH'
       AND ou.organization_unit_code <> 'FIL-MI-CEN'
     GROUP BY 1 HAVING count(a.user_position_assignment_id) BETWEEN 5 AND 8) x;
  IF n_filiali_ok <> 9 THEN
    RAISE EXCEPTION 'Filiali con organico fra 5 e 8 persone: attese 9, trovate %', n_filiali_ok;
  END IF;

  SELECT count(a.user_position_assignment_id) INTO n_mi_cen
    FROM sys.sys_organization_units ou
    JOIN sys.sys_positions p ON p.position_organization_unit_id = ou.organization_unit_id
    JOIN sys.sys_user_position_assignments a
      ON a.user_position_assignment_position_id = p.position_id
     AND a.user_position_assignment_status = 'ACTIVE'
   WHERE ou.organization_unit_code = 'FIL-MI-CEN';
  IF n_mi_cen <> 9 THEN
    RAISE EXCEPTION 'Milano Centro: atteso organico 9 (7 della mappa + direttore + roberta.gallo), trovato %', n_mi_cen;
  END IF;

  RAISE NOTICE 'FASE 5b OK — 54 posizioni di rete create, 10 filiali popolate (9 con 5-8 persone, Milano Centro 9: la nona e'' roberta.gallo, gia'' in filiale e fuori dalla mappa), tutti i riporti dentro la propria filiale, 161 assegnazioni attive invariate.';
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICHE DA ESEGUIRE A MANO DOPO L'APPLICAZIONE
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- 1) l'organico di ogni filiale, per ruolo
--    SELECT ou.organization_unit_name AS filiale, p.position_title AS ruolo, count(*) AS persone
--      FROM sys.sys_organization_units ou
--      JOIN sys.sys_positions p ON p.position_organization_unit_id = ou.organization_unit_id
--      JOIN sys.sys_user_position_assignments a ON a.user_position_assignment_position_id = p.position_id
--       AND a.user_position_assignment_status='ACTIVE'
--     WHERE ou.organization_unit_type = 'BRANCH'
--     GROUP BY 1,2 ORDER BY 1,2;
--
-- 2) la prova della coerenza geografica: quante filiali hanno il personale tutto in citta
--    SELECT ou.organization_unit_name AS filiale,
--           count(*) AS persone,
--           count(*) FILTER (WHERE ad.user_address_city = ANY (
--             CASE ou.organization_unit_code
--               WHEN 'FIL-MB-MON' THEN ARRAY['Monza']
--               WHEN 'FIL-CO-CEN' THEN ARRAY['Como']
--               WHEN 'FIL-VA-CEN' THEN ARRAY['Varese']
--               WHEN 'FIL-BS-CEN' THEN ARRAY['Brescia']
--               WHEN 'FIL-BG-CEN' THEN ARRAY['Bergamo']
--               WHEN 'FIL-BG-DAL' THEN ARRAY['Bergamo']
--               ELSE ARRAY['Milano','Monza'] END)) AS residenti_in_zona
--      FROM sys.sys_organization_units ou
--      JOIN sys.sys_positions p ON p.position_organization_unit_id = ou.organization_unit_id
--      JOIN sys.sys_user_position_assignments a ON a.user_position_assignment_position_id = p.position_id
--       AND a.user_position_assignment_status='ACTIVE'
--      JOIN sys.sys_user_addresses ad ON ad.user_address_user_id = a.user_position_assignment_user_id
--       AND ad.user_address_is_primary
--     WHERE ou.organization_unit_type='BRANCH' GROUP BY 1,2 ORDER BY 1;
--    atteso: 6 filiali su 10 con residenti_in_zona = persone
--
-- 3) chi ha cambiato mestiere in questa fase
--    SELECT split_part(u.user_email,'@',1) AS persona,
--           vecchia.position_title AS mansione_prima, nuova.position_title AS mansione_ora
--      FROM sys.sys_user_position_assignments an
--      JOIN sys.sys_users u ON u.user_id = an.user_position_assignment_user_id
--      JOIN sys.sys_positions nuova ON nuova.position_id = an.user_position_assignment_position_id
--      JOIN sys.sys_user_position_assignments av ON av.user_position_assignment_user_id = u.user_id
--       AND av.user_position_assignment_status='ENDED'
--      JOIN sys.sys_positions vecchia ON vecchia.position_id = av.user_position_assignment_position_id
--     WHERE an.user_position_assignment_notes LIKE '%fase 5b%'
--       AND vecchia.position_title <> nuova.position_title
--     ORDER BY 2,1;
--    atteso: ~21 persone, in prevalenza da Risk Analyst e Compliance Officer
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- BEGIN;
--   DELETE FROM sys.sys_user_position_assignments
--    WHERE user_position_assignment_notes LIKE '%fase 5b): %';
--   UPDATE sys.sys_user_position_assignments
--      SET user_position_assignment_status='ACTIVE', user_position_assignment_end_date=NULL
--    WHERE user_position_assignment_notes LIKE '%fase 5b): assegnazione alla rete%';
--   DELETE FROM sys.sys_positions WHERE position_code LIKE 'POS-FIL-%';
-- COMMIT;
