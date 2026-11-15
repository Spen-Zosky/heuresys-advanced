"use client";

/**
 * apps/web/src/components/origine-del-dato.tsx — piano interfacce L10, voce A-14.
 *
 * L'origine del dato (I23, ADR-0041) di ciò che la pagina mostra: nativa (nasce da un gesto
 * nell'applicazione), importata, ibrida, mista (il modulo legge tabelle di origini diverse) o
 * tecnica. La dichiara l'API (`GET /v1/meta/data-origins?path=…`) leggendo la classificazione
 * del database; qui non si deduce niente. Il dettaglio, tabella per tabella, sta nel titolo.
 */
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge } from "@heuresys/ui";
import type { DataOriginsResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";

/** Il percorso API senza querystring, che è ciò che decide il modulo. */
function senzaQuery(path: string): string {
  return path.split("?")[0] ?? path;
}

export function OrigineDelDato({ path }: { path: string }) {
  const { t } = useTranslation();
  const p = senzaQuery(path);
  const q = useQuery({
    queryKey: ["meta", "data-origins", p],
    queryFn: () => apiFetch<DataOriginsResponse>(`/v1/meta/data-origins?path=${encodeURIComponent(p)}`),
    staleTime: 10 * 60 * 1000,
  });
  const modulo = q.data?.modules[0];
  if (!modulo?.origin) return null;
  // Il dettaglio dice quante tabelle hanno ciascuna origine, senza i nomi tecnici delle tabelle
  // (nomi di database, che a una persona non dicono niente).
  const perStato = new Map<string, number>();
  let perRiga = 0;
  for (const x of modulo.tables) {
    if (x.state === null || x.state === "infrastruttura") continue;
    perStato.set(x.state, (perStato.get(x.state) ?? 0) + 1);
    if (x.perRow) perRiga += 1;
  }
  const dettaglio = [
    ...[...perStato].map(([stato, quante]) => t("origine.conteggio", { count: quante, stato: t(`origine.stato.${stato}`) })),
    ...(perRiga > 0 ? [t("origine.conteggioPerRiga", { count: perRiga })] : []),
  ].join("\n");
  return (
    <Badge
      variant="outline"
      data-testid="origine-del-dato"
      data-origine={modulo.origin}
      title={dettaglio}
      className="font-normal"
    >
      {t("origine.label")}: {t(`origine.riassunto.${modulo.origin}`)}
    </Badge>
  );
}

/** L'origine di una riga (colonna `origine_dato`, X-2): importata, nativa o materializzata. */
export function OrigineDellaRiga({ valore }: { valore: string }) {
  const { t } = useTranslation();
  return (
    <span className="text-xs text-muted-foreground" data-testid="origine-della-riga" data-origine={valore}>
      {t(`origine.riga.${valore}`, { defaultValue: valore })}
    </span>
  );
}
