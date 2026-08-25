/**
 * apps/api/scripts/collaudo-access.mjs
 * #169 F2 — le utenze di collaudo (direttiva Enzo 2026-08-25): identità SERVICE
 * dedicate, con una chiave di derivazione PROPRIA, separata dalla chiave madre
 * delle persone. Chi ha la chiave madre non ottiene nulla su queste utenze, e
 * viceversa — è il criterio di chiusura della voce #169, non una comodità.
 *
 * Modulo puro come derive-access.mjs, e per la stessa ragione: una sola
 * implementazione, importata da provisioning e prove.
 */
import { createHmac } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { REPO, MASTER_PATH, toBase32 } from "./derive-access.mjs";

export const COLLAUDO_PATH = join(REPO, ".secrets", "collaudo-access.key");

/**
 * Le tre identità (progetto in .programmi/169-due-segreti-dalla-stessa-chiave.md):
 * SERVICE su dominio .invalid (RFC 2606 — non instradabile, e a colpo d'occhio
 * non è una persona), MANDATI VERI e non ruoli-ombra (ADR-0036: nessuna lista
 * di ruoli locale decide una vista; un COLLAUDO_* sarebbe un mandato ombra).
 */
export const COLLAUDO_IDENTITIES = [
  { email: "piattaforma@collaudo.invalid", displayName: "Collaudo Piattaforma",  tenantCode: "HEURESYS", roleCode: "PLATFORM_ADMIN" },
  { email: "governo@collaudo.invalid",     displayName: "Collaudo Governo",      tenantCode: "RTL_BANK", roleCode: "TENANT_ADMIN" },
  { email: "persona@collaudo.invalid",     displayName: "Collaudo Persona",      tenantCode: "RTL_BANK", roleCode: "USER" },
];

export function isCollaudoIdentity(email) {
  return COLLAUDO_IDENTITIES.some((c) => c.email === email.toLowerCase());
}

export function readCollaudoKey() {
  const fromEnv = process.env.COLLAUDO_ACCESS_KEY_B64;
  let raw;
  if (fromEnv && fromEnv.length > 0) {
    raw = Buffer.from(fromEnv, "base64");
  } else {
    if (!existsSync(COLLAUDO_PATH)) {
      throw new Error(
        "Chiave di collaudo assente: né .secrets/collaudo-access.key né COLLAUDO_ACCESS_KEY_B64.\n" +
          "Si genera UNA volta (48 byte casuali) e si propaga con gli script di allineamento, " +
          "come la chiave madre. Rigenerarla cambia le password delle sole utenze di collaudo.",
      );
    }
    raw = readFileSync(COLLAUDO_PATH);
  }
  if (raw.length < 32) {
    throw new Error("Chiave di collaudo troppo corta (<32 byte): rifiuto di derivare da un segreto debole.");
  }
  // La separazione deve essere REALE, non formale (#169 F2): se qualcuno copia
  // la chiave madre nel file di collaudo, le due tornano a essere una sola e
  // il criterio di chiusura della voce è violato. Qui si rifiuta, non si avvisa.
  if (existsSync(MASTER_PATH)) {
    const master = readFileSync(MASTER_PATH);
    if (master.length === raw.length && master.equals(raw)) {
      throw new Error("La chiave di collaudo E' la chiave madre: separazione formale, non reale. Rifiutata.");
    }
  }
  return raw;
}

/** Stessa forma leggibile della password derivata delle persone (20 char base32
 *  a gruppi di 4), ma da chiave e prefisso propri: le due derivazioni non
 *  condividono nessun segreto. */
export function deriveCollaudoPassword(key, email) {
  const h = createHmac("sha256", key).update(`collaudo-pwd:v1:${email.toLowerCase()}`).digest();
  return (toBase32(h.subarray(0, 13)).slice(0, 20).match(/.{1,4}/g) ?? []).join("-");
}
