-- ═══════════════════════════════════════════════════════════════════════════════
-- 000268_heuresys_gets_a_real_team.sql
--
-- HEURESYS TORNA AD AVERE UNA SQUADRA, MA UNA VERA.
--
-- Seguito della 000265 (#122), e la ragione e' una misura, non un ripensamento.
--
-- La 000265 ha rimosso `HS-MGMT` da `sys_teams` perche' era l'unita' organizzativa
-- scritta due volte: stesso codice, stessa persona alla guida, un solo membro —
-- e due righe identiche sui due assi ANNULLANO l'ortogonalita' che ADR-0027
-- richiede, invece di esprimerla.
--
-- Effetto misurato subito dopo: il tenant HEURESYS e' rimasto con **zero**
-- squadre, e due test hanno perso il proprio riferimento —
--   «PLATFORM_ADMIN sees teams cross-tenant»  -> 25 contro 25, nessuna differenza
--   «tenant isolation: TENANT_ADMIN gets 404» -> nessuna squadra di un altro tenant
-- Non e' un test da aggiustare: e' una capacita' del dato che se n'e' andata.
-- Senza una squadra su un secondo tenant, l'isolamento fra tenant sull'asse
-- funzionale non e' piu' dimostrabile.
--
-- La consegna prevedeva esattamente questa via d'uscita: «oppure, se si vuole
-- tenere una squadra reale, darle un codice, un nome e dei membri DIVERSI
-- dall'unita'». E' quello che si fa qui.
--
-- PERCHE' QUESTA SQUADRA E NON UN'ALTRA. Una squadra che ricalca un'unita' non
-- misura nulla; una che ATTRAVERSA le unita' e' precisamente cio' per cui l'asse
-- funzionale esiste. `HS-DELIVERY` prende una persona da `HS-PROD` e una da
-- `HS-MGMT`, quindi il perimetro funzionale di chi la guida NON coincide col suo
-- perimetro organizzativo — che e' la proprieta' che #122 voleva ripristinare.
-- Un team di ingaggio che attraversa le funzioni e' coerente con l'industria
-- dichiarata del tenant (`MGMT_CONSULTING`, invariante **I21**).
--
-- Le persone si risolvono PER EMAIL, mai per identificativo.
-- Rieseguibile. Prerequisiti: 000265 e 000267 applicate.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

INSERT INTO sys.sys_teams (team_tenant_id, team_code, team_name, team_lead_user_id)
SELECT te.tenant_id, 'HS-DELIVERY', 'Team Delivery Clienti', lead.user_id
  FROM sys.sys_tenancies te
  JOIN sys.sys_users lead ON lower(lead.user_email) = 'chiara.spenuso@heuresys.com'
 WHERE te.tenant_code = 'HEURESYS'
   AND NOT EXISTS (SELECT 1 FROM sys.sys_teams t
                    WHERE t.team_tenant_id = te.tenant_id AND t.team_code = 'HS-DELIVERY');

INSERT INTO sys.sys_team_members (team_member_team_id, team_member_user_id, team_member_role)
SELECT t.team_id, u.user_id, m.ruolo
  FROM sys.sys_teams t
  JOIN sys.sys_tenancies te ON te.tenant_id = t.team_tenant_id AND te.tenant_code = 'HEURESYS'
  CROSS JOIN (VALUES
     ('chiara.spenuso@heuresys.com', 'LEAD'),
     ('andrea.spenuso@heuresys.com', 'MEMBER')
  ) AS m(email, ruolo)
  JOIN sys.sys_users u ON lower(u.user_email) = m.email
 WHERE t.team_code = 'HS-DELIVERY'
   AND NOT EXISTS (SELECT 1 FROM sys.sys_team_members x
                    WHERE x.team_member_team_id = t.team_id AND x.team_member_user_id = u.user_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- AUTO-VERIFICHE — principi, non conteggi congelati.
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  n_squadre     int;
  n_collisioni  int;
  n_unita_dei_membri int;
BEGIN
  -- 1. HEURESYS ha almeno una squadra: senza, l'isolamento cross-tenant
  --    sull'asse funzionale torna indimostrabile.
  SELECT count(*) INTO n_squadre
    FROM sys.sys_teams t
    JOIN sys.sys_tenancies te ON te.tenant_id = t.team_tenant_id
   WHERE te.tenant_code = 'HEURESYS';
  IF n_squadre = 0 THEN
    RAISE EXCEPTION 'HEURESYS senza squadre: l isolamento fra tenant sull asse funzionale non e piu dimostrabile';
  END IF;

  -- 2. ...e nessuna di esse e' il doppione di un'unita' (il difetto di #122).
  SELECT count(*) INTO n_collisioni
    FROM sys.sys_teams t
    JOIN sys.sys_tenancies te ON te.tenant_id = t.team_tenant_id
    JOIN sys.sys_organization_units o
      ON o.organization_unit_code = t.team_code AND o.organization_unit_is_active
   WHERE te.tenant_code = 'HEURESYS';
  IF n_collisioni <> 0 THEN
    RAISE EXCEPTION 'HEURESYS: % squadre condividono ancora il codice con un unita', n_collisioni;
  END IF;

  -- 3. La squadra ATTRAVERSA le unita': i suoi membri vengono da piu' di una.
  --    Se venissero tutti dalla stessa, avremmo ricreato il doppione con un
  --    altro nome, e l'asse funzionale continuerebbe a non misurare nulla.
  SELECT count(DISTINCT p.position_organization_unit_id) INTO n_unita_dei_membri
    FROM sys.sys_teams t
    JOIN sys.sys_team_members m ON m.team_member_team_id = t.team_id
    JOIN sys.sys_user_position_assignments a
      ON a.user_position_assignment_user_id = m.team_member_user_id
     AND a.user_position_assignment_status = 'ACTIVE'
    JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
   WHERE t.team_code = 'HS-DELIVERY';
  IF n_unita_dei_membri < 2 THEN
    RAISE EXCEPTION 'HS-DELIVERY non attraversa le unita (% unita fra i membri): sarebbe il doppione di prima con un altro nome',
                    n_unita_dei_membri;
  END IF;

  RAISE NOTICE 'OK — HEURESYS ha % squadra/e, nessuna doppione di un unita, e HS-DELIVERY attraversa % unita.',
               n_squadre, n_unita_dei_membri;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK — DELETE FROM sys.sys_teams WHERE team_code = 'HS-DELIVERY'
-- (i membri seguono per CASCADE). Ma si rilegga il §effetto misurato qui sopra
-- prima di farlo: toglierla riapre il buco di copertura, non lo chiude.
-- ═══════════════════════════════════════════════════════════════════════════════
