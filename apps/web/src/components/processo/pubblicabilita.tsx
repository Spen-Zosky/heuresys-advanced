"use client";

/**
 * apps/web/src/components/processo/pubblicabilita.tsx — il controllo di pubblicazione dei processi
 * del modello (ADR-0061 D10, passo 3 del piano di attuazione). Sola lettura.
 *
 * Nel catalogo dei processi del modello ogni riga dice quanti degli otto criteri il processo soddisfa
 * («3 di 8»); il pulsante apre la finestra con i criteri, uno per riga, e che cosa manca a ciascuno,
 * in parole. I dati vengono da `GET /v1/blueprint-processes/pubblicabilita`, una chiamata per versione
 * del modello presente nell'elenco. È un rapporto: non blocca niente (decisione di Enzo, 2026-11-22).
 */
import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@heuresys/ui";
import type { ProcessPublishability, PublishabilityResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { MODALE } from "@/lib/modale";

/** Il controllo per ogni processo delle versioni date, indicizzato per processo. */
export function usePubblicabilita(versioni: readonly string[]): Map<string, ProcessPublishability> {
  const qs = useQueries({
    queries: [...new Set(versioni)].filter(Boolean).map((v) => ({
      queryKey: ["blueprint-processes", "pubblicabilita", v],
      queryFn: ({ signal }: { signal: AbortSignal }) => apiFetch<PublishabilityResponse>(`/v1/blueprint-processes/pubblicabilita?variantVersionId=${v}`, { signal }),
      staleTime: 60_000,
    })),
  });
  const m = new Map<string, ProcessPublishability>();
  for (const q of qs) for (const p of q.data?.items ?? []) m.set(p.processId, p);
  return m;
}

export function CellaPubblicabilita({ voce }: { voce: ProcessPublishability | undefined }) {
  const { t } = useTranslation("blueprints");
  const [aperta, setAperta] = useState(false);
  if (!voce) return <span className="text-xs text-muted-foreground">…</span>;
  const k = (s: string, o?: Record<string, unknown>) => t(`processes.pubblicabilita.${s}`, o ?? {});
  return (
    <>
      <button
        type="button"
        onClick={() => setAperta(true)}
        className="cursor-pointer text-sm text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
        data-testid="pubblicabilita-apri"
        data-soddisfatti={voce.soddisfatti}
      >
        {k("conteggio", { n: voce.soddisfatti })}
      </button>
      <Dialog open={aperta} onOpenChange={setAperta}>
        <DialogContent className={MODALE.media} data-testid="pubblicabilita-finestra">
          <DialogTitle>{k("titolo", { nome: voce.name })}</DialogTitle>
          <DialogDescription>{voce.pubblicabile ? k("pubblicabile") : k("nonPubblicabile", { n: voce.soddisfatti })}</DialogDescription>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-1 pr-3 font-medium">{k("colonne.criterio")}</th>
                <th className="py-1 pr-3 font-medium">{k("colonne.manca")}</th>
                <th className="py-1 font-medium">{k("colonne.esito")}</th>
              </tr>
            </thead>
            <tbody>
              {voce.criteri.map((c) => (
                <tr key={c.numero} className="border-b border-border align-top" data-testid="pubblicabilita-criterio" data-soddisfatto={c.soddisfatto ? "si" : "no"}>
                  <td className="py-1.5 pr-3">{k(`criteri.c${c.numero}`)}</td>
                  <td className="py-1.5 pr-3 text-xs text-muted-foreground">{c.mancanze.map((x) => k(`mancanze.${x}`)).join("; ")}</td>
                  <td className="py-1.5 text-xs font-medium">{c.soddisfatto ? k("si") : k("no")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground">{k("nota")}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
