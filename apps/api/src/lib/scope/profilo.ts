/**
 * apps/api/src/lib/scope/profilo.ts — il PROFILO di un cliente sopra un catalogo di
 * piattaforma (ADR-0039, B22).
 *
 * LA DECISIONE CHE QUESTO FILE ESEGUE, nelle parole dell'ADR: «un catalogo è di tutti e non
 * porta mai il cliente; un profilo dice quali voci del catalogo un cliente usa; le voci che un
 * cliente si crea vivono accanto a quelle di catalogo, nella stessa tabella, distinte dalla
 * colonna del cliente». E la regola 4: «un elenco chiesto da un utente del cliente restituisce
 * le voci del suo profilo più le sue voci proprie, mai il catalogo intero».
 *
 * LA CATENA, che è la stessa che il motore di materializzazione percorre già:
 *   cliente → `sys_blueprint_activations` (ACTIVE, nella finestra di validità)
 *           → variante → `sys_blueprint_variant_versions` (PUBLISHED)
 *           → `sys_blueprint_content_<dominio>` → i CODICI del profilo.
 *
 * ⚠ SI RISOLVE PER CODICE, non per uuid, ed è il disegno già scelto dal progetto (mig. 000327:
 * «una proposta nomina "la direzione commerciale", non un identificativo che non conosce»).
 *
 * ⚠ FAIL-CLOSED, DICHIARATO. Un cliente che non ha nessuna attivazione ha un profilo VUOTO:
 * vede solo le proprie voci, non il catalogo intero. La scelta opposta (nessun profilo ⇒ vedi
 * tutto) renderebbe il filtro inefficace proprio dove nessuno lo ha ancora configurato, che è
 * quando serve di più.
 *
 * ⚠⚠ LA GIUSTIFICAZIONE CHE STAVA QUI ERA FALSA, ed è stata corretta il 2026-09-10 (C1).
 * Diceva: «l'unico cliente in questa condizione è HEURESYS, che usa ZERO ruoli nelle proprie
 * posizioni — nessuna funzione esistente si rompe». Quello zero veniva da una query che
 * interrogava `tenant_code = 'HEURESYS_SYSTEM'`, un codice che NON ESISTE: il codice vero è
 * `HEURESYS`. Zero righe da un codice sbagliato, lette come zero ruoli. La misura vera:
 * HEURESYS ha **tre posizioni attive** e tutte e tre usano un ruolo di catalogo, e il
 * fail-closed stava restituendo zero righe e 404 a persone reali (TEAM_LEADER e USER).
 * Una giustificazione falsa dentro il codice è peggio di nessuna giustificazione: chi la
 * legge smette di verificare.
 * Il rimedio non è stato ammorbidire il fail-closed — è dare a HEURESYS il profilo che gli
 * mancava (mig. `000400`: famiglia `MGMT_CONSULTING`, variante propria, i tre ruoli in uso).
 * Il fail-closed resta, ed è giusto che resti: un cliente senza profilo dichiarato è un
 * cliente da configurare, non uno a cui aprire il catalogo di tutti.
 *
 * ⚠ CHI VEDE IL CATALOGO INTERO: chi amministra la piattaforma. È l'eccezione che l'ADR
 * dichiara — «il catalogo intero resta visibile a chi amministra la piattaforma e a chi sta
 * costruendo un cliente nuovo, che è l'unico momento in cui serve vederlo tutto».
 */

import type { Pool, PoolClient } from "pg";
import type { ActorContext } from "../actor.js";
import { isPlatform } from "../actor.js";

export type DbConnector = Pool | PoolClient;

/** I domini di catalogo che oggi hanno un profilo. Insieme chiuso, come le dichiarazioni del gate. */
export type DominioDiProfilo = "job_roles" | "dashboards";

/** La tabella di contenuto e la colonna del codice, per dominio. Nessuna interpolazione di input. */
const CONTENUTO: Record<DominioDiProfilo, { tabella: string; codice: string; versione: string }> = {
  job_roles: {
    tabella: "sys.sys_blueprint_content_job_roles",
    codice: "blueprint_content_job_role_code",
    versione: "blueprint_content_job_role_version_id",
  },
  dashboards: {
    tabella: "sys.sys_blueprint_content_dashboards",
    codice: "blueprint_content_dashboard_code",
    versione: "blueprint_content_dashboard_version_id",
  },
};

/**
 * Cosa un attore può vedere di un catalogo.
 *
 * `tutto` — il catalogo intero (chi amministra la piattaforma, o chi costruisce un cliente).
 * `codici` — l'elenco dei codici del profilo; le voci proprie del cliente si aggiungono a
 *            parte, per colonna del cliente, e NON passano da qui.
 */
export type PerimetroDiCatalogo =
  | { tipo: "tutto" }
  | { tipo: "profilo"; codici: string[]; tenantId: string | null };

/**
 * Risolve i codici che il profilo di un cliente dichiara per un dominio.
 * Un cliente senza attivazione, o con un'attivazione senza versione pubblicata, torna [].
 */
export async function codiciDelProfilo(
  q: DbConnector,
  tenantId: string,
  dominio: DominioDiProfilo,
): Promise<string[]> {
  const c = CONTENUTO[dominio];
  const res = await q.query<{ codice: string }>(
    `SELECT DISTINCT ct.${c.codice} AS codice
       FROM ${c.tabella} ct
       JOIN sys.sys_blueprint_variant_versions vv
         ON vv.blueprint_variant_version_id = ct.${c.versione}
        AND vv.blueprint_variant_version_status = 'PUBLISHED'
       JOIN sys.sys_blueprint_activations a
         ON a.blueprint_activation_variant_id = vv.blueprint_variant_version_variant_id
        AND a.blueprint_activation_status = 'ACTIVE'
        AND a.blueprint_activation_effective_from <= current_date
        AND (a.blueprint_activation_effective_to IS NULL
             OR a.blueprint_activation_effective_to >= current_date)
      WHERE a.blueprint_activation_tenant_id = $1`,
    [tenantId],
  );
  return res.rows.map((r) => r.codice);
}

/**
 * Il perimetro di catalogo di un attore su un dominio.
 *
 * Chi amministra la piattaforma vede tutto. Chiunque altro vede il proprio profilo — e un
 * attore senza cliente che NON amministra la piattaforma non è un caso legittimo su un
 * catalogo di prodotto: vede un profilo vuoto, che è la stessa scelta fail-closed di sopra.
 */
export async function perimetroDiCatalogo(
  q: DbConnector,
  actor: ActorContext,
  dominio: DominioDiProfilo,
): Promise<PerimetroDiCatalogo> {
  if (isPlatform(actor)) return { tipo: "tutto" };
  if (actor.tenantId === null) return { tipo: "profilo", codici: [], tenantId: null };
  return {
    tipo: "profilo",
    codici: await codiciDelProfilo(q, actor.tenantId, dominio),
    tenantId: actor.tenantId,
  };
}
