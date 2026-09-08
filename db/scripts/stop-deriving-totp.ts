/**
 * db/scripts/stop-deriving-totp.ts
 * #169 F3c — **il secondo fattore smette di essere derivato dalla chiave madre.**
 *
 * IL DIFETTO CHE TOGLIE, misurato in S1050. La stessa chiave genera la password
 * (`derivePassword`) *e* il segreto dell'authenticator (`deriveTotpSecret`): due HMAC sullo
 * stesso segreto, distinti dal solo prefisso. Chi possiede la chiave possiede entrambi —
 * quindi per quel soggetto **l'MFA non è un secondo fattore, è lo stesso fattore contato due
 * volte**.
 *
 * ⚠ **NON è una rotazione, ed è il punto.** Il segreto è funzione deterministica di
 * (chiave, email): «rigenerarlo» restituisce lo stesso valore, per sempre. L'unica via è
 * che smetta di essere una funzione di qualcosa — cioè che sia **casuale**. Da lì in poi non
 * è ricostruibile da nessuna chiave, e non lo sarà nemmeno domani.
 *
 * PERCHÉ SI PUÒ FARE OGGI SENZA ROMPERE NULLA, misurato il 2026-09-08. Il segreto derivato
 * serve solo dove una prova deve **completare** una sfida a due passi, e quel ramo è dentro
 * un `if (status === "mfa_required")` — sia in `apps/web/tests/e2e/fixtures.ts` sia in
 * `apps/api/test/helpers/login.ts`. Con l'enforcement MFA spento il server risponde
 * `success` al primo passo e **quel ramo non viene mai percorso**. E i cinque test dedicati
 * all'MFA non usano il segreto derivato: **zero occorrenze** in ciascuno, se lo costruiscono
 * da soli. Il giorno in cui l'enforcement si accende la suite passerà dalle utenze di
 * collaudo, che sono esenti per progetto (#169 F2).
 *
 * ⚠ Le **password** restano derivate: non sono il bersaglio di questa voce, e la suite ne ha
 * bisogno per entrare. Il difetto non era «le credenziali sono derivate», era «le DUE
 * credenziali nascono dalla STESSA chiave».
 *
 * LE QUATTRO COSE DI OGNI SCRITTURA DI MASSA (metodo di bonifica, regola 4):
 *  (a) la MISURA PRIMA — quanti fattori, di quale tipo, con quale etichetta;
 *  (b) la GUARDIA ri-verificata **al momento dell'esecuzione**, mai ereditata: si toccano
 *      solo i fattori `kind='TOTP'` con `label='derived-access'`, per **elenco esplicito di
 *      id**, mai un carattere jolly;
 *  (c) la POST-CONDIZIONE SU CIÒ CHE NON DOVEVA CAMBIARE — il numero totale di fattori, i
 *      fattori di altro tipo o etichetta, e le persone reali;
 *  (d) il ROLLBACK DICHIARATO — giornale `staging.totp_derivato_undo`, popolato **prima** di
 *      toccare qualsiasi cosa, con la funzione che lo riapplica.
 *
 * 🔒 Nessun segreto attraversa mai lo schermo: il giornale vive nel database e il confronto
 * finale dice «uguale / diverso», non i valori.
 *
 *   pnpm db:stop-deriving-totp --dry-run   # non scrive: dice cosa farebbe
 *   pnpm db:stop-deriving-totp             # esegue
 *   pnpm db:stop-deriving-totp --undo      # riapplica il giornale
 */
import { Client } from "pg";
import { randomBytes } from "node:crypto";
import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  readMaster,
  deriveTotpSecret,
  toBase32,
  isRealPerson,
} from "../../apps/api/scripts/derive-access.mjs";
import { encryptSecret, decryptSecret } from "../../apps/api/src/modules/auth/secret-crypto.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
dotenvConfig({ path: resolve(repoRoot, ".env"), quiet: true });

const DRY = process.argv.includes("--dry-run");
const UNDO = process.argv.includes("--undo");

/** L'etichetta dei fattori nati dalla derivazione. Nessun altro fattore si tocca. */
const ETICHETTA = "derived-access";

/**
 * Venti byte casuali in base32 — la stessa **forma** del derivato (che prende i primi 20
 * byte di un HMAC-SHA256), così ogni consumatore continua a leggere ciò che si aspetta.
 * Cambia l'origine, non il formato: `randomBytes` invece di una funzione della chiave.
 */
function segretoCasuale(): string {
  return toBase32(randomBytes(20));
}

interface Riga {
  id: string;
  email: string;
}

async function main(): Promise<void> {
  const db = new Client({
    host: process.env.POSTGRES_HOST ?? "localhost",
    port: Number(process.env.POSTGRES_PORT ?? 5433),
    user: process.env.POSTGRES_USER ?? "heuresys",
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB ?? "heuresys_advanced",
  });
  await db.connect();

  try {
    // ── (d) IL GIORNALE, prima di tutto il resto ────────────────────────────────
    await db.query(`CREATE SCHEMA IF NOT EXISTS staging`);
    await db.query(`
      CREATE TABLE IF NOT EXISTS staging.totp_derivato_undo (
        undo_id           bigserial PRIMARY KEY,
        factor_id         uuid NOT NULL,
        user_email        text NOT NULL,
        secret_precedente text NOT NULL,
        scritto_il        timestamptz NOT NULL DEFAULT now(),
        riapplicato_il    timestamptz
      )`);
    await db.query(`
      COMMENT ON TABLE staging.totp_derivato_undo IS
        'Giornale di ritorno di #169 F3c (2026-09-08): i segreti TOTP CIFRATI come erano '
        'prima di diventare casuali. Serve a rimettere il sistema com''era, non a leggerli: '
        'sono cifrati come nella tabella d''origine. Si riapplica con --undo.'`);

    if (UNDO) {
      const g = await db.query<{ factor_id: string; secret_precedente: string }>(
        `SELECT factor_id, secret_precedente FROM staging.totp_derivato_undo
          WHERE riapplicato_il IS NULL ORDER BY undo_id`,
      );
      if (g.rows.length === 0) {
        console.log("giornale vuoto: niente da riapplicare");
        return;
      }
      for (const r of g.rows) {
        await db.query(
          `UPDATE sys.sys_auth_mfa_factors SET auth_mfa_factor_secret = $1
            WHERE auth_mfa_factor_id = $2`,
          [r.secret_precedente, r.factor_id],
        );
      }
      await db.query(
        `UPDATE staging.totp_derivato_undo SET riapplicato_il = now() WHERE riapplicato_il IS NULL`,
      );
      console.log(`RIAPPLICATO: ${g.rows.length} segreti riportati com'erano`);
      return;
    }

    // ── (a) LA MISURA PRIMA ─────────────────────────────────────────────────────
    const totali = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_auth_mfa_factors`,
    );
    const altri = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_auth_mfa_factors
        WHERE auth_mfa_factor_kind <> 'TOTP'
           OR coalesce(auth_mfa_factor_metadata->>'label', '') <> $1`,
      [ETICHETTA],
    );
    const fattoriPrima = Number(totali.rows[0]!.n);
    const altriPrima = Number(altri.rows[0]!.n);

    // ── (b) LA GUARDIA — elenco esplicito, mai un jolly ─────────────────────────
    // Il `WHERE` è ri-eseguito **adesso**: non si eredita un elenco preso prima.
    const bersagli = await db.query<Riga>(
      `SELECT f.auth_mfa_factor_id AS id, u.user_email AS email
         FROM sys.sys_auth_mfa_factors f
         JOIN sys.sys_users u ON u.user_id = f.auth_mfa_factor_user_id
        WHERE f.auth_mfa_factor_kind = 'TOTP'
          AND f.auth_mfa_factor_metadata->>'label' = $1
        ORDER BY u.user_email`,
      [ETICHETTA],
    );

    // Una persona reale sceglie le proprie credenziali (decisione di Enzo, S1032): il suo
    // fattore non è mai stato nostro da riscrivere. La stessa esclusione del provisioning.
    const daFare = bersagli.rows.filter((r) => !isRealPerson(r.email));
    const esclusiPersone = bersagli.rows.length - daFare.length;

    console.log(`fattori MFA totali .............. ${fattoriPrima}`);
    console.log(`di cui NON toccabili ............ ${altriPrima} (tipo o etichetta diversi)`);
    console.log(`con etichetta '${ETICHETTA}' .... ${bersagli.rows.length}`);
    console.log(`esclusi perché persone reali .... ${esclusiPersone}`);
    console.log(`DA RENDERE CASUALI .............. ${daFare.length}`);

    if (daFare.length === 0) {
      console.log("\nnulla da fare.");
      return;
    }

    if (DRY) {
      console.log("\nDRY-RUN: non ho scritto niente. Per eseguire, togli --dry-run.");
      return;
    }

    // Il giornale si popola PRIMA di toccare qualsiasi cosa, o non è un rollback.
    let giornalate = 0;
    for (const r of daFare) {
      const attuale = await db.query<{ s: string }>(
        `SELECT auth_mfa_factor_secret AS s FROM sys.sys_auth_mfa_factors
          WHERE auth_mfa_factor_id = $1`,
        [r.id],
      );
      const s = attuale.rows[0]?.s;
      if (!s) continue;
      // ⚠ Una riga per fattore, non una per tentativo. Una corsa interrotta a metà lascia
      // il giornale scritto: se ne aggiungessi altre, `--undo` riapplicherebbe il valore
      // dell'ultimo tentativo invece di quello ORIGINALE, e il rollback direbbe il falso.
      // Misurato: la prima corsa si è fermata su una colonna inesistente dopo aver scritto
      // tutte e 159 le righe e prima di toccare un solo segreto.
      const gia = await db.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM staging.totp_derivato_undo
          WHERE factor_id = $1 AND riapplicato_il IS NULL`,
        [r.id],
      );
      if (gia.rows[0]!.n === "0") {
        await db.query(
          `INSERT INTO staging.totp_derivato_undo (factor_id, user_email, secret_precedente)
           VALUES ($1, $2, $3)`,
          [r.id, r.email, s],
        );
      }
      giornalate++;
    }
    if (giornalate !== daFare.length) {
      throw new Error(
        `giornale incompleto: ${giornalate} righe per ${daFare.length} bersagli. NON procedo.`,
      );
    }
    console.log(`\ngiornale di ritorno: ${giornalate} righe scritte PRIMA di toccare nulla`);

    // ── LA SOSTITUZIONE, un id per volta ────────────────────────────────────────
    let scritti = 0;
    for (const r of daFare) {
      const nuovo = encryptSecret(segretoCasuale());
      // ⚠ Nessun `updated_at`: questa tabella non ce l'ha — ha solo `created_at`. Scoperto
      // eseguendo, non leggendo: la forma «SET valore, updated_at = now()» è talmente
      // abituale nel resto del repository da sembrare corretta a occhio.
      const res = await db.query(
        `UPDATE sys.sys_auth_mfa_factors
            SET auth_mfa_factor_secret = $1
          WHERE auth_mfa_factor_id = $2
            AND auth_mfa_factor_kind = 'TOTP'
            AND auth_mfa_factor_metadata->>'label' = $3`,
        [nuovo, r.id, ETICHETTA],
      );
      scritti += res.rowCount ?? 0;
    }
    console.log(`segreti sostituiti: ${scritti}`);

    // ── (c) LE POST-CONDIZIONI, su ciò che NON doveva cambiare ──────────────────
    const totaliDopo = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_auth_mfa_factors`,
    );
    if (Number(totaliDopo.rows[0]!.n) !== fattoriPrima) {
      throw new Error(
        `POST-CONDIZIONE ROTTA: i fattori sono ${totaliDopo.rows[0]!.n} invece di ${fattoriPrima}. ` +
          `Riapplica il giornale con --undo.`,
      );
    }
    const altriDopo = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_auth_mfa_factors
        WHERE auth_mfa_factor_kind <> 'TOTP'
           OR coalesce(auth_mfa_factor_metadata->>'label', '') <> $1`,
      [ETICHETTA],
    );
    if (Number(altriDopo.rows[0]!.n) !== altriPrima) {
      throw new Error(
        `POST-CONDIZIONE ROTTA: i fattori non-'${ETICHETTA}' sono ${altriDopo.rows[0]!.n} invece di ${altriPrima}.`,
      );
    }
    if (scritti !== daFare.length) {
      throw new Error(`POST-CONDIZIONE ROTTA: scritti ${scritti} su ${daFare.length} bersagli.`);
    }

    // ── LA PROVA CHE IL LAVORO È RIUSCITO ───────────────────────────────────────
    // Non «ho scritto», ma «il segreto non si ricostruisce più dalla chiave madre». È la
    // sola affermazione che chiude la voce, e si misura provando a ricostruirlo davvero.
    const master = readMaster();
    let ancoraDerivabili = 0;
    for (const r of daFare) {
      const q = await db.query<{ s: string }>(
        `SELECT auth_mfa_factor_secret AS s FROM sys.sys_auth_mfa_factors
          WHERE auth_mfa_factor_id = $1`,
        [r.id],
      );
      const inChiaro = decryptSecret(q.rows[0]!.s);
      if (inChiaro === deriveTotpSecret(master, r.email)) ancoraDerivabili++;
    }
    if (ancoraDerivabili !== 0) {
      throw new Error(
        `LA VOCE NON È CHIUSA: ${ancoraDerivabili} segreti si ricostruiscono ancora dalla ` +
          `chiave madre. Riapplica il giornale con --undo e indaga.`,
      );
    }

    console.log(
      `\nESITO: OK — ${scritti} segreti resi casuali · ${fattoriPrima} fattori totali ` +
        `invariati · ${altriPrima} fattori di altro tipo intatti`,
    );
    console.log(
      `PROVA: ricostruiti dalla chiave madre tutti e ${daFare.length}, ` +
        `combaciano in ${ancoraDerivabili} casi (atteso 0)`,
    );
    console.log(`ROLLBACK: pnpm db:stop-deriving-totp --undo (${giornalate} righe in giornale)`);
  } finally {
    await db.end();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
