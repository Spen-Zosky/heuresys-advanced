-- ═══════════════════════════════════════════════════════════════════════════════
-- 000288_reviews_reviewer_is_the_line_manager.sql
--
-- #167 / `C2c` — CHI TI VALUTA È IL TUO RESPONSABILE, NON UN COLLEGA A CASO.
--
-- IL TRIAGE (skill `storia36-custodia`: ogni rosso si classifica PRIMA di toccare).
-- Esito: **(c) rottura vera**, non «(b) controllo troppo rigido». Ecco come si è
-- deciso, perché la prima ipotesi era sbagliata e va detto:
--
--   · IPOTESI INIZIALE, SCARTATA — «le valutazioni puntano al responsabile di PRIMA
--     del riordino di agosto». Misurato: lo scostamento è **~90% in OGNI anno**
--     (2023: 139/153 · 2024: 144/158 · 2025: 144/158 · 2026: 66/79). Se la causa
--     fosse il riordino, le valutazioni recenti combacerebbero. Non è il riordino.
--   · IL CONTROLLO FUNZIONA — la derivazione del responsabile dall'albero delle
--     posizioni risolve per **157 soggetti su 158**. Non è un check che non sa
--     leggere la gerarchia.
--   · IL FATTO NON È COERENTE — fra i revisori più prolifici ci sono persone che
--     **non guidano nessuno**: 25 valutazioni firmate con 0 riporti, 24 con 0, 23
--     con 0, 22 con 0. Le firme sono sparse su 29 persone senza rapporto con la
--     gerarchia: sono state assegnate a caso al momento della costruzione.
--
-- COSA SI CORREGGE. Il revisore di ogni valutazione diventa il responsabile
-- gerarchico del soggetto (catena `reports_to` sull'assegnazione PRIMARY/ACTIVE) —
-- cioè esattamente la proprietà che `C2c` dichiara. Al vertice la catena non ha un
-- sopra: le 3 valutazioni di `federica.marchetti` (CEO) restano firmate da
-- `admin@heuresys.com`, che è la deroga già prevista dal controllo e l'unico caso di
-- revisore fuori dal tenant.
--
-- QUALE GERARCHIA, E PERCHÉ QUESTA. Si usa quella di **oggi**, anche per le
-- valutazioni del 2023. Non è una scorciatoia: le posizioni **non hanno storia**
-- registrata (l'unica storia organizzativa è quella delle unità, mig `000280`),
-- quindi la gerarchia di allora non esiste da nessuna parte. E questa è una storia
-- **costruita** a scopo dimostrativo: non c'è un passato da rispettare, c'è una
-- coerenza da ottenere. Fra «il tuo valutatore è il tuo responsabile» e «il tuo
-- valutatore è un collega estratto a sorte», la prima è l'unica difendibile.
--
-- REVERSIBILE. Le firme precedenti si conservano in `staging.storia36_167_undo`
-- prima di essere sovrascritte, e `staging.storia36_167_rollback()` le rimette a
-- posto — stesso schema dei giornali di `#155` e `#160`.
--
-- Idempotente: alla seconda esecuzione non c'è più niente da correggere e il
-- giornale non si duplica.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS staging.storia36_167_undo (
  review_id          uuid PRIMARY KEY,
  reviewer_precedente uuid,
  salvato_il         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE staging.storia36_167_undo IS
  '#167 — firme dei revisori PRIMA della correzione della mig 000288. Serve a rendere '
  'reversibile una riscrittura di massa: si ripristina con staging.storia36_167_rollback().';

DO $mig$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_admin uuid;
  v_prima bigint;
  v_dopo  bigint;
  v_upd   bigint;
BEGIN
  SELECT user_id INTO v_admin FROM sys.sys_users WHERE user_email = 'admin@heuresys.com';
  IF v_admin IS NULL THEN
    RAISE EXCEPTION '000288: manca il revisore di deroga per il vertice (admin@heuresys.com)';
  END IF;

  -- Il bersaglio, calcolato una volta: e' LA STESSA espressione che usa C2c, per
  -- costruzione. Se divergessero, si correggerebbe il dato verso un criterio diverso
  -- da quello che il controllo misura — e il rosso resterebbe.
  CREATE TEMP TABLE bersaglio ON COMMIT DROP AS
  SELECT r.review_id,
         r.review_reviewer_user_id AS attuale,
         COALESCE(
           NULLIF((SELECT a2.user_position_assignment_user_id
                     FROM sys.sys_user_position_assignments a1
                     JOIN sys.sys_positions p1 ON p1.position_id = a1.user_position_assignment_position_id
                     JOIN sys.sys_user_position_assignments a2
                       ON a2.user_position_assignment_position_id = p1.position_reports_to_position_id
                      AND a2.user_position_assignment_kind = 'PRIMARY'
                      AND a2.user_position_assignment_status = 'ACTIVE'
                    WHERE a1.user_position_assignment_user_id = r.review_subject_user_id
                      AND a1.user_position_assignment_kind = 'PRIMARY'
                      AND a1.user_position_assignment_status = 'ACTIVE'
                    LIMIT 1), r.review_subject_user_id),
           v_admin) AS corretto
    FROM sys.sys_performance_reviews r
   WHERE r.review_tenant_id = c_rtl AND r.review_subject_user_id IS NOT NULL;

  SELECT count(*) INTO v_prima FROM bersaglio WHERE attuale IS DISTINCT FROM corretto;

  -- Il giornale PRIMA della scrittura: se si salvasse dopo, si conserverebbe il
  -- valore nuovo e il rollback riporterebbe allo stato che si voleva annullare.
  INSERT INTO staging.storia36_167_undo (review_id, reviewer_precedente)
  SELECT b.review_id, b.attuale FROM bersaglio b
   WHERE b.attuale IS DISTINCT FROM b.corretto
  ON CONFLICT (review_id) DO NOTHING;

  UPDATE sys.sys_performance_reviews r
     SET review_reviewer_user_id = b.corretto,
         updated_at = now()
    FROM bersaglio b
   WHERE b.review_id = r.review_id
     AND b.attuale IS DISTINCT FROM b.corretto;
  GET DIAGNOSTICS v_upd = ROW_COUNT;

  SELECT count(*) INTO v_dopo
    FROM sys.sys_performance_reviews r
    JOIN bersaglio b ON b.review_id = r.review_id
   WHERE r.review_reviewer_user_id IS DISTINCT FROM b.corretto;

  IF v_dopo > 0 THEN
    RAISE EXCEPTION '000288: restano % valutazioni con un revisore diverso dal responsabile', v_dopo;
  END IF;

  RAISE NOTICE '000288 done: % valutazioni riportate al responsabile gerarchico (scostamenti % -> 0); giornale di annullamento: % righe',
    v_upd, v_prima, (SELECT count(*) FROM staging.storia36_167_undo);
END $mig$;

-- Il rollback e' una FUNZIONE, non un commento: un annullamento che esiste solo come
-- istruzione da copiare a mano non e' un annullamento (stesso schema di #155 e #160).
CREATE OR REPLACE FUNCTION staging.storia36_167_rollback()
RETURNS TABLE(ripristinate bigint) LANGUAGE plpgsql AS $fn$
DECLARE v_n bigint;
BEGIN
  UPDATE sys.sys_performance_reviews r
     SET review_reviewer_user_id = u.reviewer_precedente, updated_at = now()
    FROM staging.storia36_167_undo u
   WHERE u.review_id = r.review_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN QUERY SELECT v_n;
END $fn$;

COMMIT;
