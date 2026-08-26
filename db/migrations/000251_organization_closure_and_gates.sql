-- ═══════════════════════════════════════════════════════════════════════════════
-- 000251_organization_closure_and_gates.sql
--
-- FASE 6 — LA CHIUSURA: completamento, scioglimenti e cancelli.
--
--   A. colloca le 6 persone rimaste — una lacuna del piano, emersa collaudando
--      questa fase e non nascosta
--   B. disattiva le posizioni rimaste vacanti dalla ricostruzione
--   C. scioglie le 3 unita svuotate
--   D. installa i CANCELLI: cio che impedisce all'organigramma di derivare di nuovo
--
-- Sulla lacuna, in chiaro: il piano prevedeva che le fasi 5b e 5c collocassero
-- tutti. Collaudando la fase 6 ho misurato che 6 persone restavano nella Divisione
-- Risk & Compliance — tutte residenti a Monza, tre con formazione giuridica e tre
-- economica. Senza questo controllo lo scioglimento le avrebbe lasciate appese a
-- un'unita inattiva. E' esattamente il motivo per cui le fasi sono numerate.
--
-- Prerequisiti: 000244-000250 applicate.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────────
-- A. LE 6 PERSONE RIMASTE — collocate per formazione, come tutte le altre
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TEMP TABLE residui (email text, unita text, ruolo text, titolo text) ON COMMIT DROP;
INSERT INTO residui VALUES
  -- ── i 6 rimasti nella Divisione Risk & Compliance ─────────────────────────
  ('luca.conti',       'DIR-MONIT',  'RECU', 'Gestore Recupero Crediti'),        -- Diritto Comm., val 4,0
  ('tommaso.palmieri', 'DIR-MONIT',  'ANMO', 'Analista Monitoraggio Crediti'),   -- Economia
  ('laura.santoro',    'DIR-COMPL',  'SPCM', 'Specialista Compliance'),          -- Diritto Comm., val 3,9
  ('giulia.monti',     'DIR-LEGAL',  'LEGA', 'Legale'),                          -- Diritto
  ('luca.dangelo',     'DIR-RETE',   'SPRE', 'Specialista Qualita e Supporto Rete'), -- Business Adm.
  ('luca.giordano',    'DIR-RETE',   'SPRE', 'Specialista Qualita e Supporto Rete'), -- Economia Aziendale
  -- ── i 6 trovati dalla verifica completa delle eccedenze ───────────────────
  --    Tre cassieri erano collocati in DIV-CRED, che diventa «Divisione
  --    Crediti»: una divisione crediti non ha cassieri, quindi vanno in filiale.
  --    Due analisti finanziari e una quarta cassiera completavano l'organico di
  --    unita che il target dimensiona diversamente.
  ('martina.caruso',   'FIL-MB-MON', 'CASS', 'Cassiere'),                        -- residente a Monza
  ('nicola.testa',     'FIL-MI-SEM', 'CASS', 'Cassiere'),                        -- Milano
  ('simone.leone',     'FIL-MI-SSG', 'CASS', 'Cassiere'),                        -- Milano
  ('roberta.gallo',    'FIL-MI-PRO', 'CASS', 'Cassiere'),                        -- Milano
  ('paolo.mariani',    'DIR-BILAN',  'ANBI', 'Analista Bilancio e Segnalazioni'),-- 3A3L, Monza
  -- stefano.monti va in Tesoreria con un titolo coerente con quell'unita: nella
  -- prima stesura di questa correzione gli avevo dato «Analista Bilancio e
  -- Segnalazioni» dentro la Direzione Tesoreria — un titolo che non appartiene a
  -- quell'unita, cioe' lo stesso difetto che stiamo eliminando.
  ('stefano.monti',    'DIR-TREAS',  'ANFI', 'Analista Finanziario');            -- 3A3L, Monza

CREATE TEMP TABLE residui_pos ON COMMIT DROP AS
SELECT r.email, r.unita, r.titolo,
       ou.organization_unit_id AS unita_id, ou.organization_unit_tenant_id AS tenant_id,
       u.user_id AS persona_id,
       'POS-' || r.unita || '-' || r.ruolo || '-9' ||
         row_number() OVER (PARTITION BY r.unita, r.ruolo ORDER BY r.email) AS codice,
       (SELECT p2.position_id
          FROM sys.sys_user_position_assignments a2
          JOIN sys.sys_positions p2 ON p2.position_id = a2.user_position_assignment_position_id
         WHERE a2.user_position_assignment_user_id = ou.organization_unit_manager_user_id
           AND a2.user_position_assignment_status  = 'ACTIVE'
           AND p2.position_organization_unit_id    = ou.organization_unit_id
         LIMIT 1) AS superiore_id
FROM residui r
JOIN sys.sys_users u              ON u.user_email = r.email || '@rtl-bank.org'
JOIN sys.sys_organization_units ou ON ou.organization_unit_code = r.unita;

INSERT INTO sys.sys_positions (
  position_tenant_id, position_code, position_title, position_organization_unit_id,
  position_reports_to_position_id, position_is_active, position_effective_from)
SELECT tenant_id, codice, titolo, unita_id, superiore_id, true, CURRENT_DATE
FROM residui_pos rp
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_positions p WHERE p.position_code = rp.codice);

UPDATE sys.sys_user_position_assignments a
   SET user_position_assignment_status   = 'ENDED',
       user_position_assignment_end_date = CURRENT_DATE - 1,
       user_position_assignment_notes    = coalesce(a.user_position_assignment_notes || ' · ', '')
                                           || 'chiusa dalla ricostruzione organigramma (fase 6): completamento',
       updated_at = now()
  FROM residui_pos rp
 WHERE a.user_position_assignment_user_id = rp.persona_id
   AND a.user_position_assignment_status  = 'ACTIVE'
   -- RIESEGUIBILITA' (vedi 000248)
   AND a.user_position_assignment_position_id IS DISTINCT FROM
       (SELECT position_id FROM sys.sys_positions WHERE position_code = rp.codice);

INSERT INTO sys.sys_user_position_assignments (
  user_position_assignment_tenant_id, user_position_assignment_user_id,
  user_position_assignment_position_id, user_position_assignment_kind,
  user_position_assignment_fte, user_position_assignment_start_date,
  user_position_assignment_status, user_position_assignment_notes)
SELECT rp.tenant_id, rp.persona_id, p.position_id, 'PRIMARY', 1.0, CURRENT_DATE, 'ACTIVE',
       'ricostruzione organigramma (fase 6): ' || rp.titolo || ' presso ' || rp.unita
FROM residui_pos rp JOIN sys.sys_positions p ON p.position_code = rp.codice
WHERE NOT EXISTS (
  SELECT 1 FROM sys.sys_user_position_assignments x
   WHERE x.user_position_assignment_user_id     = rp.persona_id
     AND x.user_position_assignment_position_id = p.position_id
     AND x.user_position_assignment_status      = 'ACTIVE');

-- ───────────────────────────────────────────────────────────────────────────────
-- B. LE POSIZIONI VACANTI — si disattivano, non si cancellano
--    Cancellarle perderebbe la storia (a quelle posizioni sono agganciate
--    assegnazioni chiuse, valutazioni, requisiti di competenza). Si disattivano.
-- ───────────────────────────────────────────────────────────────────────────────
UPDATE sys.sys_positions p
   SET position_is_active     = false,
       position_effective_to  = CURRENT_DATE,
       updated_at             = now()
 WHERE p.position_is_active
   AND NOT EXISTS (
     SELECT 1 FROM sys.sys_user_position_assignments a
      WHERE a.user_position_assignment_position_id = p.position_id
        AND a.user_position_assignment_status = 'ACTIVE');

-- ───────────────────────────────────────────────────────────────────────────────
-- B-bis. I RIPORTI LATERALI SUPERSTITI — misurati applicando, non previsti
--    Il verdetto della sezione E ha contato 5 violazioni di R4 alla prima
--    applicazione reale (S1043). Guardandole una per una si sono rivelate DUE
--    classi diverse, e solo una era un difetto:
--
--    · TRE sono i direttori di divisione (Marketing, Retail, Finanza) le cui unita
--      pendono dalla Direzione Generale e che riportano alla posizione della CEO.
--      La CEO regge sia la societa sia la Direzione Generale, e la sua unica
--      posizione attiva sta nella societa: il riporto e' al responsabile della
--      propria unita padre, cioe' corretto. Era la REGOLA a non saperlo leggere —
--      corretta nella sezione D.
--    · DUE sono il difetto vero: un Back Office Specialist e uno Sviluppatore
--      Software che riportano entrambi a POS-00000345, un «System Administrator»
--      che non regge alcuna unita. E' il nodo di comando implausibile che il
--      referto misura come X10c, sopravvissuto perche' nessuna delle mappe delle
--      fasi 5a/5b/5c nominava queste due persone.
--
--    Gira DOPO la sezione B, quando le posizioni vacanti sono gia' disattivate: cosi'
--    guarda le sole posizioni occupate, che sono esattamente quelle che R4 misura.
--    La correzione e' una regola, non due identificativi scritti a mano: chi
--    riporta fuori dalla propria catena viene riagganciato al comando della
--    propria unita; se e' lui stesso il responsabile di quell'unita, sale al
--    responsabile dell'unita padre.
-- ───────────────────────────────────────────────────────────────────────────────
WITH laterali AS (
  SELECT f.position_id,
         f.position_organization_unit_id AS unita_id,
         fo.organization_unit_parent_id  AS padre_id,
         fo.organization_unit_manager_user_id AS capo_unita
    FROM sys.sys_positions f
    JOIN sys.sys_positions s  ON s.position_id = f.position_reports_to_position_id
    JOIN sys.sys_organization_units fo ON fo.organization_unit_id = f.position_organization_unit_id
    JOIN sys.sys_organization_units so ON so.organization_unit_id = s.position_organization_unit_id
    LEFT JOIN sys.sys_organization_units pf ON pf.organization_unit_id = fo.organization_unit_parent_id
   WHERE f.position_is_active AND s.position_is_active
     AND fo.organization_unit_id        IS DISTINCT FROM so.organization_unit_id
     AND fo.organization_unit_parent_id IS DISTINCT FROM so.organization_unit_id
     -- e il superiore non e' comunque il responsabile dell'unita padre
     AND (pf.organization_unit_manager_user_id IS NULL
          OR pf.organization_unit_manager_user_id IS DISTINCT FROM (
               SELECT a.user_position_assignment_user_id
                 FROM sys.sys_user_position_assignments a
                WHERE a.user_position_assignment_position_id = s.position_id
                  AND a.user_position_assignment_status = 'ACTIVE' LIMIT 1))
),
titolare AS (   -- chi occupa oggi ciascuna posizione laterale
  SELECT l.position_id, a.user_position_assignment_user_id AS persona_id
    FROM laterali l
    LEFT JOIN sys.sys_user_position_assignments a
           ON a.user_position_assignment_position_id = l.position_id
          AND a.user_position_assignment_status = 'ACTIVE'
),
destinazione AS (
  SELECT l.position_id,
         CASE
           -- non e' il responsabile della propria unita -> risale al comando dell'unita
           WHEN t.persona_id IS DISTINCT FROM l.capo_unita THEN (
             SELECT p.position_id FROM sys.sys_positions p
              WHERE p.position_organization_unit_id = l.unita_id
                AND p.position_code LIKE 'POS-CMD-%' AND p.position_is_active LIMIT 1)
           -- e' lui il responsabile -> risale al responsabile dell'unita padre
           ELSE (
             SELECT a.user_position_assignment_position_id
               FROM sys.sys_organization_units pu
               JOIN sys.sys_user_position_assignments a
                 ON a.user_position_assignment_user_id = pu.organization_unit_manager_user_id
                AND a.user_position_assignment_status = 'ACTIVE'
              WHERE pu.organization_unit_id = l.padre_id LIMIT 1)
         END AS nuovo_superiore_id
    FROM laterali l JOIN titolare t ON t.position_id = l.position_id
)
UPDATE sys.sys_positions p
   SET position_reports_to_position_id = d.nuovo_superiore_id,
       updated_at                      = now()
  FROM destinazione d
 WHERE p.position_id = d.position_id
   AND d.nuovo_superiore_id IS NOT NULL
   AND p.position_reports_to_position_id IS DISTINCT FROM d.nuovo_superiore_id;

-- ───────────────────────────────────────────────────────────────────────────────
-- C. LE TRE UNITA' SVUOTATE
--    · Divisione Risk & Compliance: era il contenitore improprio delle funzioni di
--      controllo, uscite in staff alla fase 3
--    · Direzione Corporate Banking: non esiste nel disegno target
--    Si disattivano, non si cancellano: la storia organizzativa resta leggibile.
--
--    ⚠ CORREZIONE — «Team Product & Development» (HS-PROD) NON si scioglie.
--    La prima stesura lo includeva, considerandolo un doppione: una squadra non e'
--    una linea di comando e le 26 squadre vivono gia in sys_teams. Ma il controllo
--    delle eccedenze ha misurato che quell'unita ospita UNA PERSONA —
--    chiara.spenuso, Head of Product — che appartiene al tenant HEURESYS e non e'
--    in nessuna delle liste di ricollocazione, perche' questa ricostruzione
--    riguarda RTL Bank. Scioglierla la lascerebbe con una posizione in un'unita
--    inattiva: esattamente l'incoerenza che stiamo eliminando.
--    Il tenant Heuresys resta come e' (3 unita: sede, divisione, team). La
--    questione del TEAM nell'albero si affronta quando si ricostruira Heuresys.
-- ───────────────────────────────────────────────────────────────────────────────
UPDATE sys.sys_organization_units
   SET organization_unit_is_active    = false,
       organization_unit_effective_to = CURRENT_DATE,
       updated_at                     = now()
 WHERE organization_unit_code IN ('DIV-RISK', 'DIR-CORP')
   AND organization_unit_is_active;   -- RIESEGUIBILITA': non si riscioglie cio' che e' gia' sciolto

-- ───────────────────────────────────────────────────────────────────────────────
-- D. I CANCELLI
--
--    D1. un responsabile, una sola unita — come indice unico PARZIALE.
--        L'eccezione dichiarata e' il vertice: la CEO regge societa e Direzione
--        Generale perche' le due cariche coincidono. L'indice esclude quei due tipi
--        e vale per tutto il resto: dalla sua installazione il database RIFIUTA un
--        secondo incarico. E' il difetto A1 reso impossibile.
-- ───────────────────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS sys.ux_organization_unit_manager_unico;
CREATE UNIQUE INDEX ux_organization_unit_manager_unico
    ON sys.sys_organization_units (organization_unit_manager_user_id)
 WHERE organization_unit_manager_user_id IS NOT NULL
   AND organization_unit_is_active
   AND organization_unit_type NOT IN ('HEADQUARTERS', 'GENERAL_MANAGEMENT');

COMMENT ON INDEX sys.ux_organization_unit_manager_unico IS
  'Un responsabile regge una sola unita. Eccezione dichiarata: societa e Direzione Generale, che nel caso «CEO = DG» sono retti dalla stessa persona. Prima della ricostruzione 4 persone reggevano 15 unita.';

--    D2. la funzione di verdetto — un solo numero: le violazioni aperte.
--        E' il cancello da cablare in docs/kb/tools/db_health.py e in un test di
--        integrazione. Restituisce 0 quando l'organigramma e' coerente.
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
  SELECT 'persone attive senza posizione',
         count(*) FROM sys.sys_users u
         WHERE u.user_status = 'ACTIVE'
           -- S1081: gli account di servizio non sono persone (stesso criterio della
           -- 000356, che ridefinisce questa funzione piu' avanti nella catena). Qui
           -- l'esclusione serve perche' la 000251 stessa INTERROGA questa funzione
           -- nella propria post-condizione, quando la 000356 non e' ancora girata.
           AND u.user_type IS DISTINCT FROM 'SERVICE'
           AND NOT EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a
                            WHERE a.user_position_assignment_user_id = u.user_id
                              AND a.user_position_assignment_status = 'ACTIVE');
$$;

COMMENT ON FUNCTION sys.fn_organization_integrity_violations() IS
  'Verdetto sull integrita dell organigramma: una riga per regola, con il numero di violazioni aperte. Da cablare in db_health.py e in un test di integrazione. Prima della ricostruzione: R1 condiviso 15, R1 senza responsabile 11, R2 esterno 14, R4 riporti estranei 115 su 178.';

-- Nota su cio' che NON ho installato, e perche'
--   Un TRIGGER che rifiuti un annidamento non ammesso o un riporto fuori unita
--   sarebbe piu forte di una funzione di verdetto. L'ho scartato: un trigger su
--   queste tabelle intercetta ogni scrittura dell'applicazione, e una regola
--   corretta in astratto puo' bloccare un'operazione legittima non prevista —
--   rompendo il prodotto per difendere l'organigramma. La scelta e' coerente con
--   il progetto, che usa viste-sentinella interrogate dai controlli di salute.
--   Se in futuro si vuole il trigger, la funzione qui sopra e' gia la sua logica.

-- ───────────────────────────────────────────────────────────────────────────────
-- E. AUTO-VERIFICA FINALE — la ricostruzione e' chiusa solo se tutto torna
-- ───────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  n_attive int; n_doppie int; n_senza_pos int; n_unita_attive int;
  n_violazioni bigint; n_sciolte int; n_pos_attive int; n_residui int; r record;
BEGIN
  -- 0. i 12 residui: 6 dalla Divisione Risk & Compliance, 6 trovati dalla
  --    verifica completa delle eccedenze. Se la mappa non ne ha 12, qualcuno
  --    e' stato dimenticato o duplicato nella correzione.
  SELECT count(*) INTO n_residui FROM residui;
  IF n_residui <> 12 THEN
    RAISE EXCEPTION 'Residui da collocare: attesi 12, trovati %', n_residui;
  END IF;

  IF EXISTS (SELECT email FROM residui GROUP BY email HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Una persona compare due volte fra i residui';
  END IF;

  -- 1. le persone: tutte collocate, una posizione ciascuna
  SELECT count(*) INTO n_attive FROM sys.sys_user_position_assignments
   WHERE user_position_assignment_status = 'ACTIVE';
  IF n_attive <> 161 THEN
    RAISE EXCEPTION 'Assegnazioni attive: attese 161 invariate dall inizio, trovate %', n_attive;
  END IF;

  SELECT count(*) INTO n_doppie FROM (
    SELECT user_position_assignment_user_id FROM sys.sys_user_position_assignments
     WHERE user_position_assignment_status = 'ACTIVE' GROUP BY 1 HAVING count(*) > 1) x;
  IF n_doppie <> 0 THEN RAISE EXCEPTION 'Persone con due assegnazioni attive: %', n_doppie; END IF;

  SELECT count(*) INTO n_senza_pos FROM sys.sys_users u
   WHERE u.user_status = 'ACTIVE'
     AND u.user_type IS DISTINCT FROM 'SERVICE'   -- S1081, come sopra
     AND NOT EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a
                      WHERE a.user_position_assignment_user_id = u.user_id
                        AND a.user_position_assignment_status = 'ACTIVE');
  -- Il valore misurato in lab prima delle migrazioni e' 1 (enzo.spenuso, tenant
  -- Heuresys, senza posizione e senza ruoli: e' anche l'unico utente che viola
  -- l'invariante I17). Nessuna migrazione crea persone senza posizione, quindi la
  -- soglia e' 1 e non 2: una tolleranza piu larga del necessario nasconde un difetto.
  IF n_senza_pos > 1 THEN
    RAISE EXCEPTION 'Persone attive senza posizione: % (attesa 1, preesistente)', n_senza_pos;
  END IF;

  -- 2. le unita: 2 sciolte, 43 attive
  SELECT count(*) INTO n_sciolte FROM sys.sys_organization_units
   WHERE NOT organization_unit_is_active;
  IF n_sciolte <> 2 THEN RAISE EXCEPTION 'Unita sciolte: attese 2, trovate %', n_sciolte; END IF;

  SELECT count(*) INTO n_unita_attive FROM sys.sys_organization_units
   WHERE organization_unit_is_active;
  IF n_unita_attive <> 43 THEN
    RAISE EXCEPTION 'Unita attive: attese 43 (45 meno 2 sciolte), trovate %', n_unita_attive;
  END IF;

  -- e nessuna unita si scioglie con qualcuno dentro
  IF EXISTS (SELECT 1 FROM sys.sys_organization_units ou
              JOIN sys.sys_positions p ON p.position_organization_unit_id = ou.organization_unit_id
              JOIN sys.sys_user_position_assignments a
                ON a.user_position_assignment_position_id = p.position_id
               AND a.user_position_assignment_status = 'ACTIVE'
             WHERE NOT ou.organization_unit_is_active) THEN
    RAISE EXCEPTION 'Una unita sciolta contiene ancora persone attive';
  END IF;

  -- 3. nessuna unita attiva deve essere vuota
  IF EXISTS (
    SELECT 1 FROM sys.sys_organization_units ou
     WHERE ou.organization_unit_is_active
       AND NOT EXISTS (
         SELECT 1 FROM sys.sys_positions p
          JOIN sys.sys_user_position_assignments a
            ON a.user_position_assignment_position_id = p.position_id
           AND a.user_position_assignment_status = 'ACTIVE'
          WHERE p.position_organization_unit_id = ou.organization_unit_id)
       AND ou.organization_unit_type <> 'GENERAL_MANAGEMENT') THEN
    RAISE EXCEPTION 'Esistono unita attive senza nessuna persona';
  END IF;

  -- 4. IL VERDETTO: TUTTE le regole strutturali a zero violazioni, «persone attive
  --    senza posizione» compresa.
  --    ⚠️ EMENDATO S1049 (#139), e la domanda che questo commento lasciava aperta ha
  --    avuto risposta. Alla prima applicazione (S1043) la misura valeva 1:
  --    admin@heuresys.com, un'utenza di servizio del tenant Heuresys — e qui era scritto
  --    che «le sue funzioni dovevano passare a enzo.spenuso@heuresys.com». Il 2026-08-08
  --    Enzo ha deciso: quell'account non deve esistere, le sue funzioni sono sue. La
  --    `000295` gli trasferisce il mandato PLATFORM_ADMIN e rimuove l'account.
  --    L'attesa NON e' un numero fisso: e' «zero persone senza posizione, piu' l'utenza
  --    di servizio SE esiste ancora». Serve perche' questo file gira PRIMA della `000295`
  --    che la rimuove: alla prima applicazione della catena l'account c'e' ancora e le
  --    violazioni sono 1, dalla seconda in poi sono 0. Un numero fisso sarebbe giusto in
  --    uno dei due mondi e sbagliato nell'altro; una soglia larga (`<= 1`) sarebbe la
  --    tolleranza che l'autore aveva esplicitamente rifiutato. La forma corretta e'
  --    dedurre l'attesa dallo stato, e pretendere che chi manca sia ESATTAMENTE quello.
  SELECT count(*) INTO n_senza_pos FROM sys.sys_users u
   WHERE u.user_status = 'ACTIVE' AND u.user_email = 'admin@heuresys.com'
     AND NOT EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a
                      WHERE a.user_position_assignment_user_id = u.user_id
                        AND a.user_position_assignment_status = 'ACTIVE');

  FOR r IN SELECT * FROM sys.fn_organization_integrity_violations() LOOP
    IF r.regola = 'persone attive senza posizione' THEN
      IF r.violazioni <> n_senza_pos THEN
        RAISE EXCEPTION 'Persone attive senza posizione: attese % (l utenza di servizio, se esiste), trovate %',
                        n_senza_pos, r.violazioni;
      END IF;
    ELSIF r.violazioni <> 0 THEN
      RAISE EXCEPTION 'Regola non soddisfatta: «%» con % violazioni', r.regola, r.violazioni;
    END IF;
  END LOOP;

  SELECT count(*) INTO n_pos_attive FROM sys.sys_positions WHERE position_is_active;

  -- I numeri del messaggio si LEGGONO dalle variabili appena misurate. La stesura
  -- precedente ne aveva due scritti a mano («42 unita attive, 3 sciolte»), rimasti
  -- dalla versione in cui anche HS-PROD veniva sciolta: le asserzioni pretendevano
  -- 43 e 2 e passavano, mentre il messaggio ne raccontava altri. Un riepilogo che
  -- non deriva dalla misura puo' contraddirla senza che nulla fallisca.
  RAISE NOTICE 'RICOSTRUZIONE CHIUSA — % unita attive, % sciolte, % posizioni attive, % persone tutte collocate con una posizione ciascuna, regole strutturali a zero violazioni.',
               n_unita_attive, n_sciolte, n_pos_attive, n_attive;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICA FINALE DA ESEGUIRE A MANO
-- ═══════════════════════════════════════════════════════════════════════════════
--
--   SELECT * FROM sys.fn_organization_integrity_violations();
--   atteso: tutte le righe con violazioni = 0
--   Prima della ricostruzione: R1 condiviso 15 · R1 senza responsabile 11 ·
--   R2 esterno 14 · R4 riporti estranei 115 su 178 · R7 nome incoerente 12
--
--   E la prova che serviva dall'inizio — l'isolamento fra catene sorelle,
--   ora misurabile su un albero che dice la verita:
--   WITH RECURSIVE sub(id) AS (
--     SELECT organization_unit_id FROM sys.sys_organization_units
--      WHERE organization_unit_code = 'DIV-CRED'
--     UNION ALL
--     SELECT o.organization_unit_id FROM sys.sys_organization_units o JOIN sub ON o.organization_unit_parent_id = sub.id)
--   SELECT count(DISTINCT a.user_position_assignment_user_id)
--     FROM sub JOIN sys.sys_positions p ON p.position_organization_unit_id = sub.id
--     JOIN sys.sys_user_position_assignments a ON a.user_position_assignment_position_id = p.position_id
--      AND a.user_position_assignment_status = 'ACTIVE';
--   -- il perimetro del direttore dei Crediti: deve contenere solo la sua catena
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- BEGIN;
--   DROP INDEX IF EXISTS sys.ux_organization_unit_manager_unico;
--   DROP FUNCTION IF EXISTS sys.fn_organization_integrity_violations();
--   UPDATE sys.sys_organization_units
--      SET organization_unit_is_active = true, organization_unit_effective_to = NULL
--    WHERE organization_unit_code IN ('DIV-RISK','DIR-CORP','HS-PROD');
--   UPDATE sys.sys_positions SET position_is_active = true, position_effective_to = NULL
--    WHERE position_effective_to = CURRENT_DATE;
--   DELETE FROM sys.sys_user_position_assignments
--    WHERE user_position_assignment_notes LIKE '%fase 6): %';
--   UPDATE sys.sys_user_position_assignments
--      SET user_position_assignment_status='ACTIVE', user_position_assignment_end_date=NULL
--    WHERE user_position_assignment_notes LIKE '%fase 6): completamento%';
--   DELETE FROM sys.sys_positions WHERE position_code LIKE 'POS-%-9%';
-- COMMIT;
