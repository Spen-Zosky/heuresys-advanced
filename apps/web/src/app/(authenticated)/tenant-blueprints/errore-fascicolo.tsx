"use client";

/**
 * apps/web/src/app/(authenticated)/tenant-blueprints/errore-fascicolo.tsx
 *
 * Classi Q del giro del 25/11/2026: quando un fascicolo (o una sua versione) non si apre, la pagina
 * restava un riquadro isolato, senza titolo e senza una strada per tornare indietro, e il testo
 * generico del 404 («non esiste, oppure non è visibile») lasciava il dubbio. L'autorizzazione non
 * cambia: il servizio risponde 404 anche a chi è fuori perimetro (I-G), e la pagina non lo distingue.
 * Dice però una cosa vera in entrambi i casi — il fascicolo non è fra quelli che il profilo apre —
 * con l'intestazione della pagina e il collegamento all'elenco.
 *
 * Lo stato si riconosce per FORMA (`status` sull'errore), non con `instanceof`: nel bundle di
 * produzione quel controllo può tornare falso (vedi la pagina della costruzione).
 */
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/intestazione-pagina";
import { StatoErrore, StatoVuoto } from "@/components/stato-pagina";

function stato(errore: unknown): number | null {
  return typeof errore === "object" && errore !== null && "status" in errore ? Number((errore as { status: unknown }).status) : null;
}

export function ErroreFascicolo({ errore, onRiprova }: { errore: unknown; onRiprova: () => void }) {
  const { t } = useTranslation("blueprints");
  const indietro = (
    <Link href="/tenant-blueprints" className="underline-offset-2 hover:underline" data-testid="tenant-blueprint-error-back">
      {t("dossier.back")}
    </Link>
  );
  return (
    <div className="space-y-6" data-testid="tenant-blueprint-error-page">
      <PageHeader breadcrumbs={indietro} title={t("dossier.singleTitle")} />
      {stato(errore) === 404 ? (
        <StatoVuoto
          testId="tenant-blueprint-unavailable"
          titolo={t("dossier.unavailable.title")}
          motivo={t("dossier.unavailable.reason")}
          livelloTitolo="h2"
          azione={
            <Link href="/tenant-blueprints" className="text-sm font-medium text-primary underline-offset-2 hover:underline">
              {t("dossier.unavailable.toList")}
            </Link>
          }
        />
      ) : (
        <StatoErrore errore={errore} titolo={t("dossier.loadError")} livelloTitolo="h2" onRiprova={onRiprova} />
      )}
    </div>
  );
}
