-- ═══════════════════════════════════════════════════════════════════════════════
-- 000265_heuresys_two_axes_disentangled.sql
--
-- I DUE ASSI DEL TENANT HEURESYS SMETTONO DI DIRE LA STESSA COSA.
--
-- Registro #122. Per ADR-0027 gli assi sono ORTOGONALI: l'organizzativo dice
-- *su chi*, il funzionale *quali attivita'*. Una riga identica in entrambi non
-- esprime ortogonalita', la annulla — chi legge il perimetro funzionale ottiene
-- le stesse persone del perimetro organizzativo, e l'asse funzionale su quel
-- tenant non misura piu' nulla.
--
-- A. `HS-MGMT` ESISTE DUE VOLTE, UNA PER ASSE
--   Stesso codice, stessa persona alla guida, un solo membro: e' l'unita'
--   organizzativa scritta due volte, non una squadra. La riga di `sys_teams` se
--   ne va; i suoi membri seguono per CASCADE (verificato: 1 riga).
--
-- B. `HS-PROD` E' UN CONCETTO DELL'ASSE FUNZIONALE CHE VIVE NELL'ALBERO
--   E' l'UNICA unita' organizzativa di tipo `TEAM` del database (verificato: 1
--   attiva, 0 disattivate) e non ha alcuna riga in `sys_teams`. Diventa `OFFICE`,
--   che e' il tipo dell'asse organizzativo giusto per un'unita' di una persona
--   secondo la regola gia' applicata a RTL Bank.
--
-- C. LA GUARDIA CHE RENDE LA CORREZIONE DUREVOLE
--   Il `CHECK` sul tipo ammetteva `TEAM`, cioe' permetteva al difetto di
--   riformarsi. `TEAM` esce dai tipi ammessi: una squadra appartiene a
--   `sys_teams`, non all'albero delle unita'. Si stringe DOPO la ri-tipizzazione,
--   altrimenti il vincolo rifiuterebbe la riga che stiamo correggendo.
--
-- ⚠ PERIMETRO — QUESTA MIGRAZIONE TOCCA SOLO IL TENANT HEURESYS.
--   La consegna dichiarava il difetto «circoscritto a 2 unita' su 43 e 2 persone
--   su 161, entrambe del tenant Heuresys». La misura dice altro: **24 squadre
--   condividono il codice con un'unita' organizzativa attiva — 1 su HEURESYS e
--   23 su RTL_BANK** — e di queste **15 condividono anche il nome**, che e'
--   esattamente la condizione che il criterio di chiusura vieta. `HS-MGMT` non e'
--   nemmeno fra quelle 15 (i nomi differiscono di una parola).
--
--   Le 23 di RTL NON si toccano qui. Portano l'asse funzionale di circa 150
--   persone — `DIV-CRED` da sola ha 33 membri — e cancellarle sarebbe una
--   modifica di dati di un ordine di grandezza diverso da quello autorizzato,
--   presa mentre si eseguiva un'altra consegna. E' un reperto da riportare, non
--   una conseguenza da dedurre.
--
-- Rieseguibile. Prerequisiti: 000244 applicata.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────────
-- A. La squadra che e' la stessa unita' scritta due volte
-- ───────────────────────────────────────────────────────────────────────────────
DELETE FROM sys.sys_teams t
 USING sys.sys_organization_units o, sys.sys_tenancies te
 WHERE te.tenant_id = t.team_tenant_id
   AND te.tenant_code = 'HEURESYS'
   AND o.organization_unit_code = t.team_code
   AND o.organization_unit_is_active
   AND o.organization_unit_manager_user_id IS NOT DISTINCT FROM t.team_lead_user_id;

-- ───────────────────────────────────────────────────────────────────────────────
-- B. L'unita' di tipo TEAM torna nell'asse a cui appartiene
-- ───────────────────────────────────────────────────────────────────────────────
UPDATE sys.sys_organization_units
   SET organization_unit_type = 'OFFICE',
       updated_at = now()
 WHERE organization_unit_type = 'TEAM';

-- ───────────────────────────────────────────────────────────────────────────────
-- C. La guardia: `TEAM` non e' un tipo dell'albero delle unita'
-- ───────────────────────────────────────────────────────────────────────────────
ALTER TABLE sys.sys_organization_units
  DROP CONSTRAINT IF EXISTS sys_organization_units_organization_unit_type_check;
ALTER TABLE sys.sys_organization_units
  ADD CONSTRAINT sys_organization_units_organization_unit_type_check
  CHECK (organization_unit_type IN (
    'HEADQUARTERS','GENERAL_MANAGEMENT','DIVISION','DEPARTMENT',
    'AREA','BRANCH','OFFICE','PLANT','WAREHOUSE'
  ));

-- ═══════════════════════════════════════════════════════════════════════════════
-- AUTO-VERIFICHE — principi, non conteggi congelati.
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  n_team_units  int;
  n_collisioni  int;
  n_universo    int;
  n_rtl_residue int;
BEGIN
  -- 1. Nessuna unita' organizzativa di tipo TEAM, attiva o no.
  SELECT count(*) INTO n_team_units
    FROM sys.sys_organization_units WHERE organization_unit_type = 'TEAM';
  IF n_team_units <> 0 THEN
    RAISE EXCEPTION 'Restano % unita di tipo TEAM', n_team_units;
  END IF;

  -- 2. Sul tenant HEURESYS nessuna squadra condivide il codice con un'unita'
  --    attiva. Misurato su un universo che DEVE essere non vuoto: se il tenant
  --    non avesse piu' alcuna squadra ne' unita', lo zero non direbbe nulla.
  SELECT count(*) INTO n_universo
    FROM sys.sys_organization_units o
    JOIN sys.sys_tenancies te ON te.tenant_id = o.organization_unit_tenant_id
   WHERE te.tenant_code = 'HEURESYS' AND o.organization_unit_is_active;
  IF n_universo = 0 THEN
    RAISE EXCEPTION 'Il tenant HEURESYS non ha unita attive: la verifica misurerebbe sul vuoto';
  END IF;

  SELECT count(*) INTO n_collisioni
    FROM sys.sys_teams t
    JOIN sys.sys_tenancies te ON te.tenant_id = t.team_tenant_id
    JOIN sys.sys_organization_units o
      ON o.organization_unit_code = t.team_code AND o.organization_unit_is_active
   WHERE te.tenant_code = 'HEURESYS';
  IF n_collisioni <> 0 THEN
    RAISE EXCEPTION 'HEURESYS: % squadre condividono ancora il codice con un unita', n_collisioni;
  END IF;

  -- 3. Il reperto fuori perimetro, DICHIARATO e non nascosto: la migrazione non
  --    lo corregge, ma lo stampa a ogni esecuzione perche' non si dimentichi.
  SELECT count(*) INTO n_rtl_residue
    FROM sys.sys_teams t
    JOIN sys.sys_organization_units o
      ON o.organization_unit_code = t.team_code AND o.organization_unit_is_active
    JOIN sys.sys_tenancies te ON te.tenant_id = t.team_tenant_id
   WHERE te.tenant_code <> 'HEURESYS';

  RAISE NOTICE 'OK — 0 unita di tipo TEAM; HEURESYS senza collisioni fra assi su universo %. FUORI PERIMETRO, NON CORRETTO: % squadre di altri tenant condividono ancora il codice con un unita attiva (registro #122).',
               n_universo, n_rtl_residue;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK — dallo snapshot pre-migrazione: la riga di `sys_teams` cancellata e
-- il tipo precedente dell'unita' non sono conservati altrove.
-- ═══════════════════════════════════════════════════════════════════════════════
