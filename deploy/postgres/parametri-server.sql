-- ============================================================================
-- Parametri del server PostgreSQL di produzione — dichiarati qui, non solo
-- sulla macchina.
--
-- #220 W1.3 (rilievo F5-03) · W1.6 (rilievi F8-10, F4-04)
--
-- PERCHE' QUESTO FILE ESISTE. Misurato il 2026-08-20: `postgresql.auto.conf`
-- sulla VM era **vuoto** e nel repo non c'era alcuna configurazione di server.
-- Ogni parametro non-default viveva quindi in un solo posto — la macchina — e
-- nessuno poteva dire, leggendo il repo, come fosse configurata la produzione.
-- Un `ALTER SYSTEM` battuto a mano una sera non lascia traccia da nessun'altra
-- parte: e' lo stesso difetto che W1.7 corregge per le unit systemd.
--
-- COME SI APPLICA (serve superuser: l'utente applicativo `heuresys` non lo e')
--     ssh oracle-vm-default 'sudo -u postgres psql -f -' < deploy/postgres/parametri-server.sql
--     ssh oracle-vm-default 'sudo -u postgres psql -tAc "SELECT pg_reload_conf()"'
--
-- ⚠ `ALTER SYSTEM` NON GIRA DENTRO UNA TRANSAZIONE: un `psql -c` che ne
-- concatena piu' d'uno con il punto e virgola fallisce in blocco. Uno per
-- comando, oppure — come qui — un file, dove psql li esegue separatamente.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tracciare chi si connette (F5-03)
--
-- Misurato prima: log_connections=off, log_disconnections=off. Il database non
-- conservava alcuna traccia di chi apriva una sessione. Non era un guasto —
-- era un'assenza, ed e' la ragione per cui nessuno se n'era accorto.
-- ---------------------------------------------------------------------------
ALTER SYSTEM SET log_connections = 'on';
ALTER SYSTEM SET log_disconnections = 'on';

-- Il prefisso di riga decide se un log e' leggibile o solo voluminoso. Al
-- default (`%m [%p] %q%u@%d`) mancano l'host di provenienza e il nome
-- dell'applicazione: senza, «chi si e' connesso» resta senza risposta proprio
-- quando serve. `%h` e `%a` la danno — verificato nel log reale, dove ora si
-- legge `... 127.0.0.1 psql LOG: connection authorized ...`.
ALTER SYSTEM SET log_line_prefix = '%m [%p] %q%u@%d %h %a ';

-- ---------------------------------------------------------------------------
-- 2. Le query lente (F5-03)
--
-- Misurato prima: -1, cioe' spento. La soglia e' 1 secondo, non 0: registrare
-- OGNI istruzione su un database di produzione produce un volume che nessuno
-- legge e che consuma il disco — e un log che nessuno legge non e' un presidio,
-- e' un costo. Il disco misurato lo stesso giorno era al 77% (23G liberi su
-- 96G): ampio, ma non tale da giustificare la registrazione integrale.
-- ---------------------------------------------------------------------------
ALTER SYSTEM SET log_min_duration_statement = '1000ms';

-- ---------------------------------------------------------------------------
-- 3. Il tempo dentro le funzioni PL (F8-10)
--
-- Context `superuser`, NON `postmaster`: entra in vigore con il solo reload.
-- La prima stesura di questo file lo aveva messo fra i parametri che pretendono
-- un riavvio — sbagliato, e scoperto solo perche' dopo il reload
-- `pending_restart` risultava gia' `false`. Il context non si ricorda a
-- memoria, si chiede:
--     SELECT name, context FROM pg_settings WHERE name = '<nome>';
-- ---------------------------------------------------------------------------
ALTER SYSTEM SET track_functions = 'pl';

-- ===========================================================================
-- 4. L'UNICO PARAMETRO CHE PRETENDE UN RESTART (context = postmaster)
--
-- Scritto, ma NON attivo finche' PostgreSQL non viene riavviato. Il riavvio e'
-- F4 di #220: pianificato e annunciato, mai di passaggio — e' la produzione, e
-- ogni connessione aperta cade.
--
--     SELECT name, setting, pending_restart FROM pg_settings
--      WHERE name = 'pg_stat_statements.max';
-- `pending_restart = true` significa: scritto, non ancora in vigore.
--
-- F4-04 — il numero di istruzioni distinte che `pg_stat_statements` conserva.
-- Al default (5.000) le istruzioni meno frequenti vengono sfrattate, e sono
-- proprio quelle che si vorrebbe vedere quando si cerca una lentezza rara.
-- ===========================================================================
ALTER SYSTEM SET pg_stat_statements.max = '10000';

-- ===========================================================================
-- ⛔ CIO' CHE QUESTO FILE NON FA, E PERCHE' — la parte piu' importante.
--
-- `logging_collector` RESTA SPENTO. Il dossier chiedeva «logging server con
-- rotazione» e la conclusione ovvia era accenderlo. E' sbagliata su questa
-- macchina, e la misura lo ha mostrato:
--
--   · il log su file ESISTE GIA': /var/log/postgresql/postgresql-16-main.log,
--     prodotto dal redirect di stderr che il pacchetto Debian imposta;
--   · la rotazione ESISTE GIA': /etc/logrotate.d/postgresql-common —
--     `weekly, rotate 10, copytruncate, compress`, e i file ruotati fino a
--     `.8.gz` lo dimostrano sul disco.
--
-- Accendere il collector metterebbe DUE meccanismi di rotazione sullo stesso
-- file: PostgreSQL che apre e ruota per conto suo, e logrotate che continua a
-- fare `copytruncate` sotto di lui. Non e' un miglioramento, e' un conflitto.
--
-- Percio' sono stati anche RESETtati i cinque parametri che la prima stesura
-- aveva scritto (log_directory, log_filename, log_rotation_age,
-- log_rotation_size, log_truncate_on_rotation): erano inerti col collector
-- spento, e con il collector acceso sarebbero stati dannosi. Una configurazione
-- inerte non e' innocua — dichiara un'intenzione che il sistema non esegue, e
-- il prossimo che la legge ci crede.
--
-- L'errore iniziale nasce da una misura fatta male, e vale la pena scriverlo:
-- un `ls /var/log/postgresql/ | head -5` aveva mostrato solo i due file di
-- pgbouncer, e da li' era nata la conclusione «PostgreSQL non ha log propri».
-- Il file c'era, piu' in basso nell'elenco. Il taglio era mio, non del sistema.
-- ===========================================================================
