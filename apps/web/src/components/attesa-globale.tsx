"use client";

/**
 * apps/web/src/components/attesa-globale.tsx — la barra in cima alla pagina per ogni attesa che
 * blocca (regola `.claude/rules/attese-bloccanti.md`, Enzo 2026-11-16).
 *
 * Accesa finché c'è almeno una scrittura in corso (`useIsMutating`), in tutta l'app: le pagine non la
 * montano e non la spengono da sé. Il ritardo di `TopProgress` evita il lampo sulle scritture brevi.
 */
import { useIsMutating } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { TopProgress } from "@heuresys/ui";

export function AttesaGlobale() {
  const { t } = useTranslation();
  const inCorso = useIsMutating();
  return <TopProgress active={inCorso > 0} label={t("attesa.inCorso")} />;
}
