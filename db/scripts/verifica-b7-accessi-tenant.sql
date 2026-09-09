-- db/scripts/verifica-b7-accessi-tenant.sql — B7 (bundle 2026-09-09).
--
-- Non e' una sentinella sys.v_* (non e' un difetto strutturale continuo: e' la verifica
-- puntuale che il codice NON stia riscrivendo il difetto bonificato il 2026-09-09).
--
-- CONTESTO: 3.744 eventi di sys.sys_auth_login_events portavano tenant=RTL_BANK con
-- l'utente (sempre e solo enzo.spenuso@heuresys.com) di HEURESYS. Misurato: tutti datati
-- 2026-05-18/30, PRIMA che il tenant HEURESYS esistesse (creato 2026-05-30 16:28:59 — 17
-- minuti dopo l'ultimo evento sbagliato). Fino ad allora RTL_BANK era l'unico tenant: quegli
-- eventi erano corretti nel momento in cui sono stati scritti. Non era un difetto di codice —
-- e questa query lo dimostra, invece di darlo per buono: se il codice fosse rotto, questa
-- query tornerebbe un numero che cresce nel tempo. Bonificati con
-- 03_sql/21_T2_accessi_etichettati_male.sql (rollback in staging.accessi_etichettati_male_undo).
--
-- Uso: psql ... -f db/scripts/verifica-b7-accessi-tenant.sql
--   atteso: 0 righe SEMPRE (anche a distanza di mesi). Un numero positivo qui significa che
--   qualche punto di scrittura sta di nuovo etichettando un evento con un tenant diverso da
--   quello dell'utente — cercare con `grep -rn "sys_auth_login_events" apps/api/src`.

SELECT count(*) AS mismatch_tenant_evento_vs_utente
  FROM sys.sys_auth_login_events e
  JOIN sys.sys_users u ON u.user_id = e.auth_login_event_user_id
 WHERE e.auth_login_event_tenant_id IS NOT NULL
   AND e.auth_login_event_tenant_id <> u.user_tenant_id;
