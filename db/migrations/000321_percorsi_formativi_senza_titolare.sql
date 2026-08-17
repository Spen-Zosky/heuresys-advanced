-- ═══════════════════════════════════════════════════════════════════════════════
-- 000321_percorsi_formativi_senza_titolare.sql
--
-- I PERCORSI FORMATIVI CHE NESSUNA AZIENDA VEDE — E CHE COSA SONO DAVVERO (#213)
--
-- Il difetto, misurato il 2026-08-17
--   `sys.sys_learning_paths` ha 72 righe: 52 di RTL Bank, 15 di Heuresys System e
--   **5 con `tenant_id IS NULL` E `is_global = false`**. Non e' una terza specie:
--   la lista filtra `(is_global = true OR tenant_id = $1)`, quindi una riga che non
--   soddisfa nessuno dei due rami **non la vede nessun utente di nessuna azienda**.
--   La vede solo chi e' platform, per cui il filtro non si applica. Misurato LIVE
--   con due attori in #210: platform legge 72, `federica.marchetti@rtl-bank.org`
--   legge 52.
--
-- La codifica «strana» — da dove viene, riga per riga
--   Il nome `OLDDB::learning_paths::<uuid>` e' la chiave con cui l'importazione del
--   2025-12-03 identifico' la riga nel database legacy, finita nel campo che l'utente
--   legge. Il file che le ha create e'
--   `docs/archive/etl-brownfield-ritirato/.../wave1_skilgro.sql`, ed e' **archiviato,
--   fuori dalla catena**: nessun file di `db/**` le ricrea (verificato con grep sui
--   codici in tutta la catena viva, e `extract-wave1-legacy.sh` non e' richiamato da
--   nessuno script, hook o workflow). Percio' ADR-0035 e' soddisfatto senza emendare
--   nulla: cancellare qui non oscilla al deploy successivo.
--
--   Nel seed quelle righe portavano il tenant legacy `d5855519…` («heuresys» del
--   vecchio prodotto) e `1d7bf448…` — che e' **SmartFood**: nello stesso file quel
--   tenant possiede `CRS-smartfood-*` (15), `CERT-smartfood-*` (8),
--   `PATH-smartfood-*` (5) e le certificazioni ISO/FSSC alimentari. E' il pezzo che
--   scioglie la domanda: due delle cinque righe sono il corredo formativo di
--   SmartFood, la stessa azienda i cui 35 corsi food/energy sono stati purgati dalla
--   `000241` e i cui `PATH-smartfood-*` sono stati purgati nella stessa migrazione.
--   Erano sfuggite perche' il loro codice e il loro nome non dicono ne' food ne'
--   energy.
--
-- Le sette righe, e cosa se ne fa
--   ① `PATH-heuresys-1/2/3` — gusci: nome = chiave-macchina, descrizione vuota,
--      metadata `{}`, tenant azzerato. Nel seed avevano un nome vero («Percorso New
--      Hire», descrizione «Onboarding completo per nuovi assunti») **identico** a
--      quello dei `PATH-rtl-bank-*` vivi: sono la copia morta di percorsi che la
--      banca sta usando davvero. → RIMOSSI.
--   ② `PATH-heuresys-4/5` — stessa coppia, ma il tenant e' RTL Bank, la descrizione
--      c'e' — «Formazione obbligatoria annuale» e «Competenze per la trasformazione
--      digitale», cioe' **le stesse** di `PATH-rtl-bank-4` e `-5`, che hanno 37 e 39
--      assegnazioni contro le loro zero — e **hanno 5 passi ciascuno**. Non e' un
--      dettaglio: i loro 10 passi puntano a `CRS-heuresys-{9,15,5,3,12}` e
--      `CRS-heuresys-{6,8,2,10,14}`, mentre i gemelli vivi puntano agli **stessi
--      numeri** col prefisso `CRS-rtl-bank-`. Misurate tutte e 15 le coppie di
--      moduli: **titolo identico su 15 su 15**, entrambe globali. E' una copia
--      parallela dello stesso catalogo con due prefissi di codice, e il ramo vivo e'
--      quello di RTL Bank. Sono i «due doppioni» che la `000254` lascio' dichiarandoli
--      «un reperto a se', da decidere»: e' questa la decisione, e si prende adesso
--      invece di lasciare mezzo reperto aperto. → RIMOSSI, coi loro 10 passi.
--      (Non hanno `tenant_id IS NULL`, quindi non sono fra le cinque di #213: sono
--      la stessa importazione e la stessa scelta, e separarle sarebbe arbitrario.)
--      I 15 moduli `CRS-heuresys-*` **restano**: sono `is_global = true`, quindi non
--      hanno lo stato impossibile che questa migrazione chiude, e la duplicazione del
--      catalogo formativo e' un difetto suo — gia' misurato altrove come «duplicazione
--      learning». Rimuoverli qui sarebbe cambiare argomento a metà lavoro.
--   ③ `LEAD-PROD-001` «Leadership for Production Supervisors» — corso di SmartFood.
--      I21: un percorso formativo e' **contenuto**, non una classificazione, e deve
--      servire un'industria che la piattaforma ospita. Le industrie ospitate sono
--      Banche/Assicurazioni (RTL Bank) e Consulenza Direzionale (Heuresys System):
--      nessuna ha supervisori di produzione. Stesso criterio con cui la `000241`
--      purgo' `HACCP-COMPLIANCE` — «global non era abbastanza». → RIMOSSO.
--   ④ `SUST-CONS-001` «Sustainability Consulting Methods» (materiality analysis,
--      scenario planning, SBTi, roadmap di implementazione) — anch'esso di SmartFood,
--      ma la **materia** e' metodologia di consulenza, che e' l'industria di Heuresys
--      System (`MGMT_CONSULTING`, ATECO 70.20). E' il precedente esatto di `ESG
--      Investing & Sustainable Finance`, che la `000241` tenne perche' «e' finanza
--      sostenibile, materia da banca». → ASSEGNATO a Heuresys System.
--
--   Il nome non si tocca. E' leggibile, e cambiarlo sarebbe inventarlo — la regola
--   che la `000254` ha stabilito («il nome non si inventa: c'e' gia', nella colonna
--   sbagliata») vale anche al contrario.
--
-- Due ipotesi mie, smentite dalla misura, scritte qui perche' non tornino
--   ① Avevo pensato di purgare anche ④ perche' «un percorso senza passi e' un guscio».
--      Misurato: **65 percorsi su 72 hanno zero passi**, inclusi tutti e 15 di Heuresys
--      System. «Senza passi» e' lo stato normale di questo catalogo, non il sintomo di
--      un residuo: quel criterio avrebbe condannato 65 righe su 72.
--   ② La prima stesura di questa migrazione trattava i passi come «riferimento vivo» e
--      si fermava trovandone 10. **La prova generale sul linux-pc l'ha bocciata** ed e'
--      stato il momento utile: un passo non e' un riferimento esterno, e' il **contenuto
--      strutturale** del percorso. Il criterio giusto e' quello che la `000241` usa gia':
--      bloccano le **assegnazioni, le evidenze, i requisiti di posizione e le iniziative**
--      — cioe' i riferimenti di persone e posizioni — mentre i passi si rimuovono con il
--      percorso, esplicitamente e non affidandosi al CASCADE silenzioso della FK.
--
-- Fuori da questa migrazione, e non e' una dimenticanza
--   Lo stesso stato impossibile esiste in altre due tabelle — 29 `sys_compensation_bands`
--   e 3 `sys_skills` — e **non e' la stessa specie di difetto**: le 29 sono i CCNL e i
--   sindacati (CCNL Credito, CGIL, FABI…), che per I21 devono restare **aperti a ogni
--   industria**, quindi sono righe classificate male (`is_global` falso) e non residui
--   da rimuovere. Curarle qui con lo stesso gesto sarebbe l'errore. → voce a se'.
--
-- Le quattro cose di ogni scrittura di massa
--   (a) misura prima → sopra, e ristampata dalla guardia
--   (b) guardia → ri-conta step, assegnazioni e requisiti AL MOMENTO dell'esecuzione
--   (c) post-condizione → protegge cio' che NON doveva cambiare: le assegnazioni dei
--       `PATH-rtl-bank-*` contate **prima e dopo** nella stessa transazione (relativo,
--       non un 199 fisso: su un clone senza dataset un numero fisso sarebbe un falso
--       rosso, e su produzione resta capace di fallire)
--   (d) rollback → `staging.learning_paths_undo_s1068`, la riga intera in jsonb,
--       popolato PRIMA di toccare qualsiasi cosa, con il comando di ripristino in coda
--
-- Idempotente: agisce solo su cio' che porta ancora quei codici.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── (d) il giornale di ripristino, prima di tutto ──────────────────────────────
CREATE TABLE IF NOT EXISTS staging.learning_paths_undo_s1068 (
  undo_id     bigserial PRIMARY KEY,
  azione      text        NOT NULL,
  riga        jsonb       NOT NULL,
  registrato  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO staging.learning_paths_undo_s1068 (azione, riga)
SELECT 'RIMOSSO', to_jsonb(lp) FROM sys.sys_learning_paths lp
 WHERE lp.learning_path_code IN ('PATH-heuresys-1','PATH-heuresys-2','PATH-heuresys-3',
                                 'PATH-heuresys-4','PATH-heuresys-5','LEAD-PROD-001')
   AND NOT EXISTS (SELECT 1 FROM staging.learning_paths_undo_s1068 u
                    WHERE u.azione='RIMOSSO'
                      AND u.riga->>'learning_path_code' = lp.learning_path_code);

INSERT INTO staging.learning_paths_undo_s1068 (azione, riga)
SELECT 'RIASSEGNATO', to_jsonb(lp) FROM sys.sys_learning_paths lp
 WHERE lp.learning_path_code = 'SUST-CONS-001'
   AND lp.learning_path_tenant_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM staging.learning_paths_undo_s1068 u
                    WHERE u.azione='RIASSEGNATO'
                      AND u.riga->>'learning_path_code' = 'SUST-CONS-001');

-- ── il conteggio da proteggere, letto PRIMA ───────────────────────────────────
CREATE TEMP TABLE _prima ON COMMIT DROP AS
SELECT (SELECT count(*) FROM sys.sys_user_learning_assignments a
         JOIN sys.sys_learning_paths lp ON lp.learning_path_id = a.user_learning_assignment_path_id
        WHERE lp.learning_path_code LIKE 'PATH-rtl-bank-%')                       AS assegnazioni_rtl,
       (SELECT count(DISTINCT a.user_learning_assignment_user_id)
          FROM sys.sys_user_learning_assignments a
          JOIN sys.sys_learning_paths lp ON lp.learning_path_id = a.user_learning_assignment_path_id
         WHERE lp.learning_path_code LIKE 'PATH-rtl-bank-%')                      AS persone_rtl,
       (SELECT count(*) FROM sys.sys_user_learning_assignments)                    AS assegnazioni_tutte,
       (SELECT count(*) FROM sys.sys_learning_paths)                               AS percorsi,
       -- i passi dei percorsi VIVI: sono cio' che non deve muoversi di una riga
       (SELECT count(*) FROM sys.sys_learning_path_steps s
          JOIN sys.sys_learning_paths lp ON lp.learning_path_id = s.learning_path_step_path_id
         WHERE lp.learning_path_code LIKE 'PATH-rtl-bank-%')                       AS passi_rtl,
       -- i passi che si portano via col percorso: 10 in produzione e sul clone
       (SELECT count(*) FROM sys.sys_learning_path_steps s
          JOIN sys.sys_learning_paths lp ON lp.learning_path_id = s.learning_path_step_path_id
         WHERE lp.learning_path_code IN ('PATH-heuresys-1','PATH-heuresys-2','PATH-heuresys-3',
                                         'PATH-heuresys-4','PATH-heuresys-5','LEAD-PROD-001')) AS passi_da_togliere,
       (SELECT count(*) FROM sys.sys_learning_path_steps)                           AS passi_tutti;

-- ── (b) la guardia: ri-verifica adesso, non eredita nulla ─────────────────────
DO $$
DECLARE
  v_da_togliere int; v_ass int; v_req int; v_sust int; v_tenant uuid; p record;
BEGIN
  SELECT * INTO p FROM _prima;
  SELECT count(*) INTO v_da_togliere FROM sys.sys_learning_paths
   WHERE learning_path_code IN ('PATH-heuresys-1','PATH-heuresys-2','PATH-heuresys-3',
                                'PATH-heuresys-4','PATH-heuresys-5','LEAD-PROD-001');

  -- Cio' che BLOCCA sono i riferimenti di PERSONE e POSIZIONI — lo stesso criterio
  -- della 000241. I passi no: sono il contenuto del percorso e se ne vanno con lui.
  SELECT count(*) INTO v_ass FROM sys.sys_user_learning_assignments a
    JOIN sys.sys_learning_paths lp ON lp.learning_path_id = a.user_learning_assignment_path_id
   WHERE lp.learning_path_code IN ('PATH-heuresys-1','PATH-heuresys-2','PATH-heuresys-3',
                                   'PATH-heuresys-4','PATH-heuresys-5','LEAD-PROD-001');
  SELECT count(*) INTO v_req FROM sys.sys_position_learning_requirements r
    JOIN sys.sys_learning_paths lp ON lp.learning_path_id = r.learning_path_id
   WHERE lp.learning_path_code IN ('PATH-heuresys-1','PATH-heuresys-2','PATH-heuresys-3',
                                   'PATH-heuresys-4','PATH-heuresys-5','LEAD-PROD-001');
  IF v_ass + v_req > 0 THEN
    RAISE EXCEPTION 'RIMOZIONE INTERROTTA: % riferimenti di persone o posizioni (% assegnazioni, % requisiti di posizione). Vanno riassegnati prima.',
                    v_ass + v_req, v_ass, v_req;
  END IF;

  -- Un passo che si porta via si DICHIARA: se il numero non e' quello misurato, il
  -- database non e' quello che credo e va guardato prima di cancellare.
  IF v_da_togliere > 0 AND p.passi_da_togliere NOT IN (0, 10) THEN
    RAISE EXCEPTION 'RIMOZIONE INTERROTTA: attesi 0 o 10 passi sui percorsi da rimuovere, trovati %. Misurare prima di procedere.',
                    p.passi_da_togliere;
  END IF;

  -- Il tenant di destinazione deve esistere: se `HEURESYS` non c'e', la
  -- riassegnazione non ha dove andare e si ferma invece di lasciare NULL.
  SELECT count(*) INTO v_sust FROM sys.sys_learning_paths
   WHERE learning_path_code = 'SUST-CONS-001' AND learning_path_tenant_id IS NULL;
  IF v_sust > 0 THEN
    SELECT tenant_id INTO v_tenant FROM sys.sys_tenancies WHERE tenant_code = 'HEURESYS';
    IF v_tenant IS NULL THEN
      RAISE EXCEPTION 'RIASSEGNAZIONE INTERROTTA: il tenant HEURESYS non esiste in questo database';
    END IF;
  END IF;

  IF v_da_togliere = 0 AND v_sust = 0 THEN
    RAISE NOTICE 'NIENTE DA FARE — la bonifica di #213 e'' gia'' applicata su questo database';
  ELSE
    RAISE NOTICE 'GUARDIA OK — % percorsi da rimuovere (coi loro % passi), % da riassegnare, zero riferimenti di persone o posizioni',
                 v_da_togliere, p.passi_da_togliere, v_sust;
  END IF;
END $$;

-- ── ①②③ la rimozione: elenco esplicito, mai un jolly ─────────────────────────
-- I passi prima, esplicitamente: la FK e' ON DELETE CASCADE e li porterebbe via da
-- se', ma una cancellazione che accade in silenzio non si conta e non si spiega.
DELETE FROM sys.sys_learning_path_steps s
 USING sys.sys_learning_paths lp
 WHERE lp.learning_path_id = s.learning_path_step_path_id
   AND lp.learning_path_code IN ('PATH-heuresys-1','PATH-heuresys-2','PATH-heuresys-3',
                                 'PATH-heuresys-4','PATH-heuresys-5','LEAD-PROD-001');

DELETE FROM sys.sys_learning_paths
 WHERE learning_path_code IN ('PATH-heuresys-1','PATH-heuresys-2','PATH-heuresys-3',
                              'PATH-heuresys-4','PATH-heuresys-5','LEAD-PROD-001');

-- ── ④ la riassegnazione ───────────────────────────────────────────────────────
UPDATE sys.sys_learning_paths lp
   SET learning_path_tenant_id = (SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code='HEURESYS'),
       updated_at = now()
 WHERE lp.learning_path_code = 'SUST-CONS-001'
   AND lp.learning_path_tenant_id IS NULL;

-- ── la sentinella: 5 prima, 0 dopo, e da qui in avanti sempre 0 ──────────────
-- Una vista `sys.v_*` entra da se' nella batteria di `db_health.py`, che pretende
-- zero righe: da adesso il difetto non puo' tornare in silenzio. Volutamente
-- ristretta ai percorsi formativi — le 29 fasce CCNL sono un'altra specie, e una
-- sentinella che nasce rossa e resta rossa insegna a ignorare gli allarmi (#194).
CREATE OR REPLACE VIEW sys.v_learning_paths_senza_titolare AS
SELECT lp.learning_path_id,
       lp.learning_path_code,
       lp.learning_path_name,
       lp.created_at
  FROM sys.sys_learning_paths lp
 WHERE lp.learning_path_tenant_id IS NULL
   AND lp.learning_path_is_global = false;

COMMENT ON VIEW sys.v_learning_paths_senza_titolare IS
 'Sentinella #213: un percorso senza tenant e non globale non lo vede nessuna azienda, perche'' la lista filtra (is_global OR tenant_id = $1). Valeva 5 il 2026-08-17, deve valere 0.';

-- ── (c) la post-condizione: protegge cio' che NON doveva cambiare ─────────────
DO $$
DECLARE
  v_orfani int; v_macchina int; v_percorsi int; v_heuresys int;
  v_ass_ora int; v_pers_ora int; v_ass_tutte int; v_passi_rtl int; v_passi_tutti int;
  p record;
BEGIN
  SELECT * INTO p FROM _prima;

  SELECT count(*) INTO v_orfani   FROM sys.v_learning_paths_senza_titolare;
  SELECT count(*) INTO v_macchina FROM sys.sys_learning_paths WHERE learning_path_name LIKE 'OLDDB::%';
  SELECT count(*) INTO v_percorsi FROM sys.sys_learning_paths;
  SELECT count(*) INTO v_heuresys FROM sys.sys_learning_paths lp
    JOIN sys.sys_tenancies t ON t.tenant_id = lp.learning_path_tenant_id
   WHERE t.tenant_code = 'HEURESYS';

  SELECT count(*), count(DISTINCT a.user_learning_assignment_user_id)
    INTO v_ass_ora, v_pers_ora
    FROM sys.sys_user_learning_assignments a
    JOIN sys.sys_learning_paths lp ON lp.learning_path_id = a.user_learning_assignment_path_id
   WHERE lp.learning_path_code LIKE 'PATH-rtl-bank-%';
  SELECT count(*) INTO v_ass_tutte FROM sys.sys_user_learning_assignments;

  -- LA PROVA: lo stato impossibile non esiste piu'
  IF v_orfani <> 0 THEN
    RAISE EXCEPTION 'POST-CONDIZIONE ROSSA: restano % percorsi senza titolare e non globali', v_orfani;
  END IF;
  -- e nessuna chiave-macchina sopravvive nel nome
  IF v_macchina <> 0 THEN
    RAISE EXCEPTION 'POST-CONDIZIONE ROSSA: % percorsi portano ancora un nome OLDDB::', v_macchina;
  END IF;
  -- CIO' CHE NON DOVEVA CAMBIARE — confronto relativo, valido su qualunque clone
  IF v_ass_ora <> p.assegnazioni_rtl OR v_pers_ora <> p.persone_rtl THEN
    RAISE EXCEPTION 'POST-CONDIZIONE ROSSA: le assegnazioni dei percorsi vivi di RTL Bank sono cambiate — prima % righe su % persone, ora % su %',
                    p.assegnazioni_rtl, p.persone_rtl, v_ass_ora, v_pers_ora;
  END IF;
  IF v_ass_tutte <> p.assegnazioni_tutte THEN
    RAISE EXCEPTION 'POST-CONDIZIONE ROSSA: il totale delle assegnazioni e'' cambiato — prima %, ora %. Una FK SET NULL ha morso.',
                    p.assegnazioni_tutte, v_ass_tutte;
  END IF;

  -- I passi dei percorsi VIVI non si toccano, e il totale cala di ESATTAMENTE
  -- quanti se ne portavano via i percorsi rimossi: ne' uno di piu' ne' uno di meno.
  SELECT count(*) INTO v_passi_rtl FROM sys.sys_learning_path_steps s
    JOIN sys.sys_learning_paths lp ON lp.learning_path_id = s.learning_path_step_path_id
   WHERE lp.learning_path_code LIKE 'PATH-rtl-bank-%';
  SELECT count(*) INTO v_passi_tutti FROM sys.sys_learning_path_steps;
  IF v_passi_rtl <> p.passi_rtl THEN
    RAISE EXCEPTION 'POST-CONDIZIONE ROSSA: i passi dei percorsi vivi di RTL Bank sono cambiati — prima %, ora %',
                    p.passi_rtl, v_passi_rtl;
  END IF;
  IF v_passi_tutti <> p.passi_tutti - p.passi_da_togliere THEN
    RAISE EXCEPTION 'POST-CONDIZIONE ROSSA: i passi totali sono % , attesi % (% meno i % dei percorsi rimossi)',
                    v_passi_tutti, p.passi_tutti - p.passi_da_togliere, p.passi_tutti, p.passi_da_togliere;
  END IF;

  RAISE NOTICE 'PERCORSI OK — 0 senza titolare, 0 nomi-macchina, % percorsi in totale (% di Heuresys System). Intatti: % assegnazioni di RTL Bank su % persone e i suoi % passi. Passi totali % -> %.',
               v_percorsi, v_heuresys, v_ass_ora, v_pers_ora, v_passi_rtl, p.passi_tutti, v_passi_tutti;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- RIPRISTINO — le righe intere stanno nel giornale
--   INSERT INTO sys.sys_learning_paths
--   SELECT * FROM staging.learning_paths_undo_s1068 u,
--        jsonb_populate_record(null::sys.sys_learning_paths, u.riga)
--    WHERE u.azione = 'RIMOSSO';
--   UPDATE sys.sys_learning_paths SET learning_path_tenant_id = NULL
--    WHERE learning_path_code = 'SUST-CONS-001';   -- annulla la riassegnazione
-- ═══════════════════════════════════════════════════════════════════════════════
