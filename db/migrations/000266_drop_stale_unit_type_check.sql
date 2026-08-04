-- ═══════════════════════════════════════════════════════════════════════════════
-- 000266_drop_stale_unit_type_check.sql
--
-- UN VINCOLO CHE DICE UNA COSA E NE FA UN'ALTRA.
--
-- Seguito immediato della 000265 (#122). Quella migrazione stringeva il `CHECK`
-- sul tipo di unita' per escludere `TEAM`, e il suo `DROP CONSTRAINT IF EXISTS`
-- ha SALTATO — il vincolo storico non si chiama
-- `sys_organization_units_organization_unit_type_check` (il nome che Postgres
-- avrebbe generato) ma **`sys_organization_units_type_chk`**, scritto a mano da
-- una migrazione precedente.
--
-- Effetto: due `CHECK` sovrapposti sulla stessa colonna. Il COMPORTAMENTO e'
-- corretto — devono passare entrambi, quindi `TEAM` viene rifiutato, e la prova
-- e' stata fatta (un UPDATE a `TEAM` su `HS-PROD` viene respinto). Ma il vincolo
-- vecchio continua a DICHIARARE `TEAM` fra i tipi ammessi, e chi legge lo schema
-- per capire quali tipi esistono legge la risposta sbagliata. Uno schema che si
-- contraddice e' una trappola per la prossima persona, non un dettaglio estetico.
--
-- Il vecchio se ne va; resta quello nuovo, che e' l'unico a dire il vero.
--
-- Rieseguibile. Prerequisiti: 000265 applicata.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE sys.sys_organization_units
  DROP CONSTRAINT IF EXISTS sys_organization_units_type_chk;

DO $$
DECLARE
  n_checks   int;
  ammette_team boolean;
BEGIN
  SELECT count(*) INTO n_checks
    FROM pg_constraint
   WHERE conrelid = 'sys.sys_organization_units'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%organization_unit_type%';
  IF n_checks <> 1 THEN
    RAISE EXCEPTION 'Attesi 1 CHECK sul tipo di unita, trovati %', n_checks;
  END IF;

  SELECT bool_or(pg_get_constraintdef(oid) LIKE '%''TEAM''%') INTO ammette_team
    FROM pg_constraint
   WHERE conrelid = 'sys.sys_organization_units'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%organization_unit_type%';
  IF ammette_team THEN
    RAISE EXCEPTION 'Il CHECK superstite ammette ancora TEAM';
  END IF;

  RAISE NOTICE 'OK — un solo CHECK sul tipo di unita, e non ammette TEAM.';
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK — ri-creare `sys_organization_units_type_chk` con la lista storica
-- (che includeva `TEAM`) solo se si intende riaprire il difetto di #122.
-- ═══════════════════════════════════════════════════════════════════════════════
