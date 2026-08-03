-- 000237_dedup_learning_codes_and_unique_seal.sql
--
-- Deduplicazione dei codici dei percorsi formativi e sigillo di unicita'
-- (register #91, blocco E — da applicare DOPO la bonifica 000235).
--
-- Perche' il sigillo viene dopo e non prima: prima della bonifica i codici
-- percorso duplicati erano 1.373, e il vincolo UNIQUE sarebbe semplicemente
-- fallito. Scomposti per origine: 1.284 venivano dalle chiavi-macchina OLDDB::,
-- 30 dai percorsi CRS di tenant inesistenti — entrambi rimossi dalla 000235 —
-- e 59 sono copie esatte rimaste, trattate qui.
--
-- I 59: stesso codice, stesso tenant, stesso nome. Una doppia importazione
-- dello stesso materiale. Misurato prima di scegliere come rimuoverli:
--   copia piu' vecchia   59 percorsi · 63 step · 199 assegnazioni a persone
--   copia piu' recente   59 percorsi · 61 step ·   0 assegnazioni
-- Tutte le assegnazioni reali stanno sulla copia piu' vecchia, quindi la
-- rimozione della piu' recente non tocca il lavoro di nessuno: non serve
-- ripuntare niente, e infatti qui non si ripunta niente. Se il rapporto fosse
-- stato l'inverso questa migrazione sarebbe stata scritta in modo diverso.
--
-- Il sigillo si applica a percorsi e moduli. NON a sys_skills, dove restano 2
-- codici duplicati (COMP::02c2f3c8… e COMP::7780f0ba…) su 14.041: quelle due
-- righe sono referenziate da 12 chiavi esterne in 11 tabelle, e il loro dedup
-- e' un lavoro a se' con altrettante collisioni potenziali da gestire. Applicare
-- il vincolo qui avrebbe fatto fallire la migrazione; ometterlo in silenzio
-- avrebbe fatto credere che il sigillo copra tutto. Resta scritto: e' aperto.
BEGIN;

-- Le copie da rimuovere: rn > 1 nell'ordine per data di creazione, a parita'
-- l'identificativo, cosi' la scelta e' deterministica e ripetibile.
CREATE TEMP TABLE _percorsi_scartati ON COMMIT DROP AS
SELECT learning_path_id
FROM (SELECT learning_path_id,
             row_number() OVER (PARTITION BY learning_path_code
                                ORDER BY created_at NULLS LAST, learning_path_id) AS rn
      FROM sys.sys_learning_paths) o
WHERE o.rn > 1;

-- Guardia: se una copia scartata avesse assegnazioni, la premessa della misura
-- non varrebbe piu' e cancellarla toglierebbe un corso a una persona reale.
DO $$
DECLARE v_assegnazioni bigint;
BEGIN
  SELECT count(*) INTO v_assegnazioni
    FROM sys.sys_user_learning_assignments a
    JOIN _percorsi_scartati s ON s.learning_path_id = a.user_learning_assignment_path_id;
  IF v_assegnazioni > 0 THEN
    RAISE EXCEPTION
      'Dedup interrotto: % assegnazioni di persone reali puntano alla copia da '
      'rimuovere. Vanno ripuntate alla copia tenuta prima di procedere.',
      v_assegnazioni;
  END IF;
END $$;

DELETE FROM sys.sys_learning_path_steps s
 USING _percorsi_scartati d
 WHERE s.learning_path_step_path_id = d.learning_path_id;

DELETE FROM sys.sys_learning_paths p
 USING _percorsi_scartati d
 WHERE p.learning_path_id = d.learning_path_id;

-- ------------------------------------------------------------- il sigillo
-- Da qui in avanti un import che ritenta di inserire lo stesso codice fallisce
-- subito, invece di lasciare due righe identiche che nessuno nota per mesi.
DO $seal$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_learning_paths_code_uq') THEN
    ALTER TABLE sys.sys_learning_paths
      ADD CONSTRAINT sys_learning_paths_code_uq UNIQUE (learning_path_code);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_learning_modules_code_uq') THEN
    ALTER TABLE sys.sys_learning_modules
      ADD CONSTRAINT sys_learning_modules_code_uq UNIQUE (learning_module_code);
  END IF;
END;
$seal$;

COMMIT;
