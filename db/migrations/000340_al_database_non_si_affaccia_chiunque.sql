-- ============================================================================
-- 000340 — #220 W1.5 (rilievo F5-06): `PUBLIC` non si connette piu' a questo
--          database. Solo i ruoli che hanno il permesso per nome.
--
-- IL DIFETTO, misurato sul vivo il 2026-08-20:
--   SELECT datname, datacl FROM pg_database WHERE datname='heuresys_advanced';
--   -> {=Tc/heuresys, heuresys=CTc/heuresys, codex_auditor=c/heuresys, gov_worker=c/heuresys}
--   La prima voce, quella che comincia con `=` e non ha un nome davanti, E'
--   `PUBLIC`: `T` temporary, `c` connect. Qualunque ruolo del cluster — anche
--   uno creato domani per un altro progetto sulla stessa macchina — poteva
--   aprire una connessione a questo database.
--
-- L'INDAGINE VIENE PRIMA DELLA REVOCA, ed e' la parte che conta: una revoca di
-- connessione spegne cio' che non ha il permesso per nome, e chi si accorge del
-- danno e' il primo job notturno che fallisce. Le due anomalie che il dossier
-- segnalava sono state misurate, e nessuna delle due e' cio' che sembrava:
--
--   · `lls` (CREATEDB, nessun grant applicativo qui) NON e' un'anomalia: e' il
--     proprietario del database `lalibraiascalza`, un altro progetto ospitato
--     sulla stessa VM. Ha CREATEDB perche' e' il proprietario del suo. Non lo
--     si tocca — non e' nostro.
--   · `heuresys_backup` (BYPASSRLS, nessun privilegio di lettura) e' un ruolo
--     ORFANO: il backup di produzione gira come `sudo -u postgres pg_dump`
--     (`scripts/backup-db.sh`, unit `heuresys-advanced-backup.timer`), quindi
--     quel ruolo non e' usato da nessuno. Il suo `BYPASSRLS` e' per giunta
--     inutile: questo progetto non usa RLS da nessuna parte (I5).
--     Rimuoverlo e' una `DROP ROLE` sulla produzione, cioe' una decisione di
--     Enzo come lo e' `gov_worker` (R12 del ritiro gov): NON si fa qui. Qui si
--     constata soltanto che la revoca non lo rompe, perche' non serve a nulla.
--   · pgbouncer: verificato che serve solo `heuresys_platform`, non questo
--     database. Nessun consumatore nascosto passa di li'.
--
-- CHI RESTA DENTRO, e perche' la revoca non li tocca: `heuresys` (proprietario,
-- `CTc` esplicito — e' l'identita' dell'API), `codex_auditor` e `gov_worker`
-- (`c` esplicito), `postgres` (superuser: nessun ACL lo limita).
--
-- SI REVOCA SOLO `CONNECT`, non `TEMPORARY`. Il rilievo parla della
-- connessione, e senza connessione il permesso di creare tabelle temporanee non
-- ha modo di essere esercitato: toglierlo anche sarebbe un cambiamento in piu'
-- con un rischio in piu' e nessun guadagno.
--
-- SOLO IL DATABASE CORRENTE. `heuresys_platform` ha lo stesso ACL, ma ci si
-- affaccia pgbouncer e non e' stato misurato con quale identita' passino i suoi
-- consumatori: revocare li' senza quella misura sarebbe esattamente l'errore
-- che questo file evita per `heuresys_advanced`. Resta da fare, dichiarato.
-- `lalibraiascalza` non e' nostro.
--
-- ROLLBACK DICHIARATO: nessun giornale `staging.*_undo` — non si tocca alcuna
-- riga. L'inversa e' `GRANT CONNECT ON DATABASE <db> TO PUBLIC`.
--
-- IDEMPOTENTE: revocare un privilegio gia' assente non e' un errore.
-- ============================================================================

DO $$
DECLARE db text := current_database();
BEGIN
  -- GUARDIA — ri-verificata AL MOMENTO dell'esecuzione, non ereditata dalla
  -- misura di prima. Se il proprietario non avesse il CONNECT per nome, questa
  -- revoca lo chiuderebbe fuori dal suo stesso database, e la catena non
  -- potrebbe piu' essere applicata: sarebbe un guasto senza ritorno facile.
  IF NOT EXISTS (
    SELECT 1 FROM pg_database d
     WHERE d.datname = db
       AND has_database_privilege(pg_get_userbyid(d.datdba), db, 'CONNECT')
  ) THEN
    RAISE EXCEPTION '000340: il proprietario di % non ha CONNECT — revoca annullata', db;
  END IF;

  EXECUTE format('REVOKE CONNECT ON DATABASE %I FROM PUBLIC', db);
END $$;

-- ---------------------------------------------------------------------------
-- POST-CONDIZIONE. Il secondo controllo protegge cio' che NON doveva cambiare:
-- contare che PUBLIC sia uscito non distingue «ho chiuso la porta agli estranei»
-- da «ho chiuso la porta a tutti», che e' il guasto di questo file — e si
-- manifesterebbe al primo riavvio dell'API, non qui.
-- ---------------------------------------------------------------------------
DO $$
DECLARE db text := current_database(); ancora_aperto boolean; fuori text;
BEGIN
  SELECT has_database_privilege('public', db, 'CONNECT') INTO ancora_aperto;
  IF ancora_aperto THEN
    RAISE EXCEPTION '000340: PUBLIC puo'' ancora connettersi a %', db;
  END IF;

  -- i ruoli che DEVONO restare dentro, per nome: il proprietario (l'API) e i
  -- due di sola lettura che avevano il CONNECT esplicito.
  SELECT string_agg(r.rolname, ', ') INTO fuori
    FROM pg_roles r
   WHERE r.rolname IN (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = db)
      OR (r.rolname IN ('codex_auditor', 'gov_worker')
          AND EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r.rolname))
  ;
  -- verifica vera: nessuno di loro deve aver perso l'accesso
  IF EXISTS (
    SELECT 1 FROM pg_roles r
     WHERE (r.rolname = (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = db)
            OR r.rolname IN ('codex_auditor', 'gov_worker'))
       AND NOT has_database_privilege(r.rolname, db, 'CONNECT')
  ) THEN
    RAISE EXCEPTION '000340: un ruolo che doveva restare dentro ha perso CONNECT su % (candidati: %)', db, fuori;
  END IF;

  RAISE NOTICE '000340 ok — PUBLIC fuori da %, i ruoli nominati restano dentro (%)', db, fuori;
END $$;
