-- 000380 — Una persona senza secondo fattore dev'essere un numero che si guarda.
--
-- S1091 (2026-09-07). Trovata misurando: `alberto.rossetti@rtl-bank.org` esisteva dal
-- 2025-11-26, aveva identita' e credenziale, e **nessun fattore TOTP** — solo su di lui,
-- fra 159 persone. Non era un utente nuovo in attesa di provisioning: era un residuo, e
-- nessuno se ne era accorto perche' NIENTE LO GUARDAVA.
--
-- Le viste `v_*` di questo schema erano gia' 34, e sui fattori ce n'era una sola:
-- `v_mfa_secrets_in_cleartext`, che presidia i segreti in chiaro. L'ASSENZA di un fattore
-- non era misurata da nessuno. Curato il caso (`pnpm db:provision-access`, che crea solo
-- cio' che manca: 1 fattore creato, 0 credenziali toccate, 158 invariati), resta il difetto
-- vero — che il prossimo residuo sarebbe di nuovo invisibile.
--
-- ⚠ INFORMATIVA, NON BLOCCANTE, e la ragione va scritta perche' non e' una deroga comoda.
-- Due persone sono senza fattore PER DECISIONE (Enzo, S1032): `chiara.spenuso@heuresys.com`
-- e `andrea.spenuso@heuresys.com` non sono toccate dalla derivazione — «le loro password le
-- scelgono loro». Una sentinella bloccante dovrebbe quindi escluderle, e per farlo dovrebbe
-- ricopiare qui l'elenco `REAL_PERSON_EMAILS` che vive in `derive-access.mjs`: due verita'
-- sullo stesso fatto, destinate a divergere — lo stesso difetto che questa sessione ha gia'
-- nominato due volte. E l'elenco delle esenzioni MFA non le puo' accogliere: il trigger
-- della 000118 le rifiuterebbe, perche' ammette SOLO utenze SERVICE, ed e' giusto cosi'.
--
-- Quindi la vista CONTA STATO, non anomalie: elenca chi non ha un secondo fattore e lascia
-- che sia chi legge a riconoscere le due attese. Il valore non e' il rosso automatico: e'
-- che il numero **si vede**. Il difetto di `alberto` e' sopravvissuto dieci mesi proprio
-- perche' non era un numero che qualcuno guardava — la stessa forma di `#246`, dove un
-- terzo dell'organico a tempo determinato e' passato inosservato per due anni.
--
-- Va dichiarata in `INFORMATIVE` di `docs/kb/tools/db_health.py`, o rende rossa la prova
-- generale: db_health raccoglie da `pg_views` ogni `v_*` e pretende zero righe da tutte
-- quelle che non sono dichiarate.

-- @migrate: once

BEGIN;

CREATE OR REPLACE VIEW sys.v_persona_senza_secondo_fattore AS
SELECT u.user_id,
       u.user_email,
       u.user_type,
       t.tenant_name,
       u.created_at::date AS persona_dal,
       -- Dichiarato qui perche' chi legge la riga sappia SUBITO se e' un'attesa o un
       -- residuo, senza dover ricordare la decisione di S1032.
       (u.user_email IN ('chiara.spenuso@heuresys.com', 'andrea.spenuso@heuresys.com'))
         AS attesa_per_decisione
  FROM sys.sys_users u
  LEFT JOIN sys.sys_tenancies t ON t.tenant_id = u.user_tenant_id
 WHERE u.user_status = 'ACTIVE'
   -- Le utenze di servizio non hanno un secondo fattore PER PROGETTO (#169 F2:
   -- «l'autonomia dell'accesso sta nell'esenzione, non in un segreto in piu' da
   -- custodire»). Escluderle non e' indulgenza: contarle sarebbe rumore garantito.
   AND u.user_type <> 'SERVICE'
   AND NOT EXISTS (
     SELECT 1 FROM sys.sys_auth_mfa_factors f
      WHERE f.auth_mfa_factor_user_id = u.user_id
   );

COMMENT ON VIEW sys.v_persona_senza_secondo_fattore IS
  'INFORMATIVA (S1091, 2026-09-07). Elenca le persone ATTIVE senza alcun fattore MFA. NON '
  'pretende zero righe: due persone sono escluse dalla derivazione per decisione di Enzo '
  '(S1032) e la colonna `attesa_per_decisione` le marca. Nasce da un residuo vero — una '
  'persona con identita'' e credenziale ma senza fattore, sopravvissuta dieci mesi perche'' '
  'nessuna vista lo misurava. Le utenze SERVICE sono fuori per progetto (#169 F2). Si cura '
  'con `pnpm db:provision-access`, che crea solo cio'' che manca.';

DO $$
DECLARE
  n_senza     int;
  n_attese    int;
  n_residui   int;
  n_service   int;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE attesa_per_decisione)
    INTO n_senza, n_attese
    FROM sys.v_persona_senza_secondo_fattore;
  n_residui := n_senza - n_attese;

  -- LA PROVA CHE LA VISTA PUO' VEDERE: se non distinguesse, `attesa_per_decisione`
  -- sarebbe sempre falsa (o sempre vera) e il conteggio non direbbe niente. Qui si
  -- pretende che le due attese siano ESATTAMENTE due: se domani una di loro ricevesse un
  -- fattore, questo numero calerebbe e la migrazione — che gira a ogni deploy — lo direbbe.
  IF n_attese <> 2 THEN
    RAISE NOTICE
      '000380: le persone senza fattore attese per decisione sono % invece di 2. Non e'' un '
      'errore da fermare, ma il commento della vista e'' da rileggere.', n_attese;
  END IF;

  -- E la controprova sull'esclusione delle SERVICE: se la vista le contasse, il numero
  -- salirebbe di tre e nessuno se ne accorgerebbe leggendo solo il totale.
  SELECT count(*) INTO n_service
    FROM sys.v_persona_senza_secondo_fattore v
    JOIN sys.sys_users u ON u.user_id = v.user_id
   WHERE u.user_type = 'SERVICE';
  IF n_service <> 0 THEN
    RAISE EXCEPTION
      '000380: la vista sta contando % utenze SERVICE, che per progetto non hanno un '
      'secondo fattore: il filtro non funziona', n_service;
  END IF;

  RAISE NOTICE
    '000380: senza secondo fattore % (attese per decisione %, residui da curare %).',
    n_senza, n_attese, n_residui;
END $$;

COMMIT;
