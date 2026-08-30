-- ============================================================================
-- 000367 — Il metadata di un tenant non deve poter contenere persone (#214 F6)
--
-- SESTO PERIMETRO DELL'AGENTE: `tenants`. Scelto col criterio meccanico di `#156`
-- (`check_concetti_agente.py`), non a intuito: è il primo della coda dei neutri per
-- ampiezza di lettura (3 letture · 4 pagine), e `data-classes.ts` lo dichiara privo di
-- dati di persona con parole proprie — «configurazione del tenant e salute di sistema».
--
-- E QUI LA NEUTRALITÀ È VERA PER COSTRUZIONE, NON PER FORTUNA — con UNA eccezione.
-- Misurato su `information_schema` il 2026-08-30: `sys_tenancies` non ha **nessuna**
-- colonna di persona (codice, nome, ragione sociale, paese, industry, fascia, stato).
-- Le tre rotte read espongono la lista, il catalogo degli industry-code e il singolo
-- tenant: nessuna unisce persone.
--
-- L'eccezione è `tenant_metadata`, che è **JSONB**: oggi porta solo chiavi di
-- configurazione (misurate: `domain`, `industry`, `ateco_code`, `is_platform`,
-- `legacy_tenant_id`, `rebuilt_at`, `regulatory_intensity`, `blueprint_variant_code`),
-- ma per costruzione può contenere qualunque cosa — un referente, una email, un
-- `owner_user_id`. È lo stesso buco che `#214` F6 trovò su `visualization-graphs`
-- (mig `000355`): una dichiarazione vera OGGI, non per costruzione, e il giorno in cui
-- smettesse di esserlo l'agente leggerebbe nomi propri da un perimetro dichiarato neutro
-- **senza che nessuno strumento se ne accorga**.
--
-- Quindi si apre CON LA GUARDIA, come lì: una sentinella che `db_health` raccoglie da
-- `pg_views` e pretende **a zero** — bloccante, non informativa. Zero è l'atteso: se un
-- giorno qualcuno mette una persona nel metadata di un tenant, la prova generale diventa
-- rossa e la decisione torna sul tavolo invece di scivolare.
-- ============================================================================

CREATE OR REPLACE VIEW sys.v_tenant_metadata_con_dato_di_persona AS
SELECT t.tenant_id,
       t.tenant_code,
       kv.key            AS chiave,
       left(kv.value #>> '{}', 80) AS valore
  FROM sys.sys_tenancies t
  CROSS JOIN LATERAL jsonb_each(coalesce(t.tenant_metadata, '{}'::jsonb)) AS kv
 WHERE
   -- ① una CHIAVE che nomina una persona. `legal_name` e `tenant_name` non passano di
   --    qui (sono colonne, non metadata) e non sono nel pattern: si cerca la persona,
   --    non la parola «nome».
   kv.key ~* '(^|_)(user|users|person|persona|employee|dipendente|contact|contatto|referente|owner|manager|responsabile)(_|$)'
   OR kv.key ~* 'email|_user_id$'
   -- ② un VALORE che è un indirizzo di posta, comunque si chiami la chiave. Una persona
   --    può entrare sotto un nome innocuo: `note`, `admin`, `riferimento`.
   OR kv.value #>> '{}' ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}';

COMMENT ON VIEW sys.v_tenant_metadata_con_dato_di_persona IS
  'SENTINELLA (#214 F6, 2026-08-30). Zero righe attese. Il perimetro `tenants` e'' aperto '
  'all''agente perche'' `sys_tenancies` non ha colonne di persona — ma `tenant_metadata` e'' '
  'JSONB e potrebbe accoglierne una senza che nessuno se ne accorga. Una riga qui significa '
  'che il perimetro non e'' piu'' neutro: o si toglie quel dato dal metadata, o si chiude il '
  'perimetro. NON si allarga il pattern per far tacere la vista.';

DO $$
DECLARE
  n_persone   int;
  n_tenant    int;
  n_chiavi    int;
BEGIN
  -- 1. la guardia è a zero ADESSO: se non lo fosse, il perimetro non andrebbe aperto,
  --    e questa migrazione deve fermarsi invece di aprirlo lo stesso.
  SELECT count(*) INTO n_persone FROM sys.v_tenant_metadata_con_dato_di_persona;
  IF n_persone <> 0 THEN
    RAISE EXCEPTION '000367: % dati di persona nel metadata dei tenant — il perimetro `tenants` NON e'' neutro, non si apre', n_persone;
  END IF;

  -- 2. LA PROVA CHE LA GUARDIA PUÒ FALLIRE. Una sentinella che non si è mai vista rossa
  --    non è una prova: si inietta un referente in un tenant finto, si verifica che la
  --    vista lo veda, e si disfa. Tutto dentro questa transazione — il tenant di prova
  --    non esiste prima e non esiste dopo.
  -- Due vincoli trovati dalla PROVA GENERALE e non ragionandoci sopra: `tenant_industry_code`
  -- e' NOT NULL, e `tenant_status` ammette solo ACTIVE/SUSPENDED/ARCHIVED/PENDING_ACTIVATION
  -- (non esiste 'INACTIVE'). Si usa `ARCHIVED`, che tiene il tenant di prova fuori dai conteggi
  -- degli attivi — la post-condizione qui sotto pretende che restino 2.
  INSERT INTO sys.sys_tenancies (tenant_code, tenant_name, tenant_industry_code,
                                 tenant_status, tenant_metadata)
  VALUES ('__PROVA_000367__', 'Prova della sentinella 000367', 'MGMT_CONSULTING', 'ARCHIVED',
          '{"owner_email": "mario.rossi@example.org"}'::jsonb);
  SELECT count(*) INTO n_persone FROM sys.v_tenant_metadata_con_dato_di_persona;
  IF n_persone = 0 THEN
    RAISE EXCEPTION '000367: la sentinella NON vede un referente iniettato — e'' cieca, e una guardia cieca e'' peggio di nessuna guardia';
  END IF;
  DELETE FROM sys.sys_tenancies WHERE tenant_code = '__PROVA_000367__';

  -- 3. …e dopo la prova è tornata a zero (il DELETE ha davvero disfatto l'iniezione)
  SELECT count(*) INTO n_persone FROM sys.v_tenant_metadata_con_dato_di_persona;
  IF n_persone <> 0 THEN
    RAISE EXCEPTION '000367: la prova ha lasciato % righe: l''iniezione non e'' stata disfatta', n_persone;
  END IF;

  -- 4. POST-CONDIZIONE SU CIÒ CHE NON DOVEVA CAMBIARE: i tenant veri sono ancora quelli,
  --    e il loro metadata pure. Una prova che si porta via una riga di produzione sarebbe
  --    un danno molto peggiore del difetto che previene.
  SELECT count(*) INTO n_tenant FROM sys.sys_tenancies WHERE tenant_status = 'ACTIVE';
  IF n_tenant <> 2 THEN
    RAISE EXCEPTION '000367: i tenant ACTIVE sono % invece di 2 (RTL Bank + Heuresys System)', n_tenant;
  END IF;
  SELECT count(*) INTO n_chiavi
    FROM sys.sys_tenancies t, LATERAL jsonb_object_keys(coalesce(t.tenant_metadata,'{}'::jsonb));
  IF n_chiavi < 10 THEN
    RAISE EXCEPTION '000367: le chiavi di metadata dei tenant sono % — erano 12 alla misura, qualcosa le ha tolte', n_chiavi;
  END IF;

  RAISE NOTICE '000367 OK — sentinella a zero, e provata rossa su un referente iniettato';
END $$;
