-- 000388 — Il contenuto di un tenant deve essere del suo settore.
--
-- Numero assegnato al momento della copia (misurato: `git ls-files 'db/migrations/*.sql' |
-- tail -1` dava 000387, dopo B1/B3 di questa stessa sessione). E' il PUNTO FISSO applicato a
-- questa stessa migrazione.
--
-- PERCHE' ESISTE. L'invariante I21 pretende che i dati che derivano dal settore di un tenant
-- siano coerenti con esso, ed elenca le purghe gia' fatte: i modelli `BP-SF-*` intestati a
-- un'azienda alimentare, i 35 percorsi formativi di settore alimentare ed energetico, gli
-- indicatori `HACCP-COMPLIANCE` ed `ENERGY-SAVINGS`. Quelle purghe sono state eseguite UNA
-- PER UNA, con migrazioni scritte a mano, e nessuna ha lasciato dietro di se' una sentinella
-- che le renda ripetibili.
--
-- ⚠⚠ IL REPERTO CHE HA PRODOTTO QUESTA MIGRAZIONE (misurato il 2026-09-09). `db_health.py`
-- si chiude con «ESITO: tutto nei limiti», e fra i suoi controlli c'e' gia'
-- `v_tenant_industry_incoerente`, che restituisce ZERO. Ma quella vista — letta con
-- `pg_get_viewdef` — confronta il codice ATECO del profilo di tipizzazione del tenant con il
-- settore dichiarato del tenant: verifica che due codici combacino NELL'ANAGRAFICA. Non
-- guarda una sola riga di CONTENUTO.
--
-- Nel frattempo, dentro `RTL_BANK` (FIN_BANKING, 15 OKR, tutti suoi) ci sono tre obiettivi di
-- un'azienda alimentare, in chiaro, mostrati dalla pagina OKR senza filtri:
--   · e54278d2-a4d5-4164-9c34-b9cea418e509  «Launch organic product line with 15 SKUs»
--   · e2f4ab73-016f-4f97-bcc3-0506a39342d5  «Reduce food waste by 25% across operations»
--   · 1c844ea2-ff8b-4c27-adcd-52a1eeeff5b8  «Launch D2C e-commerce platform»
--
-- E' un FALSO VERDE dimostrato, e cade sotto la quinta regola del metodo di bonifica: «le
-- prove devono poter fallire; un controllo che non si e' mai visto rosso non e' una prova».
-- Qui e' peggio: questo controllo si e' visto VERDE su un caso in cui doveva essere rosso.
--
-- ⭐ CIO' CHE QUESTA SENTINELLA SA FARE, E CIO' CHE DICHIARA DI NON SAPER FARE.
-- Riconoscere «fuori settore» dentro un testo libero e' indecidibile, esattamente come
-- riconoscere un nome di persona — e una guardia che pretende di saperlo fare mente. Quindi
-- questa sentinella NON giudica il testo: confronta il contenuto di un tenant con una LISTA
-- DICHIARATA di termini che quel settore non puo' contenere. Ogni voce della lista porta la
-- sua ragione e la sua data, come le righe di `agent-perimetri.json`, e senza quelle la
-- tabella le rifiuta.
--
-- Conseguenza da tenere presente e non nascondere: **cattura cio' che e' stato dichiarato,
-- non tutto cio' che e' fuori settore.** Il modo definitivo sarebbe classificare ogni
-- contenuto con un proprio codice di settore e confrontare i codici, come gia' avviene per
-- l'anagrafica del tenant; finche' quel campo non esiste, questa e' la guardia che si puo'
-- provare rossa oggi. Una guardia parziale e dichiarata tale vale piu' di una completa e
-- immaginaria.
--
-- SUPERFICI COPERTE in questa prima versione: gli OKR e gli obiettivi — le due superfici
-- testuali che un cliente vede per prime. Corsi, competenze e indicatori si aggiungono con lo
-- stesso pattern, ognuno con la propria prova rossa: una superficie aggiunta senza la sua
-- prova nasce cieca.
--
-- Zero righe attese. Una riga qui significa che un contenuto di un tenant nomina qualcosa che
-- il suo settore non ospita: o si toglie quel contenuto, o si dichiara nella lista perche' e'
-- legittimo. NON si allarga il pattern per far tacere la vista.

-- @migrate: once

BEGIN;

-- ── La lista dichiarata: cresce senza nuove migrazioni, e ogni voce porta la sua ragione ──
CREATE TABLE IF NOT EXISTS sys.sys_industry_forbidden_terms (
  industry_forbidden_term_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_forbidden_industry    varchar(64)  NOT NULL,
  industry_forbidden_term        varchar(128) NOT NULL,
  industry_forbidden_reason      text         NOT NULL,
  industry_forbidden_decided_by  varchar(128) NOT NULL,
  industry_forbidden_decided_at  date         NOT NULL,
  created_at                     timestamptz  NOT NULL DEFAULT now(),
  updated_at                     timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT sys_industry_forbidden_terms_uq
    UNIQUE (industry_forbidden_industry, industry_forbidden_term),
  -- una voce senza ragione e senza autore non e' una dichiarazione: e' una dimenticanza
  CONSTRAINT sys_industry_forbidden_terms_motivata
    CHECK (length(btrim(industry_forbidden_reason)) > 10
           AND length(btrim(industry_forbidden_decided_by)) > 0)
);

COMMENT ON TABLE sys.sys_industry_forbidden_terms IS
  'I21 — termini che un dato settore non ospita nel proprio contenuto tenant-scoped. Fonte '
  'unica della sentinella v_contenuto_fuori_settore. Ogni voce porta ragione, autore e data: '
  'la lista e'' una DICHIARAZIONE, non un elenco di parole. Cattura cio'' che e'' stato '
  'dichiarato, non tutto cio'' che e'' fuori settore — vedi il commento della migrazione.';

INSERT INTO sys.sys_industry_forbidden_terms
  (industry_forbidden_industry, industry_forbidden_term, industry_forbidden_reason,
   industry_forbidden_decided_by, industry_forbidden_decided_at)
VALUES
  ('FIN_BANKING', 'organic product',
   'Linea di prodotti biologici: contenuto di un''azienda alimentare, non di una banca. '
   'Residuo dell''ingestione storica, sopravvissuto alle purghe di I21 perche'' nessuna '
   'sentinella guardava il contenuto.',
   'Enzo (I21, reperto del 2026-09-09)', DATE '2026-09-09'),
  ('FIN_BANKING', 'food waste',
   'Spreco alimentare: contenuto di un''azienda alimentare, non di una banca. Stessa origine.',
   'Enzo (I21, reperto del 2026-09-09)', DATE '2026-09-09')
-- ⚠ «D2C e-commerce» NON entra nella lista: DECISIONE DI ENZO del 2026-09-09, «il terzo
--   obiettivo si tiene». Una banca puo' legittimamente avere un canale digitale diretto verso
--   il consumatore, quindi l'obiettivo «Launch D2C e-commerce platform» resta e non e' un
--   difetto. La decisione e' scritta qui perche' chi riprendera' questa lista non la ri-deduca
--   e non lo aggiunga «per simmetria» con gli altri due.
ON CONFLICT (industry_forbidden_industry, industry_forbidden_term) DO NOTHING;

-- ── La sentinella ──
CREATE OR REPLACE VIEW sys.v_contenuto_fuori_settore AS
-- ① gli OKR: obiettivo e descrizione
SELECT o.okr_tenant_id                       AS tenant_id,
       t.tenant_code                         AS tenant,
       t.tenant_industry_code                AS settore,
       'okr'::text                           AS superficie,
       o.okr_id                              AS riga_id,
       f.industry_forbidden_term             AS termine,
       left(o.okr_objective, 80)             AS valore
  FROM sys.sys_okrs o
  JOIN sys.sys_tenancies t ON t.tenant_id = o.okr_tenant_id
  JOIN sys.sys_industry_forbidden_terms f
    ON f.industry_forbidden_industry = t.tenant_industry_code::text
 WHERE o.okr_tenant_id IS NOT NULL
   -- ⭐ GLI STATI TERMINALI NON SONO UN DIFETTO, SONO STORIA. Un obiettivo portato a
   --    CANCELLED o ARCHIVED e' stato tolto di mezzo dall'azienda: resta come memoria, come
   --    una posizione soppressa conserva chi la occupava (regola di dominio di Enzo,
   --    2026-09-08). La sentinella guarda cio' che e' VIVO. Se guardasse anche gli stati
   --    terminali, resterebbe rossa per sempre e insegnerebbe a non guardarla.
   AND o.okr_status NOT IN ('CANCELLED', 'ARCHIVED')
   AND (coalesce(o.okr_objective, '') || ' ' || coalesce(o.okr_description, ''))
       ILIKE '%' || f.industry_forbidden_term || '%'
UNION ALL
-- ② gli obiettivi
SELECT g.goal_tenant_id                      AS tenant_id,
       t.tenant_code                         AS tenant,
       t.tenant_industry_code                AS settore,
       'goal'::text                          AS superficie,
       g.goal_id                             AS riga_id,
       f.industry_forbidden_term             AS termine,
       left(g.goal_title, 80)                AS valore
  FROM sys.sys_goals g
  JOIN sys.sys_tenancies t ON t.tenant_id = g.goal_tenant_id
  JOIN sys.sys_industry_forbidden_terms f
    ON f.industry_forbidden_industry = t.tenant_industry_code::text
 WHERE g.goal_tenant_id IS NOT NULL
   AND (coalesce(g.goal_title, '') || ' ' || coalesce(g.goal_description, ''))
       ILIKE '%' || f.industry_forbidden_term || '%';

COMMENT ON VIEW sys.v_contenuto_fuori_settore IS
  'SENTINELLA I21 (2026-09-09). Zero righe attese DOPO la bonifica; alla nascita ne vede tre, '
  'ed e'' il motivo per cui esiste. Confronta il contenuto tenant-scoped con la lista '
  'dichiarata in sys_industry_forbidden_terms. NON giudica il testo: riconoscere «fuori '
  'settore» in un testo libero e'' indecidibile, e una guardia che pretende di saperlo fare '
  'mente. Cattura cio'' che e'' stato dichiarato. Una riga qui significa: o si toglie quel '
  'contenuto, o si toglie quella voce dalla lista perche'' era legittima.';

-- ── La prova che la guardia puo' fallire, ed e' l'unica cosa che la rende una prova ──
DO $$
DECLARE
  n_prima   int;
  n_dopo    int;
  n_okr     int;
  n_iniez   int;
  v_id      uuid;
BEGIN
  SELECT count(*) INTO n_okr FROM sys.sys_okrs;

  -- 1. LO STATO DI PARTENZA. Qui, a differenza delle sentinelle di perimetro, NON pretendiamo
  --    zero: la sentinella nasce apposta per vedere i tre obiettivi gia' presenti. Si misura
  --    e si dichiara, perche' il numero atteso dopo la bonifica sara' zero.
  SELECT count(*) INTO n_prima FROM sys.v_contenuto_fuori_settore;
  RAISE NOTICE 'SENTINELLA I21: alla nascita vede % righe fuori settore (attese 3 su RTL_BANK, '
               'da bonificare con la migrazione gemella).', n_prima;

  -- 2. LA PROVA A ESITI OPPOSTI: si inietta un termine dichiarato in un OKR che NON lo aveva,
  --    e la sentinella deve vederne uno in piu'. Tutto dentro la transazione: la riga di prova
  --    non esiste prima e non esiste dopo.
  IF n_okr = 0 THEN
    RAISE NOTICE 'SENTINELLA I21: `sys_okrs` e'' vuota qui: la prova a esiti opposti non e'' '
                 'eseguibile. NON e'' un verde, e'' un NON MISURATO.';
  ELSE
    SELECT o.okr_id INTO v_id
      FROM sys.sys_okrs o
      JOIN sys.sys_tenancies t ON t.tenant_id = o.okr_tenant_id
     WHERE t.tenant_industry_code::text = 'FIN_BANKING'
       AND o.okr_id NOT IN (SELECT riga_id FROM sys.v_contenuto_fuori_settore
                             WHERE superficie = 'okr')
     ORDER BY o.okr_id LIMIT 1;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'SENTINELLA I21: non esiste un OKR pulito su cui provare l''iniezione: '
                      'la prova non e'' eseguibile e la sentinella non si installa alla cieca';
    END IF;

    UPDATE sys.sys_okrs
       SET okr_description = coalesce(okr_description, '') || ' __PROVA_I21__ organic product line'
     WHERE okr_id = v_id;

    SELECT count(*) INTO n_iniez FROM sys.v_contenuto_fuori_settore;
    IF n_iniez <> n_prima + 1 THEN
      RAISE EXCEPTION 'SENTINELLA I21: iniettato un termine dichiarato in un OKR e la vista '
                      'vede % righe invece di % — e'' CIECA, e una guardia cieca e'' peggio '
                      'di nessuna guardia', n_iniez, n_prima + 1;
    END IF;

    UPDATE sys.sys_okrs
       SET okr_description = nullif(replace(okr_description,
                                            ' __PROVA_I21__ organic product line', ''), '')
     WHERE okr_id = v_id;

    -- 3. …e l'iniezione e' disfatta: si torna esattamente al numero di partenza.
    SELECT count(*) INTO n_dopo FROM sys.v_contenuto_fuori_settore;
    IF n_dopo <> n_prima THEN
      RAISE EXCEPTION 'SENTINELLA I21: dopo la prova restano % righe invece di %: '
                      'l''iniezione non e'' stata disfatta', n_dopo, n_prima;
    END IF;
  END IF;

  -- 4. POST-CONDIZIONE SU CIO' CHE NON DOVEVA CAMBIARE. Una prova che si porta via una riga
  --    di produzione sarebbe un danno peggiore del difetto che previene.
  SELECT count(*) INTO n_dopo FROM sys.sys_okrs;
  IF n_dopo <> n_okr THEN
    RAISE EXCEPTION 'SENTINELLA I21: gli OKR sono % invece di %: la prova ha toccato le righe vere',
      n_dopo, n_okr;
  END IF;

  RAISE NOTICE 'SENTINELLA I21: installata e provata a esiti opposti · % OKR invariati.', n_okr;
END $$;

COMMIT;
