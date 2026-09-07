-- 000379 — Da quali fonti la piattaforma accetta di imparare com'è fatta un'azienda.
--
-- #198 / #205 / #132 — la domanda che teneva ferme tre voci in WAIT-INPUT. Decisa il
-- 2026-09-07 (S1091) per delega esplicita di Enzo: «esegui tutti da P0 a P3 in autonomia e
-- automaticamente prendendo decisioni per mio conto».
--
-- ⭐ LA RISPOSTA E' UN CRITERIO, NON UN ELENCO. Un elenco di siti invecchia e nessuno se ne
-- accorge; un criterio dice come si giudica la prossima fonte, che e' cio' che serve davvero.
-- Il criterio si appoggia a una colonna che il modello ha gia': `research_source_class`.
--
--   INSTITUTIONAL  — enti pubblici, autorita', istituti statistici, banche centrali,
--                    ministeri, organismi UE. AMMESSA PER OGNI DOMINIO. E' la classe della
--                    prima fonte del registro (bancaditalia.it).
--   ACCREDITED     — organismi di standardizzazione e classificazione riconosciuti (ISTAT,
--                    ESCO, ISCO/ILO, NACE/Eurostat, enti di normazione). AMMESSA PER OGNI
--                    DOMINIO: sono le tassonomie che l'invariante I21 tiene aperte a ogni
--                    industry, e senza le quali la piattaforma non potrebbe piu' creare
--                    blueprint, tenant, strutture organizzative o processi.
--   TOP_CONSULTING — pubblicazioni metodologiche di societa' di consulenza direzionale di
--                    primo livello. AMMESSA SOLO PER I DOMINI DI METODO — business_processes,
--                    kpis, positions — e MAI per una tassonomia: li' l'autorita' e' dell'ente
--                    che la pubblica, non di chi la commenta.
--   USER_GENERATED — MAI APPROVATA. Il modello la prevede per poterla RIFIUTARE per
--                    iscritto, non per ammetterla: una fonte che chiunque puo' scrivere non
--                    puo' insegnare alla piattaforma com'e' fatta un'azienda.
--
-- E resta il vincolo di industry (I21): una fonte che non sia una tassonomia dev'essere
-- pertinente all'industry del tenant che la usera'. Le tassonomie restano aperte a tutti.
--
-- ⚠ OGNI HOST QUI DENTRO E' STATO MISURATO, non dato per esistente (2026-09-07, curl -4):
--   ec.europa.eu 301 · www.ilo.org 200 · www.istat.it 200 · esco.ec.europa.eu 302
-- Due candidati sono stati SCARTATI perche' non ho potuto misurarli: `iso.org` (403) e
-- `oecd.org` (403) rispondono al blocco anti-bot. Non e' «non esistono»: e' che non ho
-- potuto guardare, e cio' che non si e' potuto guardare non si dichiara a posto.
--
-- I DOMINI RICERCABILI sono sei, dichiarati in
-- `apps/api/src/modules/research/domains/`: organization_units · positions · skills · kpis ·
-- business_processes · research_sources. Prima di questa migrazione ne era coperto UNO.
--
-- ⭐ `research_sources` RESTA SCOPERTO, ED E' UNA SCELTA, NON UNA DIMENTICANZA. E' il
-- meta-dominio: una fonte che dica quali fonti sono autorevoli sarebbe circolare. Quel
-- dominio si governa col criterio di classe qui sopra, che e' scritto e non ricercato.
-- E la scelta ha un secondo effetto, che scioglie il nodo di #205: quella voce si e' fermata
-- perche' «con una sola fonte approvata l'autoprova a esiti opposti non e' costruibile — non
-- esiste un secondo dominio con cui provare il no». Ora esiste: cinque domini con fonte
-- (il si') e `research_sources` senza (il no).
--
-- ⛔ E LA PROVA R2 NON SI RISCRIVE AL POTENZIALE. #205 chiedeva se trasformarla da «una fonte
-- ammessa ESISTE» a «una fonte ammessa PUO' esistere». No: una prova al potenziale e' vera
-- per costruzione e non puo' mai fallire, ed e' esattamente «un controllo che non si e' mai
-- visto rosso non e' una prova» (metodo di bonifica ⑤). Il difetto non era nella prova: erano
-- le fonti a mancare. Si aggiungono le fonti, non si indebolisce il controllo.
--
-- ⚠ CORREGGE ANCHE UNA TRACCIABILITA' FALSA, trovata misurando: la prima fonte porta
-- `research_source_approved_by = piattaforma@collaudo.invalid`, cioe' un'utenza SERVICE,
-- mentre la sua motivazione dice «APPROVATA da Enzo». Il vincolo
-- `sys_research_source_approval_check` pretende un approvatore proprio per sapere CHI, e la
-- risposta era «una macchina». L'approvatore diventa la persona reale.

BEGIN;

DO $$
DECLARE
  approvatore  uuid;
  n_prima      int;
  n_dopo       int;
  n_approvate  int;
  n_service    int;
BEGIN
  -- (a) LA MISURA PRIMA
  SELECT count(*) INTO n_prima FROM sys.sys_research_sources;

  -- (b) LA GUARDIA, ri-verificata al momento dell'esecuzione e non ereditata: l'approvatore
  --     dev'essere una PERSONA. Se non c'e', non si approva niente — meglio nessuna fonte
  --     che una fonte approvata da nessuno.
  SELECT user_id INTO approvatore
    FROM sys.sys_users
   WHERE lower(user_email) = 'enzo.spenuso@heuresys.com'
     AND user_type = 'STANDARD';
  IF approvatore IS NULL THEN
    RAISE EXCEPTION
      '000379: non trovo una persona STANDARD `enzo.spenuso@heuresys.com` da registrare come '
      'approvatore. Non approvo fonti con un approvatore mancante o di servizio.';
  END IF;

  -- La correzione della tracciabilita': solo le righe il cui approvatore e' un'utenza SERVICE.
  -- Elenco esplicito del criterio, mai un aggiornamento a tappeto.
  UPDATE sys.sys_research_sources s
     SET research_source_approved_by = approvatore,
         research_source_metadata = coalesce(s.research_source_metadata, '{}'::jsonb)
           || jsonb_build_object('correzione_000379',
                'approved_by puntava a un''utenza SERVICE mentre la motivazione dichiarava '
                'l''approvazione di una persona; corretto il 2026-09-07 (S1091)'),
         updated_at = now()
   WHERE s.research_source_approved_by IN (SELECT user_id FROM sys.sys_users WHERE user_type = 'SERVICE');

  -- Le quattro fonti, una per dominio scoperto. Idempotenti sull'indice unico
  -- (host_suffix, domain): rieseguire non duplica.
  INSERT INTO sys.sys_research_sources
    (research_source_host_suffix, research_source_label, research_source_class,
     research_source_status, research_source_domain, research_source_country_code,
     research_source_rationale, research_source_approved_by, research_source_approved_at,
     research_source_metadata)
  VALUES
    ('ec.europa.eu',
     'ESCO — classificazione europea di competenze, abilita'' e professioni',
     'ACCREDITED', 'APPROVED', 'skills', 'EU',
     'Tassonomia europea delle competenze, gia'' in uso in questa piattaforma: le competenze '
     'di sys.* ne derivano. Classe ACCREDITED, ammessa per ogni dominio (I21: le tassonomie '
     'restano aperte a ogni industry). Host misurato il 2026-09-07: esco.ec.europa.eu 302.',
     approvatore, now(),
     '{"criterio": "classe ACCREDITED", "misurato_il": "2026-09-07", "http": 302}'::jsonb),

    ('ec.europa.eu',
     'Eurostat — statistiche ufficiali dell''Unione europea',
     'INSTITUTIONAL', 'APPROVED', 'kpis', 'EU',
     'Indicatori con definizione pubblicata e metodo dichiarato, che e'' esattamente cio'' che '
     'serve a un dominio di KPI: un indicatore senza definizione non e'' un indicatore. '
     'Scartata ISO 30414, pertinente per materia, perche'' iso.org risponde 403 al blocco '
     'anti-bot e non ho potuto misurarla. Host misurato il 2026-09-07: ec.europa.eu 301.',
     approvatore, now(),
     '{"criterio": "classe INSTITUTIONAL", "misurato_il": "2026-09-07", "http": 301, "scartata": "iso.org 403, non misurabile"}'::jsonb),

    ('ilo.org',
     'ILO — ISCO, classificazione internazionale delle professioni',
     -- country_code e' char(2) e ISCO e' una classificazione INTERNAZIONALE: non ha un
     -- paese. NULL e' la risposta onesta; 'INT' non e' un codice ISO 3166-1 e non ci
     -- starebbe comunque (misurato: la colonna e' char(2), ed e' cosi' che la prova
     -- generale sul gemello ha fermato questa migrazione prima del push).
     'ACCREDITED', 'APPROVED', 'positions', NULL,
     'ISCO-08 e'' la classificazione internazionale delle professioni, cioe'' il vocabolario '
     'con cui si nomina un POSTO nell''organigramma — che e'' esattamente l''oggetto del '
     'dominio positions (I1: il modello e'' position-centric, la posizione e'' un posto, non '
     'una persona). Host misurato il 2026-09-07: www.ilo.org 200.',
     approvatore, now(),
     '{"criterio": "classe ACCREDITED", "misurato_il": "2026-09-07", "http": 200}'::jsonb),

    ('istat.it',
     'ISTAT — ATECO e classificazione delle unita'' istituzionali',
     'INSTITUTIONAL', 'APPROVED', 'organization_units', 'IT',
     'Istituto nazionale di statistica: ATECO e le classificazioni delle unita'' sono la base '
     'con cui si descrive come un''impresa e'' articolata. E'' gia'' una fonte di questo '
     'progetto per altra via — lo schema reference_sync sincronizza ISTAT/ATECO/ESCO — quindi '
     'qui il registro riconosce per iscritto un''autorita'' che il sistema usava di fatto. '
     'Host misurato il 2026-09-07: www.istat.it 200.',
     approvatore, now(),
     '{"criterio": "classe INSTITUTIONAL", "misurato_il": "2026-09-07", "http": 200}'::jsonb)
  ON CONFLICT (research_source_host_suffix, COALESCE(research_source_domain, '*'::varchar))
    DO NOTHING;

  -- (c) LE POST-CONDIZIONI, e la prima protegge cio' che NON doveva cambiare.
  SELECT count(*) INTO n_dopo FROM sys.sys_research_sources;
  IF n_dopo < n_prima THEN
    RAISE EXCEPTION '000379: le fonti sono passate da % a %: qualcosa e'' stato rimosso', n_prima, n_dopo;
  END IF;

  -- Nessuna fonte puo' restare approvata da un''utenza di servizio.
  SELECT count(*) INTO n_service
    FROM sys.sys_research_sources s
    JOIN sys.sys_users u ON u.user_id = s.research_source_approved_by
   WHERE u.user_type = 'SERVICE';
  IF n_service <> 0 THEN
    RAISE EXCEPTION '000379: % fonti risultano ancora approvate da un''utenza SERVICE', n_service;
  END IF;

  -- E nessuna USER_GENERATED puo' essere APPROVED: e' il criterio, reso meccanico.
  IF EXISTS (SELECT 1 FROM sys.sys_research_sources
              WHERE research_source_class = 'USER_GENERATED'
                AND research_source_status = 'APPROVED') THEN
    RAISE EXCEPTION
      '000379: esiste una fonte USER_GENERATED approvata. Il criterio (S1091) la vieta: una '
      'fonte che chiunque puo'' scrivere non insegna alla piattaforma com''e'' fatta un''azienda.';
  END IF;

  SELECT count(*) INTO n_approvate
    FROM sys.sys_research_sources WHERE research_source_status = 'APPROVED';

  RAISE NOTICE
    '000379: fonti % -> %, approvate %. Domini coperti: business_processes, skills, kpis, '
    'positions, organization_units. Scoperto per scelta: research_sources (meta-dominio).',
    n_prima, n_dopo, n_approvate;
END $$;

COMMIT;
