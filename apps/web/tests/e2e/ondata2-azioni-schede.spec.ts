/**
 * apps/web/tests/e2e/ondata2-azioni-schede.spec.ts — ondata 2 degli endpoint senza consumatori
 * (piano docs/piani/PIANO_endpoint-orfani-ondate_20261117.md).
 *
 * Ogni azione nuova si prova con un giro reversibile sui dati vivi: si cambia, si rilegge dall'API,
 * si rimette com'era e si rilegge di nuovo. Gli identificativi si ricavano dall'API, mai scritti qui.
 * Persona: tenantAdmin (Direttore HR di RTL, mandato su tutto il tenant).
 */

import { test, expect, type APIRequestContext } from "@playwright/test";
import { storageStateFor } from "./fixtures";
import type {
  ConsentStateResponse, ContentCategoryListResponse, NotificationPreferencesResponse, PositionKpiListResponse,
  PositionListResponse, ProjectDetail, ProjectListResponse,
} from "@heuresys/shared";

test.use({ storageState: storageStateFor("tenantAdmin") });
test.describe.configure({ retries: 1 });

async function leggi<T>(request: APIRequestContext, path: string): Promise<T> {
  const r = await request.get(`/api${path}`);
  expect(r.ok(), `GET ${path} → HTTP ${r.status()}`).toBeTruthy();
  return (await r.json()) as T;
}

test("posizione: il peso di un indicatore richiesto si corregge e torna com'era", async ({ page, request }) => {
  const pos = await leggi<PositionListResponse>(request, "/v1/positions?limit=200");
  let scelta: { positionId: string; kpiId: string; peso: number } | null = null;
  for (const p of pos.items) {
    const k = await leggi<PositionKpiListResponse>(request, `/v1/positions/${p.positionId}/kpis`);
    if (k.items[0]) { scelta = { positionId: p.positionId, kpiId: k.items[0].kpiDefinitionId, peso: k.items[0].weight }; break; }
  }
  test.skip(scelta === null, "nessuna posizione con indicatori richiesti nel database");
  const s = scelta!;
  const nuovo = s.peso >= 9 ? s.peso - 0.5 : s.peso + 0.5;
  const pesoDi = async () => (await leggi<PositionKpiListResponse>(request, `/v1/positions/${s.positionId}/kpis`))
    .items.find((x) => x.kpiDefinitionId === s.kpiId)!.weight;

  await page.goto(`/positions/${s.positionId}/kpis`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.getByTestId("position-kpi-add")).toBeVisible({ timeout: 45_000 });
  const riga = page.getByTestId("position-kpi-row").first();
  for (const valore of [nuovo, s.peso]) {
    await riga.getByTestId("position-kpi-peso").fill(String(valore));
    await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/kpis/${s.kpiId}`) && r.request().method() === "PATCH" && r.ok()),
      riga.getByTestId("position-kpi-peso-salva").click(),
    ]);
    expect(await pesoDi()).toBeCloseTo(valore, 3);
  }
});

test("posizione: si vedono i titolari e il modulo di proposta", async ({ page, request }) => {
  const pos = await leggi<PositionListResponse>(request, "/v1/positions?limit=1");
  await page.goto(`/positions/${pos.items[0]!.positionId}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.getByTestId("position-holders")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("assignment-propose")).toBeVisible();
});

test("progetto: lo stato cambia e torna com'era", async ({ page, request }) => {
  const lista = await leggi<ProjectListResponse>(request, "/v1/projects?limit=1");
  test.skip(lista.items.length === 0, "nessun progetto nel database");
  const p = lista.items[0]!;
  const altro = p.status === "ON_HOLD" ? "ACTIVE" : "ON_HOLD";
  await page.goto(`/projects/${p.projectId}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.getByTestId("project-manage")).toBeVisible({ timeout: 45_000 });
  for (const stato of [altro, p.status]) {
    await page.getByTestId("project-status-select").selectOption(stato);
    await Promise.all([
      page.waitForResponse((r) => r.url().endsWith(`/v1/projects/${p.projectId}`) && r.request().method() === "PATCH" && r.ok()),
      page.getByTestId("project-status-save").click(),
    ]);
    expect((await leggi<ProjectDetail>(request, `/v1/projects/${p.projectId}`)).status).toBe(stato);
  }
});

test("contenuti: una categoria si rinomina e torna com'era", async ({ page, request }) => {
  const cats = await leggi<ContentCategoryListResponse>(request, "/v1/content/categories");
  test.skip(cats.items.length === 0, "nessuna categoria nel database");
  const c = cats.items[0]!;
  await page.goto("/content?scheda=categorie", { waitUntil: "domcontentloaded", timeout: 60_000 });
  const riga = page.getByTestId("content-category-row").filter({ hasText: c.name }).first();
  await expect(riga).toBeVisible({ timeout: 45_000 });
  for (const nome of [`${c.name} (prova)`, c.name]) {
    await page.getByTestId("content-category-row").filter({ hasText: nome === c.name ? `${c.name} (prova)` : c.name }).first()
      .getByTestId("content-category-edit").click();
    await page.getByTestId("content-category-edit-name").fill(nome);
    await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/v1/content/categories/${c.categoryId}`) && r.request().method() === "PATCH" && r.ok()),
      page.getByTestId("content-category-edit-save").click(),
    ]);
    const ora = await leggi<ContentCategoryListResponse>(request, "/v1/content/categories");
    expect(ora.items.find((x) => x.categoryId === c.categoryId)?.name).toBe(nome);
  }
});

test("me/security: preferenza di notifica e consenso cambiano e tornano com'erano", async ({ page, request }) => {
  const prima = await leggi<NotificationPreferencesResponse>(request, "/v1/me/notification-preferences");
  const consensiPrima = await leggi<ConsentStateResponse>(request, "/v1/me/consents");
  await page.goto("/me/security", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.getByTestId("me-notification-preferences")).toBeVisible({ timeout: 45_000 });
  const tipo = prima.items[0]!;
  const casella = page.getByTestId("me-notification-row").first().getByTestId("me-notification-email");
  for (const atteso of [!tipo.emailEnabled, tipo.emailEnabled]) {
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/v1/me/notification-preferences") && r.request().method() === "PATCH" && r.ok()),
      casella.click(),
    ]);
    const ora = await leggi<NotificationPreferencesResponse>(request, "/v1/me/notification-preferences");
    expect(ora.items.find((x) => x.notificationType === tipo.notificationType)?.emailEnabled).toBe(atteso);
  }
  const c = consensiPrima.items[0]!;
  const bottone = page.getByTestId("me-consent-row").first().getByTestId("me-consent-toggle");
  for (const atteso of [!c.granted, c.granted]) {
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/v1/me/consents") && r.request().method() === "POST" && r.ok()),
      bottone.click(),
    ]);
    const ora = await leggi<ConsentStateResponse>(request, "/v1/me/consents");
    expect(ora.items.find((x) => x.purpose === c.purpose)?.granted).toBe(atteso);
  }
});

test("amministrazione: le deleghe del tenant si vedono con il modulo per registrarle", async ({ page }) => {
  await page.goto("/admin/roles", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.getByTestId("admin-delegations")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("admin-delegation-form")).toBeVisible();
});
