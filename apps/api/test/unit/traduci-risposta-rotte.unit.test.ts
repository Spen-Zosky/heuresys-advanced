/**
 * Il ritorno all'italiano (ADR-0062 3a) si aggancia alla registrazione delle rotte, non a runtime:
 * prova su un'app Fastify vera con un glossario finto (la prova sul database è nell'integrazione).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import { localePlugin } from "../../src/middleware/locale.js";
import { addTraduzioneRisposta } from "../../src/lib/i18n/traduci-risposta.js";

const db = {
  query: async (sql: string) => {
    if (sql.includes("sys_translatable_field"))
      return { rows: [{ entity_table: "sys_skills", entity_pk_column: "skill_id", field: "name", entity_field_column: "skill_name", tenant_column: "skill_tenant_id" }] };
    return { rows: [{ tenant: null, it: "Finanza", en: "Finance" }] };
  },
} as never;

let app: FastifyInstance;
let ricevuto: unknown = null;

describe("il ritorno si aggancia per rotta", () => {
  beforeAll(async () => {
    app = Fastify();
    await app.register(cookie);
    await app.register(localePlugin);
    addTraduzioneRisposta(app, db);
    await app.register(async (figlio) => {
      figlio.patch("/v1/skills/1", async (req, reply) => { ricevuto = req.body; return reply.code(204).send(); });
    });
    await app.register(async (figlio) => {
      figlio.post("/login", async (req, reply) => { ricevuto = req.body; return reply.code(204).send(); });
    }, { prefix: "/v1/auth" });
    await app.ready();
  });
  afterAll(async () => { await app.close(); });

  it("una rotta di dominio in un plugin figlio riceve il ritorno", async () => {
    await app.inject({ method: "PATCH", url: "/v1/skills/1", cookies: { NEXT_LOCALE: "en" }, payload: { name: "Finance" } });
    expect(ricevuto).toEqual({ name: "Finanza" });
  });

  it("una rotta di accesso no", async () => {
    await app.inject({ method: "POST", url: "/v1/auth/login", cookies: { NEXT_LOCALE: "en" }, payload: { name: "Finance" } });
    expect(ricevuto).toEqual({ name: "Finance" });
  });
});
