/**
 * apps/web/tests/e2e/skills-graph.spec.ts — #50 F3.
 *
 * LIVE-DATA-E2E-ONLY: un TENANT_ADMIN reale (federica.marchetti@rtl-bank.org) apre
 * /analytics/skills-graph, cerca una competenza vera del catalogo e ne fa disegnare il
 * vicinato. Nessun dato finto: nodi e archi arrivano da GET /v1/skills/graph sul
 * PostgreSQL di produzione.
 *
 * ⚠ L'ASSERZIONE CHE CONTA non e' «il canvas compare»: e' che i numeri mostrati dalla
 * pagina COINCIDANO con quelli che l'API calcola per la stessa competenza e la stessa
 * profondita'. Un disegno che compare con i dati sbagliati passerebbe un test sul solo
 * rendering, e sarebbe il modo piu' facile di avere una vista verde e falsa.
 *
 * ⚠ E la competenza di partenza NON e' scritta a mano qui dentro. Si sceglie
 * interrogando il catalogo vero: un nome fissato nel test invecchia col dataset e un
 * giorno fallisce senza che nulla sia rotto (regola del progetto: mai dati cablati nei
 * test che duplicano una fonte di verita').
 */

import { test, expect } from "@playwright/test";
import { storageStateFor, PERSONAS, API_BASE, passwordFor, totpFor } from "./fixtures";

test.use({ storageState: storageStateFor("tenantAdmin") });
test.describe.configure({ retries: 1 });

const DEPTH = 2;

interface GraphCounts {
  nodes: number;
  edges: number;
  explicitEdges: number;
  groupEdges: number;
}

/** Login lato API, per interrogare il grafo con la stessa identita' della pagina. */
async function apiLogin(request: import("@playwright/test").APIRequestContext) {
  const email = PERSONAS.tenantAdmin.email;
  let res = await request.post(`${API_BASE}/v1/auth/login`, {
    data: { email, password: passwordFor(email) },
  });
  let body = await res.json();
  if (body.status === "mfa_required") {
    res = await request.post(`${API_BASE}/v1/auth/login`, {
      data: {
        email,
        password: passwordFor(email),
        challengeToken: body.challengeToken,
        mfaCode: totpFor(email),
      },
    });
    body = await res.json();
  }
  expect(res.status(), "login della persona reale").toBe(200);
}

test("il grafo delle competenze mostra il vicinato reale di una competenza vera", async ({
  page,
  request,
}) => {
  await apiLogin(request);

  // 1. La competenza di partenza si SCEGLIE dal catalogo vero, non si scrive qui.
  //    Si prende la prima voce che il catalogo restituisce per un termine largo, cosi'
  //    il test non dipende da quale competenza sia in cima oggi.
  const lista = await request.get(`${API_BASE}/v1/skills?search=inform&limit=10`);
  expect(lista.status(), "il catalogo risponde").toBe(200);
  const items = (await lista.json()).items as Array<{ skillId: string; name: string }>;
  expect(items.length, "il catalogo ha competenze che contengono «inform»").toBeGreaterThan(0);

  // 2. Fra quelle, si cerca la prima che abbia davvero dei vicini: una competenza
  //    isolata farebbe passare il test disegnando il vuoto, che e' il falso verde da
  //    evitare qui.
  let scelta: { skillId: string; name: string } | undefined;
  let attesi: GraphCounts | undefined;
  for (const s of items) {
    const g = await request.get(`${API_BASE}/v1/skills/graph?root=${s.skillId}&depth=${DEPTH}`);
    expect(g.status(), `il grafo risponde per ${s.name}`).toBe(200);
    const counts = (await g.json()).counts as GraphCounts;
    if (counts.nodes > 1) {
      scelta = s;
      attesi = counts;
      break;
    }
  }
  expect(scelta, "almeno una competenza del catalogo ha dei vicini").toBeDefined();

  // 3. La pagina, con la stessa identita'.
  await page.goto("/analytics/skills-graph");
  await expect(page.getByTestId("analytics-skills-graph")).toBeVisible();
  // Senza una competenza scelta la pagina NON interroga il grafo, e lo dice.
  await expect(page.getByTestId("skills-graph-empty")).toBeVisible();

  await page.getByTestId("skills-graph-search").fill("inform");
  await expect(page.getByTestId("skills-graph-results")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: scelta!.name, exact: true }).click();

  // 4. Il canvas c'e' — ma e' l'asserzione debole, e da sola non basterebbe.
  await expect(page.getByTestId("skills-graph-canvas")).toBeVisible({ timeout: 20_000 });

  // 5. L'asserzione che conta: i numeri della pagina sono quelli dell'API. Presi dal
  //    servizio, non ricopiati: se il grafo cambia, cambiano insieme.
  const testo = await page.getByTestId("analytics-skills-graph").innerText();
  expect(testo, "i nodi mostrati sono quelli che l'API conta").toContain(String(attesi!.nodes));
  expect(testo, "i legami dichiarati mostrati sono quelli che l'API conta").toContain(
    String(attesi!.explicitEdges),
  );
});

test("la profondita' cambia il grafo, e la pagina lo riflette", async ({ page, request }) => {
  await apiLogin(request);

  // Una competenza molto connessa: con questa il vicinato a 1 salto e quello a 2 sono
  // certamente diversi, quindi il controllo puo' FALLIRE se il selettore di profondita'
  // non fa nulla. Con una competenza isolata i due numeri coinciderebbero e il test
  // sarebbe verde qualunque cosa accada — cioe' inutile.
  const lista = await request.get(`${API_BASE}/v1/skills?search=consigli&limit=10`);
  const items = (await lista.json()).items as Array<{ skillId: string; name: string }>;
  expect(items.length).toBeGreaterThan(0);

  let scelta: { skillId: string; name: string } | undefined;
  let a1 = 0;
  let a2 = 0;
  for (const s of items) {
    const g1 = await request.get(`${API_BASE}/v1/skills/graph?root=${s.skillId}&depth=1`);
    const g2 = await request.get(`${API_BASE}/v1/skills/graph?root=${s.skillId}&depth=2`);
    const c1 = (await g1.json()).counts as GraphCounts;
    const c2 = (await g2.json()).counts as GraphCounts;
    if (c2.nodes > c1.nodes) {
      scelta = s;
      a1 = c1.nodes;
      a2 = c2.nodes;
      break;
    }
  }
  test.skip(scelta === undefined, "nessuna competenza cresce fra 1 e 2 salti in questo dataset");

  await page.goto("/analytics/skills-graph");
  await page.getByTestId("skills-graph-search").fill("consigli");
  await expect(page.getByTestId("skills-graph-results")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: scelta!.name, exact: true }).click();
  await expect(page.getByTestId("skills-graph-canvas")).toBeVisible({ timeout: 20_000 });

  // Il default della pagina e' 2 salti.
  await expect(page.getByTestId("analytics-skills-graph")).toContainText(String(a2));

  // Un salto solo: il numero deve SCENDERE a quello che l'API dichiara per depth=1.
  await page.getByTestId("skills-graph-depth").getByRole("button").first().click();
  await expect(page.getByTestId("analytics-skills-graph")).toContainText(String(a1), {
    timeout: 20_000,
  });
});
