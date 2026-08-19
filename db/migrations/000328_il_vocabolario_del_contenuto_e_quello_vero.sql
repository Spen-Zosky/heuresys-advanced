-- ============================================================================
-- 000328 — Il vocabolario del contenuto di un modello e' quello del prodotto.  (#132 F2)
--
-- COSA CORREGGE, e come e' emerso. La `000327` (F1) ha dato una casa al contenuto di un
-- modello, e su due colonne categoriche ha dichiarato nel commento: «Il vocabolario e'
-- quello che `sys_skills.skill_kind` usa gia': un modello che dichiarasse una specie che
-- il prodotto non conosce non sarebbe costruibile.» **L'intenzione era giusta e il
-- contenuto no** — misurato scrivendo `BlueprintBuildSource` (F2), cioe' il primo codice
-- che prova davvero a COSTRUIRE da quelle tabelle:
--
--   · `sys_blueprint_content_skills.blueprint_content_skill_kind` ammetteva
--     `SKILL, KNOWLEDGE, COMPETENCE, LANGUAGE, CERTIFICATION`.
--     `sys_skills.skill_kind` ammette invece
--     `SKILL, KNOWLEDGE, COMPETENCE, BEHAVIOR, OTHER`.
--     Quindi `LANGUAGE` e `CERTIFICATION` passavano il cancello del contenuto e **non
--     erano costruibili**; `BEHAVIOR` e `OTHER`, che il prodotto conosce, erano vietati
--     al modello.
--
--   · `sys_blueprint_content_kpis.blueprint_content_kpi_direction` ammetteva
--     `HIGHER_IS_BETTER, LOWER_IS_BETTER, TARGET_IS_BEST`.
--     `sys_kpi_definitions.kpi_definition_polarity` ammette
--     `HIGHER_IS_BETTER, LOWER_IS_BETTER, TARGET_RANGE`.
--     `TARGET_IS_BEST` non esiste da nessuna altra parte nel prodotto.
--
-- PERCHE' E' UN DIFETTO SERIO E NON UNA SVISTA DI VOCABOLARIO. Un modello che dichiara
-- `LANGUAGE` viene accettato dal database, sopravvive alla firma, e fallisce **al momento
-- della costruzione** — cioe' l'unico momento in cui il difetto costa qualcosa e in cui
-- attribuirlo e' difficile. E' la stessa forma del difetto T9a di `#198` (competenze senza
-- categoria: la costruzione riusciva e si rompeva il deploy successivo).
--
-- DUE FILE, NON UNO — ADR-0035. La catena si ri-applica per intero a ogni deploy, ma
-- `CREATE TABLE IF NOT EXISTS` non ricrea una tabella che c'e' gia': emendare la sola
-- `000327` correggerebbe i database nuovi e lascerebbe intatto quello di produzione.
-- Quindi la `000327` **e' stata emendata** (perche' un database creato da zero nasca
-- giusto) e questa migrazione corregge **l'esemplare esistente**. Le due strade devono
-- arrivare allo stesso posto, e la post-condizione qui sotto lo verifica leggendo il
-- vincolo dal catalogo di sistema invece di fidarsi dell'ordine in cui sono state
-- applicate.
--
-- NON SI PERDE NIENTE: le cinque tabelle di contenuto sono vuote (misurato 2026-08-19,
-- 0 righe in tutte e cinque), quindi non esiste una riga che il vocabolario nuovo
-- respingerebbe. La guardia qui sotto lo **ri-verifica al momento dell'esecuzione**
-- invece di ereditare la misura: se domani questa migrazione girasse su un database con
-- contenuto fuori vocabolario, si ferma invece di far fallire l'`ALTER`.
--
-- IDEMPOTENTE. `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT`, entrambi guardati.
-- PER TORNARE INDIETRO: rimettere i due CHECK come li scriveva la `000327` prima
-- dell'emendamento — ma sarebbe rimettere il difetto, non annullare un danno.
-- ============================================================================
BEGIN;

-- ── ① la guardia, ri-verificata ADESSO e non ereditata ────────────────────────
-- Non basta che le tabelle siano vuote oggi: questa migrazione gira anche fra sei mesi,
-- sul clone di CI, sulla VM e su un database ricreato da zero. Se una riga fuori
-- vocabolario esistesse, l'`ALTER` fallirebbe con un errore di Postgres che non dice
-- quale riga: meglio fermarsi qui, dicendo cosa e dove.
DO $$
DECLARE v_fuori text;
BEGIN
  SELECT string_agg(DISTINCT blueprint_content_skill_kind, ', ') INTO v_fuori
    FROM sys.sys_blueprint_content_skills
   WHERE blueprint_content_skill_kind NOT IN ('SKILL','KNOWLEDGE','COMPETENCE','BEHAVIOR','OTHER');
  IF v_fuori IS NOT NULL THEN
    RAISE EXCEPTION '000328: esistono competenze di modello con specie fuori dal vocabolario del prodotto (%). Vanno ricondotte prima: il vocabolario vero e'' quello di sys_skills.skill_kind', v_fuori;
  END IF;

  SELECT string_agg(DISTINCT blueprint_content_kpi_direction, ', ') INTO v_fuori
    FROM sys.sys_blueprint_content_kpis
   WHERE blueprint_content_kpi_direction NOT IN ('HIGHER_IS_BETTER','LOWER_IS_BETTER','TARGET_RANGE');
  IF v_fuori IS NOT NULL THEN
    RAISE EXCEPTION '000328: esistono indicatori di modello con verso fuori dal vocabolario del prodotto (%). Il verso vero e'' quello di sys_kpi_definitions.kpi_definition_polarity', v_fuori;
  END IF;
END $$;

-- ── ② la specie di una competenza di modello ──────────────────────────────────
ALTER TABLE sys.sys_blueprint_content_skills
  DROP CONSTRAINT IF EXISTS sys_blueprint_content_skills_specie_ck;
ALTER TABLE sys.sys_blueprint_content_skills
  ADD CONSTRAINT sys_blueprint_content_skills_specie_ck
  CHECK (blueprint_content_skill_kind IN ('SKILL','KNOWLEDGE','COMPETENCE','BEHAVIOR','OTHER'));

-- ── ③ il verso di un indicatore di modello ────────────────────────────────────
ALTER TABLE sys.sys_blueprint_content_kpis
  DROP CONSTRAINT IF EXISTS sys_blueprint_content_kpis_verso_ck;
ALTER TABLE sys.sys_blueprint_content_kpis
  ADD CONSTRAINT sys_blueprint_content_kpis_verso_ck
  CHECK (blueprint_content_kpi_direction IN ('HIGHER_IS_BETTER','LOWER_IS_BETTER','TARGET_RANGE'));

-- ── ④ le post-condizioni ──────────────────────────────────────────────────────
DO $$
DECLARE d_modello text; d_prodotto text;
BEGIN
  -- 1. IL CONFRONTO CHE CONTA, e non e' «il CHECK contiene le parole giuste»: e' «il
  --    vocabolario del modello COINCIDE con quello del prodotto». Scritto cosi', il giorno
  --    in cui qualcuno aggiunge una specie a `sys_skills` questa post-condizione diventa
  --    rossa e chiede di aggiornare anche il modello — mentre un elenco copiato a mano
  --    resterebbe verde mentendo. E' la differenza fra verificare una copia e verificare
  --    una corrispondenza.
  SELECT pg_get_constraintdef(oid) INTO d_modello FROM pg_constraint
   WHERE conname = 'sys_blueprint_content_skills_specie_ck';
  SELECT pg_get_constraintdef(oid) INTO d_prodotto FROM pg_constraint
   WHERE conname = 'sys_skills_skill_kind_check';
  IF d_modello IS NULL OR d_prodotto IS NULL THEN
    RAISE EXCEPTION '000328: manca uno dei due vincoli sulla specie di competenza (modello=%, prodotto=%)',
      coalesce(d_modello,'ASSENTE'), coalesce(d_prodotto,'ASSENTE');
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(ARRAY['SKILL','KNOWLEDGE','COMPETENCE','BEHAVIOR','OTHER']) AS s(v)
     WHERE d_modello NOT LIKE '%'''||s.v||'''%' OR d_prodotto NOT LIKE '%'''||s.v||'''%')
  THEN
    RAISE EXCEPTION '000328: la specie ammessa dal modello non coincide con quella del prodotto. modello=% · prodotto=%', d_modello, d_prodotto;
  END IF;
  IF d_modello LIKE '%LANGUAGE%' OR d_modello LIKE '%CERTIFICATION%' THEN
    RAISE EXCEPTION '000328: il modello ammette ancora specie che il prodotto non conosce: %', d_modello;
  END IF;

  -- 2. Lo stesso per il verso di un indicatore.
  SELECT pg_get_constraintdef(oid) INTO d_modello FROM pg_constraint
   WHERE conname = 'sys_blueprint_content_kpis_verso_ck';
  SELECT pg_get_constraintdef(oid) INTO d_prodotto FROM pg_constraint
   WHERE conname = 'sys_kpi_definitions_polarity_check';
  IF d_modello IS NULL OR d_prodotto IS NULL THEN
    RAISE EXCEPTION '000328: manca uno dei due vincoli sul verso di un indicatore (modello=%, prodotto=%)',
      coalesce(d_modello,'ASSENTE'), coalesce(d_prodotto,'ASSENTE');
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(ARRAY['HIGHER_IS_BETTER','LOWER_IS_BETTER','TARGET_RANGE']) AS s(v)
     WHERE d_modello NOT LIKE '%'''||s.v||'''%' OR d_prodotto NOT LIKE '%'''||s.v||'''%')
  THEN
    RAISE EXCEPTION '000328: il verso ammesso dal modello non coincide con quello del prodotto. modello=% · prodotto=%', d_modello, d_prodotto;
  END IF;
  IF d_modello LIKE '%TARGET_IS_BEST%' THEN
    RAISE EXCEPTION '000328: il modello ammette ancora TARGET_IS_BEST, che nel prodotto non esiste: %', d_modello;
  END IF;

  -- 3. CIO' CHE NON DOVEVA CAMBIARE. Questa migrazione tocca due vincoli e nient'altro:
  --    le tabelle di contenuto restano quelle, e le altre conservano i vincoli che avevano.
  --    Senza questa verifica, un `DROP CONSTRAINT` scritto sulla tabella sbagliata
  --    passerebbe inosservato.
  --    ⚠ ERANO CINQUE, e si contavano col carattere jolly. Dal 2026-08-19 (#132 F5) i
  --    processi hanno una casa sola — quella vecchia, `sys_blueprint_process_registry` — e la
  --    quinta tabella e' ritirata dalla `000335`. Qui si elencano per NOME le quattro che
  --    restano: un `LIKE` conterebbe anche la quinta finche' la `000335` non ha girato, e
  --    questo controllo fallirebbe per l'ORDINE invece che per un difetto.
  IF (SELECT count(*) FROM information_schema.tables
       WHERE table_schema = 'sys'
         AND table_name IN ('sys_blueprint_content_units', 'sys_blueprint_content_positions',
                            'sys_blueprint_content_skills', 'sys_blueprint_content_kpis')) <> 4 THEN
    RAISE EXCEPTION '000328: le tabelle di contenuto non sono piu'' quattro';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_blueprint_content_positions_criticita_ck')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_blueprint_content_units_non_se_stessa_ck') THEN
    RAISE EXCEPTION '000328: un vincolo che non doveva essere toccato e'' sparito';
  END IF;
  IF (SELECT count(*) FROM pg_constraint WHERE contype = 'u'
       AND conname IN ('sys_blueprint_content_units_uq', 'sys_blueprint_content_positions_uq',
                       'sys_blueprint_content_skills_uq', 'sys_blueprint_content_kpis_uq')) <> 4 THEN
    RAISE EXCEPTION '000328: le quattro chiavi naturali (versione, codice) non sono piu'' quattro';
  END IF;

  RAISE NOTICE '000328 ok — il vocabolario del contenuto coincide con quello del prodotto (specie di competenza, verso di indicatore)';
END $$;

COMMIT;
