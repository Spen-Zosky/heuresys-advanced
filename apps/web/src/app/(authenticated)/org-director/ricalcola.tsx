"use client";

/**
 * Ricalcolo delle capacità e della maturità dalla console (ondata 3 degli endpoint senza consumatori,
 * 2026-11-17): `POST /v1/capability/composition/recompute` e `POST /v1/capability/maturity/recompute`
 * esistevano e nessuna pagina li chiamava. Il ricalcolo è un lavoro lungo: si mostra con
 * `LavoroInCorso` nel punto in cui arriva l'esito (regola delle attese che bloccano). Prima la
 * composizione, poi la maturità, che la legge. Solo con `capability:admin`.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { LavoroInCorso } from "@/components/lavoro-in-corso";

export function RicalcolaCapacita() {
  const { t } = useTranslation("hr");
  const qc = useQueryClient();
  const puo = (useCurrentUserPermissions().data?.permissions ?? []).includes("capability:admin");
  const [passo, setPasso] = useState(0);
  const [esito, setEsito] = useState<string | null>(null);
  const ricalcola = useMutation({
    mutationFn: async () => {
      setEsito(null);
      setPasso(1);
      await apiFetch("/v1/capability/composition/recompute", { method: "POST", body: {} });
      setPasso(2);
      const m = await apiFetch<{ scored: number }>("/v1/capability/maturity/recompute", { method: "POST", body: {} });
      return m.scored;
    },
    onSuccess: (n) => {
      setPasso(0);
      setEsito(t("orgDirector.ricalcolo.fatto", { count: n }));
      void qc.invalidateQueries({ queryKey: ["capability"] });
      void qc.invalidateQueries({ queryKey: ["org-director"] });
    },
    onError: () => setPasso(0),
  });
  if (!puo) return null;
  return (
    <div className="space-y-3" data-testid="org-director-recompute">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" data-testid="org-director-recompute-start" disabled={ricalcola.isPending}
          onClick={() => { if (window.confirm(t("orgDirector.ricalcolo.conferma"))) ricalcola.mutate(); }}>
          {ricalcola.isPending ? t("orgDirector.ricalcolo.inCorso") : t("orgDirector.ricalcolo.avvia")}
        </Button>
        {esito && <span data-testid="org-director-recompute-ok" className="text-sm text-success">{esito}</span>}
        {ricalcola.isError && <span className="text-sm text-danger">{t("orgDirector.ricalcolo.errore")}</span>}
      </div>
      <LavoroInCorso
        attivo={ricalcola.isPending}
        titolo={t("orgDirector.ricalcolo.titolo")}
        dettaglio={passo === 1 ? t("orgDirector.ricalcolo.passo1") : t("orgDirector.ricalcolo.passo2")}
        valore={passo - 1}
        massimo={2}
      />
    </div>
  );
}
