#!/usr/bin/env node
/**
 * scripts/banco-firma.mjs — firma il cookie di accesso di una persona con la chiave DEL BANCO.
 * Lo usa solo scripts/banco-verifica.sh (gettone, persone). La chiave e' quella generata nella
 * copia di prova: in produzione questo gettone non vale niente, perche' la firma non torna.
 *
 *   node scripts/banco-firma.mjs <chiave-privata.pem> <user_id> <tenant_id|""> <RUOLO1,RUOLO2>
 */
import fs from "node:fs";
import { createSign, randomUUID } from "node:crypto";

const [chiave, sub, tenant, ruoli] = process.argv.slice(2);
if (!chiave || !sub) {
  console.error("uso: banco-firma.mjs <chiave.pem> <user_id> <tenant_id> <ruoli>");
  process.exit(2);
}
if (!chiave.includes("prove-heuresys-advanced")) {
  console.error("GUARDIA: la chiave non sta in una copia di prova");
  process.exit(9);
}
const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
const ora = Math.floor(Date.now() / 1000);
const corpo = {
  sub,
  tenant_id: tenant || null,
  roles: (ruoli || "").split(",").filter(Boolean),
  jti: randomUUID(),
  fam: randomUUID(),
  sua: ora,
  iat: ora,
  exp: ora + 12 * 3600,
  iss: "heuresys-advanced",
  aud: "heuresys-advanced-api",
};
const testa = b64({ alg: "RS256", typ: "JWT" });
const firma = createSign("RSA-SHA256").update(`${testa}.${b64(corpo)}`).sign(fs.readFileSync(chiave)).toString("base64url");
process.stdout.write(`${testa}.${b64(corpo)}.${firma}`);
