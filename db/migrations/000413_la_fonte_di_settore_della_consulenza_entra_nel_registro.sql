-- 000413 — La fonte di settore della consulenza di direzione entra nel registro.
--
-- #205 F2 — decisa il 2026-09-13 (S1099) per delega esplicita di Enzo: «esegui tutti da P1 a
-- P3 in autonomia e automaticamente prendendo decisioni per mio conto». Era la domanda aperta
-- in `STATE.md` dalla S1096: «vuoi che assoconsult.org entri nel registro delle fonti per
-- positions e organization_units? Senza, la ricerca resta vuota».
--
-- PERCHE' SERVE, misurato e non supposto. Quattro corse su `positions` (S1096-S1098) con
-- l'unica fonte approvata, `ilo.org`: l'ultima ha letto 3 mappe, 2.094 indirizzi, 120
-- candidati, 8 pagine scelte — e ZERO proposte, perche' nessuna pagina di un sito di
-- classificazione e norme del lavoro descrive come e' fatta una societa' di consulenza. Il
-- modello ha risposto vuoto invece di inventare, che e' il comportamento voluto: il limite
-- era della FONTE, non della catena. La fonte di settore era stata proposta da una corsa
-- (`7550b570`, S1096) e mai approvata, perche' le fonti le approva Enzo (S1081).
--
-- CHE COS'E'. Assoconsult e' l'associazione delle imprese di consulenza di management,
-- aderente a Confindustria: pubblica l'Osservatorio sul settore e gli Stati Generali del
-- Management Consulting (edizioni dal 2010), e il suo stesso sito descrive «la struttura
-- organizzativa» di un'associazione di imprese di consulenza. E' la voce del SETTORE di
-- Heuresys System (I21: `MGMT_CONSULTING`, ATECO 70.20): la pertinenza di industry che il
-- criterio della 000379 pretende per ogni fonte che non sia una tassonomia e' data per
-- costruzione.
--
-- LA CLASSE, secondo il criterio della 000379 e non a intuito. Non e' INSTITUTIONAL (non e'
-- un ente pubblico) e non e' ACCREDITED (non pubblica una classificazione). E' la classe
-- TOP_CONSULTING — «pubblicazioni metodologiche della consulenza direzionale di primo
-- livello» — letta per la sua ratio: l'autorita' su COME si organizza una societa' di
-- consulenza sta nel settore stesso, e l'associazione di categoria e' il settore che parla
-- con una voce sola, prima di qualunque singola societa'.
--
-- I DOMINI. `positions` sta nell'elenco dei «domini di metodo» che la 000379 ammette per
-- TOP_CONSULTING. `organization_units` NON vi compare, e va detto perche' entra lo stesso:
-- la ragione scritta della restrizione e' «MAI per una tassonomia: li' l'autorita' e'
-- dell'ente che la pubblica, non di chi la commenta». Le unita' organizzative di un tenant
-- non sono una tassonomia — sono il contenuto di un cliente (R1 di #205: colonna
-- `%tenant_id`), cioe' esattamente il genere di cosa che una fonte di metodo puo'
-- descrivere. L'elenco della 000379 era stato scritto quando la sola fonte per
-- `organization_units` era ISTAT (una classificazione, ACCREDITED per costruzione): la
-- ratio ammette, l'elenco taceva. Questa migrazione ESTENDE l'elenco a `organization_units`
-- per le fonti TOP_CONSULTING, per iscritto e con la ragione. Le tassonomie restano escluse.
--
-- ⚠ L'HOST E' STATO MISURATO (2026-09-13, dal linux-pc, DNS sano):
--   https://www.assoconsult.org/ → 301 → https://assoconsult.org/ → 200
--   /sitemap.xml → 301 → /wp-sitemap.xml → 501 «manca SimpleXML»: LA MAPPA NON C'E'.
--   /wp-json/wp/v2/pages → 200, 31 pagine (organi, struttura organizzativa, osservatorio,
--   studi, stati generali 2010-2026). E' la ragione della seconda via aggiunta in
--   `mappa-del-sito.ts` nello stesso commit: senza, la fase «indirizzi» tornava a indovinare.
--
-- REVERSIBILE senza cancellare: `research_source_status = 'REJECTED'` sulle due righe.
-- Idempotente sull'indice unico (host_suffix, domain): rieseguire non duplica.

-- @migrate: once

BEGIN;

DO $$
DECLARE
  approvatore  uuid;
  n_prima      int;
  n_dopo       int;
  n_nuove      int;
BEGIN
  -- (a) LA MISURA PRIMA
  SELECT count(*) INTO n_prima FROM sys.sys_research_sources;

  -- (b) LA GUARDIA, ri-verificata al momento dell'esecuzione: l'approvatore e' una PERSONA.
  --     La decisione e' presa per delega, ma l'approvazione resta a nome di chi ha delegato:
  --     e' cio' che il vincolo `sys_research_source_approval_check` chiede di sapere — CHI.
  SELECT user_id INTO approvatore
    FROM sys.sys_users
   WHERE lower(user_email) = 'enzo.spenuso@heuresys.com'
     AND user_type = 'STANDARD';
  IF approvatore IS NULL THEN
    RAISE EXCEPTION
      '000413: non trovo una persona STANDARD `enzo.spenuso@heuresys.com` da registrare come '
      'approvatore. Non approvo fonti con un approvatore mancante o di servizio.';
  END IF;

  INSERT INTO sys.sys_research_sources
    (research_source_host_suffix, research_source_label, research_source_class,
     research_source_status, research_source_domain, research_source_country_code,
     research_source_rationale, research_source_approved_by, research_source_approved_at,
     research_source_metadata)
  VALUES
    ('assoconsult.org',
     'Assoconsult — associazione delle imprese di consulenza di management (Confindustria)',
     'TOP_CONSULTING', 'APPROVED', 'positions', 'IT',
     'Fonte di SETTORE per la consulenza di direzione (I21: Heuresys System = MGMT_CONSULTING, '
     'ATECO 70.20). Osservatorio e Stati Generali del Management Consulting descrivono ruoli e '
     'posizioni delle societa'' del settore. Classe TOP_CONSULTING per la ratio della 000379: '
     'l''autorita'' su come si organizza una societa'' di consulenza sta nel settore stesso. '
     'Proposta da una corsa (7550b570, S1096); approvata il 2026-09-13 (S1099) per delega '
     'esplicita di Enzo. Host misurato il 2026-09-13: assoconsult.org 200, mappa del sito '
     'assente (501), elenco REST 31 pagine.',
     approvatore, now(),
     '{"criterio": "classe TOP_CONSULTING (dominio di metodo)", "misurato_il": "2026-09-13", "http": 200, "mappa": "assente: wp-sitemap.xml 501", "elenco_rest": 31, "proposta_dalla_corsa": "7550b570", "delega": "S1099"}'::jsonb),

    ('assoconsult.org',
     'Assoconsult — associazione delle imprese di consulenza di management (Confindustria)',
     'TOP_CONSULTING', 'APPROVED', 'organization_units', 'IT',
     'Fonte di SETTORE per la consulenza di direzione (I21: Heuresys System = MGMT_CONSULTING, '
     'ATECO 70.20). Le unita'' organizzative di un tenant NON sono una tassonomia: sono '
     'contenuto di un cliente, e la ratio della 000379 («mai per una tassonomia») non le '
     'esclude — l''elenco dei domini di metodo viene qui ESTESO a organization_units per le '
     'fonti TOP_CONSULTING, per iscritto. Approvata il 2026-09-13 (S1099) per delega esplicita '
     'di Enzo. Host misurato il 2026-09-13: assoconsult.org 200, mappa del sito assente (501), '
     'elenco REST 31 pagine.',
     approvatore, now(),
     '{"criterio": "classe TOP_CONSULTING (estensione dichiarata a organization_units: non e'' una tassonomia)", "misurato_il": "2026-09-13", "http": 200, "mappa": "assente: wp-sitemap.xml 501", "elenco_rest": 31, "proposta_dalla_corsa": "7550b570", "delega": "S1099"}'::jsonb)
  ON CONFLICT (research_source_host_suffix, COALESCE(research_source_domain, '*'::varchar))
    DO NOTHING;

  -- (c) LE POST-CONDIZIONI, e la prima protegge cio' che NON doveva cambiare.
  SELECT count(*) INTO n_dopo FROM sys.sys_research_sources;
  IF n_dopo < n_prima THEN
    RAISE EXCEPTION '000413: le fonti sono passate da % a %: qualcosa e'' stato rimosso', n_prima, n_dopo;
  END IF;
  IF n_dopo > n_prima + 2 THEN
    RAISE EXCEPTION '000413: le fonti sono passate da % a %: piu'' delle due righe dichiarate', n_prima, n_dopo;
  END IF;

  -- Le due righe ci sono, approvate da una persona, nella classe dichiarata.
  SELECT count(*) INTO n_nuove
    FROM sys.sys_research_sources s
    JOIN sys.sys_users u ON u.user_id = s.research_source_approved_by
   WHERE s.research_source_host_suffix = 'assoconsult.org'
     AND s.research_source_status = 'APPROVED'
     AND s.research_source_class = 'TOP_CONSULTING'
     AND s.research_source_domain IN ('positions', 'organization_units')
     AND u.user_type = 'STANDARD';
  IF n_nuove <> 2 THEN
    RAISE EXCEPTION '000413: attese 2 fonti assoconsult.org APPROVED/TOP_CONSULTING con approvatore persona, trovate %', n_nuove;
  END IF;

  -- Il criterio della 000379 resta meccanico: nessuna USER_GENERATED approvata, e nessuna
  -- TOP_CONSULTING su una tassonomia (skills e' l'unico dominio-tassonomia fra i sei).
  IF EXISTS (SELECT 1 FROM sys.sys_research_sources
              WHERE research_source_class = 'USER_GENERATED' AND research_source_status = 'APPROVED') THEN
    RAISE EXCEPTION '000413: esiste una fonte USER_GENERATED approvata: il criterio (000379) la vieta';
  END IF;
  IF EXISTS (SELECT 1 FROM sys.sys_research_sources
              WHERE research_source_class = 'TOP_CONSULTING' AND research_source_status = 'APPROVED'
                AND research_source_domain = 'skills') THEN
    RAISE EXCEPTION '000413: una fonte TOP_CONSULTING risulta approvata su una tassonomia (skills): il criterio (000379) lo vieta';
  END IF;

  RAISE NOTICE '000413: fonti % -> %; assoconsult.org APPROVED su positions e organization_units.', n_prima, n_dopo;
END $$;

COMMIT;
