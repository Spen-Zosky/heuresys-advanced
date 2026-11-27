/**
 * Le credenziali di prova degli script `live-*.ts`. La password si deriva per indirizzo (Z-262) e il
 * secondo fattore si legge dal database (#169 F3c): va caricato prima di chiederlo, e fino al
 * 2026-11-26 gli script non lo facevano, quindi il login si fermava al secondo passo.
 * `ACC_PASSWORD` resta il modo di dare una password che non si deriva.
 */
import { caricaSegretiTotp, totpSecretFor } from "../../api/test/helpers/mfa-fixture-secrets.js";
import { passwordFor } from "../../api/test/helpers/personas.js";
import { pool } from "../../api/src/db/client.js";

let caricati: Promise<void> | undefined;

/** Il segreto TOTP di prova della persona; la connessione al database si chiude dopo la lettura. */
export async function segretoTotp(email: string): Promise<string> {
  caricati ??= caricaSegretiTotp().then(() => pool.end());
  await caricati;
  return totpSecretFor(email);
}

export function passwordDiProva(email: string): string {
  return process.env.ACC_PASSWORD ?? passwordFor(email);
}
