-- 000469 — F0-3 del programma change management: il «test del valore» diventa una misura.
--
-- IL PERCHE'. Il PRD (docs/product/BUSINESS_SCOPE_AND_PRD.md §1.2) tiene come stella polare
-- il test del valore: «il sistema crea valore se e solo se il dato inserito genera decisioni
-- diverse da quelle che l'organizzazione prenderebbe senza il sistema». Il §2.8 chiede di
-- renderlo una metrica, e fino a oggi era una frase: nessuna tabella diceva chi ha deciso che
-- cosa, da quale pagina o con quale agente. Le decisioni stavano sparse in una trentina di
-- tabelle di dominio, ognuna con le sue colonne, e senza la superficie da cui erano arrivate:
-- una riga caricata da uno script e una scelta fatta da un Direttore HR erano indistinguibili.
--
-- LA DEFINIZIONE UNICA (vale ovunque si parli di «decisione tracciabile», e la vista qui sotto
-- è la sua sola forma eseguibile). Una decisione è TRACCIABILE quando porta tutte e cinque:
--   1. CHI: una persona del tenant (dal token, mai dal client), con il tipo di attore
--      (persona o agente che agisce per lei);
--   2. CHE COSA: un tipo di decisione del catalogo chiuso `audit.valore_tipi_decisione`;
--   3. SU CHE COSA: l'oggetto deciso, tipo e identificativo;
--   4. QUANDO: l'istante in cui l'API l'ha accettata (risposta 2xx);
--   5. DA DOVE: una superficie, cioè una pagina del web o un agente.
-- Una decisione che arriva senza superficie (uno script, un'integrazione) si registra lo
-- stesso, con superficie `api`, e si conta a parte come «registrata senza superficie»: è un
-- dato entrato nel sistema, non una prova che il sistema abbia guidato una scelta.
--
-- IL MODELLO. È la forma «attore, verbo, oggetto, contesto, istante» delle dichiarazioni di
-- Experience API (xAPI, ADL) e dei modelli a eventi dell'analisi di prodotto: una riga per
-- fatto, append-only, con un catalogo chiuso dei verbi. Due tipi di evento: `decisione` (le
-- rotte del catalogo) e `uso` (una pagina o un agente usato da una persona, al più una riga
-- per persona, superficie e ora). L'uso è il denominatore: senza di lui non si distingue un
-- tenant che decide poco da un tenant che non apre le pagine.
--
-- DOVE VIVE. `audit.*` (I3/I4, schema ausiliario, come `audit.agent_gateway_decisions`,
-- 000452): è un registro, non un dato di dominio. Le viste stanno in `sys` perché
-- `db_health.py` scopre solo `sys.v_*`; sono INFORMATIVE, zero righe è l'atteso finché il
-- registro non ha scritto niente. Il catalogo è dati, non codice: l'API lo legge dal
-- database, così la definizione è una sola e la si interroga con una query.
--
-- GDPR. `valore_evento_attore_user_id` è un riferimento di AUTORE (la persona ha deciso,
-- l'oggetto può riguardare altri): `ACTOR` + `RETAIN` come registro di accountability (000216,
-- 000304), fuori dal fascicolo dell'art. 15 perché porterebbe decisioni su terzi.
--
-- IDEMPOTENTE: CREATE ... IF NOT EXISTS, INSERT ... ON CONFLICT DO UPDATE sul catalogo (porta
-- il catalogo allo stato dichiarato qui), CREATE OR REPLACE VIEW. Nessuna riga esistente
-- viene toccata fuori dalle tabelle che questa migrazione crea.
-- ROLLBACK DICHIARATO: nessun giornale `staging.*_undo`, perché la migrazione aggiunge e non
-- trasforma. L'inversa, in quest'ordine:
--   DROP VIEW sys.v_valore_settimana; DROP VIEW sys.v_valore_decisioni_tracciabili;
--   DELETE FROM sys.sys_gdpr_data_map WHERE (gdpr_map_table_schema, gdpr_map_table_name,
--     gdpr_map_subject_fk) = ('audit','valore_eventi','valore_evento_attore_user_id');
--   DROP TABLE audit.valore_eventi; DROP TABLE audit.valore_rotte_decisione;
--   DROP TABLE audit.valore_tipi_decisione;
--
-- CENSIMENTO (chi_sorveglia, prima di scrivere): oggetti nuovi, nessuna sentinella, nessun
-- cancello, nessun altro scrittore. Le tabelle stanno in `audit`, quindi fuori dal perimetro
-- di `sys.sys_classificazione_direzione_dato` (000429), che classifica le sole `sys.sys_*`.

BEGIN;

CREATE SCHEMA IF NOT EXISTS audit; -- già esistente da 000002

-- ---------------------------------------------------------------------------
-- 1. Il catalogo chiuso dei tipi di decisione (i «verbi»)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit.valore_tipi_decisione (
  codice       varchar(64)  PRIMARY KEY CHECK (codice ~ '^[a-z][a-z0-9_]{2,63}$'),
  categoria    varchar(16)  NOT NULL
               CHECK (categoria IN ('persone', 'successione', 'sviluppo', 'governo', 'struttura', 'processo')),
  etichetta    text         NOT NULL,
  descrizione  text         NOT NULL,
  attivo       boolean      NOT NULL DEFAULT true,
  created_at   timestamptz  NOT NULL DEFAULT now(),
  updated_at   timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE audit.valore_tipi_decisione IS
  '000469 (F0-3) — catalogo chiuso dei tipi di decisione che contano per il test del valore. '
  'Un tipo nuovo entra solo con una migrazione: è parte della definizione di decisione tracciabile.';

-- ---------------------------------------------------------------------------
-- 2. Quali rotte dell'API sono quelle decisioni, e dove leggere oggetto ed esito
--
-- `oggetto_da` / `esito_da`: `param:<nome>`, `corpo:<campo>`, `risposta:<campo>`; con `[]` in
-- coda il campo è un elenco (una decisione per elemento). La rotta è il MODELLO di Fastify
-- (`/v1/approvals/:id/steps/:stepId/decide`), non l'indirizzo concreto.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit.valore_rotte_decisione (
  metodo        varchar(8)   NOT NULL CHECK (metodo IN ('POST', 'PUT', 'PATCH', 'DELETE')),
  rotta         varchar(200) NOT NULL CHECK (rotta LIKE '/v1/%'),
  codice        varchar(64)  NOT NULL REFERENCES audit.valore_tipi_decisione(codice) ON DELETE RESTRICT,
  oggetto_tipo  varchar(64)  NOT NULL CHECK (oggetto_tipo ~ '^[a-z][a-z0-9_]{1,63}$'),
  oggetto_da    varchar(80)  NOT NULL CHECK (oggetto_da ~ '^(param|corpo|risposta):[A-Za-z][A-Za-z0-9_]*(\[\])?$'),
  esito_da      varchar(80)  CHECK (esito_da IS NULL OR esito_da ~ '^(param|corpo|risposta):[A-Za-z][A-Za-z0-9_]*$'),
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (metodo, rotta)
);

COMMENT ON TABLE audit.valore_rotte_decisione IS
  '000469 (F0-3) — mappa rotta API -> tipo di decisione. L''API la legge (cache di 5 minuti) e '
  'registra un evento di decisione per ogni risposta 2xx su queste rotte.';

-- ---------------------------------------------------------------------------
-- 3. Il registro degli eventi: uso e decisione
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit.valore_eventi (
  valore_evento_id               bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  valore_evento_tenant_id        uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id),
  valore_evento_tipo             varchar(10)  NOT NULL CHECK (valore_evento_tipo IN ('uso', 'decisione')),
  valore_evento_attore_user_id   uuid         NOT NULL REFERENCES sys.sys_users(user_id),
  valore_evento_attore_tipo      varchar(10)  NOT NULL CHECK (valore_evento_attore_tipo IN ('persona', 'agente')),
  valore_evento_superficie_tipo  varchar(10)  NOT NULL CHECK (valore_evento_superficie_tipo IN ('pagina', 'agente', 'api')),
  valore_evento_superficie       varchar(200),
  valore_evento_decisione_codice varchar(64)  REFERENCES audit.valore_tipi_decisione(codice) ON DELETE RESTRICT,
  valore_evento_oggetto_tipo     varchar(64),
  valore_evento_oggetto_id       varchar(128),
  valore_evento_esito            varchar(32),
  valore_evento_metodo           varchar(8)   NOT NULL,
  valore_evento_rotta            varchar(200) NOT NULL,
  valore_evento_richiesta_id     varchar(64),
  valore_evento_avvenuto_il      timestamptz  NOT NULL DEFAULT now(),
  valore_evento_ora_uso          timestamptz,
  CONSTRAINT valore_eventi_decisione_ha_codice
    CHECK ((valore_evento_tipo = 'decisione') = (valore_evento_decisione_codice IS NOT NULL)),
  CONSTRAINT valore_eventi_uso_ha_ora
    CHECK ((valore_evento_tipo = 'uso') = (valore_evento_ora_uso IS NOT NULL)),
  CONSTRAINT valore_eventi_agente_coerente
    CHECK ((valore_evento_attore_tipo = 'agente') = (valore_evento_superficie_tipo = 'agente')),
  CONSTRAINT valore_eventi_superficie_coerente
    CHECK ((valore_evento_superficie_tipo = 'api') = (valore_evento_superficie IS NULL)),
  CONSTRAINT valore_eventi_uso_ha_superficie
    CHECK (valore_evento_tipo <> 'uso' OR valore_evento_superficie_tipo <> 'api')
);

COMMENT ON TABLE audit.valore_eventi IS
  '000469 (F0-3) — registro append-only degli eventi di uso e di decisione (attore, verbo, '
  'oggetto, superficie, istante). Lo scrive l''API dopo la risposta; la superficie è dichiarata '
  'dal client (intestazione x-heuresys-superficie), l''identità viene dal token.';

CREATE INDEX IF NOT EXISTS idx_valore_eventi_tenant_istante
  ON audit.valore_eventi (valore_evento_tenant_id, valore_evento_avvenuto_il);
CREATE INDEX IF NOT EXISTS idx_valore_eventi_decisioni
  ON audit.valore_eventi (valore_evento_decisione_codice, valore_evento_oggetto_id)
  WHERE valore_evento_tipo = 'decisione';
-- L'uso conta al più una volta per persona, superficie e ora: l'API inserisce con ON CONFLICT DO NOTHING.
CREATE UNIQUE INDEX IF NOT EXISTS uq_valore_eventi_uso_orario
  ON audit.valore_eventi (valore_evento_tenant_id, valore_evento_attore_user_id,
                          valore_evento_superficie_tipo, valore_evento_superficie, valore_evento_ora_uso)
  WHERE valore_evento_tipo = 'uso';

-- ---------------------------------------------------------------------------
-- 4. Il catalogo dichiarato. Si porta allo stato scritto qui (ON CONFLICT DO UPDATE).
--
-- Criterio di scelta: una rotta entra se registra una SCELTA fra alternative fatta da una
-- persona con un mandato (approvare o respingere, nominare, assegnare, delegare, ridisegnare
-- la struttura), non se registra un fatto o un dato anagrafico. Restano fuori, di proposito:
-- le preferenze personali, le notifiche, l'anagrafica, le operazioni di piattaforma senza
-- tenant e il reclutamento (dichiarato non attivo, piano interfacce decisione 9).
-- ---------------------------------------------------------------------------
INSERT INTO audit.valore_tipi_decisione (codice, categoria, etichetta, descrizione) VALUES
  ('approvazione_decisa',        'persone',     'Approvazione decisa',
   'Un approvatore approva o respinge un passo di una richiesta (incarichi, trasferimenti, ferie, rilasci di modello).'),
  ('incarico_proposto',          'persone',     'Incarico proposto',
   'Una persona viene proposta su una posizione; parte una richiesta di approvazione.'),
  ('trasferimento_proposto',     'persone',     'Trasferimento proposto',
   'Una persona viene proposta per il passaggio da una posizione a un''altra.'),
  ('incarico_chiusura_proposta', 'persone',     'Chiusura di incarico proposta',
   'Viene proposta la fine dell''incarico di una persona su una posizione.'),
  ('successore_candidato',       'successione', 'Successore candidato',
   'Una persona entra nel bacino di successione di una posizione.'),
  ('prontezza_valutata',         'successione', 'Prontezza del successore valutata',
   'Si giudica quanto un candidato è pronto a succedere.'),
  ('posizione_critica',          'successione', 'Criticità della posizione dichiarata',
   'Si dichiara quanto una posizione conta per la successione.'),
  ('bacino_successione',         'successione', 'Bacino di successione aperto',
   'Si apre il bacino di successione di una posizione.'),
  ('piano_carriera',             'sviluppo',    'Piano di carriera definito',
   'Si definisce il piano di carriera di una persona.'),
  ('posizione_obiettivo_valutata','sviluppo',   'Posizione obiettivo valutata',
   'Il responsabile valuta la posizione a cui una persona aspira.'),
  ('obiettivo_assegnato',        'sviluppo',    'Obiettivo assegnato',
   'Si assegna un obiettivo a una persona o a un''unità.'),
  ('formazione_scelta',          'sviluppo',    'Formazione scelta',
   'Il dipendente si iscrive a un modulo o percorso di formazione.'),
  ('piano_azione_engagement',    'sviluppo',    'Piano d''azione sull''engagement',
   'Dopo un ascolto, si decide un piano d''azione.'),
  ('delega_concessa',            'governo',     'Delega concessa',
   'Una persona affida a un''altra il proprio mandato di decisione per un periodo.'),
  ('delega_revocata',            'governo',     'Delega revocata',
   'Una delega viene ritirata prima della scadenza.'),
  ('consolidamento_deciso',      'struttura',   'Proposta di consolidamento decisa',
   'Il Direttore HR o un delegato accetta, respinge o modifica una proposta di equipollenza.'),
  ('unita_disegnata',            'struttura',   'Unità organizzativa disegnata',
   'Si crea o si modifica un''unità organizzativa.'),
  ('posizione_disegnata',        'struttura',   'Posizione disegnata',
   'Si crea o si modifica una posizione.'),
  ('processo_affidato',          'processo',    'Processo affidato a un''unità',
   'Un processo viene assegnato al presidio di un''unità.'),
  ('processo_di_modello_deciso', 'processo',    'Processo del modello deciso',
   'Nel modello del tenant si decide se e come adottare un processo.')
ON CONFLICT (codice) DO UPDATE
   SET categoria = EXCLUDED.categoria, etichetta = EXCLUDED.etichetta,
       descrizione = EXCLUDED.descrizione, attivo = true, updated_at = now()
 WHERE (audit.valore_tipi_decisione.categoria, audit.valore_tipi_decisione.etichetta,
        audit.valore_tipi_decisione.descrizione, audit.valore_tipi_decisione.attivo)
   IS DISTINCT FROM (EXCLUDED.categoria, EXCLUDED.etichetta, EXCLUDED.descrizione, true);

INSERT INTO audit.valore_rotte_decisione (metodo, rotta, codice, oggetto_tipo, oggetto_da, esito_da) VALUES
  ('POST',  '/v1/approvals/:id/steps/:stepId/decide',                           'approvazione_decisa',        'richiesta_approvazione', 'param:id',                       'corpo:decision'),
  ('POST',  '/v1/me/delegations/approvals/:requestId/steps/:stepId/decide',     'approvazione_decisa',        'richiesta_approvazione', 'param:requestId',                'corpo:decision'),
  ('POST',  '/v1/user-position-assignments',                                    'incarico_proposto',          'richiesta_approvazione', 'risposta:approvalRequestId',     NULL),
  ('POST',  '/v1/user-position-assignments/:id/transfer',                       'trasferimento_proposto',     'richiesta_approvazione', 'risposta:approvalRequestId',     NULL),
  ('POST',  '/v1/user-position-assignments/:id/terminate',                      'incarico_chiusura_proposta', 'richiesta_approvazione', 'risposta:approvalRequestId',     NULL),
  ('POST',  '/v1/successor-candidates',                                         'successore_candidato',       'candidato_successore',   'risposta:successorCandidateId',  NULL),
  ('POST',  '/v1/successor-readiness',                                          'prontezza_valutata',         'prontezza_successore',   'risposta:successorReadinessId',  NULL),
  ('PUT',   '/v1/position-succession-relevance',                                'posizione_critica',          'criticita_posizione',    'risposta:positionSuccessionRelevanceId', NULL),
  ('POST',  '/v1/succession-pools',                                             'bacino_successione',         'bacino_successione',     'risposta:successionPoolId',      NULL),
  ('POST',  '/v1/user-career-plans',                                            'piano_carriera',             'piano_carriera',         'risposta:userCareerPlanId',      NULL),
  ('POST',  '/v1/user-target-positions/:id/review',                             'posizione_obiettivo_valutata','posizione_obiettivo',   'param:id',                       NULL),
  ('POST',  '/v1/goals',                                                        'obiettivo_assegnato',        'obiettivo',              'risposta:goalId',                NULL),
  ('POST',  '/v1/me/learning/enrollments',                                      'formazione_scelta',          'iscrizione_formazione',  'risposta:userLearningAssignmentId', NULL),
  ('POST',  '/v1/engagement-feedback/action-plans',                             'piano_azione_engagement',    'piano_azione',           'risposta:actionPlanId',          NULL),
  ('POST',  '/v1/delegations',                                                  'delega_concessa',            'delega',                 'risposta:delegationId',          NULL),
  ('POST',  '/v1/me/delegations',                                               'delega_concessa',            'delega',                 'risposta:delegationId',          NULL),
  ('POST',  '/v1/delegations/:id/revoke',                                       'delega_revocata',            'delega',                 'param:id',                       NULL),
  ('POST',  '/v1/me/delegations/:id/revoke',                                    'delega_revocata',            'delega',                 'param:id',                       NULL),
  ('POST',  '/v1/tenant-consolidations/proposals/:proposalId/decision',         'consolidamento_deciso',      'proposta_consolidamento','param:proposalId',               'corpo:decision'),
  ('POST',  '/v1/tenant-consolidations/proposals/confirm-certain',              'consolidamento_deciso',      'proposta_consolidamento','corpo:proposalIds[]',            NULL),
  ('POST',  '/v1/organization-units',                                           'unita_disegnata',            'unita_organizzativa',    'risposta:organizationUnitId',    NULL),
  ('PATCH', '/v1/organization-units/:id',                                       'unita_disegnata',            'unita_organizzativa',    'param:id',                       NULL),
  ('POST',  '/v1/positions',                                                    'posizione_disegnata',        'posizione',              'risposta:positionId',            NULL),
  ('PATCH', '/v1/positions/:id',                                                'posizione_disegnata',        'posizione',              'param:id',                       NULL),
  ('POST',  '/v1/organization-unit-processes',                                  'processo_affidato',          'processo_di_unita',      'risposta:orgUnitProcessId',      NULL),
  ('PUT',   '/v1/tenant-blueprints/:id/versions/:number/processes/:processId',  'processo_di_modello_deciso', 'processo_di_modello',    'param:processId',                NULL)
ON CONFLICT (metodo, rotta) DO UPDATE
   SET codice = EXCLUDED.codice, oggetto_tipo = EXCLUDED.oggetto_tipo,
       oggetto_da = EXCLUDED.oggetto_da, esito_da = EXCLUDED.esito_da, updated_at = now()
 WHERE (audit.valore_rotte_decisione.codice, audit.valore_rotte_decisione.oggetto_tipo,
        audit.valore_rotte_decisione.oggetto_da, audit.valore_rotte_decisione.esito_da)
   IS DISTINCT FROM (EXCLUDED.codice, EXCLUDED.oggetto_tipo, EXCLUDED.oggetto_da, EXCLUDED.esito_da);

-- ---------------------------------------------------------------------------
-- 5. GDPR: l'attore è AUTORE, non soggetto (000216); registro di accountability (000304)
-- ---------------------------------------------------------------------------
INSERT INTO sys.sys_gdpr_data_map (
  gdpr_map_table_schema, gdpr_map_table_name, gdpr_map_subject_fk,
  gdpr_map_data_class, gdpr_map_erasure_strategy, gdpr_map_reference_kind,
  gdpr_map_legal_basis
) VALUES
  ('audit', 'valore_eventi', 'valore_evento_attore_user_id',
   'OPERATIONAL', 'RETAIN', 'ACTOR',
   'Registro di chi ha preso quale decisione e da quale pagina o agente (F0-3): accountability delle '
   'decisioni. La persona ne è autrice, l''oggetto può riguardare altri: fuori dal fascicolo art. 15.')
ON CONFLICT (gdpr_map_table_schema, gdpr_map_table_name, gdpr_map_subject_fk) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. La definizione unica, eseguibile: le decisioni tracciabili
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW sys.v_valore_decisioni_tracciabili AS
SELECT
  e.valore_evento_id                AS evento_id,
  e.valore_evento_tenant_id         AS tenant_id,
  e.valore_evento_attore_user_id    AS attore_user_id,
  e.valore_evento_attore_tipo       AS attore_tipo,
  e.valore_evento_decisione_codice  AS decisione,
  t.categoria                       AS categoria,
  e.valore_evento_oggetto_tipo      AS oggetto_tipo,
  e.valore_evento_oggetto_id        AS oggetto_id,
  e.valore_evento_esito             AS esito,
  e.valore_evento_superficie_tipo   AS superficie_tipo,
  e.valore_evento_superficie        AS superficie,
  e.valore_evento_avvenuto_il       AS avvenuto_il
FROM audit.valore_eventi e
JOIN audit.valore_tipi_decisione t ON t.codice = e.valore_evento_decisione_codice
WHERE e.valore_evento_tipo = 'decisione'
  AND e.valore_evento_superficie_tipo IN ('pagina', 'agente')
  AND e.valore_evento_oggetto_tipo IS NOT NULL
  AND e.valore_evento_oggetto_id IS NOT NULL;

COMMENT ON VIEW sys.v_valore_decisioni_tracciabili IS
  '000469 (F0-3) — LA definizione di decisione tracciabile: chi, che cosa (catalogo chiuso), su che '
  'cosa, quando, da quale pagina o agente. INFORMATIVA: zero righe finché nessuno ha deciso.';

-- ---------------------------------------------------------------------------
-- 7. La misura: per tenant e per settimana (lunedì, ora di Roma)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW sys.v_valore_settimana AS
WITH ev AS (
  SELECT e.*,
         date_trunc('week', e.valore_evento_avvenuto_il AT TIME ZONE 'Europe/Rome')::date AS settimana,
         (e.valore_evento_tipo = 'decisione'
          AND e.valore_evento_superficie_tipo IN ('pagina', 'agente')
          AND e.valore_evento_oggetto_tipo IS NOT NULL
          AND e.valore_evento_oggetto_id IS NOT NULL) AS tracciabile
    FROM audit.valore_eventi e
)
SELECT
  ev.valore_evento_tenant_id                                                     AS tenant_id,
  tn.tenant_code                                                                 AS tenant_codice,
  ev.settimana                                                                   AS settimana,
  count(*) FILTER (WHERE ev.tracciabile)::int                                    AS decisioni_tracciabili,
  count(*) FILTER (WHERE ev.tracciabile AND ev.valore_evento_attore_tipo = 'persona')::int AS da_persona,
  count(*) FILTER (WHERE ev.tracciabile AND ev.valore_evento_attore_tipo = 'agente')::int  AS da_agente,
  count(DISTINCT ev.valore_evento_attore_user_id) FILTER (WHERE ev.tracciabile)::int       AS decisori_distinti,
  count(DISTINCT (ev.valore_evento_oggetto_tipo, ev.valore_evento_oggetto_id)) FILTER (WHERE ev.tracciabile)::int AS oggetti_decisi,
  count(DISTINCT ev.valore_evento_decisione_codice) FILTER (WHERE ev.tracciabile)::int     AS tipi_di_decisione,
  count(*) FILTER (WHERE ev.valore_evento_tipo = 'decisione' AND NOT ev.tracciabile)::int  AS decisioni_senza_traccia,
  count(DISTINCT ev.valore_evento_attore_user_id) FILTER (WHERE ev.valore_evento_tipo = 'uso')::int AS persone_attive,
  count(*) FILTER (WHERE ev.valore_evento_tipo = 'uso')::int                     AS usi_orari
FROM ev
JOIN sys.sys_tenancies tn ON tn.tenant_id = ev.valore_evento_tenant_id
GROUP BY ev.valore_evento_tenant_id, tn.tenant_code, ev.settimana;

COMMENT ON VIEW sys.v_valore_settimana IS
  '000469 (F0-3) — il test del valore come misura: per tenant e per settimana (lunedì, ora di Roma) '
  'le decisioni tracciabili, chi le ha prese (persona o agente), su quanti oggetti, e quante persone '
  'hanno usato pagine o agenti. INFORMATIVA.';

-- ---------------------------------------------------------------------------
-- 8. Post-condizioni: la migrazione verifica se stessa e fallisce forte
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  n_tipi    integer;
  n_rotte   integer;
  n_orfani  integer;
  n_viste   integer;
  n_gdpr    integer;
BEGIN
  SELECT count(*) INTO n_tipi FROM audit.valore_tipi_decisione WHERE attivo;
  SELECT count(*) INTO n_rotte FROM audit.valore_rotte_decisione;
  IF n_tipi < 20 OR n_rotte < 26 THEN
    RAISE EXCEPTION '000469: catalogo incompleto (% tipi attivi, attesi almeno 20; % rotte, attese almeno 26)', n_tipi, n_rotte;
  END IF;

  -- ogni tipo attivo ha almeno una rotta: un verbo senza rotta non verrebbe mai contato
  SELECT count(*) INTO n_orfani
    FROM audit.valore_tipi_decisione t
   WHERE t.attivo AND NOT EXISTS (SELECT 1 FROM audit.valore_rotte_decisione r WHERE r.codice = t.codice);
  IF n_orfani <> 0 THEN
    RAISE EXCEPTION '000469: % tipi di decisione attivi senza alcuna rotta', n_orfani;
  END IF;

  SELECT count(*) INTO n_viste FROM pg_views
   WHERE schemaname = 'sys' AND viewname IN ('v_valore_decisioni_tracciabili', 'v_valore_settimana');
  IF n_viste <> 2 THEN
    RAISE EXCEPTION '000469: viste attese 2 in sys, trovate %', n_viste;
  END IF;

  SELECT count(*) INTO n_gdpr FROM sys.sys_gdpr_data_map
   WHERE gdpr_map_table_schema = 'audit' AND gdpr_map_table_name = 'valore_eventi'
     AND gdpr_map_subject_fk = 'valore_evento_attore_user_id' AND gdpr_map_reference_kind = 'ACTOR';
  IF n_gdpr <> 1 THEN
    RAISE EXCEPTION '000469: la colonna attore non è classificata ACTOR nel registro GDPR (%)', n_gdpr;
  END IF;

  PERFORM count(*) FROM sys.v_valore_settimana;
  RAISE NOTICE '000469 ok: % tipi, % rotte, viste interrogabili', n_tipi, n_rotte;
END $$;

COMMIT;

-- FINE 000469
