-- ============================================================================================
-- 000523 — Le unità dell'organizzazione ghost, derivate dal vivo dall'albero delle unità del
--          tenant, con la loro storia.
--          (voce G1 del piano docs/piani/PIANO_heuresys-ai-driven_20261126.md, ADR-0063 D2)
--
-- IL FATTO. ADR-0063 D2 decide che dentro ogni tenant lavora un'organizzazione ghost che
-- riproduce i soli ruoli apicali dell'organizzazione reale: il vertice, le divisioni e le
-- direzioni, cioè le unità entro il secondo livello sotto il vertice, ricavate dal vivo
-- dall'albero delle unità. Quando l'albero cambia l'organizzazione ghost si riforma, e la
-- storia dei cambiamenti resta. Fino a qui non esisteva nessun oggetto che la descrivesse.
--
-- LA MISURA (produzione, 2026-11-26, sola lettura): RTL Bank ha 38 unità attive e una sola
-- radice (`RTL`, HEADQUARTERS). Livello 0: 1; livello 1: 6 (la Direzione Generale e le cinque
-- direzioni di controllo); livello 2: 7 (le sette divisioni sotto la Direzione Generale);
-- livello 3: 22; livello 4: 2. L'organizzazione ghost di RTL ha quindi 14 unità. Heuresys
-- System ha 3 unità attive su due livelli, tutte ghost.
--
-- CHE COSA CREA. Solo aggiunte; le tabelle di business si LEGGONO soltanto.
--   · `sys.v_ghost_units_derivate`: la vista che deriva l'organizzazione ghost dall'albero vivo.
--     Una unità è attiva se `organization_unit_is_active` e non è scaduta; la radice è
--     un'unità attiva senza padre; si scende fino al livello 2 passando solo per unità
--     attive, così un ramo disattivato esce intero e le sue figlie non diventano vertici. Il tipo dell'unità
--     ghost: VERTICE al livello 0, DIVISIONE per le unità di tipo DIVISION, DIREZIONE per le
--     altre (Direzione Generale compresa).
--   · `sys.sys_ghost_units`: la STORIA. Ogni riga è un periodo di validità di un'unità ghost:
--     aperta (`ghost_unit_valid_to` vuoto) finché l'unità reale esiste con gli stessi tratti
--     (livello, tipo, padre, codice, nome, tipo reale); chiusa quando cambia o esce. Una riga
--     chiusa non si riapre e non si modifica (guardia nel database).
--   · `sys.sys_ghost_riforma(tenant)`: confronta la vista con le righe aperte, chiude quelle
--     che non corrispondono più e apre le nuove. Restituisce quante ne ha aperte e chiuse.
--     Idempotente: se l'albero non è cambiato non scrive niente. Un lucchetto consultivo per
--     tenant impedisce due riforme contemporanee dello stesso tenant.
--   · Alla fine, la riforma di tutti i tenant e la post-condizione: per ogni tenant le righe
--     aperte coincidono, una per una, con la vista.
--
-- CHI LA RICHIAMA. Questa migrazione a ogni deploy (la catena si riapplica, ADR-0034), e la
-- rotta POST /v1/ghost-units/riforma per chi governa l'organigramma del tenant. I Capi ghost in
-- background (voce G6) la richiameranno prima di osservare la loro area. Nessun trigger sulle
-- tabelle di business: una scrittura sull'organigramma non dipende dall'organizzazione ghost.
--
-- I DATI. La tabella non nasce vuota: la riempie la riforma, dai dati veri dell'albero.
-- CLASSIFICAZIONE E REGISTRO: tabella classificata in 000429 e registrata in 000062, file di
--   numero minore, emendati come per la 000515.
-- IDEMPOTENTE: IF NOT EXISTS, vincoli in forma DROP/ADD, funzioni e vista CREATE OR REPLACE,
--   trigger DROP IF EXISTS / CREATE; la riforma alla seconda passata apre e chiude zero righe.
-- ROLLBACK DICHIARATO (la tabella è derivata: si ricostruisce dalla vista, la storia passata
--   si perde e lo si dichiara):
--   DROP FUNCTION sys.sys_ghost_riforma(uuid);
--   DROP TABLE sys.sys_ghost_units;
--   DROP FUNCTION sys.sys_ghost_units_guardia_storia();
--   DROP VIEW sys.v_ghost_units_derivate;
--   e le righe in 000429 e 000062.
-- ============================================================================================

\set ON_ERROR_STOP on

BEGIN;

-- ── 1. La vista: l'organizzazione ghost derivata dall'albero vivo ───────────────────────────
CREATE OR REPLACE VIEW sys.v_ghost_units_derivate AS
WITH RECURSIVE attive AS (
  SELECT u.organization_unit_id, u.organization_unit_tenant_id, u.organization_unit_parent_id,
         u.organization_unit_code, u.organization_unit_name, u.organization_unit_type
    FROM sys.sys_organization_units u
   WHERE u.organization_unit_is_active
     AND (u.organization_unit_effective_to IS NULL OR u.organization_unit_effective_to >= current_date)
),
albero AS (
  SELECT a.organization_unit_id, a.organization_unit_tenant_id,
         NULL::uuid AS padre_id, a.organization_unit_code, a.organization_unit_name,
         a.organization_unit_type, 0 AS livello
    FROM attive a
   WHERE a.organization_unit_parent_id IS NULL
  UNION ALL
  SELECT f.organization_unit_id, f.organization_unit_tenant_id,
         f.organization_unit_parent_id, f.organization_unit_code, f.organization_unit_name,
         f.organization_unit_type, al.livello + 1
    FROM attive f
    JOIN albero al ON al.organization_unit_id = f.organization_unit_parent_id
                  AND al.organization_unit_tenant_id = f.organization_unit_tenant_id
   WHERE al.livello < 2
)
SELECT organization_unit_tenant_id AS tenant_id,
       organization_unit_id        AS source_unit_id,
       padre_id                    AS source_parent_id,
       livello::smallint           AS ghost_level,
       (CASE WHEN livello = 0 THEN 'VERTICE'
             WHEN organization_unit_type = 'DIVISION' THEN 'DIVISIONE'
             ELSE 'DIREZIONE' END)::varchar(16) AS ghost_kind,
       organization_unit_code      AS ghost_code,
       organization_unit_name      AS ghost_name,
       organization_unit_type      AS source_type
  FROM albero;

COMMENT ON VIEW sys.v_ghost_units_derivate IS
  'ADR-0063 D2, mig 000523: l''organizzazione ghost derivata dal vivo dall''albero delle unità attive del tenant (vertice e due livelli sotto).';

-- ── 2. La storia ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_ghost_units (
  ghost_unit_id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ghost_unit_tenant_id        uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  ghost_unit_source_unit_id   uuid REFERENCES sys.sys_organization_units(organization_unit_id) ON DELETE SET NULL,
  ghost_unit_source_parent_id uuid REFERENCES sys.sys_organization_units(organization_unit_id) ON DELETE SET NULL,
  ghost_unit_level            smallint NOT NULL,
  ghost_unit_kind             varchar(16) NOT NULL,
  ghost_unit_code             varchar(128) NOT NULL,
  ghost_unit_name             varchar(255) NOT NULL,
  ghost_unit_source_type      varchar(64),
  ghost_unit_opened_reason    varchar(16) NOT NULL,
  ghost_unit_valid_from       timestamptz NOT NULL DEFAULT now(),
  ghost_unit_valid_to         timestamptz,
  ghost_unit_closed_reason    varchar(16),
  created_at                  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_ghost_units DROP CONSTRAINT IF EXISTS sys_ghost_units_level_check;
ALTER TABLE sys.sys_ghost_units ADD CONSTRAINT sys_ghost_units_level_check
  CHECK (ghost_unit_level BETWEEN 0 AND 2);
ALTER TABLE sys.sys_ghost_units DROP CONSTRAINT IF EXISTS sys_ghost_units_kind_check;
ALTER TABLE sys.sys_ghost_units ADD CONSTRAINT sys_ghost_units_kind_check
  CHECK (ghost_unit_kind IN ('VERTICE', 'DIVISIONE', 'DIREZIONE')
     AND ((ghost_unit_level = 0) = (ghost_unit_kind = 'VERTICE')));
ALTER TABLE sys.sys_ghost_units DROP CONSTRAINT IF EXISTS sys_ghost_units_opened_reason_check;
ALTER TABLE sys.sys_ghost_units ADD CONSTRAINT sys_ghost_units_opened_reason_check
  CHECK (ghost_unit_opened_reason IN ('FORMAZIONE', 'NUOVA', 'MODIFICATA'));
ALTER TABLE sys.sys_ghost_units DROP CONSTRAINT IF EXISTS sys_ghost_units_closed_check;
ALTER TABLE sys.sys_ghost_units ADD CONSTRAINT sys_ghost_units_closed_check
  CHECK ((ghost_unit_valid_to IS NULL AND ghost_unit_closed_reason IS NULL)
      OR (ghost_unit_valid_to IS NOT NULL AND ghost_unit_valid_to >= ghost_unit_valid_from
          AND ghost_unit_closed_reason IN ('MODIFICATA', 'USCITA')));

-- una sola riga aperta per unità reale
CREATE UNIQUE INDEX IF NOT EXISTS sys_ghost_units_open_uq
  ON sys.sys_ghost_units (ghost_unit_tenant_id, ghost_unit_source_unit_id)
  WHERE ghost_unit_valid_to IS NULL;
CREATE INDEX IF NOT EXISTS sys_ghost_units_tenant_idx
  ON sys.sys_ghost_units (ghost_unit_tenant_id, ghost_unit_valid_from);

COMMENT ON TABLE sys.sys_ghost_units IS
  'ADR-0063 D2, mig 000523: storia dell''organizzazione ghost; scritta solo da sys.sys_ghost_riforma.';

-- La guardia: una riga chiusa non si tocca; di una riga aperta si può solo chiudere il periodo.
-- Quando l'unità reale sparisce, la chiave esterna mette a NULL il riferimento: è ammesso.
CREATE OR REPLACE FUNCTION sys.sys_ghost_units_guardia_storia() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.ghost_unit_valid_to IS NOT NULL
     AND (NEW.ghost_unit_valid_to IS DISTINCT FROM OLD.ghost_unit_valid_to
          OR NEW.ghost_unit_closed_reason IS DISTINCT FROM OLD.ghost_unit_closed_reason) THEN
    RAISE EXCEPTION 'sys_ghost_units: il periodo % è chiuso e non si riapre', OLD.ghost_unit_id
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.ghost_unit_tenant_id   IS DISTINCT FROM OLD.ghost_unit_tenant_id
     OR NEW.ghost_unit_level    IS DISTINCT FROM OLD.ghost_unit_level
     OR NEW.ghost_unit_kind     IS DISTINCT FROM OLD.ghost_unit_kind
     OR NEW.ghost_unit_code     IS DISTINCT FROM OLD.ghost_unit_code
     OR NEW.ghost_unit_name     IS DISTINCT FROM OLD.ghost_unit_name
     OR NEW.ghost_unit_source_type    IS DISTINCT FROM OLD.ghost_unit_source_type
     OR NEW.ghost_unit_opened_reason  IS DISTINCT FROM OLD.ghost_unit_opened_reason
     OR NEW.ghost_unit_valid_from     IS DISTINCT FROM OLD.ghost_unit_valid_from
     OR (NEW.ghost_unit_source_unit_id IS DISTINCT FROM OLD.ghost_unit_source_unit_id
         AND NEW.ghost_unit_source_unit_id IS NOT NULL)
     OR (NEW.ghost_unit_source_parent_id IS DISTINCT FROM OLD.ghost_unit_source_parent_id
         AND NEW.ghost_unit_source_parent_id IS NOT NULL) THEN
    RAISE EXCEPTION 'sys_ghost_units: la storia non si riscrive (riga %): si chiude il periodo e se ne apre un altro', OLD.ghost_unit_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sys_ghost_units_guardia_storia ON sys.sys_ghost_units;
CREATE TRIGGER sys_ghost_units_guardia_storia BEFORE UPDATE ON sys.sys_ghost_units
  FOR EACH ROW EXECUTE FUNCTION sys.sys_ghost_units_guardia_storia();

-- ── 3. La riforma ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sys.sys_ghost_riforma(p_tenant_id uuid)
RETURNS TABLE (aperte integer, chiuse integer)
LANGUAGE plpgsql AS $$
DECLARE
  v_chiuse  integer := 0;
  v_aperte  integer := 0;
  v_vergine boolean;
  v_ora     timestamptz := clock_timestamp();
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'sys_ghost_riforma: tenant mancante' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('sys_ghost_riforma'), hashtext(p_tenant_id::text));

  SELECT NOT EXISTS (SELECT 1 FROM sys.sys_ghost_units WHERE ghost_unit_tenant_id = p_tenant_id)
    INTO v_vergine;

  -- chiude le righe aperte che non corrispondono più alla vista
  WITH d AS (SELECT * FROM sys.v_ghost_units_derivate WHERE tenant_id = p_tenant_id),
  da_chiudere AS (
    SELECT g.ghost_unit_id,
           CASE WHEN d.source_unit_id IS NULL THEN 'USCITA' ELSE 'MODIFICATA' END AS motivo
      FROM sys.sys_ghost_units g
      LEFT JOIN d ON d.source_unit_id = g.ghost_unit_source_unit_id
     WHERE g.ghost_unit_tenant_id = p_tenant_id
       AND g.ghost_unit_valid_to IS NULL
       AND (d.source_unit_id IS NULL
            OR g.ghost_unit_level <> d.ghost_level
            OR g.ghost_unit_kind <> d.ghost_kind
            OR g.ghost_unit_code <> d.ghost_code
            OR g.ghost_unit_name <> d.ghost_name
            OR g.ghost_unit_source_type IS DISTINCT FROM d.source_type
            OR g.ghost_unit_source_parent_id IS DISTINCT FROM d.source_parent_id)
  )
  UPDATE sys.sys_ghost_units g
     SET ghost_unit_valid_to = greatest(v_ora, g.ghost_unit_valid_from),
         ghost_unit_closed_reason = c.motivo
    FROM da_chiudere c
   WHERE g.ghost_unit_id = c.ghost_unit_id;
  GET DIAGNOSTICS v_chiuse = ROW_COUNT;

  -- apre le unità della vista che non hanno una riga aperta
  INSERT INTO sys.sys_ghost_units (
    ghost_unit_tenant_id, ghost_unit_source_unit_id, ghost_unit_source_parent_id,
    ghost_unit_level, ghost_unit_kind, ghost_unit_code, ghost_unit_name, ghost_unit_source_type,
    ghost_unit_opened_reason, ghost_unit_valid_from)
  SELECT d.tenant_id, d.source_unit_id, d.source_parent_id,
         d.ghost_level, d.ghost_kind, d.ghost_code, d.ghost_name, d.source_type,
         CASE WHEN v_vergine THEN 'FORMAZIONE'
              WHEN EXISTS (SELECT 1 FROM sys.sys_ghost_units s
                            WHERE s.ghost_unit_tenant_id = p_tenant_id
                              AND s.ghost_unit_source_unit_id = d.source_unit_id) THEN 'MODIFICATA'
              ELSE 'NUOVA' END,
         v_ora
    FROM sys.v_ghost_units_derivate d
   WHERE d.tenant_id = p_tenant_id
     AND NOT EXISTS (SELECT 1 FROM sys.sys_ghost_units g
                      WHERE g.ghost_unit_tenant_id = p_tenant_id
                        AND g.ghost_unit_source_unit_id = d.source_unit_id
                        AND g.ghost_unit_valid_to IS NULL);
  GET DIAGNOSTICS v_aperte = ROW_COUNT;

  aperte := v_aperte;
  chiuse := v_chiuse;
  RETURN NEXT;
END $$;

COMMENT ON FUNCTION sys.sys_ghost_riforma(uuid) IS
  'ADR-0063 D2, mig 000523: riallinea la storia dell''organizzazione ghost di un tenant alla vista derivata; legge le tabelle vere e scrive solo in sys.sys_ghost_units.';

-- ── 4. La riforma di tutti i tenant e la post-condizione ────────────────────────────────────
DO $$
DECLARE t record; r record; n_diff integer;
BEGIN
  FOR t IN SELECT tenant_id, tenant_code FROM sys.sys_tenancies ORDER BY tenant_code LOOP
    SELECT * INTO r FROM sys.sys_ghost_riforma(t.tenant_id);
    SELECT count(*) INTO n_diff FROM (
      (SELECT source_unit_id, source_parent_id, ghost_level, ghost_kind, ghost_code, ghost_name, source_type
         FROM sys.v_ghost_units_derivate WHERE tenant_id = t.tenant_id
       EXCEPT
       SELECT ghost_unit_source_unit_id, ghost_unit_source_parent_id, ghost_unit_level, ghost_unit_kind,
              ghost_unit_code, ghost_unit_name, ghost_unit_source_type
         FROM sys.sys_ghost_units WHERE ghost_unit_tenant_id = t.tenant_id AND ghost_unit_valid_to IS NULL)
      UNION ALL
      (SELECT ghost_unit_source_unit_id, ghost_unit_source_parent_id, ghost_unit_level, ghost_unit_kind,
              ghost_unit_code, ghost_unit_name, ghost_unit_source_type
         FROM sys.sys_ghost_units WHERE ghost_unit_tenant_id = t.tenant_id AND ghost_unit_valid_to IS NULL
       EXCEPT
       SELECT source_unit_id, source_parent_id, ghost_level, ghost_kind, ghost_code, ghost_name, source_type
         FROM sys.v_ghost_units_derivate WHERE tenant_id = t.tenant_id)
    ) x;
    IF n_diff <> 0 THEN
      RAISE EXCEPTION '000523: la storia ghost del tenant % non coincide con l''albero vivo (% differenze)', t.tenant_code, n_diff;
    END IF;
    RAISE NOTICE '000523: tenant % — aperte %, chiuse %, unità ghost attive %', t.tenant_code, r.aperte, r.chiuse,
      (SELECT count(*) FROM sys.sys_ghost_units WHERE ghost_unit_tenant_id = t.tenant_id AND ghost_unit_valid_to IS NULL);
  END LOOP;
END $$;

COMMIT;
