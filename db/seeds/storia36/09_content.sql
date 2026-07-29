-- ============================================================================
-- storia36 C9 — HANDBOOK, POLICY, COMUNICAZIONE INTERNA
--
-- Piano: docs/superpowers/plans/2026-07-27-rtl-storia-36-mesi.md (Task C9)
--
-- Quello che c'era, misurato prima di toccarlo:
--   · 163 documenti, e NESSUNO pubblicato: 151 archiviati, 11 in bozza, 1 in
--     revisione. Il portale del dipendente ha una sezione documenti che non
--     mostra niente, perché non c'è niente di pubblicato da mostrare.
--   · ZERO categorie (la tabella è vuota) e quindi ZERO documenti
--     categorizzati: 163 su 163 senza una collocazione.
--   · tutti dello stesso tipo, «article»: nessuna policy, nessun handbook,
--     nessuna comunicazione — le tre cose per cui la sezione esiste.
--
-- COSA SCRIVE:
--
--  · SEI CATEGORIE, quelle di un manuale del dipendente vero: condotta,
--    persone e organizzazione, sicurezza, amministrazione, welfare,
--    comunicazioni.
--  · DIECI DOCUMENTI che una banca ha davvero, ciascuno con il proprio tipo:
--    il codice etico, il regolamento su ferie e permessi, il lavoro agile, la
--    nota spese, la sicurezza sul lavoro, la procedura di segnalazione
--    (whistleblowing), il welfare aziendale, il regolamento informatico, il
--    manuale di accoglienza dei nuovi assunti, e la comunicazione che ha
--    annunciato il riordino organizzativo.
--  · LA STORIA DELLE REVISIONI. Nessun documento nasce già com'è oggi: ognuno
--    ha una prima stesura precedente alla finestra e le revisioni successive.
--    Le date non sono sparse a caso — seguono i fatti:
--       · le policy ORGANIZZATIVE (ferie, lavoro agile, accoglienza) hanno una
--         revisione nel marzo 2025, con il riordino: cambia chi approva cosa;
--       · quelle NORMATIVE seguono la loro norma (la procedura di segnalazione
--         il D.Lgs 24/2023, la sicurezza il suo aggiornamento periodico);
--       · il codice etico si rivede ogni due anni, come da prassi.
--    Ogni revisione porta la nota di che cosa è cambiato: una versione senza
--    quella nota è un numero che si incrementa, non una storia.
--
-- Idempotente: id uuid_generate_v5 su chiavi naturali. Twice-run: 0.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

BEGIN;

DO $$
DECLARE
  c_rtl   constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  c_ns    constant uuid := '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  c_to    date;
  v_hr    uuid;
  v_n     bigint := 0;
  v_tot   bigint := 0;
BEGIN
  SELECT staging.storia36_c4_frontier() INTO STRICT c_to;
  SELECT user_id INTO STRICT v_hr FROM sys.sys_users
   WHERE user_email = 'federica.marchetti@rtl-bank.org';

  -- ==========================================================================
  -- 1. LE CATEGORIE — la tabella era vuota, e senza collocazione un manuale
  --    è un mucchio di file
  -- ==========================================================================
  INSERT INTO sys.sys_content_categories (
    category_id, category_tenant_id, category_natural_key, category_name,
    category_slug, category_description, category_is_system, category_metadata)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C9::CAT::' || c.slug),
         c_rtl, 'STORIA36-CAT-' || upper(c.slug), c.nome, c.slug, c.descrizione, false,
         jsonb_build_object('storia36', 'C9')
    FROM (VALUES
      ('condotta',        'Condotta e integrità',      'Codice etico, conflitti di interesse, segnalazioni.'),
      ('persone',         'Persone e organizzazione',  'Rapporto di lavoro, orari, assenze, lavoro agile.'),
      ('sicurezza',       'Salute e sicurezza',        'Obblighi, figure preposte, emergenze.'),
      ('amministrazione', 'Amministrazione',           'Rimborsi, trasferte, strumenti aziendali.'),
      ('welfare',         'Welfare e benefici',        'Servizi alla persona, previdenza, sostegni.'),
      ('comunicazioni',   'Comunicazioni interne',     'Annunci della direzione e note organizzative.')
    ) AS c(slug, nome, descrizione)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C9: categorie %', v_n;

  -- ==========================================================================
  -- 2. I DOCUMENTI — quelli che una banca ha davvero
  -- ==========================================================================
  CREATE TEMP TABLE _doc ON COMMIT DROP AS
  SELECT * FROM (VALUES
    ('codice-etico', 'Codice etico e di condotta', 'policy', 'condotta',
     DATE '2021-06-14', 'biennale',
     'Principi di condotta, conflitti di interesse, rapporti con la clientela e con le autorità di vigilanza.'),
    ('ferie-permessi', 'Regolamento ferie e permessi', 'policy', 'persone',
     DATE '2022-03-07', 'organizzativa',
     'Maturazione, richiesta e approvazione di ferie e permessi; copertura dei servizi nei periodi di chiusura.'),
    ('lavoro-agile', 'Disciplina del lavoro agile', 'policy', 'persone',
     DATE '2022-09-12', 'organizzativa',
     'Giornate da remoto, fasce di contattabilità, dotazione strumentale e diritto alla disconnessione.'),
    ('nota-spese', 'Rimborsi spese e trasferte', 'policy', 'amministrazione',
     DATE '2021-11-08', 'annuale',
     'Massimali, documentazione richiesta, tempi di rimborso e utilizzo della carta aziendale.'),
    ('sicurezza-lavoro', 'Salute e sicurezza sul lavoro', 'policy', 'sicurezza',
     DATE '2021-04-19', 'normativa',
     'Obblighi del datore di lavoro e dei lavoratori, figure preposte, gestione delle emergenze.'),
    ('segnalazioni', 'Procedura per le segnalazioni (whistleblowing)', 'policy', 'condotta',
     DATE '2021-09-06', 'normativa',
     'Canali di segnalazione, tutela del segnalante, tempi di riscontro e divieto di ritorsione.'),
    ('welfare', 'Welfare aziendale', 'policy', 'welfare',
     DATE '2022-01-17', 'annuale',
     'Servizi alla persona, previdenza complementare, sostegni allo studio e alla genitorialità.'),
    ('regolamento-ict', 'Regolamento sull''uso degli strumenti informatici', 'policy', 'sicurezza',
     DATE '2021-10-11', 'normativa',
     'Uso della posta e dei dispositivi aziendali, credenziali, riservatezza dei dati della clientela.'),
    ('accoglienza', 'Manuale di accoglienza dei nuovi assunti', 'handbook', 'persone',
     DATE '2022-05-16', 'organizzativa',
     'Primo giorno, referenti, strumenti, formazione obbligatoria e percorso dei primi novanta giorni.'),
    ('nota-riordino', 'Nota organizzativa: il nuovo assetto', 'announcement', 'comunicazioni',
     DATE '2025-03-03', 'una-tantum',
     'Comunicazione della direzione sul riordino: divisioni accorpate, nuovo presidio informatico, riferimenti aggiornati.')
  ) AS d(slug, titolo, tipo, categoria, prima_stesura, ritmo, sommario);

  INSERT INTO sys.sys_content_documents (
    document_id, document_tenant_id, document_natural_key, document_category_id,
    document_title, document_slug, document_kind, document_status,
    document_body, document_body_format, document_author_user_id,
    document_published_at, document_published_by_user_id, document_effective_date,
    document_metadata, created_at, updated_at)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C9::DOC::' || d.slug),
         c_rtl, 'STORIA36-DOC-' || upper(d.slug),
         uuid_generate_v5(c_ns, 'STORIA36::C9::CAT::' || d.categoria),
         d.titolo, 'storia36-' || d.slug, d.tipo, 'published',
         d.sommario, 'markdown', v_hr,
         d.prima_stesura::timestamptz, v_hr, d.prima_stesura,
         jsonb_build_object('storia36', 'C9', 'ritmo_revisione', d.ritmo),
         d.prima_stesura::timestamptz, d.prima_stesura::timestamptz
    FROM _doc d
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C9: documenti pubblicati %', v_n;

  -- ==========================================================================
  -- 3. LE REVISIONI — le date seguono i fatti, non un calendario qualsiasi
  -- ==========================================================================
  CREATE TEMP TABLE _rev ON COMMIT DROP AS
  SELECT d.slug, d.titolo, d.sommario, r.quando, r.nota,
         row_number() OVER (PARTITION BY d.slug ORDER BY r.quando) AS numero
    FROM _doc d
    CROSS JOIN LATERAL (
      -- la prima stesura è sempre una versione
      SELECT d.prima_stesura AS quando, 'Prima emissione.' AS nota
      UNION ALL
      -- le policy organizzative si rivedono con il riordino: cambia chi
      -- approva che cosa, e i riferimenti non sono più quelli
      SELECT DATE '2025-03-17', 'Aggiornati i riferimenti organizzativi e la catena di approvazione dopo il riordino.'
       WHERE d.ritmo = 'organizzativa'
      UNION ALL
      -- quelle normative seguono la loro norma
      SELECT DATE '2023-12-15', 'Recepimento della disciplina sulle segnalazioni (D.Lgs 24/2023).'
       WHERE d.slug = 'segnalazioni'
      UNION ALL
      SELECT DATE '2024-05-20', 'Aggiornamento periodico della valutazione dei rischi e delle figure preposte.'
       WHERE d.slug = 'sicurezza-lavoro'
      UNION ALL
      SELECT DATE '2026-01-26', 'Rafforzati i presidi sull''uso delle credenziali e sui dispositivi personali.'
       WHERE d.slug = 'regolamento-ict'
      UNION ALL
      -- il codice etico ogni due anni
      SELECT DATE '2023-06-19', 'Revisione biennale: conflitti di interesse e rapporti con i fornitori.'
       WHERE d.ritmo = 'biennale'
      UNION ALL
      SELECT DATE '2025-06-16', 'Revisione biennale: uso degli strumenti digitali e riservatezza.'
       WHERE d.ritmo = 'biennale'
      UNION ALL
      -- quelle annuali all'apertura dell'esercizio
      SELECT DATE '2024-01-15', 'Aggiornamento annuale dei massimali e delle procedure.'
       WHERE d.ritmo = 'annuale'
      UNION ALL
      SELECT DATE '2025-01-13', 'Aggiornamento annuale dei massimali e delle procedure.'
       WHERE d.ritmo = 'annuale'
      UNION ALL
      SELECT DATE '2026-01-12', 'Aggiornamento annuale dei massimali e delle procedure.'
       WHERE d.ritmo = 'annuale'
    ) r
   WHERE r.quando <= c_to;

  INSERT INTO sys.sys_content_versions (
    version_id, version_tenant_id, version_document_id, version_number,
    version_title, version_body, version_body_format, version_author_user_id,
    version_change_note, version_metadata, created_at)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C9::VER::' || v.slug || '::' || v.numero),
         c_rtl, uuid_generate_v5(c_ns, 'STORIA36::C9::DOC::' || v.slug),
         v.numero, v.titolo, v.sommario, 'markdown', v_hr,
         v.nota, jsonb_build_object('storia36', 'C9'),
         v.quando::timestamptz
    FROM _rev v
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C9: revisioni %', v_n;

  -- il documento punta alla sua versione corrente, ed è datato all'ultima
  -- revisione: un documento «pubblicato nel 2021» che è stato rivisto tre
  -- volte porta la data sbagliata
  UPDATE sys.sys_content_documents d
     SET document_current_version_id = ult.version_id,
         document_effective_date = ult.created_at::date,
         updated_at = ult.created_at
    FROM (
      SELECT DISTINCT ON (v.version_document_id)
             v.version_document_id AS did, v.version_id, v.created_at
        FROM sys.sys_content_versions v
       WHERE v.version_metadata->>'storia36' = 'C9'
       ORDER BY v.version_document_id, v.version_number DESC
    ) ult
   WHERE d.document_id = ult.did
     AND (d.document_current_version_id IS DISTINCT FROM ult.version_id
       OR d.document_effective_date IS DISTINCT FROM ult.created_at::date);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'storia36 C9: documenti allineati alla loro ultima revisione %', v_n;

  -- ==========================================================================
  -- 4. REGISTRO + POST-CONDIZIONI
  -- ==========================================================================
  INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
  VALUES ('C9', '09_content.sql', v_tot, v_tot);

  PERFORM staging.storia36_check_c9a();
  PERFORM staging.storia36_check_c9b();

  RAISE NOTICE 'storia36 C9 OK: % righe scritte (delta atteso 0 alla seconda corsa)', v_tot;
END $$;

COMMIT;
