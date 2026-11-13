"use client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@heuresys/ui";
import {
  ALLOWED_DECISIONS,
  type ApplicationReport,
  type ConsolidationProposal,
  type Decision,
  type LinkForm,
} from "@heuresys/shared";

// La finestra della decisione: l'agente dà la sua raccomandazione, la persona sceglie (anche la
// stessa scelta di prima) e conferma; alla conferma l'API applica la decisione ai dati e la finestra
// mostra che cosa è cambiato davvero.

const FORME: readonly LinkForm[] = ["NORMALIZZATA", "FORMA_TENANT", "NOME_PROTOTIPO"];

/** Ciò che l'agente raccomanda: l'esito che ha proposto dice già la strada. */
export function raccomandata(p: ConsolidationProposal): Decision {
  return p.outcome === "CORRISPONDENZA" ? "CONFERMATA" : p.outcome === "LACUNA" ? "ADOTTATA" : "PERSONALIZZAZIONE";
}

export function DecisioneDialog({
  proposta, occupato, rapporto, errore, onConferma, onChiudi,
}: {
  proposta: ConsolidationProposal;
  occupato: boolean;
  rapporto: ApplicationReport | null;
  errore: string | null;
  onConferma: (decisione: Decision, forma: LinkForm | undefined) => void;
  onChiudi: () => void;
}) {
  const { t } = useTranslation("hr");
  const consigliata = raccomandata(proposta);
  const [scelta, setScelta] = useState<Decision>(proposta.decision ?? consigliata);
  const [forma, setForma] = useState<LinkForm>("NORMALIZZATA");
  const nome = (v: Array<{ name: string | null }>) => v.map((x) => x.name ?? "—").join(", ") || t("consolidation.none");

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

        {rapporto === null ? (
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
                onClick={() => onConferma(scelta, scelta === "CONFERMATA" ? forma : undefined)}
              >
                {occupato ? t("consolidation.modal.confirming") : t("consolidation.modal.confirm")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <section className="space-y-1 text-sm" data-testid="consolidation-application-report">
              <h3 className="font-medium">{t("consolidation.modal.result.title")}</h3>
              {rapporto.changed.length + rapporto.created.length + rapporto.reverted === 0 ? (
                <p>{t("consolidation.modal.result.nothing")}</p>
              ) : (
                <ul className="list-disc pl-5">
                  {rapporto.changed.length > 0 ? <li>{t("consolidation.modal.result.changed", { count: rapporto.changed.length })}</li> : null}
                  {rapporto.created.length > 0 ? <li>{t("consolidation.modal.result.created", { count: rapporto.created.length })}</li> : null}
                  {rapporto.reverted > 0 ? <li>{t("consolidation.modal.result.reverted", { count: rapporto.reverted })}</li> : null}
                </ul>
              )}
              {rapporto.skipped.length > 0 ? (
                <div>
                  <p className="font-medium">{t("consolidation.modal.result.skipped")}</p>
                  <ul className="list-disc pl-5 text-muted-foreground">{rapporto.skipped.map((s) => <li key={s}>{s}</li>)}</ul>
                </div>
              ) : null}
            </section>
            <DialogFooter>
              <Button type="button" onClick={onChiudi} data-testid="consolidation-decision-close">{t("consolidation.modal.close")}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
