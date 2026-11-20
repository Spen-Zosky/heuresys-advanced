"use client";

/** /me/faldone — il proprio Faldone dell'Utente: tutti i propri dati (I17), con i soli {omissis} di legge. */
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { FaldoneVista } from "@/components/faldone-vista";

export default function IlMioFaldonePage() {
  const { t } = useTranslation("ess");
  return (
    <FaldoneVista
      base="/v1/me/faldone"
      indietro={<Link href="/me/profile" className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">{t("faldone.indietro")}</Link>}
    />
  );
}
