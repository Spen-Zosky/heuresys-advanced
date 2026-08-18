-- ═══════════════════════════════════════════════════════════════════════════════
-- 000325_stato_impossibile_bande_e_competenze.sql
--
-- LO STESSO STATO IMPOSSIBILE, DUE CURE OPPOSTE (#215)
--
-- Lo stato: `tenant_id IS NULL` **e** `is_global = false`. La lista filtra
-- `(is_global = true OR tenant_id = $1)`, quindi una riga cosi' non soddisfa nessuno
-- dei due rami: **nessun utente di nessuna azienda la vede**. La vede solo chi e'
-- di piattaforma, per cui il filtro non viene applicato.
--
-- `#213` ha chiuso il caso dei percorsi formativi rimuovendoli. Qui le righe sono 32 su
-- due tabelle, e **la misura uguale non fa la cura uguale**: applicare a queste il gesto
-- studiato per quelle avrebbe cancellato i contratti collettivi nazionali.
--
-- ── LE 29 BANDE: si RICLASSIFICANO ────────────────────────────────────────────────
--   Sono 7 CCNL (`CCNL Credito 2024`, `CCNL Metalmeccanico`, …) e 22 sigle sindacali
--   (CGIL, CISL, FABI, FILCAMS…), **tutte senza importi** (`min_eur` nullo su 29 su 29,
--   misurato). Non sono bande retributive: sono **classificazioni**, e `I21` le nomina
--   esplicitamente fra cio' che resta aperto a ogni industria («CCNL/union reference
--   bands»). Righe classificate male, non residui: la cura e' una UPDATE, e cancellarle
--   sarebbe l'errore. Coerente con S1042, dove il criterio «nomina un'entita' inesistente»
--   le respinse gia' come falsi positivi.
--
-- ── LE 3 COMPETENZE: si RIMUOVONO, e il piano diceva il contrario ─────────────────
--   Il piano di questa voce le dava per «competenze comportamentali trasversali» da
--   promuovere a catalogo comune. **La misura sul vivo lo ha smentito**: ognuna delle tre
--   ha un **gemello per nome dentro RTL Bank**, creato lo stesso giorno (2026-02-25), e
--   il gemello e' quello vivo:
--
--       nome                        orfana            gemello RTL_BANK
--       Collaborazione              0 usi              1 persona ·  2 requisiti
--       Orientamento ai risultati   0 usi             19 persone · 25 requisiti
--       Orientamento al cliente     0 usi             48 persone · 53 requisiti
--
--   Non sono competenze da promuovere: sono **copie morte** di righe vive, sopravvissute
--   alla deduplicazione della `000189` perche' quella raggruppava per `(tenant, nome)` e
--   queste hanno tenant diversi — NULL contro RTL. Promuoverle a globali avrebbe messo
--   nel catalogo comune un doppione di cio' che un'azienda gia' possiede.
--
--   ADR-0035 verificato, non assunto: l'unico file che le crea e'
--   `docs/archive/etl-brownfield-ritirato/…/wave1_skilgro.sql`, **archiviato e fuori
--   dalla catena** — nessun file di `db/**` le ricrea, quindi la rimozione non viene
--   disfatta al deploy successivo. Stesso accertamento di `#213`.
--
-- ── FUORI DA QUESTA MIGRAZIONE, e va nominato una volta ───────────────────────────
--   `sys_compensation_bands` ospita 29 righe che **non sono bande**: contratti e sigle
--   senza importi. Funziona, ma e' una tabella che porta due specie. Non si tocca qui:
--   e' una voce a se', non un residuo da bonificare di passaggio.
--
-- ── Le prove che devono poter fallire ─────────────────────────────────────────────
--   Le post-condizioni guardano **anche cio' che NON doveva cambiare**: le tre competenze
--   vive di RTL con i loro 68 usi complessivi, e il numero totale di bande. Una cura che
--   svuota la tabella passerebbe un controllo che guarda solo lo stato impossibile.
-- ═══════════════════════════════════════════════════════════════════════════════
BEGIN;

-- La fotografia del PRIMA, presa dentro la stessa transazione. Le post-condizioni che
-- proteggono cio' che non doveva cambiare si confrontano con QUESTA, mai con costanti:
-- un «68 usi» cablato sarebbe verde in locale e rosso sul database della CI, che non ha
-- i dati caricati dagli script — e quel rosso non direbbe niente sul difetto.
CREATE TEMP TABLE _prima ON COMMIT DROP AS
SELECT (SELECT count(*) FROM sys.sys_compensation_bands) AS bande,
       (SELECT count(*) FROM sys.sys_skills) AS competenze,
       (SELECT count(*) FROM sys.sys_user_skills u
          JOIN sys.sys_skills s ON s.skill_id = u.user_skill_skill_id
         WHERE lower(trim(s.skill_name)) IN
               ('collaborazione','orientamento ai risultati','orientamento al cliente')) AS usi_gemelli,
       (SELECT count(*) FROM sys.sys_skills
         WHERE skill_tenant_id IS NULL AND skill_is_global = false) AS skill_impossibili;

-- Il giornale, per poter tornare indietro (regola ④: rollback dichiarato).
CREATE TABLE IF NOT EXISTS staging.competenze_orfane_rimosse_undo (
  skill_id uuid PRIMARY KEY,
  skill_code varchar(255) NOT NULL,
  skill_name varchar(255) NOT NULL,
  skill_kind varchar(64),
  rimossa_il timestamptz NOT NULL DEFAULT now(),
  ragione text NOT NULL
);

INSERT INTO staging.competenze_orfane_rimosse_undo (skill_id, skill_code, skill_name, skill_kind, ragione)
SELECT s.skill_id, s.skill_code, s.skill_name, s.skill_kind,
       'copia morta senza titolare: il gemello per nome vive in RTL_BANK ed e'' quello usato (#215)'
  FROM sys.sys_skills s
 WHERE s.skill_code IN (
   'COMP::1a796315-7027-4e7b-b89d-5700e6758fec',
   'COMP::38a5c694-8e98-4bce-a1a0-b9c80a6405a9',
   'COMP::82b3fe75-a7ba-4c8c-aa00-31d9bc58235a')
ON CONFLICT (skill_id) DO NOTHING;

-- ── cura 1: le 29 classificazioni tornano visibili a ogni azienda ─────────────────
-- Elenco esplicito, mai un carattere jolly: e' la garanzia che non tocchi altro.
UPDATE sys.sys_compensation_bands
   SET compensation_band_is_global = true, updated_at = now()
 WHERE compensation_band_tenant_id IS NULL
   AND compensation_band_is_global = false
   AND compensation_band_code IN (
     'CCNL_ALIM_2024','CCNL_COMM_2024','CCNL_CRED_2024','CCNL_ENERGIA_2024',
     'CCNL_METMEC_2024','CCNL_TLC_2024','CCNL_TUR_2024',
     'CGIL','CISL','FABI','FAI_CISL','FILCAMS_CGIL','FILCTEM_CGIL','FIRST_CISL',
     'FISAC_CGIL','FISASCAT_CISL','FLAEI_CISL','FLAI_CGIL','SINFUB','UGL',
     'UGL_AGROALIM','UGL_CHIM_EN','UGL_CREDITO','UGL_TERZIARIO','UIL','UILA_UIL',
     'UILCA','UILTEC_UIL','UILTUCS_UIL');

-- ── cura 2: le 3 copie morte se ne vanno ──────────────────────────────────────────
-- La guardia e' nella WHERE e si ri-verifica ADESSO, non e' ereditata dalla misura:
-- una riga che nel frattempo avesse acquisito un uso NON viene toccata.
DELETE FROM sys.sys_skills s
 WHERE s.skill_code IN (
   'COMP::1a796315-7027-4e7b-b89d-5700e6758fec',
   'COMP::38a5c694-8e98-4bce-a1a0-b9c80a6405a9',
   'COMP::82b3fe75-a7ba-4c8c-aa00-31d9bc58235a')
   AND s.skill_tenant_id IS NULL
   AND s.skill_is_global = false
   AND NOT EXISTS (SELECT 1 FROM sys.sys_user_skills x WHERE x.user_skill_skill_id = s.skill_id)
   AND NOT EXISTS (SELECT 1 FROM sys.sys_position_skill_requirements x WHERE x.skill_id = s.skill_id)
   AND NOT EXISTS (SELECT 1 FROM sys.sys_user_skill_evidence x WHERE x.user_skill_evidence_skill_id = s.skill_id);

-- ── le traduzioni che restavano appese al nulla ───────────────────────────────────
-- Rimuovere una competenza lascia orfane le sue traduzioni, e la sentinella
-- `v_reference_translation_orphans` le conta: applicata la cura senza questo blocco, la
-- batteria di `db_health` è uscita ROSSA con 6 righe (3 competenze × 2 lingue). La `000239`
-- aveva già lo stesso blocco per la stessa ragione — non lo si è ricordato, lo si è visto.
-- L'insieme si legge DALLA VISTA e non è un elenco scritto a mano: resta corretto anche se
-- il numero cambia.
DELETE FROM sys.sys_reference_translations t
 WHERE t.reference_translation_id IN (
   SELECT o.reference_translation_id FROM sys.v_reference_translation_orphans o
    WHERE o.entity_table = 'sys_skills');

-- ── la sentinella che impedisce il ritorno ────────────────────────────────────────
-- Una vista `sys.v_*` viene raccolta da sé da `db_health.py`, che pretende zero righe:
-- se domani un import ricreasse lo stato impossibile su una di queste due tabelle, la
-- prova generale diventerebbe rossa senza che nessuno debba ricordarsi di guardare.
-- La gemella per i percorsi formativi è `sys.v_learning_paths_senza_titolare` (#213).
CREATE OR REPLACE VIEW sys.v_righe_senza_titolare_e_non_globali AS
SELECT 'sys_compensation_bands'::text AS tabella,
       compensation_band_id AS riga_id,
       compensation_band_code AS codice
  FROM sys.sys_compensation_bands
 WHERE compensation_band_tenant_id IS NULL AND compensation_band_is_global = false
UNION ALL
SELECT 'sys_skills', skill_id, skill_code
  FROM sys.sys_skills
 WHERE skill_tenant_id IS NULL AND skill_is_global = false;

COMMENT ON VIEW sys.v_righe_senza_titolare_e_non_globali IS
  'Sentinella #215: righe invisibili a ogni azienda — tenant_id NULL E is_global false. '
  'La lista filtra (is_global OR tenant = $1) e una riga così non soddisfa nessuno dei due '
  'rami. Deve valere sempre 0.';

DO $post$
DECLARE
  impossibili_bande int;
  impossibili_skill int;
  bande_totali      int;
  usi_rtl           int;
BEGIN
  -- cio' che DOVEVA cambiare
  SELECT count(*) INTO impossibili_bande FROM sys.sys_compensation_bands
   WHERE compensation_band_tenant_id IS NULL AND compensation_band_is_global = false;
  IF impossibili_bande <> 0 THEN
    RAISE EXCEPTION 'post-condizione: restano % bande nello stato impossibile', impossibili_bande;
  END IF;

  SELECT count(*) INTO impossibili_skill FROM sys.sys_skills
   WHERE skill_tenant_id IS NULL AND skill_is_global = false;
  IF impossibili_skill <> 0 THEN
    RAISE EXCEPTION 'post-condizione: restano % competenze nello stato impossibile', impossibili_skill;
  END IF;

  -- cio' che NON doveva cambiare, ed e' la meta' che protegge dal disastro.
  -- Il confronto e' col PRIMA misurato in questa transazione, non con un numero scritto qui.
  SELECT count(*) INTO bande_totali FROM sys.sys_compensation_bands;
  IF bande_totali <> (SELECT bande FROM _prima) THEN
    RAISE EXCEPTION 'post-condizione: le bande erano %, ora sono % — una riclassificazione non cancella',
                    (SELECT bande FROM _prima), bande_totali;
  END IF;

  SELECT count(*) INTO usi_rtl FROM sys.sys_user_skills u
    JOIN sys.sys_skills s ON s.skill_id = u.user_skill_skill_id
   WHERE lower(trim(s.skill_name)) IN
         ('collaborazione','orientamento ai risultati','orientamento al cliente');
  IF usi_rtl <> (SELECT usi_gemelli FROM _prima) THEN
    RAISE EXCEPTION 'post-condizione: i gemelli vivi portavano % usi, ora ne portano % — '
                    'la cura ha toccato la riga sbagliata',
                    (SELECT usi_gemelli FROM _prima), usi_rtl;
  END IF;

  -- E che siano sparite ESATTAMENTE le righe impossibili, non di piu': la differenza fra
  -- le competenze di prima e quelle di adesso deve valere quante ne erano nello stato
  -- impossibile. Su un database che non le ha (la CI), vale 0 = 0 e il controllo tace
  -- invece di mentire.
  IF (SELECT competenze FROM _prima) - (SELECT count(*) FROM sys.sys_skills)
     <> (SELECT skill_impossibili FROM _prima) THEN
    RAISE EXCEPTION 'post-condizione: sono sparite % competenze ma quelle impossibili erano %',
                    (SELECT competenze FROM _prima) - (SELECT count(*) FROM sys.sys_skills),
                    (SELECT skill_impossibili FROM _prima);
  END IF;
END;
$post$;

COMMIT;
