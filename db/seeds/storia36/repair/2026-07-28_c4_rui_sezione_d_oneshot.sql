-- ============================================================================
-- storia36 C4 — riparazione one-shot: la sezione del RUI e' quella sbagliata.
--
-- Il dato RTL intitola l'abilitazione assicurativa «Iscrizione RUI - Sez. E
-- (Intermediari Assicurativi)». La sezione E del Registro Unico degli
-- Intermediari e' quella degli intermediari a titolo ACCESSORIO e dei loro
-- addetti: per essa il Reg. IVASS 40/2018 art. 89 prevede 15 ore annue di
-- aggiornamento, non 30. Le BANCHE — e i loro addetti alla distribuzione
-- assicurativa — sono iscritte alla sezione D, cui si applica il monte-ore
-- pieno di 30 ore.
--   fonte: https://www.fiass.it/regolamenti-ivass/regolamento-ivass-40-2-agosto-2018/
--   (docs/kb/storia36/DOMINIO_FORMAZIONE_OBBLIGATORIA.md §2)
--
-- RTL Bank e' una banca: tenere la sezione E significherebbe applicare a 30
-- persone un pavimento di 30 ore che la norma, per quella sezione, non impone —
-- cioe' fondare un controllo su una citazione che la fonte non sostiene.
-- Triage esito (c): rottura vera del dato, riparata qui.
--
-- La chiave naturale della tabella include il NOME, quindi la rinomina sposta la
-- riga di chiave: nessuna collisione perche' nessun utente possiede gia' una
-- riga di sezione D (verificato prima della scrittura).
--
-- Idempotente: alla seconda corsa non trova piu' righe di sezione E.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

BEGIN;

DO $$
DECLARE
  c_rtl    constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  c_vecchio constant text := 'Iscrizione RUI - Sez. E (Intermediari Assicurativi)';
  c_nuovo   constant text := 'Iscrizione RUI - Sez. D (Banche e intermediari finanziari)';
  v_coll   bigint;
  v_n      bigint;
BEGIN
  -- guardia: la rinomina non deve creare duplicati di chiave naturale
  SELECT count(*) INTO v_coll
    FROM sys.sys_user_certifications a
   WHERE a.user_certification_name = c_vecchio
     AND EXISTS (SELECT 1 FROM sys.sys_user_certifications b
                  WHERE b.user_certification_tenant_id = a.user_certification_tenant_id
                    AND b.user_certification_user_id   = a.user_certification_user_id
                    AND b.user_certification_name      = c_nuovo
                    AND b.user_certification_issuer    = a.user_certification_issuer
                    AND COALESCE(b.user_certification_issued_date, DATE '0001-01-01')
                      = COALESCE(a.user_certification_issued_date, DATE '0001-01-01'));
  IF v_coll > 0 THEN
    RAISE EXCEPTION 'rinomina RUI annullata: % collisioni di chiave naturale', v_coll;
  END IF;

  UPDATE sys.sys_user_certifications
     SET user_certification_name = c_nuovo,
         user_certification_metadata = user_certification_metadata
           || jsonb_build_object('storia36_repair', 'C4-sezione-rui',
                                 'nome_precedente', c_vecchio)
   WHERE user_certification_name = c_vecchio;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'storia36 C4 repair sezione RUI: % righe riportate alla sezione D', v_n;
END $$;

COMMIT;
