-- =====================================================================================
-- 000305 — L'identita' di settore di un tenant smette di concordare per fortuna
-- =====================================================================================
--
-- #135. Un'azienda dichiara il proprio settore DUE VOLTE, e fino a oggi niente
-- costringeva le due dichiarazioni ad accordarsi:
--
--   1. `sys.sys_tenancies.tenant_industry_code`      — varchar LIBERO, zero vincoli
--   2. `sys.sys_enterprise_typing_profiles`          — FK verso la tassonomia ATECO
--      `.enterprise_typing_industry_class_id`          (`sys_activity_classifications`)
--
-- Misurato il 2026-08-13, prima di scrivere una riga:
--   · la colonna (1) non ha NESSUN vincolo — ne' NOT NULL, ne' CHECK, ne' FK.
--     Un refuso («MGMT_CONSULTNG») o una stringa vuota entravano senza un lamento;
--   · non esiste alcun catalogo dei settori: la (1) e' una parola nel vuoto;
--   · le due dichiarazioni OGGI concordano — HEURESYS = MGMT_CONSULTING / ATECO 70.20,
--     RTL_BANK = FIN_BANKING / ATECO 64.19 — ma per fortuna, non per costruzione.
--
-- Enzo ha sciolto la parte che era sua (2026-08-13): «Heuresys e' consulenza
-- direzionale». Questa migrazione chiude la parte che e' mia: rendere quell'accordo
-- una proprieta' del database invece di una coincidenza.
--
-- COSA FA, E PERCHE' COSI'
-- ------------------------
-- (a) `sys.sys_industry_codes` — il catalogo che mancava. Ogni voce dice quale codice
--     ATECO implica, quindi le due dichiarazioni diventano confrontabili. Il catalogo
--     e' APERTO a ogni settore, per I21: aggiungere un settore e' un INSERT, non una
--     migrazione. E' la tassonomia a dover restare aperta — senza, la piattaforma non
--     potrebbe piu' creare tenant in un settore nuovo.
-- (b) `NOT NULL` + FK da `tenant_industry_code` verso il catalogo. La FK e' piu' forte
--     di un CHECK e non contraddice RD-08: RD-08 vieta gli ENUM e prescrive
--     `varchar + CHECK` per i DISCRIMINATORI categoriali lato TS; qui il valore non e'
--     un discriminatore, e' un riferimento a una tassonomia che deve poter crescere.
--     Un CHECK con l'elenco dentro obbligherebbe a una migrazione per ogni tenant nuovo.
-- (c) `sys.v_tenant_industry_incoerente` — la sentinella. La coerenza fra due TABELLE
--     non e' esprimibile come CHECK in PostgreSQL, e un trigger sarebbe una regola
--     nascosta. Il progetto ha gia' 19 viste `v_*` interrogate da `db_health.py`: la
--     sentinella e' la forma che questo repo usa gia' per le proprieta' cross-tabella.
--     Zero righe = le due dichiarazioni concordano.
--
-- GUARDIA E POST-CONDIZIONE (metodo di bonifica, punto 4)
-- -------------------------------------------------------
-- La guardia ri-verifica al momento dell'esecuzione, non eredita la misura di ieri:
-- se un tenant avesse un `tenant_industry_code` fuori catalogo, la FK non si aggiunge
-- e la migrazione SOLLEVA con l'elenco dei colpevoli, invece di fallire con un
-- messaggio di PostgreSQL che non dice quali righe.
-- La post-condizione protegge cio' che NON doveva cambiare: i due tenant devono avere
-- ancora ESATTAMENTE il settore che avevano, e devono essere ancora due.
--
-- ROLLBACK: non serve un giornale `staging.*_undo`. Questa migrazione non modifica
-- nessun dato esistente — aggiunge un catalogo, un vincolo e una vista. Il ritiro e'
-- `DROP`, e nessuna riga di business viene toccata. Dichiarato qui perche' il metodo
-- pretende o il giornale o la ragione scritta della sua assenza.
--
-- Idempotente: ri-eseguibile senza effetti (IF NOT EXISTS / ON CONFLICT / OR REPLACE).
-- Nessun BEGIN/COMMIT esplicito: il runner avvolge gia' ogni file in una transazione,
-- e aggiungerne un secondo produce due ATTENZIONE («c'e' gia' una transazione in
-- corso» / «non c'e' alcuna transazione in corso») senza dare atomicita' in piu'.
-- =====================================================================================

-- --- (a) il catalogo dei settori — aperto a ogni industria (I21) ----------------------
CREATE TABLE IF NOT EXISTS sys.sys_industry_codes (
  industry_code         varchar(32)  PRIMARY KEY,
  industry_name         varchar(160) NOT NULL,
  -- Il codice ATECO che questo settore implica. E' la colonna che rende confrontabili
  -- le due dichiarazioni: senza, la sentinella non avrebbe niente su cui confrontare.
  industry_ateco_code   varchar(16)  NOT NULL,
  industry_is_active    boolean      NOT NULL DEFAULT true,
  created_at            timestamptz  NOT NULL DEFAULT now(),
  updated_at            timestamptz  NOT NULL DEFAULT now(),
  -- SCREAMING_SNAKE, come ogni altro codice del progetto. Un refuso in minuscolo o con
  -- uno spazio non entra piu'.
  CONSTRAINT sys_industry_codes_formato_chk
    CHECK (industry_code ~ '^[A-Z][A-Z0-9_]{2,31}$'),
  CONSTRAINT sys_industry_codes_ateco_formato_chk
    CHECK (industry_ateco_code ~ '^[0-9]{2}(\.[0-9]{1,2})?$')
);

COMMENT ON TABLE sys.sys_industry_codes IS
  'Catalogo dei settori dichiarabili da un tenant (#135). APERTO a ogni industria per '
  'I21: aggiungere un settore e'' un INSERT, non una migrazione. `industry_ateco_code` '
  'e'' cio'' che rende confrontabile questa dichiarazione con quella del profilo di '
  'tipizzazione, sorvegliata da sys.v_tenant_industry_incoerente.';

-- I due settori che i tenant correnti dichiarano, piu' quelli che la piattaforma sa
-- gia' nominare altrove. Non sono inventati: i primi due sono misurati sul database
-- (HEURESYS 70.20 · RTL_BANK 64.19, ATECO_2025), gli altri sono le sezioni ATECO di
-- primo livello piu' comuni, perche' un catalogo con due sole righe renderebbe la
-- creazione di un tenant nuovo un lavoro da migrazione — l'opposto di I21.
INSERT INTO sys.sys_industry_codes (industry_code, industry_name, industry_ateco_code) VALUES
  ('MGMT_CONSULTING',  'Consulenza direzionale e imprenditoriale',          '70.20'),
  ('FIN_BANKING',      'Banche e intermediazione monetaria',                '64.19'),
  ('FIN_INSURANCE',    'Assicurazioni',                                     '65.12'),
  ('IT_SOFTWARE',      'Produzione di software e consulenza informatica',   '62.01'),
  ('MANUFACTURING',    'Attività manifatturiere',                           '25.62'),
  ('RETAIL',           'Commercio al dettaglio',                            '47.19'),
  ('HEALTHCARE',       'Servizi sanitari',                                  '86.10'),
  ('EDUCATION',        'Istruzione',                                        '85.42'),
  ('TRANSPORT_LOGISTICS', 'Trasporto e magazzinaggio',                      '52.29'),
  ('UTILITIES_ENERGY', 'Fornitura di energia elettrica e gas',              '35.11'),
  ('CONSTRUCTION',     'Costruzioni',                                       '41.20'),
  ('PUBLIC_ADMIN',     'Amministrazione pubblica',                          '84.11')
ON CONFLICT (industry_code) DO NOTHING;

-- --- guardia: nessun tenant deve restare fuori dal catalogo ---------------------------
-- Ri-verificata ADESSO, non ereditata dalla misura fatta scrivendo questo file.
DO $$
DECLARE
  fuori text;
BEGIN
  SELECT string_agg(format('%s -> %L', t.tenant_code, t.tenant_industry_code), ', ')
    INTO fuori
    FROM sys.sys_tenancies t
   WHERE t.tenant_industry_code IS NULL
      OR NOT EXISTS (SELECT 1 FROM sys.sys_industry_codes c
                      WHERE c.industry_code = t.tenant_industry_code);
  IF fuori IS NOT NULL THEN
    RAISE EXCEPTION
      'GUARDIA 000305: % tenant hanno un settore assente dal catalogo sys_industry_codes: %. '
      'Aggiungere la voce al catalogo (e'' aperto) OPPURE correggere il tenant, poi ri-eseguire.',
      (SELECT count(*) FROM sys.sys_tenancies t
        WHERE t.tenant_industry_code IS NULL
           OR NOT EXISTS (SELECT 1 FROM sys.sys_industry_codes c
                           WHERE c.industry_code = t.tenant_industry_code)),
      fuori;
  END IF;
END $$;

-- --- (b) il vincolo: la dichiarazione (1) non e' piu' una parola nel vuoto ------------
ALTER TABLE sys.sys_tenancies ALTER COLUMN tenant_industry_code SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'sys_tenancies_industry_code_fkey'
       AND conrelid = 'sys.sys_tenancies'::regclass
  ) THEN
    ALTER TABLE sys.sys_tenancies
      ADD CONSTRAINT sys_tenancies_industry_code_fkey
      FOREIGN KEY (tenant_industry_code)
      REFERENCES sys.sys_industry_codes (industry_code)
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
END $$;

-- --- (c) la sentinella: le due dichiarazioni concordano? ------------------------------
CREATE OR REPLACE VIEW sys.v_tenant_industry_incoerente AS
SELECT t.tenant_id,
       t.tenant_code,
       t.tenant_industry_code,
       c.industry_ateco_code           AS ateco_atteso,
       ac.activity_classification_code AS ateco_del_profilo,
       CASE
         WHEN p.enterprise_typing_profile_id IS NULL
           THEN 'il tenant non ha un profilo di tipizzazione'
         WHEN p.enterprise_typing_industry_class_id IS NULL
           THEN 'il profilo di tipizzazione non dichiara una classe di attività'
         ELSE 'le due dichiarazioni indicano ATECO diversi'
       END AS motivo
  FROM sys.sys_tenancies t
  JOIN sys.sys_industry_codes c
    ON c.industry_code = t.tenant_industry_code
  LEFT JOIN sys.sys_enterprise_typing_profiles p
    ON p.enterprise_typing_tenant_id = t.tenant_id
  LEFT JOIN sys.sys_activity_classifications ac
    ON ac.activity_classification_id = p.enterprise_typing_industry_class_id
 WHERE t.tenant_status = 'ACTIVE'
   AND (p.enterprise_typing_profile_id IS NULL
        OR p.enterprise_typing_industry_class_id IS NULL
        OR ac.activity_classification_code IS DISTINCT FROM c.industry_ateco_code);

COMMENT ON VIEW sys.v_tenant_industry_incoerente IS
  'Sentinella #135: un tenant ATTIVO le cui DUE dichiarazioni di settore non '
  'concordano — `sys_tenancies.tenant_industry_code` (via il catalogo) contro la '
  'classe ATECO del profilo di tipizzazione. Zero righe = concordano. La coerenza fra '
  'due tabelle non e'' esprimibile come CHECK, e un trigger sarebbe una regola nascosta.';

-- --- post-condizione: protegge cio' che NON doveva cambiare ---------------------------
DO $$
DECLARE
  n_tenant int;
  n_incoerenti int;
  heu text;
  rtl text;
BEGIN
  SELECT count(*) INTO n_tenant FROM sys.sys_tenancies WHERE tenant_status = 'ACTIVE';
  SELECT count(*) INTO n_incoerenti FROM sys.v_tenant_industry_incoerente;
  SELECT tenant_industry_code INTO heu FROM sys.sys_tenancies WHERE tenant_code = 'HEURESYS';
  SELECT tenant_industry_code INTO rtl FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK';

  IF n_tenant <> 2 THEN
    RAISE EXCEPTION 'POST-CONDIZIONE 000305: i tenant ATTIVI sono %, attesi 2', n_tenant;
  END IF;
  IF heu IS DISTINCT FROM 'MGMT_CONSULTING' THEN
    RAISE EXCEPTION 'POST-CONDIZIONE 000305: HEURESYS ha settore %, atteso MGMT_CONSULTING', heu;
  END IF;
  IF rtl IS DISTINCT FROM 'FIN_BANKING' THEN
    RAISE EXCEPTION 'POST-CONDIZIONE 000305: RTL_BANK ha settore %, atteso FIN_BANKING', rtl;
  END IF;
  IF n_incoerenti <> 0 THEN
    RAISE EXCEPTION 'POST-CONDIZIONE 000305: la sentinella trova % tenant incoerenti, attesi 0',
      n_incoerenti;
  END IF;
  RAISE NOTICE '000305 OK: 2 tenant attivi, settori invariati, sentinella a zero.';
END $$;
