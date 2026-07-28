-- ============================================================================
-- storia36 C4 — riparazione one-shot: catene di rinnovo con scadenza che
-- REGREDISCE rispetto al titolo che sostituisce.
--
-- Misura al 2026-07-28 sul tenant RTL: 23 righe (ACAMS 10, AICOM 5, GARP 5,
-- CFA 3). È un difetto REALE del legacy, non del seed C4 — triage esito (c):
-- un rinnovo che scade prima del titolo rinnovato non è una certificazione,
-- è un errore di trascrizione, e rende falso qualunque calcolo di copertura.
--
-- Regola di riparazione DERIVATA dalla riga stessa (mai una durata inventata):
--   «un rinnovo estende la copertura almeno quanto ha spostato il rilascio»
--   nuova scadenza = scadenza precedente + (rilascio − rilascio precedente)
-- Le durate così ottenute restano dentro la banda osservata dello schema
-- (0,5–4,8 anni): vedi docs/kb/storia36/DOMINIO_FORMAZIONE_OBBLIGATORIA.md §6.3.
--
-- Il ciclo ripassa finché la catena non è monotona (una catena può avere più
-- righe rotte consecutive) e converge: ogni passata sana almeno la prima rottura
-- di ogni catena. Idempotente: alla seconda corsa trova 0 righe.
--
-- Perché sta in repair/ e non nel seed: `db/scripts/storia36.sh` esegue il glob
-- db/seeds/storia36/*.sql, che NON scende in repair/. La custodia non ripara mai
-- da sola righe modificate — è la regola del programma.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

BEGIN;

DO $$
DECLARE
  c_rtl  constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_n    bigint;
  v_tot  bigint := 0;
  v_pass int := 0;
BEGIN
  LOOP
    v_pass := v_pass + 1;

    WITH ch AS (
      SELECT c.user_certification_id AS cid,
             c.user_certification_expires_date AS d_exp,
             c.user_certification_issued_date  AS d_iss,
             lag(c.user_certification_expires_date) OVER w AS prev_exp,
             lag(c.user_certification_issued_date)  OVER w AS prev_iss
        FROM sys.sys_user_certifications c
       WHERE c.user_certification_tenant_id = c_rtl
       WINDOW w AS (PARTITION BY c.user_certification_user_id,
                                 c.user_certification_name,
                                 c.user_certification_issuer
                    ORDER BY c.user_certification_issued_date)
    ), bad AS (
      SELECT cid, (prev_exp + GREATEST(COALESCE(d_iss - prev_iss, 1), 1))::date AS fix_exp
        FROM ch
       WHERE prev_exp IS NOT NULL AND d_exp < prev_exp
    )
    UPDATE sys.sys_user_certifications c
       SET user_certification_expires_date = bad.fix_exp,
           user_certification_metadata = c.user_certification_metadata
             || jsonb_build_object('storia36_repair', 'C4-monotonia')
      FROM bad
     WHERE bad.cid = c.user_certification_id;

    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_tot := v_tot + v_n;
    EXIT WHEN v_n = 0 OR v_pass > 20;
  END LOOP;

  RAISE NOTICE 'storia36 C4 repair monotonia: % righe riparate in % passate', v_tot, v_pass;
END $$;

COMMIT;
