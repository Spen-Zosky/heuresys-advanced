/**
 * apps/api/test/helpers/org-actors.ts — chi è sottoposto e chi è estraneo, derivato dal vivo.
 *
 * Perché esiste
 * -------------
 * I test dell'asse organizzativo (ADR-0027) devono dire «questo capo vede il suo
 * sottoposto e NON vede un estraneo». Finora quei tre ruoli erano tre indirizzi email
 * scritti a mano nei singoli file — `paolo.caputo` capo, `tommaso.fiore` sottoposto,
 * `antonio.parisi` estraneo. Ha funzionato finché l'organigramma è rimasto fermo.
 *
 * La ricostruzione dell'organigramma (S1043, mig 000244→000258) ha **invertito due di
 * quei ruoli**: `tommaso.fiore` oggi dirige la Filiale di Varese, in un altro ramo, e
 * `antonio.parisi` è Analista Crediti nell'Ufficio Crediti Retail — che sta DENTRO la
 * Divisione Crediti diretta da `paolo.caputo`. Nessuno dei due era un difetto: erano
 * ruoli fissati a mano che l'azienda ha cambiato. Otto file di test sono diventati
 * rossi tutti insieme, e nessuno di loro stava misurando un problema vero.
 *
 * Come si deriva, e perché NON è tautologico
 * ------------------------------------------
 * L'atteso si legge dall'albero delle **unità organizzative** (`organization_unit_parent_id`
 * + `organization_unit_manager_user_id`), che è una struttura **indipendente** da quella
 * che il resolver percorre (l'albero delle **posizioni**, via `position_reports_to_position_id`).
 *
 * Se derivassimo l'estraneo interrogando il resolver, il test chiederebbe al resolver di
 * confermare sé stesso e non potrebbe fallire. Derivandolo dall'organigramma, il test
 * chiede alle due strutture di CONCORDARE — ed è un confronto che può cadere davvero:
 * prima della mig 000258 quelle due strutture divergevano su 30 persone su 38.
 *
 * Regola di progetto applicata: mai dati fissi nei test che duplicano una fonte di
 * verità — l'atteso si deriva dalla fonte reale.
 *
 * [S1045] TRE PROPRIETÀ CHE ERANO VERE PER FORTUNA, ORA LO SONO PER COSTRUZIONE
 * -----------------------------------------------------------------------------
 * 1. **Stesso tenant.** L'estraneo non era vincolato al tenant del manager. Ordinando
 *    per email e prendendo il primo, una persona di un altro tenant sarebbe stata scelta
 *    senza che nulla lo segnalasse — e il test avrebbe misurato l'isolamento fra TENANT
 *    (I5) credendo di misurare quello fra PARI (I19). Due invarianti diversi, stesso
 *    verde ingannevole.
 * 2. **Senza mandato.** Decine di test attribuiscono all'estraneo e al sottoposto un 403
 *    da «utente semplice». Quella è una proprietà da cui il test DIPENDE, quindi va
 *    derivata: se domani la persona scelta avesse un ruolo manageriale o un mandato HR,
 *    il test cadrebbe per una ragione che non stava misurando. I ruoli non sono
 *    ricopiati qui: si importano da `resolver.ts`, che è la loro fonte.
 * 3. **Universo vuoto = errore, non verifica cieca.** Ogni funzione lancia se la
 *    caratteristica non esiste più. Una verifica che non ha niente da guardare non deve
 *    poter essere contata fra quelle superate.
 */

import type { Pool } from "pg";
import { MANAGERIAL_ROLES, HR_MANDATED_ROLES } from "../../src/lib/scope/resolver.js";

/** Chi recita nel test: serve l'id per le asserzioni sui perimetri e l'indirizzo per
 *  i test che fanno login davvero. */
export interface Attore { userId: string; email: string }

/**
 * I ruoli che portano una lettura oltre se stessi. NON è una lista scritta qui: è
 * l'unione delle due costanti del resolver più `PLATFORM_ADMIN`, che è cross-tenant e
 * il resolver tratta a parte. Se domani un ruolo entra o esce da quelle costanti,
 * questi helper seguono senza che nessuno se ne ricordi.
 */
const RUOLI_CON_MANDATO: string[] = [...MANAGERIAL_ROLES, ...HR_MANDATED_ROLES, "PLATFORM_ADMIN"];

/** Solo persone che possono AUTENTICARSI: alcuni test entrano davvero con queste
 *  credenziali, e un attore senza identita' farebbe fallire il login invece della
 *  regola che si voleva misurare. */
const PUO_ENTRARE = `
  AND EXISTS (SELECT 1 FROM sys.sys_auth_identities i
               JOIN sys.sys_auth_credentials c ON c.auth_credential_identity_id = i.auth_identity_id
              WHERE i.auth_identity_user_id = u.user_id AND i.auth_identity_is_active)
  AND EXISTS (SELECT 1 FROM sys.sys_auth_mfa_factors f
               WHERE f.auth_mfa_factor_user_id = u.user_id)`;

/**
 * Nessun mandato di lettura oltre se stessi: né un ruolo fra quelli del resolver, né
 * la responsabilita' di un'unita' organizzativa (che per `isManagerial` vale quanto un
 * ruolo). `$2` e' l'elenco dei ruoli, passato, non cablato.
 */
const SENZA_MANDATO = `
  AND NOT EXISTS (SELECT 1 FROM sys.sys_user_auth_roles ur
                    JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
                   WHERE ur.user_auth_role_user_id = u.user_id
                     AND ur.user_auth_role_revoked_at IS NULL
                     AND r.auth_role_code = ANY($2::text[]))
  AND NOT EXISTS (SELECT 1 FROM sys.sys_organization_units ou
                   WHERE ou.organization_unit_manager_user_id = u.user_id
                     AND ou.organization_unit_is_active)`;

/** Stesso tenant del manager: senza questo si proverebbe I5 al posto di I19. */
const STESSO_TENANT = `
  AND u.user_tenant_id = (SELECT user_tenant_id FROM sys.sys_users WHERE user_id = $1)`;

/** Le unità dirette da `manager`, più tutte le loro discendenti attive. */
const SUE_UNITA = `
  WITH RECURSIVE sue(unita) AS (
    SELECT organization_unit_id FROM sys.sys_organization_units
     WHERE organization_unit_manager_user_id = $1 AND organization_unit_is_active
    UNION
    SELECT o.organization_unit_id FROM sys.sys_organization_units o
      JOIN sue ON o.organization_unit_parent_id = sue.unita
     WHERE o.organization_unit_is_active)`;

/**
 * Una persona che, secondo l'ALBERO DELLE UNITÀ, lavora dentro l'unità diretta da
 * `manager` (o in una sua discendente), non è il manager stesso e non ha alcun
 * mandato proprio.
 *
 * Lancia se non ne esiste nessuna: un universo vuoto renderebbe cieca la verifica che
 * lo usa, e una verifica cieca va dichiarata, non contata fra quelle superate.
 */
export async function unSottopostoOrganizzativo(pool: Pool, manager: string): Promise<Attore> {
  const r = await pool.query<Attore>(
    `${SUE_UNITA}
     SELECT u.user_id AS "userId", u.user_email AS email
       FROM sue
       JOIN sys.sys_positions p ON p.position_organization_unit_id = sue.unita
       JOIN sys.sys_user_position_assignments a
         ON a.user_position_assignment_position_id = p.position_id
        AND a.user_position_assignment_status = 'ACTIVE'
       JOIN sys.sys_users u ON u.user_id = a.user_position_assignment_user_id
      WHERE u.user_id <> $1 ${STESSO_TENANT} ${PUO_ENTRARE} ${SENZA_MANDATO}
      ORDER BY u.user_email
      LIMIT 1`,
    [manager, RUOLI_CON_MANDATO],
  );
  const a = r.rows[0];
  if (!a) throw new Error(`nessun sottoposto organizzativo senza mandato per ${manager}: verifica cieca`);
  return a;
}

/**
 * Una persona che, secondo l'ALBERO DELLE UNITÀ, NON lavora sotto `manager` — stesso
 * tenant, nessun mandato proprio. È l'«estraneo» delle verifiche di isolamento fra
 * pari (I19).
 */
export async function unEstraneoOrganizzativo(pool: Pool, manager: string): Promise<Attore> {
  const r = await pool.query<Attore>(
    `${SUE_UNITA}
     SELECT u.user_id AS "userId", u.user_email AS email
       FROM sys.sys_user_position_assignments a
       JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
       JOIN sys.sys_users u ON u.user_id = a.user_position_assignment_user_id
      WHERE a.user_position_assignment_status = 'ACTIVE'
        AND u.user_id <> $1
        AND p.position_organization_unit_id NOT IN (SELECT unita FROM sue)
        ${STESSO_TENANT} ${PUO_ENTRARE} ${SENZA_MANDATO}
      ORDER BY u.user_email
      LIMIT 1`,
    [manager, RUOLI_CON_MANDATO],
  );
  const a = r.rows[0];
  if (!a) throw new Error(`nessun estraneo organizzativo senza mandato per ${manager}: verifica cieca`);
  return a;
}

/**
 * Un estraneo a ENTRAMBI gli assi: fuori dall'albero delle unità di `manager` **e**
 * fuori dalle sue squadre e dai suoi processi.
 *
 * Serve al test dell'asse funzionale (F4), dove la domanda è «l'appartenenza a un
 * processo estende lo scope funzionale?»: se la persona scelta fosse già dentro una
 * squadra del manager, la risposta sarebbe sì prima ancora della fixture e il test non
 * misurerebbe nulla. Le due esclusioni sono separate perché gli assi lo sono (ADR-0027).
 */
export async function unEstraneoAEntrambiGliAssi(pool: Pool, manager: string): Promise<Attore> {
  const r = await pool.query<Attore>(
    `${SUE_UNITA}
     SELECT u.user_id AS "userId", u.user_email AS email
       FROM sys.sys_user_position_assignments a
       JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
       JOIN sys.sys_users u ON u.user_id = a.user_position_assignment_user_id
      WHERE a.user_position_assignment_status = 'ACTIVE'
        AND u.user_id <> $1
        AND p.position_organization_unit_id NOT IN (SELECT unita FROM sue)
        -- fuori dalle squadre guidate dal manager (asse funzionale, metà squadre)
        AND NOT EXISTS (
          SELECT 1 FROM sys.sys_teams t
            JOIN sys.sys_team_members m ON m.team_member_team_id = t.team_id
           WHERE t.team_lead_user_id = $1 AND t.team_is_active
             AND m.team_member_user_id = u.user_id)
        -- e fuori dai processi in cui il manager è partecipante (metà processi)
        AND NOT EXISTS (
          SELECT 1 FROM sys.sys_process_participants pp1
            JOIN sys.sys_process_participants pp2
              ON pp2.process_participant_org_unit_process_id = pp1.process_participant_org_unit_process_id
           WHERE pp1.process_participant_user_id = $1
             AND pp2.process_participant_user_id = u.user_id)
        -- e non è a sua volta un capo funzionale: il test gli chiede uno scope pari
        -- a «solo se stesso», e chi guida una squadra o possiede un processo ne ha
        -- uno più largo. Le tre condizioni sono quelle di isFunctionalLeader.
        AND NOT EXISTS (SELECT 1 FROM sys.sys_teams t
                         WHERE t.team_is_active AND t.team_lead_user_id = u.user_id)
        AND NOT EXISTS (SELECT 1 FROM sys.sys_team_members tm
                         WHERE tm.team_member_user_id = u.user_id
                           AND tm.team_member_role = 'LEAD' AND tm.team_member_is_active)
        AND NOT EXISTS (SELECT 1 FROM sys.sys_process_participants pp
                         WHERE pp.process_participant_user_id = u.user_id
                           AND pp.process_participant_role = 'OWNER'
                           AND pp.process_participant_is_active)
        ${STESSO_TENANT} ${PUO_ENTRARE} ${SENZA_MANDATO}
      ORDER BY u.user_email
      LIMIT 1`,
    [manager, RUOLI_CON_MANDATO],
  );
  const a = r.rows[0];
  if (!a) throw new Error(`nessun estraneo a entrambi gli assi per ${manager}: verifica cieca`);
  return a;
}

/**
 * Due responsabili PARI: stesso tenant, sotto-alberi **delle unità** disgiunti, ciascuno
 * con più di una persona sotto di sé.
 *
 * La coppia si sceglie sull'albero delle UNITÀ; il test che la usa asserisce la
 * disgiunzione sull'albero delle POSIZIONI. Sono due strutture diverse, quindi
 * l'asserzione può cadere davvero — ed è caduta: la coppia fissa `paolo.caputo` /
 * `claudia.serra`, disgiunta quando il test fu scritto, oggi non lo è più (claudia è
 * finita dentro il sotto-albero di paolo, intersezione 10 persone).
 */
export async function duePariOrganizzativi(pool: Pool): Promise<{ a: Attore; b: Attore }> {
  const r = await pool.query<{
    a_id: string; a_email: string; b_id: string; b_email: string;
  }>(
    `WITH RECURSIVE sue(radice, unita) AS (
       SELECT ou.organization_unit_manager_user_id, ou.organization_unit_id
         FROM sys.sys_organization_units ou
        WHERE ou.organization_unit_manager_user_id IS NOT NULL AND ou.organization_unit_is_active
       UNION
       SELECT s.radice, o.organization_unit_id
         FROM sys.sys_organization_units o JOIN sue s ON o.organization_unit_parent_id = s.unita
        WHERE o.organization_unit_is_active
     ),
     membri AS (
       SELECT DISTINCT s.radice, a.user_position_assignment_user_id AS membro
         FROM sue s
         JOIN sys.sys_positions p ON p.position_organization_unit_id = s.unita
         JOIN sys.sys_user_position_assignments a
           ON a.user_position_assignment_position_id = p.position_id
          AND a.user_position_assignment_status = 'ACTIVE'
     ),
     dim AS (SELECT radice, count(*) AS n FROM membri GROUP BY 1 HAVING count(*) > 1)
     SELECT ua.user_id AS a_id, ua.user_email AS a_email,
            ub.user_id AS b_id, ub.user_email AS b_email
       FROM dim da
       JOIN dim db ON da.radice < db.radice
       JOIN sys.sys_users ua ON ua.user_id = da.radice AND ua.user_status = 'ACTIVE'
       JOIN sys.sys_users ub ON ub.user_id = db.radice AND ub.user_status = 'ACTIVE'
      WHERE ua.user_tenant_id = ub.user_tenant_id
        AND NOT EXISTS (SELECT 1 FROM membri x JOIN membri y ON x.membro = y.membro
                         WHERE x.radice = da.radice AND y.radice = db.radice)
      ORDER BY (da.n + db.n) DESC, ua.user_email, ub.user_email
      LIMIT 1`,
  );
  const p = r.rows[0];
  if (!p) throw new Error("nessuna coppia di responsabili pari con sotto-alberi disgiunti: verifica cieca");
  return {
    a: { userId: p.a_id, email: p.a_email },
    b: { userId: p.b_id, email: p.b_email },
  };
}

/**
 * Dà a `capo` un riporto NUOVO, creato apposta, e lo restituisce.
 *
 * PERCHE' SI PREPARA INVECE DI CERCARLO
 * -------------------------------------
 * Il vincolo F1 di ADR-0027 dice che il sotto-albero spetta solo a chi ha un ruolo
 * manageriale esplicito: chi ha dei riporti nell'organigramma ma nessun mandato vede
 * SOLO se stesso. Per provarlo serve esattamente quel profilo — non manageriale, ma
 * con riporti — e dopo la ricostruzione dell'organigramma nel dato reale **non esiste
 * piu' nessuno cosi'**: misurato, zero persone su 163. Chiunque abbia riporti oggi e'
 * MANAGER/CEO oppure responsabile di un'unita'.
 *
 * Cercarne uno «gia' cosi'» e' precisamente l'errore costato caro in S1032 con i
 * fattori MFA, e la lezione e' scritta in `helpers/actors.ts`: quando la popolazione
 * non offre piu' il caso, il caso si PREPARA. Qui si crea una posizione subordinata a
 * quella di `capo` e una persona che la occupa. L'isolamento transazionale (D-52)
 * annulla tutto a fine file: il database condiviso non se ne accorge.
 *
 * Se invece si lasciasse cadere il test, si smetterebbe di sorvegliare un vincolo che
 * vale ancora — ed e' il vincolo che impedisce a un impiegato con dei sottoposti sulla
 * carta di leggerne i dati sensibili.
 */
export async function preparaUnRiportoSotto(pool: Pool, capo: string): Promise<Attore> {
  const posizione = await pool.query<{ id: string; tenant: string; unita: string | null }>(
    `SELECT p.position_id AS id, p.position_tenant_id AS tenant,
            p.position_organization_unit_id AS unita
       FROM sys.sys_user_position_assignments a
       JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
      WHERE a.user_position_assignment_user_id = $1
        AND a.user_position_assignment_status = 'ACTIVE'
      ORDER BY p.position_code
      LIMIT 1`,
    [capo],
  );
  const pos = posizione.rows[0];
  if (!pos) throw new Error(`${capo} non occupa alcuna posizione attiva: non gli si puo' dare un riporto`);

  // Suffisso dal `capo`, non casuale: due esecuzioni nello stesso file danno lo stesso
  // risultato, e un residuo (che non ci sara', per D-52) si riconosce a colpo d'occhio.
  const marchio = `IT_F1_${capo.slice(0, 8).toUpperCase()}`;

  const nuovaPos = await pool.query<{ id: string }>(
    `INSERT INTO sys.sys_positions
       (position_tenant_id, position_code, position_title,
        position_organization_unit_id, position_reports_to_position_id, position_metadata)
     VALUES ($1, $2, 'Riporto di prova (fixture F1)', $3, $4, jsonb_build_object('fixture', $5::text))
     RETURNING position_id AS id`,
    [pos.tenant, `${marchio}-POS`, pos.unita, pos.id, marchio],
  );
  const posId = nuovaPos.rows[0]!.id;

  const nuovoUtente = await pool.query<Attore>(
    `INSERT INTO sys.sys_users
       (user_tenant_id, user_email, user_display_name, user_status, user_metadata)
     VALUES ($1, $2, 'Riporto di prova (fixture F1)', 'ACTIVE', jsonb_build_object('fixture', $3::text))
     RETURNING user_id AS "userId", user_email AS email`,
    [pos.tenant, `${marchio.toLowerCase()}@fixture.invalid`, marchio],
  );
  const utente = nuovoUtente.rows[0]!;

  await pool.query(
    `INSERT INTO sys.sys_user_position_assignments
       (user_position_assignment_tenant_id, user_position_assignment_user_id,
        user_position_assignment_position_id, user_position_assignment_kind,
        user_position_assignment_start_date, user_position_assignment_status)
     VALUES ($1, $2, $3, 'PRIMARY', CURRENT_DATE, 'ACTIVE')`,
    [pos.tenant, utente.userId, posId],
  );

  return utente;
}

/**
 * Un MANAGER che possiede almeno una posizione ATTIVA.
 *
 * Il cruscotto costruisce lo scope TEAM da `position_owner_user_id` sulle posizioni
 * attive (I1: il proprietario non e' il titolare). Dopo la ricostruzione
 * dell'organigramma la proprieta' e' finita in larga parte su posizioni disattivate —
 * misurato: 161 posizioni attive con 11 proprietari, 153 inattive con 27 — e
 * `paolo.caputo`, il manager nominato nel test, ne possiede 5 tutte INATTIVE. Il suo
 * cruscotto e' legittimamente vuoto, quindi il test non stava piu' misurando lo scope
 * TEAM: misurava un caso limite senza dirlo.
 */
export async function unManagerConPosizioniAttive(pool: Pool): Promise<Attore> {
  const r = await pool.query<Attore>(
    `SELECT DISTINCT u.user_id AS "userId", u.user_email AS email
       FROM sys.sys_positions p
       JOIN sys.sys_users u ON u.user_id = p.position_owner_user_id
       JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = u.user_id
        AND ur.user_auth_role_revoked_at IS NULL
       JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
      WHERE p.position_is_active
        AND r.auth_role_code = 'MANAGER'
        AND u.user_status = 'ACTIVE'
        -- niente mandato HR/piattaforma: quelli non risolvono a TEAM ma a tenant o
        -- cross-tenant, e il test vuole proprio lo scope di squadra.
        AND NOT EXISTS (SELECT 1 FROM sys.sys_user_auth_roles u2
                          JOIN sys.sys_auth_roles r2 ON r2.auth_role_id = u2.user_auth_role_role_id
                         WHERE u2.user_auth_role_user_id = u.user_id
                           AND u2.user_auth_role_revoked_at IS NULL
                           AND r2.auth_role_code = ANY($1::text[]))
        ${PUO_ENTRARE}
      ORDER BY u.user_email
      LIMIT 1`,
    [[...HR_MANDATED_ROLES, "PLATFORM_ADMIN", "CEO"]],
  );
  const a = r.rows[0];
  if (!a) {
    throw new Error(
      "nessun MANAGER possiede una posizione attiva: lo scope TEAM del cruscotto non e' " +
        "verificabile su questo dato — indagare la proprieta' delle posizioni, non adeguare il test",
    );
  }
  return a;
}

/**
 * IL CAPO delle verifiche di scope: un MANAGER che, secondo l'albero delle UNITÀ,
 * ha davvero almeno un sottoposto senza mandato proprio.
 *
 * Perché non basta `unManagerConPosizioniAttive` (#147, S1056). Quella garantisce che
 * il manager POSSIEDA una posizione attiva — che è ciò che serve allo scope TEAM del
 * cruscotto. Le verifiche di scope organizzativo chiedono un'altra cosa: che esista
 * qualcuno DENTRO la sua unità da leggere. Sono due caratteristiche diverse, e darle
 * per equivalenti è come dare per scontato un nome: la stessa classe di difetto.
 *
 * La condizione si verifica QUI, non si spera: il candidato è scelto solo se
 * l'universo dei suoi sottoposti — con gli stessi identici criteri di
 * `unSottopostoOrganizzativo` — non è vuoto. Così una verifica non può nascere cieca.
 *
 * Deterministico (`ORDER BY email LIMIT 1`): due chiamate nello stesso file
 * restituiscono la stessa persona, altrimenti il sottoposto e l'estraneo verrebbero
 * calcolati rispetto a due capi diversi.
 *
 * Lancia con un messaggio che dice cosa manca, invece di lasciar fallire il login.
 */
export async function unCapoConSottoposti(pool: Pool): Promise<Attore> {
  const r = await pool.query<Attore>(
    `SELECT u.user_id AS "userId", u.user_email AS email
       FROM sys.sys_users u
       JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = u.user_id
        AND ur.user_auth_role_revoked_at IS NULL
       JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
      WHERE r.auth_role_code = 'MANAGER'
        AND u.user_status = 'ACTIVE'
        -- Niente mandato HR o di piattaforma: quelli leggono per tenant o
        -- cross-tenant, quindi non proverebbero l'asse ORGANIZZATIVO ma un altro.
        --
        -- $2, NON $1. I due elenchi sono diversi e confonderli svuota la query per
        -- costruzione: RUOLI_CON_MANDATO contiene anche MANAGER, quindi usarlo qui
        -- chiederebbe un manager che non e' un manager. E' successo scrivendo questa
        -- funzione, e l'ha detto la sua stessa guardia invece di restituire la
        -- persona sbagliata in silenzio.
        -- (Nessun apice inverso in questo commento: sta DENTRO un template literal,
        --  e uno solo di essi chiuderebbe la stringa. E' successo anche questo.)
        AND NOT EXISTS (SELECT 1 FROM sys.sys_user_auth_roles u2
                          JOIN sys.sys_auth_roles r2 ON r2.auth_role_id = u2.user_auth_role_role_id
                         WHERE u2.user_auth_role_user_id = u.user_id
                           AND u2.user_auth_role_revoked_at IS NULL
                           AND r2.auth_role_code = ANY($2::text[]))
        ${PUO_ENTRARE}
        -- LA CONDIZIONE CHE CONTA: esiste almeno un sottoposto, con gli stessi
        -- criteri di unSottopostoOrganizzativo. Senza, il test nascerebbe cieco.
        AND EXISTS (
          WITH RECURSIVE sue(unita) AS (
            SELECT organization_unit_id FROM sys.sys_organization_units
             WHERE organization_unit_manager_user_id = u.user_id AND organization_unit_is_active
            UNION
            SELECT o.organization_unit_id FROM sys.sys_organization_units o
              JOIN sue ON o.organization_unit_parent_id = sue.unita
             WHERE o.organization_unit_is_active)
          SELECT 1
            FROM sue
            JOIN sys.sys_positions p ON p.position_organization_unit_id = sue.unita
            JOIN sys.sys_user_position_assignments a
              ON a.user_position_assignment_position_id = p.position_id
             AND a.user_position_assignment_status = 'ACTIVE'
            JOIN sys.sys_users s ON s.user_id = a.user_position_assignment_user_id
           WHERE s.user_id <> u.user_id
             AND s.user_tenant_id = u.user_tenant_id
             AND NOT EXISTS (SELECT 1 FROM sys.sys_user_auth_roles s2
                               JOIN sys.sys_auth_roles sr ON sr.auth_role_id = s2.user_auth_role_role_id
                              WHERE s2.user_auth_role_user_id = s.user_id
                                AND s2.user_auth_role_revoked_at IS NULL
                                AND sr.auth_role_code = ANY($1::text[]))
             AND NOT EXISTS (SELECT 1 FROM sys.sys_organization_units so
                              WHERE so.organization_unit_manager_user_id = s.user_id
                                AND so.organization_unit_is_active))
      ORDER BY u.user_email
      LIMIT 1`,
    [RUOLI_CON_MANDATO, [...HR_MANDATED_ROLES, "PLATFORM_ADMIN", "CEO"]],
  );
  const a = r.rows[0];
  if (!a) {
    throw new Error(
      "nessun MANAGER dirige un'unita' con almeno un sottoposto senza mandato: le verifiche " +
        "di scope organizzativo non sono misurabili su questo dato — indagare l'albero delle " +
        "unita' (organization_unit_manager_user_id), non adeguare il test",
    );
  }
  return a;
}

/** L'id di una persona dal suo indirizzo. Lancia se non esiste: una fixture assente
 *  deve fermare il test, non farlo passare su `undefined`. */
export async function idDi(pool: Pool, email: string): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `SELECT user_id AS id FROM sys.sys_users WHERE user_email = $1`,
    [email],
  );
  const id = r.rows[0]?.id;
  if (!id) throw new Error(`persona non trovata: ${email}`);
  return id;
}

/* ── L'ALTRO ASSE: le squadre ──────────────────────────────────────────────────
 * ADR-0027 tiene due assi ORTOGONALI: quello gerarchico (unità) e quello
 * funzionale (squadre, processi). Le approvazioni vivono sul secondo, quindi per
 * quei test «dentro» e «fuori» si misurano sull'appartenenza a una SQUADRA, non
 * sull'organigramma. Usare l'asse sbagliato produce un test che passa o fallisce
 * per la ragione sbagliata — e' successo applicando, ed e' il motivo di queste
 * due funzioni separate invece di un solo paio riusato ovunque.
 */

/** Una persona che appartiene a una squadra guidata da `leader`. */
export async function unMembroDiSquadra(pool: Pool, leader: string): Promise<Attore> {
  const r = await pool.query<Attore>(
    `SELECT u.user_id AS "userId", u.user_email AS email
       FROM sys.sys_teams t
       JOIN sys.sys_team_members m ON m.team_member_team_id = t.team_id
       JOIN sys.sys_users u ON u.user_id = m.team_member_user_id
      WHERE t.team_lead_user_id = $1 AND t.team_is_active AND u.user_id <> $1
      ORDER BY u.user_email
      LIMIT 1`,
    [leader],
  );
  const a = r.rows[0];
  if (!a) throw new Error(`nessun membro nelle squadre di ${leader}: verifica cieca`);
  return a;
}

/** Una persona che NON appartiene ad alcuna squadra guidata da `leader`. */
export async function unFuoriSquadra(pool: Pool, leader: string): Promise<Attore> {
  const r = await pool.query<Attore>(
    `SELECT u.user_id AS "userId", u.user_email AS email
       FROM sys.sys_users u
      WHERE u.user_status = 'ACTIVE' AND u.user_id <> $1
        AND NOT EXISTS (
          SELECT 1 FROM sys.sys_teams t
            JOIN sys.sys_team_members m ON m.team_member_team_id = t.team_id
           WHERE t.team_lead_user_id = $1 AND t.team_is_active
             AND m.team_member_user_id = u.user_id)
      ORDER BY u.user_email
      LIMIT 1`,
    [leader],
  );
  const a = r.rows[0];
  if (!a) throw new Error(`nessuno fuori dalle squadre di ${leader}: verifica cieca`);
  return a;
}
