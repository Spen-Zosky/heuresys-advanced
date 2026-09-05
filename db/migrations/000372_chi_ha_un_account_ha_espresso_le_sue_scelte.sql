-- ─────────────────────────────────────────────────────────────────────────────
-- 000372 — Chi ha un account ha espresso le sue scelte sui trattamenti
--
-- ── DA DOVE VIENE ────────────────────────────────────────────────────────────
-- La custodia della storia RTL era ROSSA su quattro check (2026-09-05). Il triage
-- a tre esiti che il report stesso impone li separa in due famiglie:
--
--   C4a, C4h  → il CHECK era troppo largo: pretendeva formazione obbligatoria e
--               monte-ore CCNL da chi non ha alcun rapporto di lavoro. Corretti
--               alla fonte in `verify-storia36.sql` (pavimento C4 e platea C4h(i)).
--   C10a      → qui il check ha ragione, e manca il DATO. Questa migrazione.
--
-- ── PERCHE' C10a E' UN CASO DIVERSO DA C4a/C4h ──────────────────────────────
-- La formazione sulla sicurezza e il monte-ore CCNL si devono in quanto
-- LAVORATORI: chi non ha un rapporto di lavoro non li deve, e chiederglieli era
-- il difetto. Le scelte sui trattamenti facoltativi si devono invece in quanto
-- PERSONE di cui si trattano i dati: chi ha un account ne ha, rapporto di lavoro
-- o no. Applicare a C10a la stessa scorciatoia usata per C4h avrebbe nascosto un
-- dato mancante dietro un perimetro ristretto.
--
-- ── LA MISURA (2026-09-05, produzione) ──────────────────────────────────────
-- Utenti ATTIVI di RTL Bank senza le quattro scelte: DUE, entrambi con ZERO
-- scelte espresse — `governo@collaudo.invalid` e `persona@collaudo.invalid`,
-- creati il 2026-08-25 da `db/scripts/provision-collaudo-access.ts`. Tutti gli
-- altri ne hanno quattro su quattro.
--
-- ── LA SCELTA CHE SI REGISTRA, E PERCHE' QUESTA ─────────────────────────────
-- `REVOKE` su tutti e quattro: i trattamenti sono FACOLTATIVI, e per un account
-- che nessuno ha mai interrogato l'unica scelta difendibile e' quella che non
-- concede nulla. Registrare un GRANT significherebbe inventare un consenso.
-- `consent_source = 'ADMIN'`, che e' la verita': non l'ha espressa la persona
-- dal portale, l'ha registrata l'amministrazione.
--
-- DUE ROSSI CHE QUESTA SCRITTURA NON DEVE ACCENDERE, verificati prima di
-- scriverla e non dopo:
--   C10a(ii)  «scelte espresse prima dell'ingresso in azienda» — confronta con
--             `min(hire_date)`; per chi non ha rapporto di lavoro la subquery e'
--             NULL, il confronto e' NULL, e la riga non viene contata.
--   C10a(iii) «revoche di un consenso mai dato» — guarda le sole revoche con
--             `consent_source = 'ESS'`. Le nostre sono 'ADMIN' e restano fuori.
--
-- IDEMPOTENTE: scrive solo le coppie (utente, trattamento) che mancano. Alla
-- seconda passata, zero righe.
-- ROLLBACK: elenco esplicito, mai un jolly —
--   DELETE FROM sys.sys_user_consents WHERE consent_note = 'mig-000372';
-- ─────────────────────────────────────────────────────────────────────────────

-- (a) la misura PRIMA, per la post-condizione di cio' che NON deve cambiare
DROP TABLE IF EXISTS _372_prima;
CREATE TEMP TABLE _372_prima AS
  SELECT count(*) AS righe_totali,
         count(*) FILTER (WHERE consent_note IS DISTINCT FROM 'mig-000372') AS righe_altrui
    FROM sys.sys_user_consents;

-- (b) la scrittura: elenco meccanico, nessun nome scritto a mano
WITH mancanti AS (
  SELECT u.user_id, u.user_tenant_id, u.created_at, p.purpose
    FROM sys.sys_users u
    CROSS JOIN (VALUES ('ANALYTICS_PROFILING'), ('MARKETING_COMMUNICATIONS'),
                       ('INTERNAL_PHOTO_USE'), ('THIRD_PARTY_SHARING')) AS p(purpose)
   WHERE u.user_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
     AND u.user_status = 'ACTIVE'
     AND NOT EXISTS (SELECT 1 FROM sys.sys_user_consents c
                      WHERE c.consent_user_id = u.user_id
                        AND c.consent_purpose = p.purpose)
)
-- `consent_seq` NON si elenca: e' una colonna identita' GENERATED ALWAYS, e
-- fornirgliela fa fallire l'INSERT. `information_schema.columns.column_default`
-- la mostra vuota — una misura vera che suggerisce la conclusione sbagliata, perche'
-- le colonne identita' non passano da un default. Visto rosso sul gemello prima di
-- toccare la produzione.
INSERT INTO sys.sys_user_consents
  (consent_tenant_id, consent_user_id, consent_purpose, consent_action,
   consent_source, consent_note, consent_occurred_at)
SELECT m.user_tenant_id, m.user_id, m.purpose, 'REVOKE', 'ADMIN', 'mig-000372',
       m.created_at
  FROM mancanti m;

-- (c) post-condizioni: cio' che DOVEVA cambiare E cio' che NON doveva
DO $$
DECLARE
  n_senza int; n_altrui_prima int; n_altrui_ora int; n_ess int;
BEGIN
  -- doveva cambiare: nessuno resta senza le quattro scelte
  SELECT count(*) INTO n_senza
    FROM sys.sys_users u
   WHERE u.user_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
     AND u.user_status = 'ACTIVE'
     AND (SELECT count(DISTINCT c.consent_purpose) FROM sys.sys_user_consents c
           WHERE c.consent_user_id = u.user_id) < 4;
  IF n_senza <> 0 THEN
    RAISE EXCEPTION '000372: restano % persone senza le quattro scelte', n_senza;
  END IF;

  -- NON doveva cambiare: nessuna riga preesistente e' stata toccata
  SELECT righe_altrui INTO n_altrui_prima FROM _372_prima;
  SELECT count(*) INTO n_altrui_ora
    FROM sys.sys_user_consents WHERE consent_note IS DISTINCT FROM 'mig-000372';
  IF n_altrui_ora <> n_altrui_prima THEN
    RAISE EXCEPTION '000372: le scelte gia'' registrate sono passate da % a %',
      n_altrui_prima, n_altrui_ora;
  END IF;

  -- NON doveva accendersi: nessuna delle nostre e' una revoca dal portale
  SELECT count(*) INTO n_ess
    FROM sys.sys_user_consents
   WHERE consent_note = 'mig-000372' AND consent_source = 'ESS';
  IF n_ess <> 0 THEN
    RAISE EXCEPTION '000372: % scelte scritte come ESS: accenderebbero C10a(iii)', n_ess;
  END IF;

  RAISE NOTICE '000372 OK: nessuno senza le quattro scelte · % righe preesistenti intatte',
    n_altrui_ora;
END $$;

DROP TABLE IF EXISTS _372_prima;
