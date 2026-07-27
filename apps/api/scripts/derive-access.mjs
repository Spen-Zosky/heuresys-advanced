/**
 * apps/api/scripts/derive-access.mjs
 * Z-262 — LA derivazione delle credenziali. Modulo puro, senza effetti
 * collaterali: importato sia da dev-whoami.mjs (consultazione) sia dal
 * provisioning. Una sola implementazione — due copie divergono, e quando
 * divergono producono password che il server rifiuta senza spiegare perche'.
 */
import { createHmac } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * La radice del repository, trovata risalendo da cwd fino al marker del
 * workspace.
 *
 * Non si usa `import.meta.url`: questo modulo è importato anche dalla suite
 * Playwright, che lo transpila in CommonJS — e lì `import.meta` è un errore di
 * SINTASSI, quindi non è un ramo evitabile a runtime. Z-262 ha aggiunto quella
 * dipendenza e la suite E2E ha smesso di caricarsi ("No tests found", che
 * sembra un problema di filtri e invece è un modulo che non compila).
 * Test e script girano sempre dentro il repository, quindi la risalita è
 * affidabile quanto il percorso calcolato dal file.
 */
function findRepoRoot() {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

export const REPO = findRepoRoot();
export const MASTER_PATH = join(REPO, ".secrets", "dev-access-master.key");

/** Le PERSONE FISICHE: password scelte da loro, mai derivate (decisione di
 *  Enzo, S1032). Nessuno, nemmeno chi ha la chiave madre, deve poter entrare
 *  al posto loro.
 *
 *  L'elenco e' per indirizzo e non per dominio: `admin@heuresys.com` sta sullo
 *  stesso dominio ma NON e' una persona — e' l'account di servizio da cui
 *  passano 133 file fra test e script. Escluderlo lo lascerebbe senza secondo
 *  fattore nel momento in cui si rimuovono quelli con i segreti pubblicati. */
export const REAL_PERSON_EMAILS = [
  "enzo.spenuso@heuresys.com",
  "chiara.spenuso@heuresys.com",
  "andrea.spenuso@heuresys.com",
];

export function isRealPerson(email) {
  return REAL_PERSON_EMAILS.includes(email.toLowerCase());
}

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function toBase32(buf) {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function readMaster() {
  // In CI il repository viene clonato in un'area di lavoro del runner, dove
  // `.secrets/` NON arriva (è gitignored, quindi il checkout non lo porta).
  // Là la chiave viaggia come variabile d'ambiente, per la stessa via degli
  // altri segreti del runner — copiare il file in una cartella che il runner
  // può ripulire sarebbe una soluzione che si rompe da sola.
  const fromEnv = process.env.DEV_ACCESS_MASTER_KEY_B64;
  if (fromEnv && fromEnv.length > 0) {
    const buf = Buffer.from(fromEnv, "base64");
    if (buf.length < 32) {
      throw new Error("DEV_ACCESS_MASTER_KEY_B64 decodifica a meno di 32 byte: segreto debole, rifiutato.");
    }
    return buf;
  }
  if (!existsSync(MASTER_PATH)) {
    throw new Error(
      "Chiave madre assente: né .secrets/dev-access-master.key né DEV_ACCESS_MASTER_KEY_B64.\n" +
        "Non si rigenera: rigenerarla cambierebbe TUTTE le password. Sulle macchine di sviluppo " +
        "arriva dagli script di allineamento; in CI dalla variabile d'ambiente del runner.",
    );
  }
  const raw = readFileSync(MASTER_PATH);
  if (raw.length < 32) {
    throw new Error("Chiave madre troppo corta (<32 byte): rifiuto di derivare da un segreto debole.");
  }
  return raw;
}

/** Password leggibile: 20 caratteri base32 a gruppi di 4, ~100 bit di entropia. */
export function derivePassword(master, email) {
  const h = createHmac("sha256", master).update(`pwd:v1:${email.toLowerCase()}`).digest();
  return (toBase32(h.subarray(0, 13)).slice(0, 20).match(/.{1,4}/g) ?? []).join("-");
}

/** Segreto TOTP standard: 160 bit in base32, come lo vuole ogni authenticator. */
export function deriveTotpSecret(master, email) {
  const h = createHmac("sha256", master).update(`totp:v1:${email.toLowerCase()}`).digest();
  return toBase32(h.subarray(0, 20));
}
