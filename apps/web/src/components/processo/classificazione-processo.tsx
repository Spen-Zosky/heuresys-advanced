"use client";

/**
 * apps/web/src/components/processo/classificazione-processo.tsx — la classificazione di un processo
 * del tenant per faccette (ADR-0061 D4, passo 2 del piano di attuazione; migrazione 000507).
 *
 * Una riga per faccetta: i valori assegnati, il criterio con cui sono stati scelti e, in ultima
 * colonna, chi li ha dati (una persona che ha deciso, o l'agente che li propone). Chi ha il potere
 * (`canEdit` dall'API: mandato HR, chi disegna i processi, il responsabile sul proprio processo)
 * apre la finestra della faccetta, sceglie i valori dal vocabolario chiuso con la loro spiegazione e
 * scrive il criterio; una proposta dell'agente si approva così com'è. Tutto da `/v1/tenant-processes`.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from "@heuresys/ui";
import type { ProcessFacet, ProcessFacetVocabularyResponse, TenantProcessFacet, TenantProcessFacetsResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { MODALE } from "@/lib/modale";

export const FACCETTE: readonly ProcessFacet[] = ["FINALITA", "BENEFICIARIO", "PERIMETRO", "MODALITA", "ATTIVAZIONE", "TECNOLOGIA", "STANDARDIZZAZIONE"];

export function useFaccetteProcesso(processId: string) {
  return useQuery({
    queryKey: ["tenant-processes", processId, "faccette"],
    queryFn: ({ signal }) => apiFetch<TenantProcessFacetsResponse>(`/v1/tenant-processes/${processId}/faccette`, { signal }),
    enabled: Boolean(processId),
    staleTime: 30_000,
    retry: false,
  });
}

export function ClassificazioneProcesso({ processId, faccette }: { processId: string; faccette: TenantProcessFacetsResponse }) {
  const { t } = useTranslation("blueprints");
  const k = (s: string, o?: Record<string, unknown>) => t(`processiDelTenant.classificazione.${s}`, o ?? {});
  const vocabolario = useQuery({
    queryKey: ["tenant-processes", "faccette", "vocabolario"],
    queryFn: ({ signal }) => apiFetch<ProcessFacetVocabularyResponse>("/v1/tenant-processes/faccette/vocabolario", { signal }),
    staleTime: 3_600_000,
  });
  const [aperta, setAperta] = useState<ProcessFacet | null>(null);
  const perFaccetta = useMemo(() => {
    const m = new Map<ProcessFacet, TenantProcessFacet[]>();
    for (const f of faccette.items) m.set(f.facet, [...(m.get(f.facet) ?? []), f]);
    return m;
  }, [faccette.items]);
  const assegnate = FACCETTE.filter((f) => perFaccetta.has(f)).length;
  // Le proposte dell'agente si approvano anche tutte insieme (decisione in blocco): una scrittura per
  // faccetta, con i valori e il criterio proposti, come se si premesse «Approva» su ciascuna.
  const proposte = FACCETTE.filter((f) => (perFaccetta.get(f) ?? []).some((v) => v.status === "PROPOSTA"));
  const qc = useQueryClient();
  const approvaTutte = useMutation({
    mutationFn: async () => {
      let ultima: TenantProcessFacetsResponse | null = null;
      for (const f of proposte) {
        const valori = perFaccetta.get(f) ?? [];
        ultima = await apiFetch<TenantProcessFacetsResponse>(`/v1/tenant-processes/${processId}/faccette/${f}`, {
          method: "PUT",
          body: { codes: valori.map((v) => v.code), criterion: valori[0]?.criterion ?? "" },
        });
      }
      return ultima;
    },
    onSettled: (r) => {
      if (r) qc.setQueryData(["tenant-processes", processId, "faccette"], r);
      void qc.invalidateQueries({ queryKey: ["tenant-processes", processId, "faccette"] });
    },
  });

  return (
    <div className="space-y-3" data-testid="classificazione-processo">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{k("nota", { assegnate, totale: FACCETTE.length })}</p>
        {faccette.canEdit && proposte.length > 0 ? (
          <Button size="sm" onClick={() => approvaTutte.mutate()} disabled={approvaTutte.isPending} data-testid="classificazione-approva-tutte">
            {approvaTutte.isPending ? k("approvazioneInCorso") : k("approvaTutte", { n: proposte.length })}
          </Button>
        ) : null}
      </div>
      {approvaTutte.isError ? <p className="text-xs text-destructive">{k("errore")}</p> : null}
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm" data-testid="classificazione-tabella">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">{k("colonne.faccetta")}</th>
              <th className="px-3 py-2 font-medium">{k("colonne.valori")}</th>
              <th className="px-3 py-2 font-medium">{k("colonne.criterio")}</th>
              <th className="px-3 py-2 font-medium">{k("colonne.stato")}</th>
              {faccette.canEdit ? <th className="px-3 py-2" /> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {FACCETTE.map((f) => {
              const valori = perFaccetta.get(f) ?? [];
              const proposta = valori.some((v) => v.status === "PROPOSTA");
              return (
                <tr key={f} data-testid="classificazione-riga" data-faccetta={f} className="align-top">
                  <td className="px-3 py-2">
                    <span className="font-medium">{k(`faccette.${f}.nome`)}</span>
                    <span className="block text-xs text-muted-foreground">{k(`faccette.${f}.domanda`)}</span>
                  </td>
                  <td className="px-3 py-2">
                    {valori.length === 0 ? <span className="text-xs text-muted-foreground">{k("nessunValore")}</span> : (
                      <span className="flex flex-wrap gap-1">
                        {valori.map((v) => <span key={v.code} className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs" data-testid="classificazione-valore">{v.label}</span>)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">{valori[0]?.criterion ?? ""}</td>
                  <td className="px-3 py-2 text-xs">
                    {valori.length === 0 ? null : proposta ? <span className="font-medium">{k("stato.proposta")}</span> : <span>{k("stato.approvata")}</span>}
                  </td>
                  {faccette.canEdit ? (
                    <td className="px-3 py-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => setAperta(f)} data-testid="classificazione-modifica">
                        {proposta ? k("esamina") : k("modifica")}
                      </Button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {aperta && vocabolario.data ? (
        <FinestraFaccetta
          processId={processId}
          faccetta={aperta}
          valori={vocabolario.data.items.filter((v) => v.facet === aperta)}
          attuali={perFaccetta.get(aperta) ?? []}
          onChiudi={() => setAperta(null)}
        />
      ) : null}
    </div>
  );
}

function FinestraFaccetta({ processId, faccetta, valori, attuali, onChiudi }: {
  processId: string;
  faccetta: ProcessFacet;
  valori: ProcessFacetVocabularyResponse["items"];
  attuali: TenantProcessFacet[];
  onChiudi: () => void;
}) {
  const { t } = useTranslation("blueprints");
  const k = (s: string) => t(`processiDelTenant.classificazione.${s}`);
  const qc = useQueryClient();
  const [scelti, setScelti] = useState<string[]>(attuali.map((a) => a.code));
  const [criterio, setCriterio] = useState(attuali[0]?.criterion ?? "");
  const proposta = attuali.some((a) => a.status === "PROPOSTA");
  const salva = useMutation({
    mutationFn: () => apiFetch<TenantProcessFacetsResponse>(`/v1/tenant-processes/${processId}/faccette/${faccetta}`, {
      method: "PUT",
      body: { codes: scelti, criterion: criterio.trim() },
    }),
    onSuccess: (r) => {
      qc.setQueryData(["tenant-processes", processId, "faccette"], r);
      onChiudi();
    },
  });
  const manca = scelti.length > 0 && criterio.trim().length === 0;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onChiudi(); }}>
      <DialogContent className={MODALE.media} data-testid="classificazione-finestra">
        <DialogTitle>{k(`faccette.${faccetta}.nome`)}</DialogTitle>
        <DialogDescription>{k(`faccette.${faccetta}.domanda`)}</DialogDescription>
        {proposta ? <p className="rounded border border-border bg-muted px-2 py-1 text-xs" data-testid="classificazione-proposta">{k("propostaAgente")}</p> : null}
        <fieldset className="space-y-2">
          {valori.map((v) => (
            <label key={v.code} className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={scelti.includes(v.code)}
                onChange={(e) => setScelti((s) => (e.target.checked ? [...s, v.code] : s.filter((x) => x !== v.code)))}
                data-testid="classificazione-scelta"
                data-codice={v.code}
              />
              <span>
                <span className="font-medium">{v.label}</span>
                <span className="block text-xs text-muted-foreground">{v.description}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">{k("criterio")}</span>
          <span className="block text-xs text-muted-foreground">{k("criterioAiuto")}</span>
          <textarea
            value={criterio}
            onChange={(e) => setCriterio(e.target.value)}
            rows={3}
            maxLength={2000}
            className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
            data-testid="classificazione-criterio"
          />
        </label>
        {salva.isError ? <p className="text-xs text-destructive">{k("errore")}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onChiudi}>{k("annulla")}</Button>
          <Button onClick={() => salva.mutate()} disabled={salva.isPending || manca} data-testid="classificazione-salva">
            {salva.isPending ? k("salvataggio") : proposta ? k("approva") : k("salva")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
