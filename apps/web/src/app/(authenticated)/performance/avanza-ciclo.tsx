"use client";

/**
 * Il ciclo di valutazione avanza di fase dalla pagina (`POST /v1/review-cycles/:id/transition`,
 * ondata 3 degli endpoint senza consumatori, 2026-11-17). Le fasi ammesse sono quelle del contratto
 * (`REVIEW_CYCLE_TRANSITIONS` di @heuresys/shared), ricopiate qui perché il web importa tipi, non
 * valori; l'API le ricontrolla comunque. Il comando compare solo con `review-cycle:manage`.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@heuresys/ui";
import type { ReviewCycle, ReviewCycleStatus } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { useEnumLabel } from "@/lib/enum-labels";

const PROSSIME: Readonly<Record<string, readonly ReviewCycleStatus[]>> = {
  DRAFT: ["SELF_ASSESSMENT", "CANCELLED"],
  SELF_ASSESSMENT: ["MANAGER_REVIEW", "CANCELLED"],
  MANAGER_REVIEW: ["CALIBRATION", "CANCELLED"],
  CALIBRATION: ["FINALIZED", "CANCELLED"],
  FINALIZED: ["SHARED"],
  SHARED: [],
  CANCELLED: [],
};

export function usePuoGestireCicli(): boolean {
  return (useCurrentUserPermissions().data?.permissions ?? []).includes("review-cycle:manage");
}

export function AvanzaCiclo({ ciclo }: { ciclo: ReviewCycle }) {
  const { t } = useTranslation("hr");
  const enumLabel = useEnumLabel();
  const qc = useQueryClient();
  const avanza = useMutation({
    mutationFn: (to: ReviewCycleStatus) => apiFetch(`/v1/review-cycles/${ciclo.reviewCycleId}/transition`, { method: "POST", body: { to } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["review-cycles"] }),
  });
  const prossime = PROSSIME[ciclo.status] ?? [];
  if (prossime.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-2">
      {prossime.map((s) => (
        <Button key={s} type="button" size="sm" variant="outline" data-testid={`perf-cycle-to-${s}`} disabled={avanza.isPending}
          onClick={() => { if (window.confirm(t("performance.cycles.confermaFase", { fase: enumLabel("perfCycleStatus", s) }))) avanza.mutate(s); }}>
          {s === "CANCELLED" ? t("performance.cycles.annulla") : t("performance.cycles.passaA", { fase: enumLabel("perfCycleStatus", s) })}
        </Button>
      ))}
      {avanza.isError && <span className="text-xs text-danger">{t("performance.cycles.erroreFase")}</span>}
    </span>
  );
}
