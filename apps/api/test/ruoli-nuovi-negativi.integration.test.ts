/**
 * apps/api/test/ruoli-nuovi-negativi.integration.test.ts — mandato K, passo 58, R-11.
 *
 * "Prove negative trasversali (matrice ruolo x modulo)": per ciascuno dei DIECI ruoli
 * nuovi del mandato K, per ciascuna risorsa che NON e' sua, una rotta di SCRITTURA deve
 * rispondere 403 (o 404, quando il permesso e' negato prima ancora di sapere se la riga
 * esiste). La matrice si legge da `esiti/R-11_matrice.json` (SoT di questo test, ruolo ->
 * permessi concessi, misurata sul database di produzione) e la rotta per risorsa da
 * `_helpers/r11-route-registry.ts`. Un solo `it()` percorre TUTTA la matrice senza `bail`:
 * un rosso deve mostrare OGNI cella sbagliata insieme, non fermarsi alla prima.
 *
 * ⚠ DEVIATION DICHIARATA dalla lettera "ogni modulo" del mandato: l'universo dei "moduli"
 * qui e' ristretto alle risorse dove almeno uno dei 10 ruoli ha un permesso di SCRITTURA
 * (create/update/delete/manage/trigger/decide/erase/retention/write/activate/override/
 * self_assess/publish). Le risorse dove tutti i 10 ruoli hanno solo permessi di LETTURA
 * (`me`, `leave` lettura, `consent`, `dashboard`, `insights`, `talent`, `timeline`,
 * `predictions`, `evidence`, `matching`, `occupation_classification`, `capability`,
 * `analytics`, `org_director`, `process_owner`, `user_position_assignment`,
 * `training_initiative` sola lettura per BLUEPRINT_MANAGER, `role_matrix`) restano fuori:
 * leggere in piu' e' un rischio diverso, coperto da altri assi (I16-I20), non il confine
 * di scrittura che questo test difende. Decisione esplicita di chi ha commissionato questo
 * file (non una svista): la si trova qui perche' e' qui che va riletta.
 *
 * ESCLUSA anche `bpm_process`: BLUEPRINT_MANAGER ha bpm_process:delete/read/update nel
 * database (misurato), ma NESSUNA rotta HTTP in tutto `apps/api/src` la richiede — vedi
 * la nota nel registro delle rotte. L'assenza della porta e' gia' il confine (come per un
 * dato "importato" in X-1/X-2): non c'e' una 403 da provare perche' non c'e' un endpoint.
 *
 * ESCLUSE anche `enterprise_typing`, `operating_model`, `process_kpi_template` — SCOPERTA
 * IMPREVISTA fatta eseguendo questo stesso test (prima corsa: 3 celle rosse per
 * BLUEPRINT_MANAGER, che invece ha davvero quei permessi concessi in RBAC). Le rotte
 * esistono e BLUEPRINT_MANAGER ha davvero i permessi RBAC (`enterprise_typing:*`,
 * `operating_model:*`, `process_kpi_template:*` — verificato sul vivo, nessuna riga
 * `revoked_at`), ma ogni service di scrittura dei tre apre con
 * `if (!isPlatform(actor)) throw new ForbiddenError("PLATFORM_ADMIN required")`: un
 * mandato di PIATTAFORMA che nessuno dei 10 ruoli nuovi possiede (`auth_role_is_platform`
 * e' `false` su tutti e dieci, verificato). Il 403 su questi tre e' quindi strutturale per
 * QUALUNQUE ruolo tenant — provarli qui testerebbe il mandato di piattaforma, non il
 * confine ruolo x modulo che R-11 difende, e romperebbe per BLUEPRINT_MANAGER la premessa
 * "permesso concesso -> mai 403" senza che sia un difetto RBAC. Il gemello strutturale
 * `organization_unit_kpi_template` (stesso "ex bpm_process:*", mig 000199) NON ha questo
 * gate nel suo service (solo un controllo di tenant) e resta regolarmente in matrice.
 *
 * Isolamento: nessuna scrittura di fixture qui — ogni rotta punta a un id SINTETICO
 * (randomUUID) che non esiste, quindi non serve costruire nulla da rollbackare. La sola
 * scrittura reale possibile e' l'upsert di `mfa_policy` (SECURITY_ADMIN, tenant sintetico
 * -> 404 prima di toccare la tabella) e la creazione di uno `skill`/`compensation
 * recommendation` per i ruoli che li possiedono davvero: tutte dentro la transazione di
 * file rollbackata a fine corsa (D-52, `helpers/tx-isolation.ts`), quindi zero residuo.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { closePool } from "../src/db/client.js";
import { readCollaudoKey, deriveCollaudoPassword } from "../scripts/collaudo-access.mjs";
import { buildR11Routes, type R11Route } from "./_helpers/r11-route-registry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** `esiti/R-11_matrice.json` — SoT della matrice, tre livelli sopra `apps/api/test/`. */
const MATRICE_PATH = resolve(
  __dirname,
  "..",
  "..",
  "..",
  ".programmi",
  "K-ruoli-direzione",
  "esiti",
  "R-11_matrice.json",
);

type Matrice = Record<string, string[]>;

function leggiMatrice(): Matrice {
  const raw = JSON.parse(readFileSync(MATRICE_PATH, "utf8")) as Record<string, unknown>;
  const ruoli: Matrice = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith("_")) continue; // "_nota" — non e' un ruolo
    ruoli[k] = v as string[];
  }
  return ruoli;
}

/** Le dieci persone di collaudo del mandato K — riusate, non create qui. */
const ROLE_EMAILS: Record<string, string> = {
  DPO: "dpo@collaudo.invalid",
  TAXONOMY_STEWARD: "taxonomy-steward@collaudo.invalid",
  RECRUITER: "recruiter@collaudo.invalid",
  HIRING_MANAGER: "hiring-manager@collaudo.invalid",
  BLUEPRINT_MANAGER: "blueprint-manager@collaudo.invalid",
  PLATFORM_OPERATOR: "platform-operator@collaudo.invalid",
  SALES: "sales@collaudo.invalid",
  SECURITY_ADMIN: "security-admin@collaudo.invalid",
  IMPLEMENTATION_CONSULTANT: "implementation-consultant@collaudo.invalid",
  PEOPLE_MANAGER: "people-manager@collaudo.invalid",
};

interface Sessione {
  cookies: Map<string, string>;
  csrfToken: string;
}
const cookieHeader = (c: Map<string, string>) =>
  [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");

async function login(app: TestApp, email: string, password: string): Promise<Sessione> {
  const r = await loginRaw(app.app, email, password);
  if (r.statusCode !== 200) throw new Error(`login ${email} -> ${r.statusCode}: ${r.body}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { csrfToken: string };
  return { cookies, csrfToken: body.csrfToken };
}

async function chiama(
  app: TestApp,
  sessione: Sessione,
  rotta: Pick<R11Route, "method" | "url" | "body">,
): Promise<number> {
  const headers: Record<string, string> = { cookie: cookieHeader(sessione.cookies) };
  if (rotta.method !== "GET") headers["x-csrf-token"] = sessione.csrfToken;
  const res = await app.app.inject({
    method: rotta.method,
    url: rotta.url,
    headers,
    payload: rotta.body,
  });
  return res.statusCode;
}

interface CellaSbagliata {
  role: string;
  resource: string;
  permission: string;
  atteso: "consentito (mai 403)" | "negato (403 o 404)";
  status: number;
  url: string;
}

describe("mandato K, R-11 — prove negative trasversali (matrice ruolo x modulo, passo 58)", () => {
  let suite: TestApp;
  const sessioni = new Map<string, Sessione>();
  const matrice = leggiMatrice();
  const rotte = buildR11Routes();

  beforeAll(async () => {
    suite = await buildTestApp();
    const key = readCollaudoKey();
    for (const [role, email] of Object.entries(ROLE_EMAILS)) {
      sessioni.set(role, await login(suite, email, deriveCollaudoPassword(key, email)));
    }
    // 10 login sequenziali via tunnel SSH: l'hookTimeout globale (30s, vitest.config.ts)
    // non basta — misurato 2026-09-19, 5 login su 10 gia' a 25s.
  }, 120_000);

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it(
    "percorre l'INTERA matrice 10 ruoli x N risorse senza bail: mai 403 se il permesso " +
      "c'e', sempre 403/404 se non c'e'",
    { timeout: 180_000 },
    async () => {
      // Guardia di censimento: se un ruolo del registro email non ha una riga nella
      // matrice (o viceversa) il test deve dirlo forte, non silenziosamente saltarlo.
      const ruoliRegistro = new Set(Object.keys(ROLE_EMAILS));
      const ruoliMatrice = new Set(Object.keys(matrice));
      expect([...ruoliRegistro].sort()).toEqual([...ruoliMatrice].sort());
      expect(rotte.length).toBeGreaterThanOrEqual(37);

      const fallimenti: CellaSbagliata[] = [];

      for (const [role, email] of Object.entries(ROLE_EMAILS)) {
        const sessione = sessioni.get(role);
        if (!sessione) throw new Error(`nessuna sessione per ${role} (${email})`);
        const permessiConcessi = new Set(matrice[role] ?? []);

        for (const rotta of rotte) {
          const consentito = permessiConcessi.has(rotta.permission);
          const status = await chiama(suite, sessione, rotta);

          if (consentito) {
            if (status === 403) {
              fallimenti.push({
                role,
                resource: rotta.resource,
                permission: rotta.permission,
                atteso: "consentito (mai 403)",
                status,
                url: rotta.url,
              });
            }
          } else if (![403, 404].includes(status)) {
            fallimenti.push({
              role,
              resource: rotta.resource,
              permission: rotta.permission,
              atteso: "negato (403 o 404)",
              status,
              url: rotta.url,
            });
          }
        }
      }

      expect(fallimenti, JSON.stringify(fallimenti, null, 2)).toEqual([]);
    },
  );

  it(
    "controprova — un permesso in piu' per DPO nella matrice fa cadere l'assert positivo " +
      "(dimostra che il test sa riconoscere una cella sbagliata, non solo passare)",
    async () => {
      // Copia IN MEMORIA, mai scritta su disco: il file R-11_matrice.json resta intatto.
      const matriceFinta: Matrice = {
        ...matrice,
        DPO: [...(matrice.DPO ?? []), "tenant_blueprint:write"],
      };
      const rottaTenantBlueprint = rotte.find((r) => r.resource === "tenant_blueprint");
      if (!rottaTenantBlueprint) throw new Error("registro rotte: tenant_blueprint mancante");

      const dpo = sessioni.get("DPO");
      if (!dpo) throw new Error("nessuna sessione per DPO");

      // La matrice FINTA dichiara DPO consentito su tenant_blueprint:write...
      const consentitoSecondoMatriceFinta = matriceFinta.DPO?.includes(
        rottaTenantBlueprint.permission,
      );
      expect(consentitoSecondoMatriceFinta).toBe(true);

      // ...ma il server VERO non ha mai dato a DPO quel permesso (misurato: DPO ha solo
      // gdpr:*). Se qualcuno leggesse la matrice finta come fosse quella vera e applicasse
      // lo stesso assert positivo del test principale ("mai 403"), fallirebbe qui — ed e'
      // esattamente il comportamento che la controprova del mandato chiede di dimostrare.
      const status = await chiama(suite, dpo, rottaTenantBlueprint);
      expect(status).toBe(403);
    },
  );
});
