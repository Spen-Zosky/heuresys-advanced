/**
 * apps/web/tests/e2e/approvals-agent-detail.spec.ts — #159 F3 (S1116).
 *
 * Prima pagina PARAMETRICA ad adottare il ponte gateway<->pagine dopo la console
 * `/dev/agent` (#159 F2, la sola pagina finora). Login reale (tenantAdmin federica),
 * crea una vera richiesta di approvazione (stessa rotta LIVE-DATA di
 * `approvals.spec.ts`), apre `/approvals/[id]` e verifica che `AgentPanel` (@heuresys/ui)
 * riceva un `context` REALE — titolo + id della richiesta appena creata, presi dal
 * segmento dinamico `[id]`, mai un placeholder — e che una domanda vera al gateway
 * vivo produca uno stream. Stesso componente e stesso canale (`useAgentStream`) della
 * console: la prova che il ponte e' riusabile.
 *
 * Pretende NEXT_PUBLIC_ENABLE_AGENT_DEV=1 sul web e l'agent-gateway vivo su :8790
 * (AGENT_GATEWAY_WEB_ORIGIN sull'origine del web, gia' valido per la console: e' per
 * origine, non per pagina).
 */
import { test, expect } from "@playwright/test";
import { storageStateFor, completeApiLogin, gotoAuthenticated, PERSONAS } from "./fixtures";

test.use({ storageState: storageStateFor("tenantAdmin") });
test.describe.configure({ retries: 0 });

test.describe("#159 F3 — /approvals/[id] consuma AgentPanel con un contesto vero", () => {
  test("il pannello mostra il contesto reale della richiesta e una domanda produce uno stream", async ({
    page,
    request,
  }) => {
    test.setTimeout(300_000); // il modello risponde in 60-100 s: la prova aspetta lo stream, non la pagina

    const { user } = await completeApiLogin(request, PERSONAS.tenantAdmin.email);
    const federicaId = user.userId;
    const title = `E2E Approval Agent ${Date.now()}`;

    await gotoAuthenticated(page, "/approvals");
    await expect(page.getByTestId("approvals-page")).toBeVisible();

    // Crea una richiesta vera, con federica come sola approvatrice (stesso schema di
    // approvals.spec.ts) — serve solo ad avere un id/titolo REALI su cui costruire il
    // context, non a esercitare il ciclo di vita dell'approvazione.
    await page.getByTestId("approval-create-title").fill(title);
    await page.getByTestId("approval-create-approvers").selectOption([federicaId]);
    const [createRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/v1/approvals") && r.request().method() === "POST"),
      page.getByTestId("approval-create-submit").click(),
    ]);
    expect(createRes.status()).toBe(200);
    await expect(page.getByTestId("approval-create-success")).toBeVisible();

    const link = page.getByTestId("approval-row-link").filter({ hasText: title });
    await expect(link).toHaveCount(1);
    await link.click();

    // Il [id] route compila al primo hit sotto `next dev` (stesso margine di
    // approvals.spec.ts): la build prod non ne ha bisogno, la CI non ne e' toccata.
    await expect(page.getByTestId("approval-detail-page")).toBeVisible({ timeout: 30_000 });

    const id = page.url().split("/approvals/")[1];
    if (!id) throw new Error("id non estraibile dall'URL dopo la navigazione al dettaglio");

    // Il pannello e' della prossima pagina idonea (#159 F3): stesso componente
    // (`AgentPanel`) e stesso canale (`useAgentStream`) della console, montati qui col
    // namespace i18n e col context propri di questa pagina.
    await expect(page.getByTestId("approval-agent-page")).toBeVisible();
    await expect(page.getByTestId("approval-agent-title")).toBeVisible();

    // Il CONTESTO e' un valore VERO — titolo + id della richiesta appena creata, presi
    // dal segmento dinamico — non un placeholder: la prova fallirebbe se la pagina
    // passasse una stringa fissa invece del titolo/id reali.
    await expect(page.getByTestId("approval-agent-context")).toContainText(title);
    await expect(page.getByTestId("approval-agent-context")).toContainText(id);
    await expect(page.getByTestId("approval-agent-stream-empty")).toBeVisible();

    await page
      .getByTestId("approval-agent-prompt")
      .fill("Quante unita' organizzative esistono? Rispondi in una riga.");
    await page.getByTestId("approval-agent-run").click();
    // Lo stream e' del canale, non del componente: se arriva, il ponte e' intero anche
    // su una seconda pagina che non lo ha toccato.
    await expect(page.getByTestId("approval-agent-stream-line").first()).toBeVisible({ timeout: 180_000 });
    // Una corsa riuscita NON produce un avviso (l'hook lo emette solo su errore o
    // approvazione, come nella console): la fine si legge dal pulsante «Ferma» che sparisce.
    await expect(page.getByTestId("approval-agent-stop")).toBeHidden({ timeout: 240_000 });
    await expect(page.getByTestId("approval-agent-notice-err")).toBeHidden();
    expect(await page.getByTestId("approval-agent-stream-line").count()).toBeGreaterThan(0);
  });
});
