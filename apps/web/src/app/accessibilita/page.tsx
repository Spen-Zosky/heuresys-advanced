"use client";
import { useTranslation } from "react-i18next";

// F-6 del piano interfacce (lotto L7): la dichiarazione di accessibilità.
//
// Ogni affermazione qui dice ciò che è stato MISURATO e come, non ciò che si spera: lo stato
// è «parzialmente conforme» perché la misura è automatica (axe, WCAG 2.2 A e AA, su ogni
// pagina di prodotto con ogni profilo, e le pagine personali a 390 pixel) e una verifica a
// mano con un lettore di schermo non è ancora stata fatta. Quando lo sarà, cambia questa
// pagina insieme alla data. La misura si ripete con
// `CENSIMENTO=1 pnpm exec playwright test censimento-interfacce.spec.ts`.

const SECTIONS = ["scope", "status", "method", "known", "feedback", "enforcement"] as const;

export default function AccessibilityStatementPage() {
  const { t } = useTranslation("landing");
  return (
    <main
      data-testid="accessibility-statement-page"
      className="mx-auto min-h-screen max-w-3xl space-y-8 px-6 py-16 text-sm text-foreground"
    >
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{t("accessibility.title")}</h1>
        <p className="text-xs text-muted-foreground" data-testid="accessibility-updated">
          {t("accessibility.updated")}
        </p>
        <p className="text-muted-foreground">{t("accessibility.intro")}</p>
      </header>

      {SECTIONS.map((key) => (
        <section key={key} data-testid={`accessibility-section-${key}`} className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">{t(`accessibility.${key}Title`)}</h2>
          <p className="leading-relaxed text-muted-foreground">{t(`accessibility.${key}`)}</p>
        </section>
      ))}
    </main>
  );
}
