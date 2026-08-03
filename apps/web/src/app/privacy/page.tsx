"use client";
import { useTranslation } from "react-i18next";

// #4 GTM W4 — informativa privacy completa (art. 13 GDPR), non un riassunto.
//
// Ogni affermazione qui è verificata contro ciò che il sistema fa davvero:
//  - l'elenco dei dati corrisponde ai campi del modulo (`LeadCreateSchema`);
//  - «a nessuno» sui destinatari è vero perché il modulo lead non invia e-mail né
//    chiama servizi esterni: i dati restano nel database;
//  - i 24 mesi di conservazione sono ora APPLICATI, non solo promessi: `sys_leads` è
//    registrata nel registro di conservazione (mig 000233) e la sweep la include.
//    Finché non lo era, questa pagina dichiarava al pubblico qualcosa che il sistema
//    non faceva.
//
// Struttura a sezioni con titoli veri: un'informativa si consulta per punti, e un muro
// di paragrafi senza intestazioni non è consultabile.

const SECTIONS = [
  "controller",
  "data",
  "required",
  "purpose",
  "legalBasis",
  "recipients",
  "retention",
  "location",
  "rights",
  "complaint",
  "security",
] as const;

export default function PrivacyPage() {
  const { t } = useTranslation("landing");
  return (
    <main
      data-testid="privacy-page"
      className="mx-auto min-h-screen max-w-3xl space-y-8 px-6 py-16 text-sm text-foreground"
    >
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{t("privacy.title")}</h1>
        <p className="text-xs text-muted-foreground" data-testid="privacy-updated">
          {t("privacy.updated")}
        </p>
        <p className="text-muted-foreground">{t("privacy.intro")}</p>
      </header>

      {SECTIONS.map((key) => (
        <section key={key} data-testid={`privacy-section-${key}`} className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">{t(`privacy.${key}Title`)}</h2>
          <p className="leading-relaxed text-muted-foreground">{t(`privacy.${key}`)}</p>
        </section>
      ))}
    </main>
  );
}
