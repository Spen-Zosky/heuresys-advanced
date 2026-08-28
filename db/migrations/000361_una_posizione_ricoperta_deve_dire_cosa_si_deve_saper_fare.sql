-- ============================================================================
-- 000361 — Una posizione ricoperta deve dire cosa ci si deve saper fare
--
-- VOCE: #234 F2, firma `X5d` — «Posizione ricoperta che non dichiara alcun
-- requisito formativo». Misurato il 2026-08-28 con la query del check:
-- **1 riga su 161** — `Risk Manager`, ricoperta da martina.gentile@rtl-bank.org.
--
-- Per chi ricopre quella posizione non esiste un atteso formativo: nessuna
-- lacuna e calcolabile, nessun corso e giustificabile. E non e un caso isolato
-- di una riga: misurando la famiglia intera, **nessuna** delle posizioni con
-- ruolo `RTL-ROLE-RISK-MANAGER` o `RTL-ROLE-RISK-ANALYST` dichiara requisiti —
-- zero su tutte. Il controllo ne mostra una sola perche guarda le posizioni
-- **ricoperte**, e le Risk Analyst sono oggi tutte vacanti. Curare la sola riga
-- rossa lascerebbe la mina innescata: basta assegnare una persona a una Risk
-- Analyst e il controllo si riaccende domani.
--
-- LA CAUSA, letta nel file che crea l-oggetto e non dedotta: i requisiti
-- formativi arrivarono da `job_title_courses` del sistema legacy (seed
-- `11_position_learning_requirements.sql`), mappati per RUOLO. I ruoli del
-- rischio non avevano corsi associati la, quindi non ci fu niente da importare.
-- E il rubinetto del brownfield e CHIUSO (I12 / ADR-0038): non se ne possono
-- pescare altri. Cio che manca **si costruisce o si deriva da cio che `sys.*`
-- gia contiene** — ed e esattamente quello che si fa qui.
--
-- LA DERIVAZIONE, e perche non e invenzione. Il tenant RTL Bank possiede gia
-- **sei percorsi formativi sul rischio**, censiti e non supposti:
--     FRM-P1-001  FRM Part I  - Financial Risk Manager Foundations
--     FRM-P2-001  FRM Part II - Advanced Risk Management
--     CRISK-101   Credit Risk Analysis Fundamentals
--     MRISK-101   Market Risk Management
--     OPRISK-101  Operational Risk Management
--     LRISK-101   Liquidity Risk Management
-- Sono contenuto del tenant, coerenti con la sua industry (`FIN_BANKING`, I21),
-- e non nominano nulla che non esista. Non si scrive un percorso nuovo: si
-- dichiara quale dei percorsi gia presenti una posizione pretende.
--
-- IL CRITERIO DI ASSEGNAZIONE, dichiarato perche sia sindacabile — e la sola
-- parte di questa migrazione che e un giudizio, quindi va letta come tale:
--   · **Risk Manager** governa il rischio nel suo complesso: obbligatori
--     entrambi i livelli FRM (fondamenta + avanzato) e i quattro rischi
--     specialistici, perche un responsabile deve saper leggere ciascuno di essi.
--     -> 6 requisiti, tutti `is_mandatory = true`.
--   · **Risk Analyst** e il ruolo operativo: obbligatorio il solo FRM Part I,
--     che e la fondamenta comune; i quattro specialistici restano **facoltativi**,
--     perche un analista si specializza su uno o due, non su tutti, e FRM Part II
--     e materia da responsabile.
--     -> 1 obbligatorio + 4 facoltativi.
-- La forma segue quella gia in uso nella tabella: `deadline_rule = {}` su tutte
-- le 1.733 righe esistenti, e `is_mandatory` che vale true su 765 e false su 968.
--
-- QUELLO CHE QUESTA MIGRAZIONE NON FA, dichiarato: non assegna corsi alle
-- persone. `sys_position_learning_requirements` dice cosa la POSIZIONE pretende;
-- che poi qualcuno lo abbia svolto e materia di `X5b`, che e verde.
--
-- NESSUN FILE DELLA CATENA RICREA QUESTE RIGHE — verificato: il solo seed che
-- popola la tabella e `11_position_learning_requirements.sql`, che mappa per
-- codice di ruolo legacy e non nomina i ruoli del rischio. Non c-e quindi un
-- file da emendare ai sensi di ADR-0035: la cura a valle regge, e questo e il
-- motivo per cui regge.
--
-- ROLLBACK: giornale `staging.mig361_requisiti_rischio_undo` + la funzione
-- `staging.mig361_requisiti_rischio_undo_apply()`.
--
-- IDEMPOTENTE: ogni inserimento e filtrato con NOT EXISTS sulla coppia
-- (posizione, percorso). Alla seconda passata tocca zero righe.
-- Authored: 2026-08-28 (S1083).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. Il giornale di annullamento, PRIMA di qualunque scrittura.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staging.mig361_requisiti_rischio_undo (
  undo_id      bigserial PRIMARY KEY,
  migrazione   text        NOT NULL,
  requisito_id uuid        NOT NULL,
  position_id  uuid        NOT NULL,
  learning_path_id uuid    NOT NULL,
  creato_il    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE staging.mig361_requisiti_rischio_undo IS
  'Giornale di annullamento dei requisiti formativi assegnati alle posizioni della '
  'famiglia rischio (X5d, #234 F2, S1083). Conserva le chiavi delle righe create, '
  'perche disfare qui significa cancellare cio che si e aggiunto. Si applica al '
  'contrario con staging.mig361_requisiti_rischio_undo_apply().';

-- ----------------------------------------------------------------------------
-- 1. LA GUARDIA — ri-verifica la precondizione ADESSO, non eredita la misura.
--
--    Fallisce, e deve, se i percorsi formativi citati non esistono: assegnare un
--    requisito verso un percorso inesistente creerebbe una riga che non significa
--    niente, cioe sostituirebbe un buco con un errore. Non fallisce invece se le
--    posizioni non ci sono (database nuovo, heuresys_ci): la deve poter girare.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_percorsi  int;
  v_posizioni int;
  v_mancanti  text;
BEGIN
  SELECT count(*) INTO v_percorsi
    FROM sys.sys_learning_paths
   WHERE learning_path_code IN ('FRM-P1-001','FRM-P2-001','CRISK-101',
                                'MRISK-101','OPRISK-101','LRISK-101');

  SELECT count(*) INTO v_posizioni
    FROM sys.sys_positions p
    JOIN sys.sys_job_roles jr ON jr.job_role_id = p.position_job_role_id
   WHERE jr.job_role_code IN ('RTL-ROLE-RISK-MANAGER','RTL-ROLE-RISK-ANALYST');

  -- Se ci sono posizioni da servire, i percorsi devono esserci TUTTI E SEI.
  SELECT string_agg(c, ', ') INTO v_mancanti
    FROM (VALUES ('FRM-P1-001'),('FRM-P2-001'),('CRISK-101'),
                 ('MRISK-101'),('OPRISK-101'),('LRISK-101')) AS v(c)
   WHERE NOT EXISTS (SELECT 1 FROM sys.sys_learning_paths lp
                      WHERE lp.learning_path_code = v.c);

  IF v_mancanti IS NOT NULL AND v_posizioni > 0 THEN
    RAISE EXCEPTION
      'mig361: mancano i percorsi formativi (%). Un requisito verso un percorso '
      'inesistente sostituirebbe un buco con un errore.', v_mancanti;
  END IF;

  RAISE NOTICE 'mig361 guardia: % percorsi del rischio, % posizioni da servire',
    v_percorsi, v_posizioni;
END $$;

-- ----------------------------------------------------------------------------
-- 2. RISK MANAGER — sei requisiti, tutti obbligatori.
-- ----------------------------------------------------------------------------
INSERT INTO sys.sys_position_learning_requirements
  (position_id, position_learning_requirement_tenant_id, learning_path_id,
   is_mandatory, deadline_rule)
SELECT p.position_id, p.position_tenant_id, lp.learning_path_id, true, '{}'::jsonb
  FROM sys.sys_positions p
  JOIN sys.sys_job_roles jr ON jr.job_role_id = p.position_job_role_id
  JOIN sys.sys_learning_paths lp
    ON lp.learning_path_code IN ('FRM-P1-001','FRM-P2-001','CRISK-101',
                                 'MRISK-101','OPRISK-101','LRISK-101')
   AND lp.learning_path_tenant_id = p.position_tenant_id
 WHERE jr.job_role_code = 'RTL-ROLE-RISK-MANAGER'
   AND NOT EXISTS (SELECT 1 FROM sys.sys_position_learning_requirements pr
                    WHERE pr.position_id = p.position_id
                      AND pr.learning_path_id = lp.learning_path_id);

-- ----------------------------------------------------------------------------
-- 3. RISK ANALYST — la fondamenta e obbligatoria, la specializzazione no.
-- ----------------------------------------------------------------------------
INSERT INTO sys.sys_position_learning_requirements
  (position_id, position_learning_requirement_tenant_id, learning_path_id,
   is_mandatory, deadline_rule)
SELECT p.position_id, p.position_tenant_id, lp.learning_path_id,
       (lp.learning_path_code = 'FRM-P1-001'), '{}'::jsonb
  FROM sys.sys_positions p
  JOIN sys.sys_job_roles jr ON jr.job_role_id = p.position_job_role_id
  JOIN sys.sys_learning_paths lp
    ON lp.learning_path_code IN ('FRM-P1-001','CRISK-101',
                                 'MRISK-101','OPRISK-101','LRISK-101')
   AND lp.learning_path_tenant_id = p.position_tenant_id
 WHERE jr.job_role_code = 'RTL-ROLE-RISK-ANALYST'
   AND NOT EXISTS (SELECT 1 FROM sys.sys_position_learning_requirements pr
                    WHERE pr.position_id = p.position_id
                      AND pr.learning_path_id = lp.learning_path_id);

-- ----------------------------------------------------------------------------
-- 3-bis. CIO CHE LA REALTA AGGIUNGE AL CRITERIO, e non era nel criterio.
--
--   La prima stesura si fermava ai due blocchi qui sopra. Applicarla ha acceso
--   `X5a` — «Formazione assegnata per una mansione che la persona non ha» — su
--   **7 righe**, tutte di martina.gentile: Antiriciclaggio AML, Basel III,
--   Basel IV, Cybersecurity Awareness, Diversity & Inclusion, GDPR e Privacy,
--   Sicurezza sul Lavoro. Prima l-accensione era impossibile, perche il
--   controllo guarda solo le posizioni che **dichiarano** requisiti, e questa
--   non ne dichiarava nessuno: il buco di X5d nascondeva il difetto di X5a.
--
--   Guardando cosa quella persona ha davvero svolto, il criterio dei due blocchi
--   sopra risulta **giusto ma incompleto**: ha tutti e sei i percorsi del
--   rischio, e in piu sette percorsi di **compliance bancaria trasversale** che
--   nessuna inferenza sui nomi dei corsi avrebbe prodotto. Non si sostituisce
--   dunque il criterio con l-osservazione: la si aggiunge.
--
--   LA REGOLA, meccanica e non un giudizio: una posizione della famiglia
--   dichiara anche i percorsi che **chi la ricopre ha assegnati** e che
--   **almeno un-altra posizione gia pretende**. La seconda condizione e la
--   guardia contro l-arbitrio: un corso che nessuna posizione ha mai preteso
--   non diventa un requisito solo perche qualcuno l-ha seguito. Sono
--   `is_mandatory = false`: la posizione li riconosce come propri, non li
--   impone a chi verra dopo — imporli renderebbe obbligatorio a ritroso cio che
--   e stato soltanto osservato.
-- ----------------------------------------------------------------------------
INSERT INTO sys.sys_position_learning_requirements
  (position_id, position_learning_requirement_tenant_id, learning_path_id,
   is_mandatory, deadline_rule)
SELECT DISTINCT p.position_id, p.position_tenant_id, la.user_learning_assignment_path_id,
       false, '{}'::jsonb
  FROM sys.sys_positions p
  JOIN sys.sys_job_roles jr ON jr.job_role_id = p.position_job_role_id
  JOIN sys.sys_user_position_assignments a
    ON a.user_position_assignment_position_id = p.position_id
   -- stesso criterio di collocazione attuale che usa il controllo X5a: lo stato
   -- ACTIVE, non la data di fine. Due definizioni diverse di «chi la ricopre»
   -- produrrebbero una cura che non combacia con la misura.
   AND a.user_position_assignment_status = 'ACTIVE'
  JOIN sys.sys_user_learning_assignments la
    ON la.user_learning_assignment_user_id = a.user_position_assignment_user_id
   AND la.user_learning_assignment_path_id IS NOT NULL
 WHERE jr.job_role_code IN ('RTL-ROLE-RISK-MANAGER','RTL-ROLE-RISK-ANALYST')
   -- il percorso e gia preteso da almeno un-altra posizione: e la guardia
   -- contro l-arbitrio, non un dettaglio
   AND EXISTS (SELECT 1 FROM sys.sys_position_learning_requirements pr
                WHERE pr.learning_path_id = la.user_learning_assignment_path_id
                  AND pr.position_id <> p.position_id)
   AND NOT EXISTS (SELECT 1 FROM sys.sys_position_learning_requirements pr
                    WHERE pr.position_id = p.position_id
                      AND pr.learning_path_id = la.user_learning_assignment_path_id);

-- ----------------------------------------------------------------------------
-- 4. Il giornale si popola con cio che e stato appena creato.
-- ----------------------------------------------------------------------------
INSERT INTO staging.mig361_requisiti_rischio_undo
  (migrazione, requisito_id, position_id, learning_path_id)
SELECT '000361', pr.position_learning_requirement_id, pr.position_id, pr.learning_path_id
  FROM sys.sys_position_learning_requirements pr
  JOIN sys.sys_positions p  ON p.position_id = pr.position_id
  JOIN sys.sys_job_roles jr ON jr.job_role_id = p.position_job_role_id
 WHERE jr.job_role_code IN ('RTL-ROLE-RISK-MANAGER','RTL-ROLE-RISK-ANALYST')
   AND NOT EXISTS (SELECT 1 FROM staging.mig361_requisiti_rischio_undo u
                    WHERE u.requisito_id = pr.position_learning_requirement_id);

-- ----------------------------------------------------------------------------
-- 5. LE POST-CONDIZIONI — proteggono anche cio che NON doveva cambiare.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_scoperte  int;
  v_totale    int;
  v_estranee  int;
  v_x5a       int;
BEGIN
  -- (a) cio che DOVEVA cambiare: nessuna posizione del rischio resta scoperta.
  SELECT count(*) INTO v_scoperte
    FROM sys.sys_positions p
    JOIN sys.sys_job_roles jr ON jr.job_role_id = p.position_job_role_id
   WHERE jr.job_role_code IN ('RTL-ROLE-RISK-MANAGER','RTL-ROLE-RISK-ANALYST')
     AND NOT EXISTS (SELECT 1 FROM sys.sys_position_learning_requirements pr
                      WHERE pr.position_id = p.position_id);
  IF v_scoperte <> 0 THEN
    RAISE EXCEPTION 'mig361: restano % posizioni del rischio senza requisiti', v_scoperte;
  END IF;

  -- (b) cio che NON doveva cambiare, ed e la meta che conta: nessuna riga e
  --     stata scritta per posizioni FUORI dalla famiglia del rischio. Una JOIN
  --     sbagliata avrebbe assegnato corsi sul rischio a mezza banca, e la
  --     verifica (a) sarebbe stata verde lo stesso.
  SELECT count(*) INTO v_estranee
    FROM staging.mig361_requisiti_rischio_undo u
    JOIN sys.sys_positions p  ON p.position_id = u.position_id
    JOIN sys.sys_job_roles jr ON jr.job_role_id = p.position_job_role_id
   WHERE u.migrazione = '000361'
     AND jr.job_role_code NOT IN ('RTL-ROLE-RISK-MANAGER','RTL-ROLE-RISK-ANALYST');
  IF v_estranee <> 0 THEN
    RAISE EXCEPTION
      'mig361: % requisiti sono finiti su posizioni fuori dalla famiglia del rischio',
      v_estranee;
  END IF;

  -- (c) il difetto che questa migrazione ha ACCESO alla prima stesura non deve
  --     restare acceso: nessuna persona di una posizione del rischio ha un
  --     percorso assegnato che la sua posizione non riconosce. E la condizione
  --     di X5a, ristretta al perimetro toccato qui.
  SELECT count(*) INTO v_x5a
    FROM sys.sys_user_learning_assignments la
    JOIN sys.sys_user_position_assignments a
      ON a.user_position_assignment_user_id = la.user_learning_assignment_user_id
     AND a.user_position_assignment_status = 'ACTIVE'
    JOIN sys.sys_positions p  ON p.position_id = a.user_position_assignment_position_id
    JOIN sys.sys_job_roles jr ON jr.job_role_id = p.position_job_role_id
   WHERE jr.job_role_code IN ('RTL-ROLE-RISK-MANAGER','RTL-ROLE-RISK-ANALYST')
     AND la.user_learning_assignment_path_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM sys.sys_position_learning_requirements pr
                  WHERE pr.learning_path_id = la.user_learning_assignment_path_id)
     AND NOT EXISTS (SELECT 1 FROM sys.sys_position_learning_requirements pr
                      WHERE pr.learning_path_id = la.user_learning_assignment_path_id
                        AND pr.position_id = p.position_id);
  IF v_x5a <> 0 THEN
    RAISE EXCEPTION
      'mig361: % percorsi assegnati a chi ricopre una posizione del rischio non '
      'sono riconosciuti dalla posizione stessa', v_x5a;
  END IF;

  SELECT count(*) INTO v_totale FROM sys.sys_position_learning_requirements;
  RAISE NOTICE 'mig361 post: 0 posizioni del rischio scoperte, % requisiti in tabella, '
               '0 righe fuori perimetro, 0 percorsi non riconosciuti', v_totale;
END $$;

-- ----------------------------------------------------------------------------
-- 6. La funzione che disfa.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.mig361_requisiti_rischio_undo_apply()
RETURNS TABLE(azione text, righe bigint)
LANGUAGE plpgsql AS $$
DECLARE v_tolti bigint := 0;
BEGIN
  DELETE FROM sys.sys_position_learning_requirements pr
   USING staging.mig361_requisiti_rischio_undo u
   WHERE u.migrazione = '000361'
     AND pr.position_learning_requirement_id = u.requisito_id;
  GET DIAGNOSTICS v_tolti = ROW_COUNT;

  RETURN QUERY VALUES ('requisiti rimossi', v_tolti);
END $$;

COMMIT;
