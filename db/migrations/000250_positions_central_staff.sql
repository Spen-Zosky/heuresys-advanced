-- ═══════════════════════════════════════════════════════════════════════════════
-- 000250_positions_central_staff.sql
--
-- FASE 5c — LE DIVISIONI CENTRALI: 40 persone che cambiano unita o mansione.
--
-- Chiude lo spostamento delle persone. Il criterio di questa fase e' opposto a
-- quello della 5b: qui NON si tocca chi e' gia al posto giusto. Le persone che
-- restano nella stessa unita con la stessa mansione — gli specialisti di back
-- office, gli sviluppatori, gli operatori titoli in tesoreria — non compaiono in
-- questa migrazione, perche' non c'e' nulla da spostare. Si muovono soltanto le 40
-- persone che cambiano unita o mestiere.
--
-- Da dove vengono le 40
--   · 21 dall'eccedenza dei controlli (Risk Analyst e Compliance Officer): i loro
--     titoli di studio decidono dove vanno — Economia ai crediti, Ingegneria
--     Gestionale a operations e sistemi, formazione giuridica ad audit e recupero
--   · 12 dagli operatori titoli e dagli analisti finanziari in eccesso
--   · 7 che restano nel loro mestiere ma cambiano unita, perche' l'unita e' nuova
--
-- Tre casi che vale la pena nominare
--   · marco.rinaldi entra nella Direzione Bilancio come analista: e' l'uomo che
--     dirigeva una divisione da 21 persone con l'inquadramento di impiegato
--   · i tre internal auditor con formazione giuridica riempiono una funzione che
--     oggi ha solo il capo e zero auditor
--   · martina.gentile resta Risk Manager nella Direzione Rischi, sotto il CRO:
--     conserva il mestiere e perde la responsabilita dell'unita (v. nota fase 4)
--
-- Prerequisiti: 000244-000249 applicate.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────────
-- 1. LA MAPPA — persona, unita di destinazione, ruolo
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TEMP TABLE centrali (email text, unita text, ruolo text) ON COMMIT DROP;
INSERT INTO centrali VALUES
  -- ═══ Divisione Crediti ═══
  -- Ufficio Crediti PMI: 4 analisti, tutti con formazione in Economia
  ('alessio.costa',     'UFF-CRED-PMI',    'ANCR'),  -- val 4,2
  ('gabriele.fontana',  'UFF-CRED-PMI',    'ANCR'),  -- val 4,2
  ('dario.fontana',     'UFF-CRED-PMI',    'ANCR'),  -- val 4,2
  ('giorgio.ricci',     'UFF-CRED-PMI',    'ANCR'),  -- val 4,2
  -- Ufficio Crediti Retail: 3 analisti
  ('jessica.pagano',    'UFF-CRED-RETAIL', 'ANCR'),  -- val 4,1
  ('martina.ricci',     'UFF-CRED-RETAIL', 'ANCR'),  -- val 4,0
  ('antonio.parisi',    'UFF-CRED-RETAIL', 'ANCR'),  -- val 3,8
  -- Direzione Monitoraggio: 2 analisti bergamaschi + 3 gestori del recupero,
  -- questi ultimi con formazione giuridica, che nel recupero crediti serve
  ('giulia.fontana',    'DIR-MONIT',       'ANMO'),  -- Bergamo
  ('noemi.lombardi',    'DIR-MONIT',       'ANMO'),  -- Bergamo
  ('alberto.rossetti',  'DIR-MONIT',       'RECU'),  -- Diritto
  ('marco.conti',       'DIR-MONIT',       'RECU'),  -- Diritto Commerciale
  ('stefano.morelli',   'DIR-MONIT',       'RECU'),  -- Diritto
  -- ═══ Divisione Operations ═══
  ('tommaso.caruso',    'DIR-BACKOFF',     'BKOF'),  -- Ing. Gestionale, val 3,9
  ('federica.lombardi', 'DIR-BACKOFF',     'BKOF'),  -- Ing. Gestionale, val 3,9
  ('elisa.martini',     'DIR-BACKOFF',     'BKOF'),  -- Ing. Gestionale
  ('cristina.rossi',    'DIR-PAY',         'PAGA'),  -- Ing. Gestionale, val 4,9
  ('tatiana.conte',     'DIR-PAY',         'PAGA'),  -- Ing. Gestionale
  ('ilaria.marchetti',  'DIR-PAY',         'PAGA'),  -- Ing. Gestionale
  -- ═══ Divisione IT & Digital ═══
  ('pietro.gatti',      'DIR-INFRA',       'SIST'),
  -- ═══ Divisione Finanza e Amministrazione ═══
  ('giulia.caruso',     'DIR-TREAS',       'CAMB'),  -- da operatore titoli a cambi:
                                                     -- la mansione esisteva e era vuota
  ('marco.rinaldi',     'DIR-BILAN',       'ANBI'),  -- dirigeva la divisione con inquadramento 3A3L
  ('carlo.dangelo',     'DIR-BILAN',       'ANBI'),
  ('francesca.gallo',   'DIR-BILAN',       'ANBI'),  -- Economia e Finanza
  -- ═══ Divisione Risorse Umane e Organizzazione ═══
  ('marco.bruno',       'UFF-PERS',        'ADPE'),  -- Scienze Bancarie
  ('beatrice.russo',    'UFF-ORG',         'SPFO'),
  -- ═══ Divisione Marketing e Comunicazione ═══
  ('gabriele.colombo',  'DIV-MKT',         'SPMK'),
  ('emanuele.gentile',  'DIV-MKT',         'SPMK'),
  -- ═══ Governo della rete — le due strutture nate alla fase 2 ═══
  ('pietro.sanna',      'DIR-COORD',       'SPCO'),  -- val 3,9
  ('noemi.santoro',     'DIR-COORD',       'SPCO'),  -- val 3,8
  ('alberto.colombo',   'DIR-COORD',       'SPCO'),  -- val 3,8
  ('valentina.moretti', 'DIR-COORD',       'SPCO'),  -- val 3,8
  ('andrea.greco',      'DIR-RETE',        'SPRE'),  -- Como
  -- ═══ Staff al CEO ═══
  -- Internal Audit: la funzione oggi ha il capo e ZERO auditor
  ('riccardo.desantis', 'DIR-AUDIT',       'AUDI'),  -- Giurisprudenza
  ('diego.fontana',     'DIR-AUDIT',       'AUDI'),  -- Scienze Giuridiche
  ('riccardo.barbieri', 'DIR-AUDIT',       'AUDI'),  -- Scienze Giuridiche
  -- Direzione Rischi: il Risk Manager conserva il mestiere sotto il CRO
  ('martina.gentile',   'DIR-RISKM',       'RSKM'),  -- QD3, dal 2005
  ('alice.rossi',       'DIR-RISKM',       'ANRI'),  -- val 4,9
  ('walter.giuliani',   'DIR-RISKM',       'ANRI'),  -- val 4,8
  ('helena.negri',      'DIV-LEGAL',       'SPCM'),  -- Scienze Giuridiche
  ('marta.russo',       'DIR-LEGAL',       'LEGA');  -- laurea magistrale in Giurisprudenza

-- ───────────────────────────────────────────────────────────────────────────────
-- 2. LE POSIZIONI
--    Il riporto punta alla posizione ATTIVA del responsabile dentro la stessa
--    unita — non a un codice fisso: cosi funziona sia per le unita la cui posizione
--    di comando e' nata alla 5a, sia per quelle il cui capo era gia interno.
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TEMP TABLE centrali_pos ON COMMIT DROP AS
SELECT
  c.email, c.unita, c.ruolo,
  ou.organization_unit_id        AS unita_id,
  ou.organization_unit_tenant_id AS tenant_id,
  u.user_id                      AS persona_id,
  CASE c.ruolo
    WHEN 'ANCR' THEN 'Analista Crediti'
    WHEN 'ANMO' THEN 'Analista Monitoraggio Crediti'
    WHEN 'RECU' THEN 'Gestore Recupero Crediti'
    WHEN 'BKOF' THEN 'Specialista Back Office'
    WHEN 'PAGA' THEN 'Specialista Pagamenti'
    WHEN 'SIST' THEN 'Sistemista'
    WHEN 'CAMB' THEN 'Operatore Cambi'
    WHEN 'ANBI' THEN 'Analista Bilancio e Segnalazioni'
    WHEN 'ADPE' THEN 'Addetto Amministrazione del Personale'
    WHEN 'SPFO' THEN 'Specialista Formazione e Sviluppo'
    WHEN 'SPMK' THEN 'Specialista Marketing e Comunicazione'
    WHEN 'SPCO' THEN 'Specialista Sviluppo Commerciale'
    WHEN 'SPRE' THEN 'Specialista Qualita e Supporto Rete'
    WHEN 'AUDI' THEN 'Internal Auditor'
    WHEN 'RSKM' THEN 'Risk Manager'
    WHEN 'ANRI' THEN 'Analista Rischio'
    WHEN 'SPCM' THEN 'Specialista Compliance'
    WHEN 'LEGA' THEN 'Legale'
  END AS titolo,
  'POS-' || c.unita || '-' || c.ruolo || '-' ||
    row_number() OVER (PARTITION BY c.unita, c.ruolo ORDER BY c.email) AS codice,
  -- posizione del responsabile dentro l'unita: e' il superiore gerarchico
  (SELECT p2.position_id
     FROM sys.sys_user_position_assignments a2
     JOIN sys.sys_positions p2 ON p2.position_id = a2.user_position_assignment_position_id
    WHERE a2.user_position_assignment_user_id = ou.organization_unit_manager_user_id
      AND a2.user_position_assignment_status  = 'ACTIVE'
      AND p2.position_organization_unit_id    = ou.organization_unit_id
    LIMIT 1) AS superiore_id
FROM centrali c
JOIN sys.sys_users u              ON u.user_email = c.email || '@rtl-bank.org'
JOIN sys.sys_organization_units ou ON ou.organization_unit_code = c.unita;

INSERT INTO sys.sys_positions (
  position_tenant_id, position_code, position_title,
  position_organization_unit_id, position_reports_to_position_id,
  position_is_active, position_effective_from
)
SELECT cp.tenant_id, cp.codice, cp.titolo, cp.unita_id, cp.superiore_id, true, CURRENT_DATE
FROM centrali_pos cp
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_positions p WHERE p.position_code = cp.codice);

-- ───────────────────────────────────────────────────────────────────────────────
-- 3. SPOSTAMENTO DELLE PERSONE
-- ───────────────────────────────────────────────────────────────────────────────
UPDATE sys.sys_user_position_assignments a
   SET user_position_assignment_status   = 'ENDED',
       user_position_assignment_end_date = CURRENT_DATE - 1,
       user_position_assignment_notes    = coalesce(a.user_position_assignment_notes || ' · ', '')
                                           || 'chiusa dalla ricostruzione organigramma (fase 5c): assegnazione alle strutture centrali',
       updated_at                        = now()
  FROM centrali_pos cp
 WHERE a.user_position_assignment_user_id = cp.persona_id
   AND a.user_position_assignment_status  = 'ACTIVE'
   -- RIESEGUIBILITA' (vedi 000248)
   AND a.user_position_assignment_position_id IS DISTINCT FROM
       (SELECT position_id FROM sys.sys_positions WHERE position_code = cp.codice);

INSERT INTO sys.sys_user_position_assignments (
  user_position_assignment_tenant_id, user_position_assignment_user_id,
  user_position_assignment_position_id, user_position_assignment_kind,
  user_position_assignment_fte, user_position_assignment_start_date,
  user_position_assignment_status, user_position_assignment_notes
)
SELECT cp.tenant_id, cp.persona_id, p.position_id, 'PRIMARY', 1.0, CURRENT_DATE, 'ACTIVE',
       'ricostruzione organigramma (fase 5c): ' || cp.titolo || ' presso ' || cp.unita
FROM centrali_pos cp
JOIN sys.sys_positions p ON p.position_code = cp.codice
WHERE NOT EXISTS (
  SELECT 1 FROM sys.sys_user_position_assignments x
   WHERE x.user_position_assignment_user_id     = cp.persona_id
     AND x.user_position_assignment_position_id = p.position_id
     AND x.user_position_assignment_status      = 'ACTIVE');

-- ───────────────────────────────────────────────────────────────────────────────
-- 4. AUTO-VERIFICA
-- ───────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  n_mappa int; n_pos int; n_senza_sup int; n_attive int; n_doppie int;
  n_auditor int; n_riporti_fuori int; n_persone_senza int;
BEGIN
  SELECT count(*) INTO n_mappa FROM centrali;
  IF n_mappa <> 40 THEN RAISE EXCEPTION 'Mappa centrali: attese 40 righe, trovate %', n_mappa; END IF;

  SELECT count(*) INTO n_pos FROM centrali_pos cp
    JOIN sys.sys_positions p ON p.position_code = cp.codice;
  IF n_pos <> 40 THEN RAISE EXCEPTION 'Posizioni centrali: attese 40, create %', n_pos; END IF;

  -- ogni posizione ha un superiore: se un'unita non avesse il responsabile
  -- collocato al suo interno, il riporto sarebbe nullo (la 5a non applicata)
  SELECT count(*) INTO n_senza_sup FROM centrali_pos WHERE superiore_id IS NULL;
  IF n_senza_sup <> 0 THEN
    RAISE EXCEPTION 'Posizioni senza superiore nell unita: % (fasi 4/5a non applicate?)', n_senza_sup;
  END IF;

  -- Ogni riporto sta dentro la propria unita — misurato SULLE POSIZIONI DI QUESTA FASE.
  -- Il filtro originale era `position_code LIKE 'POS-%'`, che non seleziona «le posizioni
  -- nuove»: seleziona QUASI TUTTE le posizioni del database, comprese le legacy
  -- `POS-000003xx`. In S1043 ha contato 155 riporti trasversali preesistenti — difetti
  -- reali, ma non di questa migrazione, che cosi' non poteva applicarsi mai.
  SELECT count(*) INTO n_riporti_fuori
    FROM sys.sys_positions f
    JOIN centrali_pos cp ON cp.codice = f.position_code
    JOIN sys.sys_positions s ON s.position_id = f.position_reports_to_position_id
   WHERE f.position_organization_unit_id IS DISTINCT FROM s.position_organization_unit_id;
  IF n_riporti_fuori <> 0 THEN
    RAISE EXCEPTION 'Riporti fuori dalla propria unita fra le posizioni nuove: %', n_riporti_fuori;
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

  -- nessuna persona rimasta senza assegnazione attiva
  SELECT count(*) INTO n_persone_senza
    FROM sys.sys_users u
   WHERE u.user_status = 'ACTIVE'
     AND u.user_tenant_id = (SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code='RTL_BANK')
     AND NOT EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a
                      WHERE a.user_position_assignment_user_id = u.user_id
                        AND a.user_position_assignment_status = 'ACTIVE');
  -- Valore misurato in lab: 1 (enzo.spenuso, tenant Heuresys). La soglia e' 1 e
  -- non 2 perche' nessuna di queste migrazioni crea persone senza posizione.
  IF n_persone_senza > 1 THEN
    RAISE EXCEPTION 'Persone attive senza posizione: % (attesa 1, preesistente)', n_persone_senza;
  END IF;

  -- il difetto piu vistoso chiuso: l'audit aveva zero auditor
  SELECT count(*) INTO n_auditor
    FROM sys.sys_positions p
    JOIN sys.sys_user_position_assignments a ON a.user_position_assignment_position_id = p.position_id
     AND a.user_position_assignment_status = 'ACTIVE'
   WHERE p.position_title = 'Internal Auditor';
  IF n_auditor <> 3 THEN
    RAISE EXCEPTION 'Internal Auditor: attesi 3 (prima erano 0), trovati %', n_auditor;
  END IF;

  RAISE NOTICE 'FASE 5c OK — 40 posizioni centrali create, tutti i riporti dentro la propria unita, 3 internal auditor dove prima erano zero, 161 assegnazioni attive invariate, nessuna doppia assegnazione.';
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICHE DA ESEGUIRE A MANO DOPO L'APPLICAZIONE
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- 1) l'organico di ogni unita, dopo tutte e tre le parti della fase 5
--    SELECT ou.organization_unit_name AS unita, ou.organization_unit_type AS tipo,
--           ou.organization_unit_relation AS legame, count(a.user_position_assignment_id) AS persone
--      FROM sys.sys_organization_units ou
--      LEFT JOIN sys.sys_positions p ON p.position_organization_unit_id = ou.organization_unit_id
--      LEFT JOIN sys.sys_user_position_assignments a
--        ON a.user_position_assignment_position_id = p.position_id
--       AND a.user_position_assignment_status = 'ACTIVE'
--     GROUP BY 1,2,3 ORDER BY 4 DESC;
--    Le unita da sciogliere alla fase 6 (Risk & Compliance, Corporate Banking,
--    Team Product) dovrebbero risultare VUOTE o quasi.
--
-- 2) la distribuzione delle mansioni: il confronto col punto di partenza
--    SELECT p.position_title, count(*) AS persone
--      FROM sys.sys_positions p
--      JOIN sys.sys_user_position_assignments a ON a.user_position_assignment_position_id = p.position_id
--       AND a.user_position_assignment_status='ACTIVE'
--     GROUP BY 1 ORDER BY 2 DESC;
--    atteso: nessuna mansione oltre le ~30 persone (prima: Risk Analyst 26,
--    Bank Teller 22, Financial Analyst 21, Compliance Officer 17 su 158)
--
-- 3) le posizioni rimaste vacanti da tutte le fasi
--    SELECT ou.organization_unit_name, p.position_title, count(*) AS posizioni_vuote
--      FROM sys.sys_positions p
--      JOIN sys.sys_organization_units ou ON ou.organization_unit_id = p.position_organization_unit_id
--     WHERE NOT EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a
--                        WHERE a.user_position_assignment_position_id = p.position_id
--                          AND a.user_position_assignment_status='ACTIVE')
--     GROUP BY 1,2 ORDER BY 1,2;
--    Sono l'oggetto della fase 6: si disattivano insieme alle unita svuotate.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- BEGIN;
--   DELETE FROM sys.sys_user_position_assignments
--    WHERE user_position_assignment_notes LIKE '%fase 5c): %';
--   UPDATE sys.sys_user_position_assignments
--      SET user_position_assignment_status='ACTIVE', user_position_assignment_end_date=NULL
--    WHERE user_position_assignment_notes LIKE '%fase 5c): assegnazione alle strutture%';
--   DELETE FROM sys.sys_positions
--    WHERE position_code ~ '^POS-(UFF|DIR|DIV)-.*-(ANCR|ANMO|RECU|BKOF|PAGA|SIST|CAMB|ANBI|ADPE|SPFO|SPMK|SPCO|SPRE|AUDI|RSKM|ANRI|SPCM|LEGA)-[0-9]+$';
-- COMMIT;
