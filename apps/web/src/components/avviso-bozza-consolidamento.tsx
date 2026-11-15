"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { PendingApproval } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";

// L'avviso nell'intestazione (Enzo, 2026-11-14): dalla prima decisione registrata nella bozza del
// consolidamento fino all'approvazione definitiva resta acceso un segnale arancione intermittente.
// Il dato è persistente (le decisioni non approvate nel database), non uno stato del browser: si
// legge dopo il controllo dei permessi, cioè solo se la persona può aprire /consolidation.
// Con l'animazione ridotta il segnale resta acceso e fermo, e il testo dice comunque che cosa c'è.

export function AvvisoBozzaConsolidamento({ abilitato }: { abilitato: boolean }) {
  const { t } = useTranslation("hr");
  const q = useQuery({
    queryKey: ["tenant-consolidations", "pending-approval"],
    queryFn: () => apiFetch<PendingApproval>("/v1/tenant-consolidations/pending-approval"),
    enabled: abilitato,
    refetchInterval: 60_000,
    retry: false,
  });
  const n = q.data?.pending ?? 0;
  if (!abilitato || n === 0) return null;
  return (
    <Link
      href="/consolidation"
      data-testid="consolidation-pending-approval"
      role="status"
      title={t("consolidation.approval.headerHint")}
      className="inline-flex items-center gap-2 rounded-full border border-orange-500 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-700 dark:text-orange-300"
    >
      <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-orange-500 animate-pulse motion-reduce:animate-none" />
      {t("consolidation.approval.header", { count: n })}
    </Link>
  );
}
