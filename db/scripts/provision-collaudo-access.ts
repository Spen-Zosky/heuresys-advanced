/**
 * db/scripts/provision-collaudo-access.ts
 * #169 F2 — crea le utenze di collaudo (direttiva Enzo 2026-08-25, S1080; nato con TRE,
 * mandato K R-9 2026-09-17 ne aggiunge due per i primi ruoli di piattaforma non-admin —
 * l'elenco vero è COLLAUDO_IDENTITIES, non un numero scritto qui):
 * identità `SERVICE` su dominio `.invalid`, mandati VERI (mai ruoli-ombra,
 * ADR-0036), credenziali derivate da una chiave PROPRIA (.secrets/collaudo-
 * access.key — mai la chiave madre delle persone), esenzione dal secondo
 * fattore col meccanismo esistente (mig 000116/000118: solo SERVICE, con
 * audit). NESSUN fattore TOTP: l'autonomia dell'accesso sta nell'esenzione,
 * non in un segreto in più da custodire.
 *
 * Le quattro cose di ogni scrittura (db-migrations.md):
 *  (a) misura prima  — conteggi STANDARD/SERVICE letti in apertura
 *  (b) guardia       — un'email già presente con user_type ≠ SERVICE ferma tutto;
 *                      l'idoneità SERVICE-only dell'esenzione la ri-verifica il
 *                      trigger della 000118 al momento dell'INSERT
 *  (c) post-condizione su ciò che NON deve cambiare — il conteggio degli
 *      STANDARD resta identico; la sentinella v_user_census_deviation resta 0
 *  (d) rollback      — `--undo`: elenco esplicito delle tre email, cancellazioni
 *                      ordinate (credenziali → identità → ruoli → esenzioni via
 *                      CASCADE → utenti). Mai un carattere jolly.
 *
 * Idempotente: due corse di fila = 0 scritture.
 *   pnpm db:provision-collaudo --dry-run
 *   pnpm db:provision-collaudo
 *   pnpm db:provision-collaudo --undo
 */
import { Client } from "pg";
import argon2 from "argon2";
import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  readCollaudoKey,
  deriveCollaudoPassword,
  COLLAUDO_IDENTITIES,
} from "../../apps/api/scripts/collaudo-access.mjs";
import { segretoTotpCasuale } from "../../apps/api/scripts/derive-access.mjs";
import { encryptSecret } from "../../apps/api/src/modules/auth/secret-crypto.js";
import { E2E_FIXTURE_LABEL } from "../../apps/api/test/helpers/mfa-fixture-secrets.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
dotenvConfig({ path: resolve(repoRoot, ".env"), quiet: true });

/** Stessi parametri del server (ADR-0005). Non "simili": gli stessi. */
const ARGON2_PARAMS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
} as const;

const DRY = process.argv.includes("--dry-run");
const UNDO = process.argv.includes("--undo");
/**
 * `--riallinea` — riporta le tre utenze alla LORO chiave, quando qualcosa gliel'ha tolta
 * (#169 F3b, S1091 — 2026-09-07).
 *
 * Perche' esiste, misurato in produzione quel giorno: le tre entravano con la password
 * derivata dalla CHIAVE MADRE (HTTP 200) e NON con la propria (HTTP 401) — il rovescio
 * esatto di cio' che F2 aveva provato il 2026-08-25 — e portavano un fattore TOTP
 * `VERIFIED` che il modello di collaudo non prevede. La cronologia lo dice senza margini:
 * credenziale del 25 agosto `rotated_at = 31 agosto`, credenziale nuova e fattore TOTP
 * entrambi creati il 31. Quel giorno le tre sono state «riparate» con
 * `provision-derived-access --solo=`, che deriva TUTTO dalla chiave madre.
 * Effetto: chi possiede la chiave madre completava un accesso come
 * `piattaforma@collaudo.invalid`, che e' PLATFORM_ADMIN ed e' esente dal secondo fattore.
 * E' alla lettera cio' che #169 F4 dichiara debba essere IMPOSSIBILE.
 *
 * La via che ha prodotto il guasto e' ora chiusa a monte da una guardia strutturale su
 * `user_type = 'SERVICE'` in `provision-derived-access.ts`. Questo flag rimedia
 * all'esemplare gia' presente — che una guardia, da sola, non disfa.
 *
 * Le quattro cose di ogni scrittura di massa, anche per tre righe:
 *  (a) misura prima  — credenziali correnti e fattori, contati e stampati
 *  (b) guardia       — agisce SOLO sulle tre email di COLLAUDO_IDENTITIES e SOLO se
 *                      `user_type = 'SERVICE'`: elenco esplicito, mai un carattere jolly
 *  (c) post-condizione — gli STANDARD restano identici e la sentinella del censimento
 *                      resta a zero (gia' presenti in coda a main), e in piu' i fattori
 *                      delle PERSONE non cambiano di numero
 *  (d) rollback      — giornale `staging.collaudo_riallineo_undo`, popolato PRIMA di
 *                      toccare qualunque cosa: porta l'hash e il segreto rimossi, cosi'
 *                      lo stato del 31 agosto e' ricostruibile riga per riga
 */
const RIALLINEA = process.argv.includes("--riallinea");
const UNDO_REASON =
  "#169 F3b (S1091, 2026-09-07): rimosso perche' derivato dalla CHIAVE MADRE invece che " +
  "dalla chiave di collaudo. Misurato live: password di collaudo 401, password da chiave " +
  "madre 200 su tutte e tre. Introdotto il 2026-08-31 da provision-derived-access --solo=.";
const DISALLINEO_REASON =
  "D11-0 (2026-09-24): ruotata dalla VERIFICA automatica, non da --riallinea. L'hash corrente " +
  "non verifica contro la password derivata dalla chiave di collaudo di questa macchina: la " +
  "credenziale era nata da un'altra chiave (misurato in CI, corsa 36052896981: login 401 su " +
  "cinque identita' create il 19/09 fra le 04:44 e le 05:04).";
const EXEMPTION_REASON =
  "collaudo-access (#169 F2, direttiva Enzo 2026-08-25): utenza di collaudo SERVICE, " +
  "verifiche funzionali e frontend senza il rito di login delle persone reali";

function fail(msg: string): never {
  throw new Error(msg);
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
  const emails = COLLAUDO_IDENTITIES.map((c) => c.email);

  try {
    if (UNDO) {
      // Rollback dichiarato: elenco esplicito, ordine dal dipendente al padrone.
      await db.query("BEGIN");
      const u = await db.query(
        `SELECT user_id, user_email FROM sys.sys_users
          WHERE user_email = ANY($1) AND user_type = 'SERVICE'`,
        [emails],
      );
      const ids = u.rows.map((r) => r.user_id);
      const cred = await db.query(
        `DELETE FROM sys.sys_auth_credentials WHERE auth_credential_identity_id IN
           (SELECT auth_identity_id FROM sys.sys_auth_identities WHERE auth_identity_user_id = ANY($1))`,
        [ids],
      );
      const iden = await db.query(
        `DELETE FROM sys.sys_auth_identities WHERE auth_identity_user_id = ANY($1)`, [ids]);
      const role = await db.query(
        `DELETE FROM sys.sys_user_auth_roles WHERE user_auth_role_user_id = ANY($1)`, [ids]);
      const users = await db.query(
        `DELETE FROM sys.sys_users WHERE user_id = ANY($1)`, [ids]);
      await db.query("COMMIT");
      console.log(`UNDO: credenziali ${cred.rowCount} · identita' ${iden.rowCount} · ruoli ${role.rowCount} · utenti ${users.rowCount} (esenzioni via CASCADE)`);
      return;
    }

    const key = readCollaudoKey();

    // (a) misura prima
    const before = await db.query<{ std: string; srv: string }>(
      `SELECT count(*) FILTER (WHERE user_type = 'STANDARD')::text AS std,
              count(*) FILTER (WHERE user_type = 'SERVICE')::text  AS srv
         FROM sys.sys_users`,
    );
    const stdBefore = before.rows[0]!.std;
    console.log(`misura prima: STANDARD=${stdBefore} SERVICE=${before.rows[0]!.srv}`);

    // (a) misura prima, parte seconda — serve solo a `--riallinea`, ma si prende SEMPRE:
    //     e' la post-condizione (c) a pretenderla, e una misura presa solo nel ramo che
    //     la usa e' una misura che al primo cambio di ramo sparisce.
    const facBefore = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_auth_mfa_factors f
         JOIN sys.sys_users u ON u.user_id = f.auth_mfa_factor_user_id
        WHERE u.user_type <> 'SERVICE'`);
    const fattoriPersoneBefore = facBefore.rows[0]!.n;

    const stats = {
      utenti: 0, ruoli: 0, identita: 0, credenziali: 0, iscrizioni: 0, esenzioni: 0,
      riallineate: 0, disallineate: 0, fattoriRimossi: 0, fattoriCreatiMfa: 0, invariati: 0,
    };

    await db.query("BEGIN");

    // (d) il giornale del rollback, creato PRIMA di qualunque scrittura. Vive in `staging`,
    //     che e' lo schema ausiliario dichiarato per questa materia (I3/I4).
    //
    // D11-0 (2026-09-24): non piu' solo per `--riallinea`. La verifica automatica qui sotto
    // puo' ruotare una credenziale disallineata anche senza il flag, e una rotazione senza
    // giornale sarebbe una scrittura senza rollback dichiarato. Resta un CREATE TABLE IF
    // NOT EXISTS: su un database che non ha mai avuto disallineamenti nasce vuota e basta.
    if (!DRY) {
      await db.query(`
        CREATE TABLE IF NOT EXISTS staging.collaudo_riallineo_undo (
          undo_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          undo_email   varchar(255) NOT NULL,
          undo_specie  varchar(64)  NOT NULL,
          undo_valore  text         NOT NULL,
          undo_ragione text         NOT NULL,
          undo_at      timestamptz  NOT NULL DEFAULT now()
        )`);
      await db.query(`COMMENT ON TABLE staging.collaudo_riallineo_undo IS
        'GIORNALE DI ROLLBACK (#169 F3b, 2026-09-07). Porta gli hash di credenziale e i '
        'segreti di fattore RIMOSSI dalle tre utenze di collaudo quando sono state riportate '
        'alla loro chiave propria. Ogni riga rende ricostruibile lo stato precedente. Non e'' '
        'una tabella di lavoro: non si svuota per fare spazio.'`);
    }
    for (const c of COLLAUDO_IDENTITIES) {
      let touched = false;

      const ten = await db.query<{ tenant_id: string }>(
        `SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = $1`, [c.tenantCode]);
      const tenantId = ten.rows[0]?.tenant_id ?? fail(`tenant ${c.tenantCode} assente`);
      const rol = await db.query<{ auth_role_id: string }>(
        `SELECT auth_role_id FROM sys.sys_auth_roles WHERE auth_role_code = $1`, [c.roleCode]);
      const roleId = rol.rows[0]?.auth_role_id ?? fail(`ruolo ${c.roleCode} assente`);

      // (b) guardia: mai sovrascrivere un'utenza che non e' di collaudo
      const ex = await db.query<{ user_id: string; user_type: string }>(
        `SELECT user_id, user_type FROM sys.sys_users WHERE lower(user_email) = $1`,
        [c.email]);
      if (ex.rows[0] && ex.rows[0].user_type !== "SERVICE") {
        fail(`${c.email} esiste con user_type=${ex.rows[0].user_type}: non la tocco`);
      }
      let userId = ex.rows[0]?.user_id;
      if (!userId) {
        stats.utenti++; touched = true;
        if (!DRY) {
          const ins = await db.query<{ user_id: string }>(
            `INSERT INTO sys.sys_users (user_tenant_id, user_email, user_display_name, user_type, user_status)
             VALUES ($1, $2, $3, 'SERVICE', 'ACTIVE') RETURNING user_id`,
            [tenantId, c.email, c.displayName]);
          userId = ins.rows[0]!.user_id;
        }
      }
      if (!userId) {
        // dry-run su utente nuovo: nessun userId da interrogare, la stima segue lo stesso
        // ramo (esente vs #258) che seguirebbe l'esecuzione vera.
        stats.ruoli++; stats.identita++; stats.credenziali++;
        if (c.mfaExempt === false) stats.fattoriCreatiMfa++; else stats.esenzioni++;
        continue;
      }

      const hasRole = await db.query(
        `SELECT 1 FROM sys.sys_user_auth_roles
          WHERE user_auth_role_user_id = $1 AND user_auth_role_role_id = $2
            AND user_auth_role_revoked_at IS NULL`, [userId, roleId]);
      if (hasRole.rowCount === 0) {
        stats.ruoli++; touched = true;
        if (!DRY) await db.query(
          `INSERT INTO sys.sys_user_auth_roles (user_auth_role_user_id, user_auth_role_role_id, user_auth_role_tenant_id)
           VALUES ($1, $2, $3)`, [userId, roleId, tenantId]);
      }

      const ident = await db.query<{ auth_identity_id: string }>(
        `SELECT auth_identity_id FROM sys.sys_auth_identities
          WHERE auth_identity_user_id = $1 AND auth_identity_provider = 'LOCAL'`, [userId]);
      let identityId = ident.rows[0]?.auth_identity_id;
      if (!identityId) {
        stats.identita++; touched = true;
        if (!DRY) {
          const ins = await db.query<{ auth_identity_id: string }>(
            `INSERT INTO sys.sys_auth_identities
               (auth_identity_user_id, auth_identity_provider, auth_identity_provider_subject,
                auth_identity_email_verified, auth_identity_is_active)
             VALUES ($1, 'LOCAL', $2, true, true) RETURNING auth_identity_id`,
            [userId, c.email]);
          identityId = ins.rows[0]!.auth_identity_id;
        }
      }
      if (identityId) {
        const cred = await db.query<{ n: string; h: string | null }>(
          `SELECT count(*)::text AS n, max(auth_credential_hash) AS h
             FROM sys.sys_auth_credentials
            WHERE auth_credential_identity_id = $1 AND auth_credential_is_current`, [identityId]);
        /**
         * D11-0 (2026-09-24) — LA VERIFICA, non piu' un flag da ricordarsi.
         *
         * C3 del CLAUDE.md di progetto: «un seed porta a uno STATO DICHIARATO, non negozia
         * con quello che trova». Lo stato dichiarato qui e': la credenziale corrente deriva
         * dalla chiave di collaudo di QUESTA macchina. Fino a oggi lo script verificava solo
         * che una credenziale ESISTESSE — e una credenziale nata da un'altra chiave passava
         * per «gia' a posto», con il login a 401 e nessuno strumento che lo dicesse.
         *
         * Misurato quel giorno (corsa CI 36052896981, 6 file rossi da due giorni): su
         * heuresys_ci le cinque identita' create il 19/09 fra le 04:44 e le 05:04 portavano
         * l'hash della chiave `.secrets/collaudo-access.key` del PC/gemello, mentre il runner
         * deriva dalla PROPRIA chiave (drop-in systemd, impronte diverse: a4191764 vs
         * 591962ed). Le identita' create dalle 08:59 in poi — quelle nate dentro la CI —
         * erano verdi. Il taglio nei timestamp e' netto e non lascia altra lettura.
         *
         * Costo: una `argon2.verify` per identita' (~14), a fronte di una CI rossa che senza
         * questa riga si ripresenta ogni volta che una chiave cambia o una credenziale nasce
         * altrove. La rotazione resta protetta dalle stesse quattro cose di `--riallinea`:
         * giornale PRIMA, elenco esplicito, post-condizioni in coda.
         */
        let disallineata = false;
        if (cred.rows[0]!.n !== "0" && cred.rows[0]!.h) {
          disallineata = !(await argon2.verify(
            cred.rows[0]!.h, deriveCollaudoPassword(key, c.email)));
        }
        // --riallinea: rotazione INCONDIZIONATA (resta, per il caso in cui si voglia ruotare
        // anche una credenziale che verifica). `disallineata`: rotazione MISURATA.
        if ((RIALLINEA || disallineata) && cred.rows[0]!.n !== "0") {
          stats.riallineate++; touched = true;
          if (disallineata && !RIALLINEA) stats.disallineate++;
          if (!DRY) {
            await db.query(
              `INSERT INTO staging.collaudo_riallineo_undo
                 (undo_email, undo_specie, undo_valore, undo_ragione)
               SELECT $1, 'credenziale', auth_credential_hash, $2
                 FROM sys.sys_auth_credentials
                WHERE auth_credential_identity_id = $3 AND auth_credential_is_current`,
              [c.email, disallineata && !RIALLINEA ? DISALLINEO_REASON : UNDO_REASON, identityId]);
            await db.query(
              `UPDATE sys.sys_auth_credentials
                  SET auth_credential_is_current = false, rotated_at = now()
                WHERE auth_credential_identity_id = $1 AND auth_credential_is_current`, [identityId]);
          }
        }
        // `|| RIALLINEA` e non `|| (RIALLINEA && !DRY)`: la seconda forma faceva dire al
        // dry-run «credenziali create 0» mentre l'esecuzione vera ne avrebbe create 3. Un
        // giro a vuoto che sottostima e' peggio che inutile — e' la stessa lezione gia'
        // scritta nel gemello di questo script.
        if (cred.rows[0]!.n === "0" || RIALLINEA || disallineata) {
          stats.credenziali++; touched = true;
          if (!DRY) {
            const hash = await argon2.hash(deriveCollaudoPassword(key, c.email), ARGON2_PARAMS);
            await db.query(
              `INSERT INTO sys.sys_auth_credentials
                 (auth_credential_identity_id, auth_credential_algorithm, auth_credential_hash,
                  auth_credential_is_current, auth_credential_must_rotate)
               VALUES ($1, 'ARGON2ID', $2, true, false)`, [identityId, hash]);
          }
        }
      } else if (DRY) { stats.credenziali++; }

      // #258: questa identita' NON e' esente (mfaExempt: false) — cammina l'MFA vera come le
      // cinque persone RTL, e non deve MAI entrare nell'elenco di esenzione. I due rami sono
      // speculari apposta: uno garantisce l'assenza di un fattore, l'altro la sua presenza.
      const mfaExempt = c.mfaExempt !== false;

      if (mfaExempt) {
        // #139 / mig 000284: l'esenzione pretende TRE atti distinti — SERVICE,
        // iscrizione nominativa, esenzione. Questo e' il secondo: l'atto
        // deliberato e' la direttiva di Enzo del 2026-08-25 (register #169),
        // e la ragione la cita per iscritto.
        const eligible = await db.query(
          `SELECT 1 FROM sys.sys_auth_mfa_exemption_eligible_users
            WHERE auth_mfa_eligible_user_id = $1`, [userId]);
        if (eligible.rowCount === 0) {
          stats.iscrizioni++; touched = true;
          if (!DRY) await db.query(
            `INSERT INTO sys.sys_auth_mfa_exemption_eligible_users
               (auth_mfa_eligible_user_id, auth_mfa_eligible_reason)
             VALUES ($1, $2) ON CONFLICT (auth_mfa_eligible_user_id) DO NOTHING`,
            [userId, EXEMPTION_REASON]);
        }

        const exemption = await db.query(
          `SELECT 1 FROM sys.sys_auth_mfa_exemptions WHERE auth_mfa_exemption_user_id = $1
             AND auth_mfa_exemption_enabled`, [userId]);
        if (exemption.rowCount === 0) {
          stats.esenzioni++; touched = true;
          // il trigger della 000118 RI-VERIFICA qui che l'utente sia SERVICE:
          // la guardia vive nel database, non in questa riga.
          if (!DRY) await db.query(
            `INSERT INTO sys.sys_auth_mfa_exemptions (auth_mfa_exemption_user_id, auth_mfa_exemption_reason)
             VALUES ($1, $2)
             ON CONFLICT (auth_mfa_exemption_user_id)
             DO UPDATE SET auth_mfa_exemption_enabled = true, auth_mfa_exemption_reason = EXCLUDED.auth_mfa_exemption_reason`,
            [userId, EXEMPTION_REASON]);
        }

        // un fattore TOTP su un'utenza di collaudo esente sarebbe un segreto di troppo
        const fac = await db.query<{ n: string }>(
          `SELECT count(*)::text AS n FROM sys.sys_auth_mfa_factors WHERE auth_mfa_factor_user_id = $1`,
          [userId]);
        if (fac.rows[0]!.n !== "0") {
          // Senza `--riallinea` ci si FERMA, ed e' giusto cosi': un fattore che non dovrebbe
          // esserci e' un fatto da guardare, non da assorbire in silenzio. Con `--riallinea`
          // lo si toglie, ma prima lo si scrive nel giornale: il segreto rimosso e' l'unica
          // cosa che rende lo stato precedente ricostruibile.
          if (!RIALLINEA) fail(`${c.email} ha ${fac.rows[0]!.n} fattori MFA: non previsto, fermati e guarda`);
          stats.fattoriRimossi += Number(fac.rows[0]!.n); touched = true;
          if (!DRY) {
            await db.query(
              `INSERT INTO staging.collaudo_riallineo_undo
                 (undo_email, undo_specie, undo_valore, undo_ragione)
               SELECT $1, 'fattore-' || lower(auth_mfa_factor_kind), auth_mfa_factor_secret, $2
                 FROM sys.sys_auth_mfa_factors WHERE auth_mfa_factor_user_id = $3`,
              [c.email, UNDO_REASON, userId]);
            // elenco esplicito: si cancella per user_id di UNA delle identita' dichiarate in
            // COLLAUDO_IDENTITIES, gia' verificata SERVICE piu' sopra. Mai un carattere jolly.
            await db.query(
              `DELETE FROM sys.sys_auth_mfa_factors WHERE auth_mfa_factor_user_id = $1`, [userId]);
          }
        }
      } else {
        // #258 — ramo speculare: MAI iscritta, MAI esente. Se lo fosse (un errore di dati
        // precedente, o una migrazione futura che tocca l'allowlist), e' un fatto da guardare,
        // non da assorbire: un PLATFORM_ADMIN che i test usano per provare la sfida MFA non
        // deve poter risultare esente da essa.
        const giaEsente = await db.query(
          `SELECT 1 FROM sys.sys_auth_mfa_exemptions WHERE auth_mfa_exemption_user_id = $1
             AND auth_mfa_exemption_enabled`, [userId]);
        if ((giaEsente.rowCount ?? 0) > 0) {
          fail(`${c.email} e' dichiarata mfaExempt:false ma risulta ESENTE dal secondo fattore: fermati e guarda`);
        }

        const fac = await db.query<{ n: string }>(
          `SELECT count(*)::text AS n FROM sys.sys_auth_mfa_factors
             WHERE auth_mfa_factor_user_id = $1 AND auth_mfa_factor_kind = 'TOTP'
               AND auth_mfa_factor_metadata->>'label' = $2`,
          [userId, E2E_FIXTURE_LABEL]);
        if (fac.rows[0]!.n === "0") {
          stats.fattoriCreatiMfa++; touched = true;
          if (!DRY) {
            const secret = segretoTotpCasuale();
            await db.query(
              `INSERT INTO sys.sys_auth_mfa_factors
                 (auth_mfa_factor_user_id, auth_mfa_factor_kind, auth_mfa_factor_secret,
                  auth_mfa_factor_metadata, auth_mfa_factor_verified)
               VALUES ($1, 'TOTP', $2, jsonb_build_object('label', $3::text), true)`,
              [userId, encryptSecret(secret), E2E_FIXTURE_LABEL]);
          }
        }
      }

      if (!touched) stats.invariati++;
    }

    // (c) post-condizioni: cio' che NON doveva cambiare
    if (!DRY) {
      const after = await db.query<{ std: string }>(
        `SELECT count(*) FILTER (WHERE user_type = 'STANDARD')::text AS std FROM sys.sys_users`);
      if (after.rows[0]!.std !== stdBefore) {
        await db.query("ROLLBACK");
        fail(`gli STANDARD sono cambiati (${stdBefore} -> ${after.rows[0]!.std}): rollback`);
      }
      const sent = await db.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM sys.v_user_census_deviation`);
      if (sent.rows[0]!.n !== "0") {
        await db.query("ROLLBACK");
        fail(`la sentinella v_user_census_deviation non e' piu' a zero (${sent.rows[0]!.n}): rollback`);
      }
      // (c) la post-condizione che protegge cio' che NON doveva cambiare. `--riallinea`
      //     CANCELLA fattori MFA: la cosa da proteggere non e' il numero di fattori delle
      //     tre — quello DEVE andare a zero — ma quello delle PERSONE, che la DELETE non
      //     deve poter sfiorare. Senza questa riga un errore nella clausola WHERE
      //     lascerebbe 158 persone senza secondo fattore e nessuno se ne accorgerebbe qui.
      const facAfter = await db.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM sys.sys_auth_mfa_factors f
           JOIN sys.sys_users u ON u.user_id = f.auth_mfa_factor_user_id
          WHERE u.user_type <> 'SERVICE'`);
      if (facAfter.rows[0]!.n !== fattoriPersoneBefore) {
        await db.query("ROLLBACK");
        fail(
          `i fattori MFA delle PERSONE sono cambiati (${fattoriPersoneBefore} -> ` +
          `${facAfter.rows[0]!.n}): la cancellazione ha toccato chi non doveva. Rollback.`);
      }
    }
    await db.query(DRY ? "ROLLBACK" : "COMMIT");

    console.log(`
${DRY ? "DRY-RUN (nessuna scrittura)" : "ESEGUITO"}
  utenze create ................. ${stats.utenti}
  ruoli assegnati ............... ${stats.ruoli}
  identita' create .............. ${stats.identita}
  credenziali create ............ ${stats.credenziali}
  iscrizioni all'elenco (000284)  ${stats.iscrizioni}
  esenzioni MFA ................. ${stats.esenzioni}
  credenziali RIALLINEATE ....... ${stats.riallineate}   [#169 F3b: ruotate perche' non dalla chiave di collaudo]
  di cui DISALLINEATE misurate .. ${stats.disallineate}   [D11-0: l'hash non verifica contro la password derivata]
  fattori MFA rimossi ........... ${stats.fattoriRimossi}   [un segreto di troppo su un'utenza esente]
  fattori MFA creati (#258) ..... ${stats.fattoriCreatiMfa}   [identita' non esente: cammina l'MFA vera]
  gia' a posto (invariati) ...... ${stats.invariati}
  rollback dichiarato ........... pnpm db:provision-collaudo --undo  (elenco esplicito, mai un jolly)
`);
  } finally {
    await db.end();
  }
}

main().catch((e: unknown) => {
  console.error(`\n${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
