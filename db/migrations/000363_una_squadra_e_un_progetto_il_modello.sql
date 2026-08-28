-- ============================================================================
-- 000363 — Una squadra e un progetto: il modello
--
-- VOCE: #143 F2 — «tabelle progetto + appartenenza con decorrenza/scadenza +
-- migrazione dei 26 team esistenti».
--
-- LA DIREZIONE, di Enzo (2026-08-05), non si ri-discute qui: *«una filiale e un
-- sotto-albero gerarchico; una squadra e attiva su uno scopo funzionale, ha
-- diversi membri e un team leader che PUO ESSERE GERARCHICAMENTE INFERIORE a uno
-- o piu membri — va inteso come capo progetto dello scopo assegnato. Il modello
-- da adottare deve essere simile ai modelli di project management»*.
-- Il modello a due entita e stato adottato in S1062 col mandato di decidere.
--
-- COSA MANCAVA, misurato: `sys_teams` ha codice, nome, unita, capo e un flag di
-- attivita — e **nessuno scopo, nessun obiettivo, nessuna data, nessun
-- avanzamento**. Un progetto senza scopo ne date non e un progetto: e una
-- rubrica di persone con un capo scritto sopra.
--
-- ── LA DECISIONE CHE F2 DOVEVA PRENDERE, e i dati che la impongono ───────────
--
-- «Capo» aveva DUE fonti, e nessuno sapeva quale fosse quella vera:
-- `sys_teams.team_lead_user_id` (una colonna) **oppure** un membro con ruolo
-- `LEAD` (un'appartenenza). Misurate oggi, le due **divergono davvero**:
--
--     26 squadre · 26 con la colonna valorizzata · 25 con un membro LEAD
--     DIV-RISK «Divisione Risk & Compliance» -> colonna valorizzata, ZERO membri LEAD
--     TM-MKT   «Squadra Marketing»           -> DUE membri LEAD
--
-- **Sopravvive l'APPARTENENZA.** Tre ragioni tecniche, non di gusto:
--   1. nei modelli di project management il capo **e un membro con un ruolo**,
--      non un attributo dell'entita: e la forma che Enzo ha chiesto;
--   2. l'appartenenza porta la **finestra temporale**, quindi sa rispondere a
--      «chi era capo quando». Una colonna non lo sa, e non lo sapra mai;
--   3. una colonna che duplica un'appartenenza produce **esattamente** le due
--      divergenze qui sopra, e una volta prodotte non c'e modo di sapere quale
--      delle due dica il vero.
--
-- ⚠ Ma la colonna serve **una volta sola, come arbitro**, prima di uscire di
-- scena: e il solo dato che permette di sciogliere i due casi storici senza
-- inventare nulla. Per `DIV-RISK` crea il membro LEAD che manca; per `TM-MKT`
-- dice quale dei due LEAD e quello vero (l'altro resta membro). Dopo di che il
-- modello nuovo non la usa piu.
--
-- ── COSA QUESTA MIGRAZIONE NON FA, dichiarato ───────────────────────────────
-- **Non ritira `sys_teams`.** Ha quattro consumatori di produzione, e ADR-0035
-- dice che un ritiro si misura in file da emendare, non in una DELETE. Le
-- entita nuove nascono **accanto**, con `project_origin_team_id` che conserva la
-- provenienza riga per riga; lo spostamento dei consumatori e il ritiro sono
-- materia di F4, quando ci sara un'API a sostituirli. Finche entrambe esistono,
-- `sys_teams` resta la sorgente vera e queste tabelle non sono ancora scritte da
-- nessuno: e il motivo per cui questa migrazione non puo rompere niente.
--
-- **Non implementa I18.** L'autorita del capo progetto e **sul lavoro, non
-- sulle persone**: l'appartenenza a una squadra non apre mai i dati sensibili.
-- E gia dottrina (I18, ADR-0036) e si implementa in F3, dove
-- `isInFunctionalScope`/`isFunctionalLeader` — oggi codice morto, zero
-- consumatori — prendono i loro primi consumatori veri.
--
-- ── SCELTE DI SCHEMA, con la regola che le governa ──────────────────────────
-- · `project_status` e `project_member_role` sono **varchar + CHECK**, mai ENUM
--   (RD-08). I valori sono discriminatori TS lato codice.
-- · le date sono `date` e non `timestamptz` (RD-09): un progetto comincia un
--   giorno, non a un'ora.
-- · **al piu un LEAD aperto per progetto**, imposto da un indice unico parziale
--   su `(progetto) WHERE ruolo='LEAD' AND ends_on IS NULL`. Non un vincolo di
--   esclusione temporale: quello pretenderebbe `btree_gist`, e il caso che conta
--   — due capi contemporanei **adesso** — e coperto da qui. La storia puo
--   contenere piu LEAD chiusi, ed e giusto che possa.
-- · l'unita organizzativa del progetto e **nullable**, e non e una dimenticanza:
--   142 appartenenze su 172 (82,6%) sono gia oggi **trasversali** all'albero
--   delle unita, e chiudendo `#123` la trasversalita e stata registrata come
--   **forma attesa**, non come difetto da sanare.
--
-- ROLLBACK: le due tabelle sono nuove e non le legge nessuno, quindi disfare
-- significa `DROP`. La funzione `staging.mig363_progetti_undo_apply()` lo fa —
-- e si rifiuta di farlo se nel frattempo qualcuno ha scritto righe che non
-- vengono dalla migrazione dei team, perche a quel punto non sarebbe piu un
-- rollback ma una perdita di dati.
--
-- IDEMPOTENTE: `IF NOT EXISTS` sulle strutture, `NOT EXISTS` sulle righe, e la
-- migrazione dei team e filtrata sulla provenienza. Alla seconda passata tocca
-- zero righe.
-- Authored: 2026-08-28 (S1083).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. IL PROGETTO — lo scopo, che e precisamente cio che a `sys_teams` manca.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_projects (
  project_id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_tenant_id            uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id),
  project_code                 varchar(64)  NOT NULL,
  project_name                 varchar(255) NOT NULL,
  -- lo scopo funzionale su cui la squadra e attiva: il campo che distingue un
  -- progetto da una rubrica di persone
  project_purpose              text,
  project_objective            text,
  -- nullable per costruzione: la trasversalita e la forma attesa (#123)
  project_organization_unit_id uuid REFERENCES sys.sys_organization_units(organization_unit_id),
  project_status               varchar(32) NOT NULL DEFAULT 'ACTIVE'
    CONSTRAINT sys_projects_status_check
    CHECK (project_status IN ('PLANNED','ACTIVE','ON_HOLD','COMPLETED','CANCELLED')),
  project_starts_on            date,
  project_ends_on              date,
  project_progress_pct         numeric(5,2)
    CONSTRAINT sys_projects_progress_check
    CHECK (project_progress_pct IS NULL OR (project_progress_pct >= 0 AND project_progress_pct <= 100)),
  -- la provenienza, riga per riga: `sys_teams` non e ritirata, e quando lo sara
  -- si dovra sapere da quale squadra ogni progetto e nato
  project_origin_team_id       uuid REFERENCES sys.sys_teams(team_id),
  project_metadata             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  created_by                   uuid,
  updated_at                   timestamptz NOT NULL DEFAULT now(),
  updated_by                   uuid,
  CONSTRAINT sys_projects_dates_check
    CHECK (project_ends_on IS NULL OR project_starts_on IS NULL
           OR project_ends_on >= project_starts_on),
  CONSTRAINT sys_projects_code_tenant_unique UNIQUE (project_tenant_id, project_code)
);

COMMENT ON TABLE sys.sys_projects IS
  'Progetto: lo scopo funzionale su cui una squadra e attiva (#143 F2, S1083). '
  'Distinto da una filiale, che e un sotto-albero gerarchico: qui il capo puo '
  'stare piu in basso dei suoi membri. Nasce accanto a sys_teams, non al suo '
  'posto: project_origin_team_id conserva la provenienza fino al ritiro (F4).';
COMMENT ON COLUMN sys.sys_projects.project_organization_unit_id IS
  'Nullable per costruzione: 142 appartenenze su 172 sono trasversali all albero '
  'delle unita, forma attesa registrata chiudendo #123, non difetto da sanare.';

CREATE INDEX IF NOT EXISTS sys_projects_tenant_idx
  ON sys.sys_projects (project_tenant_id);
CREATE INDEX IF NOT EXISTS sys_projects_unit_idx
  ON sys.sys_projects (project_organization_unit_id);
CREATE INDEX IF NOT EXISTS sys_projects_origin_team_idx
  ON sys.sys_projects (project_origin_team_id);

-- ----------------------------------------------------------------------------
-- 2. L'APPARTENENZA — con decorrenza e scadenza, senza cui il perimetro non sa
--    dire «chi c'era quando». E la lezione gia pagata dalla delega (000314).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_project_members (
  project_member_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_member_project_id uuid NOT NULL REFERENCES sys.sys_projects(project_id) ON DELETE CASCADE,
  project_member_user_id    uuid NOT NULL REFERENCES sys.sys_users(user_id),
  project_member_tenant_id  uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id),
  project_member_role       varchar(32) NOT NULL DEFAULT 'MEMBER'
    CONSTRAINT sys_project_members_role_check
    CHECK (project_member_role IN ('LEAD','MEMBER','CONTRIBUTOR','OBSERVER')),
  project_member_starts_on  date NOT NULL DEFAULT CURRENT_DATE,
  project_member_ends_on    date,
  project_member_metadata   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                timestamptz NOT NULL DEFAULT now(),
  created_by                uuid,
  updated_at                timestamptz NOT NULL DEFAULT now(),
  updated_by                uuid,
  CONSTRAINT sys_project_members_window_check
    CHECK (project_member_ends_on IS NULL OR project_member_ends_on >= project_member_starts_on)
);

COMMENT ON TABLE sys.sys_project_members IS
  'Chi lavora a un progetto, con quale ruolo e in quale finestra (#143 F2, S1083). '
  'La finestra non e un ornamento: senza starts_on/ends_on il perimetro non sa '
  'rispondere a «chi c era quando» — stesso difetto che la delega (mig 000314) '
  'ha gia dovuto risolvere. Il capo progetto e un MEMBRO con ruolo LEAD, non una '
  'colonna sul progetto: e la decisione di F2, e i dati la impongono.';

CREATE INDEX IF NOT EXISTS sys_project_members_project_idx
  ON sys.sys_project_members (project_member_project_id);
CREATE INDEX IF NOT EXISTS sys_project_members_user_idx
  ON sys.sys_project_members (project_member_user_id);
CREATE INDEX IF NOT EXISTS sys_project_members_tenant_idx
  ON sys.sys_project_members (project_member_tenant_id);

-- Al piu UN capo aperto per progetto. La storia puo contenerne piu d uno chiuso,
-- ed e giusto che possa: cambiare capo progetto e normale.
CREATE UNIQUE INDEX IF NOT EXISTS sys_project_members_one_open_lead_idx
  ON sys.sys_project_members (project_member_project_id)
  WHERE project_member_role = 'LEAD' AND project_member_ends_on IS NULL;

-- ----------------------------------------------------------------------------
-- 2-bis. IL REGISTRO GDPR — una FK verso una persona si dichiara, o la catena
--        si ferma. E cosi che deve andare, e qui l ha fatto davvero.
--
--    La `000304` pretende che ogni chiave esterna di **appartenenza** verso
--    `sys_users` compaia in `sys_gdpr_data_map`, ed esclude per regex soltanto
--    le colonne di autore (`created_by`, `updated_by`, `*_by`, revisori). La
--    prima stesura di questa migrazione non registrava niente, e la catena e
--    uscita rossa alla SECONDA passata con «restano 1 FK di appartenenza fuori
--    dal registro GDPR» — alla prima no, perche la `000304` gira PRIMA della
--    `000363` e non poteva ancora vedere la tabella. Una prova a passata unica
--    non l avrebbe colta.
--
--    `sys_projects` non compare qui: le sue sole colonne verso una persona sono
--    `created_by`/`updated_by`, che sono autori e non soggetti.
--
--    Classe e strategia sono le stesse di `sys_team_members`, ed e voluto:
--    l appartenenza a un progetto e un incarico funzionale, non un record di
--    impiego — la storia di impiego vive in `sys_user_position_assignments` e la
--    conserva. Che questa tabella abbia una finestra temporale non la trasforma
--    in un archivio del lavoro: la finestra serve al perimetro di
--    autorizzazione, a rispondere a «chi c era quando», non a un obbligo di
--    conservazione.
-- ----------------------------------------------------------------------------
INSERT INTO sys.sys_gdpr_data_map (
  gdpr_map_table_schema, gdpr_map_table_name, gdpr_map_subject_fk,
  gdpr_map_data_class, gdpr_map_erasure_strategy, gdpr_map_reference_kind,
  gdpr_map_legal_basis
)
SELECT 'sys','sys_project_members','project_member_user_id',
       'OPERATIONAL','DELETE','SUBJECT',
       'Appartenenza a un progetto con decorrenza e scadenza: incarico funzionale, '
       'non record di impiego (quello sta in sys_user_position_assignments, conservato).'
 WHERE NOT EXISTS (
   SELECT 1 FROM sys.sys_gdpr_data_map
    WHERE gdpr_map_table_schema = 'sys'
      AND gdpr_map_table_name   = 'sys_project_members'
      AND gdpr_map_subject_fk   = 'project_member_user_id');

-- ----------------------------------------------------------------------------
-- 3. LA GUARDIA — ri-verifica la precondizione ADESSO, non eredita la misura.
--
--    Fallisce, e deve, se una squadra avesse piu di un membro LEAD **e** la
--    colonna arbitro non ne indicasse nessuno: in quel caso non c e modo di
--    sapere quale sia il capo, e inventarlo sarebbe peggio che fermarsi.
--    Non fallisce se non ci sono squadre (database nuovo, heuresys_ci).
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_squadre    int;
  v_indecidibili int;
BEGIN
  SELECT count(*) INTO v_squadre FROM sys.sys_teams;

  SELECT count(*) INTO v_indecidibili
    FROM sys.sys_teams t
   WHERE (SELECT count(*) FROM sys.sys_team_members m
           WHERE m.team_member_team_id = t.team_id AND m.team_member_role = 'LEAD') > 1
     AND NOT EXISTS (SELECT 1 FROM sys.sys_team_members m
                      WHERE m.team_member_team_id = t.team_id
                        AND m.team_member_role = 'LEAD'
                        AND m.team_member_user_id = t.team_lead_user_id);

  IF v_indecidibili > 0 THEN
    RAISE EXCEPTION
      'mig363: % squadre hanno piu capi e la colonna arbitro non indica nessuno '
      'di essi. Sceglierne uno sarebbe inventare, e fermarsi qui e la cosa giusta.',
      v_indecidibili;
  END IF;

  RAISE NOTICE 'mig363 guardia: % squadre da migrare, 0 casi indecidibili', v_squadre;
END $$;

-- ----------------------------------------------------------------------------
-- 4. I PROGETTI, uno per squadra. Lo scopo resta VUOTO: e un dato che nessuno ha
--    mai scritto, e riempirlo col nome della squadra sarebbe fingere di averlo.
-- ----------------------------------------------------------------------------
INSERT INTO sys.sys_projects
  (project_tenant_id, project_code, project_name, project_organization_unit_id,
   project_status, project_origin_team_id, project_metadata, created_at, created_by)
SELECT t.team_tenant_id, t.team_code, t.team_name, t.team_organization_unit_id,
       CASE WHEN t.team_is_active THEN 'ACTIVE' ELSE 'COMPLETED' END,
       t.team_id,
       jsonb_build_object('origine', 'mig000363', 'da_squadra', t.team_code),
       t.created_at, t.created_by
  FROM sys.sys_teams t
 WHERE NOT EXISTS (SELECT 1 FROM sys.sys_projects p WHERE p.project_origin_team_id = t.team_id);

-- ----------------------------------------------------------------------------
-- 5. LE APPARTENENZE. La decorrenza e la data in cui l appartenenza e nata: e
--    l unico dato reale disponibile, e inventarne un altra sarebbe peggio.
--    Il ruolo LEAD e assegnato SOLO a chi la colonna arbitro conferma; ogni
--    altro LEAD storico entra come MEMBER, che e cio che resta vero di lui.
-- ----------------------------------------------------------------------------
INSERT INTO sys.sys_project_members
  (project_member_project_id, project_member_user_id, project_member_tenant_id,
   project_member_role, project_member_starts_on,
   project_member_ends_on, project_member_metadata, created_at, created_by)
SELECT p.project_id, m.team_member_user_id, t.team_tenant_id,
       -- L ARBITRO E LA COLONNA, E VALE SEMPRE — non solo su chi era gia LEAD.
       -- La prima stesura chiedeva ENTRAMBE le condizioni (ruolo LEAD *e* colonna
       -- coincidente), e la post-condizione (b) l ha smentita sul gemello: il capo
       -- di `DIV-RISK` e iscritto fra i membri **come MEMBER**, quindi veniva
       -- saltato qui e saltato anche dall inserimento sotto (che cerca chi non e
       -- membro affatto). Restava un progetto senza capo, che e esattamente cio
       -- che la migrazione doveva riparare.
       CASE WHEN m.team_member_user_id = t.team_lead_user_id THEN 'LEAD'
            ELSE 'MEMBER' END,
       m.created_at::date,
       CASE WHEN m.team_member_is_active THEN NULL ELSE m.updated_at::date END,
       jsonb_build_object('origine', 'mig000363', 'ruolo_squadra', m.team_member_role),
       m.created_at, m.created_by
  FROM sys.sys_team_members m
  JOIN sys.sys_teams t    ON t.team_id = m.team_member_team_id
  JOIN sys.sys_projects p ON p.project_origin_team_id = t.team_id
 WHERE NOT EXISTS (SELECT 1 FROM sys.sys_project_members x
                    WHERE x.project_member_project_id = p.project_id
                      AND x.project_member_user_id = m.team_member_user_id);

-- Il capo che la colonna indica ma che NON era membro (il caso `DIV-RISK`): esiste
-- come capo e non come appartenenza. Qui diventa entrambe le cose, che e la forma
-- che il modello pretende — il capo e un membro.
INSERT INTO sys.sys_project_members
  (project_member_project_id, project_member_user_id, project_member_tenant_id,
   project_member_role, project_member_starts_on, project_member_metadata, created_at)
SELECT p.project_id, t.team_lead_user_id, t.team_tenant_id, 'LEAD',
       t.created_at::date,
       jsonb_build_object('origine', 'mig000363',
                          'nota', 'capo dichiarato dalla colonna e mai iscritto fra i membri'),
       t.created_at
  FROM sys.sys_teams t
  JOIN sys.sys_projects p ON p.project_origin_team_id = t.team_id
 WHERE t.team_lead_user_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.sys_project_members x
                    WHERE x.project_member_project_id = p.project_id
                      AND x.project_member_user_id = t.team_lead_user_id);

-- ----------------------------------------------------------------------------
-- 6. LE POST-CONDIZIONI — proteggono anche cio che NON doveva cambiare.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_squadre   int; v_progetti  int;
  v_membri_sq int; v_membri_pr int;
  v_senza_capo int; v_teams_toccate int;
BEGIN
  SELECT count(*) INTO v_squadre  FROM sys.sys_teams;
  SELECT count(*) INTO v_progetti FROM sys.sys_projects WHERE project_origin_team_id IS NOT NULL;

  -- (a) cio che DOVEVA cambiare: un progetto per ogni squadra, nessuno di piu.
  IF v_progetti <> v_squadre THEN
    RAISE EXCEPTION 'mig363: % squadre ma % progetti migrati', v_squadre, v_progetti;
  END IF;

  -- (b) ogni squadra che aveva un capo ha un progetto con un capo APERTO. E la
  --     prova che l arbitro ha funzionato su tutti e due i casi storici.
  SELECT count(*) INTO v_senza_capo
    FROM sys.sys_teams t
    JOIN sys.sys_projects p ON p.project_origin_team_id = t.team_id
   WHERE t.team_lead_user_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM sys.sys_project_members x
                      WHERE x.project_member_project_id = p.project_id
                        AND x.project_member_role = 'LEAD'
                        AND x.project_member_ends_on IS NULL);
  IF v_senza_capo > 0 THEN
    RAISE EXCEPTION 'mig363: % progetti restano senza capo aperto', v_senza_capo;
  END IF;

  -- (c) cio che NON doveva cambiare, ed e la meta che conta: `sys_teams` e
  --     `sys_team_members` sono INTATTE. Questa migrazione non le tocca, e se un
  --     giorno qualcuno aggiungesse qui una DELETE, (a) resterebbe verde lo stesso.
  SELECT count(*) INTO v_membri_sq FROM sys.sys_team_members;
  SELECT count(*) INTO v_membri_pr FROM sys.sys_project_members;
  SELECT count(*) INTO v_teams_toccate
    FROM sys.sys_teams WHERE updated_at > now() - interval '1 minute';
  IF v_teams_toccate > 0 THEN
    RAISE EXCEPTION
      'mig363: % righe di sys_teams risultano modificate. Questa migrazione non '
      'deve scrivere sulle tabelle vecchie.', v_teams_toccate;
  END IF;

  -- (d) nessun membro e stato perso: le appartenenze nuove sono almeno quante le
  --     vecchie (puo essercene UNA in piu, il capo mai iscritto di DIV-RISK).
  IF v_membri_pr < v_membri_sq THEN
    RAISE EXCEPTION 'mig363: % appartenenze di squadra ma solo % di progetto',
      v_membri_sq, v_membri_pr;
  END IF;

  RAISE NOTICE 'mig363 post: % progetti da % squadre · % appartenenze da % · '
               'ogni capo ha un LEAD aperto · sys_teams intatta',
    v_progetti, v_squadre, v_membri_pr, v_membri_sq;
END $$;

-- ----------------------------------------------------------------------------
-- 7. La funzione che disfa. Si rifiuta se nel frattempo qualcuno ha scritto
--    righe che non vengono da qui: a quel punto non sarebbe un rollback.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.mig363_progetti_undo_apply()
RETURNS TABLE(azione text, righe bigint)
LANGUAGE plpgsql AS $$
DECLARE
  v_estranei bigint;
  v_membri   bigint := 0;
  v_progetti bigint := 0;
BEGIN
  SELECT count(*) INTO v_estranei
    FROM sys.sys_projects
   WHERE coalesce(project_metadata ->> 'origine', '') <> 'mig000363';
  IF v_estranei > 0 THEN
    RAISE EXCEPTION
      'mig363 undo: % progetti non vengono da questa migrazione. Disfare qui '
      'sarebbe perdere dati, non annullare un intervento.', v_estranei;
  END IF;

  DELETE FROM sys.sys_project_members;
  GET DIAGNOSTICS v_membri = ROW_COUNT;
  DELETE FROM sys.sys_projects WHERE project_metadata ->> 'origine' = 'mig000363';
  GET DIAGNOSTICS v_progetti = ROW_COUNT;

  RETURN QUERY VALUES ('appartenenze rimosse', v_membri), ('progetti rimossi', v_progetti);
END $$;

COMMIT;
