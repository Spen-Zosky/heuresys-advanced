"use client";

/**
 * apps/web/src/components/processo/oggetto-contato.tsx — il glossario unico dei processi (passo 1
 * del piano di attuazione dell'ADR-0061, docs/architecture/adr/0061_tassonomia_e_metamodel_dei_processi.md §7).
 *
 * ADR-0061 D2: «processo» copre cinque cose distinte (classificazione, schema descrittivo, processo
 * del modello, processo del tenant, esecuzione). Ogni pagina che conta processi dichiara quale delle
 * cinque conta, con questa riga sotto l'intestazione; il pulsante apre la finestra che spiega le
 * cinque cose, i cinque livelli (D3) e la catena dal ruolo alla persona (D8), con evidenziata la
 * riga dell'oggetto che la pagina conta. Testi in `common:sensiDelProcesso.*`.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@heuresys/ui";
import { MODALE } from "@/lib/modale";

export const OGGETTI_PROCESSO = ["tassonomia", "metamodello", "blueprint", "configurazione", "istanza"] as const;
export type OggettoProcesso = (typeof OGGETTI_PROCESSO)[number];
const LIVELLI = ["l1", "l2", "l3", "l4", "l5"] as const;

export function OggettoContato({ oggetto }: { oggetto: OggettoProcesso }) {
  const { t } = useTranslation("common");
  const [aperta, setAperta] = useState(false);
  const k = (s: string) => t(`sensiDelProcesso.${s}`);
  return (
    <div className="flex flex-wrap items-center gap-2 pl-4 text-xs text-muted-foreground" data-testid="oggetto-contato" data-oggetto={oggetto}>
      <span>{k("etichetta")}:</span>
      <span className="font-semibold text-foreground" data-testid="oggetto-contato-nome">{k(`oggetti.${oggetto}.nome`)}</span>
      <span aria-hidden>·</span>
      <button
        type="button"
        onClick={() => setAperta(true)}
        className="cursor-pointer text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
        data-testid="oggetto-contato-apri"
      >
        {k("apri")}
      </button>
      <Dialog open={aperta} onOpenChange={setAperta}>
        <DialogContent className={MODALE.grande} data-testid="sensi-del-processo">
          <DialogTitle>{k("titolo")}</DialogTitle>
          <DialogDescription>{k("introduzione")}</DialogDescription>
          <blockquote className="border-l-4 border-border pl-3 text-sm italic text-foreground">{k("definizione")}</blockquote>
          <table className="w-full border-collapse text-sm" data-testid="sensi-del-processo-oggetti">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                {(["oggetto", "domanda", "nonE", "dove"] as const).map((c) => <th key={c} className="py-1 pr-3 font-medium">{k(`colonne.${c}`)}</th>)}
              </tr>
            </thead>
            <tbody>
              {OGGETTI_PROCESSO.map((o) => {
                const qui = o === oggetto;
                return (
                  <tr key={o} className={`border-b border-border align-top ${qui ? "bg-muted font-medium" : ""}`} data-testid={`sensi-oggetto-${o}`} data-qui={qui ? "si" : undefined}>
                    <td className="py-1.5 pr-3">
                      {k(`oggetti.${o}.nome`)}
                      {qui ? <span className="ml-1 rounded bg-primary/10 px-1 text-[0.7rem] text-primary">{k("questaPagina")}</span> : null}
                    </td>
                    <td className="py-1.5 pr-3">{k(`oggetti.${o}.domanda`)}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{k(`oggetti.${o}.nonE`)}</td>
                    <td className="py-1.5 text-muted-foreground">{k(`oggetti.${o}.dove`)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <h3 className="mt-2 text-sm font-semibold">{k("livelli.titolo")}</h3>
          <table className="w-full border-collapse text-sm" data-testid="sensi-del-processo-livelli">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                {(["livello", "oggetto", "definizione", "esempio"] as const).map((c) => <th key={c} className="py-1 pr-3 font-medium">{k(`livelli.colonne.${c}`)}</th>)}
              </tr>
            </thead>
            <tbody>
              {LIVELLI.map((l) => (
                <tr key={l} className={`border-b border-border align-top ${l === "l3" ? "font-medium" : ""}`}>
                  {(["livello", "oggetto", "definizione", "esempio"] as const).map((c) => <td key={c} className="py-1.5 pr-3">{k(`livelli.righe.${l}.${c}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground">{k("livelli.nota")}</p>
          <h3 className="mt-2 text-sm font-semibold">{k("catena.titolo")}</h3>
          <p className="text-sm">{k("catena.testo")}</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
