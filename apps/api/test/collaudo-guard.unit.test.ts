/**
 * apps/api/test/collaudo-guard.unit.test.ts — #261.
 *
 * `eDiCollaudoDa` decide se depositare/rigenerare i segreti TOTP di collaudo. Il
 * punto che questi casi proteggono NON e' che il ramo storico (nome del database)
 * continui a funzionare: e' che il ramo NUOVO (macchina + porta nativa) non apra
 * anche dove prima era chiuso per una buona ragione — Windows via tunnel verso la
 * produzione, o la VM stessa. Ogni caso e' costruito sullo scenario REALE che ha
 * motivato la guardia (S1093) o la sua correzione (#261), non su un input arbitrario.
 */
import { describe, it, expect } from "vitest";
import { eDiCollaudoDa, suGemelloLocale, dbSiDichiaraDiCollaudo, MACCHINE_GEMELLO } from "../scripts/collaudo-guard.mjs";

const GEMELLO = [...MACCHINE_GEMELLO][0]!;

describe("eDiCollaudoDa — la guardia contro la rigenerazione dei fattori MFA veri", () => {
  it("NODE_ENV != test -> sempre false, qualunque sia il resto", () => {
    expect(eDiCollaudoDa({
      nodeEnv: "production", postgresDb: "heuresys_ci",
      hostname: GEMELLO, postgresHost: "localhost", postgresPort: "5432",
    })).toBe(false);
  });

  it("ramo storico invariato: CI (nome database) resta true ovunque giri", () => {
    expect(eDiCollaudoDa({
      nodeEnv: "test", postgresDb: "heuresys_ci",
      hostname: "github-runner", postgresHost: "localhost", postgresPort: "5432",
    })).toBe(true);
    expect(eDiCollaudoDa({
      nodeEnv: "test", postgresDb: "qualcosa_test",
      hostname: "github-runner", postgresHost: "localhost", postgresPort: "5432",
    })).toBe(true);
  });

  it("il caso che ha fatto nascere la guardia (S1093): Windows via tunnel verso produzione, NODE_ENV=test distratto -> false", () => {
    expect(eDiCollaudoDa({
      nodeEnv: "test", postgresDb: "heuresys_advanced",
      hostname: "DESKTOP-KH728P2", postgresHost: "localhost", postgresPort: "5433",
    })).toBe(false);
  });

  it("il buco che #261 ha trovato: il gemello con lo STESSO nome della produzione ora e' true", () => {
    expect(eDiCollaudoDa({
      nodeEnv: "test", postgresDb: "heuresys_advanced",
      hostname: GEMELLO, postgresHost: "localhost", postgresPort: "5432",
    })).toBe(true);
  });

  it("eseguito SULLA VM (produzione) con NODE_ENV=test per errore -> false: la VM non e' nell'elenco", () => {
    expect(eDiCollaudoDa({
      nodeEnv: "test", postgresDb: "heuresys_advanced",
      hostname: "main-server-base-configuration", postgresHost: "localhost", postgresPort: "5432",
    })).toBe(false);
  });

  it("il gemello ma con un tunnel APERTO VERSO LA VM (porta 5433, non la nativa 5432) -> false", () => {
    expect(eDiCollaudoDa({
      nodeEnv: "test", postgresDb: "heuresys_advanced",
      hostname: GEMELLO, postgresHost: "localhost", postgresPort: "5433",
    })).toBe(false);
  });

  it("il gemello ma POSTGRES_HOST non e' loopback (un IP remoto) -> false", () => {
    expect(eDiCollaudoDa({
      nodeEnv: "test", postgresDb: "heuresys_advanced",
      hostname: GEMELLO, postgresHost: "10.0.0.5", postgresPort: "5432",
    })).toBe(false);
  });

  it("rami ciechi: hostname assente/sconosciuto, porta assente -> mai true per magia", () => {
    expect(suGemelloLocale({ hostname: undefined, postgresHost: "localhost", postgresPort: "5432" })).toBe(false);
    expect(suGemelloLocale({ hostname: "una-macchina-mai-vista", postgresHost: "localhost", postgresPort: "5432" })).toBe(false);
    expect(suGemelloLocale({ hostname: GEMELLO, postgresHost: "localhost", postgresPort: undefined })).toBe(false);
  });

  it("dbSiDichiaraDiCollaudo: negativa per difetto senza nome", () => {
    expect(dbSiDichiaraDiCollaudo(undefined)).toBe(false);
    expect(dbSiDichiaraDiCollaudo("")).toBe(false);
    expect(dbSiDichiaraDiCollaudo("heuresys_advanced")).toBe(false);
  });
});
