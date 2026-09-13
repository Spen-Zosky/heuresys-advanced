/**
 * #159 F2 (S1099) — la console dell'agente e' il PRIMO consumatore di `AgentPanel`
 * (@heuresys/ui 1.2.0). Questa prova e' la dimostrazione live della fase: login reale,
 * pagina resa dal componente condiviso, una domanda al gateway vivo e lo stream che
 * arriva. Pretende NEXT_PUBLIC_ENABLE_AGENT_DEV=1 sul web e il gateway su :8790.
 */
import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.describe("#159 F2 — /dev/agent consuma AgentPanel", () => {
  test.use({ storageState: storageStateFor("platformAdmin") });

  test("la pagina e' resa dal componente condiviso e una domanda produce uno stream", async ({ page }) => {
    test.setTimeout(300_000); // il modello risponde in 60-100 s: la prova aspetta lo stream, non la pagina
    await page.goto("/dev/agent", { waitUntil: "domcontentloaded", timeout: 60_000 });
    // Il prefisso dei testid e' del consumatore: la pagina lo imposta a `agentdev`.
    await expect(page.getByTestId("agentdev-page")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("agentdev-title")).toBeVisible();
    await expect(page.getByTestId("agentdev-stream-empty")).toBeVisible();

    await page.getByTestId("agentdev-prompt").fill("Quante unita' organizzative esistono? Rispondi in una riga.");
    await page.getByTestId("agentdev-run").click();
    // Lo stream e' del canale, non del componente: se arriva, il ponte e' intero.
    await expect(page.getByTestId("agentdev-stream-line").first()).toBeVisible({ timeout: 180_000 });
    // Una corsa riuscita NON produce un avviso (l'hook lo emette solo su errore o approvazione):
    // la fine si legge dal pulsante «Ferma» che sparisce. Misurato alla prima corsa: 85 righe
    // arrivate e la prova rossa perche' aspettava un avviso che per costruzione non c'e'.
    await expect(page.getByTestId("agentdev-stop")).toBeHidden({ timeout: 240_000 });
    await expect(page.getByTestId("agentdev-notice-err")).toBeHidden();
    expect(await page.getByTestId("agentdev-stream-line").count()).toBeGreaterThan(1);
  });
});
