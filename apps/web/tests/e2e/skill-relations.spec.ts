/**
 * apps/web/tests/e2e/skill-relations.spec.ts — sinonimi e legami di una competenza (#43, linea C2).
 *
 * `skill-aliases` (5 endpoint) e `skill-taxonomy-edges` (4) erano gli ultimi
 * due moduli del catalogo competenze senza interfaccia.
 *
 * La prova crea due competenze proprie (via API, per non dipendere dai dati
 * altrui), poi fa TUTTO dall'interfaccia: apre la prima, le aggiunge un
 * sinonimo, la lega alla seconda, e verifica ogni passo sull'API. Infine
 * elimina il legame e il sinonimo dall'interfaccia — che è anche il modo di
 * provare le due cancellazioni.
 *
 * Le competenze di collaudo (`E2E-SKILL-…`) le rimuove il teardown comune: le
 * competenze non hanno una DELETE sull'API.
 */

import { test, expect, type Page } from "@playwright/test";
import { storageStateFor, gotoAuthenticated, API_BASE } from "./fixtures";

test.describe.configure({ retries: 1 });

async function cookieHeader(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

async function writeHeaders(page: Page): Promise<Record<string, string>> {
  const cookies = await page.context().cookies();
  return {
    cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
    "x-csrf-token": cookies.find((c) => c.name === "hrx_csrf")?.value ?? "",
    "content-type": "application/json",
  };
}

test.describe("competenza — sinonimi e legami", () => {
  test.use({ storageState: storageStateFor("platformAdmin") });

  test("aggiunge un sinonimo e un legame, poi li elimina, verificando sull'API", async ({ page, request }) => {
    const cookie = await cookieHeader(page);
    const marca = Date.now();
    const codA = `E2E-SKILL-REL-A-${marca}`;
    const codB = `E2E-SKILL-REL-B-${marca}`;

    // preparazione: due competenze proprie, così la prova non dipende dai dati
    // esistenti né li sporca
    const headers = await writeHeaders(page);
    const creaA = await request.post(`${API_BASE}/v1/skills`, {
      headers,
      // globali: l'API vieta a un platform admin di creare competenze
      // non-globali senza indicare il cliente (403 TENANT_ID_REQUIRED)
      data: { code: codA, name: `Competenza A ${marca}`, isGlobal: true },
    });
    expect(creaA.status(), "preparazione fallita (competenza A)").toBe(201);
    const skillA = (await creaA.json()) as { skillId: string };

    const creaB = await request.post(`${API_BASE}/v1/skills`, {
      headers,
      data: { code: codB, name: `Competenza B ${marca}`, isGlobal: true },
    });
    expect(creaB.status(), "preparazione fallita (competenza B)").toBe(201);
    const skillB = (await creaB.json()) as { skillId: string };

    // --- apre la competenza A dall'interfaccia ---
    await gotoAuthenticated(page, "/skills");
    await expect(page.getByTestId("skills-page")).toBeVisible({ timeout: 45_000 });
    await page.getByTestId("skills-search").fill(codA);
    await expect(page.getByTestId(`skill-edit-${codA}`)).toBeVisible({ timeout: 30_000 });
    await page.getByTestId(`skill-edit-${codA}`).click();
    await expect(page.getByTestId("skill-aliases-panel")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("skill-edges-panel")).toBeVisible();

    // parte da zero: sono competenze nuove
    await expect(page.getByTestId("skill-aliases-empty")).toBeVisible();
    await expect(page.getByTestId("skill-edges-empty")).toBeVisible();

    // --- sinonimo ---
    const sinonimo = `Sinonimo ${marca}`;
    await page.getByTestId("skill-alias-label").fill(sinonimo);
    await page.getByTestId("skill-alias-locale").fill("it");
    const [postAlias] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/v1/skill-aliases") && r.request().method() === "POST"),
      page.getByTestId("skill-alias-add-submit").click(),
    ]);
    expect(postAlias.status(), "creazione sinonimo non accettata").toBe(201);

    // PROVA VERA #1: il sinonimo è sull'API, legato alla competenza giusta
    const aliasRes = await request.get(`${API_BASE}/v1/skill-aliases?skillId=${skillA.skillId}&limit=200`, {
      headers: { cookie },
    });
    const alias = ((await aliasRes.json()).items as Array<{ aliasId: string; label: string; locale: string | null }>);
    expect(alias.map((a) => a.label), "il sinonimo non risulta sull'API").toContain(sinonimo);
    expect(alias.find((a) => a.label === sinonimo)?.locale).toBe("it");

    // --- legame verso la competenza B ---
    await page.getByTestId("skill-edge-search").fill(codB);
    await expect(
      page.getByTestId("skill-edge-other").locator(`option[value="${skillB.skillId}"]`),
      "la ricerca non ha trovato la competenza da collegare",
    ).toHaveCount(1, { timeout: 30_000 });
    await page.getByTestId("skill-edge-other").selectOption(skillB.skillId);
    await page.getByTestId("skill-edge-kind").selectOption("PREREQUISITE_OF");
    const [postEdge] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/v1/skill-taxonomy-edges") && r.request().method() === "POST"),
      page.getByTestId("skill-edge-add-submit").click(),
    ]);
    expect(postEdge.status(), "creazione legame non accettata").toBe(201);
    const edge = (await postEdge.json()) as { edgeId: string; parentSkillId: string; childSkillId: string; kind: string };

    // PROVA VERA #2: verso e tipo sono quelli scelti, non i predefiniti
    expect(edge.parentSkillId, "il verso del legame non è quello scelto").toBe(skillA.skillId);
    expect(edge.childSkillId).toBe(skillB.skillId);
    expect(edge.kind, "il tipo di legame non è quello scelto").toBe("PREREQUISITE_OF");

    // --- eliminazione dall'interfaccia (prova le due DELETE) ---
    await expect(page.getByTestId("skill-edge-row")).toHaveCount(1, { timeout: 15_000 });
    const [delEdge] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/v1/skill-taxonomy-edges/") && r.request().method() === "DELETE",
      ),
      page.getByTestId(`skill-edge-delete-${edge.edgeId}`).click(),
    ]);
    expect(delEdge.status(), "eliminazione legame non accettata").toBe(204);

    const [delAlias] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/v1/skill-aliases/") && r.request().method() === "DELETE"),
      page.getByTestId(`skill-alias-delete-${sinonimo}`).click(),
    ]);
    expect(delAlias.status(), "eliminazione sinonimo non accettata").toBe(204);

    // PROVA VERA #3: l'API non li ha più
    const edgiDopo = await request.get(
      `${API_BASE}/v1/skill-taxonomy-edges?parentSkillId=${skillA.skillId}&limit=200`,
      { headers: { cookie } },
    );
    expect((await edgiDopo.json()).items, "il legame risulta ancora presente").toHaveLength(0);
    const aliasDopo = await request.get(`${API_BASE}/v1/skill-aliases?skillId=${skillA.skillId}&limit=200`, {
      headers: { cookie },
    });
    expect((await aliasDopo.json()).items, "il sinonimo risulta ancora presente").toHaveLength(0);
  });
});
