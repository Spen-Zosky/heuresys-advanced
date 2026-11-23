"use client";

/**
 * Le fasce dimensionali (XS…XL) e i modelli operativi con cui si tipizza un'impresa: elenchi
 * brevi, scritti con `PUT` per codice (inserisce o aggiorna). Togliere una voce è ritirato.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import type { EnterpriseSizeBand, EnterpriseSizeBandCode, OperatingModel } from "@heuresys/shared";
import { StatoCaricamento, StatoErrore } from "@/components/stato-pagina";
import { apiFetch } from "@/lib/api/fetch";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { useEnumLabel } from "@/lib/enum-labels";
import { useFormat } from "@/lib/format";

const nulloONumero = (s: string): number | null => (s.trim() === "" ? null : Number(s));
const numeroOk = (s: string) => s.trim() === "" || (Number.isFinite(Number(s)) && Number(s) >= 0);
const testo = (s: string): string | null => (s.trim() === "" ? null : s.trim());

function Fascia({ b, puo }: { b: EnterpriseSizeBand; puo: boolean }) {
  const { t } = useTranslation("admin");
  const enumLabel = useEnumLabel();
  const fmt = useFormat();
  const qc = useQueryClient();
  const [aperta, setAperta] = useState(false);
  const iniz = (v: number | null) => (v === null ? "" : String(v));
  const [bz, setBz] = useState({ name: b.name, minE: iniz(b.minEmployees), maxE: iniz(b.maxEmployees), minR: iniz(b.minRevenueEur), maxR: iniz(b.maxRevenueEur), description: b.description ?? "" });
  const ok = bz.name.trim() !== "" && [bz.minE, bz.maxE, bz.minR, bz.maxR].every(numeroOk) && [bz.minE, bz.maxE].every((x) => x.trim() === "" || Number.isInteger(Number(x)));
  const salva = useMutation({
    mutationFn: () => apiFetch("/v1/enterprise-size-bands", {
      method: "PUT",
      body: { code: b.code, name: bz.name.trim(), minEmployees: nulloONumero(bz.minE), maxEmployees: nulloONumero(bz.maxE), minRevenueEur: nulloONumero(bz.minR), maxRevenueEur: nulloONumero(bz.maxR), description: testo(bz.description) },
    }),
    onSuccess: () => { setAperta(false); void qc.invalidateQueries({ queryKey: ["enterprise-size-bands"] }); },
  });
  const da = (x: number | null, y: number | null) => `${x === null ? "—" : fmt.numero(x)} – ${y === null ? "—" : fmt.numero(y)}`;
  return (
    <>
      <tr className="border-t border-border" data-testid="fascia-row" data-code={b.code}>
        <td className="py-1">{b.name}</td>
        <td>{enumLabel("enterpriseSizeBandCode", b.code)}</td>
        <td>{da(b.minEmployees, b.maxEmployees)}</td>
        <td>{da(b.minRevenueEur, b.maxRevenueEur)}</td>
        <td className="text-right">{puo && <Button type="button" size="sm" variant="ghost" data-testid="fascia-edit" onClick={() => setAperta((v) => !v)}>{aperta ? t("tassonomie.chiudi") : t("tassonomie.correggi")}</Button>}</td>
      </tr>
      {aperta && (
        <tr><td colSpan={5} className="space-y-2 pb-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-sm text-foreground">{t("tassonomie.nome")}<Input value={bz.name} onChange={(e) => setBz({ ...bz, name: e.target.value })} data-testid="fascia-edit-name" /></label>
            <label className="text-sm text-foreground">{t("tassonomie.imprese.addettiDa")}<Input value={bz.minE} inputMode="numeric" onChange={(e) => setBz({ ...bz, minE: e.target.value })} /></label>
            <label className="text-sm text-foreground">{t("tassonomie.imprese.addettiA")}<Input value={bz.maxE} inputMode="numeric" onChange={(e) => setBz({ ...bz, maxE: e.target.value })} /></label>
            <label className="text-sm text-foreground">{t("tassonomie.descrizione")}<Input value={bz.description} onChange={(e) => setBz({ ...bz, description: e.target.value })} /></label>
            <label className="text-sm text-foreground">{t("tassonomie.imprese.fatturatoDa")}<Input value={bz.minR} inputMode="decimal" onChange={(e) => setBz({ ...bz, minR: e.target.value })} /></label>
            <label className="text-sm text-foreground">{t("tassonomie.imprese.fatturatoA")}<Input value={bz.maxR} inputMode="decimal" onChange={(e) => setBz({ ...bz, maxR: e.target.value })} /></label>
          </div>
          <Button type="button" size="sm" data-testid="fascia-edit-save" disabled={!ok || salva.isPending} onClick={() => salva.mutate()}>{salva.isPending ? t("common:saving") : t("tassonomie.salva")}</Button>
          {salva.isError && <p className="text-sm text-danger">{t("tassonomie.erroreScrittura")}</p>}
        </td></tr>
      )}
    </>
  );
}

export function FasceDimensionali() {
  const { t } = useTranslation("admin");
  const perms = useCurrentUserPermissions().data?.permissions ?? [];
  const ORDINE: EnterpriseSizeBandCode[] = ["XS", "S", "M", "L", "XL"];
  const fasce = useQuery({ queryKey: ["enterprise-size-bands"], queryFn: () => apiFetch<{ items: EnterpriseSizeBand[]; total: number }>("/v1/enterprise-size-bands?limit=200") });
  const elenco = [...(fasce.data?.items ?? [])].sort((a, b) => ORDINE.indexOf(a.code) - ORDINE.indexOf(b.code));
  return (
    <Card data-testid="fasce-dimensionali">
      <CardHeader><CardTitle as="h2">{t("tassonomie.imprese.fasce")}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {fasce.isLoading && <StatoCaricamento />}
        {fasce.isError && <StatoErrore errore={fasce.error} titolo={t("tassonomie.errore")} onRiprova={() => void fasce.refetch()} />}
        {fasce.data && (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground">
              <th className="py-1">{t("tassonomie.nome")}</th><th>{t("tassonomie.imprese.taglia")}</th><th>{t("tassonomie.imprese.addetti")}</th><th>{t("tassonomie.imprese.fatturato")}</th><th><span className="sr-only">{t("common:table.actions")}</span></th>
            </tr></thead>
            <tbody>{elenco.map((b) => <Fascia key={`${b.enterpriseSizeBandId}:${b.updatedAt}`} b={b} puo={perms.includes("enterprise_typing:update")} />)}</tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

export function ModelliOperativi() {
  const { t } = useTranslation("admin");
  const qc = useQueryClient();
  const perms = useCurrentUserPermissions().data?.permissions ?? [];
  const modelli = useQuery({ queryKey: ["operating-models", "all"], queryFn: () => apiFetch<{ items: OperatingModel[]; total: number }>("/v1/operating-models?limit=200") });
  const vuoto = { code: "", name: "", description: "" };
  const [bz, setBz] = useState(vuoto);
  const salva = useMutation({
    mutationFn: (m: { code: string; name: string; description: string }) => apiFetch("/v1/operating-models", { method: "PUT", body: { code: m.code.trim(), name: m.name.trim(), description: testo(m.description) } }),
    onSuccess: () => { setBz(vuoto); void qc.invalidateQueries({ queryKey: ["operating-models"] }); },
  });
  const elenco = [...(modelli.data?.items ?? [])].sort((a, b) => a.name.localeCompare(b.name, "it"));
  const puo = perms.includes("operating_model:update");
  const esistente = elenco.find((m) => m.code === bz.code.trim());
  return (
    <Card data-testid="modelli-operativi">
      <CardHeader><CardTitle as="h2">{t("tassonomie.imprese.modelli")}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {modelli.isLoading && <StatoCaricamento />}
        {modelli.isError && <StatoErrore errore={modelli.error} titolo={t("tassonomie.errore")} onRiprova={() => void modelli.refetch()} />}
        {modelli.data && (
          <>
            <p className="text-sm text-muted-foreground" data-testid="modelli-count">{t("tassonomie.imprese.contoModelli", { count: elenco.length })}</p>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground"><th className="py-1">{t("tassonomie.nome")}</th><th>{t("tassonomie.descrizione")}</th><th><span className="sr-only">{t("common:table.actions")}</span></th></tr></thead>
              <tbody>
                {elenco.map((m) => (
                  <tr key={m.operatingModelId} className="border-t border-border" data-testid="modello-row" data-code={m.code}>
                    <td className="py-1">{m.name}</td><td>{m.description ?? "—"}</td>
                    <td className="text-right">{puo && <Button type="button" size="sm" variant="ghost" data-testid="modello-edit" onClick={() => setBz({ code: m.code, name: m.name, description: m.description ?? "" })}>{t("tassonomie.correggi")}</Button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {puo && (
          <div className="grid grid-cols-1 items-end gap-3 border-t border-border pt-3 md:grid-cols-4" data-testid="modello-form">
            <label className="text-sm text-foreground">{t("tassonomie.codice")}<Input value={bz.code} onChange={(e) => setBz({ ...bz, code: e.target.value })} data-testid="modello-code" /></label>
            <label className="text-sm text-foreground">{t("tassonomie.nome")}<Input value={bz.name} onChange={(e) => setBz({ ...bz, name: e.target.value })} data-testid="modello-name" /></label>
            <label className="text-sm text-foreground">{t("tassonomie.descrizione")}<Input value={bz.description} onChange={(e) => setBz({ ...bz, description: e.target.value })} data-testid="modello-description" /></label>
            <Button type="button" data-testid="modello-save" disabled={bz.code.trim() === "" || bz.name.trim() === "" || salva.isPending} onClick={() => salva.mutate(bz)}>
              {salva.isPending ? t("common:saving") : esistente ? t("tassonomie.salva") : t("tassonomie.aggiungi")}
            </Button>
            {salva.isError && <p className="text-sm text-danger md:col-span-4">{t("tassonomie.erroreScrittura")}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
