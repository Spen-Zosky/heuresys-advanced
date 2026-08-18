-- ═══════════════════════════════════════════════════════════════════════════════
-- 000324_codice_competenza_unico_per_azienda.sql
--
-- IL SIGILLO ERA GLOBALE MENTRE IL MODELLO E' PER AZIENDA (#198 T9)
--
-- Il difetto, trovato costruendo davvero il 2026-08-18
--   Il motore del Tenant Builder ha costruito la sua prima azienda sul gemello: 184
--   righe, registro dell'origine coincidente. Poi ne ha costruita una SECONDA, dallo
--   stesso archetipo, e si e' rotto:
--
--       APPLY_EFFECT_FAILED: Cannot read properties of undefined (reading 'skill_id')
--
--   La causa non e' nel motore. `sys.sys_skills` porta DUE indici unici che affermano
--   cose diverse sullo stesso campo:
--
--       sys_skills_code_uq         UNIQUE (skill_code)                        ← globale
--       sys_skills_tenant_code_uq  UNIQUE (COALESCE(tenant, zero), skill_code) ← per azienda
--
--   Il primo dice «questo codice esiste una volta sola nel mondo», il secondo «una volta
--   sola dentro un'azienda». Con entrambi in piedi vince il piu' stretto, e due aziende
--   non possono avere la stessa competenza: la seconda costruzione va in conflitto,
--   `ON CONFLICT DO NOTHING` non restituisce righe, e il ripiego cerca la competenza
--   nel PROPRIO tenant — dove non c'e', perche' la riga vive in quello dell'altra azienda.
--
--   Il motore era monouso, e non lo sapeva nessuno: nessun test costruisce due volte.
--
-- Perche' cade quello globale e non l'altro
--   Il vincolo globale nasce dalla `000239`, che aveva deduplicato due codici in doppia
--   copia e poi «sigillato». Il sigillo serviva a impedire che i duplicati tornassero —
--   e quel lavoro lo fa gia' `sys_skills_tenant_code_uq`, che e' piu' stretto dentro
--   un'azienda e, grazie al `COALESCE` sul tenant nullo, copre anche il catalogo comune.
--   L'unico caso che il globale vieta e il per-azienda no e' **lo stesso codice in due
--   aziende diverse**: cioe' esattamente il caso legittimo che P3 richiede, e che il
--   modello multi-tenant (I5) ha sempre previsto.
--
--   Quindi non si sta allentando un controllo: si sta togliendo quello che dice la cosa
--   sbagliata, lasciando in piedi quello che dice la cosa giusta.
--
-- ADR-0035 — ritirare non e' cancellare
--   La catena si ri-applica per intero a ogni deploy: un DROP qui verrebbe disfatto dal
--   `IF NOT EXISTS … ADD CONSTRAINT` della `000239` al giro dopo. Per questo la `000239`
--   e' stata EMENDATA nello stesso commit — il suo blocco di sigillo non ricrea piu' il
--   vincolo globale e dice perche'. Questa migrazione rimuove l'esemplare esistente.
--
-- Prova che deve poter fallire
--   La post-condizione qui sotto pretende DUE cose insieme: che il globale non ci sia
--   piu', e che il per-azienda ci sia ancora. Se qualcuno cancellasse il secondo credendo
--   di semplificare, questa migrazione diventerebbe rossa — un tavolo senza nessun sigillo
--   sui codici e' peggio del difetto che stiamo togliendo.
-- ═══════════════════════════════════════════════════════════════════════════════
BEGIN;

-- Il ritiro. `IF EXISTS` perche' la catena e' idempotente e su un database fresco la
-- `000239` emendata non lo crea piu': qui non c'e' niente da togliere, ed e' giusto cosi'.
ALTER TABLE sys.sys_skills DROP CONSTRAINT IF EXISTS sys_skills_code_uq;

DO $post$
DECLARE
  globale  int;
  perazienda int;
  duplicati int;
BEGIN
  SELECT count(*) INTO globale
    FROM pg_constraint WHERE conname = 'sys_skills_code_uq';
  IF globale <> 0 THEN
    RAISE EXCEPTION 'post-condizione: il vincolo globale sys_skills_code_uq esiste ancora';
  END IF;

  -- Il sigillo che RESTA. Senza di lui il ritiro lascerebbe il campo scoperto.
  SELECT count(*) INTO perazienda
    FROM pg_indexes
   WHERE schemaname = 'sys' AND indexname = 'sys_skills_tenant_code_uq';
  IF perazienda <> 1 THEN
    RAISE EXCEPTION 'post-condizione: manca sys_skills_tenant_code_uq — il codice resterebbe senza sigillo';
  END IF;

  -- E che quel sigillo stia davvero reggendo ADESSO, non solo che esista: un indice
  -- puo' esistere ed essere invalido. Se dentro un'azienda ci fossero codici doppi,
  -- toglierne uno globale sarebbe la mossa sbagliata al momento sbagliato.
  SELECT count(*) INTO duplicati FROM (
    SELECT 1 FROM sys.sys_skills
     GROUP BY COALESCE(skill_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), skill_code
    HAVING count(*) > 1
  ) d;
  IF duplicati <> 0 THEN
    RAISE EXCEPTION 'post-condizione: % codici duplicati dentro la stessa azienda', duplicati;
  END IF;
END;
$post$;

COMMIT;
