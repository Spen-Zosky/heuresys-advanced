/**
 * R8 — il diario del gate nel database anche dove l'unità non porta `POSTGRES_*`. Dal `.env` della
 * copia rilasciata il gateway prende SOLO le chiavi della connessione e l'identità dell'applicazione:
 * una chiave di firma o la password del proprietario non entrano nel processo.
 */
import { describe, it, expect } from "vitest";
import { ambienteDiario } from "../src/db-pool.js";

const FILE = [
  "# commento",
  "POSTGRES_HOST=localhost",
  "POSTGRES_PORT=5432",
  'POSTGRES_DB="heuresys_advanced"',
  "POSTGRES_USER=heuresys",
  "POSTGRES_PASSWORD=proprietario-non-deve-entrare",
  "export POSTGRES_APP_USER=heuresys_app",
  "POSTGRES_APP_PASSWORD='app'",
  "JWT_PRIVATE_KEY=chiave-non-deve-entrare",
].join("\r\n");

describe("R8 — ambiente del diario", () => {
  it("dal .env della copia prende solo connessione e identità dell'applicazione", () => {
    const amb = ambienteDiario({ HEURESYS_REPO_ROOT: "/copia" }, (p) => {
      expect(p).toBe("/copia/.env");
      return FILE;
    });
    expect(amb).toEqual({
      POSTGRES_HOST: "localhost",
      POSTGRES_PORT: "5432",
      POSTGRES_DB: "heuresys_advanced",
      POSTGRES_APP_USER: "heuresys_app",
      POSTGRES_APP_PASSWORD: "app",
    });
    expect(JSON.stringify(amb)).not.toContain("non-deve-entrare");
  });

  it("l'ambiente del processo vince sul file", () => {
    const amb = ambienteDiario({ HEURESYS_REPO_ROOT: "/copia", POSTGRES_DB: "heuresys_ci" }, () => FILE);
    expect(amb.POSTGRES_DB).toBe("heuresys_ci");
  });

  it("senza HEURESYS_REPO_ROOT non legge nessun file", () => {
    const amb = ambienteDiario({}, () => {
      throw new Error("non doveva leggere");
    });
    expect(amb).toEqual({});
  });

  it("un .env che non c'è lascia il diario su file", () => {
    const amb = ambienteDiario({ HEURESYS_REPO_ROOT: "/copia" }, () => {
      throw new Error("ENOENT");
    });
    expect(amb.POSTGRES_HOST).toBeUndefined();
  });
});
