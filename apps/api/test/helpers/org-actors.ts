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
 */

import type { Pool } from "pg";

/** Chi recita nel test: serve l'id per le asserzioni sui perimetri e l'indirizzo per
 *  i test che fanno login davvero. */
export interface Attore { userId: string; email: string }

/** Solo persone che possono AUTENTICARSI: alcuni test entrano davvero con queste
 *  credenziali, e un attore senza identita' farebbe fallire il login invece della
 *  regola che si voleva misurare. */
const PUO_ENTRARE = `
  AND EXISTS (SELECT 1 FROM sys.sys_auth_identities i
               JOIN sys.sys_auth_credentials c ON c.auth_credential_identity_id = i.auth_identity_id
              WHERE i.auth_identity_user_id = u.user_id AND i.auth_identity_is_active)
  AND EXISTS (SELECT 1 FROM sys.sys_auth_mfa_factors f
               WHERE f.auth_mfa_factor_user_id = u.user_id)`;

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
 * `manager` (o in una sua discendente) — e non è il manager stesso.
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
      WHERE u.user_id <> $1 ${PUO_ENTRARE}
      ORDER BY u.user_email
      LIMIT 1`,
    [manager],
  );
  const a = r.rows[0];
  if (!a) throw new Error(`nessun sottoposto organizzativo per ${manager}: verifica cieca`);
  return a;
}

/**
 * Una persona che, secondo l'ALBERO DELLE UNITÀ, NON lavora sotto `manager`.
 * È l'«estraneo» delle verifiche di isolamento fra pari (I19).
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
        AND p.position_organization_unit_id NOT IN (SELECT unita FROM sue) ${PUO_ENTRARE}
      ORDER BY u.user_email
      LIMIT 1`,
    [manager],
  );
  const a = r.rows[0];
  if (!a) throw new Error(`nessun estraneo organizzativo per ${manager}: verifica cieca`);
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
