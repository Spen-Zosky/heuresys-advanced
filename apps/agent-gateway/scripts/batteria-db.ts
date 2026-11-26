/**
 * La lettura del database per la batteria: UNA connessione, in transazione di SOLA LETTURA.
 * Le variabili sono quelle del gateway (`POSTGRES_*`): dall'ambiente (per esempio dopo
 * `. deploy/postgres/env-agenti.sh`, o le `PG*`) o dal file `.env` in radice. Nessun valore si stampa.
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { ambienteDiario } from "../src/db-pool.js";
import type { Interroga, Riga } from "../test/batteria/genera.js";

export const BATTERIA = fileURLToPath(new URL("../test/batteria/domande.json", import.meta.url));

export async function conSolaLettura<T>(lavoro: (q: Interroga, database: string) => Promise<T>): Promise<T> {
  // Il file `.env` in radice, se c'è, completa l'ambiente di questo solo processo (non sovrascrive).
  const fileEnv = fileURLToPath(new URL("../../../.env", import.meta.url));
  if (existsSync(fileEnv)) process.loadEnvFile(fileEnv);
  const amb = ambienteDiario({ ...process.env });
  const utente = amb.POSTGRES_APP_USER ?? process.env.PGUSER ?? process.env.POSTGRES_USER;
  const password = amb.POSTGRES_APP_USER ? amb.POSTGRES_APP_PASSWORD : (process.env.PGPASSWORD ?? process.env.POSTGRES_PASSWORD);
  const database = amb.POSTGRES_DB ?? process.env.PGDATABASE ?? "heuresys_advanced";
  const client = new pg.Client({
    host: amb.POSTGRES_HOST ?? process.env.PGHOST ?? "localhost",
    port: Number(amb.POSTGRES_PORT ?? process.env.PGPORT ?? 5432),
    database,
    ...(utente ? { user: utente } : {}),
    ...(password ? { password } : {}),
    options: "-c default_transaction_read_only=on",
  });
  await client.connect();
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    return await lavoro(async (sql, parametri) => (await client.query(sql, parametri)).rows as Riga[], database);
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    await client.end();
  }
}
