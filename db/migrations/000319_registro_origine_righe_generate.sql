-- =============================================================================
-- 000319_registro_origine_righe_generate.sql
-- Tenant Builder P3 · T1 — il registro dell'origine
-- -----------------------------------------------------------------------------
-- A che domanda risponde: «in questa azienda, che cosa e' stato GENERATO da un
-- fascicolo e che cosa e' dato vero?». Oggi quella domanda non ha risposta in una
-- interrogazione sola: il motore di materializzazione scrive
-- `jsonb_build_object('materialized_from', …)` nei metadata di TRE tabelle su otto
-- fra quelle che tocca (unita', competenze, indicatori — non posizioni, utenti,
-- assegnazioni, evidenze: copertura incoerente, → voce #197). Cento colonne
-- `metadata` rispondono solo a chi sa gia' quali sono le cento; un registro
-- risponde a chi non lo sa (P1 §4.7).
--
-- Il `materialized_from` esistente RESTA DOV'E' e non si tocca: lo scrive un motore
-- che funziona, e rimuoverlo sarebbe un cantiere fuori mandato. Non e' il marchio,
-- e' un appunto. Il registro e' la fonte; il controllo incrociato di P3 §10.4
-- confrontera' le due coperture, e #197 e' la prova che oggi divergono.
--
-- ⚠ `target_record_id` NON HA CHIAVE ESTERNA, e non e' una dimenticanza. E'
-- polimorfo per progetto (P1 §4.7): la riga puntata puo' stare in una qualunque
-- delle tabelle che la costruzione popola, e in PostgreSQL una FK polimorfa non si
-- esprime. Il prezzo e' accettato consapevolmente, e la disciplina la impone il
-- codice che scrive — che e' UN PUNTO SOLO, il motore di costruzione. Chi legge
-- questa tabella fra un anno deve trovare qui la ragione, non dedurla.
--
-- I tre stati, e perche' sono tre e non due (P3 §5.5 — e' la parte che P4 usera'
-- di piu'):
--   GENERATED  — nato dal fascicolo, nessuno l'ha ancora confermato
--   CONFIRMED  — il dato vero e' arrivato e ha CONFERMATO questa riga. Un requisito
--                di posizione generato resta in piedi anche dopo l'ingresso della
--                persona vera: non e' provvisorio, e' la REGOLA contro cui la
--                persona e' stata verificata
--   SUPERSEDED — il dato vero ha PRESO IL POSTO di questa riga (il segnaposto
--                persona cede alla persona reale). Si disattiva, non si cancella
--                (ADR-0035)
--
-- Idempotente: CREATE TABLE / INDEX IF NOT EXISTS.
-- =============================================================================

CREATE TABLE IF NOT EXISTS sys.sys_generated_record_origins (
    generated_record_origin_id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    generated_record_origin_tenant_id           uuid        NOT NULL
        REFERENCES sys.sys_tenancies (tenant_id) ON DELETE CASCADE,
    -- 63 = limite degli identificatori PostgreSQL: un nome di tabella ci sta sempre
    generated_record_origin_target_table        varchar(63) NOT NULL,
    -- polimorfo, senza FK: vedi la testata
    generated_record_origin_target_record_id    uuid        NOT NULL,
    -- ON DELETE RESTRICT: la versione che ha generato una riga non si cancella,
    -- altrimenti il registro punterebbe al nulla e non saprebbe piu' dire da dove
    -- viene cio' che descrive
    generated_record_origin_blueprint_version_id uuid       NOT NULL
        REFERENCES sys.sys_tenant_blueprint_versions (tenant_blueprint_version_id) ON DELETE RESTRICT,
    -- RD-08: varchar + CHECK, mai un ENUM PostgreSQL
    generated_record_origin_status               varchar(16) NOT NULL DEFAULT 'GENERATED',
    -- la corsa di importazione che l'ha sostituita (P4); nullo finche' non accade
    generated_record_origin_superseded_by_run_id uuid       NULL,
    generated_record_origin_status_changed_at    timestamptz NULL,
    generated_record_origin_metadata             jsonb      NOT NULL DEFAULT '{}'::jsonb,
    created_at                                   timestamptz NOT NULL DEFAULT now(),
    created_by                                   uuid       NULL
        REFERENCES sys.sys_users (user_id) ON DELETE SET NULL,

    CONSTRAINT sys_generated_record_origins_status_ck
        CHECK (generated_record_origin_status IN ('GENERATED', 'CONFIRMED', 'SUPERSEDED')),

    -- Uno stato diverso da GENERATED deve dire QUANDO lo e' diventato. Senza questo
    -- vincolo una transizione si puo' scrivere a meta', e il registro perde la sola
    -- cosa che rende ricostruibile la storia.
    CONSTRAINT sys_generated_record_origins_changed_at_ck
        CHECK (generated_record_origin_status = 'GENERATED'
               OR generated_record_origin_status_changed_at IS NOT NULL)
);

-- Una riga generata ha UNA sola origine: due fascicoli non possono rivendicarla.
CREATE UNIQUE INDEX IF NOT EXISTS sys_generated_record_origins_target_uq
    ON sys.sys_generated_record_origins (generated_record_origin_target_table,
                                         generated_record_origin_target_record_id);

-- «Cosa c'e' di generato in questa azienda?» in una interrogazione sola.
CREATE INDEX IF NOT EXISTS sys_generated_record_origins_tenant_status_idx
    ON sys.sys_generated_record_origins (generated_record_origin_tenant_id,
                                         generated_record_origin_status);

-- «Cosa ha prodotto questa versione del fascicolo?»
CREATE INDEX IF NOT EXISTS sys_generated_record_origins_version_idx
    ON sys.sys_generated_record_origins (generated_record_origin_blueprint_version_id);

COMMENT ON TABLE sys.sys_generated_record_origins IS
  'Tenant Builder P3 — registro dell''origine: quali righe di un tenant sono state GENERATE da una '
  'versione di fascicolo, e in quale stato sono (GENERATED/CONFIRMED/SUPERSEDED). Risponde in una '
  'interrogazione alla domanda «cosa c''e'' di generato qui dentro». target_record_id e'' POLIMORFO '
  'e senza FK per progetto (P1 §4.7): la disciplina la impone il motore di costruzione, che e'' un '
  'punto solo.';

-- -----------------------------------------------------------------------------
-- POST-CONDIZIONI — provano che i vincoli MORDONO, non che la tabella esiste.
-- Una `CREATE TABLE` riesce sempre; cio' che puo' non funzionare sono l'indice
-- unico e i due CHECK, ed e' esattamente quello per cui la tabella esiste.
-- Ogni prova gira e viene DISFATTA: nessuna riga resta.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_tenant  uuid;
    v_version uuid;
    v_fake    uuid := '00000000-0000-4000-8000-0000000000ff'::uuid;
    v_ok      boolean;
BEGIN
    SELECT tenant_id INTO v_tenant FROM sys.sys_tenancies ORDER BY tenant_code LIMIT 1;
    SELECT tenant_blueprint_version_id INTO v_version
      FROM sys.sys_tenant_blueprint_versions LIMIT 1;

    IF v_tenant IS NULL OR v_version IS NULL THEN
        -- Universo vuoto: si DICHIARA, non si tace. Un «nessun problema» che nasce
        -- dal non aver potuto provare e' identico a uno che nasce da una prova.
        RAISE NOTICE '000319: prove NON ESEGUITE — manca un tenant o una versione di fascicolo su cui provarle';
        RETURN;
    END IF;

    -- (1) l'indice unico deve RESPINGERE la seconda rivendicazione della stessa riga
    INSERT INTO sys.sys_generated_record_origins
        (generated_record_origin_tenant_id, generated_record_origin_target_table,
         generated_record_origin_target_record_id, generated_record_origin_blueprint_version_id)
    VALUES (v_tenant, '__prova_000319', v_fake, v_version);

    v_ok := false;
    BEGIN
        INSERT INTO sys.sys_generated_record_origins
            (generated_record_origin_tenant_id, generated_record_origin_target_table,
             generated_record_origin_target_record_id, generated_record_origin_blueprint_version_id)
        VALUES (v_tenant, '__prova_000319', v_fake, v_version);
    EXCEPTION WHEN unique_violation THEN
        v_ok := true;
    END;
    IF NOT v_ok THEN
        RAISE EXCEPTION '000319: l''indice unico NON respinge la doppia origine sulla stessa riga: il registro non garantisce cio'' per cui esiste';
    END IF;

    -- (2) il CHECK deve RESPINGERE uno stato non-GENERATED senza il momento del cambio
    v_ok := false;
    BEGIN
        UPDATE sys.sys_generated_record_origins
           SET generated_record_origin_status = 'CONFIRMED'
         WHERE generated_record_origin_target_table = '__prova_000319';
    EXCEPTION WHEN check_violation THEN
        v_ok := true;
    END;
    IF NOT v_ok THEN
        RAISE EXCEPTION '000319: il CHECK non pretende status_changed_at su uno stato diverso da GENERATED';
    END IF;

    -- (3) e la transizione COMPLETA deve invece passare
    UPDATE sys.sys_generated_record_origins
       SET generated_record_origin_status = 'CONFIRMED',
           generated_record_origin_status_changed_at = now()
     WHERE generated_record_origin_target_table = '__prova_000319';

    DELETE FROM sys.sys_generated_record_origins
     WHERE generated_record_origin_target_table = '__prova_000319';

    RAISE NOTICE '000319: indice unico e CHECK verificati sul vivo, righe di prova rimosse';
END $$;
