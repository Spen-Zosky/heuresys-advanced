--
-- 000414 — Un ruolo chiave che non dichiara la sua famiglia, e la regola piu' delicata
--          del sistema che nessuno guardava.
--
-- Preparata da Cowork il 2026-09-14 su mandato di Enzo, misurando sul database vivo.
-- NON applicata da chi l'ha scritta: le migrazioni le applica la CLI (`pnpm db:migrate:vm`),
-- e la prova generale (`ci-rehearsal.sh`) gira sul gemello, che da Cowork non e'
-- raggiungibile — `device_bash` e' fuori uso su questa macchina dal 2026-09-08. Chi la
-- applica faccia PRIMA la prova generale: e' il cancello che questa migrazione non ha potuto
-- attraversare.
--
-- ── FATTO 1. `BRANCH_MANAGER` e' l'unico dei 14 ruoli senza `auth_role_category`.
--
-- Misurato: gli altri tredici si dichiarano `functional` (che mestiere fai) oppure
-- `hierarchical_operational` (che posto occupi nella catena). Lui ha il campo vuoto, e lo
-- portano DIECI persone — non e' un ruolo marginale, e' il capo di una filiale.
--
-- La famiglia giusta non e' un'opinione, e' un dato: **tutte e dieci** le persone che
-- portano `BRANCH_MANAGER` dirigono esattamente un'unita' organizzativa, e tutte e dieci
-- quelle unita' sono di tipo `BRANCH`. Il ruolo e' definito dal posto nella catena. In
-- piu', i suoi 13 permessi sono un sottoinsieme perfetto di quelli di `MANAGER`, che sta
-- gia' in `hierarchical_operational`.
--
-- E c'e' una conferma piu' fine, che vale la pena scrivere perche' illustra la dottrina
-- dei domini ortogonali (ADR-0036): i 13 permessi di `BRANCH_MANAGER` sono quasi tutti
-- `:self` piu' due su `branch:*` e due cruscotti. Il suo potere NON sta nei permessi —
-- sta nelle persone che la sua filiale contiene, cioe' nell'asse gerarchico. Un ruolo
-- cosi' e' `hierarchical_operational` per definizione.
--
-- ── Perche' NON si emenda `000272`, che e' il file che lo crea.
--
-- ADR-0035 dice di emendare il file che crea l'oggetto, e la domanda e' stata posta invece
-- che saltata. La `000272` inserisce il ruolo con `ON CONFLICT (auth_role_code) DO NOTHING`
-- e senza la colonna `auth_role_category`, che allora non c'era: su un database esistente
-- quella INSERT non tocca nulla, quindi emendarla non curerebbe la produzione; su un
-- database costruito da zero curerebbe la nascita, ma questa migrazione gira comunque dopo,
-- nella stessa catena, e lo corregge lo stesso. L'emendamento cambierebbe l'impronta di un
-- file storico senza aggiungere copertura in nessuno dei due casi. Verificato che l'impronta
-- non e' un cancello: `migrate.ps1` la usa solo per SALTARE le migrazioni marcate
-- `@migrate: once`, non per rifiutare un file cambiato.
--
-- ── FATTO 2. L'isolamento del whistleblowing regge, e nessuna vista lo guardava.
--
-- ADR-0036 §5 mette le segnalazioni whistleblowing in isolamento assoluto: solo la custodia,
-- nemmeno la piattaforma. Misurato il 2026-09-14: dei 231 permessi, `PLATFORM_ADMIN` ne ha
-- 229, e i due che gli mancano sono esattamente `whistleblowing:read` e
-- `whistleblowing:manage`, che appartengono al solo `WHISTLEBLOWING_CUSTODIAN`.
--
-- La regola dunque REGGE. Ma reggeva senza che nulla la sorvegliasse: nessuna sentinella
-- interrogava quella coppia, e una concessione sbagliata — un `GRANT` di comodo dentro una
-- migrazione futura, un ruolo nuovo che eredita troppo — sarebbe passata in silenzio. E'
-- la stessa forma del difetto che ha generato la `000380`: una persona senza secondo fattore
-- sopravvissuta dieci mesi perche' nessuno la misurava.
--
-- Questa vista chiude quel buco. E' BLOCCANTE per costruzione: `db_health.py` raccoglie da
-- `pg_views` ogni `sys.v_*` e pretende zero righe da tutte quelle non dichiarate
-- `INFORMATIVE`, quindi non serve registrarla altrove perche' faccia il suo mestiere.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. La famiglia di BRANCH_MANAGER
-- ─────────────────────────────────────────────────────────────────────────────

-- Guardia nella WHERE, non ereditata da una misura di ieri: si tocca SOLO se il campo e'
-- ancora vuoto. Se qualcuno nel frattempo ha deciso diversamente, questa riga non lo disfa.
UPDATE sys.sys_auth_roles
   SET auth_role_category = 'hierarchical_operational'
 WHERE auth_role_code = 'BRANCH_MANAGER'
   AND (auth_role_category IS NULL OR btrim(auth_role_category) = '');

DO $$
DECLARE
  cat_ora     text;
  n_senza_cat int;
  n_branch    int;
  n_non_branch int;
BEGIN
  SELECT auth_role_category INTO cat_ora
    FROM sys.sys_auth_roles WHERE auth_role_code = 'BRANCH_MANAGER';

  IF cat_ora IS DISTINCT FROM 'hierarchical_operational' THEN
    RAISE EXCEPTION
      '000414: BRANCH_MANAGER doveva restare/diventare hierarchical_operational, e invece e'' %. '
      'Se e'' una decisione nuova, questa migrazione va riscritta, non aggirata.', coalesce(cat_ora, '(vuoto)');
  END IF;

  -- La post-condizione che protegge cio' che NON doveva cambiare: nessun ALTRO ruolo
  -- deve essere rimasto senza famiglia, e nessuno deve averla persa per colpa nostra.
  SELECT count(*) INTO n_senza_cat
    FROM sys.sys_auth_roles
   WHERE auth_role_category IS NULL OR btrim(auth_role_category) = '';
  IF n_senza_cat <> 0 THEN
    RAISE EXCEPTION
      '000414: dopo la correzione ci sono ancora % ruoli senza famiglia dichiarata. '
      'Erano zero nella misura del 2026-09-14: o ne e'' nato uno nuovo, o abbiamo rotto qualcosa.', n_senza_cat;
  END IF;

  -- LA PROVA CHE IL CRITERIO E'' VERO, non solo comodo: le persone che portano questo
  -- ruolo dirigono unita' di tipo BRANCH. Se un giorno non fosse piu' cosi', la famiglia
  -- andrebbe ridiscussa — e questo NOTICE e'' il posto in cui ce ne si accorge.
  SELECT count(*) FILTER (WHERE ou.organization_unit_type = 'BRANCH'),
         count(*) FILTER (WHERE ou.organization_unit_type IS DISTINCT FROM 'BRANCH')
    INTO n_branch, n_non_branch
    FROM sys.sys_user_auth_roles ur
    JOIN sys.sys_auth_roles r  ON r.auth_role_id = ur.user_auth_role_role_id
    JOIN sys.sys_organization_units ou ON ou.organization_unit_manager_user_id = ur.user_auth_role_user_id
   WHERE r.auth_role_code = 'BRANCH_MANAGER' AND ur.user_auth_role_revoked_at IS NULL;

  IF n_non_branch > 0 THEN
    RAISE NOTICE
      '000414: % persone con BRANCH_MANAGER dirigono unita'' NON di tipo BRANCH (% invece dirigono BRANCH). '
      'Non e'' un errore da fermare, ma il criterio con cui e'' stata scelta la famiglia va riletto.',
      n_non_branch, n_branch;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. La sentinella: il whistleblowing non esce dalla custodia
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW sys.v_whistleblowing_fuori_dal_custode AS
SELECT r.auth_role_code       AS ruolo_estraneo,
       r.auth_role_category   AS famiglia_del_ruolo,
       p.auth_permission_code AS permesso,
       (SELECT count(DISTINCT ur.user_auth_role_user_id)
          FROM sys.sys_user_auth_roles ur
         WHERE ur.user_auth_role_role_id = r.auth_role_id
           AND ur.user_auth_role_revoked_at IS NULL) AS persone_che_lo_portano
  FROM sys.sys_auth_role_permissions rp
  JOIN sys.sys_auth_roles r       ON r.auth_role_id = rp.auth_role_id
  JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
 WHERE p.auth_permission_code LIKE 'whistleblowing:%'
   AND r.auth_role_code <> 'WHISTLEBLOWING_CUSTODIAN';

COMMENT ON VIEW sys.v_whistleblowing_fuori_dal_custode IS
  'BLOCCANTE (000414, 2026-09-14). Pretende ZERO righe: nessun ruolo diverso da '
  'WHISTLEBLOWING_CUSTODIAN puo'' portare un permesso `whistleblowing:*`. E'' la prima delle '
  'quattro eccezioni di ADR-0036 §5 — isolamento assoluto, nemmeno la piattaforma — resa '
  'misurabile invece che solo dichiarata: al 2026-09-14 PLATFORM_ADMIN ha 229 permessi su '
  '231, e i due che gli mancano sono esattamente questi. Se questa vista si accende, la cura '
  'NON e'' allargarla: si revoca la concessione, oppure la decisione di cambiare l''isolamento '
  'passa da un ADR nuovo. La colonna `persone_che_lo_portano` dice quanto e'' urgente.';

DO $$
DECLARE
  n_violazioni     int;
  n_del_custode    int;
  n_controprova    int;
  n_falsi_positivi int;
BEGIN
  -- (a) il dato vero: zero.
  SELECT count(*) INTO n_violazioni FROM sys.v_whistleblowing_fuori_dal_custode;
  IF n_violazioni <> 0 THEN
    RAISE EXCEPTION
      '000414: % concessioni whistleblowing fuori dalla custodia. La sentinella nasce gia'' rossa: '
      'si revocano PRIMA di installarla, altrimenti si sta installando un allarme che suona sempre.', n_violazioni;
  END IF;

  -- (b) IL VERDE NON E'' UN FALSO VERDE: se i due permessi non fossero assegnati a NESSUNO,
  --     (a) sarebbe zero per il motivo sbagliato — nessun presidio, invece di presidio che regge.
  SELECT count(*) INTO n_del_custode
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r       ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'WHISTLEBLOWING_CUSTODIAN'
     AND p.auth_permission_code LIKE 'whistleblowing:%';
  IF n_del_custode = 0 THEN
    RAISE EXCEPTION
      '000414: il custode non ha NESSUN permesso whistleblowing. La vista sarebbe verde perche'' '
      'la funzione non esiste, non perche'' e'' protetta: e'' il falso verde che questa prova esiste per prendere.';
  END IF;

  -- (c) LA CONTROPROVA: la stessa condizione, su righe finte, deve vedere le violazioni
  --     E NON marcare cio' che e' legittimo. Una prova che non sa dire di no non e'' una prova.
  SELECT count(*) FILTER (WHERE permesso LIKE 'whistleblowing:%' AND ruolo <> 'WHISTLEBLOWING_CUSTODIAN'),
         count(*) FILTER (WHERE NOT (permesso LIKE 'whistleblowing:%' AND ruolo <> 'WHISTLEBLOWING_CUSTODIAN'))
    INTO n_controprova, n_falsi_positivi
    FROM (VALUES ('HRMS_MANAGER','whistleblowing:read'),
                 ('PLATFORM_ADMIN','whistleblowing:manage'),
                 ('WHISTLEBLOWING_CUSTODIAN','whistleblowing:read'),
                 ('HRMS_MANAGER','user:update')) AS finto(ruolo, permesso);

  IF n_controprova <> 2 OR n_falsi_positivi <> 2 THEN
    RAISE EXCEPTION
      '000414: la controprova non distingue (viste % violazioni su 2 attese, % righe legittime su 2). '
      'La condizione della vista e'' sbagliata: non installarla.', n_controprova, n_falsi_positivi;
  END IF;

  RAISE NOTICE
    '000414: BRANCH_MANAGER dichiarato hierarchical_operational; sentinella whistleblowing installata '
    '(0 violazioni, % permessi in custodia, controprova superata).', n_del_custode;
END $$;

COMMIT;
