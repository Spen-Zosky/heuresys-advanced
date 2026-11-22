"use client";

/**
 * apps/web/src/components/processo/corrispondenza-apqc.tsx — il tipo di corrispondenza fra un'attività
 * del processo del tenant e la voce APQC da cui viene (ADR-0061 D7, passo 4; migrazione 000509).
 *
 * La cella mostra la voce APQC dell'attività e il tipo dichiarato (esatta, più ampia, più ristretta,
 * parziale) o «da dichiarare». Chi ha il potere (`canEdit` dall'API) apre la finestra, sceglie il tipo
 * con la sua spiegazione e scrive il criterio; una proposta dell'agente si approva così com'è.
 * Scrive con PUT /v1/tenant-processes/:id/attivita/:stepId/apqc e rilegge la scheda.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from "@heuresys/ui";
import type { StepApqcMatch, TenantProcessScheda } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { MODALE } from "@/lib/modale";

type Attivita = TenantProcessScheda["activities"][number];
const TIPI = ["ESATTO", "PIU_AMPIO", "PIU_RISTRETTO", "PARZIALE"] as const;

export function CorrispondenzaApqc({ processId, attivita, canEdit }: { processId: string; attivita: Attivita; canEdit: boolean }) {
  const { t } = useTranslation("blueprints");
  const k = (s: string, o?: Record<string, unknown>) => t(`processiDelTenant.apqc.${s}`, o ?? {});
  const [aperta, setAperta] = useState(false);
  if (!attivita.apqcCode) return <span className="text-xs text-muted-foreground">—</span>;
  const m = attivita.apqcMatch;
  return (
    <span className="flex flex-wrap items-center gap-1 text-xs" data-testid="apqc-cella" data-attivita={attivita.activityId}>
      <span className="tabular-nums">{k("voce", { codice: attivita.apqcCode })}</span>
      <span aria-hidden>·</span>
      {m ? (
        <span className={m.status === "PROPOSTA" ? "font-medium" : ""} data-testid="apqc-tipo">
          {k(`tipi.${m.kind}.nome`)}{m.status === "PROPOSTA" ? ` (${k("proposta")})` : ""}
        </span>
      ) : <span className="text-muted-foreground" data-testid="apqc-tipo">{k("daDichiarare")}</span>}
      {canEdit ? (
        <button type="button" onClick={() => setAperta(true)} className="text-primary underline decoration-primary/30 underline-offset-2" data-testid="apqc-modifica">
          {m?.status === "PROPOSTA" ? k("esamina") : m ? k("modifica") : k("dichiara")}
        </button>
      ) : null}
      {aperta ? <FinestraApqc processId={processId} attivita={attivita} attuale={m} onChiudi={() => setAperta(false)} /> : null}
    </span>
  );
}

function FinestraApqc({ processId, attivita, attuale, onChiudi }: { processId: string; attivita: Attivita; attuale: StepApqcMatch | null; onChiudi: () => void }) {
  const { t } = useTranslation("blueprints");
  const k = (s: string, o?: Record<string, unknown>) => t(`processiDelTenant.apqc.${s}`, o ?? {});
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<string>(attuale?.kind ?? "");
  const [criterio, setCriterio] = useState(attuale?.criterion ?? "");
  const proposta = attuale?.status === "PROPOSTA";
  const salva = useMutation({
    mutationFn: () => apiFetch(`/v1/tenant-processes/${processId}/attivita/${attivita.activityId}/apqc`, {
      method: "PUT",
      body: { kind: tipo, criterion: criterio.trim() },
    }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["processes", "scheda", processId] });
      onChiudi();
    },
  });
  const pronto = tipo !== "" && criterio.trim().length > 0;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onChiudi(); }}>
      <DialogContent className={MODALE.media} data-testid="apqc-finestra">
        <DialogTitle>{k("titolo")}</DialogTitle>
        <DialogDescription>{k("domanda", { attivita: attivita.name, codice: attivita.apqcCode ?? "" })}</DialogDescription>
        {proposta ? <p className="rounded border border-border bg-muted px-2 py-1 text-xs" data-testid="apqc-proposta">{k("propostaAgente")}</p> : null}
        <fieldset className="space-y-2">
          {TIPI.map((x) => (
            <label key={x} className="flex cursor-pointer items-start gap-2 text-sm">
              <input type="radio" name="apqc-tipo" className="mt-1" checked={tipo === x} onChange={() => setTipo(x)} data-testid="apqc-scelta" data-codice={x} />
              <span>
                <span className="font-medium">{k(`tipi.${x}.nome`)}</span>
                <span className="block text-xs text-muted-foreground">{k(`tipi.${x}.descrizione`)}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">{k("criterio")}</span>
          <span className="block text-xs text-muted-foreground">{k("criterioAiuto")}</span>
          <textarea value={criterio} onChange={(e) => setCriterio(e.target.value)} rows={3} maxLength={2000}
            className="w-full rounded border border-border bg-background px-2 py-1 text-sm" data-testid="apqc-criterio" />
        </label>
        {salva.isError ? <p className="text-xs text-destructive">{k("errore")}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onChiudi}>{k("annulla")}</Button>
          <Button onClick={() => salva.mutate()} disabled={salva.isPending || !pronto} data-testid="apqc-salva">
            {salva.isPending ? k("salvataggio") : proposta ? k("approva") : k("salva")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
