-- ============================================================================
-- storia36 C6 — LA RIORGANIZZAZIONE DEL MARZO 2025
--
-- Piano: docs/superpowers/plans/2026-07-27-rtl-storia-36-mesi.md (Task C6)
--
-- L'organigramma di RTL non ha una storia: le 25 unità risultano esistere da
-- sempre, identiche a sé stesse, e la discontinuità che Enzo ha fissato al
-- 2025-03 non ha lasciato traccia. `sys_organization_unit_history` è vuota.
--
-- IL DISEGNO DELLA TRASFORMAZIONE (Step 6.2 — dedotto dallo stato attuale, non
-- inventato: ogni evento qui sotto ha una traccia nell'organigramma di oggi).
--
--   TRACCIA 1 — due divisioni portano «Compliance» nel nome: «Divisione Risk &
--     Compliance» e «Divisione Legal & Compliance». Due presìdi con lo stesso
--     nome nella stessa banca non nascono così: nascono da una funzione
--     ripartita. PRIMA del riordino la conformità era una divisione a sé; il
--     riordino l'ha divisa — i controlli ai Rischi, la parte normativa al
--     Legale — e ha ribattezzato entrambe le divisioni riceventi.
--   TRACCIA 2 — «Divisione IT & Digital» ha 2 posizioni proprie ma due
--     direzioni sotto di sé (Infrastrutture 3, Sviluppo Software 4): un vertice
--     più leggero di ciò che governa è un vertice NUOVO, creato sopra strutture
--     che esistevano già.
--   TRACCIA 3 — «Divisione Operations» ha 2 posizioni proprie e ha conservato
--     Back Office e Pagamenti, ma non l'informatica: è la divisione da cui le
--     due direzioni tecniche sono uscite quando è nato il presidio IT.
--
-- Ne esce una riorganizzazione datata 2025-03-01:
--   · la Divisione Compliance si SCINDE (SPLIT) fra Rischi e Legale
--   · la Divisione Rischi ASSORBE i controlli e cambia nome (MERGED)
--   · la Divisione Legale prende la parte normativa e cambia nome (RENAMED)
--   · nasce la Divisione IT & Digital (CREATED)
--   · Infrastrutture e Sviluppo Software passano da Operations a IT (MOVED)
--   · l'AML passa dalla vecchia Compliance ai Rischi (MOVED)
--   · la banca adotta il blueprint di settore, con le deroghe che il riordino
--     giustifica (attivazione + override)
--
-- IL PRESENTE NON SI TOCCA (post-condizione C6c): questo seed NON scrive su
-- `sys_organization_units` né su posizioni o assegnazioni. Racconta il passato
-- e basta; e ogni evento è verificato contro lo stato di oggi — se il nome o il
-- genitore che l'evento dichiara come esito non coincide con quello attuale, il
-- check C6c diventa rosso.
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
  c_reorg constant date := DATE '2025-03-01';
  v_hr    uuid;
  v_var   uuid;
  v_act   uuid;
  v_n     bigint := 0;
  v_tot   bigint := 0;
BEGIN
  SELECT user_id INTO STRICT v_hr FROM sys.sys_users
   WHERE user_email = 'federica.marchetti@rtl-bank.org';
  SELECT blueprint_variant_id INTO STRICT v_var FROM sys.sys_blueprint_variants
   WHERE blueprint_variant_code = 'REGIONAL_RETAIL_BANK_MEDIUM';

  -- ==========================================================================
  -- 1. GLI EVENTI DELLA RIORGANIZZAZIONE
  --    Ogni riga dichiara lo stato PRIMA e lo stato DOPO. Il "dopo" non è una
  --    narrazione libera: è lo stato di oggi, riletto dall'organigramma.
  -- ==========================================================================
  CREATE TEMP TABLE _eventi ON COMMIT DROP AS
  WITH ou AS (
    SELECT o.organization_unit_id, o.organization_unit_code AS cod,
           o.organization_unit_name AS nome,
           p.organization_unit_code AS parent_cod, p.organization_unit_name AS parent_nome
      FROM sys.sys_organization_units o
      LEFT JOIN sys.sys_organization_units p ON p.organization_unit_id = o.organization_unit_parent_id
     WHERE o.organization_unit_tenant_id = c_rtl
  )
  SELECT * FROM (
    VALUES
      ('DIV-RISK', 'MERGED',
       'Divisione Rischi',
       'Assorbe i controlli di conformità dalla Divisione Compliance e assume la denominazione attuale.',
       true),
      ('DIV-LEGAL', 'RENAMED',
       'Divisione Legale',
       'Prende in carico la parte normativa della Compliance e assume la denominazione attuale.',
       true),
      -- Della «Divisione Compliance» non resta una riga in anagrafica: si è
      -- sciolta, e la storia di un'unità sciolta non può appendersi a lei
      -- (la chiave esterna punta a un'unità viva). Il suo scioglimento è
      -- raccontato dagli eventi delle due divisioni che l'hanno accolta — il
      -- MERGED sui Rischi e il RENAMED sul Legale — e dal nome che compare
      -- come stato PRECEDENTE nello spostamento dell'AML. Per questo il tipo
      -- SPLIT non compare: non c'è un soggetto a cui attribuirlo.
      ('DIV-IT', 'CREATED',
       NULL,
       'Nasce il presidio IT & Digital, sopra le direzioni tecniche già esistenti.',
       false),
      ('DIR-INFRA', 'MOVED',
       'Divisione Operations',
       'L''infrastruttura tecnologica esce dall''area operativa ed entra nel nuovo presidio IT.',
       false),
      ('DIR-DEV', 'MOVED',
       'Divisione Operations',
       'Lo sviluppo software esce dall''area operativa ed entra nel nuovo presidio IT.',
       false),
      ('DIR-AML', 'MOVED',
       'Divisione Compliance',
       'L''antiriciclaggio segue i controlli di conformità nella Divisione Risk & Compliance.',
       false)
  ) AS e(cod, tipo, valore_prima, motivo, e_rinomina);

  INSERT INTO sys.sys_organization_unit_history (
    organization_unit_history_id, organization_unit_history_unit_id,
    organization_unit_history_tenant_id, organization_unit_history_change_type,
    organization_unit_history_old_value, organization_unit_history_new_value,
    organization_unit_history_effective_at, organization_unit_history_actor_user_id,
    organization_unit_history_notes)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C6::OUH::' || e.cod || '::' || e.tipo),
         o.organization_unit_id, c_rtl, e.tipo,
         -- lo stato PRIMA: il nome precedente per chi è stato ribattezzato,
         -- il genitore precedente per chi si è spostato, nulla per chi è nato
         CASE
           -- per un'unità che NASCE il «prima» non è nulla: è la dichiarazione
           -- che prima non esisteva (la colonna è NOT NULL, e giustamente:
           -- «nessuno stato precedente» va detto, non lasciato vuoto)
           WHEN e.tipo = 'CREATED' THEN jsonb_build_object('exists', false)
           WHEN e.tipo = 'MOVED'   THEN jsonb_build_object('parent_name', e.valore_prima)
           ELSE jsonb_build_object('name', e.valore_prima)
         END,
         -- lo stato DOPO: quello di OGGI, riletto dall'organigramma
         CASE
           WHEN e.tipo = 'MOVED' THEN jsonb_build_object('parent_name', par.organization_unit_name)
           ELSE jsonb_build_object('name', o.organization_unit_name)
         END,
         (c_reorg + time '09:00') AT TIME ZONE 'Europe/Rome',
         v_hr,
         e.motivo
    FROM _eventi e
    JOIN sys.sys_organization_units o
      ON o.organization_unit_code = e.cod AND o.organization_unit_tenant_id = c_rtl
    LEFT JOIN sys.sys_organization_units par
      ON par.organization_unit_id = o.organization_unit_parent_id
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C6: eventi di riorganizzazione %', v_n;

  -- ==========================================================================
  -- 2. L'ADOZIONE DEL BLUEPRINT
  --    Una riorganizzazione di questa portata si appoggia a un modello: la
  --    banca adotta la variante di settore dal giorno del riordino. Le deroghe
  --    non sono decorative — dicono quali processi la banca presidia davvero.
  -- ==========================================================================
  INSERT INTO sys.sys_blueprint_activations (
    blueprint_activation_id, blueprint_activation_tenant_id, blueprint_activation_variant_id,
    blueprint_activation_status, blueprint_activation_effective_from,
    blueprint_activation_metadata, created_by)
  VALUES (
    uuid_generate_v5(c_ns, 'STORIA36::C6::ACT::' || c_rtl || '::REGIONAL_RETAIL_BANK_MEDIUM'),
    c_rtl, v_var, 'ACTIVE', c_reorg,
    jsonb_build_object('storia36', 'C6',
                       'motivo', 'Adozione del modello di settore contestuale al riordino organizzativo'),
    v_hr)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C6: attivazioni di blueprint %', v_n;

  SELECT blueprint_activation_id INTO STRICT v_act FROM sys.sys_blueprint_activations
   WHERE blueprint_activation_tenant_id = c_rtl AND blueprint_activation_variant_id = v_var;

  INSERT INTO sys.sys_blueprint_overrides (
    blueprint_override_id, blueprint_override_activation_id, blueprint_override_process_id,
    blueprint_override_inclusion, blueprint_override_rationale,
    blueprint_override_metadata, created_by)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C6::OVR::' || v_act || '::' || r.blueprint_process_code),
         v_act, r.blueprint_process_id, d.inclusione, d.motivo,
         jsonb_build_object('storia36', 'C6'), v_hr
    FROM (VALUES
      ('02', 'IN',      'Presidio rafforzato dal riordino: l''antiriciclaggio entra nella divisione Rischi.'),
      ('10', 'IN',      'Processo cardine della divisione nata dall''accorpamento.'),
      ('11', 'IN',      'La reportistica regolamentare resta interna e si accentra dopo la scissione della Compliance.'),
      ('16', 'IN',      'Presidio interno dalla creazione della Divisione IT & Digital.'),
      ('07', 'PARTIAL', 'Consulenza patrimoniale offerta solo sulla clientela affluent delle filiali maggiori.'),
      ('19', 'PARTIAL', 'Approvvigionamenti gestiti internamente sopra soglia, in service sotto soglia.'),
      ('20', 'OUT',     'Facility e immobili affidati integralmente a fornitore esterno.')
    ) AS d(codice, inclusione, motivo)
    JOIN sys.sys_blueprint_process_registry r ON r.blueprint_process_code = d.codice
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C6: deroghe al blueprint %', v_n;

  -- ==========================================================================
  -- 3. REGISTRO + POST-CONDIZIONI
  -- ==========================================================================
  INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
  VALUES ('C6', '06_reorg.sql', v_tot, v_tot);

  PERFORM staging.storia36_check_c6a(c_reorg);
  PERFORM staging.storia36_check_c6b();
  PERFORM staging.storia36_check_c6c();
  PERFORM staging.storia36_check_c6d();

  RAISE NOTICE 'storia36 C6 OK: % righe scritte (delta atteso 0 alla seconda corsa)', v_tot;
END $$;

COMMIT;
