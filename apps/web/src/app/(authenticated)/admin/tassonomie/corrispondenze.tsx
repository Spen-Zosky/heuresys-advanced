"use client";

/**
 * Le corrispondenze di una classe di attività verso le altre classificazioni (ATECO ↔ NACE):
 * si leggono nei due versi e se ne aggiunge una (`POST /v1/activity-classification-mappings`).
 * Togliere una corrispondenza è ritirato (`lib/rotte-ritirate.ts`).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input } from "@heuresys/ui";
import type { ActivityClassification, ActivityClassificationMapping, ActivityMappingKind } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { useEnumLabel } from "@/lib/enum-labels";
import type { VoceClasse } from "./catalogo-classi";

const TIPI: ActivityMappingKind[] = ["EXACT", "NARROWER", "BROADER", "RELATED", "APPROXIMATE"];
const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface Elenco<T> { items: T[]; total: number }

export function Corrispondenze({ voce }: { voce: VoceClasse }) {
  const { t } = useTranslation("admin");
  const enumLabel = useEnumLabel();
  const qc = useQueryClient();
  const perms = useCurrentUserPermissions().data?.permissions ?? [];
  const chiave = ["activity-classification-mappings", voce.id];
  const corr = useQuery({
    queryKey: chiave,
    queryFn: async () => {
      const [da, verso] = await Promise.all([
        apiFetch<Elenco<ActivityClassificationMapping>>(`/v1/activity-classification-mappings?sourceId=${voce.id}&limit=500`),
        apiFetch<Elenco<ActivityClassificationMapping>>(`/v1/activity-classification-mappings?targetId=${voce.id}&limit=500`),
      ]);
      const righe = [...da.items, ...verso.items];
      const altri = [...new Set(righe.map((r) => (r.sourceId === voce.id ? r.targetId : r.sourceId)))];
      const classi = await Promise.all(altri.map((id) => apiFetch<ActivityClassification>(`/v1/activity-classifications/${id}`)));
      const nome = new Map(classi.map((c) => [c.activityClassificationId, c]));
      return { righe, nome };
    },
  });

  const [cerca, setCerca] = useState("");
  const [cercato, setCercato] = useState("");
  useEffect(() => { const h = setTimeout(() => setCercato(cerca.trim()), 250); return () => clearTimeout(h); }, [cerca]);
  const candidati = useQuery({
    queryKey: ["activity-classifications", "search", cercato],
    queryFn: () => apiFetch<Elenco<ActivityClassification>>(`/v1/activity-classifications?${new URLSearchParams({ search: cercato, limit: "50" }).toString()}`),
    enabled: cercato.length >= 2,
  });
  const [scelta, setScelta] = useState({ targetId: "", kind: "EXACT" as ActivityMappingKind, confidence: "1" });
  const fiduciaOk = scelta.confidence.trim() !== "" && Number(scelta.confidence) >= 0 && Number(scelta.confidence) <= 1;
  const crea = useMutation({
    mutationFn: () => apiFetch("/v1/activity-classification-mappings", {
      method: "POST", body: { sourceId: voce.id, targetId: scelta.targetId, kind: scelta.kind, confidence: Number(scelta.confidence) },
    }),
    onSuccess: () => { setScelta({ targetId: "", kind: "EXACT", confidence: "1" }); setCerca(""); void qc.invalidateQueries({ queryKey: chiave }); },
  });

  return (
    <div className="space-y-2 border-t border-border pt-3" data-testid="corrispondenze">
      <p className="text-sm font-medium text-foreground">{t("tassonomie.corrispondenze.titolo")}</p>
      {corr.isLoading && <p className="text-sm text-muted-foreground">{t("common:loading")}</p>}
      {corr.data && (
        <>
          <p className="text-sm text-muted-foreground" data-testid="corrispondenze-count">{t("tassonomie.corrispondenze.conto", { count: corr.data.righe.length })}</p>
          <ul className="space-y-1 text-sm">
            {corr.data.righe.map((r) => {
              const altro = corr.data.nome.get(r.sourceId === voce.id ? r.targetId : r.sourceId);
              return (
                <li key={r.activityClassMappingId} data-testid="corrispondenza-row">
                  {altro ? `${enumLabel("activityClassScheme", altro.scheme)} ${altro.code} — ${altro.name}` : "—"}
                  {" · "}{enumLabel("activityMappingKind", r.kind)}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {perms.includes("enterprise_typing:create") && (
        <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-4">
          <label className="text-sm text-foreground md:col-span-2">{t("tassonomie.corrispondenze.cerca")}
            <Input value={cerca} onChange={(e) => setCerca(e.target.value)} data-testid="corrispondenza-search" autoComplete="off" />
            {(candidati.data?.items.length ?? 0) > 0 && (
              <select className={SELECT_CLASS} size={Math.min(6, candidati.data!.items.length)} value={scelta.targetId}
                onChange={(e) => setScelta({ ...scelta, targetId: e.target.value })} data-testid="corrispondenza-target">
                {candidati.data!.items.filter((c) => c.activityClassificationId !== voce.id).map((c) => (
                  <option key={c.activityClassificationId} value={c.activityClassificationId}>{enumLabel("activityClassScheme", c.scheme)} {c.code} — {c.name}</option>
                ))}
              </select>
            )}
          </label>
          <label className="text-sm text-foreground">{t("tassonomie.corrispondenze.tipo")}
            <select className={SELECT_CLASS} value={scelta.kind} onChange={(e) => setScelta({ ...scelta, kind: e.target.value as ActivityMappingKind })} data-testid="corrispondenza-kind">
              {TIPI.map((k) => <option key={k} value={k}>{enumLabel("activityMappingKind", k)}</option>)}
            </select></label>
          <label className="text-sm text-foreground">{t("tassonomie.corrispondenze.fiducia")}
            <Input value={scelta.confidence} inputMode="decimal" onChange={(e) => setScelta({ ...scelta, confidence: e.target.value })} /></label>
          <Button type="button" size="sm" data-testid="corrispondenza-save" disabled={!scelta.targetId || !fiduciaOk || crea.isPending} onClick={() => crea.mutate()}>
            {crea.isPending ? t("common:saving") : t("tassonomie.corrispondenze.aggiungi")}
          </Button>
          {crea.isError && <p className="text-sm text-danger md:col-span-4">{t("tassonomie.corrispondenze.errore")}</p>}
        </div>
      )}
    </div>
  );
}
