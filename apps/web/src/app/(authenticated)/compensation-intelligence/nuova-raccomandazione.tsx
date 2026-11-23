"use client";

/**
 * Una raccomandazione retributiva si registra dalla pagina (`POST /v1/compensation/recommendations`,
 * ondata 3 degli endpoint senza consumatori, 2026-11-17). Nasce sempre «proposta»: l'approvazione
 * segue il suo giro e i cancelli di equità (reward gates) la possono sopprimere. Il comando compare
 * solo con `compensation_intelligence:update`; l'importo è in euro con due decimali, come vuole l'API.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import type { User } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { PersonPicker } from "@/components/person-picker";

export function NuovaRaccomandazione() {
  const { t } = useTranslation("admin");
  const qc = useQueryClient();
  const puo = (useCurrentUserPermissions().data?.permissions ?? []).includes("compensation_intelligence:update");
  const [aperto, setAperto] = useState(false);
  const [persone, setPersone] = useState<User[]>([]);
  const [v, setV] = useState({ dal: "", al: "", importo: "", motivazione: "" });
  const importoValido = v.importo.trim() === "" || /^-?\d+([.,]\d{1,2})?$/.test(v.importo.trim());
  const crea = useMutation({
    mutationFn: () => apiFetch("/v1/compensation/recommendations", {
      method: "POST",
      body: {
        userId: persone[0]!.userId, periodStart: v.dal, periodEnd: v.al,
        amountEur: v.importo.trim() === "" ? null : v.importo.trim().replace(",", "."),
        narrative: v.motivazione.trim() || null,
      },
    }),
    onSuccess: () => { setPersone([]); setV({ dal: "", al: "", importo: "", motivazione: "" }); void qc.invalidateQueries({ queryKey: ["compensation", "recommendations"] }); },
  });
  if (!puo) return null;
  return (
    <Card data-testid="comp-recommendation-create">
      <CardHeader>
        <CardTitle as="h3" className="flex items-center justify-between gap-3">
          <span>{t("compReward.nuova.titolo")}</span>
          <Button type="button" variant="outline" data-testid="comp-recommendation-create-toggle" onClick={() => setAperto((x) => !x)}>
            {aperto ? t("compReward.nuova.chiudi") : t("compReward.nuova.apri")}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent hidden={!aperto} className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="md:col-span-4">
          <PersonPicker label={t("compReward.nuova.persona")} value={persone} onChange={(x) => setPersone(x.slice(-1))} testId="comp-recommendation-person" />
        </div>
        <label className="text-sm font-medium text-foreground">{t("compReward.nuova.dal")}
          <Input type="date" value={v.dal} onChange={(e) => setV({ ...v, dal: e.target.value })} data-testid="comp-recommendation-from" /></label>
        <label className="text-sm font-medium text-foreground">{t("compReward.nuova.al")}
          <Input type="date" value={v.al} onChange={(e) => setV({ ...v, al: e.target.value })} data-testid="comp-recommendation-to" /></label>
        <label className="text-sm font-medium text-foreground">{t("compReward.nuova.importo")}
          <Input inputMode="decimal" value={v.importo} onChange={(e) => setV({ ...v, importo: e.target.value })} data-testid="comp-recommendation-amount" aria-invalid={!importoValido} /></label>
        <label className="text-sm font-medium text-foreground md:col-span-4">{t("compReward.nuova.motivazione")}
          <Input value={v.motivazione} maxLength={2048} onChange={(e) => setV({ ...v, motivazione: e.target.value })} data-testid="comp-recommendation-narrative" /></label>
        <div className="flex items-center gap-3 md:col-span-4">
          <Button type="button" data-testid="comp-recommendation-submit"
            disabled={persone.length !== 1 || !v.dal || !v.al || v.al < v.dal || !importoValido || crea.isPending} onClick={() => crea.mutate()}>
            {crea.isPending ? t("common:saving") : t("compReward.nuova.registra")}
          </Button>
          {crea.isError && (
            <span className="text-sm text-danger">
              {isApiError(crea.error) && crea.error.status === 403 ? t("compReward.nuova.vietato") : t("compReward.nuova.errore")}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
