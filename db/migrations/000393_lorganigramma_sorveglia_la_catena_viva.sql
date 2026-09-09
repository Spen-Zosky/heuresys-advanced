-- 000393 — B10: fn_organization_integrity_violations sorvegliava un binario morto.
--
-- IL FATTO (istruttoria SINTESI_catene_e_peso_persona_20260909.md, C4): l'albero
-- organizzativo e' sano — nessun ciclo, nessun orfano. Ma due delle otto regole della
-- funzione (R4 "riporto verso unita' estranea", R5 "albero delle posizioni spezzato")
-- leggevano `sys_positions.position_reports_to_position_id`: l'asse RITIRATO il 2026-08-14
-- (#99 F3, mig. verso l'albero delle UNITA' — `organization_unit_parent_id` +
-- `organization_unit_manager_user_id` — CLAUDE.md I16). Misurato: quella colonna e' ferma
-- al 2026-08-27, mentre `sys_organization_units` e' vivo. Le altre sei regole (R1, R2, R6,
-- R7, "responsabile condiviso"...) leggono gia' `sys.v_organization_unit_integrity`, che e'
-- sull'asse giusto: solo R4/R5 erano rimaste indietro.
--
-- COSA CAMBIA:
--   · R5 diventa "albero delle UNITA' spezzato": rileva un ciclo (una unita' che e' antenata
--     di se stessa risalendo i genitori) o un parent_id che punta a una unita' SPENTA. La FK
--     su organization_unit_parent_id impedisce un parent inesistente, ma non un ciclo ne' un
--     parent disattivato: e' un controllo che oggi non esiste, non un doppione.
--   · R4 e' RITIRATA: il suo dominio (un responsabile che sta fuori dalla propria unita') e'
--     gia' coperto da R2 (`responsabile_esterno`, sull'asse vivo). Non aveva un analogo
--     pulito sull'albero delle unita' che non fosse un doppione di R2.
--
-- Le altre sei regole non cambiano.

\set ON_ERROR_STOP on

BEGIN;

CREATE OR REPLACE FUNCTION sys.fn_organization_integrity_violations()
RETURNS TABLE(regola text, violazioni bigint)
LANGUAGE sql
STABLE
AS $function$
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
  -- R5 (000393, B10) — la CATENA VIVA: un'unita' attiva il cui genitore non esiste piu'
  -- attivo, o che e' antenata di se stessa. `profondita < 50` e' una guardia contro un
  -- ciclo che farebbe girare la ricorsione all'infinito: 43 unita' attive oggi, un albero
  -- vero non supera mai quella profondita', un ciclo si' (risale all'infinito) ed e'
  -- proprio quello che deve far scattare la regola.
  SELECT 'R5 albero delle unita spezzato',
         count(*) FROM sys.sys_organization_units ou
        WHERE ou.organization_unit_is_active
          AND ou.organization_unit_parent_id IS NOT NULL
          AND (
            NOT EXISTS (SELECT 1 FROM sys.sys_organization_units p
                         WHERE p.organization_unit_id = ou.organization_unit_parent_id
                           AND p.organization_unit_is_active)
            OR EXISTS (
              WITH RECURSIVE risali AS (
                SELECT organization_unit_parent_id AS uid, 1 AS profondita
                  FROM sys.sys_organization_units WHERE organization_unit_id = ou.organization_unit_id
                UNION ALL
                SELECT p.organization_unit_parent_id, r.profondita + 1
                  FROM risali r JOIN sys.sys_organization_units p ON p.organization_unit_id = r.uid
                 WHERE r.profondita < 50 AND r.uid IS NOT NULL
              )
              SELECT 1 FROM risali WHERE uid = ou.organization_unit_id
            )
          )
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
$function$;

COMMENT ON FUNCTION sys.fn_organization_integrity_violations() IS
  'Otto regole di integrita'' dell''organigramma, tutte sull''asse VIVO (sys_organization_units:
   organization_unit_parent_id + organization_unit_manager_user_id — I16). R4 (posizione-a-
   posizione, asse ritirato il 2026-08-14) e'' stata ritirata in mig. 000393 (B10): il suo
   dominio e'' coperto da R2. Zero righe attese.';

COMMIT;
