"use client";

/**
 * apps/web/src/components/organigramma/vista.tsx — l'organigramma di un cliente, in due viste.
 *
 * Piano docs/piani/PIANO_organigrammi-a-blocchi_20261114.md (V6). Lo usano le pagine che prima
 * mostravano il solo grafo a nodi salvato e la pagina di consolidamento. I dati vengono da
 * `GET /v1/me/organigramma`, calcolato a ogni chiamata: «Aggiorna» lo ricalcola e rinfresca
 * anche la rubrica delle schede, così nessuna vista resta ferma al giorno in cui fu scritta.
 *
 * Vista a blocchi (predefinita), come la tab Organizzazione del banco del datastore:
 * l'organigramma completo in panoramica, poi la sede centrale e le filiali con i nomi delle
 * persone in ogni riquadro. Vista a nodi: l'albero delle unità, leggibile (vedi `nodi.tsx`).
 * Un clic su un'unità apre la scheda a cascata (`scheda-rapida.tsx`).
 */
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { Button } from "@heuresys/ui";
import type { OrganigrammaResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { useFormat } from "@/lib/format";
import { gruppi, type UnitaBlocco } from "@/lib/organigramma-blocchi";
import { useScheda } from "@/components/scheda-rapida";
import { SchedePagina } from "@/components/schede-pagina";
import { StatoCaricamento, StatoErrore, StatoVuoto } from "@/components/stato-pagina";
import { OrganigrammaBlocchi } from "./blocchi";
import { OrganigrammaNodi } from "./nodi";

export function useOrganigramma(tenantId?: string | null) {
  return useQuery({
    queryKey: ["me", "organigramma", tenantId ?? null],
    queryFn: ({ signal }) =>
      apiFetch<OrganigrammaResponse>(`/v1/me/organigramma${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ""}`, { signal }),
    staleTime: 60_000,
  });
}

export function aBlocchi(r: OrganigrammaResponse | undefined): UnitaBlocco[] {
  return (r?.unita ?? []).map((u) => ({
    id: u.id, nome: u.nome, padreId: u.padreId, filiale: u.filiale, addettiTotali: u.addettiTotali,
    persone: u.persone.map((p) => ({ etichetta: p.etichetta, responsabile: p.responsabile })),
  }));
}

export function VistaOrganigramma({
  tenantId, evidenzia, testId = "organigramma",
}: {
  tenantId?: string | null;
  /** Unità da mettere in risalto (per esempio la propria). */
  evidenzia?: ReadonlySet<string>;
  testId?: string;
}) {
  const { t } = useTranslation("common");
  const fmt = useFormat();
  const qc = useQueryClient();
  const q = useOrganigramma(tenantId);
  const schede = useScheda();
  const apri = schede ? (id: string) => schede.apri("unita", id) : undefined;
  const blocchi = useMemo(() => aBlocchi(q.data), [q.data]);
  const gr = useMemo(() => gruppi(blocchi, t("organigramma.filiali")), [blocchi, t]);

  const aggiorna = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["me", "organigramma"] }),
      qc.invalidateQueries({ queryKey: ["me", "rubrica"] }),
    ]);
  };

  if (q.isLoading) return <StatoCaricamento />;
  if (q.isError) return <StatoErrore errore={q.error} titolo={t("organigramma.errore")} testId={`${testId}-errore`} onRiprova={() => void q.refetch()} />;
  const d = q.data!;
  if (!d.unita.length) return <StatoVuoto titolo={t("organigramma.vuoto")} testId={`${testId}-vuoto`} />;

  const persone = d.unita.reduce((s, u) => s + u.persone.length, 0);
  const avvisi = [
    d.avvisi.unitaSenzaResponsabile ? t("organigramma.avvisi.unitaSenzaResponsabile", { count: d.avvisi.unitaSenzaResponsabile }) : null,
    d.avvisi.riportiFuoriCliente ? t("organigramma.avvisi.riportiFuoriCliente", { count: d.avvisi.riportiFuoriCliente }) : null,
  ].filter(Boolean);
  const nome = d.cliente.replace(/[^\p{L}\p{N}]+/gu, "_");

  const vistaBlocchi = (
    <div className="space-y-6" data-testid={`${testId}-blocchi`}>
      <p className="text-xs text-muted-foreground">{t("organigramma.legenda")}</p>
      <section className="space-y-1">
        <h3 className="text-sm font-semibold">{t("organigramma.completo")} <span className="font-normal text-muted-foreground">— {t("organigramma.riepilogo", { unita: d.unita.length, persone })}</span></h3>
        <p className="text-xs text-muted-foreground">{t("organigramma.completoNota")}</p>
        <OrganigrammaBlocchi unita={blocchi} conPersone={false} {...(apri ? { onApri: apri } : {})} {...(evidenzia ? { evidenzia } : {})} nomeFile={`organigramma_${nome}`} ariaLabel={t("organigramma.aria", { cliente: d.cliente })} altezzaMax="45vh" />
      </section>
      {gr.map((g) => (
        <section key={g.chiave} className="space-y-1" data-testid={`${testId}-gruppo-${g.chiave}`}>
          <h3 className="text-sm font-semibold">
            {t(`organigramma.${g.chiave}`)}{" "}
            <span className="font-normal text-muted-foreground">
              — {g.chiave === "filiali"
                ? t("organigramma.riepilogoFiliali", { sedi: g.sedi, unita: g.unita.length - 1, persone: g.addetti })
                : t("organigramma.riepilogo", { unita: g.unita.length, persone: g.addetti })}
            </span>
          </h3>
          <OrganigrammaBlocchi unita={g.unita} {...(apri ? { onApri: apri } : {})} {...(evidenzia ? { evidenzia } : {})} nomeFile={`organigramma_${nome}_${g.chiave}`} ariaLabel={t(`organigramma.${g.chiave}`)} />
        </section>
      ))}
    </div>
  );

  return (
    <div className="space-y-3" data-testid={testId}>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm">
          <span className="font-semibold">{d.cliente}</span>{" "}
          <span className="text-muted-foreground">— {t("organigramma.riepilogo", { unita: d.unita.length, persone })}</span>
        </p>
        <span className="ml-auto text-xs text-muted-foreground" data-testid={`${testId}-calcolato`}>
          {t("organigramma.calcolato", { quando: fmt.dataOra(d.calcolatoIl) })}
        </span>
        <Button type="button" variant="outline" size="sm" onClick={() => void aggiorna()} disabled={q.isFetching} data-testid={`${testId}-aggiorna`}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${q.isFetching ? "animate-spin" : ""}`} />
          {q.isFetching ? t("organigramma.aggiornando") : t("organigramma.aggiorna")}
        </Button>
      </div>
      {avvisi.length ? <p className="text-xs text-warning">{avvisi.join(" · ")}</p> : null}
      <SchedePagina
        chiave="vista"
        schede={[
          { id: "blocchi", titolo: t("organigramma.viste.blocchi"), contenuto: vistaBlocchi },
          {
            id: "nodi", titolo: t("organigramma.viste.nodi"),
            contenuto: (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{t("organigramma.legendaNodi")}</p>
                <OrganigrammaNodi unita={d.unita} {...(apri ? { onApri: apri } : {})} {...(evidenzia ? { evidenzia } : {})} ariaLabel={t("organigramma.ariaNodi", { cliente: d.cliente })} testId={`${testId}-nodi`} />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
