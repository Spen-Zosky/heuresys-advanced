/**
 * db/scripts/sospendi-collaudo.ts — correzione di sicurezza del 2026-10-31 (difetto D-02
 * dell'analisi delle interfacce, thread «Chiudere le falle di sicurezza su RTL»).
 *
 * IL PERCHE'. Le utenze di collaudo (`COLLAUDO_IDENTITIES`, dominio `.invalid`, tipo SERVICE)
 * esistono per scelta di Enzo del 2026-08-25: permettono a un agente di entrare con un mandato
 * vero senza il rito del secondo fattore delle persone. In produzione, pero', restavano
 * SEMPRE accese: quattordici esenzioni dal secondo fattore senza scadenza, fra cui un
 * TENANT_ADMIN di RTL e un PLATFORM_ADMIN, mentre tutte le persone vere di RTL hanno il
 * secondo fattore. Una password derivata che esce dalla macchina basta a entrare.
 *
 * LA REGOLA che questo script fa valere: in produzione le utenze di collaudo stanno SPENTE,
 * e si accendono solo per il tempo di un giro dichiarato, con un motivo scritto. Spente vuol
 * dire: identita' LOCAL disattivata (il login non le trova piu', `findLoginCandidates`
 * pretende `auth_identity_is_active`), esenzione dal secondo fattore spenta (il trigger della
 * 000118 la scrive nel registro di audit), sessioni aperte revocate. Le righe RESTANO: niente
 * si cancella. La riattivazione ripristina accesso ed esenzione come li aveva trovati l'ultima
 * sospensione; le sessioni revocate restano revocate (di proposito: chi rientra fa un login
 * nuovo), e il giornale e l'audit delle esenzioni restano come storia.
 *
 * Le quattro cose di ogni scrittura (db-migrations.md):
 *  (a) misura prima  — stato di ogni utenza di collaudo, e conteggi delle persone vere
 *  (b) guardia       — agisce SOLO sulle email di COLLAUDO_IDENTITIES, SOLO se sono SERVICE,
 *                      e si ferma se una di quelle email appartiene a un'utenza non SERVICE
 *  (c) post-condizione su cio' che NON deve cambiare — identita' attive, esenzioni attive e
 *      numero di utenti delle persone NON di collaudo identici prima e dopo
 *  (d) rollback      — giornale `staging.collaudo_sospensione_undo`, scritto PRIMA delle
 *                      modifiche nella stessa transazione; `--riattiva` lo applica
 *
 * Uso (senza flag di azione mostra solo lo stato):
 *   pnpm db:sospendi-collaudo                                  # stato, nessuna scrittura
 *   pnpm db:sospendi-collaudo --sospendi --motivo "<perche'>"  [--dry-run]
 *   pnpm db:sospendi-collaudo --riattiva --motivo "<giro>"     [--dry-run] [--solo a@collaudo.invalid,b@...]
 * Idempotente: sospendere due volte = 0 scritture la seconda volta.
 */
import { Client } from "pg";
import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { COLLAUDO_IDENTITIES } from "../../apps/api/scripts/collaudo-access.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
dotenvConfig({ path: resolve(repoRoot, ".env"), quiet: true });

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const SOSPENDI = argv.includes("--sospendi");
const RIATTIVA = argv.includes("--riattiva");
function valoreDi(flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}
const MOTIVO = valoreDi("--motivo")?.trim();
const SOLO = valoreDi("--solo")?.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

function fail(msg: string): never {
  throw new Error(msg);
}

interface Riga {
  user_id: string;
  user_email: string;
  user_type: string;
  identita_attiva: boolean | null;
  esenzione_attiva: boolean | null;
  sessioni_aperte: number;
}

async function statoCollaudo(db: Client, emails: string[]): Promise<Riga[]> {
  const r = await db.query<Riga>(
    `SELECT u.user_id, u.user_email, u.user_type,
            (SELECT bool_or(i.auth_identity_is_active) FROM sys.sys_auth_identities i
              WHERE i.auth_identity_user_id = u.user_id AND i.auth_identity_provider = 'LOCAL') AS identita_attiva,
            (SELECT e.auth_mfa_exemption_enabled FROM sys.sys_auth_mfa_exemptions e
              WHERE e.auth_mfa_exemption_user_id = u.user_id) AS esenzione_attiva,
            (SELECT count(*)::int FROM sys.sys_auth_refresh_tokens t
              WHERE t.auth_refresh_token_user_id = u.user_id
                AND t.auth_refresh_token_revoked_at IS NULL
                AND t.auth_refresh_token_expires_at > now()) AS sessioni_aperte
       FROM sys.sys_users u
      WHERE lower(u.user_email) = ANY($1)
      ORDER BY u.user_email`,
    [emails],
  );
  return r.rows;
}

/** Cio' che NON deve cambiare: le persone e le utenze che non sono di collaudo. */
async function misuraFuoriCollaudo(db: Client, emails: string[]): Promise<string> {
  const r = await db.query<{ utenti: string; identita: string; esenzioni: string }>(
    `SELECT (SELECT count(*) FROM sys.sys_users WHERE NOT (lower(user_email) = ANY($1)))::text AS utenti,
            (SELECT count(*) FROM sys.sys_auth_identities i JOIN sys.sys_users u ON u.user_id = i.auth_identity_user_id
              WHERE i.auth_identity_is_active AND NOT (lower(u.user_email) = ANY($1)))::text AS identita,
            (SELECT count(*) FROM sys.sys_auth_mfa_exemptions e JOIN sys.sys_users u ON u.user_id = e.auth_mfa_exemption_user_id
              WHERE e.auth_mfa_exemption_enabled AND NOT (lower(u.user_email) = ANY($1)))::text AS esenzioni`,
    [emails],
  );
  const x = r.rows[0]!;
  return `utenti=${x.utenti} identita_attive=${x.identita} esenzioni_attive=${x.esenzioni}`;
}

function stampa(titolo: string, righe: Riga[]): void {
  console.log(titolo);
  for (const r of righe) {
    console.log(
      `  ${r.user_email.padEnd(46)} ${r.user_type.padEnd(8)} accesso=${r.identita_attiva ? "ACCESO" : "spento"}` +
        ` esenzione_2FA=${r.esenzione_attiva === null ? "-" : r.esenzione_attiva ? "ACCESA" : "spenta"}` +
        ` sessioni_aperte=${r.sessioni_aperte}`,
    );
  }
}

async function main(): Promise<void> {
  if (SOSPENDI && RIATTIVA) fail("--sospendi e --riattiva insieme: scegline uno");
  if ((SOSPENDI || RIATTIVA) && (!MOTIVO || MOTIVO.length < 8)) {
    fail("serve --motivo \"<testo di almeno 8 caratteri>\": ogni accensione o spegnimento porta il suo perche'");
  }

  const tutte = COLLAUDO_IDENTITIES.map((c: { email: string }) => c.email.toLowerCase());
  if (SOLO) {
    const ignote = SOLO.filter((e) => !tutte.includes(e));
    if (ignote.length > 0) fail(`--solo nomina email che non sono di collaudo: ${ignote.join(", ")}`);
  }
  const emails = SOLO ?? tutte;

  const db = new Client({
    host: process.env.POSTGRES_HOST ?? "localhost",
    port: Number(process.env.POSTGRES_PORT ?? 5433),
    user: process.env.POSTGRES_USER ?? "heuresys",
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB ?? "heuresys_advanced",
  });
  await db.connect();
  try {
    const dbName = (await db.query<{ d: string }>("SELECT current_database() AS d")).rows[0]!.d;
    console.log(`database: ${dbName} su ${process.env.POSTGRES_HOST ?? "localhost"}:${process.env.POSTGRES_PORT ?? 5433}`);

    // (a) misura prima
    const prima = await statoCollaudo(db, emails);
    stampa("misura prima:", prima);
    const fuoriPrima = await misuraFuoriCollaudo(db, tutte);
    console.log(`fuori dal collaudo, prima: ${fuoriPrima}`);

    if (!SOSPENDI && !RIATTIVA) return;

    // (b) guardia: mai un'utenza che non e' SERVICE, anche se porta un'email dell'elenco
    const nonService = prima.filter((r) => r.user_type !== "SERVICE");
    if (nonService.length > 0) {
      fail(`queste email dell'elenco non sono utenze SERVICE, mi fermo: ${nonService.map((r) => r.user_email).join(", ")}`);
    }
    const ids = prima.map((r) => r.user_id);
    if (ids.length === 0) {
      console.log("nessuna utenza di collaudo in questo database: niente da fare");
      return;
    }

    await db.query("BEGIN");
    await db.query(`
      CREATE TABLE IF NOT EXISTS staging.collaudo_sospensione_undo (
        undo_id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        undo_azione              varchar(16)  NOT NULL CHECK (undo_azione IN ('SOSPENDI', 'RIATTIVA')),
        undo_user_id             uuid         NOT NULL,
        undo_email               varchar(255) NOT NULL,
        undo_identita_era_attiva boolean,
        undo_esenzione_era_attiva boolean,
        undo_motivo              text         NOT NULL,
        undo_eseguito_da         text         NOT NULL DEFAULT current_user,
        undo_at                  timestamptz  NOT NULL DEFAULT now()
      )`);
    await db.query(`COMMENT ON TABLE staging.collaudo_sospensione_undo IS
      'GIORNALE DI ROLLBACK (D-02, 2026-10-31). Ogni sospensione o riattivazione delle utenze '
      'di collaudo scrive qui, PRIMA di cambiare, lo stato che trova: accesso e esenzione dal '
      'secondo fattore. --riattiva ripristina lo stato dell''ultima sospensione. Non si svuota.'`);

    let cambiate = 0;
    let sessioniRevocate = 0;
    for (const r of prima) {
      if (SOSPENDI) {
        const giaSpenta = !r.identita_attiva && r.esenzione_attiva !== true && r.sessioni_aperte === 0;
        if (giaSpenta) continue;
        await db.query(
          `INSERT INTO staging.collaudo_sospensione_undo
             (undo_azione, undo_user_id, undo_email, undo_identita_era_attiva, undo_esenzione_era_attiva, undo_motivo)
           VALUES ('SOSPENDI', $1, $2, $3, $4, $5)`,
          [r.user_id, r.user_email, r.identita_attiva, r.esenzione_attiva, MOTIVO],
        );
        await db.query(
          `UPDATE sys.sys_auth_identities SET auth_identity_is_active = false
            WHERE auth_identity_user_id = $1 AND auth_identity_provider = 'LOCAL' AND auth_identity_is_active`,
          [r.user_id],
        );
        await db.query(
          `UPDATE sys.sys_auth_mfa_exemptions SET auth_mfa_exemption_enabled = false
            WHERE auth_mfa_exemption_user_id = $1 AND auth_mfa_exemption_enabled`,
          [r.user_id],
        );
        const rev = await db.query(
          `UPDATE sys.sys_auth_refresh_tokens
              SET auth_refresh_token_revoked_at = now(), auth_refresh_token_revoke_reason = 'REVOKED_BY_ADMIN'
            WHERE auth_refresh_token_user_id = $1 AND auth_refresh_token_revoked_at IS NULL`,
          [r.user_id],
        );
        sessioniRevocate += rev.rowCount ?? 0;
        cambiate++;
      } else {
        // RIATTIVA: si torna allo stato che l'ULTIMA sospensione aveva trovato, non a «tutto acceso».
        const g = await db.query<{ identita: boolean | null; esenzione: boolean | null }>(
          `SELECT undo_identita_era_attiva AS identita, undo_esenzione_era_attiva AS esenzione
             FROM staging.collaudo_sospensione_undo
            WHERE undo_user_id = $1 AND undo_azione = 'SOSPENDI'
            ORDER BY undo_at DESC LIMIT 1`,
          [r.user_id],
        );
        const ultima = g.rows[0];
        if (!ultima) {
          console.log(`  ${r.user_email}: nessuna sospensione nel giornale, la lascio com'e'`);
          continue;
        }
        await db.query(
          `INSERT INTO staging.collaudo_sospensione_undo
             (undo_azione, undo_user_id, undo_email, undo_identita_era_attiva, undo_esenzione_era_attiva, undo_motivo)
           VALUES ('RIATTIVA', $1, $2, $3, $4, $5)`,
          [r.user_id, r.user_email, r.identita_attiva, r.esenzione_attiva, MOTIVO],
        );
        if (ultima.identita) {
          await db.query(
            `UPDATE sys.sys_auth_identities SET auth_identity_is_active = true
              WHERE auth_identity_user_id = $1 AND auth_identity_provider = 'LOCAL' AND NOT auth_identity_is_active`,
            [r.user_id],
          );
        }
        if (ultima.esenzione) {
          await db.query(
            `UPDATE sys.sys_auth_mfa_exemptions SET auth_mfa_exemption_enabled = true
              WHERE auth_mfa_exemption_user_id = $1 AND NOT auth_mfa_exemption_enabled`,
            [r.user_id],
          );
        }
        cambiate++;
      }
    }

    // (c) post-condizioni
    const dopo = await statoCollaudo(db, emails);
    const fuoriDopo = await misuraFuoriCollaudo(db, tutte);
    if (fuoriDopo !== fuoriPrima) {
      await db.query("ROLLBACK");
      fail(`post-condizione rossa: fuori dal collaudo e' cambiato qualcosa (${fuoriPrima} -> ${fuoriDopo}). ROLLBACK`);
    }
    if (SOSPENDI) {
      const ancoraAccese = dopo.filter((r) => r.identita_attiva || r.esenzione_attiva === true || r.sessioni_aperte > 0);
      if (ancoraAccese.length > 0) {
        await db.query("ROLLBACK");
        fail(`post-condizione rossa: restano accese ${ancoraAccese.map((r) => r.user_email).join(", ")}. ROLLBACK`);
      }
    }
    if (dopo.length !== prima.length) {
      await db.query("ROLLBACK");
      fail(`post-condizione rossa: le utenze di collaudo erano ${prima.length}, ora ${dopo.length}. ROLLBACK`);
    }

    if (DRY) {
      await db.query("ROLLBACK");
      stampa("dopo (PROVA, annullata con ROLLBACK):", dopo);
    } else {
      await db.query("COMMIT");
      stampa("dopo:", dopo);
    }
    console.log(
      `${SOSPENDI ? "SOSPESE" : "RIATTIVATE"} ${cambiate} utenze, sessioni revocate ${sessioniRevocate}` +
        `${DRY ? " (dry-run: nessuna scrittura)" : ""}; fuori dal collaudo invariato: ${fuoriDopo}`,
    );
  } catch (e) {
    await db.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    await db.end();
  }
}

main().catch((e: unknown) => {
  console.error(`ERRORE: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
