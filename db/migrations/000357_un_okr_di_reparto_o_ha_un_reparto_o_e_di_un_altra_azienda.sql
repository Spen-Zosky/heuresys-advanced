-- ============================================================================
-- 000357 — Un OKR di reparto o ha un reparto, o è di un'altra azienda
--
-- VOCE: #234 F2, firma `X6a` — «OKR agganciato a un reparto che
-- nell'organigramma non esiste». Misurato il 2026-08-27 con la query del check:
-- **5 righe su 17**, tutte RTL_BANK, tutte `DEPARTMENT`/`ACTIVE`, tutte con
-- periodo dal 2024-10-01.
--
-- E SONO DUE NATURE DIVERSE, non una. Distinguerle è il lavoro di questa
-- migrazione; trattarle uguali avrebbe cancellato tre obiettivi legittimi o
-- tenuto in vita due che non parlano di questa azienda.
--
--   ① ESTRANEI AL DOMINIO (2) — «Supply Chain: achieve 100% supplier
--     traceability» e «Sales: increase B2B customer base by 40%». Una banca non
--     ha una catena di fornitura da tracciare, e «B2B customer base» è gergo
--     commerciale generico, non bancario. È contaminazione da un altro dataset,
--     e cade sotto **I21** (dato che deriva dall'industry dev'essere coerente
--     con essa) col criterio già usato in S1042: «nomina un'entità inesistente».
--     ⚠ IL PRECEDENTE ESISTE, ED È NELLO STESSO PUNTO: la `000235` (bonifica
--     della contaminazione tenant) ha già cancellato **3 OKR di dominio
--     alimentare** — «Reduce packaging waste», «IoT cold chain monitoring»,
--     «ISO 22000» — dichiarando che «qui il criterio strutturale non discrimina
--     (tutti gli OKR hanno owner NULL), quindi il taglio è per contenuto ed è
--     verificabile a occhio riga per riga, essendo tre». Questi due sono la
--     stessa specie: sfuggirono perché allora si nominarono i soli tre
--     alimentari. Stesso criterio, stesso stile, elenco esplicito.
--
--   ② NOMI DISALLINEATI (3) — «Digital Banking», «Corporate Banking»,
--     «Finance». Gli obiettivi sono coerenti con una banca; è il *nome del
--     reparto* che non corrisponde ad alcuna unità dopo la ricostruzione
--     dell'organigramma. Le unità che li coprono esistono, con altri nomi.
--
-- LA CAUSA A MONTE, dichiarata e NON risolta qui: `okr_department` è **testo
-- libero**, non una FK. Finché resta tale, il controllo si riaccenderà a ogni
-- rinomina. Questa migrazione mitiga scrivendo il **codice** dell'unità invece
-- del nome: il check confronta `lower(u.organization_unit_code) =
-- lower(o.okr_department)` con **uguaglianza esatta**, quindi un codice
-- sopravvive a una rinomina del nome, che è precisamente la fragilità osservata.
-- Trasformare la colonna in FK è un cambio di schema con superficie API: resta
-- una proposta di #234, non un effetto collaterale di una bonifica dati.
--
-- IL CRITERIO DI ASSEGNAZIONE dei tre, dichiarato perché sia sindacabile:
-- si prende l'unità che **governa il tema dell'obiettivo**, al livello
-- divisionale/direzionale coerente col tipo `DEPARTMENT` dell'OKR.
--   · «Launch mobile banking app v3.0»   -> DIR-DEV   (Direzione Sviluppo
--     Software e Canali Digitali) — l'app mobile È un canale digitale.
--   · «Increase corporate lending by 20%» -> DIV-CRED  (Divisione Crediti) — il
--     credito alle imprese è governato dalla divisione che governa il credito;
--     UFF-CRED-PMI è un ufficio, troppo in basso per un OKR di reparto.
--   · «Reduce operational costs by 12%»   -> DIV-CFO   (Divisione Finanza e
--     Amministrazione) — «Finance» ne è la traduzione, e il contenimento dei
--     costi è materia sua.
--
-- NESSUN FILE DELLA CATENA RICREA QUESTE RIGHE — verificato, non supposto:
-- `rg "insert into sys\.?sys_okrs" db/` non trova nulla; la `000037` crea la
-- sola tabella (0 INSERT) e la `000235` cancella soltanto. Gli OKR provengono
-- dall'ingestione brownfield storica (ADR-0038, rubinetto chiuso). Quindi qui
-- non c'è un file da emendare ai sensi di ADR-0035: la cura a valle **regge**,
-- e questo è il motivo per cui regge, scritto perché nessuno debba ri-dedurlo.
--
-- ROLLBACK: giornale `staging.mig357_okr_reparti_undo` (riga intera in JSONB
-- per le cancellazioni, valore prima/dopo per i rinomini) + funzione
-- `staging.mig357_okr_reparti_undo_apply()`.
--
-- IDEMPOTENTE: ogni istruzione è filtrata sul valore *prima*; alla seconda
-- passata nessuna riga corrisponde e tutte toccano zero righe.
-- Authored: 2026-08-27 (S1082).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. Il giornale di annullamento, PRIMA di qualunque scrittura.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staging.mig357_okr_reparti_undo (
  undo_id        bigserial PRIMARY KEY,
  migrazione     text        NOT NULL,
  azione         text        NOT NULL CHECK (azione IN ('DELETE','RENAME')),
  okr_id         uuid        NOT NULL,
  reparto_prima  text,
  reparto_dopo   text,
  riga_intera    jsonb,
  creato_il      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE staging.mig357_okr_reparti_undo IS
  'Giornale di annullamento della bonifica X6a (#234 F2). DELETE conserva la riga '
  'intera in JSONB; RENAME conserva il valore prima e dopo di okr_department. '
  'Si applica al contrario con staging.mig357_okr_reparti_undo_apply().';

-- ----------------------------------------------------------------------------
-- 1. LA GUARDIA — ri-verifica la precondizione ADESSO, non eredita la misura.
--
--    Non fa fallire la migrazione se le righe non ci sono più (dev'essere
--    idempotente e girare su un database nuovo): dichiara ciò che trova, e le
--    istruzioni sotto sono comunque filtrate sul valore prima.
--    Fallisce invece — e deve — se le unità di destinazione NON esistono: senza
--    di esse i tre rinomini scriverebbero un codice che non aggancia nulla,
--    cioè sostituirebbero un orfano con un altro orfano.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_estranei   int;
  v_rinominare int;
  v_mancanti   text;
BEGIN
  SELECT count(*) INTO v_estranei
    FROM sys.sys_okrs
   WHERE okr_objective IN ('Achieve 100% supplier traceability',
                           'Increase B2B customer base by 40%');

  SELECT count(*) INTO v_rinominare
    FROM sys.sys_okrs
   WHERE okr_department IN ('Digital Banking', 'Corporate Banking', 'Finance');

  SELECT string_agg(c, ', ') INTO v_mancanti
    FROM (VALUES ('DIR-DEV'), ('DIV-CRED'), ('DIV-CFO')) AS v(c)
   WHERE NOT EXISTS (
     SELECT 1 FROM sys.sys_organization_units u
      JOIN sys.sys_tenancies t ON t.tenant_id = u.organization_unit_tenant_id
      WHERE u.organization_unit_is_active
        AND t.tenant_code = 'RTL_BANK'
        AND u.organization_unit_code = v.c);

  IF v_mancanti IS NOT NULL AND v_rinominare > 0 THEN
    RAISE EXCEPTION
      'mig357: le unita di destinazione non esistono in RTL_BANK (%). Rinominare '
      'verso un codice inesistente sostituirebbe un orfano con un altro orfano.',
      v_mancanti;
  END IF;

  RAISE NOTICE 'mig357 guardia: % estranei da rimuovere, % da rinominare',
    v_estranei, v_rinominare;
END $$;

-- ----------------------------------------------------------------------------
-- 2. ① GLI ESTRANEI AL DOMINIO — elenco esplicito, mai un jolly.
--    Il giornale si popola prima della cancellazione.
-- ----------------------------------------------------------------------------
INSERT INTO staging.mig357_okr_reparti_undo (migrazione, azione, okr_id, reparto_prima, riga_intera)
SELECT '000357', 'DELETE', o.okr_id, o.okr_department, to_jsonb(o)
  FROM sys.sys_okrs o
 WHERE o.okr_objective IN ('Achieve 100% supplier traceability',
                           'Increase B2B customer base by 40%');

DELETE FROM sys.sys_okrs
 WHERE okr_objective IN ('Achieve 100% supplier traceability',
                         'Increase B2B customer base by 40%');

-- ----------------------------------------------------------------------------
-- 3. ② I NOMI DISALLINEATI — si scrive il CODICE dell'unità, non il nome.
-- ----------------------------------------------------------------------------
INSERT INTO staging.mig357_okr_reparti_undo (migrazione, azione, okr_id, reparto_prima, reparto_dopo)
SELECT '000357', 'RENAME', o.okr_id, o.okr_department,
       CASE o.okr_department
         WHEN 'Digital Banking'   THEN 'DIR-DEV'
         WHEN 'Corporate Banking' THEN 'DIV-CRED'
         WHEN 'Finance'           THEN 'DIV-CFO'
       END
  FROM sys.sys_okrs o
 WHERE o.okr_department IN ('Digital Banking', 'Corporate Banking', 'Finance');

UPDATE sys.sys_okrs
   SET okr_department = CASE okr_department
         WHEN 'Digital Banking'   THEN 'DIR-DEV'
         WHEN 'Corporate Banking' THEN 'DIV-CRED'
         WHEN 'Finance'           THEN 'DIV-CFO'
       END,
       updated_at = now()
 WHERE okr_department IN ('Digital Banking', 'Corporate Banking', 'Finance');

-- ----------------------------------------------------------------------------
-- 4. LE POST-CONDIZIONI — proteggono anche ciò che NON doveva cambiare.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_orfani    int;
  v_totali    int;
  v_altri     int;
  v_cancellati int;
BEGIN
  -- (a) cio' che DOVEVA cambiare: nessun OKR resta senza reparto.
  WITH ou AS (SELECT * FROM sys.sys_organization_units WHERE organization_unit_is_active)
  SELECT count(*) INTO v_orfani
    FROM sys.sys_okrs o
   WHERE o.okr_department IS NOT NULL
     AND lower(o.okr_department) <> 'company-wide'
     AND NOT EXISTS (
       SELECT 1 FROM ou u
        WHERE lower(u.organization_unit_name) LIKE '%' || lower(o.okr_department) || '%'
           OR lower(o.okr_department) LIKE '%' || lower(u.organization_unit_name) || '%'
           OR lower(u.organization_unit_code) = lower(o.okr_department));

  IF v_orfani <> 0 THEN
    RAISE EXCEPTION 'mig357: restano % OKR con un reparto inesistente', v_orfani;
  END IF;

  -- (b) cio' che NON doveva cambiare: gli altri OKR sono ancora tutti li'.
  --     Prima erano 17; due sono stati rimossi di proposito, quindi 15 e' il
  --     numero atteso. Su un database nuovo, dove le righe non esistono, il
  --     conteggio e' zero e la verifica si limita a non trovare orfani.
  SELECT count(*) INTO v_totali FROM sys.sys_okrs;
  SELECT count(*) INTO v_cancellati
    FROM staging.mig357_okr_reparti_undo
   WHERE migrazione = '000357' AND azione = 'DELETE';

  SELECT count(*) INTO v_altri
    FROM sys.sys_okrs
   WHERE okr_department IS NULL OR lower(okr_department) = 'company-wide';

  RAISE NOTICE 'mig357 post: % OKR totali (di cui % senza reparto o company-wide), '
               '% cancellati nel giornale, 0 orfani',
    v_totali, v_altri, v_cancellati;

  -- (c) le unita di destinazione non sono state toccate da questa migrazione:
  --     se una fosse sparita, i rinomini avrebbero prodotto nuovi orfani — ed
  --     e' gia' coperto da (a), che sarebbe rosso. Lo si dichiara qui perche'
  --     la protezione sia leggibile, non solo implicita.
END $$;

-- ----------------------------------------------------------------------------
-- 5. La funzione che disfa, perche' un rollback dichiarato e non eseguibile
--    non e' un rollback.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.mig357_okr_reparti_undo_apply()
RETURNS TABLE(azione text, righe bigint)
LANGUAGE plpgsql AS $$
DECLARE
  v_rinominati bigint := 0;
  v_ripristinati bigint := 0;
BEGIN
  UPDATE sys.sys_okrs o
     SET okr_department = u.reparto_prima, updated_at = now()
    FROM staging.mig357_okr_reparti_undo u
   WHERE u.migrazione = '000357' AND u.azione = 'RENAME'
     AND o.okr_id = u.okr_id AND o.okr_department = u.reparto_dopo;
  GET DIAGNOSTICS v_rinominati = ROW_COUNT;

  INSERT INTO sys.sys_okrs
  SELECT (jsonb_populate_record(NULL::sys.sys_okrs, u.riga_intera)).*
    FROM staging.mig357_okr_reparti_undo u
   WHERE u.migrazione = '000357' AND u.azione = 'DELETE'
     AND NOT EXISTS (SELECT 1 FROM sys.sys_okrs o WHERE o.okr_id = u.okr_id);
  GET DIAGNOSTICS v_ripristinati = ROW_COUNT;

  RETURN QUERY VALUES ('RENAME disfatti', v_rinominati), ('DELETE ripristinati', v_ripristinati);
END $$;

COMMIT;
