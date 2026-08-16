-- =============================================================================
-- 000318_vista_scostamento_competenze_critiche.sql
-- Tenant Builder P4 · T5 — E25: lo scostamento fra il profilo atteso e la persona
-- -----------------------------------------------------------------------------
-- E25 (Enzo, 2026-08-16): «la persona entra SEMPRE; e' la POSIZIONE a restare
-- segnalata». Il segnale e' informazione di governo — dove il modello dichiarato e
-- la realta' non coincidono — non un'accusa a chi occupa il posto.
--
-- PERCHE' UNA VISTA E NON UNA COLONNA. Lo scostamento cambia ogni volta che una
-- persona acquisisce una competenza o che la posizione cambia requisiti: scritto,
-- sarebbe falso il giorno dopo, e chi lo rilegge non avrebbe modo di accorgersene
-- (⭐ PUNTO FISSO). E c'e' l'invariante che lo impone: I9 / ADR-0008 — il Position
-- Intelligence Profile e' una vista, mai un blob.
--
-- LA REGOLA DELL'UNIVERSO, che e' il motivo per cui la colonna `cieca` esiste.
-- Su un'azienda appena costruita da un fascicolo quasi nessuna posizione avra'
-- requisiti critici. Una vista che restituisse solo le posizioni con scostamento
-- direbbe «tutto a posto» quando la verita' e' «non c'era niente da controllare».
-- Sono due cose diverse: qui una posizione occupata SENZA requisiti critici compare
-- lo stesso, con `cieca = true` e `requisiti_critici_attesi = 0`. Chi legge la vista
-- deve poter distinguere il vuoto dal cieco.
--
-- ⚠ NON E' UNA SENTINELLA, e va detto qui perche' il nome `v_*` suggerisce il
-- contrario. `db_health.py` scopre le viste `sys.v_*` DINAMICAMENTE da pg_views e
-- pretende che diano zero righe; questa per progetto ne restituisce (60 persone con
-- scostamento su RTL, misurate). E' dichiarata fra le INFORMATIVE di db_health.py
-- col suo motivo, come `v_pip_completeness`. Senza quella riga il cruscotto
-- diventerebbe rosso su un dato sano — e un allarme che suona sul sano insegna a
-- non guardarlo (#194).
--
-- Idempotente: CREATE OR REPLACE VIEW.
-- =============================================================================

CREATE OR REPLACE VIEW sys.v_positions_with_critical_skill_gap AS
WITH occupate AS (
    -- L'occupante e' quello PRIMARY e ATTIVO: un incarico secondario non definisce
    -- il profilo atteso della persona.
    SELECT a.user_position_assignment_position_id AS position_id,
           a.user_position_assignment_user_id     AS user_id,
           a.user_position_assignment_tenant_id   AS tenant_id
      FROM sys.sys_user_position_assignments a
     WHERE a.user_position_assignment_status = 'ACTIVE'
       AND a.user_position_assignment_kind   = 'PRIMARY'
),
critici AS (
    SELECT r.position_id, r.skill_id
      FROM sys.sys_position_skill_requirements r
     WHERE r.criticality = 'CRITICAL'
)
SELECT o.position_id,
       p.position_code,
       p.position_title,
       o.tenant_id,
       p.position_organization_unit_id                       AS organization_unit_id,
       ou.organization_unit_name,
       o.user_id,
       u.user_email,
       count(c.skill_id)                                     AS requisiti_critici_attesi,
       count(c.skill_id) FILTER (WHERE us.user_skill_id IS NULL) AS requisiti_critici_mancanti,
       -- L'elenco di CIO' CHE MANCA, non solo quanti: un numero senza i nomi non
       -- si puo' usare per decidere che cosa fare.
       coalesce(
         array_agg(s.skill_name ORDER BY s.skill_name)
           FILTER (WHERE us.user_skill_id IS NULL),
         ARRAY[]::text[]
       )                                                     AS competenze_mancanti,
       (count(c.skill_id) = 0)                               AS cieca
  FROM occupate o
  JOIN sys.sys_positions p            ON p.position_id = o.position_id
                                     AND p.position_is_active = true
  JOIN sys.sys_users u                ON u.user_id = o.user_id
  LEFT JOIN sys.sys_organization_units ou ON ou.organization_unit_id = p.position_organization_unit_id
  LEFT JOIN critici c                 ON c.position_id = o.position_id
  LEFT JOIN sys.sys_skills s          ON s.skill_id = c.skill_id
  LEFT JOIN sys.sys_user_skills us    ON us.user_skill_user_id  = o.user_id
                                     AND us.user_skill_skill_id = c.skill_id
 GROUP BY o.position_id, p.position_code, p.position_title, o.tenant_id,
          p.position_organization_unit_id, ou.organization_unit_name,
          o.user_id, u.user_email;

COMMENT ON VIEW sys.v_positions_with_critical_skill_gap IS
  'E25 / Tenant Builder P4 T5 — scostamento fra i requisiti CRITICAL di una posizione '
  'e le competenze del suo occupante PRIMARY attivo. NON e'' una sentinella: restituisce '
  'righe per progetto. `cieca = true` quando la posizione non ha requisiti critici, cioe'' '
  'quando non c''era niente da controllare — da non confondere con «nessuno scostamento».';

-- -----------------------------------------------------------------------------
-- POST-CONDIZIONI. Non provano che i numeri siano «giusti» (cambiano coi dati):
-- provano che la vista MISURA, invece di rispondere sempre la stessa cosa.
-- Una vista che restituisse zero righe, o che non distinguesse mai il cieco dal
-- pieno, e' rotta — e queste due guardie lo dicono subito, non fra sei mesi.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    n_righe   bigint;
    n_cieche  bigint;
    n_scost   bigint;
BEGIN
    SELECT count(*),
           count(*) FILTER (WHERE cieca),
           count(*) FILTER (WHERE requisiti_critici_mancanti > 0)
      INTO n_righe, n_cieche, n_scost
      FROM sys.v_positions_with_critical_skill_gap;

    IF n_righe = 0 THEN
        RAISE EXCEPTION 'v_positions_with_critical_skill_gap: ZERO righe. Nessuna posizione occupata? La vista non sta misurando (000318)';
    END IF;

    -- Se ogni riga fosse cieca, la giunzione sui requisiti non sta agganciando nulla.
    IF n_cieche = n_righe THEN
        RAISE EXCEPTION 'v_positions_with_critical_skill_gap: TUTTE le % righe sono cieche: la giunzione sui requisiti CRITICAL non aggancia (000318)', n_righe;
    END IF;

    RAISE NOTICE 'v_positions_with_critical_skill_gap: % righe · % cieche · % con scostamento', n_righe, n_cieche, n_scost;
END $$;
