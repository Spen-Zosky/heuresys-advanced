"use client";

/** /users/[userId]/faldone — il Faldone di un'altra persona, nel perimetro di chi guarda (I18). */
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useParams } from "next/navigation";
import { FaldoneVista } from "@/components/faldone-vista";

export default function FaldonePersonaPage() {
  const { t } = useTranslation("ess");
  const { userId } = useParams<{ userId: string }>();
  return (
    <FaldoneVista
      base={`/v1/faldone/${userId}`}
      indietro={<Link href={`/users/${userId}`} className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">{t("faldone.indietroPersona")}</Link>}
    />
  );
}
