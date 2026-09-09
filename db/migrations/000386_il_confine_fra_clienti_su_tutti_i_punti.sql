-- =====================================================================================
-- T3 — La sentinella del confine fra clienti, su tutti i punti invece che su uno
--
-- IL FATTO (misurato 2026-09-09):
--   sys.v_tenant_boundary_violations esiste, da' zero, e si chiama "violazioni del confine
--   fra clienti". Guarda UNA tabella: sys_user_position_assignments.
--   I punti in cui il confine puo' rompersi — una riga del cliente A che punta a una riga
--   del cliente B — sono 352, distribuiti su 146 tabelle.
--
--   Eseguito il controllo mancante su tutti e 352: 22 punti hanno righe fuori confine.
--   19 sono colonne d'autore (created_by, updated_by, approvatore, verificatore): dati del
--   cliente creati dall'amministratore di piattaforma, LEGITTIMO per disegno.
--   3 sono veri: 3.744 eventi di accesso, 1 feedback, 1 azione di chiusura lacuna.
--
-- QUESTO FILE NON CANCELLA E NON SOSTITUISCE la vista esistente: la affianca. La vecchia
-- resta dov'e' finche' Enzo non decide diversamente.
--
-- REGOLA 5 — le prove devono poter fallire: in fondo c'e' la prova a esiti opposti, che
-- inserisce una violazione dentro una transazione, verifica che la sentinella la veda, e
-- annulla tutto. Un controllo che non si e' mai visto rosso non e' un controllo.
-- =====================================================================================

\set ON_ERROR_STOP on

BEGIN;

-- -------------------------------------------------------------------------------------
-- 1. Le colonne d'autore: chi ha SCRITTO il dato, non di chi il dato parla.
--    Un created_by che punta a un utente di un altro cliente e' l'amministratore di
--    piattaforma al lavoro: e' atteso, e non va segnalato. Sta in una tabella e non in una
--    espressione regolare sepolta nel codice, cosi' si puo' correggere senza toccare la
--    funzione, e si vede cosa la sentinella sta ignorando.
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_tenant_boundary_author_columns (
  author_column_name  text PRIMARY KEY,
  author_column_note  text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

INSERT INTO sys.sys_tenant_boundary_author_columns (author_column_name, author_column_note)
VALUES
  ('created_by',                   'autore della riga'),
  ('updated_by',                   'ultimo modificatore'),
  ('deleted_by',                   'chi ha cancellato'),
  ('user_skill_verified_by_user_id','chi ha verificato la competenza'),
  ('request_approver_user_id',     'chi approva la richiesta'),
  ('approval_step_approver_user_id','approvatore del passo'),
  ('approval_step_decided_by',     'chi ha deciso il passo'),
  ('review_reviewer_user_id',      'chi conduce la valutazione'),
  ('response_reviewer_user_id',    'chi risponde come revisore')
ON CONFLICT (author_column_name) DO NOTHING;

-- -------------------------------------------------------------------------------------
-- 2. La funzione. Scopre da sola i punti da controllare leggendo le chiavi esterne:
--    non ha un elenco scritto a mano che invecchia a ogni migrazione.
--    Ritorna UNA RIGA PER PUNTO ROTTO, non un booleano: una sentinella che dice solo
--    "verde/rosso" non permette di riparare.
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sys.fn_tenant_boundary_violations_full()
RETURNS TABLE (
  tabella_figlia   text,
  colonna_legame   text,
  tabella_padre    text,
  righe_fuori      bigint
)
LANGUAGE plpgsql
STABLE
AS $fn$
DECLARE
  r     record;
  n     bigint;
  autori text[];
BEGIN
  SELECT array_agg(author_column_name) INTO autori
    FROM sys.sys_tenant_boundary_author_columns;
  autori := coalesce(autori, ARRAY[]::text[]);

  FOR r IN
    WITH tt AS (
      SELECT c.conrelid AS oid, a.attname AS tcol
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
       WHERE c.contype = 'f' AND c.confrelid = 'sys.sys_tenancies'::regclass
    )
    SELECT figlia.oid::regclass::text AS f_tab, figlia.tcol AS f_tcol,
           padre.oid::regclass::text  AS p_tab, padre.tcol  AS p_tcol,
           (SELECT a.attname FROM pg_attribute a
             WHERE a.attrelid = fk.conrelid  AND a.attnum = fk.conkey[1])  AS f_key,
           (SELECT a.attname FROM pg_attribute a
             WHERE a.attrelid = fk.confrelid AND a.attnum = fk.confkey[1]) AS p_key
      FROM pg_constraint fk
      JOIN tt figlia ON figlia.oid = fk.conrelid
      JOIN tt padre  ON padre.oid  = fk.confrelid
     WHERE fk.contype = 'f'
       AND fk.conrelid <> fk.confrelid
       AND array_length(fk.conkey, 1) = 1
  LOOP
    CONTINUE WHEN r.f_key = ANY(autori);

    EXECUTE format(
      'SELECT count(*) FROM %s f JOIN %s p ON p.%I = f.%I '
      ' WHERE f.%I IS NOT NULL AND p.%I IS NOT NULL AND f.%I <> p.%I',
      r.f_tab, r.p_tab, r.p_key, r.f_key, r.f_tcol, r.p_tcol, r.f_tcol, r.p_tcol)
    INTO n;

    IF n > 0 THEN
      tabella_figlia := r.f_tab;
      colonna_legame := r.f_key;
      tabella_padre  := r.p_tab;
      righe_fuori    := n;
      RETURN NEXT;
    END IF;
  END LOOP;
END
$fn$;

COMMENT ON FUNCTION sys.fn_tenant_boundary_violations_full() IS
  'Il confine fra clienti su TUTTI i punti in cui puo'' rompersi (352 al 2026-09-09), non '
  'sulla sola sys_user_position_assignments. Le colonne d''autore sono escluse tramite '
  'sys.sys_tenant_boundary_author_columns. Vedi la vista v_tenant_boundary_violations_full.';

CREATE OR REPLACE VIEW sys.v_tenant_boundary_violations_full AS
  SELECT * FROM sys.fn_tenant_boundary_violations_full();

COMMIT;

-- =====================================================================================
-- LA PROVA A ESITI OPPOSTI — la sentinella deve saper diventare rossa.
-- Si esegue a mano dopo l'installazione. Tutto dentro una transazione che finisce in
-- ROLLBACK: nessun dato viene modificato.
-- =====================================================================================
-- BEGIN;
--
-- -- (a) verde: si registra quanti punti sono rotti ADESSO
-- CREATE TEMP TABLE prova_prima AS SELECT * FROM sys.v_tenant_boundary_violations_full;
--
-- -- (b) si rompe il confine apposta: si sposta una posizione nell'altro cliente
-- UPDATE sys.sys_positions
--    SET position_tenant_id = (SELECT tenant_id FROM sys.sys_tenancies
--                               WHERE tenant_id <> position_tenant_id LIMIT 1)
--  WHERE position_id = (SELECT position_id FROM sys.sys_positions LIMIT 1);
--
-- -- (c) rosso atteso: la sentinella deve vedere ALMENO un punto in piu' di prima
-- DO $prova$
-- DECLARE prima int; dopo int;
-- BEGIN
--   SELECT count(*) INTO prima FROM prova_prima;
--   SELECT count(*) INTO dopo  FROM sys.v_tenant_boundary_violations_full;
--   IF dopo <= prima THEN
--     RAISE EXCEPTION 'LA PROVA NON SA FALLIRE: prima % punti, dopo aver rotto il confine %. '
--                     'Una sentinella che non diventa rossa non e'' una sentinella.', prima, dopo;
--   END IF;
--   RAISE NOTICE 'PROVA SUPERATA: da % punti rotti a %. La sentinella vede.', prima, dopo;
-- END
-- $prova$;
--
-- ROLLBACK;   -- OBBLIGATORIO: la prova non lascia traccia
