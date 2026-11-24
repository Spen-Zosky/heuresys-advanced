/**
 * K33 (giro forense del 23/11/2026): «Minified React error #418» con argomento «text» dopo il
 * cambio di lingua. Il pulsante scrive NEXT_LOCALE=en; alla pagina seguente il layout radice
 * metteva <html lang="en">, ma i testi il server li scriveva in italiano, perché l'istanza di
 * i18next sul server non vede document.cookie; il browser invece partiva in inglese. Testo del
 * server diverso dal primo disegno del browser: #418. Misurato in produzione il 24/11 con il
 * cookie a «en»: /privacy risponde con lang="en" e il titolo «Informativa sulla privacy».
 *
 * La prova disegna come il server (ambiente node, nessun window) lo stesso albero dei provider
 * del layout radice, e pretende che il testo sia nella lingua del cookie, che è quella da cui
 * parte il browser. Pretende anche che due disegni in lingue diverse non si contaminino: sul
 * server l'istanza condivisa serve richieste concorrenti.
 */
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { useTranslation } from "react-i18next";
import { describe, expect, it } from "vitest";
import { AppProviders } from "../providers/AppProviders";
import { i18n } from "./i18n";

function Sonda() {
  const { t } = useTranslation();
  return createElement("p", null, t("shell:ui.languageSwitch", { lang: "EN" }));
}

function disegnaComeIlServer(lingua: "it" | "en"): string {
  // AppProviders riceve la lingua dal layout radice, che la legge dal cookie NEXT_LOCALE.
  const props = { lingua } as unknown as Parameters<typeof AppProviders>[0];
  return renderToString(createElement(AppProviders, props, createElement(Sonda)));
}

describe("K33 — il server scrive i testi nella lingua del cookie", () => {
  it("con il cookie a «en» il testo del server è inglese, come il primo disegno del browser", () => {
    expect(disegnaComeIlServer("en")).toContain("switch language between Italian and English");
  });

  it("con il cookie a «it» resta italiano, e i due disegni non si contaminano", () => {
    expect(disegnaComeIlServer("it")).toContain("cambia lingua tra italiano e inglese");
    expect(disegnaComeIlServer("en")).toContain("switch language between Italian and English");
    expect(disegnaComeIlServer("it")).toContain("cambia lingua tra italiano e inglese");
    // l'istanza condivisa del server non cambia lingua
    expect(i18n.language).toBe("it");
  });
});
