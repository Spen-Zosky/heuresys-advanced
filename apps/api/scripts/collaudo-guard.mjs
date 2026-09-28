/**
 * apps/api/scripts/collaudo-guard.mjs — #261.
 *
 * LA GUARDIA (nata S1093, dentro seed-test-admin.ts / provision-collaudo-access.ts,
 * duplicata lì apposta all'epoca — S1116 la consolida in un modulo puro, come
 * derive-access.mjs e collaudo-access.mjs: una sola implementazione, importata da
 * entrambi, perché una guardia di sicurezza duplicata due volte è una guardia che può
 * divergere in silenzio).
 *
 * IL PUNTO PIU' DELICATO: se sbaglia, rigenera i secondi fattori VERI delle persone
 * in produzione e li deposita su disco.
 *
 * IL DIFETTO TROVATO (#261, S1116): la condizione 2 originale guardava il NOME del
 * database (`heuresys_ci` / `*_ci` / `*_test`). Il gemello (linux-pc) tiene un clone
 * FEDELE con lo STESSO nome della produzione (`heuresys_advanced`): la guardia negava
 * anche lì, dove depositare i segreti di collaudo è legittimo e sicuro.
 *
 * LA DECISIONE DI ENZO (2026-09-28): ridisegnare la guardia perché distingua la
 * MACCHINA, non il nome del database. Restano DUE condizioni, mai una sola sostituisce
 * l'altra — cambia solo COME si riconosce "sono in collaudo":
 *
 *  1. `NODE_ENV === "test"` — l'ambiente lo dichiara. Da sola insufficiente (il caso
 *     limite che ha fatto nascere la guardia: un `NODE_ENV=test` distratto su una
 *     macchina il cui `.env` punta alla produzione via tunnel).
 *  2. UNA delle due prove di "sono davvero in collaudo":
 *     (a) il **nome del database** si dichiara di collaudo (`heuresys_ci`/`*_ci`/`*_test`)
 *         — il ramo storico, invariato: copre la CI e ogni copia usa-e-getta nominata
 *         così, ovunque giri.
 *     (b) sono **fisicamente sul gemello** (hostname in un elenco esplicito, mai
 *         indovinato) E sto parlando con la SUA istanza NATIVA di Postgres, non con un
 *         tunnel: `POSTGRES_HOST` è loopback E `POSTGRES_PORT` è `5432` (il nativo —
 *         la topologia del progetto usa SEMPRE `:5433` per il tunnel verso la VM,
 *         vedi `apps/api/scripts/contesa-tunnel.mjs`, `dev-whoami.mjs`: un tunnel
 *         aperto DAL gemello VERSO la VM su una porta locale diversa da 5432 resta
 *         negato, di proposito).
 *
 * Negativa per difetto in ogni ramo cieco: hostname assente/sconosciuto, host non
 * loopback, porta assente o diversa da 5432 → sempre `false`. Nessun ramo
 * "se non so, esporto".
 */

/** Macchine dove esiste un clone/gemello LOCALE del database — mai la VM di produzione. */
export const MACCHINE_GEMELLO = new Set(["enzo-S550CM"]);

const NOME_DB_DI_COLLAUDO = /_(ci|test)$/;

/** Il nome del database si dichiara di collaudo — ramo storico, invariato. */
export function dbSiDichiaraDiCollaudo(postgresDb) {
  if (!postgresDb) return false;
  return postgresDb === "heuresys_ci" || NOME_DB_DI_COLLAUDO.test(postgresDb);
}

/** Sono fisicamente sul gemello, e parlo con la sua istanza NATIVA (non un tunnel). */
export function suGemelloLocale({ hostname, postgresHost, postgresPort }) {
  if (!hostname || !MACCHINE_GEMELLO.has(hostname)) return false;
  if (postgresHost !== "localhost" && postgresHost !== "127.0.0.1") return false;
  return Number(postgresPort) === 5432;
}

/** Versione pura, per la prova: ogni ingresso e' esplicito, niente lettura di `process.env`/`os.hostname()` qui dentro. */
export function eDiCollaudoDa({ nodeEnv, postgresDb, hostname, postgresHost, postgresPort }) {
  if (nodeEnv !== "test") return false;
  return dbSiDichiaraDiCollaudo(postgresDb) || suGemelloLocale({ hostname, postgresHost, postgresPort });
}
