/**
 * apps/api/scripts/derive-access.mjs
 * Z-262 — LA derivazione delle credenziali. Modulo puro, senza effetti
 * collaterali: importato sia da dev-whoami.mjs (consultazione) sia dal
 * provisioning. Una sola implementazione — due copie divergono, e quando
 * divergono producono password che il server rifiuta senza spiegare perche'.
 */
import { createHmac } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const MASTER_PATH = join(REPO, ".secrets", "dev-access-master.key");

/** Domini le cui persone sono REALI: password scelte da loro, mai derivate
 *  (decisione di Enzo, S1032). Nessuno, nemmeno chi ha la chiave madre, deve
 *  poter entrare al posto loro. */
export const REAL_PERSON_DOMAINS = ["heuresys.com"];

export function isRealPerson(email) {
  return REAL_PERSON_DOMAINS.includes(email.split("@")[1]?.toLowerCase() ?? "");
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
  if (!existsSync(MASTER_PATH)) {
    throw new Error(
      "Chiave madre assente: .secrets/dev-access-master.key\n" +
        "Non si rigenera: rigenerarla cambierebbe TUTTE le password. Arriva dagli " +
        "script di allineamento (sync-gitignored-to-vm.sh, align-clones.sh).",
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
