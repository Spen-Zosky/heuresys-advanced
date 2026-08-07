-- ═══════════════════════════════════════════════════════════════════════════════
-- 000287_user_census_158_plus_3.sql
--
-- #139 — IL CENSIMENTO DELLE PERSONE È 158 + 3, E DA ORA SE NE ACCORGE UNA SENTINELLA.
--
-- LA DECISIONE (Enzo, 2026-08-07): «gli utenti devono essere solo 161: RTL 158 e
-- Heuresys 3. Nessuna altra configurazione di utenti è possibile, almeno al momento.»
--
-- LO STATO MISURATO: `sys.sys_users` ha **162** righe — RTL Bank 158 (giusto) e
-- Heuresys **4**. La riga di troppo è `admin@heuresys.com`.
--
-- PERCHÉ NON SI CANCELLA, E COSA SI FA INVECE. `admin@heuresys.com` è l'account con
-- cui accedono gli E2E e **119 file di test**: cancellarlo spegnerebbe la suite. Ma
-- non è una persona — è l'utenza tecnica dell'amministratore di piattaforma. Quindi
-- non sparisce: **smette di contare come persona**, con `user_type='SERVICE'`.
-- È esattamente il rimedio che `#139` proponeva dall'inizio.
--
-- ⚠️ QUESTA MIGRAZIONE ROVESCIA UNA CONCLUSIONE PRESA POCHE ORE PRIMA, e va detto.
-- Nella `000285` avevo scritto di NON tipizzare `admin@heuresys.com` perché, con
-- `user_type='SERVICE'` come condizione di eleggibilità all'esenzione MFA, marcarlo
-- avrebbe reso esentabile proprio l'amministratore umano che il `000118` proteggeva.
-- Quell'obiezione **non vale più**, e non perché sia stata dimenticata: la `000284` ha
-- sganciato l'eleggibilità dal tipo, e ora serve anche l'iscrizione nominativa in
-- `sys_auth_mfa_exemption_eligible_users`, che è vuota. Tipizzare SERVICE questo
-- account **non gli apre nulla**. Il lavoro di sicurezza fatto prima è ciò che rende
-- sicura questa riga adesso.
--
-- LA SENTINELLA. «Consolidare il dato» non è applicarlo una volta: è fare in modo che
-- una deviazione si veda **da sola**. `sys.v_user_census_deviation` restituisce una
-- riga per ogni scostamento, e `db_health.py` interroga tutte le viste `sys.v_*` a
-- ogni avvio di sessione e dentro il cancello di verifica: da qui in poi un utente in
-- più o in meno accende una spia senza che nessuno debba ricordarsi di contare.
--
-- Il censimento atteso è dichiarato DENTRO la vista, non in una tabella: è una
-- decisione, e deve cambiare solo con una migrazione che si vede nel diff. Una tabella
-- si modificherebbe con una UPDATE che non lascia traccia in revisione — e in più
-- andrebbe iscritta nel registro di riconciliazione (lezione della `000284`, che senza
-- quell'iscrizione ha fatto cadere la catena alla passata successiva).
--
-- NON è un'asserzione-fotografia mascherata: la differenza è che il numero è
-- **dichiarato con la sua data e la sua ragione**, non deriva da una misura che
-- qualcuno ha congelato. Quando il censimento cambierà, cambierà qui, di proposito.
--
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- §1 — l'utenza tecnica smette di contare come persona.
UPDATE sys.sys_users
   SET user_type = 'SERVICE', updated_at = now()
 WHERE user_email = 'admin@heuresys.com'
   AND user_type <> 'SERVICE';

-- §2 — la sentinella del censimento.
CREATE OR REPLACE VIEW sys.v_user_census_deviation AS
WITH atteso(tenant_code, persone_attese) AS (
  -- DICHIARATO da Enzo il 2026-08-07: «RTL 158 e Heuresys 3, nessuna altra
  -- configurazione e' possibile, almeno al momento». Cambiare qui, con una migrazione.
  VALUES ('RTL_BANK', 158), ('HEURESYS', 3)
),
reale AS (
  SELECT t.tenant_code,
         count(*) FILTER (WHERE u.user_type IS DISTINCT FROM 'SERVICE') AS persone_reali
    FROM sys.sys_tenancies t
    LEFT JOIN sys.sys_users u ON u.user_tenant_id = t.tenant_id
   GROUP BY t.tenant_code
)
SELECT COALESCE(a.tenant_code, r.tenant_code)          AS tenant_code,
       COALESCE(a.persone_attese, 0)                   AS persone_attese,
       COALESCE(r.persone_reali, 0)                    AS persone_reali,
       CASE WHEN a.tenant_code IS NULL THEN 'tenant non dichiarato nel censimento'
            WHEN r.tenant_code IS NULL THEN 'tenant dichiarato ma assente'
            ELSE 'scostamento nel numero di persone' END AS motivo
  FROM atteso a
  FULL OUTER JOIN reale r ON r.tenant_code = a.tenant_code
 WHERE COALESCE(a.persone_attese, -1) IS DISTINCT FROM COALESCE(r.persone_reali, -1)
   -- Un tenant senza persone e senza attesa non e' uno scostamento: e' un tenant vuoto,
   -- che e' legittimo (un tenant appena creato non ha ancora nessuno dentro).
   AND NOT (COALESCE(a.persone_attese, 0) = 0 AND COALESCE(r.persone_reali, 0) = 0);

COMMENT ON VIEW sys.v_user_census_deviation IS
  '#139 — scostamenti dal censimento dichiarato delle persone (Enzo 2026-08-07: RTL 158 + Heuresys 3). '
  'Zero righe = censimento rispettato. Le utenze di servizio (user_type=SERVICE) NON contano come persone. '
  'Interrogata automaticamente da docs/kb/tools/db_health.py a ogni avvio di sessione.';

-- §3 — post-condizioni.
DO $mig$
DECLARE
  v_dev  bigint;
  v_pers bigint;
  v_tipo text;
  v_det  text;
BEGIN
  SELECT user_type INTO v_tipo FROM sys.sys_users WHERE user_email = 'admin@heuresys.com';
  IF v_tipo IS DISTINCT FROM 'SERVICE' THEN
    RAISE EXCEPTION '000287: admin@heuresys.com risulta % invece di SERVICE', COALESCE(v_tipo,'(assente)');
  END IF;

  SELECT count(*), string_agg(tenant_code||': attese '||persone_attese||', reali '||persone_reali||' ('||motivo||')', ' · ')
    INTO v_dev, v_det FROM sys.v_user_census_deviation;
  IF v_dev > 0 THEN
    RAISE EXCEPTION '000287: il censimento non torna — %', v_det;
  END IF;

  SELECT count(*) INTO v_pers FROM sys.sys_users WHERE user_type IS DISTINCT FROM 'SERVICE';
  IF v_pers <> 161 THEN
    RAISE EXCEPTION '000287: le persone sono % invece di 161', v_pers;
  END IF;

  -- Le tre persone di Heuresys si verificano PER NOME, non per numero (Enzo,
  -- 2026-08-07: «Heuresys ha solo Enzo Spenuso, Chiara Spenuso e Andrea Spenuso»).
  -- Un conteggio direbbe «sono tre» anche se fossero tre sbagliate: qui si pretende
  -- che siano esattamente quelle, cioe' cio' che e' stato dichiarato.
  SELECT string_agg(u.user_email, ', ' ORDER BY u.user_email) INTO v_det
    FROM sys.sys_users u JOIN sys.sys_tenancies t ON t.tenant_id = u.user_tenant_id
   WHERE t.tenant_code = 'HEURESYS' AND u.user_type IS DISTINCT FROM 'SERVICE';
  IF v_det IS DISTINCT FROM 'andrea.spenuso@heuresys.com, chiara.spenuso@heuresys.com, enzo.spenuso@heuresys.com' THEN
    RAISE EXCEPTION '000287: le persone di Heuresys sono [%] e non le tre dichiarate', COALESCE(v_det,'(nessuna)');
  END IF;

  RAISE NOTICE '000287 done: 161 persone (RTL 158 + Heuresys 3); admin@heuresys.com e utenza di servizio e NON e esentabile (elenco eleggibili: % righe)',
    (SELECT count(*) FROM sys.sys_auth_mfa_exemption_eligible_users);
END $mig$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════════
-- BEGIN;
--   DROP VIEW IF EXISTS sys.v_user_census_deviation;
--   UPDATE sys.sys_users SET user_type='STANDARD' WHERE user_email='admin@heuresys.com';
-- COMMIT;
