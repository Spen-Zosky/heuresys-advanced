"use client";

/**
 * Un catalogo di classificazioni gerarchiche (professioni ISCO/CP, attività economiche ATECO/NACE):
 * stessa forma nel contratto, quindi una sola schermata con elenco a pagine, aggiunta e correzione.
 * La cancellazione è ritirata (`lib/rotte-ritirate.ts`): una voce non si toglie, si corregge.
 * L'elenco è a pagine dall'API, con il totale vero: niente troncamenti in silenzio (R5).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import type { ReactNode } from "react";
import { StatoCaricamento, StatoErrore, StatoVuoto } from "@/components/stato-pagina";
import { apiFetch } from "@/lib/api/fetch";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { useEnumLabel } from "@/lib/enum-labels";

const PAGINA = 100;
const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** I campi comuni alle due famiglie di classificazioni. */
export interface VoceClasse {
  id: string; scheme: string; code: string; parentCode: string | null;
  name: string; description: string | null; level: number | null; updatedAt: string;
}
export interface Catalogo {
  chiave: string;
  /** `/v1/occupation-classifications` o `/v1/activity-classifications` */
  percorso: string;
  schemi: readonly string[];
  dominioEnum: string;
  /** dalla riga dell'API alla forma comune */
  voce: (r: Record<string, unknown>) => VoceClasse;
  permessi: { leggi: string; crea: string; correggi: string };
  testId: string;
  titolo: string;
}
interface Elenco { items: Record<string, unknown>[]; total: number }

function livelloDa(testo: string): number | null {
  const n = Number(testo);
  return testo.trim() === "" ? null : n;
}
const livelloValido = (testo: string) => testo.trim() === "" || (Number.isInteger(Number(testo)) && Number(testo) >= 1 && Number(testo) <= 10);

function Riga({ c, voce, puoModificare, extra }: { c: Catalogo; voce: VoceClasse; puoModificare: boolean; extra?: ReactNode }) {
  const { t } = useTranslation("admin");
  const qc = useQueryClient();
  const [aperta, setAperta] = useState(false);
  const [bozza, setBozza] = useState({ name: voce.name, description: voce.description ?? "", level: voce.level === null ? "" : String(voce.level) });
  const salva = useMutation({
    mutationFn: () => apiFetch(`${c.percorso}/${voce.id}`, {
      method: "PATCH",
      body: { name: bozza.name.trim(), description: bozza.description.trim() === "" ? null : bozza.description.trim(), level: livelloDa(bozza.level) },
    }),
    onSuccess: () => { setAperta(false); void qc.invalidateQueries({ queryKey: [c.chiave] }); },
  });
  return (
    <>
      <tr className="border-t border-border" data-testid={`${c.testId}-row`} data-id={voce.id}>
        <td className="py-1">{voce.name}</td>
        <td className="font-mono text-xs" data-grezzo>{voce.code}</td>
        <td>{voce.level ?? "—"}</td>
        <td className="text-right">
          {(puoModificare || extra) && (
            <Button type="button" size="sm" variant="ghost" data-testid="tassonomia-edit" onClick={() => setAperta((v) => !v)}>
              {aperta ? t("tassonomie.chiudi") : puoModificare ? t("tassonomie.correggi") : t("tassonomie.apri")}
            </Button>
          )}
        </td>
      </tr>
      {aperta && (
        <tr data-testid="tassonomia-editor">
          <td colSpan={4} className="space-y-2 pb-3">
            {puoModificare && <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="text-sm font-medium text-foreground">{t("tassonomie.nome")}
                <Input value={bozza.name} onChange={(e) => setBozza({ ...bozza, name: e.target.value })} data-testid="tassonomia-edit-name" /></label>
              <label className="text-sm font-medium text-foreground md:col-span-1">{t("tassonomie.descrizione")}
                <Input value={bozza.description} onChange={(e) => setBozza({ ...bozza, description: e.target.value })} data-testid="tassonomia-edit-description" /></label>
              <label className="text-sm font-medium text-foreground">{t("tassonomie.livello")}
                <Input value={bozza.level} inputMode="numeric" onChange={(e) => setBozza({ ...bozza, level: e.target.value })} data-testid="tassonomia-edit-level" /></label>
            </div>}
            {puoModificare && <Button type="button" size="sm" data-testid="tassonomia-edit-save" disabled={bozza.name.trim() === "" || !livelloValido(bozza.level) || salva.isPending} onClick={() => salva.mutate()}>
              {salva.isPending ? t("common:saving") : t("tassonomie.salva")}
            </Button>}
            {salva.isError && <p className="text-sm text-danger">{t("tassonomie.erroreScrittura")}</p>}
            {extra}
          </td>
        </tr>
      )}
    </>
  );
}

function NuovaVoce({ c, schema }: { c: Catalogo; schema: string }) {
  const { t } = useTranslation("admin");
  const qc = useQueryClient();
  const vuota = { code: "", parentCode: "", name: "", description: "", level: "" };
  const [bozza, setBozza] = useState(vuota);
  const crea = useMutation({
    mutationFn: () => apiFetch(c.percorso, {
      method: "POST",
      body: {
        scheme: schema, code: bozza.code.trim(), name: bozza.name.trim(),
        parentCode: bozza.parentCode.trim() === "" ? null : bozza.parentCode.trim(),
        description: bozza.description.trim() === "" ? null : bozza.description.trim(),
        level: livelloDa(bozza.level),
      },
    }),
    onSuccess: () => { setBozza(vuota); void qc.invalidateQueries({ queryKey: [c.chiave] }); },
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

export function CatalogoClassi({ c, dettaglio }: { c: Catalogo; dettaglio?: (v: VoceClasse) => ReactNode }) {
  const { t } = useTranslation("admin");
  const enumLabel = useEnumLabel();
  const perms = useCurrentUserPermissions().data?.permissions ?? [];
  const [schema, setSchema] = useState<string>(c.schemi[0]!);
  const [cerca, setCerca] = useState("");
  const [pagina, setPagina] = useState(0);
  const filtro = cerca.trim();
  const elenco = useQuery({
    queryKey: [c.chiave, schema, filtro, pagina],
    queryFn: () => {
      const q = new URLSearchParams({ scheme: schema, limit: String(PAGINA), offset: String(pagina * PAGINA) });
      if (filtro !== "") q.set("search", filtro);
      return apiFetch<Elenco>(`${c.percorso}?${q.toString()}`);
    },
    enabled: perms.includes(c.permessi.leggi),
  });
  const totale = elenco.data?.total ?? 0;
  const ultima = Math.max(0, Math.ceil(totale / PAGINA) - 1);
  return (
    <Card data-testid={c.testId}>
        <CardHeader><CardTitle as="h2">{c.titolo}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-sm font-medium text-foreground">{t("tassonomie.schema")}
              <select className={SELECT_CLASS} value={schema} data-testid={`${c.testId}-scheme`}
                onChange={(e) => { setSchema(e.target.value); setPagina(0); }}>
                {c.schemi.map((s) => <option key={s} value={s}>{enumLabel(c.dominioEnum, s)}</option>)}
              </select></label>
            <label className="text-sm font-medium text-foreground md:col-span-2">{t("tassonomie.cerca")}
              <Input value={cerca} data-testid={`${c.testId}-search`} onChange={(e) => { setCerca(e.target.value); setPagina(0); }} /></label>
          </div>
          {elenco.isLoading && <StatoCaricamento />}
          {elenco.isError && <StatoErrore errore={elenco.error} titolo={t("tassonomie.errore")} onRiprova={() => void elenco.refetch()} />}
          {elenco.data && (
            <>
              <p className="text-sm text-muted-foreground" data-testid={`${c.testId}-count`}>
                {t("tassonomie.conto", { count: totale, da: totale === 0 ? 0 : pagina * PAGINA + 1, a: Math.min(totale, (pagina + 1) * PAGINA) })}
              </p>
              {elenco.data.items.length === 0 ? <StatoVuoto /> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-muted-foreground">
                    <th className="py-1">{t("tassonomie.nome")}</th><th>{t("tassonomie.codice")}</th><th>{t("tassonomie.livello")}</th><th><span className="sr-only">{t("common:table.actions")}</span></th>
                  </tr></thead>
                  <tbody>
                    {elenco.data.items.map(c.voce).map((v) => (
                      <Riga key={`${v.id}:${v.updatedAt}`} c={c} voce={v} puoModificare={perms.includes(c.permessi.correggi)} extra={dettaglio?.(v)} />
                    ))}
                  </tbody>
                </table>
              )}
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="ghost" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)} data-testid={`${c.testId}-prev`}>{t("tassonomie.precedenti")}</Button>
                <Button type="button" size="sm" variant="ghost" disabled={pagina >= ultima} onClick={() => setPagina((p) => p + 1)} data-testid={`${c.testId}-next`}>{t("tassonomie.successivi")}</Button>
              </div>
            </>
          )}
          {perms.includes(c.permessi.crea) && <NuovaVoce key={schema} c={c} schema={schema} />}
        </CardContent>
      </Card>
  );
}
