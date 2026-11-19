"use client";

/**
 * /admin/tassonomie — il catalogo delle professioni (ISCO-08 e CP 2021), globale e senza tenant
 * (ondata 5a degli endpoint senza consumatori, 2026-11-19). `POST` e `PATCH` di
 * `/v1/occupation-classifications` esistevano senza schermata; la cancellazione è ritirata
 * (`lib/rotte-ritirate.ts`): una voce non si toglie, si corregge.
 *
 * L'elenco è a pagine dall'API, con il totale vero: niente troncamenti in silenzio (R5).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import type { OccupationClassification, OccupationClassScheme } from "@heuresys/shared";
import { PageHeader } from "@/components/intestazione-pagina";
import { StatoCaricamento, StatoErrore, StatoVuoto } from "@/components/stato-pagina";
import { apiFetch } from "@/lib/api/fetch";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { useEnumLabel } from "@/lib/enum-labels";

const SCHEMI: OccupationClassScheme[] = ["ISCO_08", "CP_2021"];
const PAGINA = 100;
const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface Elenco { items: OccupationClassification[]; total: number }

function livelloDa(testo: string): number | null {
  const n = Number(testo);
  return testo.trim() === "" ? null : n;
}
const livelloValido = (testo: string) => testo.trim() === "" || (Number.isInteger(Number(testo)) && Number(testo) >= 1 && Number(testo) <= 10);

function Riga({ voce, puoModificare }: { voce: OccupationClassification; puoModificare: boolean }) {
  const { t } = useTranslation("admin");
  const qc = useQueryClient();
  const [aperta, setAperta] = useState(false);
  const [bozza, setBozza] = useState({ name: voce.name, description: voce.description ?? "", level: voce.level === null ? "" : String(voce.level) });
  const salva = useMutation({
    mutationFn: () => apiFetch(`/v1/occupation-classifications/${voce.occupationClassificationId}`, {
      method: "PATCH",
      body: { name: bozza.name.trim(), description: bozza.description.trim() === "" ? null : bozza.description.trim(), level: livelloDa(bozza.level) },
    }),
    onSuccess: () => { setAperta(false); void qc.invalidateQueries({ queryKey: ["occupation-classifications"] }); },
  });
  return (
    <>
      <tr className="border-t border-border" data-testid="tassonomia-row" data-id={voce.occupationClassificationId}>
        <td className="py-1">{voce.name}</td>
        <td className="font-mono text-xs">{voce.code}</td>
        <td>{voce.level ?? "—"}</td>
        <td className="text-right">
          {puoModificare && (
            <Button type="button" size="sm" variant="ghost" data-testid="tassonomia-edit" onClick={() => setAperta((v) => !v)}>
              {aperta ? t("tassonomie.chiudi") : t("tassonomie.correggi")}
            </Button>
          )}
        </td>
      </tr>
      {aperta && (
        <tr data-testid="tassonomia-editor">
          <td colSpan={4} className="space-y-2 pb-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="text-sm font-medium text-foreground">{t("tassonomie.nome")}
                <Input value={bozza.name} onChange={(e) => setBozza({ ...bozza, name: e.target.value })} data-testid="tassonomia-edit-name" /></label>
              <label className="text-sm font-medium text-foreground md:col-span-1">{t("tassonomie.descrizione")}
                <Input value={bozza.description} onChange={(e) => setBozza({ ...bozza, description: e.target.value })} data-testid="tassonomia-edit-description" /></label>
              <label className="text-sm font-medium text-foreground">{t("tassonomie.livello")}
                <Input value={bozza.level} inputMode="numeric" onChange={(e) => setBozza({ ...bozza, level: e.target.value })} data-testid="tassonomia-edit-level" /></label>
            </div>
            <Button type="button" size="sm" data-testid="tassonomia-edit-save" disabled={bozza.name.trim() === "" || !livelloValido(bozza.level) || salva.isPending} onClick={() => salva.mutate()}>
              {salva.isPending ? t("common:saving") : t("tassonomie.salva")}
            </Button>
            {salva.isError && <p className="text-sm text-danger">{t("tassonomie.erroreScrittura")}</p>}
          </td>
        </tr>
      )}
    </>
  );
}

function NuovaVoce({ schema }: { schema: OccupationClassScheme }) {
  const { t } = useTranslation("admin");
  const qc = useQueryClient();
  const vuota = { code: "", parentCode: "", name: "", description: "", level: "" };
  const [bozza, setBozza] = useState(vuota);
  const crea = useMutation({
    mutationFn: () => apiFetch("/v1/occupation-classifications", {
      method: "POST",
      body: {
        scheme: schema, code: bozza.code.trim(), name: bozza.name.trim(),
        parentCode: bozza.parentCode.trim() === "" ? null : bozza.parentCode.trim(),
        description: bozza.description.trim() === "" ? null : bozza.description.trim(),
        level: livelloDa(bozza.level),
      },
    }),
    onSuccess: () => { setBozza(vuota); void qc.invalidateQueries({ queryKey: ["occupation-classifications"] }); },
  });
  return (
    <div className="space-y-2 border-t border-border pt-4" data-testid="tassonomia-new">
      <p className="text-sm font-medium text-foreground">{t("tassonomie.nuova")}</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <label className="text-sm text-foreground">{t("tassonomie.codice")}
          <Input value={bozza.code} onChange={(e) => setBozza({ ...bozza, code: e.target.value })} data-testid="tassonomia-new-code" /></label>
        <label className="text-sm text-foreground">{t("tassonomie.codiceSuperiore")}
          <Input value={bozza.parentCode} onChange={(e) => setBozza({ ...bozza, parentCode: e.target.value })} data-testid="tassonomia-new-parent" /></label>
        <label className="text-sm text-foreground">{t("tassonomie.nome")}
          <Input value={bozza.name} onChange={(e) => setBozza({ ...bozza, name: e.target.value })} data-testid="tassonomia-new-name" /></label>
        <label className="text-sm text-foreground">{t("tassonomie.descrizione")}
          <Input value={bozza.description} onChange={(e) => setBozza({ ...bozza, description: e.target.value })} /></label>
        <label className="text-sm text-foreground">{t("tassonomie.livello")}
          <Input value={bozza.level} inputMode="numeric" onChange={(e) => setBozza({ ...bozza, level: e.target.value })} /></label>
      </div>
      <Button type="button" data-testid="tassonomia-new-save"
        disabled={bozza.code.trim() === "" || bozza.name.trim() === "" || !livelloValido(bozza.level) || crea.isPending} onClick={() => crea.mutate()}>
        {crea.isPending ? t("common:saving") : t("tassonomie.aggiungi")}
      </Button>
      {crea.isError && <p className="text-sm text-danger" data-testid="tassonomia-new-error">{t("tassonomie.erroreScrittura")}</p>}
    </div>
  );
}

export default function TassonomiePage() {
  const { t } = useTranslation("admin");
  const enumLabel = useEnumLabel();
  const perms = useCurrentUserPermissions().data?.permissions ?? [];
  const [schema, setSchema] = useState<OccupationClassScheme>("ISCO_08");
  const [cerca, setCerca] = useState("");
  const [pagina, setPagina] = useState(0);
  const filtro = cerca.trim();
  const elenco = useQuery({
    queryKey: ["occupation-classifications", schema, filtro, pagina],
    queryFn: () => {
      const q = new URLSearchParams({ scheme: schema, limit: String(PAGINA), offset: String(pagina * PAGINA) });
      if (filtro !== "") q.set("search", filtro);
      return apiFetch<Elenco>(`/v1/occupation-classifications?${q.toString()}`);
    },
    enabled: perms.includes("occupation_classification:read"),
  });
  const totale = elenco.data?.total ?? 0;
  const ultima = Math.max(0, Math.ceil(totale / PAGINA) - 1);
  return (
    <main data-testid="tassonomie-page" className="mx-auto max-w-6xl space-y-6 px-6 pb-8">
      <PageHeader title={t("tassonomie.titolo")} description={t("tassonomie.descrizionePagina")} />
      <Card>
        <CardHeader><CardTitle as="h2">{t("tassonomie.professioni")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-sm font-medium text-foreground">{t("tassonomie.schema")}
              <select className={SELECT_CLASS} value={schema} data-testid="tassonomie-scheme"
                onChange={(e) => { setSchema(e.target.value as OccupationClassScheme); setPagina(0); }}>
                {SCHEMI.map((s) => <option key={s} value={s}>{enumLabel("occupationClassScheme", s)}</option>)}
              </select></label>
            <label className="text-sm font-medium text-foreground md:col-span-2">{t("tassonomie.cerca")}
              <Input value={cerca} data-testid="tassonomie-search" onChange={(e) => { setCerca(e.target.value); setPagina(0); }} /></label>
          </div>
          {elenco.isLoading && <StatoCaricamento />}
          {elenco.isError && <StatoErrore errore={elenco.error} titolo={t("tassonomie.errore")} onRiprova={() => void elenco.refetch()} />}
          {elenco.data && (
            <>
              <p className="text-sm text-muted-foreground" data-testid="tassonomie-count">
                {t("tassonomie.conto", { count: totale, da: totale === 0 ? 0 : pagina * PAGINA + 1, a: Math.min(totale, (pagina + 1) * PAGINA) })}
              </p>
              {elenco.data.items.length === 0 ? <StatoVuoto /> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-muted-foreground">
                    <th className="py-1">{t("tassonomie.nome")}</th><th>{t("tassonomie.codice")}</th><th>{t("tassonomie.livello")}</th><th />
                  </tr></thead>
                  <tbody>
                    {elenco.data.items.map((v) => (
                      <Riga key={`${v.occupationClassificationId}:${v.updatedAt}`} voce={v} puoModificare={perms.includes("occupation_classification:update")} />
                    ))}
                  </tbody>
                </table>
              )}
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="ghost" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)} data-testid="tassonomie-prev">{t("tassonomie.precedenti")}</Button>
                <Button type="button" size="sm" variant="ghost" disabled={pagina >= ultima} onClick={() => setPagina((p) => p + 1)} data-testid="tassonomie-next">{t("tassonomie.successivi")}</Button>
              </div>
            </>
          )}
          {perms.includes("occupation_classification:create") && <NuovaVoce schema={schema} />}
        </CardContent>
      </Card>
    </main>
  );
}
