/**
 * db/scripts/ruoli-dei-test.ts — porta un database di collaudo alle concessioni di ruolo che
 * i test di integrazione danno per scontate (db/scripts/ruoli-dei-test.json).
 *
 * Perché (2026-11-26). heuresys_ci si rinfresca dalla produzione, dove i ruoli seguono il
 * lavoro (regola di Enzo del 2026-10-31): federica.marchetti non è più TENANT_ADMIN,
 * maria.colombo non è più HRMS_MANAGER, nessuno è READ_ONLY. Dopo il rinfresco delle 13:22 UTC
 * 25 file di integrazione sono diventati rossi senza che il codice fosse cambiato, mentre sul
 * runner con la copia vecchia restavano verdi. Il rinfresco è legittimo e i test non devono
 * dipendere da quando è stato fatto: le concessioni che usano si DICHIARANO, e la CI ce le
 * porta a ogni corsa, su qualsiasi runner.
 *
 * Le quattro cose di ogni scrittura (.claude/rules/db-migrations.md):
 *  (a) misura prima  — per ogni riga dichiarata: la persona, il ruolo, la concessione attiva.
 *  (b) guardia       — SOLO in un ambiente di collaudo, la stessa doppia condizione di
 *                      provision-collaudo-access.ts (apps/api/scripts/collaudo-guard.mjs):
 *                      NODE_ENV=test E un database che si dichiara di collaudo (o il gemello
 *                      nativo). Fuori, lo script si ferma prima di aprire una transazione.
 *                      Una persona assente, non attiva o di un'utenza di collaudo ferma tutto:
 *                      lo stato dichiarato non si raggiunge «in parte».
 *  (c) post-condizione — le concessioni che NON sono nella dichiarazione restano identiche
 *                      (impronta prima e dopo), le persone di RTL restano le stesse, e la
 *                      sentinella dei mandati incompatibili non cresce.
 *  (d) rollback      — giornale staging.ruoli_dei_test_undo scritto PRIMA di ogni concessione;
 *                      `--undo` revoca le sole righe del giornale (elenco esplicito, mai un jolly).
 *
 * Stato dichiarato, non adattivo: una seconda corsa non trova niente da fare.
 *   pnpm db:ruoli-dei-test --dry-run
 *   pnpm db:ruoli-dei-test
 *   pnpm db:ruoli-dei-test --undo
 */
import { Client } from "pg";
import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { hostname } from "node:os";
import { eDiCollaudoDa } from "../../apps/api/scripts/collaudo-guard.mjs";
import { leggiDichiarazione } from "../../apps/api/scripts/ruoli-dei-test.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
dotenvConfig({ path: resolve(repoRoot, ".env"), quiet: true });

const DRY = process.argv.includes("--dry-run");
const UNDO = process.argv.includes("--undo");

function eDiCollaudo(): boolean {
  return eDiCollaudoDa({
    nodeEnv: process.env.NODE_ENV,
    postgresDb: process.env.POSTGRES_DB,
    hostname: hostname(),
    postgresHost: process.env.POSTGRES_HOST,
    postgresPort: process.env.POSTGRES_PORT,
  });
}

function fail(msg: string): never {
  throw new Error(`[ruoli-dei-test] FERMO: ${msg}`);
}

const MOTIVO_PREFISSO = "ruoli-dei-test (db/scripts/ruoli-dei-test.json), solo collaudo: ";

/** Impronta delle concessioni attive FUORI dalla dichiarazione: deve restare identica. */
const IMPRONTA_ALTRE = `
  SELECT count(*)::text AS n,
         coalesce(md5(string_agg(g.user_auth_role_id::text || ':' || coalesce(g.user_auth_role_revoked_at::text, '-'),
                                 ',' ORDER BY g.user_auth_role_id)), '-') AS h
    FROM sys.sys_user_auth_roles g
    JOIN sys.sys_users u      ON u.user_id = g.user_auth_role_user_id
    JOIN sys.sys_auth_roles r ON r.auth_role_id = g.user_auth_role_role_id
   WHERE (u.user_email || '|' || r.auth_role_code) <> ALL($1::text[])`;

async function main(): Promise<void> {
  const dichiarate = leggiDichiarazione();

  // (b) guardia, prima ancora di collegarsi
  if (!eDiCollaudo()) {
    fail(
      `questo non è un ambiente di collaudo (NODE_ENV=${process.env.NODE_ENV ?? "-"}, ` +
        `POSTGRES_DB=${process.env.POSTGRES_DB ?? "-"}): le concessioni dei test non si portano qui. ` +
        `In produzione i ruoli seguono il lavoro.`,
    );
  }

  const db = new Client({
    host: process.env.POSTGRES_HOST ?? "localhost",
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: process.env.POSTGRES_USER ?? "heuresys",
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
  });
  await db.connect();
  try {
    await db.query("BEGIN");
    await db.query(`
      CREATE TABLE IF NOT EXISTS staging.ruoli_dei_test_undo (
        undo_id           bigserial   PRIMARY KEY,
        user_auth_role_id uuid        NOT NULL,
        email             text        NOT NULL,
        ruolo             text        NOT NULL,
        motivo            text        NOT NULL,
        eseguito_il       timestamptz NOT NULL DEFAULT clock_timestamp(),
        annullato_il      timestamptz
      )`);
    await db.query("LOCK TABLE sys.sys_user_auth_roles IN SHARE ROW EXCLUSIVE MODE");

    if (UNDO) {
      const r = await db.query(
        `WITH da AS (
           SELECT undo_id, user_auth_role_id FROM staging.ruoli_dei_test_undo WHERE annullato_il IS NULL
         ), rev AS (
           UPDATE sys.sys_user_auth_roles g SET user_auth_role_revoked_at = clock_timestamp()
             FROM da WHERE g.user_auth_role_id = da.user_auth_role_id AND g.user_auth_role_revoked_at IS NULL
           RETURNING g.user_auth_role_id
         )
         UPDATE staging.ruoli_dei_test_undo u SET annullato_il = clock_timestamp()
           FROM da WHERE u.undo_id = da.undo_id
         RETURNING u.email, u.ruolo`);
      await db.query(DRY ? "ROLLBACK" : "COMMIT");
      console.log(`${DRY ? "DRY-RUN" : "UNDO"}: revocate ${r.rowCount} concessioni del giornale`);
      for (const row of r.rows) console.log(`  ${row.email} ${row.ruolo}`);
      return;
    }

    const chiavi = dichiarate.map((c) => `${c.email}|${c.ruolo}`);
    // (a) misura prima, e (c) ciò che non deve cambiare
    const altrePrima = await db.query<{ n: string; h: string }>(IMPRONTA_ALTRE, [chiavi]);
    const personePrima = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_users WHERE user_type = 'STANDARD'`);
    const incompatibiliPrima = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.v_mandati_incompatibili`);

    let concesse = 0;
    let gia = 0;
    for (const c of dichiarate) {
      const u = await db.query<{ user_id: string; user_tenant_id: string | null; user_status: string; user_type: string }>(
        `SELECT user_id, user_tenant_id, user_status, user_type FROM sys.sys_users WHERE user_email = $1`, [c.email]);
      const persona = u.rows[0];
      if (!persona) fail(`${c.email} non esiste in questo database: i test ${c.test.join(", ")} non possono girare`);
      if (persona.user_status !== "ACTIVE") fail(`${c.email} è ${persona.user_status}, non ACTIVE`);
      if (persona.user_type !== "STANDARD") fail(`${c.email} è ${persona.user_type}, non una persona del tenant`);
      const r = await db.query<{ auth_role_id: string }>(
        `SELECT auth_role_id FROM sys.sys_auth_roles WHERE auth_role_code = $1`, [c.ruolo]);
      const ruolo = r.rows[0];
      if (!ruolo) fail(`il ruolo ${c.ruolo} non esiste: aggiorna ruoli-dei-test.json`);

      const attiva = await db.query(
        `SELECT 1 FROM sys.sys_user_auth_roles
          WHERE user_auth_role_user_id = $1 AND user_auth_role_role_id = $2
            AND user_auth_role_revoked_at IS NULL`, [persona.user_id, ruolo.auth_role_id]);
      if ((attiva.rowCount ?? 0) > 0) { gia++; continue; }

      concesse++;
      const ins = await db.query<{ user_auth_role_id: string }>(
        `INSERT INTO sys.sys_user_auth_roles
           (user_auth_role_user_id, user_auth_role_role_id, user_auth_role_tenant_id, user_auth_role_reason)
         VALUES ($1, $2, $3, $4)
         RETURNING user_auth_role_id`,
        [persona.user_id, ruolo.auth_role_id, persona.user_tenant_id, MOTIVO_PREFISSO + c.motivo]);
      // (d) il giornale nella stessa transazione: se la riga c'è, c'è anche la sua revoca
      await db.query(
        `INSERT INTO staging.ruoli_dei_test_undo (user_auth_role_id, email, ruolo, motivo) VALUES ($1, $2, $3, $4)`,
        [ins.rows[0]!.user_auth_role_id, c.email, c.ruolo, c.motivo]);
      console.log(`  concessa  ${c.email} ${c.ruolo}`);
    }

    // (c) post-condizioni
    const altreDopo = await db.query<{ n: string; h: string }>(IMPRONTA_ALTRE, [chiavi]);
    if (altreDopo.rows[0]!.n !== altrePrima.rows[0]!.n || altreDopo.rows[0]!.h !== altrePrima.rows[0]!.h) {
      await db.query("ROLLBACK");
      fail("sono cambiate concessioni fuori dalla dichiarazione: rollback");
    }
    const personeDopo = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_users WHERE user_type = 'STANDARD'`);
    if (personeDopo.rows[0]!.n !== personePrima.rows[0]!.n) {
      await db.query("ROLLBACK");
      fail("il numero delle persone è cambiato: rollback");
    }
    const incompatibiliDopo = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.v_mandati_incompatibili`);
    if (Number(incompatibiliDopo.rows[0]!.n) > Number(incompatibiliPrima.rows[0]!.n)) {
      await db.query("ROLLBACK");
      fail("una concessione ha creato due mandati incompatibili sulla stessa persona (ADR-0050 D7): rollback");
    }
    const mancanti = await db.query<{ k: string }>(
      `SELECT k FROM unnest($1::text[]) AS k
        WHERE NOT EXISTS (
          SELECT 1 FROM sys.sys_user_auth_roles g
            JOIN sys.sys_users u      ON u.user_id = g.user_auth_role_user_id
            JOIN sys.sys_auth_roles r ON r.auth_role_id = g.user_auth_role_role_id
           WHERE g.user_auth_role_revoked_at IS NULL AND u.user_email || '|' || r.auth_role_code = k)`,
      [chiavi]);
    if ((mancanti.rowCount ?? 0) > 0) {
      await db.query("ROLLBACK");
      fail(`stato dichiarato non raggiunto: ${mancanti.rows.map((x: { k: string }) => x.k).join(", ")}`);
    }

    await db.query(DRY ? "ROLLBACK" : "COMMIT");
    console.log(
      `${DRY ? "DRY-RUN (nessuna scrittura)" : "ESEGUITO"}: dichiarate ${dichiarate.length}, ` +
        `concesse ${concesse}, già presenti ${gia}. Rollback: pnpm db:ruoli-dei-test --undo`,
    );
  } catch (e) {
    await db.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    await db.end();
  }
}

main().catch((e: unknown) => {
  console.error(`\n${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
