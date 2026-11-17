-- ============================================================================================
-- 000497 — Un solo modello di sondaggio: i dati di `sys_engagement_*` passano nel modello della
--          pagina «Clima e coinvolgimento» (voce 3c del piano
--          docs/piani/PIANO_endpoint-orfani-ondate_20261117.md, decisione del 2026-11-17).
--
-- IL PROBLEMA. Convivevano due modelli di sondaggio, entrambi popolati: il modulo `engagement`
-- (pagina /engagement) legge `sys_surveys`, `sys_survey_questions`, `sys_survey_responses`,
-- `sys_survey_templates`; il modulo `surveys`, senza pagina, scriveva `sys_engagement_surveys`,
-- `sys_engagement_survey_templates`, `sys_engagement_survey_responses`, con domande e risposte in
-- jsonb. Resta il primo; il secondo vi si trasferisce e poi si disattiva (le tabelle restano).
--
-- MISURATO PRIMA DI SCRIVERE (2026-11-17, database di produzione):
--   sys_engagement_surveys            6 sondaggi, tutti `closed`, un solo tenant (RTL)
--   domande jsonb                    30 (19 `rating` su scala 5, 5 `nps` su scala 10, 6 `text`)
--   sys_engagement_survey_responses 862 righe, 66 incomplete, tutte con la persona
--   risposte jsonb                4.112 (2.549 rating, 767 nps, 796 testo), tutte con una domanda
--                                       esistente e valori numerici interi
--   sys_engagement_survey_templates   5
--   nessuna sovrapposizione di chiavi naturali né di titoli con il modello che resta.
--
-- LE DUE SCELTE (coordinatore per Enzo, 2026-11-17):
--   ① nessun valore cambia: un 4 su 5 resta 4, e la domanda porta la sua scala in
--     `survey_question_options` ({"scale": 5} o {"scale": 10}).
--   ③ (scelta analoga, fatta qui) nel sondaggio sul benessere la domanda q4 è su scala 5, ma 117
--     delle sue 146 risposte sono scritte con la chiave `nps` e valori da 5 a 10: sono voti di
--     un'altra domanda (la q4 degli altri sondaggi è la domanda nps), finiti su questa. Non si
--     contano come voti della domanda: la riga c'è, il voto è vuoto, e il valore d'origine con la
--     sua chiave resta nel metadato (`valore_originale`, `anomalia`). Il lettore che le usava
--     (insights, fonte 1) le escludeva già. Le letture che fanno medie
--     riportano i voti alla stessa scala al momento della lettura, senza riscriverli;
--   ② i sondaggi trasferiti entrano come `archived`: sono la serie storica di un altro strumento.
--     Il quarto trimestre 2024 c'è in entrambi i modelli: non si fonde, si annota nel metadato.
--
-- CHIAVI. Ogni riga scritta porta una chiave naturale derivata dall'id d'origine, con il prefisso
-- `DA_ESURV::`, `DA_ESTMPL::`, `DA_ESRESP::`: rieseguire non duplica (ON CONFLICT DO NOTHING), e
-- finché il modulo `surveys` scrive ancora (si spegne nell'ondata 5) il deploy successivo porta ciò
-- che manca. Non è `@migrate: once` per questo: le guardie e le post-condizioni devono rigirare.
--
-- GIORNALE E RITORNO. Prima di scrivere, le chiavi nuove vanno in `staging.sondaggi_un_modello_undo`;
-- l'inversa fuori catena è db/scripts/sondaggi/inversa-000497.sql e cancella solo ciò che è nel
-- giornale, per chiave, tabella per tabella.
--
-- POST-CONDIZIONI (la migrazione si annulla se una manca):
--   · ciò che non doveva cambiare: le righe del modello che resta senza il prefisso, e le tre
--     tabelle d'origine, hanno lo stesso numero di prima;
--   · ciò che doveva: sondaggi, domande, risposte e modelli trasferiti sono quanti ne dice l'origine.
-- NESSUNA CANCELLAZIONE, nessun aggiornamento di righe esistenti.
-- ============================================================================================

CREATE TABLE IF NOT EXISTS staging.sondaggi_un_modello_undo (
  tabella      varchar(40) NOT NULL CHECK (tabella IN ('sys_surveys', 'sys_survey_questions',
                                                       'sys_survey_responses', 'sys_survey_templates')),
  natural_key  text        NOT NULL,
  tenant_id    uuid        NOT NULL,
  scritto_il   timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tabella, tenant_id, natural_key)
);

DO $$
DECLARE
  -- origine, misurata adesso (mai ereditata dalla misura di ieri)
  o_surv bigint; o_q bigint; o_ans bigint; o_tmpl bigint; o_resp bigint;
  -- il modello che resta, senza le righe trasferite: non deve cambiare
  r_surv bigint; r_q bigint; r_resp bigint; r_tmpl bigint;
  n bigint;
BEGIN
  IF to_regclass('sys.sys_engagement_surveys') IS NULL THEN
    RAISE NOTICE '000497: il modello vecchio non esiste in questo database, niente da trasferire';
    RETURN;
  END IF;

  SELECT count(*) INTO o_surv FROM sys.sys_engagement_surveys;
  SELECT count(*) INTO o_tmpl FROM sys.sys_engagement_survey_templates;
  SELECT count(*) INTO o_resp FROM sys.sys_engagement_survey_responses;
  SELECT count(*) INTO o_q
    FROM sys.sys_engagement_surveys s
   CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(s.survey_questions) = 'array'
                                                THEN s.survey_questions ELSE '[]'::jsonb END) q;
  SELECT count(*) INTO o_ans
    FROM sys.sys_engagement_survey_responses r
   CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(r.response_answers) = 'array'
                                                THEN r.response_answers ELSE '[]'::jsonb END) e;

  SELECT count(*) INTO r_surv FROM sys.sys_surveys WHERE survey_natural_key NOT LIKE 'DA\_ESURV::%';
  SELECT count(*) INTO r_q FROM sys.sys_survey_questions WHERE survey_question_natural_key NOT LIKE 'DA\_ESURV::%';
  SELECT count(*) INTO r_resp FROM sys.sys_survey_responses WHERE survey_response_natural_key NOT LIKE 'DA\_ESRESP::%';
  SELECT count(*) INTO r_tmpl FROM sys.sys_survey_templates WHERE survey_template_natural_key NOT LIKE 'DA\_ESTMPL::%';

  -- Guardia: una risposta che nomina una domanda inesistente non ha dove andare. Misurato: zero.
  -- Se compare, ci si ferma invece di scriverla senza domanda.
  SELECT count(*) INTO n
    FROM sys.sys_engagement_survey_responses r
    JOIN sys.sys_engagement_surveys s ON s.survey_id = r.response_survey_id
   CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(r.response_answers) = 'array'
                                                THEN r.response_answers ELSE '[]'::jsonb END) e
   WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(s.survey_questions) q
                      WHERE q->>'id' = e->>'question_id');
  IF n <> 0 THEN
    RAISE EXCEPTION '000497: % risposte nominano una domanda che il loro sondaggio non ha: mi fermo', n;
  END IF;

  -- Guardia: un voto non intero non entra in una colonna intera senza essere cambiato.
  SELECT count(*) INTO n
    FROM sys.sys_engagement_survey_responses r
    JOIN sys.sys_engagement_surveys s ON s.survey_id = r.response_survey_id
   CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(r.response_answers) = 'array'
                                                THEN r.response_answers ELSE '[]'::jsonb END) e
    JOIN LATERAL (SELECT q FROM jsonb_array_elements(s.survey_questions) q
                   WHERE q->>'id' = e->>'question_id' LIMIT 1) d ON true
   WHERE d.q->>'type' IN ('rating', 'nps')
     AND COALESCE(e->>'value', e->>'rating', e->>'nps') !~ '^-?[0-9]+$';
  IF n <> 0 THEN
    RAISE EXCEPTION '000497: % voti non interi: non li arrotondo, mi fermo', n;
  END IF;

  -- ── il piano: le chiavi che mancano, scritte nel giornale PRIMA di scrivere ──
  INSERT INTO staging.sondaggi_un_modello_undo (tabella, natural_key, tenant_id)
  SELECT 'sys_survey_templates', 'DA_ESTMPL::' || t.template_id, t.template_tenant_id
    FROM sys.sys_engagement_survey_templates t
   WHERE NOT EXISTS (SELECT 1 FROM sys.sys_survey_templates x
                      WHERE x.survey_template_tenant_id = t.template_tenant_id
                        AND x.survey_template_natural_key = 'DA_ESTMPL::' || t.template_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO staging.sondaggi_un_modello_undo (tabella, natural_key, tenant_id)
  SELECT 'sys_surveys', 'DA_ESURV::' || s.survey_id, s.survey_tenant_id
    FROM sys.sys_engagement_surveys s
   WHERE NOT EXISTS (SELECT 1 FROM sys.sys_surveys x
                      WHERE x.survey_tenant_id = s.survey_tenant_id
                        AND x.survey_natural_key = 'DA_ESURV::' || s.survey_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO staging.sondaggi_un_modello_undo (tabella, natural_key, tenant_id)
  SELECT 'sys_survey_questions', 'DA_ESURV::' || s.survey_id || '::' || (q->>'id'), s.survey_tenant_id
    FROM sys.sys_engagement_surveys s
   CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(s.survey_questions) = 'array'
                                                THEN s.survey_questions ELSE '[]'::jsonb END) q
   WHERE NOT EXISTS (SELECT 1 FROM sys.sys_survey_questions x
                      WHERE x.survey_question_tenant_id = s.survey_tenant_id
                        AND x.survey_question_natural_key = 'DA_ESURV::' || s.survey_id || '::' || (q->>'id'))
  ON CONFLICT DO NOTHING;

  INSERT INTO staging.sondaggi_un_modello_undo (tabella, natural_key, tenant_id)
  SELECT 'sys_survey_responses', 'DA_ESRESP::' || r.response_id || '::' || (e->>'question_id'), r.response_tenant_id
    FROM sys.sys_engagement_survey_responses r
   CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(r.response_answers) = 'array'
                                                THEN r.response_answers ELSE '[]'::jsonb END) e
   WHERE NOT EXISTS (SELECT 1 FROM sys.sys_survey_responses x
                      WHERE x.survey_response_tenant_id = r.response_tenant_id
                        AND x.survey_response_natural_key = 'DA_ESRESP::' || r.response_id || '::' || (e->>'question_id'))
  ON CONFLICT DO NOTHING;

  -- ── i modelli di sondaggio: le domande jsonb portano già la loro scala ──
  INSERT INTO sys.sys_survey_templates
    (survey_template_tenant_id, survey_template_natural_key, survey_template_name,
     survey_template_description, survey_template_type, survey_template_questions,
     survey_template_is_anonymous, survey_template_is_system, survey_template_metadata,
     created_at, updated_at)
  SELECT t.template_tenant_id, 'DA_ESTMPL::' || t.template_id, t.template_name,
         t.template_description, t.template_category,
         CASE WHEN jsonb_typeof(t.template_questions) = 'array' THEN t.template_questions ELSE '[]'::jsonb END,
         false, t.template_is_system,
         COALESCE(t.template_metadata, '{}'::jsonb) || jsonb_build_object('provenienza', jsonb_build_object(
           'tabella', 'sys_engagement_survey_templates', 'id', t.template_id,
           'chiave_naturale', t.template_natural_key, 'trasferito_da', '000497')),
         t.created_at, GREATEST(t.updated_at, t.created_at)
    FROM sys.sys_engagement_survey_templates t
  ON CONFLICT (survey_template_tenant_id, survey_template_natural_key) DO NOTHING;

  -- ── i sondaggi: archiviati, con l'annotazione del trimestre che esiste anche nell'altro strumento ──
  INSERT INTO sys.sys_surveys
    (survey_tenant_id, survey_natural_key, survey_title, survey_description, survey_type,
     survey_status, survey_start_date, survey_end_date, survey_is_anonymous,
     survey_total_invitations, survey_metadata, created_at, updated_at)
  SELECT s.survey_tenant_id, 'DA_ESURV::' || s.survey_id, s.survey_title, s.survey_description,
         COALESCE(tm.template_category, 'engagement'),
         'archived', s.survey_start_date::date, s.survey_end_date::date, s.survey_is_anonymous,
         s.survey_total_invitations,
         COALESCE(s.survey_metadata, '{}'::jsonb)
           || jsonb_build_object('provenienza', jsonb_build_object(
                'tabella', 'sys_engagement_surveys', 'id', s.survey_id,
                'chiave_naturale', s.survey_natural_key, 'stato', s.survey_status,
                'destinatari', s.survey_audience_type, 'destinatari_id', to_jsonb(s.survey_audience_ids),
                'risposte_dichiarate', s.survey_total_responses,
                'autore_user_id', s.survey_created_by_user_id, 'modello_id', s.survey_template_id,
                'trasferito_da', '000497'))
           || CASE WHEN gemello.titolo IS NULL THEN '{}'::jsonb
                   ELSE jsonb_build_object('nota', format(
                     'Lo stesso trimestre c''è anche come «%s», raccolto con l''altro strumento: '
                     'i due sondaggi restano distinti, non sono fusi.', gemello.titolo)) END,
         s.created_at, GREATEST(s.updated_at, s.created_at)
    FROM sys.sys_engagement_surveys s
    LEFT JOIN sys.sys_engagement_survey_templates tm ON tm.template_id = s.survey_template_id
    LEFT JOIN LATERAL (
      SELECT string_agg(x.survey_title, '», «' ORDER BY x.survey_title) AS titolo
        FROM sys.sys_surveys x
       WHERE x.survey_tenant_id = s.survey_tenant_id
         AND x.survey_natural_key NOT LIKE 'DA\_ESURV::%'
         AND x.survey_start_date IS NOT NULL AND s.survey_start_date IS NOT NULL
         AND date_trunc('quarter', x.survey_start_date) = date_trunc('quarter', s.survey_start_date::date)
         AND x.survey_type IN ('engagement', 'annual')
    ) gemello ON true
  ON CONFLICT (survey_tenant_id, survey_natural_key) DO NOTHING;

  -- ── le domande: una riga per domanda jsonb, con la scala nelle opzioni ──
  INSERT INTO sys.sys_survey_questions
    (survey_question_survey_id, survey_question_tenant_id, survey_question_natural_key,
     survey_question_text, survey_question_type, survey_question_options,
     survey_question_category, survey_question_display_order, survey_question_is_required, created_at)
  SELECT ns.survey_id, s.survey_tenant_id, 'DA_ESURV::' || s.survey_id || '::' || (q.v->>'id'),
         q.v->>'text', q.v->>'type',
         CASE WHEN q.v->>'type' IN ('rating', 'nps')
              THEN jsonb_build_object('scale', COALESCE((q.v->>'scale')::int,
                                                        CASE WHEN q.v->>'type' = 'nps' THEN 10 END))
              WHEN q.v ? 'options' THEN jsonb_build_object('options', q.v->'options') END,
         q.v->>'category', q.ord::int, COALESCE((q.v->>'required')::boolean, false), s.created_at
    FROM sys.sys_engagement_surveys s
    JOIN sys.sys_surveys ns ON ns.survey_tenant_id = s.survey_tenant_id
                           AND ns.survey_natural_key = 'DA_ESURV::' || s.survey_id
   CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(s.survey_questions) = 'array'
                                                THEN s.survey_questions ELSE '[]'::jsonb END)
         WITH ORDINALITY AS q(v, ord)
  ON CONFLICT (survey_question_tenant_id, survey_question_natural_key) DO NOTHING;

  -- ── le risposte: una riga per risposta jsonb, il valore nella colonna del suo tipo ──
  INSERT INTO sys.sys_survey_responses
    (survey_response_survey_id, survey_response_question_id, survey_response_tenant_id,
     survey_response_subject_user_id, survey_response_natural_key, survey_response_rating_value,
     survey_response_text_value, survey_response_choice_value, survey_response_metadata, created_at)
  SELECT nq.survey_question_survey_id, nq.survey_question_id, r.response_tenant_id,
         r.response_subject_user_id, 'DA_ESRESP::' || r.response_id || '::' || (e->>'question_id'),
         CASE WHEN fuori.chiave IS NOT NULL THEN NULL
              WHEN nq.survey_question_type IN ('rating', 'nps')
              THEN COALESCE(e->>'value', e->>'rating', e->>'nps')::int END,
         CASE WHEN nq.survey_question_type = 'text' THEN COALESCE(e->>'value', e->>'text') END,
         CASE WHEN nq.survey_question_type NOT IN ('rating', 'nps', 'text')
              THEN left(COALESCE(e->>'value', e->>'choice'), 200) END,
         COALESCE(r.response_metadata, '{}'::jsonb) || jsonb_build_object('provenienza', jsonb_build_object(
           'tabella', 'sys_engagement_survey_responses', 'id', r.response_id,
           'completa', r.response_is_complete, 'iniziata', r.response_started_at,
           'completata', r.response_completed_at, 'trasferito_da', '000497'))
           || CASE WHEN fuori.chiave IS NULL THEN '{}'::jsonb
                   ELSE jsonb_build_object('valore_originale', e->fuori.chiave, 'chiave_originale', fuori.chiave,
                          'anomalia', 'voto scritto come nps su una domanda a scala 5: non è un voto di questa domanda') END,
         COALESCE(r.response_completed_at, r.response_started_at, r.created_at)
    FROM sys.sys_engagement_survey_responses r
   CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(r.response_answers) = 'array'
                                                THEN r.response_answers ELSE '[]'::jsonb END) e
    JOIN sys.sys_survey_questions nq
      ON nq.survey_question_tenant_id = r.response_tenant_id
     AND nq.survey_question_natural_key = 'DA_ESURV::' || r.response_survey_id || '::' || (e->>'question_id')
   CROSS JOIN LATERAL (SELECT CASE WHEN nq.survey_question_type = 'rating' AND e ? 'nps'
                                     AND NOT (e ? 'value' OR e ? 'rating') THEN 'nps' END AS chiave) fuori
  ON CONFLICT (survey_response_tenant_id, survey_response_natural_key) DO NOTHING;

  -- ── post-condizioni: ciò che non doveva cambiare ──
  IF (SELECT count(*) FROM sys.sys_surveys WHERE survey_natural_key NOT LIKE 'DA\_ESURV::%') <> r_surv
     OR (SELECT count(*) FROM sys.sys_survey_questions WHERE survey_question_natural_key NOT LIKE 'DA\_ESURV::%') <> r_q
     OR (SELECT count(*) FROM sys.sys_survey_responses WHERE survey_response_natural_key NOT LIKE 'DA\_ESRESP::%') <> r_resp
     OR (SELECT count(*) FROM sys.sys_survey_templates WHERE survey_template_natural_key NOT LIKE 'DA\_ESTMPL::%') <> r_tmpl THEN
    RAISE EXCEPTION '000497: il modello che resta è cambiato fuori dalle righe trasferite';
  END IF;
  IF (SELECT count(*) FROM sys.sys_engagement_surveys) <> o_surv
     OR (SELECT count(*) FROM sys.sys_engagement_survey_responses) <> o_resp
     OR (SELECT count(*) FROM sys.sys_engagement_survey_templates) <> o_tmpl THEN
    RAISE EXCEPTION '000497: le tabelle d''origine sono cambiate';
  END IF;

  -- ── post-condizioni: ciò che doveva ──
  SELECT count(*) INTO n FROM sys.sys_surveys WHERE survey_natural_key LIKE 'DA\_ESURV::%';
  IF n <> o_surv THEN RAISE EXCEPTION '000497: sondaggi trasferiti % su %', n, o_surv; END IF;
  SELECT count(*) INTO n FROM sys.sys_survey_questions WHERE survey_question_natural_key LIKE 'DA\_ESURV::%';
  IF n <> o_q THEN RAISE EXCEPTION '000497: domande trasferite % su %', n, o_q; END IF;
  SELECT count(*) INTO n FROM sys.sys_survey_responses WHERE survey_response_natural_key LIKE 'DA\_ESRESP::%';
  IF n <> o_ans THEN RAISE EXCEPTION '000497: risposte trasferite % su %', n, o_ans; END IF;
  SELECT count(*) INTO n FROM sys.sys_survey_templates WHERE survey_template_natural_key LIKE 'DA\_ESTMPL::%';
  IF n <> o_tmpl THEN RAISE EXCEPTION '000497: modelli trasferiti % su %', n, o_tmpl; END IF;
  -- nessun voto perso per strada: ogni risposta numerica d'origine ha il suo valore
  SELECT count(*) INTO n FROM sys.sys_survey_responses r
    JOIN sys.sys_survey_questions q ON q.survey_question_id = r.survey_response_question_id
   WHERE r.survey_response_natural_key LIKE 'DA\_ESRESP::%'
     AND q.survey_question_type IN ('rating', 'nps') AND r.survey_response_rating_value IS NULL
     AND NOT (r.survey_response_metadata ? 'anomalia');
  IF n <> 0 THEN RAISE EXCEPTION '000497: % voti trasferiti senza valore', n; END IF;
  -- …e nessun voto sta fuori dalla scala della sua domanda
  SELECT count(*) INTO n FROM sys.sys_survey_responses r
    JOIN sys.sys_survey_questions q ON q.survey_question_id = r.survey_response_question_id
   WHERE r.survey_response_natural_key LIKE 'DA\_ESRESP::%'
     AND r.survey_response_rating_value > (q.survey_question_options->>'scale')::int;
  IF n <> 0 THEN RAISE EXCEPTION '000497: % voti oltre la scala della loro domanda', n; END IF;

  RAISE NOTICE '000497: nel modello della pagina /engagement ci sono ora % sondaggi, % domande, % risposte e % modelli venuti dal modello vecchio',
    o_surv, o_q, o_ans, o_tmpl;
END $$;
