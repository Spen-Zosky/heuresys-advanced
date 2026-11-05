-- 000476_adr0050_d5_conferma_recente.sql
-- ADR-0050 D5 (2026-11-05): prima di leggere per mandato la retribuzione o le valutazioni di
-- un'altra persona, la sessione deve avere una verifica del secondo fattore recente.
--
-- L'ora dell'ultima verifica viaggia nell'access token firmato (claim `sua`), che la decisione
-- legge senza andare al database (`lib/scope/conferma.ts`, finestra di 15 minuti). Questa
-- colonna la tiene sulla sessione, cioè sulla famiglia dei token di rinnovo: la riga nasce con
-- l'ora quando il login è passato dal secondo fattore, la riceve quando la persona conferma di
-- nuovo (`POST /v1/auth/mfa/step-up/verify`), e il rinnovo la copia sulla riga nuova e nel
-- token nuovo. Un rinnovo non è una conferma: porta avanti l'ora che c'era.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS.
-- Rollback dichiarato: DROP COLUMN. Nessun dato esistente cambia: la colonna è
-- nuova e resta NULL sulle righe di prima, che quindi valgono come «da confermare».

BEGIN;

ALTER TABLE sys.sys_auth_refresh_tokens
  ADD COLUMN IF NOT EXISTS auth_refresh_token_step_up_at timestamptz;

COMMENT ON COLUMN sys.sys_auth_refresh_tokens.auth_refresh_token_step_up_at IS
  'ADR-0050 D5 (mig 000476): ora dell''ultima verifica del secondo fattore in questa sessione (famiglia). NULL = nessuna su questa riga; vale il massimo sulla famiglia.';

DO $post$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'sys' AND table_name = 'sys_auth_refresh_tokens'
                    AND column_name = 'auth_refresh_token_step_up_at'
                    AND data_type = 'timestamp with time zone') THEN
    RAISE EXCEPTION '000476: colonna auth_refresh_token_step_up_at assente';
  END IF;
  RAISE NOTICE '000476 ok — conferma recente del secondo fattore (D5)';
END;
$post$;

COMMIT;
