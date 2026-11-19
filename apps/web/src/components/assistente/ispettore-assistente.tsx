"use client";

/**
 * apps/web/src/components/assistente/ispettore-assistente.tsx — la finestra modale in cui si apre un
 * contenuto della risposta dell'assistente (richiesta di Enzo del 2026-11-18): una tabella, un blocco
 * di testo o un diagramma, grande quanto serve, ridimensionabile e a tutto schermo.
 *
 * Compone `Dialog` di @heuresys/ui; il ridimensionamento è quello del browser (`resize: both`), così
 * non serve una dipendenza in più. La tabella si copia per un foglio di calcolo e si scarica in CSV.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Maximize2, Minimize2, Copy, Download, Check } from "lucide-react";
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from "@heuresys/ui";
import { csvDa, tsvDa } from "@/lib/agente/messaggi";

export type ContenutoIspezionabile =
  | { tipo: "tabella"; righe: string[][] }
  | { tipo: "testo"; testo: string; lingua: string | null }
  | { tipo: "diagramma"; nodo: React.ReactNode };

export function IspettoreAssistente({
  contenuto,
  onChiudi,
}: {
  contenuto: ContenutoIspezionabile | null;
  onChiudi: () => void;
}) {
  const { t } = useTranslation("common");
  const [grande, setGrande] = useState(false);
  const [copiato, setCopiato] = useState(false);

  const titolo =
    contenuto?.tipo === "tabella"
      ? t("agente.ispettoreTabella", { righe: Math.max(0, contenuto.righe.length - 1) })
      : contenuto?.tipo === "diagramma"
        ? t("agente.ispettoreDiagramma")
        : t("agente.ispettoreTesto");

  const testoDaCopiare = useMemo(() => {
    if (!contenuto) return "";
    if (contenuto.tipo === "tabella") return tsvDa(contenuto.righe);
    if (contenuto.tipo === "testo") return contenuto.testo;
    return "";
  }, [contenuto]);

  const copia = async () => {
    try {
      await navigator.clipboard.writeText(testoDaCopiare);
      setCopiato(true);
      setTimeout(() => setCopiato(false), 1500);
    } catch {
      /* il browser può negare gli appunti: il contenuto resta selezionabile a mano */
    }
  };

  const scarica = () => {
    if (contenuto?.tipo !== "tabella") return;
    const blob = new Blob(["﻿" + csvDa(contenuto.righe)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tabella-assistente.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={contenuto !== null} onOpenChange={(o) => (o ? undefined : onChiudi())}>
      <DialogContent
        data-testid="agente-ispettore"
        closeLabel={t("agente.chiudi")}
        className={
          grande
            ? "left-4 top-4 flex h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-none translate-x-0 translate-y-0 flex-col gap-3 p-4"
            : "flex h-[75vh] w-[min(92vw,1100px)] min-h-[240px] min-w-[320px] max-w-none resize flex-col gap-3 overflow-hidden p-4"
        }
      >
        <div className="flex items-center justify-between gap-2 pr-8">
          <div className="min-w-0">
            <DialogTitle className="truncate text-base">{titolo}</DialogTitle>
            <DialogDescription className="text-xs">{t("agente.ispettoreAiuto")}</DialogDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {contenuto?.tipo !== "diagramma" && (
              <Button variant="ghost" size="sm" onClick={() => void copia()} data-testid="agente-ispettore-copia">
                {copiato ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                <span className="ml-1 hidden sm:inline">{copiato ? t("agente.copiato") : t("agente.copia")}</span>
              </Button>
            )}
            {contenuto?.tipo === "tabella" && (
              <Button variant="ghost" size="sm" onClick={scarica} data-testid="agente-ispettore-csv">
                <Download className="h-4 w-4" aria-hidden />
                <span className="ml-1 hidden sm:inline">{t("agente.scaricaCsv")}</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setGrande((g) => !g)}
              aria-label={grande ? t("agente.riduci") : t("agente.massimizza")}
              data-testid="agente-ispettore-grande"
            >
              {grande ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-background">
          {contenuto?.tipo === "tabella" && <TabellaGrande righe={contenuto.righe} />}
          {contenuto?.tipo === "testo" && (
            <pre className="whitespace-pre-wrap break-words p-4 font-mono text-sm leading-relaxed">{contenuto.testo}</pre>
          )}
          {contenuto?.tipo === "diagramma" && <div className="flex min-h-full items-center justify-center p-4">{contenuto.nodo}</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TabellaGrande({ righe }: { righe: string[][] }) {
  const [testa, ...corpo] = righe;
  return (
    <table className="w-full border-collapse text-sm" data-testid="agente-ispettore-tabella">
      {testa && (
        <thead className="sticky top-0 bg-muted">
          <tr>
            {testa.map((c, i) => (
              <th key={i} scope="col" className="border-b border-border px-3 py-2 text-left font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {corpo.map((r, i) => (
          <tr key={i} className="odd:bg-muted/30">
            {r.map((c, j) => (
              <td key={j} className="border-b border-border px-3 py-1.5 align-top">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
