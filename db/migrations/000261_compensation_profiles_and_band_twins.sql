-- ═══════════════════════════════════════════════════════════════════════════════
-- 000261_compensation_profiles_and_band_twins.sql
--
-- IL QUARTO CATALOGO, I GEMELLI DELLE FASCE, E UN DUPLICATO.
--
-- A. IL CATALOGO CHE MI ERA SFUGGITO
--   La 000260 ha ri-agganciato tre cataloghi di requisiti alle posizioni nuove:
--   competenze, formazione, KPI. Ce n'era un QUARTO nella stessa condizione e non
--   l'avevo guardato — `sys_position_compensation_profiles`: **144 profili su 172
--   sono rimasti su posizioni disattivate**, 28 su posizioni ricoperte.
--
--   Il sintomo era in bella vista e l'ho letto al rovescio: la verifica «retribuzione
--   fuori dalla fascia della posizione» risultava a ZERO, e sembrava una buona
--   notizia. Non lo era: il suo universo era sceso da 157 a 25, perche' quasi nessuna
--   posizione ricoperta aveva piu' un profilo con cui confrontarsi. E' esattamente la
--   cecita' che la 000260 aveva appena corretto altrove — con la differenza che qui
--   uno zero rassicurante la nascondeva meglio di un numero grosso.
--
--   Stessa mappa della 000260: la persona, non il titolo.
--
-- B. I GEMELLI `LEGACY_BAND::`
--   Delle 60 fasce retributive, **19 sono gemelli** con codice `LEGACY_BAND::…` —
--   residui dell'importazione, come i cinque percorsi formativi chiamati
--   `OLDDB::learning_paths::<uuid>` (chiusi stamattina) e le posizioni chiamate
--   `POS-00000381`. Fra questi, `EX-1` esiste in doppio con importi DIVERSI: 180.000
--   contro 160.000 del gemello. Un profilo di posizione poteva agganciare il gemello
--   sbagliato e nessuno se ne sarebbe accorto, perche' il codice si legge uguale.
--
--   Verificato prima di rimuoverli: `sys_position_compensation_profiles` e' l'UNICA
--   tabella con una chiave esterna verso le fasce, e **nessuno dei 19 gemelli e'
--   agganciato ad alcun profilo**. Si rimuovono senza toccare nulla di vivo.
--
-- C. IL DUPLICATO DI UN'ASSEGNAZIONE
--   `andrea.martino` ha due righe identiche di assegnazione a Compliance Officer,
--   stesso intervallo 2009-12-29 → 2025-02-27, entrambe chiuse. Non e' una storia di
--   carriera, e' un duplicato. Si tiene quella con identificativo DETERMINISTICO
--   (generato per v5 dal seme, quindi riproducibile) e si toglie l'altra: cosi' una
--   ri-esecuzione del seme non ne ricrea una seconda.
--
-- CIO' CHE NON FACCIO, E PERCHE'
--   L'item #102 elenca anche due CATALOGHI CHE TACCIONO — 8 posizioni apicali senza
--   alcun requisito formativo, 119 posizioni ricoperte su 161 senza alcun KPI — e
--   quattro OKR che nominano un reparto inesistente (`Digital Banking`, `Finance`,
--   `Sales`, `Supply Chain`). Non li tocco qui: riempire un catalogo muto significa
--   DECIDERE quale formazione ci si attende da un amministratore delegato e quali
--   indicatori misurano un capo filiale. E' contenuto di prodotto, non una
--   riparazione di dati, e va scritto sapendo cosa si sta affermando. Restano
--   dichiarati, con i numeri, invece di essere riempiti di ripiego.
--
-- Rieseguibile. Prerequisiti: 000260 applicata.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────────
-- A. I PROFILI RETRIBUTIVI SEGUONO LA PERSONA
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TEMP TABLE mappa_pos ON COMMIT DROP AS
SELECT DISTINCT ON (vecchia.pos_id)
       vecchia.pos_id AS pos_vecchia, nuova.position_id AS pos_nuova
  FROM (
    SELECT DISTINCT a.user_position_assignment_position_id AS pos_id,
           a.user_position_assignment_user_id AS persona
      FROM sys.sys_user_position_assignments a
      JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
     WHERE a.user_position_assignment_status = 'ENDED'
       AND a.user_position_assignment_notes LIKE '%ricostruzione organigramma%'
       AND NOT p.position_is_active
  ) vecchia
  JOIN sys.sys_user_position_assignments att
    ON att.user_position_assignment_user_id = vecchia.persona
   AND att.user_position_assignment_status = 'ACTIVE'
  JOIN sys.sys_positions nuova
    ON nuova.position_id = att.user_position_assignment_position_id AND nuova.position_is_active
 ORDER BY vecchia.pos_id, nuova.position_id;

UPDATE sys.sys_position_compensation_profiles pc
   SET position_id = m.pos_nuova, updated_at = now()
  FROM mappa_pos m
 WHERE pc.position_id = m.pos_vecchia
   AND NOT EXISTS (SELECT 1 FROM sys.sys_position_compensation_profiles x
                    WHERE x.position_id = m.pos_nuova);

-- ───────────────────────────────────────────────────────────────────────────────
-- B. VIA I GEMELLI DELLE FASCE — nessuno di essi e' agganciato a un profilo
-- ───────────────────────────────────────────────────────────────────────────────
DELETE FROM sys.sys_compensation_bands b
 WHERE b.compensation_band_code LIKE 'LEGACY_BAND::%'
   AND NOT EXISTS (SELECT 1 FROM sys.sys_position_compensation_profiles pc
                    WHERE pc.compensation_band_id = b.compensation_band_id);

-- ───────────────────────────────────────────────────────────────────────────────
-- C. VIA IL DUPLICATO — si tiene l'identificativo deterministico
-- ───────────────────────────────────────────────────────────────────────────────
DELETE FROM sys.sys_user_position_assignments a
 WHERE a.user_position_assignment_id IN (
   SELECT user_position_assignment_id FROM (
     SELECT user_position_assignment_id,
            row_number() OVER (
              PARTITION BY user_position_assignment_user_id, user_position_assignment_position_id,
                           user_position_assignment_start_date, user_position_assignment_end_date,
                           user_position_assignment_status
              -- l'uuid di versione 5 e' quello generato dal seme, quindi riproducibile:
              -- si tiene lui, cosi' una ri-esecuzione del seme non ricrea un gemello
              ORDER BY (substring(user_position_assignment_id::text, 15, 1) = '5') DESC,
                       user_position_assignment_id) AS n
       FROM sys.sys_user_position_assignments
      WHERE user_position_assignment_status = 'ENDED') q
   WHERE q.n > 1);

ANALYZE sys.sys_position_compensation_profiles;

-- ───────────────────────────────────────────────────────────────────────────────
-- D. AUTO-VERIFICA
-- ───────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  n_attivi int; n_tot int; n_gemelli int; n_dup int; n_ex1 int; n_attive_ass int;
BEGIN
  SELECT count(*) INTO n_tot FROM sys.sys_position_compensation_profiles;
  IF n_tot <> 172 THEN
    RAISE EXCEPTION 'Profili retributivi: attesi 172 invariati, trovati % — qui si sposta, non si crea', n_tot;
  END IF;

  SELECT count(*) INTO n_attivi FROM sys.sys_position_compensation_profiles pc
    JOIN sys.sys_positions p ON p.position_id = pc.position_id WHERE p.position_is_active;
  IF n_attivi < 120 THEN
    RAISE EXCEPTION 'Profili su posizioni ricoperte: % (erano 28, attesi >120)', n_attivi;
  END IF;

  SELECT count(*) INTO n_gemelli FROM sys.sys_compensation_bands WHERE compensation_band_code LIKE 'LEGACY_BAND::%';
  IF n_gemelli <> 0 THEN RAISE EXCEPTION 'Gemelli LEGACY_BAND rimasti: %', n_gemelli; END IF;

  -- e la fascia buona e' ancora li', con il suo importo: rimuovere il gemello non
  -- doveva portarsi via l'originale
  SELECT count(*) INTO n_ex1 FROM sys.sys_compensation_bands
   WHERE compensation_band_code = 'EX-1' AND compensation_band_min_eur = 180000;
  IF n_ex1 <> 1 THEN RAISE EXCEPTION 'La fascia EX-1 originale (180.000) non e piu univoca: % righe', n_ex1; END IF;

  SELECT count(*) INTO n_dup FROM (
    SELECT 1 FROM sys.sys_user_position_assignments
     GROUP BY user_position_assignment_user_id, user_position_assignment_position_id,
              user_position_assignment_start_date, user_position_assignment_end_date,
              user_position_assignment_status
    HAVING count(*) > 1) q;
  IF n_dup <> 0 THEN RAISE EXCEPTION 'Assegnazioni duplicate rimaste: %', n_dup; END IF;

  -- il filo di sempre: nessuna persona persa
  SELECT count(*) INTO n_attive_ass FROM sys.sys_user_position_assignments
   WHERE user_position_assignment_status = 'ACTIVE';
  IF n_attive_ass <> 161 THEN
    RAISE EXCEPTION 'Assegnazioni attive: attese 161, trovate %', n_attive_ass;
  END IF;

  RAISE NOTICE 'OK — % profili retributivi su posizioni ricoperte (erano 28), 0 gemelli LEGACY_BAND, 0 assegnazioni duplicate, 161 assegnazioni attive intatte.',
               n_attivi;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════════
--   Lo spostamento dei profili e la rimozione dei gemelli si annullano solo dallo
--   snapshot pre-migrazione. I 19 gemelli erano copie di fasce che restano in
--   tabella, quindi nessun importo e' andato perduto: cio' che sparisce e' il
--   doppione, non il dato.
