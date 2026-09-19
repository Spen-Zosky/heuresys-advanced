-- 000448_g1_porta_nativa_user_position_assignments.sql
-- Mandato K, G-1, passo 67 — apre la porta NATIVA su sys_user_position_assignments.
--
-- Due scoperte fatte misurando (non nel testo letterale del mandato, che le dava per gia'
-- fatte da X-2/D2): (1) la tabella non aveva ancora `origine_dato` — X-2 (mig 000433..000444)
-- copriva le 13 tabelle "amministrative", questa non ci era mai entrata; (2) PEOPLE_MANAGER non
-- aveva nessuno dei 5 permessi `user_position_assignment:*`, nonostante il testo del mandato li
-- dia per "concessi a PEOPLE_MANAGER e HRMS_MANAGER" — misurato: solo HRMS_MANAGER (+ MANAGER,
-- PLATFORM_ADMIN, TENANT_ADMIN) li aveva. Questa migrazione chiude entrambi i gap, perche' sono
-- la stessa cosa: G-1 e' la porta nativa che X-1 aveva gia' previsto ("nessuna rotta CRUD nativa
-- trovata: e' G-1, fase F6" — riga di sys_classificazione_direzione_dato per questa tabella).
--
-- Con la porta nativa che nasce ORA, la tabella smette di essere "importato" (nessuno scrittore
-- applicativo) e diventa "ibrido": due padroni che scrivono davvero (la materializzazione /
-- l'importazione approvata da un lato, il gesto nativo di G-1 dall'altro) — la stessa regola
-- gia' applicata alle 76 righe dubbie di X-1 ("il secondo scrittore conta solo se continua a
-- scrivere": qui ENTRAMBI continuano). Aggiorna quindi anche la classificazione (X-1).
--
-- Le 329 righe esistenti sono TUTTE da materializzazione (segnaposto), misurato: zero hanno
-- `metadata->>'tenantImportRunId'`. DEFAULT 'MATERIALIZZAZIONE' dice il vero per lo storico; i
-- due scrittori applicativi (tenant-materialization/repository.ts, approvals/effects/
-- tenant-import-run.ts) sono stati corretti in questo stesso commit per scrivere il proprio
-- valore esplicito (non dipendono piu' dal default).
--
-- Idempotente: ADD COLUMN IF NOT EXISTS, guardia su pg_constraint, GRANT via NOT EXISTS,
-- classificazione con UPDATE guardato sullo stato atteso (no-op se gia' 'ibrido').
-- Rollback dichiarato: NON si DROP la colonna, NON si REVOKE il permesso (ADR-0035): una
-- migrazione successiva li marca ritirati nel commento, se mai servisse.

BEGIN;

-- --- 1. La colonna di provenienza (pattern X-2, mig 000433..000444) ------------------------
ALTER TABLE sys.sys_user_position_assignments
  ADD COLUMN IF NOT EXISTS origine_dato varchar(32) NOT NULL DEFAULT 'MATERIALIZZAZIONE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'sys.sys_user_position_assignments'::regclass
       AND conname  = 'sys_user_position_assignments_origine_dato_check'
  ) THEN
    ALTER TABLE sys.sys_user_position_assignments
      ADD CONSTRAINT sys_user_position_assignments_origine_dato_check
      CHECK (origine_dato IN ('IMPORT', 'NATIVO', 'MATERIALIZZAZIONE'));
  END IF;
END $$;

COMMENT ON COLUMN sys.sys_user_position_assignments.origine_dato IS
  'I23/G-1 (mandato K, mig 000448): IMPORT = corsa di importazione approvata (TENANT_IMPORT_RUN); NATIVO = proposta approvata dal modulo user-position-assignments (D4=B); MATERIALIZZAZIONE = segnaposto generato dalla costruzione dell''azienda (tenant-materialization). Righe storiche prima di questa migrazione: tutte MATERIALIZZAZIONE (misurato, 0 con tenantImportRunId).';

-- --- 2. PEOPLE_MANAGER titolare dei 5 permessi (D4=B: la porta nativa serve a lui) ----------
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  JOIN sys.sys_auth_permissions p
    ON p.auth_permission_code IN (
         'user_position_assignment:create', 'user_position_assignment:delete',
         'user_position_assignment:list', 'user_position_assignment:read',
         'user_position_assignment:update')
 WHERE r.auth_role_code = 'PEOPLE_MANAGER'
   AND NOT EXISTS (
     SELECT 1 FROM sys.sys_auth_role_permissions rp
      WHERE rp.auth_role_id = r.auth_role_id AND rp.auth_permission_id = p.auth_permission_id
   );

-- --- 3. Classificazione X-1: importato -> ibrido (il secondo scrittore nativo e' nato ORA) --
UPDATE sys.sys_classificazione_direzione_dato
   SET stato = 'ibrido',
       motivo = 'due scrittori applicativi reali: materializzazione/importazione approvata (segnaposto e persone vere) E il gesto nativo di G-1 (proposta approvata dal modulo user-position-assignments, D4=B) - entrambi continuano a scrivere, non e'' un seed una tantum',
       adr = 'ADR-0041',
       ratificato_il = CURRENT_DATE
 WHERE tabella = 'sys_user_position_assignments'
   AND stato <> 'ibrido';

DO $$
DECLARE
  v_righe    integer;
  v_valori   integer;
  v_titolari integer;
  v_stato    text;
BEGIN
  SELECT count(*) INTO v_righe FROM sys.sys_user_position_assignments;
  SELECT count(DISTINCT origine_dato) INTO v_valori FROM sys.sys_user_position_assignments;
  IF v_valori > 1 THEN
    RAISE EXCEPTION '000448: origine_dato ha % valori distinti prima degli scrittori nativi, atteso 1 (il default)', v_valori;
  END IF;

  SELECT count(*) INTO v_titolari
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'PEOPLE_MANAGER' AND p.auth_permission_code LIKE 'user_position_assignment:%';
  IF v_titolari <> 5 THEN
    RAISE EXCEPTION '000448: PEOPLE_MANAGER ha % permessi user_position_assignment:*, attesi 5', v_titolari;
  END IF;

  SELECT stato INTO v_stato FROM sys.sys_classificazione_direzione_dato WHERE tabella = 'sys_user_position_assignments';
  IF v_stato IS DISTINCT FROM 'ibrido' THEN
    RAISE EXCEPTION '000448: classificazione di sys_user_position_assignments e'' %, attesa ibrido', v_stato;
  END IF;

  RAISE NOTICE '000448 OK — % righe origine_dato uniforme, PEOPLE_MANAGER 5/5, classificazione ibrido', v_righe;
END $$;

COMMIT;

-- FINE 000448
