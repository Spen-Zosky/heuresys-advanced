-- 000505_ordine_dei_gruppi_della_barra_laterale.sql
-- Enzo, 2026-11-21: la persona riordina i gruppi della barra laterale (maniglia + linea di
-- inserimento) e la scelta la segue su ogni login e su ogni dispositivo. L'ordine vive accanto
-- alle altre preferenze di interfaccia (tema, palette, lingua): server = fonte di verità.
--
-- user_preference_sidebar_order: elenco degli identificativi dei gruppi nell'ordine scelto.
-- NULL = nessuna scelta: la persona vede l'ordine standard del registro (migrazione 000484).
-- «Ripristina ordine standard» riporta il valore a NULL. Gli identificativi che il registro non
-- conosce più si scartano alla lettura, quelli nuovi si accodano: nessun dato da mantenere qui.
--
-- Additiva e senza effetto sulle righe esistenti (tutte NULL). IDEMPOTENTE.

ALTER TABLE sys.sys_user_preferences
  ADD COLUMN IF NOT EXISTS user_preference_sidebar_order jsonb NULL;

ALTER TABLE sys.sys_user_preferences
  DROP CONSTRAINT IF EXISTS sys_user_preferences_sidebar_order_check;
ALTER TABLE sys.sys_user_preferences
  ADD CONSTRAINT sys_user_preferences_sidebar_order_check
  CHECK (user_preference_sidebar_order IS NULL
         OR (jsonb_typeof(user_preference_sidebar_order) = 'array'
             AND jsonb_array_length(user_preference_sidebar_order) <= 40));

COMMENT ON COLUMN sys.sys_user_preferences.user_preference_sidebar_order IS
  'Ordine dei gruppi della barra laterale scelto dalla persona (array di id gruppo); NULL = ordine standard.';
