-- ═══════════════════════════════════════════════════════════════════════════════
-- 000269_rtl_teams_get_their_own_names.sql
--
-- LE SQUADRE DI RTL SMETTONO DI CHIAMARSI COME LE UNITA'.
--
-- Registro #122, seconda parte. **Decisione di Enzo del 2026-08-04**, presa dopo
-- che la misura ha smentito la premessa della consegna: il difetto non riguardava
-- «2 unita' e 2 persone del tenant Heuresys» ma **24 squadre**, 1 su HEURESYS
-- (gia' risolta dalla 000265) e **23 su RTL_BANK**, di cui 15 condividevano con
-- l'unita' anche il nome.
--
-- Fra cancellare e rinominare, Enzo ha scelto **rinominare**: le 23 squadre
-- restano, con tutti i loro membri e le loro appartenenze, e prendono un codice e
-- un nome propri. E' la via che risolve l'ambiguita' senza che nessuno perda un
-- legame — quelle squadre portano l'asse funzionale di circa 150 persone, e
-- `DIV-CRED` da sola ne ha 33.
--
-- LA REGOLA DI RINOMINA E' DERIVATA, NON UN ELENCO SCRITTO A MANO:
--   codice → `TM-` piu' il codice originale privato del prefisso di tipo
--            (`DIV-CRED` → `TM-COMM`, `UFF-CRED-PMI` → `TM-CRED-PMI`)
--   nome   → «Squadra » piu' il nome originale privato del prefisso di tipo
--            («Divisione Commercial Banking» → «Squadra Commercial Banking»)
-- Cosi' la riga dice cosa E', e chi la legge non deve piu' indovinare su quale
-- asse si trova. Verificato prima di scrivere: le 23 rinomine non collidono fra
-- loro, ne' con una squadra esistente, ne' con un'unita' organizzativa.
--
-- COSA NON CAMBIA: `team_id`, la guida, i membri, le appartenenze. Nessuna FK si
-- muove, perche' si toccano solo due colonne descrittive.
--
-- Rieseguibile: la selezione prende solo le squadre che ANCORA collidono, quindi
-- al secondo giro non trova nulla da fare.
-- Prerequisiti: 000265 applicata.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

UPDATE sys.sys_teams t
   SET team_code = 'TM-' || regexp_replace(t.team_code, '^(DIV|DIR|FIL|UFF|AREA|HS)-', ''),
       team_name = 'Squadra ' || regexp_replace(t.team_name, '^(Divisione|Direzione|Filiale|Ufficio|Area) ', ''),
       updated_at = now()
  FROM sys.sys_organization_units o
 WHERE o.organization_unit_code = t.team_code
   AND o.organization_unit_is_active;

-- ═══════════════════════════════════════════════════════════════════════════════
-- AUTO-VERIFICHE — principi, non conteggi congelati.
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  n_collisioni  int;
  n_squadre     int;
  n_senza_membri int;
  n_membri      int;
BEGIN
  -- 1. Il criterio di chiusura di #122, su TUTTI i tenant: nessuna squadra
  --    condivide piu' il codice con un'unita' organizzativa attiva.
  SELECT count(*) INTO n_collisioni
    FROM sys.sys_teams t
    JOIN sys.sys_organization_units o
      ON o.organization_unit_code = t.team_code AND o.organization_unit_is_active;
  IF n_collisioni <> 0 THEN
    RAISE EXCEPTION '% squadre condividono ancora il codice con un unita attiva', n_collisioni;
  END IF;

  -- 2. ...ne' il nome.
  SELECT count(*) INTO n_collisioni
    FROM sys.sys_teams t
    JOIN sys.sys_organization_units o
      ON o.organization_unit_name = t.team_name AND o.organization_unit_is_active;
  IF n_collisioni <> 0 THEN
    RAISE EXCEPTION '% squadre condividono ancora il nome con un unita attiva', n_collisioni;
  END IF;

  -- 3. L'universo NON dev'essere vuoto: se le squadre fossero sparite, gli zeri
  --    qui sopra sarebbero veri e non direbbero niente. E' la differenza fra
  --    "rinominate" e "cancellate", che e' esattamente la decisione presa.
  SELECT count(*) INTO n_squadre FROM sys.sys_teams;
  IF n_squadre = 0 THEN
    RAISE EXCEPTION 'Nessuna squadra rimasta: la rinomina si e trasformata in una cancellazione';
  END IF;

  -- 4. Nessuno ha perso il proprio legame funzionale: le appartenenze sopravvivono
  --    alla rinomina, e almeno una squadra deve avere membri.
  SELECT count(*) INTO n_membri FROM sys.sys_team_members;
  IF n_membri = 0 THEN
    RAISE EXCEPTION 'Nessuna appartenenza rimasta: la rinomina ha portato via i membri';
  END IF;

  SELECT count(*) INTO n_senza_membri
    FROM sys.sys_teams t
   WHERE NOT EXISTS (SELECT 1 FROM sys.sys_team_members m WHERE m.team_member_team_id = t.team_id);

  RAISE NOTICE 'OK — 0 collisioni di codice e di nome fra i due assi; % squadre vive con % appartenenze (% squadre senza membri, invariato dalla rinomina).',
               n_squadre, n_membri, n_senza_membri;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK — dallo snapshot pre-migrazione: il codice e il nome precedenti non
-- sono conservati altrove. La rinomina e' derivabile ma non invertibile senza
-- ambiguita' (un `TM-CRED-PMI` non dice se veniva da `UFF-` o da `DIR-`).
-- ═══════════════════════════════════════════════════════════════════════════════
