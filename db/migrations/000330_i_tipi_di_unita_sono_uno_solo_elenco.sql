-- ============================================================================
-- 000330 — I tipi di unita' organizzativa sono UN elenco, non due.  (#132 F3)
--
-- COME E' EMERSO, ed e' il terzo difetto che si vede solo COSTRUENDO davvero (dopo i due
-- della `000328`): un modello di prova con una squadra — tipo `TEAM` — non era costruibile.
-- Il tipo di un'unita' e' dichiarato in DUE posti che devono dire la stessa cosa:
--
--   · il CATALOGO `sys.sys_organization_unit_types`, a cui punta la FK
--     `organization_unit_type_id`, e che contiene **dieci** tipi;
--   · la colonna denormalizzata `organization_unit_type`, protetta da un `CHECK` che ne
--     ammetteva **nove**: mancava `TEAM`.
--
-- Quindi un'unita' di tipo `TEAM` poteva essere REFERENZIATA (la riga del catalogo esiste,
-- la FK si aggancia) ma non SCRITTA (il `CHECK` la respinge). Un tipo che esiste per meta'.
--
-- LA MISURA CHE LO DIMOSTRA, e che ha portato alla seconda correzione: esisteva gia' **una
-- riga incoerente** in produzione — `HS-PROD`, «Divisione Product & Development», con la
-- colonna testuale a `DIVISION` e la FK che puntava a `TEAM`. Il nome dice quale delle due
-- ha ragione: e' una divisione. La FK e' l'errore, ed e' passata inosservata proprio perche'
-- nessuno confrontava le due dichiarazioni fra loro.
--
-- PERCHE' SI ALLARGA IL `CHECK` E NON SI RESTRINGE IL CATALOGO. `TEAM` e' un tipo di unita'
-- legittimo e serve: un modello che descrive un'azienda manifatturiera ha linee e squadre.
-- Togliere `TEAM` dal catalogo romperebbe la FK della riga esistente e toglierebbe un
-- concetto vero; aggiungerlo al `CHECK` rende scrivibile cio' che era gia' referenziabile.
--
-- LE QUATTRO COSE DI UNA SCRITTURA DI MASSA (metodo di bonifica, S1049):
--   (a) la MISURA prima: 1 riga incoerente, misurata il 2026-08-19 e ri-misurata qui;
--   (b) la GUARDIA ri-verificata adesso, non ereditata: se le righe incoerenti fossero piu'
--       di quella nota, ci si ferma invece di correggerle alla cieca;
--   (c) la POST-CONDIZIONE protegge cio' che NON doveva cambiare: il numero di unita' e la
--       colonna testuale di `HS-PROD`, che era gia' giusta;
--   (d) il ROLLBACK e' dichiarato qui e non ha bisogno di un giornale: la correzione tocca
--       UNA riga e UNA colonna, e il valore di partenza e' scritto in questo commento —
--       `UPDATE ... SET organization_unit_type_id = (SELECT ... WHERE code='TEAM')
--        WHERE organization_unit_code = 'HS-PROD'`.
--
-- IDEMPOTENTE. Ristretto per codice, mai un carattere jolly.
-- ============================================================================
BEGIN;

-- ── ① la guardia: quante righe si contraddicono, DAVVERO, adesso ──────────────
DO $$
DECLARE n int; v_elenco text;
BEGIN
  SELECT count(*), string_agg(u.organization_unit_code, ', ')
    INTO n, v_elenco
    FROM sys.sys_organization_units u
    JOIN sys.sys_organization_unit_types t ON t.organization_unit_type_id = u.organization_unit_type_id
   WHERE t.organization_unit_type_code IS DISTINCT FROM u.organization_unit_type;

  RAISE NOTICE '000330: unita'' in cui il tipo scritto e quello referenziato non coincidono: % (%)',
    n, coalesce(v_elenco, 'nessuna');

  -- Una sola riga e' il caso noto e trattato qui. Se ce ne fossero altre, ognuna avrebbe la
  -- sua storia e andrebbe guardata: correggerle in blocco vorrebbe dire decidere per tutte
  -- sulla base di una che si e' letta.
  IF n > 1 THEN
    RAISE EXCEPTION '000330: attesa al massimo 1 unita'' incoerente (HS-PROD), trovate %: %. Vanno guardate una per una.', n, v_elenco;
  END IF;
  IF n = 1 AND v_elenco IS DISTINCT FROM 'HS-PROD' THEN
    RAISE EXCEPTION '000330: l''unica unita'' incoerente non e'' quella attesa: e'' %. Non si corregge alla cieca.', v_elenco;
  END IF;
END $$;

-- ── ② il vocabolario scrivibile diventa quello del catalogo ───────────────────
ALTER TABLE sys.sys_organization_units
  DROP CONSTRAINT IF EXISTS sys_organization_units_organization_unit_type_check;
ALTER TABLE sys.sys_organization_units
  ADD CONSTRAINT sys_organization_units_organization_unit_type_check
  CHECK (organization_unit_type IS NULL
         OR organization_unit_type IN ('HEADQUARTERS','GENERAL_MANAGEMENT','DIVISION','DEPARTMENT',
                                       'AREA','BRANCH','OFFICE','PLANT','WAREHOUSE','TEAM'));

-- ── ③ la riga che si contraddiceva ────────────────────────────────────────────
-- Il nome dice quale delle due dichiarazioni ha ragione: «Divisione Product & Development».
-- Si corregge la FK, non il testo.
UPDATE sys.sys_organization_units
   SET organization_unit_type_id = (SELECT organization_unit_type_id
                                      FROM sys.sys_organization_unit_types
                                     WHERE organization_unit_type_code = 'DIVISION')
 WHERE organization_unit_code = 'HS-PROD'
   AND organization_unit_type = 'DIVISION'
   AND organization_unit_type_id = (SELECT organization_unit_type_id
                                      FROM sys.sys_organization_unit_types
                                     WHERE organization_unit_type_code = 'TEAM');

-- ── ④ le post-condizioni ──────────────────────────────────────────────────────
DO $$
DECLARE n int; mancanti text; d_check text;
BEGIN
  -- 1. IL CONFRONTO FRA LE DUE FONTI, e non un elenco ricopiato: ogni codice del catalogo
  --    dev'essere ammesso dal `CHECK`. Scritta cosi', il giorno in cui qualcuno aggiunge un
  --    tipo al catalogo questa post-condizione diventa rossa e chiede di allargare anche il
  --    vincolo — mentre un elenco copiato a mano resterebbe verde mentendo. E' la stessa
  --    forma usata dalla `000328`, e per la stessa ragione.
  SELECT pg_get_constraintdef(oid) INTO d_check FROM pg_constraint
   WHERE conname = 'sys_organization_units_organization_unit_type_check';
  IF d_check IS NULL THEN
    RAISE EXCEPTION '000330: il vincolo sul tipo di unita'' non esiste piu''';
  END IF;
  SELECT string_agg(t.organization_unit_type_code, ', ') INTO mancanti
    FROM sys.sys_organization_unit_types t
   WHERE d_check NOT LIKE '%''' || t.organization_unit_type_code || '''%';
  IF mancanti IS NOT NULL THEN
    RAISE EXCEPTION '000330: il catalogo contiene tipi che la colonna non ammette: %. Vincolo: %', mancanti, d_check;
  END IF;

  -- 2. Nessuna unita' si contraddice piu'.
  SELECT count(*) INTO n
    FROM sys.sys_organization_units u
    JOIN sys.sys_organization_unit_types t ON t.organization_unit_type_id = u.organization_unit_type_id
   WHERE t.organization_unit_type_code IS DISTINCT FROM u.organization_unit_type;
  IF n <> 0 THEN
    RAISE EXCEPTION '000330: restano % unita'' in cui il tipo scritto e quello referenziato non coincidono', n;
  END IF;

  -- 3. CIO' CHE NON DOVEVA CAMBIARE: `HS-PROD` esiste ancora, si chiama ancora cosi', e la
  --    sua colonna testuale — che era gia' giusta — non e' stata toccata. Senza questa
  --    verifica, un `UPDATE` scritto al contrario (testo invece di FK) passerebbe inosservato
  --    e la divisione diventerebbe una squadra.
  SELECT count(*) INTO n FROM sys.sys_organization_units
   WHERE organization_unit_code = 'HS-PROD' AND organization_unit_type = 'DIVISION';
  IF n <> 1 THEN
    RAISE EXCEPTION '000330: HS-PROD non e'' piu'' una DIVISION (trovate % righe)', n;
  END IF;

  RAISE NOTICE '000330 ok — i tipi scrivibili coincidono col catalogo, nessuna unita'' si contraddice';
END $$;

COMMIT;
