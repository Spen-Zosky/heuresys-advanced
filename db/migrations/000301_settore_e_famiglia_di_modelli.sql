-- ============================================================================
-- 000301 — Dal settore di un'azienda alla famiglia di modelli che la descrive.
--          (#131 Tenant Builder P1, prerequisito del T5)
--
-- PERCHE' ESISTE QUESTO FILE. Il piano del T5 dava per scontato che «dall'ATECO
-- si risale alla famiglia, perche' il codice della famiglia corrisponde al
-- codice di settore del tenant». Misurato sul vivo prima di scrivere una riga,
-- quel «si risale» non aveva su cosa poggiare:
--
--     sys.sys_activity_classification_mappings            -> 0 righe
--     sys.sys_blueprint_families.blueprint_family_metadata-> '{}'
--     sys.sys_tenancies.tenant_industry_code              -> varchar SENZA check
--
-- I due codici coincidono («FIN_BANKING») perche' sono stati scritti a mano
-- uguali, non perche' una regola li leghi. L'epica lo dichiara essa stessa in
-- §3.4: «Nessuna derivazione». Senza questa tabella la proposta del modello
-- sarebbe una corrispondenza per stringa: funziona su RTL Bank e su nient'altro,
-- e il giorno che entra la seconda famiglia sbaglia in silenzio.
--
-- COSA MAPPA, E A CHE LIVELLO. Gli ATECO sono gerarchici (misurato:
-- 64.19 -> 64.1 -> 64 -> L, livelli 4>3>2>1, su 6 livelli complessivi). Si
-- mappa la famiglia a un NODO ALTO, e la derivazione risale di padre in padre
-- finche' incontra il primo nodo mappato. Cosi' una famiglia copre un ramo
-- intero con una riga sola, invece di 3.257.
--
-- FIN_BANKING si mappa su `64` (Attivita' dei servizi finanziari), NON su `L`.
-- `L` comprende anche le assicurazioni (65) e le attivita' ausiliarie (66), che
-- quella famiglia non modella: il suo unico modello pubblicato si chiama
-- REGIONAL_RETAIL_BANK_MEDIUM. Mappare `L` farebbe proporre un modello di banca
-- a una compagnia assicurativa — che e' peggio del non proporre niente, perche'
-- R4 dice che quando il modello non c'e' lo si DICE, non si ripiega.
--
-- I21 — questa e' una TASSONOMIA, non contenuto: resta aperta a ogni settore.
-- Il fatto che oggi contenga una riga sola non la rende specifica di un settore,
-- e infatti la seconda riga (consulenza direzionale, 70.20) non si scrive qui
-- perche' non esiste ancora una famiglia di modelli che la descriva.
--
-- IDEMPOTENTE + sicura due volte. Nessuna operazione distruttiva.
-- PER TORNARE INDIETRO: `DROP TABLE sys.sys_blueprint_family_activity_classes`
-- e `DROP FUNCTION sys.sys_blueprint_family_for_activity_class(uuid)`. Non
-- esiste un giornale di undo perche' il file non modifica e non cancella nulla
-- di preesistente: crea un oggetto nuovo e vi inserisce una riga.
-- ============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS sys.sys_blueprint_family_activity_classes (
  blueprint_family_activity_class_id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_family_activity_class_family_id         uuid NOT NULL
    REFERENCES sys.sys_blueprint_families (blueprint_family_id) ON DELETE CASCADE,
  blueprint_family_activity_class_classification_id uuid NOT NULL
    REFERENCES sys.sys_activity_classifications (activity_classification_id) ON DELETE RESTRICT,
  -- RD-08: categoriale = varchar + CHECK, mai un ENUM di PostgreSQL.
  -- PRIMARY  = da qui si DERIVA la famiglia risalendo l'albero.
  -- SECONDARY= ramo affine, dichiarato ma non usato per derivare: serve a
  --            documentare una copertura parziale senza renderla automatica.
  blueprint_family_activity_class_kind              varchar(32) NOT NULL DEFAULT 'PRIMARY',
  blueprint_family_activity_class_notes             text,
  created_at                                        timestamptz NOT NULL DEFAULT now(),
  updated_at                                        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_family_activity_class_kind_check
    CHECK (blueprint_family_activity_class_kind IN ('PRIMARY', 'SECONDARY'))
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_bp_family_activity_class_pair_uq
  ON sys.sys_blueprint_family_activity_classes
     (blueprint_family_activity_class_family_id,
      blueprint_family_activity_class_classification_id);

-- Il vincolo che rende la derivazione DETERMINISTICA: una stessa classificazione
-- non puo' essere il nodo primario di due famiglie diverse, altrimenti risalire
-- l'albero darebbe due risposte e il programma ne sceglierebbe una a caso.
CREATE UNIQUE INDEX IF NOT EXISTS sys_bp_family_activity_class_one_primary_uq
  ON sys.sys_blueprint_family_activity_classes
     (blueprint_family_activity_class_classification_id)
  WHERE blueprint_family_activity_class_kind = 'PRIMARY';

CREATE INDEX IF NOT EXISTS sys_bp_family_activity_class_family_idx
  ON sys.sys_blueprint_family_activity_classes (blueprint_family_activity_class_family_id);

DROP TRIGGER IF EXISTS sys_bp_family_activity_classes_set_updated_at
  ON sys.sys_blueprint_family_activity_classes;
CREATE TRIGGER sys_bp_family_activity_classes_set_updated_at
  BEFORE UPDATE ON sys.sys_blueprint_family_activity_classes
  FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();

COMMENT ON TABLE sys.sys_blueprint_family_activity_classes IS
  'Quale ramo di attivita'' economica una famiglia di modelli di settore descrive. '
  'Si mappa un nodo alto (una divisione ATECO) e la derivazione risale l''albero '
  'della classificazione fino al primo nodo mappato.';

-- ---------------------------------------------------------------------------
-- La risalita. Restituisce la famiglia che descrive quella classificazione, o
-- NULL se nessuna la copre — e NULL e' una risposta legittima, non un errore:
-- R4 pretende che «non c'e' modello» si possa dire.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sys.sys_blueprint_family_for_activity_class(p_classification_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  WITH RECURSIVE risalita AS (
    SELECT a.activity_classification_id      AS id,
           a.activity_classification_scheme  AS scheme,
           a.activity_classification_parent_code AS parent_code,
           1                                 AS profondita
      FROM sys.sys_activity_classifications a
     WHERE a.activity_classification_id = p_classification_id
    UNION ALL
    -- La guardia sulla profondita' non e' decorativa: la gerarchia e' un albero
    -- garantito da una FK, ma la FK non vieta un ciclo fra due nodi che si
    -- dichiarano padre a vicenda. Sei livelli esistono, dieci bastano.
    SELECT p.activity_classification_id,
           p.activity_classification_scheme,
           p.activity_classification_parent_code,
           r.profondita + 1
      FROM risalita r
      JOIN sys.sys_activity_classifications p
        ON p.activity_classification_scheme = r.scheme
       AND p.activity_classification_code   = r.parent_code
     WHERE r.parent_code IS NOT NULL
       AND r.profondita < 10
  )
  SELECT m.blueprint_family_activity_class_family_id
    FROM risalita r
    JOIN sys.sys_blueprint_family_activity_classes m
      ON m.blueprint_family_activity_class_classification_id = r.id
     AND m.blueprint_family_activity_class_kind = 'PRIMARY'
   ORDER BY r.profondita   -- il nodo piu' vicino vince: il piu' specifico dei due
   LIMIT 1;
$$;

COMMENT ON FUNCTION sys.sys_blueprint_family_for_activity_class(uuid) IS
  'La famiglia di modelli che descrive un ramo di attivita'' economica, risalendo '
  'l''albero della classificazione. NULL quando nessuna famiglia lo copre: e'' una '
  'risposta, non un errore.';

-- ---------------------------------------------------------------------------
-- La riga di oggi.
-- ---------------------------------------------------------------------------
INSERT INTO sys.sys_blueprint_family_activity_classes
  (blueprint_family_activity_class_family_id,
   blueprint_family_activity_class_classification_id,
   blueprint_family_activity_class_kind,
   blueprint_family_activity_class_notes)
SELECT f.blueprint_family_id, c.activity_classification_id, 'PRIMARY',
       'Divisione 64 — servizi finanziari escluse assicurazioni e fondi pensione. '
       'Non il gruppo L: comprenderebbe assicurazioni (65) e ausiliari (66), che questa famiglia non modella.'
  FROM sys.sys_blueprint_families f
  JOIN sys.sys_activity_classifications c
    ON c.activity_classification_scheme = 'ATECO_2025'
   AND c.activity_classification_code   = '64'
 WHERE f.blueprint_family_code = 'FIN_BANKING'
ON CONFLICT (blueprint_family_activity_class_family_id,
             blueprint_family_activity_class_classification_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Le verifiche. Scritte per poter fallire: ognuna interroga il dato, nessuna
-- ripete l'istruzione appena data.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_famiglia_rtl   uuid;
  v_attesa         uuid;
  v_chimica        uuid;
  v_manifattura    uuid;
  n                int;
BEGIN
  -- (1) La derivazione funziona sul caso vero: l'ATECO di RTL Bank, che e' una
  --     FOGLIA di quarto livello, deve risalire fino alla divisione mappata.
  SELECT sys.sys_blueprint_family_for_activity_class(c.activity_classification_id)
    INTO v_famiglia_rtl
    FROM sys.sys_activity_classifications c
   WHERE c.activity_classification_scheme = 'ATECO_2025'
     AND c.activity_classification_code   = '64.19';

  SELECT blueprint_family_id INTO v_attesa
    FROM sys.sys_blueprint_families WHERE blueprint_family_code = 'FIN_BANKING';

  IF v_famiglia_rtl IS DISTINCT FROM v_attesa THEN
    RAISE EXCEPTION '000301: da ATECO 64.19 doveva risalire a FIN_BANKING, ha dato %', v_famiglia_rtl;
  END IF;

  -- (2) La prova che PUO' fallire, ed e' quella che conta: un settore non
  --     coperto deve dare NULL. Se questa desse una famiglia, vorrebbe dire che
  --     la risalita arriva troppo in alto e proporrebbe un modello di banca a
  --     un'industria chimica.
  --
  --     PRIMA pero' si prende il soggetto della prova, e si pretende che esista.
  --     Senza questo passaggio la prova sarebbe un FALSO VERDE su un database
  --     dove il catalogo ATECO non fosse caricato: nessuna riga `20.%`, la
  --     variabile resta NULL, il controllo passa — e non ha provato niente.
  SELECT c.activity_classification_id INTO v_chimica
    FROM sys.sys_activity_classifications c
   WHERE c.activity_classification_scheme = 'ATECO_2025'
     AND c.activity_classification_code LIKE '20.%'
   ORDER BY c.activity_classification_code
   LIMIT 1;

  IF v_chimica IS NULL THEN
    RAISE EXCEPTION '000301: nel catalogo non c''e'' nessun ATECO 20.%% su cui provare '
                    'che un settore non coperto NON risale a una famiglia: la verifica '
                    'sarebbe passata senza provare nulla';
  END IF;

  v_manifattura := sys.sys_blueprint_family_for_activity_class(v_chimica);

  IF v_manifattura IS NOT NULL THEN
    RAISE EXCEPTION '000301: un ATECO manifatturiero ha trovato la famiglia %: la risalita e'' troppo larga', v_manifattura;
  END IF;

  -- (3) Nessuna ambiguita': una classificazione, al piu' una famiglia primaria.
  SELECT count(*) INTO n FROM (
    SELECT blueprint_family_activity_class_classification_id
      FROM sys.sys_blueprint_family_activity_classes
     WHERE blueprint_family_activity_class_kind = 'PRIMARY'
     GROUP BY 1 HAVING count(*) > 1) AS ambigue;
  IF n <> 0 THEN
    RAISE EXCEPTION '000301: % classificazioni mappate a piu'' famiglie primarie', n;
  END IF;

  -- (4) Post-condizioni che proteggono cio' che NON doveva cambiare. Questo file
  --     tocca solo una tabella nuova, quindi il catalogo dei modelli e la
  --     popolazione dei tenant devono essere esattamente come prima.
  SELECT count(*) INTO n FROM sys.sys_blueprint_process_registry;
  IF n <> 23 THEN
    RAISE EXCEPTION '000301: il registro dei processi doveva restare a 23 righe, ne ha %', n;
  END IF;

  SELECT count(*) INTO n FROM sys.sys_blueprint_variant_versions
   WHERE blueprint_variant_version_status = 'PUBLISHED';
  IF n <> 1 THEN
    RAISE EXCEPTION '000301: doveva restare 1 sola versione di modello pubblicata, ce ne sono %', n;
  END IF;

  SELECT count(*) INTO n FROM sys.sys_tenancies WHERE tenant_status = 'ACTIVE';
  IF n <> 2 THEN
    RAISE EXCEPTION '000301: i tenant attivi dovevano restare 2, sono %', n;
  END IF;

  RAISE NOTICE '000301: ATECO 64.19 risale a FIN_BANKING; un manifatturiero non risale a nulla; catalogo intatto';
END $$;

COMMIT;
