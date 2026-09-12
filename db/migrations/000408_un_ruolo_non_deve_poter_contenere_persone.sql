-- 000408 — Un ruolo non deve poter contenere persone.
--
-- #214 F6 — QUATTORDICESIMO perimetro in sola lettura per l'agente: `job-roles`.
--
-- PERCHE' PROPRIO QUESTO, e non a intuito. Criterio meccanico di `check_concetti_agente.py`,
-- ri-derivato il 2026-09-12 sull'atlante fresco (da e818bc8b): 108 moduli · 13 aperti · 44 in
-- coda (25 neutri). La testa dei neutri per ampiezza era `candidate-applications` (2 letture ·
-- 3 pagine), poi un pari a due a 2 letture · 2 pagine: `enterprise-typing-profiles` e
-- `job-roles`.
--
-- ⚠⚠ IL REPERTO CHE HA CAMBIATO LA CODA PRIMA DELLA SCELTA. `candidate-applications` — e con
-- lui `candidates` — risultava «nessun dato di persona» perche' le sue rotte GET portano il
-- permesso `job-requisition:read`, e la resource `job-requisition` sta in
-- `RESOURCE_SENZA_DATI_DI_PERSONA` con una ragione vera PER LE REQUISIZIONI («una posizione da
-- coprire, non chi la coprira'»). Ma quel permesso e' CONDIVISO da tre moduli, e due di essi
-- descrivono persone: `sys_candidates` porta nome, cognome, email, telefono, consenso e data di
-- conservazione (misurato su information_schema, 2026-09-12); `sys_candidate_applications` ha
-- per SOGGETTO il candidato (`application_candidate_id`), con stadio e motivo di rifiuto. E' la
-- stessa forma del difetto `engagement` (S1083): il criterio accettava come neutro un silenzio.
-- Corretto nello stesso commit, nello strumento (V2, elenco esplicito): i due moduli sono
-- ESCLUSI dalla coda con la ragione scritta, come `leads` — persone esterne all'organico, fuori
-- dalla tassonomia dei dipendenti, e l'agente non le legge. Non e' una migrazione: il permesso
-- condiviso e' materia di #54, non di questa apertura.
--
-- Tolti i due, la testa e' il pari fra `enterprise-typing-profiles` — che resta SCARTATO per la
-- ragione misurata il 2026-09-08 e ancora vera (la sua unica porta, il JSONB
-- `enterprise_typing_metadata`, e' GIA' OCCUPATA da `decided_by` con un nome proprio in chiaro)
-- — e `job-roles`, che la 000407 aveva gia' messo per ultimo dei tre «vocabolari delle
-- persone», con la motivazione scritta: un RUOLO e' cio' che una persona RICOPRE, l'etichetta di
-- un posto. Si apre per ultimo, e si apre ora.
--
-- ⚠ `approvals` e' piu' ampio (2 letture · 3 pagine) ma NON e' in gara: dichiara ACTIVITY.
--
-- COSA E'. `sys_job_roles` e' il CATALOGO delle mansioni: 176 righe in produzione, agganciate a
-- una famiglia (`job_role_family_id`), con codice, nome, descrizione, livello di seniority.
-- `job_role_tenant_id` esiste (000397, per le voci proprie di un cliente) ed e' NULL su
-- tutte le 176 righe: e' il vocabolario con cui si descrivono i posti, non chi li occupa —
-- `data-classes.ts` lo dichiara con parole proprie («la mansione e' un posto, non chi lo
-- occupa») e `gate.ts` lo tratta come catalogo (ADR-0039).
--
-- LA NEUTRALITA', misurata su information_schema e non dedotta dai nomi. Le dodici colonne
-- sono: job_role_id · _family_id · _code · _name · _description · _seniority_level · _metadata ·
-- created_at · created_by · updated_at · updated_by · _tenant_id. Nessuna e' il SOGGETTO di un
-- dato di persona; `created_by`/`updated_by` sono ATTORI (uuid opachi), la stessa distinzione
-- di `link_created_by` nella 000370: chi scrive la riga non e' chi la riga descrive.
--
-- ⚠ MA RESTANO DUE PORTE, le stesse della 000370 … 000407, e qui sono ENTRAMBE PIENE:
--   ① `job_role_metadata` e' JSONB — 136 righe su 176 non vuote. 111 portano venti chiavi
--      ereditate dal legacy (`salary_min`, `salary_max`, `salary_band_code`, `currency`,
--      `sap_stell`, `sap_persk`, `sap_stext`, `esco_occupation_code`, `source_reference`…),
--      TUTTE a `null` (misurato: 0 valori non nulli su ciascuna); 25 portano `source` e
--      `legacy_job_title` (un titolo di mansione, non un nome). Residuo, non sapere. ⚠ Le chiavi
--      retributive a null sono chiavi di un CATALOGO (la banda di un ruolo), non la retribuzione
--      di una persona: non cambiano la classe, ma la sentinella le vedra' il giorno in cui una
--      chiave nominasse una persona;
--   ② `job_role_description` e' TESTO LIBERO — POPOLATO su 89 righe su 176.
--
-- Misurato in produzione prima di aprire (2026-09-12): 176 ruoli · 89 con descrizione · 136 con
-- metadata non vuoto · 0 indirizzi di posta in nessuna delle due porte · 1 valore distinto di
-- tenant (NULL). Un perimetro neutro oggi non e' un perimetro neutro domani: la guardia si
-- mette PRIMA che il buco si apra.
--
-- La prova a esiti opposti e' quella della 000407: entrambe le porte iniettate e disfatte, e la
-- post-condizione guarda il CONTENUTO per impronta, non solo il conteggio — qui su 176 righe
-- piene, dove un ripristino sbagliato passerebbe un conteggio senza che nessuno se ne accorga.
--
-- Zero righe attese. Una riga qui significa che il perimetro NON e' piu' neutro: o si toglie
-- quel dato, o si chiude il perimetro. NON si allarga il pattern per far tacere la vista.

-- @migrate: once

BEGIN;

CREATE OR REPLACE VIEW sys.v_ruolo_con_dato_di_persona AS
-- ① la porta JSONB: una chiave che nomina una persona, o un valore che e' un indirizzo di
--    posta comunque si chiami la chiave. Stesso pattern di 000367 … 000407: se cambia li',
--    cambia qui.
SELECT r.job_role_id                        AS ruolo_id,
       'metadata'::text                     AS porta,
       kv.key                               AS dove,
       left(kv.value #>> '{}', 80)          AS valore
  FROM sys.sys_job_roles r
  CROSS JOIN LATERAL jsonb_each(coalesce(r.job_role_metadata, '{}'::jsonb)) AS kv
 WHERE kv.key ~* '(^|_)(user|users|person|persona|employee|dipendente|contact|contatto|referente|owner|manager|responsabile)(_|$)'
    OR kv.key ~* 'email|_user_id$'
    OR kv.value #>> '{}' ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
UNION ALL
-- ② la porta del TESTO LIBERO: si cerca cio' che si puo' riconoscere con certezza — un
--    indirizzo di posta — e non si finge di saper riconoscere un nome proprio.
SELECT r.job_role_id                        AS ruolo_id,
       'descrizione'::text                  AS porta,
       'job_role_description'::text         AS dove,
       left(r.job_role_description, 80)     AS valore
  FROM sys.sys_job_roles r
 WHERE r.job_role_description ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}';

COMMENT ON VIEW sys.v_ruolo_con_dato_di_persona IS
  'SENTINELLA (#214 F6, 2026-09-12). Zero righe attese. Il perimetro `job-roles` e'' aperto '
  'all''agente perche'' `sys_job_roles` e'' il catalogo delle mansioni — un posto, non chi lo '
  'occupa — senza colonne che siano il SOGGETTO di un dato di persona (created_by/updated_by '
  'sono attori). Ma porta DUE vie d''ingresso: `job_role_metadata` e'' JSONB (chiavi ereditate '
  'dal legacy, tutte a null, piu'' `legacy_job_title`) e `job_role_description` e'' testo libero '
  'popolato. Una riga qui significa che il perimetro non e'' piu'' neutro: o si toglie quel '
  'dato, o si chiude il perimetro. NON si allarga il pattern per far tacere la vista.';

DO $$
DECLARE
  n_persone     int;
  n_ruoli       int;
  n_dopo        int;
  r_id          uuid;
  descr_pre     text;
  impronta_pre  text;
  impronta_post text;
BEGIN
  -- 1. LO STATO DI PARTENZA: la sentinella dev'essere gia' a zero, o il perimetro non si apre.
  SELECT count(*) INTO n_persone FROM sys.v_ruolo_con_dato_di_persona;
  IF n_persone <> 0 THEN
    RAISE EXCEPTION
      '000408: la sentinella vede gia'' % righe con un dato di persona. Il perimetro NON si '
      'apre: prima si toglie quel dato.', n_persone;
  END IF;
  SELECT count(*) INTO n_ruoli FROM sys.sys_job_roles;

  -- L'IMPRONTA DI CIO' CHE NON DEVE CAMBIARE, presa PRIMA di toccare qualsiasi cosa.
  SELECT md5(string_agg(
           coalesce(job_role_description, '<null>') || '|' ||
           coalesce(job_role_metadata::text, '<null>'),
           E'\n' ORDER BY job_role_id))
    INTO impronta_pre
    FROM sys.sys_job_roles;

  -- 2. LA PROVA CHE LA GUARDIA PUO' FALLIRE, su ENTRAMBE le porte. Tutto dentro questa
  --    transazione: le righe di prova non esistono prima e non esistono dopo.
  IF n_ruoli = 0 THEN
    RAISE NOTICE
      '000408: `sys_job_roles` e'' vuota qui: la prova a esiti opposti non e'' eseguibile. '
      'NON e'' un verde: e'' un NON MISURATO, e la sentinella resta installata. Dove la '
      'tabella e'' popolata, la prova gira.';
  ELSE
    SELECT job_role_id, job_role_description INTO r_id, descr_pre
      FROM sys.sys_job_roles ORDER BY job_role_id LIMIT 1;

    -- ② prima il testo libero
    UPDATE sys.sys_job_roles
       SET job_role_description =
             coalesce(job_role_description, '') || ' __PROVA_000408__ mario.rossi@example.org'
     WHERE job_role_id = r_id;
    SELECT count(*) INTO n_persone
      FROM sys.v_ruolo_con_dato_di_persona WHERE porta = 'descrizione';
    IF n_persone = 0 THEN
      RAISE EXCEPTION
        '000408: la sentinella NON vede un indirizzo di posta iniettato in '
        '`job_role_description` — e'' cieca sul testo libero, e una guardia cieca e'' peggio '
        'di nessuna guardia';
    END IF;
    -- il ripristino rimette il valore SALVATO, non uno ricostruito: '' e NULL sono due
    -- valori diversi — l'impronta al passo 4 lo vedrebbe.
    UPDATE sys.sys_job_roles
       SET job_role_description = descr_pre
     WHERE job_role_id = r_id;

    -- ① poi il JSONB — per AGGIUNTA di una chiave, cosi' le chiavi ereditate restano dove
    --    sono e il ripristino le lascia intatte (l'impronta lo verifica).
    UPDATE sys.sys_job_roles
       SET job_role_metadata =
             coalesce(job_role_metadata, '{}'::jsonb)
             || '{"__prova_000408_referente": "mario.rossi@example.org"}'::jsonb
     WHERE job_role_id = r_id;
    SELECT count(*) INTO n_persone
      FROM sys.v_ruolo_con_dato_di_persona WHERE porta = 'metadata';
    IF n_persone = 0 THEN
      RAISE EXCEPTION
        '000408: la sentinella NON vede un referente iniettato in `job_role_metadata` — '
        'e'' cieca sul JSONB, e una guardia cieca e'' peggio di nessuna guardia';
    END IF;
    UPDATE sys.sys_job_roles
       SET job_role_metadata = job_role_metadata - '__prova_000408_referente'
     WHERE job_role_metadata ? '__prova_000408_referente';

    -- 3. …e dopo le due prove la sentinella e' tornata a zero: le iniezioni sono disfatte.
    SELECT count(*) INTO n_persone FROM sys.v_ruolo_con_dato_di_persona;
    IF n_persone <> 0 THEN
      RAISE EXCEPTION '000408: le prove hanno lasciato % righe: le iniezioni non sono state disfatte', n_persone;
    END IF;
  END IF;

  -- 4. POST-CONDIZIONE SU CIO' CHE NON DOVEVA CAMBIARE — conteggio E impronta.
  SELECT count(*) INTO n_dopo FROM sys.sys_job_roles;
  IF n_dopo <> n_ruoli THEN
    RAISE EXCEPTION '000408: i ruoli sono % invece di %: la prova ha toccato le righe vere',
      n_dopo, n_ruoli;
  END IF;

  SELECT md5(string_agg(
           coalesce(job_role_description, '<null>') || '|' ||
           coalesce(job_role_metadata::text, '<null>'),
           E'\n' ORDER BY job_role_id))
    INTO impronta_post
    FROM sys.sys_job_roles;
  IF impronta_post IS DISTINCT FROM impronta_pre THEN
    RAISE EXCEPTION
      '000408: le due porte NON sono tornate come prima (impronta % contro %): la prova ha '
      'alterato un contenuto vero invece di disfarsi', impronta_post, impronta_pre;
  END IF;

  RAISE NOTICE
    '000408: sentinella installata e provata su entrambe le porte · % ruoli invariati, '
    'contenuto identico per impronta.', n_ruoli;
END $$;

COMMIT;
