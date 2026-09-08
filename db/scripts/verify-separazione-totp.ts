/**
 * db/scripts/verify-separazione-totp.ts — #169 F4, la prova che deve poter fallire.
 *
 * Run: pnpm db:verify-separazione-totp        (sola lettura, exit 1 se la proprietà è violata)
 *
 * ── Che cosa misura, e perché non bastava quello che c'era ────────────────────────────
 *
 * La voce `#169` dice che password e secondo fattore non devono nascere dalla stessa chiave.
 * Dopo F3c i segreti TOTP sono **casuali**, quindi chi possiede la chiave madre non dovrebbe
 * più ricostruirne nemmeno uno. Ma «dovrebbe» non è una misura, e finora nessuno strumento
 * misurava **quella proprietà**.
 *
 * ⚠ `stop-deriving-totp.ts --dry-run` sembra dirlo e non lo dice: il suo
 * «DA RENDERE CASUALI: 159» conta i fattori che portano l'etichetta `derived-access`, cioè
 * **la portata dell'operazione**, non quanti siano ancora derivabili. Rieseguito su un
 * database già bonificato stampa lo stesso numero. È il difetto che questo progetto ha già
 * nominato una volta — *un conteggio può misurare la portata invece del titolo* — e qui
 * avrebbe fatto concludere che F3c non fosse mai stata applicata.
 *
 * Questo strumento misura invece la **proprietà**: per ogni fattore TOTP, ri-deriva il
 * segreto dalla chiave madre e lo confronta con quello davvero in uso, decifrandolo.
 * Atteso: **zero corrispondenze**. Una sola corrispondenza è la voce `#169` non chiusa.
 *
 * ── Perché c'è una controprova, e perché senza non varrebbe niente ────────────────────
 *
 * Uno zero può nascere da due cose molto diverse: la proprietà regge, **oppure** il
 * confronto non funziona — chiave madre non letta, decifratura muta, derivazione cambiata
 * di forma. Le due si assomigliano moltissimo, e la seconda è un falso verde: in questa
 * stessa sessione un altro strumento ne ha prodotto uno.
 *
 * Quindi prima di dichiarare l'esito lo strumento **prova a fallire**: costruisce un caso in
 * cui la corrispondenza c'è per costruzione e verifica di saperla vedere. Se non la vede,
 * non dice «tutto bene»: dice che non è in grado di misurare, ed esce **2**.
 *
 * Uscite: 0 = separati · 1 = almeno un segreto è ancora derivabile · 2 = NON MISURABILE.
 */

import { Client } from "pg";
import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readMaster, deriveTotpSecret, derivePassword } from "../../apps/api/scripts/derive-access.mjs";
import { decryptSecret, isEncrypted } from "../../apps/api/src/modules/auth/secret-crypto.js";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(__filename), "..", "..");
dotenvConfig({ path: resolve(repoRoot, ".env") });

type Riga = { id: string; email: string; segreto: string | null };

/** Il confronto, isolato apposta: è ciò che la controprova mette alla prova. */
function eDerivabile(master: Buffer, email: string, segretoInUso: string): boolean {
  return deriveTotpSecret(master, email) === segretoInUso;
}

async function main(): Promise<void> {
  const master = readMaster();

  // ── LA CONTROPROVA, prima della misura ──────────────────────────────────────────────
  // Un'email qualunque, il suo segreto derivato, e la domanda: il confronto lo riconosce?
  // Se qui dicesse "no", ogni zero della misura vera sarebbe cieco.
  const emailDiProva = "controprova@esempio.invalid";
  const segretoDerivato = deriveTotpSecret(master, emailDiProva);
  if (!eDerivabile(master, emailDiProva, segretoDerivato)) {
    console.error(
      "NON MISURABILE: il confronto non riconosce nemmeno un segreto derivato da se stesso.\n" +
        "Uno zero prodotto da questo strumento sarebbe un falso verde, quindi non lo dichiaro.",
    );
    process.exitCode = 2;
    return;
  }
  // E il verso opposto: non deve dire di sì a un segreto che derivato non è.
  if (eDerivabile(master, emailDiProva, "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")) {
    console.error("NON MISURABILE: il confronto dice di si' anche a un segreto estraneo.");
    process.exitCode = 2;
    return;
  }
  console.log("controprova ..................... superata (il confronto vede, e non vede troppo)");

  const db = new Client({
    host: process.env.POSTGRES_HOST ?? "localhost",
    port: Number(process.env.POSTGRES_PORT ?? 5433),
    user: process.env.POSTGRES_USER ?? "heuresys",
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB ?? "heuresys_advanced",
  });
  await db.connect();

  try {
    // Nessun filtro per etichetta: la domanda di F4 riguarda **ogni** secondo fattore TOTP,
    // non solo quelli che una label dichiara nostri. Restringere qui sarebbe la stessa
    // scorciatoia che ha prodotto il conteggio ingannevole.
    const { rows } = await db.query<Riga>(
      `SELECT f.auth_mfa_factor_id AS id, u.user_email AS email,
              f.auth_mfa_factor_secret AS segreto
         FROM sys.sys_auth_mfa_factors f
         JOIN sys.sys_users u ON u.user_id = f.auth_mfa_factor_user_id
        WHERE f.auth_mfa_factor_kind = 'TOTP'
        ORDER BY u.user_email`,
    );

    let esaminati = 0;
    let cifrati = 0;
    let illeggibili = 0;
    const derivabili: string[] = [];

    for (const r of rows) {
      if (!r.segreto) continue;
      esaminati++;
      if (isEncrypted(r.segreto)) cifrati++;
      let inChiaro: string;
      try {
        inChiaro = decryptSecret(r.segreto);
      } catch {
        // Un segreto che non si riesce a leggere non è «a posto»: è non misurato, e va
        // detto. Contarlo fra i sani sarebbe il falso verde che questo strumento esiste
        // per evitare.
        illeggibili++;
        continue;
      }
      if (eDerivabile(master, r.email, inChiaro)) derivabili.push(r.email);
    }

    console.log(`fattori TOTP esaminati .......... ${esaminati}`);
    console.log(`di cui cifrati a riposo ......... ${cifrati}`);
    console.log(`NON leggibili (non misurati) .... ${illeggibili}`);
    console.log(`ANCORA DERIVABILI dalla chiave .. ${derivabili.length}`);

    if (illeggibili > 0) {
      console.error(
        `\nNON MISURABILE: ${illeggibili} segreti non si sono potuti leggere. ` +
          `"Non ho potuto guardare" non e' "va bene".`,
      );
      process.exitCode = 2;
      return;
    }

    if (derivabili.length > 0) {
      console.error(
        `\nVIOLATA (#169 F4): chi possiede la chiave madre ricostruisce ancora ` +
          `${derivabili.length} secondi fattori. I primi: ${derivabili.slice(0, 5).join(", ")}`,
      );
      process.exitCode = 1;
      return;
    }

    console.log(
      "\nSEPARATI: nessun secondo fattore si ottiene dalla chiave madre (#169 F4, primo corno).",
    );

    // ── IL SECONDO CORNO ────────────────────────────────────────────────────────────────
    // F4 non chiede solo che il segreto non si derivi: chiede che con la chiave madre in mano
    // **completare** un accesso da amministratore risulti impossibile. Sono due cose diverse, e
    // fermarsi alla prima sarebbe la frase più larga della misura: la separazione dei segreti
    // protegge solo dove il secondo fattore viene davvero chiesto.
    const api = process.env.VERIFICA_API_BASE ?? process.argv[2];
    if (!api) {
      console.log(
        "\nsecondo corno ................... NON MISURATO (nessuna API indicata).\n" +
          "  Passa l'URL: pnpm db:verify-separazione-totp https://www.heuresys.com/api",
      );
      return;
    }
    await provaAccessoAmministrativo(api, master);
  } finally {
    await db.end();
  }
}

/**
 * Con la sola chiave madre, si completa un accesso da amministratore?
 *
 * Non è una domanda sulla derivazione: è una domanda sull'**esito**. Se l'ambiente chiede il
 * secondo fattore, la password derivata si ferma al passo due e F4 regge; se non lo chiede, la
 * password da sola basta — e allora la separazione dei segreti, per quanto vera, lì non protegge.
 */
async function provaAccessoAmministrativo(api: string, master: Buffer): Promise<void> {
  const amministratore = "enzo.spenuso@heuresys.com";
  let esito: { status?: string; roles?: string[]; permissions?: unknown[] };
  let http: number;
  try {
    const r = await fetch(`${api.replace(/\/$/, "")}/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: amministratore, password: derivePassword(master, amministratore) }),
    });
    http = r.status;
    esito = (await r.json().catch(() => ({}))) as typeof esito;
  } catch (e) {
    console.log(`\nsecondo corno ................... NON MISURATO (${api} non risponde: ${String(e)})`);
    process.exitCode = 2;
    return;
  }

  if (http === 200 && esito.status === "success") {
    const ruoli = esito.roles ?? [];
    const permessi = Array.isArray(esito.permissions) ? esito.permissions.length : 0;
    console.log(
      `\nsecondo corno ................... VIOLATO su ${api}\n` +
        `  Con la sola chiave madre si completa un accesso in UN passo come ${ruoli.join(", ")} ` +
        `(${permessi} permessi).\n` +
        `  Non è un difetto della separazione dei segreti, che regge: è l'enforcement MFA spento\n` +
        `  su questo ambiente. Finché lo è, la password derivata è sufficiente da sola.`,
    );
    process.exitCode = 1;
    return;
  }

  if (esito.status === "mfa_required") {
    console.log(
      `\nsecondo corno ................... SUPERATO su ${api}\n` +
        `  La chiave madre ottiene la password ma si ferma al secondo fattore, che è casuale.`,
    );
    return;
  }

  console.log(`\nsecondo corno ................... l'accesso non si completa (HTTP ${http}).`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
