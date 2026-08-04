-- ═══════════════════════════════════════════════════════════════════════════════
-- 000267_hs_prod_becomes_a_division.sql
--
-- `HS-PROD` DIVENTA UNA DIVISIONE, PERCHE' `OFFICE` NON REGGEVA.
--
-- Correzione della 000265 (#122), e il motivo va scritto perche' e' istruttivo.
--
-- La consegna prescriveva `OFFICE` — «il tipo giusto per un'unita' di una
-- persona secondo la regola gia' applicata a RTL Bank». La 000265 ha obbedito, e
-- la tassonomia del progetto ha respinto la mossa su DUE regole sue, entrambe
-- gia' scritte nella `000244`:
--
--   R6 (annidamento) — `OFFICE` e' ammesso sotto `DEPARTMENT`, `BRANCH` o `AREA`.
--     `HS-PROD` pende direttamente dalla sede (`HEADQUARTERS`), e Heuresys non ha
--     nessuna di quelle tre: non esiste un padre legale per un ufficio.
--   R7 (nomenclatura) — il nome deve portare il prefisso del tipo. «Team Product
--     & Development» non e' un «Ufficio ».
--
-- La regola «Ufficio da due a cinque persone» presuppone una sotto-struttura che
-- su questo tenant non c'e'. Il tipo coerente e' `DIVISION`: e' ammesso sotto la
-- sede, ed e' esattamente cio' che e' gia' `HS-MGMT`, la sorella, con lo stesso
-- padre e anch'essa di una persona sola. Il nome segue il tipo.
--
-- COME SI E' VISTO: `migrate.sh` ri-applica l'intera catena a ogni esecuzione, e
-- la `000244` ri-verifica le proprie regole sullo stato CORRENTE. La 000265 ha
-- quindi fatto fallire una migrazione precedente al giro successivo — che e'
-- esattamente il comportamento voluto da chi quelle auto-verifiche le ha scritte.
-- La catena e' tornata verde solo con questa correzione.
--
-- Rieseguibile. Prerequisiti: 000265 applicata.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

UPDATE sys.sys_organization_units
   SET organization_unit_type = 'DIVISION',
       organization_unit_name = 'Divisione Product & Development',
       updated_at = now()
 WHERE organization_unit_code = 'HS-PROD'
   AND (organization_unit_type <> 'DIVISION'
        OR organization_unit_name <> 'Divisione Product & Development');

DO $$
DECLARE
  n_viola int;
  n_universo int;
BEGIN
  SELECT count(*) INTO n_universo FROM sys.v_organization_unit_integrity;
  IF n_universo = 0 THEN
    RAISE EXCEPTION 'La vista di integrita non ha righe: la verifica misurerebbe sul vuoto';
  END IF;

  SELECT count(*) INTO n_viola
    FROM sys.v_organization_unit_integrity
   WHERE viola_nomenclatura OR viola_annidamento;
  IF n_viola <> 0 THEN
    RAISE EXCEPTION 'Restano % unita che violano nomenclatura o annidamento (universo %)',
                    n_viola, n_universo;
  END IF;

  RAISE NOTICE 'OK — zero violazioni di nomenclatura e annidamento su universo %.', n_universo;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK — dallo snapshot pre-migrazione: il tipo e il nome precedenti non
-- sono conservati altrove.
-- ═══════════════════════════════════════════════════════════════════════════════
