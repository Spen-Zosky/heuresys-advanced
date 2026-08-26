-- ═══════════════════════════════════════════════════════════════════════════════
-- 000356_un_account_di_servizio_non_e_una_persona_senza_posizione.sql
--
-- #169 F2 — LA REGOLA «PERSONE ATTIVE SENZA POSIZIONE» CONTAVA ANCHE CHI NON E' UNA
-- PERSONA, E SE N'E' ACCORTA LA PRIMA VOLTA CHE UN ACCOUNT DI SERVIZIO E' ESISTITO.
--
-- IL CASO, DICHIARATO PER INTERO PERCHE' E' UN DIFETTO INTRODOTTO DA ME (S1081). La
-- direttiva di Enzo del 2026-08-25 chiede utenze di collaudo con identita' propria:
-- tre account `user_type='SERVICE'` su dominio `.invalid`, creati poche ore prima di
-- questa migrazione. Subito dopo, `db_health.py` e' passato da verde a
--
--     [!!] violazioni dell organigramma (tutte e 8 le regole): 3
--
-- e le tre erano esattamente quelle: `persone attive senza posizione`. Nessuna di esse
-- e' una persona, e nessuna deve stare nell'organigramma — un account di servizio non
-- occupa un posto, non ha un capo e non riporta a nessuno.
--
-- CHE IL CRITERIO GIUSTO SIA GIA' NOTO AL SISTEMA lo dimostra la sentinella del
-- censimento, che dal giorno in cui e' nata conta le persone con
--
--     count(*) FILTER (WHERE user_type IS DISTINCT FROM 'SERVICE')
--
-- Questa regola dell'organigramma non lo faceva, e non per una scelta: quando e' stata
-- scritta (000251, poi 000258) **non esisteva alcun account SERVICE nel database**, quindi
-- l'esclusione non poteva mancare a nessuno. E' un controllo vero rimasto vero per
-- assenza dell'unico caso che lo smentiva — la stessa forma del `PUNTO FISSO`: un
-- criterio si misura contro cio' che il modello ammette, non contro cio' che oggi ospita.
--
-- COSA FA. Riscrive `sys.fn_organization_integrity_violations()` (CREATE OR REPLACE, e
-- il corpo delle altre sette regole resta IDENTICO — si tocca la sola ottava) escludendo
-- gli account di servizio dalla regola delle persone senza posizione. Nessuna riga di
-- dati toccata: cambia cio' che il controllo GUARDA, non cio' che il database contiene.
--
-- ⚠ PERCHE' EMENDARE QUI E NON LA 000258 (ADR-0035, e la differenza conta): la 000258
-- crea la funzione con `CREATE OR REPLACE`, quindi la catena la ricrea a ogni deploy e
-- una modifica a valle **regge** — e' il caso in cui il file successivo e' la fonte, non
-- una toppa. Emendare la 000258 farebbe divergere due file che dicono la stessa cosa;
-- questo file la supersede in modo dichiarato, e il commento della funzione lo scrive.
--
-- Additiva, idempotente, nessun dato toccato. 2026-08-26 (S1081).
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ⚠ IL CORPO DELLE SETTE REGOLE E' COPIATO ALLA LETTERA DALLA 000258, COMMENTI
-- INCLUSI. Non e' pignoleria: alla prima stesura le avevo RISCRITTE a memoria — con
-- query dirette sulle tabelle invece delle bandiere di `v_organization_unit_integrity`,
-- e senza le esclusioni `tipo NOT IN ('HEADQUARTERS','GENERAL_MANAGEMENT')` — e sarebbero
-- entrate in produzione SETTE regole diverse dentro una migrazione che ne dichiara UNA.
-- Nessun controllo se ne sarebbe accorto: la funzione ha la stessa firma e lo stesso nome.
-- (memoria `read_the_file_that_creates_it`, applicata prima di sbagliare invece che dopo)
CREATE OR REPLACE FUNCTION sys.fn_organization_integrity_violations()
RETURNS TABLE (regola text, violazioni bigint) LANGUAGE sql STABLE AS $$
  SELECT 'R1 responsabile condiviso'::text,
         count(*) FROM sys.v_organization_unit_integrity
          WHERE responsabile_condiviso
            AND tipo NOT IN ('HEADQUARTERS','GENERAL_MANAGEMENT')
  UNION ALL
  SELECT 'R1 unita senza responsabile',
         count(*) FROM sys.v_organization_unit_integrity vi
          JOIN sys.sys_organization_units ou ON ou.organization_unit_id = vi.unita_id
         WHERE vi.senza_responsabile AND ou.organization_unit_is_active
  UNION ALL
  SELECT 'R2 responsabile fuori dalla propria unita',
         count(*) FROM sys.v_organization_unit_integrity vi
          JOIN sys.sys_organization_units ou ON ou.organization_unit_id = vi.unita_id
         WHERE vi.responsabile_esterno AND ou.organization_unit_is_active
           AND vi.tipo NOT IN ('HEADQUARTERS','GENERAL_MANAGEMENT')
  UNION ALL
  SELECT 'R6 annidamento non ammesso',
         count(*) FROM sys.v_organization_unit_integrity vi
          JOIN sys.sys_organization_units ou ON ou.organization_unit_id = vi.unita_id
         WHERE vi.viola_annidamento AND ou.organization_unit_is_active
  UNION ALL
  SELECT 'R7 nome incoerente col tipo',
         count(*) FROM sys.v_organization_unit_integrity vi
          JOIN sys.sys_organization_units ou ON ou.organization_unit_id = vi.unita_id
         WHERE vi.viola_nomenclatura AND ou.organization_unit_is_active
  UNION ALL
  -- R4: si riporta dentro la propria unita, o all'unita padre. La terza forma
  -- ammessa e' stata aggiunta applicando (S1043): il superiore puo' stare in
  -- un'unita qualsiasi PURCHE' sia la persona che dirige la mia unita padre.
  -- Serve perche' un responsabile puo' legittimamente reggere DUE unita e avere
  -- una sola posizione: e' il caso della CEO, che regge la societa e la Direzione
  -- Generale e siede nella prima. Senza questa forma, i tre direttori di divisione
  -- appesi alla Direzione Generale risultavano «estranei» mentre riportavano
  -- esattamente a chi li dirige. Non e' una tolleranza piu' larga: e' la regola
  -- detta per quello che significa. I due riporti laterali veri (verso un System
  -- Administrator che non dirige nulla) restano contati, ed erano gia' stati
  -- corretti nella sezione B-bis.
  SELECT 'R4 riporto verso unita estranea',
         count(*) FROM sys.sys_positions f
          JOIN sys.sys_positions s ON s.position_id = f.position_reports_to_position_id
          JOIN sys.sys_organization_units fo ON fo.organization_unit_id = f.position_organization_unit_id
          JOIN sys.sys_organization_units so ON so.organization_unit_id = s.position_organization_unit_id
          LEFT JOIN sys.sys_organization_units pf ON pf.organization_unit_id = fo.organization_unit_parent_id
         WHERE f.position_is_active AND s.position_is_active
           AND fo.organization_unit_id IS DISTINCT FROM so.organization_unit_id
           AND fo.organization_unit_parent_id IS DISTINCT FROM so.organization_unit_id
           AND (pf.organization_unit_manager_user_id IS NULL
                OR pf.organization_unit_manager_user_id IS DISTINCT FROM (
                     SELECT a.user_position_assignment_user_id
                       FROM sys.sys_user_position_assignments a
                      WHERE a.user_position_assignment_position_id = s.position_id
                        AND a.user_position_assignment_status = 'ACTIVE' LIMIT 1))
  UNION ALL
  -- R5 — LA REGOLA CHE MANCAVA (aggiunta in 000258). R4 guarda solo coppie di
  -- posizioni entrambe VIVE: un riporto verso una posizione spenta, o l'assenza
  -- totale di superiore, le risultano «niente da controllare» invece che «albero
  -- rotto». E' il punto cieco che ha lasciato passare QUINDICI tronconi dopo la
  -- ricostruzione, col perimetro della CEO sceso da 157 persone a 17.
  -- Una radice e' legittima solo se la sua unita non ha padre: sono le due sedi.
  SELECT 'R5 albero delle posizioni spezzato',
         count(*) FROM sys.sys_positions p
          JOIN sys.sys_organization_units ou ON ou.organization_unit_id = p.position_organization_unit_id
          LEFT JOIN sys.sys_positions s ON s.position_id = p.position_reports_to_position_id
         WHERE p.position_is_active
           AND ou.organization_unit_parent_id IS NOT NULL
           AND (p.position_reports_to_position_id IS NULL OR s.position_is_active = false)
  UNION ALL
  -- 000356: `IS DISTINCT FROM 'SERVICE'` e non `<> 'SERVICE'` — la colonna ha un
  -- default ma non un NOT NULL, e con `<>` un tipo nullo uscirebbe dal conteggio in
  -- silenzio, cioe' la regola smetterebbe di vedere proprio i casi peggiori.
  -- Stesso identico criterio della sentinella del censimento (v_user_census_deviation).
  SELECT 'persone attive senza posizione',
         count(*) FROM sys.sys_users u
         WHERE u.user_status = 'ACTIVE'
           AND u.user_type IS DISTINCT FROM 'SERVICE'
           AND NOT EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a
                            WHERE a.user_position_assignment_user_id = u.user_id
                              AND a.user_position_assignment_status = 'ACTIVE');
$$;

COMMENT ON FUNCTION sys.fn_organization_integrity_violations() IS
  'Verdetto sull integrita dell organigramma: una riga per regola col numero di violazioni '
  'aperte. R5 aggiunta in 000258 dopo che un albero spezzato in 15 tronconi era passato '
  'inosservato a tutte le altre. 000356: la regola delle persone senza posizione ESCLUDE gli '
  'account user_type=SERVICE — un account di servizio non e una persona, non occupa un posto '
  'e non riporta a nessuno; stesso criterio della sentinella del censimento. Cablata in '
  'db_health.py come sonda permanente.';

-- ───────────────────────────────────────────────────────────────────────────────
-- AUTO-VERIFICA — due domande opposte, e la seconda e' quella che impedisce
-- di aver semplicemente spento il controllo.
-- ───────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  n_senza_posizione bigint;
  n_service         int;
  n_persone_vere    bigint;
BEGIN
  SELECT violazioni INTO n_senza_posizione
    FROM sys.fn_organization_integrity_violations()
   WHERE regola = 'persone attive senza posizione';

  SELECT count(*) INTO n_service FROM sys.sys_users
   WHERE user_type = 'SERVICE' AND user_status = 'ACTIVE';

  -- 1. gli account di servizio non contano piu'
  IF n_senza_posizione <> 0 THEN
    RAISE EXCEPTION
      'Restano % persone attive senza posizione dopo l esclusione dei SERVICE: NON sono account di servizio, sono persone vere e vanno guardate',
      n_senza_posizione;
  END IF;

  -- 2. ...MA la regola deve ancora saper vedere una persona vera senza posizione,
  --    o l avrei spenta invece che corretta. Si prova su una persona finta, dentro
  --    un savepoint che la annulla: una prova che non puo' fallire non e' una prova.
  BEGIN
    INSERT INTO sys.sys_users (user_tenant_id, user_email, user_display_name, user_type, user_status)
    SELECT tenant_id, 'sonda-000356@invalid', 'Sonda Regola', 'STANDARD', 'ACTIVE'
      FROM sys.sys_tenancies LIMIT 1;

    SELECT violazioni INTO n_persone_vere
      FROM sys.fn_organization_integrity_violations()
     WHERE regola = 'persone attive senza posizione';

    IF n_persone_vere <> 1 THEN
      RAISE EXCEPTION
        'La regola NON vede una persona STANDARD senza posizione (ne conta %): sarebbe spenta, non corretta',
        n_persone_vere;
    END IF;

    RAISE EXCEPTION 'sonda-ok';   -- annulla la sonda risalendo al blocco esterno
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'sonda-ok' THEN RAISE; END IF;
  END;

  RAISE NOTICE
    'OK — % account SERVICE esclusi, 0 persone vere senza posizione, e la regola sa ancora vedere una persona senza posizione (provato).',
    n_service;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK — ri-applicare il corpo della funzione come sta nella 000258 (senza la
-- riga `user_type IS DISTINCT FROM 'SERVICE'`). Ma allora ogni account di servizio
-- torna a contare come una persona senza posto nell organigramma, e db_health resta
-- rossa finche' esistono utenze di collaudo.
-- ═══════════════════════════════════════════════════════════════════════════════
