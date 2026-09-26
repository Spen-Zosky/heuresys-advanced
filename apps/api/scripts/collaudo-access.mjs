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
 * Le identità (progetto in .programmi/169-due-segreti-dalla-stessa-chiave.md, nato con TRE):
 * SERVICE su dominio .invalid (RFC 2606 — non instradabile, e a colpo d'occhio
 * non è una persona), MANDATI VERI e non ruoli-ombra (ADR-0036: nessuna lista
 * di ruoli locale decide una vista; un COLLAUDO_* sarebbe un mandato ombra).
 *
 * Mandato K, R-9 (2026-09-17): due in più, per i primi ruoli di piattaforma che non sono
 * PLATFORM_ADMIN (D9=B) — tenantCode HEURESYS come piattaforma@collaudo.invalid, perché
 * "creati come utenti, non come persone di RTL" (mandato, passo 53). L'assegnazione a RTL
 * Bank via sys_platform_user_tenant_assignments (R-0) è un atto separato, fatto con l'API.
 */
export const COLLAUDO_IDENTITIES = [
  { email: "piattaforma@collaudo.invalid", displayName: "Collaudo Piattaforma",  tenantCode: "HEURESYS", roleCode: "PLATFORM_ADMIN" },
  { email: "governo@collaudo.invalid",     displayName: "Collaudo Governo",      tenantCode: "RTL_BANK", roleCode: "TENANT_ADMIN" },
  { email: "persona@collaudo.invalid",     displayName: "Collaudo Persona",      tenantCode: "RTL_BANK", roleCode: "USER" },
  { email: "platform-operator@collaudo.invalid", displayName: "Collaudo Platform Operator", tenantCode: "HEURESYS", roleCode: "PLATFORM_OPERATOR" },
  { email: "sales@collaudo.invalid",             displayName: "Collaudo Sales",             tenantCode: "HEURESYS", roleCode: "SALES" },
  // Mandato K, R-2 (2026-09-18): DPO e' un ruolo di CLIENTE (tenant-scoped, come
  // TENANT_ADMIN/HRMS_MANAGER — non entra in GDPR_MANDATE_ROLES), quindi la persona
  // di collaudo nasce su RTL_BANK come governo@collaudo.invalid, non su HEURESYS.
  { email: "dpo@collaudo.invalid",               displayName: "Collaudo DPO",               tenantCode: "RTL_BANK", roleCode: "DPO" },
  // Mandato K, R-7 (2026-09-19): SECURITY_ADMIN e' un ruolo di CLIENTE (tenant-scoped,
  // stesso vincolo di TENANT_ADMIN su grantRole/revokeRole/listRoles), quindi RTL_BANK.
  { email: "security-admin@collaudo.invalid",    displayName: "Collaudo Security Admin",    tenantCode: "RTL_BANK", roleCode: "SECURITY_ADMIN" },
  // Mandato K, R-3 (2026-09-19): TAXONOMY_STEWARD e' un ruolo di CLIENTE (governo lato
  // cliente della tassonomia di competenze/ruoli professionali), quindi RTL_BANK.
  { email: "taxonomy-steward@collaudo.invalid",  displayName: "Collaudo Taxonomy Steward",  tenantCode: "RTL_BANK", roleCode: "TAXONOMY_STEWARD" },
  // Mandato K, R-4 (2026-09-19): RECRUITER e HIRING_MANAGER sono ruoli di CLIENTE
  // (perimetro tenant/organigramma, mai piattaforma), quindi RTL_BANK. HIRING_MANAGER
  // diventa manager di un'unita' organizzativa di prova SOLO dentro la transazione del
  // file di test (D-52): qui nasce solo l'identita', il perimetro lo costruisce il test.
  { email: "recruiter@collaudo.invalid",         displayName: "Collaudo Recruiter",         tenantCode: "RTL_BANK", roleCode: "RECRUITER" },
  { email: "hiring-manager@collaudo.invalid",    displayName: "Collaudo Hiring Manager",    tenantCode: "RTL_BANK", roleCode: "HIRING_MANAGER" },
  // Mandato K, R-5 (2026-09-19): BLUEPRINT_MANAGER e' un ruolo di PIATTAFORMA (E1, come
  // PLATFORM_OPERATOR/SALES di R-9): nasce su HEURESYS, l'assegnazione a RTL Bank via
  // sys_platform_user_tenant_assignments (R-0) e' un atto separato, fatto dal test.
  { email: "blueprint-manager@collaudo.invalid", displayName: "Collaudo Blueprint Manager", tenantCode: "HEURESYS", roleCode: "BLUEPRINT_MANAGER" },
  // Mandato K, R-8 (2026-09-19): IMPLEMENTATION_CONSULTANT e' un ruolo di PIATTAFORMA
  // (stesso schema di PLATFORM_OPERATOR/SALES/BLUEPRINT_MANAGER): nasce su HEURESYS,
  // l'assegnazione a RTL Bank via sys_platform_user_tenant_assignments (R-0) e' un
  // atto separato, fatto dal test.
  { email: "implementation-consultant@collaudo.invalid", displayName: "Collaudo Implementation Consultant", tenantCode: "HEURESYS", roleCode: "IMPLEMENTATION_CONSULTANT" },
  // Mandato K, R-6 (2026-09-19): PEOPLE_MANAGER e' un ruolo di CLIENTE (tenant-scoped,
  // mandato HR tenant-wide come TENANT_ADMIN/HRMS_MANAGER), quindi RTL_BANK.
  { email: "people-manager@collaudo.invalid",     displayName: "Collaudo People Manager",     tenantCode: "RTL_BANK", roleCode: "PEOPLE_MANAGER" },
  // Mandato K, R-6 sessione 2 (2026-09-19, passo 57): DATA_STEWARD e' un ruolo di CLIENTE
  // (tenant-scoped, come PEOPLE_MANAGER — non un ruolo di piattaforma assegnato), quindi
  // RTL_BANK.
  { email: "data-steward@collaudo.invalid",       displayName: "Collaudo Data Steward",       tenantCode: "RTL_BANK", roleCode: "DATA_STEWARD" },
  // #258 (2026-09-26): a differenza di OGNI altra riga di questo elenco, questa identita'
  // NON e' esente dal secondo fattore. 113 file di test impersonavano
  // enzo.spenuso@heuresys.com per superare la sfida MFA come PLATFORM_ADMIN — e #250 ha reso
  // il fattore di Enzo SUO, non piu' di collaudo. Questa persona porta un fattore
  // 'derived-access' vero, come le cinque persone RTL, e cammina l'intera sfida a due passi
  // esattamente come loro: `mfaExempt: false` e' il segnale che dice a
  // provision-collaudo-access.ts di NON iscriverla all'esenzione e di darle invece il fattore.
  { email: "platform-test-admin@collaudo.invalid", displayName: "Collaudo Platform Test Admin", tenantCode: "HEURESYS", roleCode: "PLATFORM_ADMIN", mfaExempt: false },
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
