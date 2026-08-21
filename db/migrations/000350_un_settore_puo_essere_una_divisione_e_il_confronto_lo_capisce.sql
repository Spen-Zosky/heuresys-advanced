-- ============================================================================
-- 000350 — #222 F5 (rilievo F6-04): i cinque settori che puntavano a codici
--          ATECO inesistenti, e il confronto che ora capisce la gerarchia.
--
-- IL DIFETTO, misurato il 2026-08-20: cinque righe di `sys_industry_codes`
-- dichiarano un `industry_ateco_code` che in ATECO 2025 NON ESISTE —
-- `CONSTRUCTION` 41.20 · `EDUCATION` 85.42 · `IT_SOFTWARE` 62.01 ·
-- `RETAIL` 47.19 · `TRANSPORT_LOGISTICS` 52.29. Gli altri sette sono a posto.
--
-- ⚠ LA DOMANDA ERA MAL POSTA, e la misura lo ha mostrato. Sembrava «quale
-- codice 2025 corrisponde al vecchio?», e per `EDUCATION` e `RETAIL` non c'e'
-- risposta: 13 candidati per l'uno, una trentina per l'altro. Ma quel campo non
-- serve a nominare una CLASSE: serve alla sentinella
-- `v_tenant_industry_incoerente`, che confronta le DUE dichiarazioni di settore
-- di uno stesso tenant — quella del catalogo e quella del suo profilo di
-- tipizzazione.
--
-- Il confronto era per UGUAGLIANZA ESATTA, e questo legava due cose che
-- sembravano indipendenti: il livello del codice e il modo di confrontarlo. Con
-- l'uguaglianza, un settore puo' essere solo una classe — e «Commercio al
-- dettaglio» non E' la classe 47.19, «Istruzione» non E' l'istruzione terziaria.
-- Scegliere una di quelle classi sarebbe stato arbitrario, e l'arbitrio sarebbe
-- rimasto scritto come se fosse un dato.
--
-- LA CURA: il settore puo' essere una DIVISIONE, e il confronto diventa
-- GERARCHICO — la classe del profilo deve RICADERE SOTTO il settore dichiarato,
-- non esservi identica. E' semanticamente giusto: un'azienda «Commercio al
-- dettaglio» con profilo 47.11 e' coerente, non incoerente.
--
-- E NON E' UN'INVENZIONE DI OGGI: il `CHECK` posato da 000305 e'
--     industry_ateco_code ~ '^[0-9]{2}(\.[0-9]{1,2})?$'
-- che ammette **due cifre da sole**, cioe' la divisione. Era previsto fin
-- dall'inizio; mancava il confronto che sapesse leggerla.
--
-- I CINQUE, e il criterio: il codice deve corrispondere al NOME del settore.
--   CONSTRUCTION        «Costruzioni»                      41.20 -> 41.00
--     (unico candidato di livello 4: «Costruzione di edifici residenziali e non»)
--   IT_SOFTWARE         «Produzione di software e consulenza informatica»  62.01 -> 62.10
--     («Attivita' di programmazione informatica»: il nome del settore E' quella classe)
--   EDUCATION           «Istruzione»                        85.42 -> 85
--   RETAIL              «Commercio al dettaglio»            47.19 -> 47
--   TRANSPORT_LOGISTICS «Trasporto e magazzinaggio»         52.29 -> 52
--     (per questi tre il nome del settore E' la divisione: nessuna classe lo rappresenta)
--
-- ROLLBACK DICHIARATO: nessun giornale — cinque valori, e i precedenti sono
-- scritti qui sopra. L'inversa e' un UPDATE con quelli. La vista si ripristina
-- con la sua definizione in 000305.
--
-- IDEMPOTENTE: `WHERE` sul valore vecchio, `CREATE OR REPLACE` per la vista.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. La vista PRIMA dei codici: se cambiassimo i codici mentre il confronto e'
--    ancora per uguaglianza, la sentinella si accenderebbe fra i due passi.
--    In una transazione non si vedrebbe — ma questa catena non e' una
--    transazione sola, e un rosso transitorio e' comunque un rosso.
--
-- Il confronto gerarchico: identico, oppure discendente. `LIKE settore || '.%'`
-- e non `LIKE settore || '%'`, perche' il secondo farebbe combaciare 47 con 470
-- — che in ATECO non esiste, ma un confronto giusto non deve dipendere dal fatto
-- che il caso storto non capiti.
-- ---------------------------------------------------------------------------
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
         ELSE 'la classe del profilo non ricade sotto il settore dichiarato'
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
        OR NOT (   ac.activity_classification_code =  c.industry_ateco_code
                OR ac.activity_classification_code LIKE c.industry_ateco_code || '.%'));

COMMENT ON VIEW sys.v_tenant_industry_incoerente IS
  'Sentinella #135: un tenant ATTIVO le cui DUE dichiarazioni di settore non concordano. Dal 2026-08-21 (#222 F5) il confronto e'' GERARCHICO: la classe del profilo deve ricadere SOTTO il settore dichiarato, non esservi identica — cosi'' un settore puo'' essere una divisione (47 «Commercio al dettaglio») e un profilo una sua classe (47.11).';

-- ---------------------------------------------------------------------------
-- 2. I cinque codici.
-- ---------------------------------------------------------------------------
UPDATE sys.sys_industry_codes SET industry_ateco_code = '41.00' WHERE industry_code = 'CONSTRUCTION'        AND industry_ateco_code = '41.20';
UPDATE sys.sys_industry_codes SET industry_ateco_code = '62.10' WHERE industry_code = 'IT_SOFTWARE'         AND industry_ateco_code = '62.01';
UPDATE sys.sys_industry_codes SET industry_ateco_code = '85'    WHERE industry_code = 'EDUCATION'           AND industry_ateco_code = '85.42';
UPDATE sys.sys_industry_codes SET industry_ateco_code = '47'    WHERE industry_code = 'RETAIL'              AND industry_ateco_code = '47.19';
UPDATE sys.sys_industry_codes SET industry_ateco_code = '52'    WHERE industry_code = 'TRANSPORT_LOGISTICS' AND industry_ateco_code = '52.29';

-- ---------------------------------------------------------------------------
-- 3. POST-CONDIZIONE
--
-- Il controllo (c) e' quello che protegge cio' che NON doveva cambiare: i due
-- tenant ATTIVI erano coerenti prima e devono esserlo dopo. Un confronto reso
-- piu' permissivo puo' nascondere un'incoerenza vera invece di correggerla, e
-- contare gli zeri non distingue le due cose — per questo (d) verifica che la
-- sentinella sappia ANCORA accendersi.
-- ---------------------------------------------------------------------------
DO $$
DECLARE inesistenti int; incoerenti int; attivi int; falsi_negativi int;
BEGIN
  -- (a) nessun settore punta piu' a un codice che non esiste
  SELECT count(*) INTO inesistenti
    FROM sys.sys_industry_codes i
   WHERE NOT EXISTS (SELECT 1 FROM sys.sys_activity_classifications a
                      WHERE a.activity_classification_scheme = 'ATECO_2025'
                        AND a.activity_classification_code = i.industry_ateco_code);
  IF inesistenti > 0 THEN
    RAISE EXCEPTION '000350: % settori puntano ancora a un ATECO inesistente', inesistenti;
  END IF;

  -- (b) la sentinella resta a zero
  SELECT count(*) INTO incoerenti FROM sys.v_tenant_industry_incoerente;
  IF incoerenti > 0 THEN
    RAISE EXCEPTION '000350: % tenant risultano incoerenti dopo il cambio', incoerenti;
  END IF;

  -- (c) i tenant attivi sono ancora tutti agganciati al catalogo
  SELECT count(*) INTO attivi
    FROM sys.sys_tenancies t
    JOIN sys.sys_industry_codes c ON c.industry_code = t.tenant_industry_code
   WHERE t.tenant_status = 'ACTIVE';
  IF attivi < 2 THEN
    RAISE EXCEPTION '000350: solo % tenant attivi agganciati al catalogo, ne servivano almeno 2', attivi;
  END IF;

  -- (d) LA SENTINELLA SA ANCORA DIRE DI NO. Un confronto piu' permissivo che
  --     accettasse tutto sarebbe verde per costruzione: qui si verifica che una
  --     classe di una DIVISIONE DIVERSA venga ancora respinta.
  SELECT count(*) INTO falsi_negativi
    FROM (SELECT '47'::text AS settore, '62.10'::text AS profilo) prova
   WHERE prova.profilo = prova.settore
      OR prova.profilo LIKE prova.settore || '.%';
  IF falsi_negativi > 0 THEN
    RAISE EXCEPTION '000350: il confronto accetta 62.10 sotto il settore 47 — e'' troppo permissivo';
  END IF;

  RAISE NOTICE '000350 ok — 0 settori con ATECO inesistente · sentinella a zero su % tenant attivi · il confronto sa ancora respingere', attivi;
END $$;
