"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@heuresys/ui";
import {
  ALLOWED_DECISIONS,
  type CascadeResponse,
  type ConsolidationProposal,
  type Decision,
  type ProposalOutcome,
  type LinkForm,
} from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";

// La finestra della decisione: l'agente dà la sua raccomandazione e spiega la cascata (i prerequisiti
// e le conseguenze della voce nel modello); la persona sceglie e conferma. La scelta va nella bozza:
// i dati vivi cambiano solo con l'approvazione definitiva. «Aggiorna cascata» registra la scelta
// anche sulle voci della cascata ancora da decidere.

/** Lo specchio di `sceltaInCascata` dell'API: che cosa diventa una voce della cascata. */
function inCascata(d: Decision, outcome: ProposalOutcome): Decision | null {
  if (d !== "CONFERMATA" && d !== "ADOTTATA") return null;
  return outcome === "CORRISPONDENZA" ? "CONFERMATA" : outcome === "LACUNA" ? "ADOTTATA" : null;
}

const FORME: readonly LinkForm[] = ["NORMALIZZATA", "FORMA_TENANT", "NOME_PROTOTIPO"];

/** Ciò che l'agente raccomanda: l'esito che ha proposto dice già la strada. */
export function raccomandata(p: ConsolidationProposal): Decision {
  return p.outcome === "CORRISPONDENZA" ? "CONFERMATA" : p.outcome === "LACUNA" ? "ADOTTATA" : "PERSONALIZZAZIONE";
}

export function DecisioneDialog({
  proposta, occupato, errore, onConferma, onChiudi,
}: {
  proposta: ConsolidationProposal;
  occupato: boolean;
  errore: string | null;
  onConferma: (decisione: Decision, forma: LinkForm | undefined, cascata: boolean) => void;
  onChiudi: () => void;
}) {
  const { t } = useTranslation("hr");
  const consigliata = raccomandata(proposta);
  const [scelta, setScelta] = useState<Decision>(proposta.decision ?? consigliata);
  const [forma, setForma] = useState<LinkForm>("NORMALIZZATA");
  const nome = (v: Array<{ name: string | null }>) => v.map((x) => x.name ?? "—").join(", ") || t("consolidation.none");
  const cascata = useQuery({
    queryKey: ["tenant-consolidations", "cascade", proposta.proposalId],
    queryFn: () => apiFetch<CascadeResponse>(`/v1/tenant-consolidations/proposals/${proposta.proposalId}/cascade`),
  });
  const voci = cascata.data?.items ?? [];
  const daAggiornare = voci.filter((v) => v.decision === null && inCascata(scelta, v.outcome) !== null).length;

  return (
    <Dialog open onOpenChange={(aperta) => { if (!aperta) onChiudi(); }}>
      <DialogContent data-testid="consolidation-decision-dialog">
        <DialogHeader>
          <DialogTitle>{t("consolidation.modal.title")}</DialogTitle>
          <DialogDescription>
            {nome(proposta.tenantItems)} ↔ {nome(proposta.prototypeItems)}
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-1 rounded-md border p-3" data-testid="consolidation-recommendation">
          <h3 className="text-sm font-medium">{t("consolidation.modal.recommendation")}</h3>
          <p className="text-sm">
            {t("consolidation.modal.recommends", { decision: t(`consolidation.decisions.${consigliata}`) })}
            {" · "}
            {t("consolidation.modal.confidence", { value: proposta.confidence })}
          </p>
          <p className="text-sm text-muted-foreground">{t("consolidation.modal.because", { reason: proposta.reason })}</p>
          <p className="text-xs text-muted-foreground">
            {proposta.decision
              ? t("consolidation.modal.current", { decision: t(`consolidation.decisions.${proposta.decision}`) })
              : t("consolidation.modal.noneYet")}
          </p>
        </section>

        <section className="space-y-2 rounded-md border p-3" data-testid="consolidation-cascade">
          <h3 className="text-sm font-medium">{t("consolidation.cascade.title")}</h3>
          {cascata.isLoading ? <p className="text-sm text-muted-foreground">{t("consolidation.cascade.loading")}</p> : null}
          {cascata.data && voci.length === 0 ? <p className="text-sm text-muted-foreground">{t("consolidation.cascade.empty")}</p> : null}
          {(["PREREQUISITO", "CONSEGUENZA"] as const).map((rel) => {
            const r = voci.filter((v) => v.relation === rel);
            if (r.length === 0) return null;
            return (
              <div key={rel} className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">{t(`consolidation.cascade.${rel}`, { count: r.length })}</p>
                <ul className="max-h-40 space-y-1 overflow-y-auto text-sm" data-testid={`consolidation-cascade-${rel}`}>
                  {r.map((v) => (
                    <li key={v.proposalId} className="flex flex-wrap items-center justify-between gap-2">
                      <span>{nome(v.prototypeItems)} <span className="text-xs text-muted-foreground">· {t(`consolidation.groups.${v.group}`)} · {t(`consolidation.outcomes.${v.outcome}`)}</span></span>
                      <span className="text-xs text-muted-foreground">
                        {v.decision ? t(`consolidation.decisions.${v.decision}`) : t("consolidation.cascade.undecided")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {cascata.data && cascata.data.fields.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("consolidation.cascade.fields", { fields: cascata.data.fields.map((f) => t(`consolidation.cascade.field.${f}`)).join(", ") })}
            </p>
          ) : null}
        </section>

        <>
            <fieldset className="space-y-2" disabled={occupato}>
              <legend className="text-sm font-medium">{t("consolidation.modal.choose")}</legend>
              <div className="flex flex-wrap gap-2">
                {ALLOWED_DECISIONS[proposta.outcome].map((d) => (
                  <Button
                    key={d} type="button" size="sm" variant={scelta === d ? "default" : "outline"}
                    aria-pressed={scelta === d} data-testid={`consolidation-choice-${d}`}
                    onClick={() => setScelta(d)}
                  >
                    {t(`consolidation.actions.${d}`)}
                  </Button>
                ))}
              </div>
              {scelta === "CONFERMATA" ? (
                <div className="space-y-1" data-testid="consolidation-forms">
                  <p className="text-sm font-medium">{t("consolidation.modal.form")}</p>
                  {FORME.map((f) => (
                    <label key={f} className="flex items-start gap-2 text-sm">
                      <input type="radio" name="forma" checked={forma === f} onChange={() => setForma(f)} />
                      <span>{t(`consolidation.modal.forms.${f}`)}</span>
                    </label>
                  ))}
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">{t("consolidation.modal.sameHint")}</p>
            </fieldset>
            {errore ? <p role="alert" className="text-sm text-destructive">{errore}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onChiudi} disabled={occupato}>{t("consolidation.modal.close")}</Button>
              <Button
                type="button" data-testid="consolidation-decide-confirm" disabled={occupato}
                onClick={() => onConferma(scelta, scelta === "CONFERMATA" ? forma : undefined, false)}
              >
                {occupato ? t("consolidation.modal.confirming") : t("consolidation.modal.confirm")}
              </Button>
              {daAggiornare > 0 ? (
                <Button
                  type="button" variant="secondary" data-testid="consolidation-decide-cascade" disabled={occupato}
                  onClick={() => onConferma(scelta, scelta === "CONFERMATA" ? forma : undefined, true)}
                >
                  {t("consolidation.cascade.update", { count: daAggiornare })}
                </Button>
              ) : null}
            </DialogFooter>
        </>
      </DialogContent>
    </Dialog>
  );
}
