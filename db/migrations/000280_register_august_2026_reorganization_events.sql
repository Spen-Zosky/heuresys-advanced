-- ═══════════════════════════════════════════════════════════════════════════════
-- 000280_register_august_2026_reorganization_events.sql
--
-- #163 — LA RIORGANIZZAZIONE DI AGOSTO 2026 LASCIA TRACCIA.
--
-- IL FATTO. La ricostruzione dell'organigramma di RTL Bank (migrazioni 000244-000246,
-- commit 944b15f0 del 2026-08-04) ha rinominato 8 unita e ne ha spostate 12, e non ha
-- scritto un solo evento in `sys.sys_organization_unit_history`. L'organigramma di oggi
-- non e' spiegato dalla propria storia.
--
-- COME SI E' VISTO, E PERCHE' SI VEDEVA SOLO UN OTTAVO. Il check C6c della custodia
-- storia36 ha segnalato **una** unita: `DIR-COMPL`, il cui evento del 2025-03-01 dice
-- «-> Divisione Legal & Compliance» mentre l'unita oggi si chiama «Direzione Compliance
-- e Protezione Dati». C6c confronta l'ESITO DEGLI EVENTI ESISTENTI con il nome di oggi:
-- le altre 7 unita rinominate non avevano alcun evento, quindi non contraddicevano
-- nulla ed erano invisibili. Registrare solo `DIR-COMPL` — l'unica che faceva scattare
-- il controllo — avrebbe lasciato il difetto identico sulle altre sette, e muto.
--
-- LA DECISIONE (Enzo, 2026-08-07). «E' stata una riorganizzazione vera»: quindi si
-- allarga il modello ad ammettere piu' riordini e si registrano gli eventi. Regola
-- durevole dichiarata nella stessa decisione: *le riorganizzazioni sono sempre soggette
-- ad autorizzazione, ma quando autorizzate vanno implementate E REGISTRATE*. Non esiste
-- una riorganizzazione «di fatto» che non lasci traccia.
--
-- DA DOVE VENGONO I NOMI PRECEDENTI. Non sono ricostruiti a memoria ne' dedotti: stanno
-- nel blocco ROLLBACK della 000246 stessa (righe 230-239), che li dichiara per poterli
-- ripristinare. I nomi dei GENITORI si ricavano invece dal database per codice, non si
-- scrivono qui: `RTL`, `DG`, `DIV-RETAIL`, `DIV-RISK`, `AREA-MI`, `AREA-BSBG` non sono
-- state rinominate dalla 000246 (verificato sull'elenco delle rinomine), quindi il loro
-- nome di oggi e' anche quello di allora.
--
-- COSA NON REGISTRA, E PERCHE'. Il cambio di TIPO di `DIR-COMPL` (da divisione a
-- direzione) non diventa un evento: `organization_unit_history_change_type` ammette
-- CREATED/RENAMED/MOVED/MERGED/SPLIT/DEACTIVATED/REACTIVATED e nessun valore per il
-- cambio di tipo. Aggiungerne uno significa toccare un vincolo CHECK di dominio (RD-08),
-- che e' una decisione di modello e non un dettaglio di questa riparazione. Il fatto e'
-- raccontato nella nota dell'evento RENAMED della stessa unita.
--
-- Idempotente: ogni evento si inserisce solo se non esiste gia' per quella unita, quel
-- giorno e quel tipo. Rieseguirla scrive 0 righe.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $mig$
DECLARE
  c_rtl     constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  c_riordino constant date := DATE '2026-08-04';
  v_actor   uuid;
  v_ins     bigint;
  v_tot     bigint := 0;
BEGIN
  -- L'autore e' lo stesso che firma gli eventi del riordino 2025 (C6a(iii) pretende un
  -- utente del tenant): la persona che in questo organigramma sta al vertice.
  SELECT user_id INTO v_actor FROM sys.sys_users
   WHERE user_email = 'federica.marchetti@rtl-bank.org' AND user_tenant_id = c_rtl;
  IF v_actor IS NULL THEN
    RAISE EXCEPTION '000280: autore non trovato — la riorganizzazione non puo'' restare senza firma';
  END IF;

  -- ── A. LE OTTO RINOMINE ─────────────────────────────────────────────────────────
  WITH r(codice, prima, nota) AS (VALUES
    ('DIV-CRED',    'Divisione Commercial Banking',
     'Il nome dice il mestiere: la divisione governa il credito, non un generico «commercial banking».'),
    ('DIR-CREDITI', 'Direzione Crediti',
     'Si distingue dalla divisione che la contiene: qui si istruisce ed eroga, non si governa il credito nel suo insieme.'),
    ('DIV-CFO',     'Divisione CFO',
     'Il nome diceva chi la dirige, non cosa fa: diventa Finanza e Amministrazione.'),
    ('DIV-HR',      'Divisione Human Resources',
     'Assume anche il presidio organizzativo, e lo dichiara nel nome.'),
    ('DIV-MKT',     'Divisione Marketing',
     'Estende il perimetro alla comunicazione istituzionale.'),
    ('DIR-AML',     'Direzione AML/Antiriciclaggio',
     'Cade la sigla: il nome e'' in chiaro come per tutte le altre unita.'),
    ('DIR-DEV',     'Direzione Sviluppo Software',
     'Prende in carico anche i canali digitali, e lo dichiara nel nome.'),
    ('DIR-COMPL',   'Divisione Legal & Compliance',
     'Cambia natura oltre che nome: da divisione di linea a direzione di presidio su conformita'' e protezione dei dati.')
  )
  INSERT INTO sys.sys_organization_unit_history (
    organization_unit_history_unit_id, organization_unit_history_tenant_id,
    organization_unit_history_change_type, organization_unit_history_old_value,
    organization_unit_history_new_value, organization_unit_history_effective_at,
    organization_unit_history_actor_user_id, organization_unit_history_notes)
  SELECT o.organization_unit_id, c_rtl, 'RENAMED',
         jsonb_build_object('name', r.prima),
         jsonb_build_object('name', o.organization_unit_name),
         c_riordino::timestamptz, v_actor, r.nota
    FROM r
    JOIN sys.sys_organization_units o
      ON o.organization_unit_code = r.codice AND o.organization_unit_tenant_id = c_rtl
   WHERE o.organization_unit_name <> r.prima            -- se il nome non e' cambiato non c'e' evento (C6a(iv))
     AND NOT EXISTS (SELECT 1 FROM sys.sys_organization_unit_history h
                      WHERE h.organization_unit_history_unit_id = o.organization_unit_id
                        AND h.organization_unit_history_change_type = 'RENAMED'
                        AND h.organization_unit_history_effective_at::date = c_riordino);
  GET DIAGNOSTICS v_ins = ROW_COUNT; v_tot := v_tot + v_ins;
  RAISE NOTICE '000280: rinomine registrate: %', v_ins;

  -- ── B. I DODICI SPOSTAMENTI ─────────────────────────────────────────────────────
  -- I nomi dei genitori si leggono dal database per codice: non si scrivono qui.
  WITH m(codice, padre_prima, padre_dopo, nota) AS (VALUES
    ('DIV-RETAIL','RTL','DG','Le divisioni operative acquistano un punto di coordinamento: prima pendevano tutte direttamente dalla societa.'),
    ('DIV-CRED',  'RTL','DG','Le divisioni operative acquistano un punto di coordinamento: prima pendevano tutte direttamente dalla societa.'),
    ('DIV-OPS',   'RTL','DG','Le divisioni operative acquistano un punto di coordinamento: prima pendevano tutte direttamente dalla societa.'),
    ('DIV-IT',    'RTL','DG','Le divisioni operative acquistano un punto di coordinamento: prima pendevano tutte direttamente dalla societa.'),
    ('DIV-CFO',   'RTL','DG','Le divisioni operative acquistano un punto di coordinamento: prima pendevano tutte direttamente dalla societa.'),
    ('DIV-HR',    'RTL','DG','Le divisioni operative acquistano un punto di coordinamento: prima pendevano tutte direttamente dalla societa.'),
    ('DIV-MKT',   'RTL','DG','Le divisioni operative acquistano un punto di coordinamento: prima pendevano tutte direttamente dalla societa.'),
    ('FIL-MI-CEN','DIV-RETAIL','AREA-MI','Nasce il livello territoriale: la filiale non pende piu'' direttamente dalla divisione.'),
    ('FIL-BS-CEN','DIV-RETAIL','AREA-BSBG','Nasce il livello territoriale: la filiale non pende piu'' direttamente dalla divisione.'),
    ('FIL-BG-CEN','DIV-RETAIL','AREA-BSBG','Nasce il livello territoriale: la filiale non pende piu'' direttamente dalla divisione.'),
    ('DIR-RISKM', 'DIV-RISK','RTL','Il controllo esce dalla linea che controlla ed entra in staff al vertice.'),
    ('DIR-AML',   'DIV-RISK','RTL','Il controllo esce dalla linea che controlla ed entra in staff al vertice.')
  )
  INSERT INTO sys.sys_organization_unit_history (
    organization_unit_history_unit_id, organization_unit_history_tenant_id,
    organization_unit_history_change_type, organization_unit_history_old_value,
    organization_unit_history_new_value, organization_unit_history_effective_at,
    organization_unit_history_actor_user_id, organization_unit_history_notes)
  SELECT o.organization_unit_id, c_rtl, 'MOVED',
         jsonb_build_object('parent_name', pp.organization_unit_name),
         jsonb_build_object('parent_name', pd.organization_unit_name),
         c_riordino::timestamptz, v_actor, m.nota
    FROM m
    JOIN sys.sys_organization_units o  ON o.organization_unit_code  = m.codice      AND o.organization_unit_tenant_id  = c_rtl
    JOIN sys.sys_organization_units pp ON pp.organization_unit_code = m.padre_prima AND pp.organization_unit_tenant_id = c_rtl
    JOIN sys.sys_organization_units pd ON pd.organization_unit_code = m.padre_dopo  AND pd.organization_unit_tenant_id = c_rtl
   WHERE pp.organization_unit_id <> pd.organization_unit_id     -- C6a(iv): un non-cambiamento non e' storia
     AND o.organization_unit_parent_id = pd.organization_unit_id -- C6c(ii): l'esito deve essere dove l'unita sta OGGI
     AND NOT EXISTS (SELECT 1 FROM sys.sys_organization_unit_history h
                      WHERE h.organization_unit_history_unit_id = o.organization_unit_id
                        AND h.organization_unit_history_change_type = 'MOVED'
                        AND h.organization_unit_history_effective_at::date = c_riordino);
  GET DIAGNOSTICS v_ins = ROW_COUNT; v_tot := v_tot + v_ins;
  RAISE NOTICE '000280: spostamenti registrati: %', v_ins;

  -- ── POST-CONDIZIONE ─────────────────────────────────────────────────────────────
  -- Non si verifica «ho inserito N righe» (rieseguendo sarebbe 0 e fallirebbe), ma lo
  -- STATO: dopo questa migrazione nessuna unita rinominata puo' avere come ultimo esito
  -- un nome che non porta piu'. E' la proprieta' che C6c misura, asserita qui.
  SELECT count(*) INTO v_ins
    FROM (SELECT DISTINCT ON (h.organization_unit_history_unit_id)
                 h.organization_unit_history_unit_id AS uid,
                 h.organization_unit_history_new_value ->> 'name' AS esito
            FROM sys.sys_organization_unit_history h
           WHERE h.organization_unit_history_tenant_id = c_rtl
             AND h.organization_unit_history_change_type IN ('RENAMED','MERGED','CREATED')
           ORDER BY h.organization_unit_history_unit_id,
                    h.organization_unit_history_effective_at DESC) u
    JOIN sys.sys_organization_units o ON o.organization_unit_id = u.uid
   WHERE u.esito IS NOT NULL AND u.esito <> o.organization_unit_name;
  IF v_ins > 0 THEN
    RAISE EXCEPTION '000280: % unita hanno ancora un esito di storia diverso dal nome di oggi', v_ins;
  END IF;

  RAISE NOTICE '000280 done: % eventi registrati in questa esecuzione; la riorganizzazione del % ha lasciato traccia', v_tot, c_riordino;
END $mig$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════════
-- BEGIN;
--   DELETE FROM sys.sys_organization_unit_history
--    WHERE organization_unit_history_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
--      AND organization_unit_history_effective_at::date = DATE '2026-08-04';
-- COMMIT;
-- (riporta la storia ai soli 6 eventi del riordino 2025-03-01)
