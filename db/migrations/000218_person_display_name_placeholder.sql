-- ============================================================================
-- 000218 — il nome visualizzato di una persona deve essere il suo nome (#81)
--
-- Trovato aprendo la scheda che il #81 doveva sistemare: il titolo della pagina
-- diceva `IT_ME_FFDEECF5-name`. Non un difetto della pagina — il dato: un
-- residuo dell'impalcatura di test pre-D-52, sopravvissuto alla bonifica dei
-- residui `IT_TI_*` (mig 000200) perche' apparteneva a un'altra famiglia di
-- prefissi. Una sola riga, ma su una persona che compare in ogni dimostrazione.
--
-- La riparazione NON inventa: ricompone il nome da nome+cognome, che erano
-- corretti. Tocca solo le righe che portano ANCORA il segnaposto, quindi e'
-- idempotente e non puo' sovrascrivere un nome scelto da qualcuno.
-- ============================================================================

UPDATE sys.sys_users
   SET user_display_name = trim(user_first_name || ' ' || user_last_name),
       updated_at = now()
 WHERE user_display_name ~ '^IT_[A-Z]{2}_[0-9A-F]{8}'
   AND user_first_name IS NOT NULL
   AND user_last_name IS NOT NULL;

-- Post-condizione fail-loud: nessuna persona con un nome da impalcatura.
-- E' una PROPRIETA' — vale anche per i residui che non abbiamo ancora visto,
-- non solo per quello di oggi.
DO $$
DECLARE
  v_bad bigint;
  v_sample text;
BEGIN
  SELECT count(*), min(user_email) INTO v_bad, v_sample
    FROM sys.sys_users
   WHERE user_display_name ~ '^IT_[A-Z]{2}_[0-9A-F]{8}';
  IF v_bad > 0 THEN
    RAISE EXCEPTION
      'mig 000218: % persone hanno ancora un nome da impalcatura di test (es. %) — hanno nome/cognome?',
      v_bad, v_sample;
  END IF;
END $$;
