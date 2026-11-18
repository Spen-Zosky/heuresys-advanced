"use client";

/**
 * Le proposte di una corsa di ricerca si decidono dalla pagina delle corse (ondata 4a degli endpoint
 * senza consumatori, 2026-11-18): `POST /v1/seed-candidate-records/:id/decision` (approvare o
 * respingere, con la motivazione obbligatoria in entrambi i versi) e `POST /v1/seed-approval-decisions`
 * (rimandare da correggere) esistevano senza un pulsante. La decisione è umana: qui la si prende,
 * l'agente non la prende mai. Una proposta respinta dai controlli non si approva a mano (l'API lo
 * rifiuta), e una già applicata non si decide più.
 * Comandi solo con `seed_acquisition:approve`.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input } from "@heuresys/ui";
import type { CandidatiRicercaResponse, PropostaRicerca, SeedAcquisitionRun } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { useEnumLabel } from "@/lib/enum-labels";

const MOTIVAZIONE_MINIMA = 10;

function RigaProposta({ p, corsaId, puo }: { p: PropostaRicerca; corsaId: string; puo: boolean }) {
  const { t } = useTranslation("blueprints");
  const enumLabel = useEnumLabel();
  const qc = useQueryClient();
  const [motivo, setMotivo] = useState("");
  const aggiorna = () => void qc.invalidateQueries({ queryKey: ["seed-acquisition-runs", corsaId, "candidates"] });
  const decidi = useMutation({
    mutationFn: (decisione: "APPROVED" | "REJECTED") => apiFetch<PropostaRicerca>(`/v1/seed-candidate-records/${p.candidateId}/decision`, {
      method: "POST", body: { decisione, motivazione: motivo.trim() },
    }),
    onSuccess: () => { setMotivo(""); aggiorna(); },
  });
  const rimanda = useMutation({
    mutationFn: () => apiFetch("/v1/seed-approval-decisions", {
      method: "POST", body: { candidateId: p.candidateId, status: "NEEDS_CHANGES", rationale: motivo.trim() },
    }),
    onSuccess: () => { setMotivo(""); aggiorna(); },
  });
  const decidibile = puo && p.stato !== "APPLIED";
  const motivoOk = motivo.trim().length >= MOTIVAZIONE_MINIMA;
  const occupato = decidi.isPending || rimanda.isPending;
  return (
    <li className="rounded-md border border-border p-3" data-testid="seed-proposal-row">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-foreground">{p.chiaveNaturale}</span>
        <span className="text-xs text-muted-foreground">{p.dominio}</span>
        <span className="text-xs" data-testid="seed-proposal-state">{enumLabel("statoPropostaRicerca", p.stato)}</span>
        {p.decisione?.motivazione && <span className="text-xs text-muted-foreground">· {p.decisione.motivazione}</span>}
      </div>
      {decidibile && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium text-foreground">{t("proposteCorsa.motivazione")}
            <Input value={motivo} maxLength={4000} onChange={(e) => setMotivo(e.target.value)} data-testid="seed-proposal-reason"
              placeholder={t("proposteCorsa.motivazioneMinima", { n: MOTIVAZIONE_MINIMA })} /></label>
          <Button type="button" size="sm" data-testid="seed-proposal-approve" disabled={!motivoOk || occupato || p.stato === "FAILED"}
            onClick={() => decidi.mutate("APPROVED")}>{t("proposteCorsa.approva")}</Button>
          <Button type="button" size="sm" variant="outline" data-testid="seed-proposal-reject" disabled={!motivoOk || occupato}
            onClick={() => decidi.mutate("REJECTED")}>{t("proposteCorsa.respingi")}</Button>
          <Button type="button" size="sm" variant="ghost" data-testid="seed-proposal-needs-changes" disabled={!motivoOk || occupato}
            onClick={() => rimanda.mutate()}>{t("proposteCorsa.daCorreggere")}</Button>
          {(decidi.isError || rimanda.isError) && <span className="text-xs text-danger" data-testid="seed-proposal-error">{t("proposteCorsa.errore")}</span>}
        </div>
      )}
    </li>
  );
}

export function ProposteCorsa({ corsa }: { corsa: SeedAcquisitionRun }) {
  const { t } = useTranslation("blueprints");
  const puo = (useCurrentUserPermissions().data?.permissions ?? []).includes("seed_acquisition:approve");
  const proposte = useQuery({
    queryKey: ["seed-acquisition-runs", corsa.seedAcquisitionRunId, "candidates"],
    queryFn: () => apiFetch<CandidatiRicercaResponse>(`/v1/seed-acquisition-runs/${corsa.seedAcquisitionRunId}/candidates`),
  });
  return (
    <section className="rounded-lg border border-border bg-card p-4" data-testid="seed-run-proposals">
      <h2 className="text-base font-semibold text-foreground">{t("proposteCorsa.titolo", { codice: corsa.code })}</h2>
      {proposte.isLoading && <p className="mt-2 text-sm text-muted-foreground">{t("proposteCorsa.caricamento")}</p>}
      {proposte.isError && <p className="mt-2 text-sm text-danger">{t("proposteCorsa.erroreLettura")}</p>}
      {proposte.data && (
        <>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="seed-run-proposals-count">{t("proposteCorsa.conto", { count: proposte.data.total })}</p>
          <ul className="mt-3 space-y-2">
            {proposte.data.items.map((p) => <RigaProposta key={p.candidateId} p={p} corsaId={corsa.seedAcquisitionRunId} puo={puo} />)}
          </ul>
        </>
      )}
    </section>
  );
}
