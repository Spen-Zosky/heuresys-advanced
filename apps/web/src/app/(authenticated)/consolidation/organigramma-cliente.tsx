"use client";

/**
 * L'organigramma del cliente dentro la pagina di consolidamento (piano
 * docs/piani/PIANO_organigrammi-a-blocchi_20261114.md, V6). Chi decide le proposte del
 * consolidamento vede l'organizzazione com'è oggi, a blocchi con le persone come nel banco del
 * datastore, senza lasciare la pagina. Sta in un file a sé perché la pagina è toccata da altri
 * lavori in corso: in `page.tsx` entra una riga sola.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { VistaOrganigramma } from "@/components/organigramma/vista";

export function OrganigrammaCliente() {
  const { t } = useTranslation("common");
  const [aperto, setAperto] = useState(false);
  const Icona = aperto ? ChevronDown : ChevronRight;
  return (
    <Card data-testid="consolidation-organigramma">
      <CardHeader>
        <CardTitle>
          <button type="button" className="flex items-center gap-2 text-left" onClick={() => setAperto((a) => !a)} aria-expanded={aperto}>
            <Icona className="h-4 w-4" aria-hidden />
            {t("organigramma.consolidamento.titolo")}
          </button>
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("organigramma.consolidamento.spiegazione")}</p>
      </CardHeader>
      {aperto ? (
        <CardContent>
          <VistaOrganigramma testId="consolidation-organigramma-vista" />
        </CardContent>
      ) : null}
    </Card>
  );
}
