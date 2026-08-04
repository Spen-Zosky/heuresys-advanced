-- ═══════════════════════════════════════════════════════════════════════════════
-- 000258_reconnect_position_tree.sql
--
-- L'ALBERO DELLE POSIZIONI TORNA UN ALBERO SOLO.
--
-- Il difetto, e di chi e'
--   La ricostruzione (000244→000251) ha raddrizzato l'albero delle UNITA': la
--   funzione di verdetto risponde zero su tutte le regole. Ma la fase 6 disattiva
--   153 posizioni rimaste vacanti, e quattordici posizioni ATTIVE riportavano
--   proprio a quelle. Risultato misurato dopo l'applicazione: l'albero delle
--   POSIZIONI — che e' quello che il resolver gerarchico percorre — si e' spezzato
--   in **quindici tronconi**, e il perimetro della CEO e' passato da 157 persone
--   (secondo le unita) a **17** (secondo le posizioni).
--
--   Prima della ricostruzione quell'albero era SBAGLIATO: dava perimetri a chi non
--   aveva incarico. Adesso e' INTERROTTO: non li da' a chi ce l'ha. Il secondo
--   difetto e' peggiore del primo, perche' nega accessi legittimi.
--
--   La regola R4 non poteva vederlo: chiede che padre e figlio siano ENTRAMBI
--   attivi, quindi un riporto verso una posizione spenta non le risulta una
--   violazione — le risulta assente. E una posizione senza superiore non entra
--   nemmeno nella JOIN. Erano due punti ciechi, non due eccezioni.
--
-- Le quindici radici, guardate una per una
--   DUE sono legittime e restano: le posizioni apicali delle due sedi (`RTL` e
--   `HS-CORP`), che sono unita senza padre. Le altre TREDICI sono tutte
--   responsabili di un'unita il cui padre esiste — fra loro il `Direttore
--   Divisione Crediti` con diciotto posizioni sotto, cioe' un ramo intero staccato
--   dal vertice.
--
-- La regola, che e' una sola e vale per entrambi i casi
--   Una posizione attiva senza superiore utile — superiore assente OPPURE
--   disattivato — viene riagganciata:
--     · se chi la occupa NON dirige quell'unita  -> al comando della propria unita
--     · se chi la occupa LA dirige               -> al comando dell'unita PADRE,
--       risalendo finche' non si trova un antenato che un comando ce l'ha
--   Un'unita senza padre non ha dove risalire: la sua posizione apicale resta
--   radice, ed e' corretto che lo sia.
--
--   E' la stessa regola della sezione B-bis della 000251, estesa ai due casi che
--   non copriva. La differenza fra le due migrazioni non e' il criterio: e' che
--   allora guardavo solo i riporti fra posizioni entrambe vive.
--
-- Piu' il cancello che mancava: la funzione di verdetto guadagna R5, cosi' un
-- albero spezzato diventa un allarme invece di un silenzio.
--
-- Prerequisiti: 000251 applicata. Rieseguibile: agisce solo su cio' che e' rotto.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────────
-- 1. LE POSIZIONI SCOLLEGATE, E DOVE DEVONO RIATTACCARSI
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TEMP TABLE scollegate ON COMMIT DROP AS
WITH RECURSIVE rotte AS (
  SELECT p.position_id,
         p.position_organization_unit_id AS unita_id,
         ou.organization_unit_parent_id  AS padre_id,
         ou.organization_unit_manager_user_id AS capo_unita,
         a.user_position_assignment_user_id   AS titolare
    FROM sys.sys_positions p
    JOIN sys.sys_organization_units ou ON ou.organization_unit_id = p.position_organization_unit_id
    LEFT JOIN sys.sys_positions s ON s.position_id = p.position_reports_to_position_id
    LEFT JOIN sys.sys_user_position_assignments a
           ON a.user_position_assignment_position_id = p.position_id
          AND a.user_position_assignment_status = 'ACTIVE'
   WHERE p.position_is_active
     -- il superiore manca del tutto, oppure c'e' ma e' spento
     AND (p.position_reports_to_position_id IS NULL OR s.position_is_active = false)
     -- un'unita senza padre non ha dove risalire: la sua apicale resta radice
     AND ou.organization_unit_parent_id IS NOT NULL
),
-- risalita: dal padre in su, fino al primo antenato che ha una posizione di comando attiva
antenati AS (
  -- La risalita si calcola per TUTTE le posizioni rotte, non solo per i capi. Chi non
  -- e' capo normalmente si aggancia al comando della propria unita, ma due direzioni
  -- (Sviluppo Software e Infrastrutture) un comando non ce l'hanno: senza questa
  -- riserva la catena finiva a NULL e quattro riporti restavano rotti. Misurato
  -- applicando, non previsto.
  SELECT r.position_id, r.padre_id AS nodo_id, 0 AS salti
    FROM rotte r
  UNION ALL
  SELECT a.position_id, ou.organization_unit_parent_id, a.salti + 1
    FROM antenati a
    JOIN sys.sys_organization_units ou ON ou.organization_unit_id = a.nodo_id
   WHERE a.salti < 10
     AND ou.organization_unit_parent_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM sys.sys_positions c
                      WHERE c.position_organization_unit_id = a.nodo_id
                        AND c.position_code LIKE 'POS-CMD-%' AND c.position_is_active)
)
SELECT r.position_id,
       COALESCE(
         -- non e' il capo dell'unita: sale al comando della propria unita
         CASE WHEN r.titolare IS DISTINCT FROM r.capo_unita THEN (
           SELECT c.position_id FROM sys.sys_positions c
            WHERE c.position_organization_unit_id = r.unita_id
              AND c.position_code LIKE 'POS-CMD-%' AND c.position_is_active LIMIT 1)
         END,
         -- non e' il capo e la sua unita non ha una posizione di comando: allora
         -- sale a chi quell'unita la dirige, sulla posizione che occupa davvero
         CASE WHEN r.titolare IS DISTINCT FROM r.capo_unita THEN (
           SELECT a3.user_position_assignment_position_id
             FROM sys.sys_user_position_assignments a3
            WHERE a3.user_position_assignment_user_id = r.capo_unita
              AND a3.user_position_assignment_status = 'ACTIVE'
              AND a3.user_position_assignment_position_id <> r.position_id LIMIT 1)
         END,
         -- e' il capo: sale al comando del primo antenato che ne ha uno
         (SELECT c.position_id
            FROM antenati an
            JOIN sys.sys_positions c ON c.position_organization_unit_id = an.nodo_id
           WHERE an.position_id = r.position_id
             AND c.position_code LIKE 'POS-CMD-%' AND c.position_is_active
           ORDER BY an.salti LIMIT 1),
         -- ultimo appiglio: la posizione attiva di chi dirige l'antenato
         (SELECT a2.user_position_assignment_position_id
            FROM antenati an
            JOIN sys.sys_organization_units pu ON pu.organization_unit_id = an.nodo_id
            JOIN sys.sys_user_position_assignments a2
              ON a2.user_position_assignment_user_id = pu.organization_unit_manager_user_id
             AND a2.user_position_assignment_status = 'ACTIVE'
           WHERE an.position_id = r.position_id
           ORDER BY an.salti LIMIT 1)
       ) AS nuovo_superiore_id
  FROM rotte r;

UPDATE sys.sys_positions p
   SET position_reports_to_position_id = s.nuovo_superiore_id,
       updated_at                      = now()
  FROM scollegate s
 WHERE p.position_id = s.position_id
   AND s.nuovo_superiore_id IS NOT NULL
   AND s.nuovo_superiore_id <> p.position_id
   AND p.position_reports_to_position_id IS DISTINCT FROM s.nuovo_superiore_id;

-- ───────────────────────────────────────────────────────────────────────────────
-- 2. IL CANCELLO CHE MANCAVA — R5 nella funzione di verdetto
-- ───────────────────────────────────────────────────────────────────────────────
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
  SELECT 'persone attive senza posizione',
         count(*) FROM sys.sys_users u
         WHERE u.user_status = 'ACTIVE'
           AND NOT EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a
                            WHERE a.user_position_assignment_user_id = u.user_id
                              AND a.user_position_assignment_status = 'ACTIVE');
$$;

COMMENT ON FUNCTION sys.fn_organization_integrity_violations() IS
  'Verdetto sull integrita dell organigramma: una riga per regola col numero di violazioni aperte. R5 aggiunta in 000258 dopo che un albero spezzato in 15 tronconi era passato inosservato a tutte le altre. Cablata in db_health.py come sonda permanente.';

-- ───────────────────────────────────────────────────────────────────────────────
-- 3. AUTO-VERIFICA
-- ───────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  n_radici int; n_spenti int; n_r5 bigint; n_perimetro_ceo int; n_attive int;
BEGIN
  -- le radici legittime sono ESATTAMENTE le posizioni apicali delle unita senza padre
  SELECT count(*) INTO n_radici FROM sys.sys_positions p
    JOIN sys.sys_organization_units ou ON ou.organization_unit_id = p.position_organization_unit_id
   WHERE p.position_is_active AND p.position_reports_to_position_id IS NULL
     AND ou.organization_unit_parent_id IS NOT NULL;
  IF n_radici <> 0 THEN
    RAISE EXCEPTION 'Restano % posizioni senza superiore in unita che un padre ce lhanno', n_radici;
  END IF;

  SELECT count(*) INTO n_spenti FROM sys.sys_positions f
    JOIN sys.sys_positions s ON s.position_id = f.position_reports_to_position_id
   WHERE f.position_is_active AND NOT s.position_is_active;
  IF n_spenti <> 0 THEN
    RAISE EXCEPTION 'Restano % riporti verso una posizione disattivata', n_spenti;
  END IF;

  SELECT violazioni INTO n_r5 FROM sys.fn_organization_integrity_violations()
   WHERE regola = 'R5 albero delle posizioni spezzato';
  IF n_r5 <> 0 THEN RAISE EXCEPTION 'R5 non e a zero: %', n_r5; END IF;

  -- LA PROVA CHE CONTA, e non e un conteggio di righe: il perimetro della CEO
  -- secondo l'albero delle POSIZIONI deve tornare a coprire quasi tutta la banca.
  -- Prima di questa migrazione erano 17 persone su 157.
  WITH RECURSIVE sotto(pid) AS (
    SELECT p.position_id FROM sys.sys_positions p
      JOIN sys.sys_organization_units ou ON ou.organization_unit_id = p.position_organization_unit_id
     WHERE p.position_is_active AND p.position_reports_to_position_id IS NULL
       AND ou.organization_unit_code = 'RTL'
    UNION ALL
    SELECT c.position_id FROM sys.sys_positions c
      JOIN sotto ON c.position_reports_to_position_id = sotto.pid
     WHERE c.position_is_active)
  SELECT count(DISTINCT a.user_position_assignment_user_id) INTO n_perimetro_ceo
    FROM sotto
    JOIN sys.sys_user_position_assignments a ON a.user_position_assignment_position_id = sotto.pid
     AND a.user_position_assignment_status = 'ACTIVE';
  IF n_perimetro_ceo < 150 THEN
    RAISE EXCEPTION 'Perimetro della CEO sullalbero delle posizioni: % persone, attese almeno 150', n_perimetro_ceo;
  END IF;

  -- e nessuno si e perso per strada
  SELECT count(*) INTO n_attive FROM sys.sys_user_position_assignments
   WHERE user_position_assignment_status = 'ACTIVE';
  IF n_attive <> 161 THEN
    RAISE EXCEPTION 'Assegnazioni attive: attese 161, trovate %', n_attive;
  END IF;

  RAISE NOTICE 'ALBERO RICONNESSO — nessuna posizione orfana, nessun riporto verso una posizione spenta, il perimetro della CEO torna a % persone (erano 17), R5 a zero.', n_perimetro_ceo;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICHE DA ESEGUIRE A MANO DOPO L'APPLICAZIONE
-- ═══════════════════════════════════════════════════════════════════════════════
--
--   SELECT * FROM sys.fn_organization_integrity_violations();   -- R5 fra le righe, a 0
--   python tools/verifica_incrociata.py --famiglia X10          -- X10d e X10e a zero
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════════
--   I riporti precedenti puntavano a posizioni disattivate o non esistevano: il
--   ritorno allo stato di partenza e' lo snapshot pre-migrazione, non uno script.
--   La funzione si riporta indietro ricreandola senza il ramo R5.
