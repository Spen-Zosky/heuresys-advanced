"use client";

/**
 * Ondata 5a degli endpoint senza consumatori (2026-11-19): i dati di una variante
 * (`PATCH /v1/blueprint-variants/:id`) e quelli dei suoi processi
 * (`PATCH /v1/blueprint-processes/:id`) si correggono da qui, con `blueprint:override` come
 * nell'API. Il codice non cambia: è la chiave con cui il modello si riconosce.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input } from "@heuresys/ui";
import type { BlueprintProcess, BlueprintVariant, EnterpriseSizeBand } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { useCurrentUserPermissions } from "@/lib/api/auth";

const CAMPO =
  "w-full rounded-input border border-border bg-background px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const testo = (s: string): string | null => (s.trim() === "" ? null : s.trim());

export function usePuoCorreggere(): boolean {
  return useCurrentUserPermissions().data?.permissions.includes("blueprint:override") ?? false;
}

export function DatiVariante({ v }: { v: BlueprintVariant }) {
  const { t } = useTranslation("blueprints");
  const qc = useQueryClient();
  const puo = usePuoCorreggere();
  const [aperta, setAperta] = useState(false);
  const [bz, setBz] = useState({ name: v.name, description: v.description ?? "", sizeBandId: v.sizeBandId ?? "" });
  const fasce = useQuery({
    queryKey: ["enterprise-size-bands"],
    queryFn: () => apiFetch<{ items: EnterpriseSizeBand[] }>("/v1/enterprise-size-bands?limit=200"),
  });
  const fascia = fasce.data?.items.find((b) => b.enterpriseSizeBandId === v.sizeBandId);
  const salva = useMutation({
    mutationFn: () => apiFetch(`/v1/blueprint-variants/${v.blueprintVariantId}`, {
      method: "PATCH", body: { name: bz.name.trim(), description: testo(bz.description), sizeBandId: bz.sizeBandId || null },
    }),
    onSuccess: () => { setAperta(false); void qc.invalidateQueries({ queryKey: ["blueprint-variants"] }); },
  });
  return (
    <section data-testid="blueprint-variant-data" className="rounded-card border border-border bg-card px-6 py-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 text-sm">
          {/* La descrizione sta già sotto il titolo della pagina. */}
          <p className="text-muted-foreground">{t("varianti.fascia")}: {fascia?.name ?? t("varianti.nessunaFascia")}</p>
        </div>
        {puo && (
          <Button type="button" size="sm" variant="ghost" data-testid="blueprint-variant-edit" onClick={() => setAperta((x) => !x)}>
            {aperta ? t("famiglie.chiudi") : t("famiglie.correggi")}
          </Button>
        )}
      </div>
      {aperta && (
        <div className="mt-3 grid grid-cols-1 items-end gap-3 md:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">{t("famiglie.nome")}
            <Input value={bz.name} onChange={(e) => setBz({ ...bz, name: e.target.value })} data-testid="blueprint-variant-edit-name" /></label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">{t("famiglie.descrizione")}
            <Input value={bz.description} onChange={(e) => setBz({ ...bz, description: e.target.value })} data-testid="blueprint-variant-edit-description" /></label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">{t("varianti.fascia")}
            <select className={CAMPO} value={bz.sizeBandId} onChange={(e) => setBz({ ...bz, sizeBandId: e.target.value })}>
              <option value="">{t("varianti.nessunaFascia")}</option>
              {(fasce.data?.items ?? []).map((b) => <option key={b.enterpriseSizeBandId} value={b.enterpriseSizeBandId}>{b.name}</option>)}
            </select></label>
          <Button type="button" size="sm" data-testid="blueprint-variant-edit-save" disabled={bz.name.trim() === "" || salva.isPending} onClick={() => salva.mutate()}>
            {salva.isPending ? t("common:saving") : t("famiglie.salva")}
          </Button>
          {salva.isError && <p className="text-sm text-danger md:col-span-4">{t("varianti.errore")}</p>}
        </div>
      )}
    </section>
  );
}

export function ProcessoInModifica({ p, onChiudi }: { p: BlueprintProcess; onChiudi: () => void }) {
  const { t } = useTranslation("blueprints");
  const qc = useQueryClient();
  const [bz, setBz] = useState({ name: p.name, ordinal: String(p.ordinal + 1), description: p.description ?? "", isOptional: p.isOptional });
  const ordineOk = /^\d+$/.test(bz.ordinal) && Number(bz.ordinal) >= 1 && Number(bz.ordinal) <= 32768;
  const salva = useMutation({
    mutationFn: () => apiFetch(`/v1/blueprint-processes/${p.blueprintProcessId}`, {
      method: "PATCH", body: { name: bz.name.trim(), ordinal: Number(bz.ordinal) - 1, description: testo(bz.description), isOptional: bz.isOptional },
    }),
    onSuccess: () => { onChiudi(); void qc.invalidateQueries({ queryKey: ["blueprint-processes"] }); },
  });
  return (
    <div className="space-y-3 border-t border-border px-6 py-4" data-testid="blueprint-process-editor" data-process-id={p.blueprintProcessId}>
      <p className="text-sm font-medium text-foreground">{t("processi.correggi", { nome: p.name })}</p>
      <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">{t("famiglie.nome")}
          <Input value={bz.name} onChange={(e) => setBz({ ...bz, name: e.target.value })} data-testid="blueprint-process-edit-name" /></label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">{t("processi.ordine")}
          <Input value={bz.ordinal} inputMode="numeric" onChange={(e) => setBz({ ...bz, ordinal: e.target.value })} data-testid="blueprint-process-edit-ordinal" /></label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">{t("famiglie.descrizione")}
          <Input value={bz.description} onChange={(e) => setBz({ ...bz, description: e.target.value })} data-testid="blueprint-process-edit-description" /></label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={bz.isOptional} onChange={(e) => setBz({ ...bz, isOptional: e.target.checked })} data-testid="blueprint-process-edit-optional" />
          {t("processi.facoltativo")}
        </label>
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" data-testid="blueprint-process-edit-save" disabled={bz.name.trim() === "" || !ordineOk || salva.isPending} onClick={() => salva.mutate()}>
          {salva.isPending ? t("common:saving") : t("famiglie.salva")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onChiudi}>{t("famiglie.chiudi")}</Button>
      </div>
      {salva.isError && <p className="text-sm text-danger">{t("processi.errore")}</p>}
    </div>
  );
}
