/**
 * apps/api/test/perimetro-scritture.integration.test.ts
 *
 * S-23 del piano interfacce (docs/piani/PIANO_interfacce_20261103.md; analisi V2 INC-23,
 * INC-24; V4 LEGGIMI T-3). `MANAGER` detiene `position:update` e `user:update`, `USER`
 * detiene `user:read`: il permesso dice CHE COSA, il perimetro lo dice il servizio. Qui si
 * prova che il servizio lo dice davvero, con gli attori di oggi e non con nomi scritti a mano:
 *
 *   - il capo modifica la propria posizione e un proprio sottoposto (controprova: la regola
 *     non e' «nessuno puo'»), e NON una posizione di altri ne' una persona della catena sorella;
 *   - il sottoposto, con il solo ruolo USER, legge se stesso e nessun altro.
 *
 * L'agente di un capo agisce con le credenziali del capo: il confine e' lo stesso.
 *
 * PERCHE' PUO' FALLIRE. Un servizio che si fidasse del solo permesso darebbe 200 alla
 * scrittura sulla catena sorella e consegnerebbe all'USER l'elenco del tenant.
 *
 * Le scritture di controprova rimettono lo stesso valore: non cambiano il dato.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { attoriDiScena } from "./helpers/attori-di-scena.js";

const ATTORI = await attoriDiScena();

interface S { cookies: Map<string, string>; csrfToken: string; userId: string }
const ch = (c: Map<string, string>) => [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");

async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const b = r.json() as { csrfToken: string; user: { userId: string } };
  return { cookies, csrfToken: b.csrfToken, userId: b.user.userId };
}

let t: TestApp;
let capo: S;
let sottoposto: S;
let posDelCapo: { id: string; title: string } | null = null;
let posAltrui: { id: string; title: string } | null = null;

async function patch(chi: S, url: string, payload: Record<string, unknown>) {
  return t.app.inject({
    method: "PATCH",
    url,
    headers: { cookie: ch(chi.cookies), "x-csrf-token": chi.csrfToken },
    payload,
  });
}
async function get(chi: S, url: string) {
  return t.app.inject({ method: "GET", url, headers: { cookie: ch(chi.cookies) } });
}

describe("S-23 — scritture e letture restano nel perimetro di chi le fa", () => {
  beforeAll(async () => {
    t = await buildTestApp();
    capo = await login(t, ATTORI.capo.email);
    sottoposto = await login(t, ATTORI.sottoposto.email);

    const mia = await pool.query<{ id: string; title: string }>(
      `SELECT position_id AS id, position_title AS title FROM sys.sys_positions
        WHERE position_owner_user_id = $1 ORDER BY position_code LIMIT 1`,
      [capo.userId],
    );
    posDelCapo = mia.rows[0] ?? null;
    // Una posizione dello stesso tenant di cui il capo NON e' proprietario, preferendo
    // quelle dell'estraneo (la catena sorella in senso stretto).
    const altrui = await pool.query<{ id: string; title: string }>(
      `SELECT p.position_id AS id, p.position_title AS title FROM sys.sys_positions p
        WHERE p.position_tenant_id = (SELECT user_tenant_id FROM sys.sys_users WHERE user_id = $1)
          AND p.position_owner_user_id IS DISTINCT FROM $1
        ORDER BY (p.position_owner_user_id = $2) DESC NULLS LAST, p.position_code LIMIT 1`,
      [capo.userId, ATTORI.estraneo.userId],
    );
    posAltrui = altrui.rows[0] ?? null;
  });
  afterAll(async () => {
    await t.app.close();
    await closePool();
  });

  it("il capo non modifica una posizione di cui non e' proprietario -> 403", async () => {
    expect(posAltrui, "nessuna posizione altrui nel tenant del capo").not.toBeNull();
    const r = await patch(capo, `/v1/positions/${posAltrui!.id}`, { title: posAltrui!.title });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("POSITION_UPDATE_FORBIDDEN");
  });

  it("controprova — il capo modifica la propria posizione -> 200", async () => {
    if (!posDelCapo) {
      // Il capo di scena e' scelto per l'albero delle unita', non per le posizioni: se
      // oggi non ne possiede una, la controprova non ha bersaglio e lo si dice.
      console.warn("[S-23] il capo di scena non possiede posizioni: controprova non eseguita");
      return;
    }
    const r = await patch(capo, `/v1/positions/${posDelCapo.id}`, { title: posDelCapo.title });
    expect(r.statusCode).toBe(200);
  });

  it("il capo non modifica una persona della catena sorella -> 404, come se non esistesse", async () => {
    const r = await patch(capo, `/v1/users/${ATTORI.estraneo.userId}`, { displayName: "S-23 non deve passare" });
    expect(r.statusCode).toBe(404);
    const dopo = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_users WHERE user_id = $1 AND user_display_name = 'S-23 non deve passare'`,
      [ATTORI.estraneo.userId],
    );
    expect(dopo.rows[0]!.n).toBe("0");
  });

  it("controprova — il capo modifica un proprio sottoposto -> 200", async () => {
    const prima = await get(capo, `/v1/users/${ATTORI.sottoposto.userId}`);
    expect(prima.statusCode).toBe(200);
    const nome = (prima.json() as { displayName: string }).displayName;
    const r = await patch(capo, `/v1/users/${ATTORI.sottoposto.userId}`, { displayName: nome });
    expect(r.statusCode).toBe(200);
  });

  it("il sottoposto (USER) legge se stesso e nessun altro", async () => {
    const io = await get(sottoposto, `/v1/users/${sottoposto.userId}`);
    expect(io.statusCode).toBe(200);

    const altro = await get(sottoposto, `/v1/users/${ATTORI.estraneo.userId}`);
    expect([403, 404]).toContain(altro.statusCode);
    const capoVisto = await get(sottoposto, `/v1/users/${capo.userId}`);
    expect([403, 404]).toContain(capoVisto.statusCode);

    const elenco = await get(sottoposto, "/v1/users?limit=200");
    if (elenco.statusCode === 200) {
      const items = (elenco.json() as { items: Array<{ userId: string }> }).items;
      expect(items.map((u) => u.userId)).toEqual([sottoposto.userId]);
    } else {
      expect(elenco.statusCode).toBe(403);
    }
  });
});
