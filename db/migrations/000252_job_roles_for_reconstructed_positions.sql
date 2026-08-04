-- ═══════════════════════════════════════════════════════════════════════════════
-- 000252_job_roles_for_reconstructed_positions.sql
--
-- IL RUOLO PROFESSIONALE DELLE 133 POSIZIONI NATE DALLA RICOSTRUZIONE.
--
-- Perche' esiste questa migrazione
--   Le otto migrazioni dell'organigramma (000244-000251) creano 133 posizioni
--   nuove — 27 di comando, 54 di rete, 40 centrali, 12 di completamento — e
--   nessuna di esse dichiara il proprio ruolo professionale. Applicandole
--   (S1043) la sentinella `sys.v_positions_without_job_role`, che era a ZERO da
--   sempre, e' passata a 133: esattamente il numero delle posizioni create. Non
--   e' un difetto scoperto per intuizione, e' una vista-sentinella che ha fatto
--   il suo mestiere il giorno stesso in cui il dato e' cambiato.
--
--   Una posizione senza ruolo professionale non e' un dettaglio di catalogo: il
--   ruolo e' cio' che aggancia la posizione alla famiglia professionale, alla
--   seniority e — a valle — ai requisiti di competenza e ai percorsi formativi.
--   Lasciarla nulla significa 133 posizioni invisibili a tutto cio' che ragiona
--   per mansione.
--
-- Che cosa fa
--   A. aggiunge al catalogo i ruoli mancanti (39 nuovi; «Internal Auditor»
--      esisteva gia' come RTL-AUDIT e viene RIUSATO, non duplicato)
--   B. aggancia ogni posizione priva di ruolo al ruolo omonimo
--   C. verifica che la sentinella torni a zero
--
-- Convenzione dei codici: `RTL-ROLE-<titolo a maiuscole con trattini>`, la stessa
-- gia' usata dai 25 ruoli `RTL-ROLE-*` presenti in catalogo. Famiglia e seniority
-- sono dichiarate riga per riga: senza, il ruolo entrerebbe nel catalogo monco
-- come i 16 ruoli `RTL-*` di prima generazione, che non hanno ne' l'una ne' l'altra.
--
-- Reversibile: lo script di rollback e' in coda, commentato.
-- Rieseguibile: NOT EXISTS sul codice, e l'aggancio tocca solo le posizioni nulle.
-- Prerequisiti: 000244-000251 applicate.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────────
-- A. LA MAPPA — titolo della posizione, codice del ruolo, famiglia, seniority
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TEMP TABLE mappa_ruoli (titolo text, codice text, famiglia text, seniority text)
  ON COMMIT DROP;
INSERT INTO mappa_ruoli VALUES
  -- ══ rete commerciale ═══════════════════════════════════════════════════════
  ('Cassiere',                            'RTL-ROLE-CASSIERE',                 'RETAIL', 'ENTRY'),
  ('Consulente Clientela',                'RTL-ROLE-CONSULENTE-CLIENTELA',     'RETAIL', 'MID'),
  ('Gestore Piccole Imprese',             'RTL-ROLE-GESTORE-PICCOLE-IMPRESE',  'RETAIL', 'MID'),
  ('Vice Direttore di Filiale',           'RTL-ROLE-VICE-DIRETTORE-FILIALE',   'RETAIL', 'SENIOR'),
  ('Direttore di Filiale',                'RTL-ROLE-DIRETTORE-FILIALE',        'RETAIL', 'LEAD'),
  ('Responsabile di Area',                'RTL-ROLE-RESPONSABILE-AREA',        'RETAIL', 'LEAD'),
  ('Specialista Qualita e Supporto Rete', 'RTL-ROLE-SPECIALISTA-SUPPORTO-RETE','RETAIL', 'MID'),
  ('Responsabile Direzione Governo e Supporto Rete',
                                          'RTL-ROLE-RESP-GOVERNO-RETE',        'RETAIL', 'LEAD'),
  -- ══ banca commerciale e crediti ════════════════════════════════════════════
  ('Specialista Sviluppo Commerciale',    'RTL-ROLE-SPECIALISTA-SVILUPPO-COMM','COMM',   'MID'),
  ('Responsabile Direzione Coordinamento Commerciale',
                                          'RTL-ROLE-RESP-COORD-COMMERCIALE',   'COMM',   'LEAD'),
  ('Analista Crediti',                    'RTL-ROLE-ANALISTA-CREDITI',         'COMM',   'MID'),
  ('Analista Monitoraggio Crediti',       'RTL-ROLE-ANALISTA-MONITORAGGIO',    'COMM',   'MID'),
  ('Gestore Recupero Crediti',            'RTL-ROLE-GESTORE-RECUPERO-CREDITI', 'COMM',   'MID'),
  ('Direttore Divisione Crediti',         'RTL-ROLE-DIRETTORE-CREDITI',        'COMM',   'EXECUTIVE'),
  ('Responsabile Direzione Istruttoria ed Erogazione',
                                          'RTL-ROLE-RESP-ISTRUTTORIA',         'COMM',   'LEAD'),
  ('Responsabile Direzione Monitoraggio e Crediti Deteriorati',
                                          'RTL-ROLE-RESP-MONITORAGGIO',        'COMM',   'LEAD'),
  ('Responsabile Ufficio Crediti Retail', 'RTL-ROLE-RESP-CREDITI-RETAIL',      'COMM',   'LEAD'),
  ('Responsabile Ufficio Crediti PMI',    'RTL-ROLE-RESP-CREDITI-PMI',         'COMM',   'LEAD'),
  -- ══ finanza e amministrazione ══════════════════════════════════════════════
  ('Analista Bilancio e Segnalazioni',    'RTL-ROLE-ANALISTA-BILANCIO',        'FIN',    'MID'),
  ('Analista Finanziario',                'RTL-ROLE-ANALISTA-FINANZIARIO',     'FIN',    'MID'),
  ('Responsabile Direzione Bilancio e Segnalazioni',
                                          'RTL-ROLE-RESP-BILANCIO',            'FIN',    'LEAD'),
  -- ══ tesoreria ══════════════════════════════════════════════════════════════
  ('Operatore Cambi',                     'RTL-ROLE-OPERATORE-CAMBI',          'TREAS',  'MID'),
  -- ══ operazioni ═════════════════════════════════════════════════════════════
  ('Specialista Back Office',             'RTL-ROLE-SPECIALISTA-BACK-OFFICE',  'OPS',    'MID'),
  ('Specialista Pagamenti',               'RTL-ROLE-SPECIALISTA-PAGAMENTI',    'OPS',    'MID'),
  ('Responsabile Direzione Back Office',  'RTL-ROLE-RESP-BACK-OFFICE',         'OPS',    'LEAD'),
  ('Responsabile Direzione Pagamenti',    'RTL-ROLE-RESP-PAGAMENTI',           'OPS',    'LEAD'),
  -- ══ tecnologia ═════════════════════════════════════════════════════════════
  ('Sistemista',                          'RTL-ROLE-SISTEMISTA',               'IT',     'MID'),
  -- ══ rischio ════════════════════════════════════════════════════════════════
  ('Analista Rischio',                    'RTL-ROLE-ANALISTA-RISCHIO',         'RISK',   'MID'),
  ('Risk Manager',                        'RTL-ROLE-RISK-MANAGER',             'RISK',   'LEAD'),
  ('Responsabile Direzione Risk Management',
                                          'RTL-ROLE-RESP-RISK-MANAGEMENT',     'RISK',   'LEAD'),
  -- ══ legale e conformita ════════════════════════════════════════════════════
  ('Legale',                              'RTL-ROLE-LEGALE',                   'LEGAL',  'MID'),
  ('Specialista Compliance',              'RTL-ROLE-SPECIALISTA-COMPLIANCE',   'LEGAL',  'MID'),
  ('Responsabile Direzione Affari Legali e Societari',
                                          'RTL-ROLE-RESP-AFFARI-LEGALI',       'LEGAL',  'LEAD'),
  ('Responsabile Direzione Antiriciclaggio',
                                          'RTL-ROLE-RESP-ANTIRICICLAGGIO',     'LEGAL',  'LEAD'),
  -- ══ revisione interna — RIUSA il ruolo che esiste gia' ═════════════════════
  ('Internal Auditor',                    'RTL-AUDIT',                         'AUDIT',  'MID'),
  -- ══ marketing ══════════════════════════════════════════════════════════════
  ('Specialista Marketing e Comunicazione',
                                          'RTL-ROLE-SPECIALISTA-MARKETING',    'MKT',    'MID'),
  -- ══ risorse umane ══════════════════════════════════════════════════════════
  ('Addetto Amministrazione del Personale',
                                          'RTL-ROLE-ADDETTO-AMM-PERSONALE',    'HR',     'MID'),
  ('Specialista Formazione e Sviluppo',   'RTL-ROLE-SPECIALISTA-FORMAZIONE',   'HR',     'MID'),
  ('Responsabile Ufficio Amministrazione del Personale',
                                          'RTL-ROLE-RESP-AMM-PERSONALE',       'HR',     'LEAD'),
  ('Responsabile Ufficio Sviluppo, Formazione e Organizzazione',
                                          'RTL-ROLE-RESP-SVILUPPO-ORG',        'HR',     'LEAD');

-- ───────────────────────────────────────────────────────────────────────────────
-- B. I RUOLI MANCANTI ENTRANO IN CATALOGO
--    NOT EXISTS sul codice: «Internal Auditor» punta a RTL-AUDIT, che c'e' gia',
--    e viene saltato — riusato, non duplicato. E' la stessa famiglia di difetto
--    dei gemelli `LEGACY_BAND::` gia' censiti: due righe per la stessa cosa.
-- ───────────────────────────────────────────────────────────────────────────────
INSERT INTO sys.sys_job_roles (job_role_code, job_role_name, job_role_family_id,
                               job_role_seniority_level, job_role_description)
SELECT m.codice, m.titolo,
       (SELECT job_family_id FROM sys.sys_job_families WHERE job_family_code = m.famiglia),
       m.seniority,
       'Ruolo professionale introdotto con la ricostruzione dell''organigramma di RTL Bank.'
FROM mappa_ruoli m
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_job_roles jr WHERE jr.job_role_code = m.codice);

-- ───────────────────────────────────────────────────────────────────────────────
-- B-bis. IL RUOLO RIUSATO VA COMPLETATO, NON LASCIATO A META'
--    `RTL-AUDIT` esiste dal catalogo di prima generazione e non dichiara ne'
--    famiglia ne' seniority — come gli altri 15 ruoli `RTL-*` non-`ROLE`. Finche'
--    nessuno ci si appoggiava era un buco silenzioso; da questa migrazione ci
--    appendo tre posizioni di Internal Auditor, quindi lo completo.
--    COALESCE, non sovrascrittura: se il ruolo un valore ce l'ha, resta il suo.
--    Gli altri ruoli monchi NON vengono toccati: non li sto usando, e ripulire
--    il catalogo di prima generazione e' un lavoro suo, da fare dichiarandolo.
-- ───────────────────────────────────────────────────────────────────────────────
UPDATE sys.sys_job_roles jr
   SET job_role_family_id = coalesce(jr.job_role_family_id,
         (SELECT job_family_id FROM sys.sys_job_families WHERE job_family_code = m.famiglia)),
       job_role_seniority_level = coalesce(jr.job_role_seniority_level, m.seniority),
       updated_at = now()
  FROM mappa_ruoli m
 WHERE jr.job_role_code = m.codice
   AND (jr.job_role_family_id IS NULL OR jr.job_role_seniority_level IS NULL);

-- ───────────────────────────────────────────────────────────────────────────────
-- C. L'AGGANCIO — solo le posizioni che il ruolo non ce l'hanno
-- ───────────────────────────────────────────────────────────────────────────────
UPDATE sys.sys_positions p
   SET position_job_role_id = jr.job_role_id,
       updated_at           = now()
  FROM mappa_ruoli m
  JOIN sys.sys_job_roles jr ON jr.job_role_code = m.codice
 WHERE p.position_title = m.titolo
   AND p.position_job_role_id IS NULL;

-- ───────────────────────────────────────────────────────────────────────────────
-- D. AUTO-VERIFICA
-- ───────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  n_mappa int; n_ruoli int; n_orfane int; n_senza_famiglia int;
BEGIN
  SELECT count(*) INTO n_mappa FROM mappa_ruoli;
  IF n_mappa <> 40 THEN
    RAISE EXCEPTION 'Mappa dei ruoli: attese 40 righe, trovate %', n_mappa;
  END IF;

  -- ogni codice della mappa esiste ora in catalogo
  SELECT count(*) INTO n_ruoli FROM mappa_ruoli m
    JOIN sys.sys_job_roles jr ON jr.job_role_code = m.codice;
  IF n_ruoli <> 40 THEN
    RAISE EXCEPTION 'Ruoli in catalogo dopo l inserimento: attesi 40, trovati %', n_ruoli;
  END IF;

  -- ogni ruolo NUOVO ha la famiglia risolta: se un codice famiglia non esistesse,
  -- la sotto-query avrebbe scritto NULL in silenzio
  SELECT count(*) INTO n_senza_famiglia FROM mappa_ruoli m
    JOIN sys.sys_job_roles jr ON jr.job_role_code = m.codice
   WHERE jr.job_role_family_id IS NULL;
  IF n_senza_famiglia <> 0 THEN
    RAISE EXCEPTION 'Ruoli della mappa senza famiglia professionale: %', n_senza_famiglia;
  END IF;

  -- LA PROVA: la sentinella torna a zero
  SELECT count(*) INTO n_orfane FROM sys.v_positions_without_job_role;
  IF n_orfane <> 0 THEN
    RAISE EXCEPTION 'Posizioni attive ancora senza ruolo professionale: %', n_orfane;
  END IF;

  RAISE NOTICE 'RUOLI OK — % ruoli in catalogo per le posizioni della ricostruzione, sentinella v_positions_without_job_role a zero.', n_ruoli;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICHE DA ESEGUIRE A MANO DOPO L'APPLICAZIONE
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- 1) la sentinella
--    SELECT count(*) FROM sys.v_positions_without_job_role;   -- atteso: 0
--
-- 2) l'organico per famiglia professionale, che prima non era calcolabile
--    SELECT jf.job_family_name, count(*) AS persone
--      FROM sys.sys_user_position_assignments a
--      JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
--      JOIN sys.sys_job_roles jr ON jr.job_role_id = p.position_job_role_id
--      JOIN sys.sys_job_families jf ON jf.job_family_id = jr.job_role_family_id
--     WHERE a.user_position_assignment_status = 'ACTIVE'
--     GROUP BY 1 ORDER BY 2 DESC;
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- BEGIN;
--   UPDATE sys.sys_positions SET position_job_role_id = NULL
--    WHERE position_job_role_id IN (SELECT job_role_id FROM sys.sys_job_roles
--                                    WHERE job_role_description LIKE 'Ruolo professionale introdotto con la ricostruzione%');
--   DELETE FROM sys.sys_job_roles
--    WHERE job_role_description LIKE 'Ruolo professionale introdotto con la ricostruzione%';
-- COMMIT;
