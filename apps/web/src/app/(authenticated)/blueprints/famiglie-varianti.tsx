"use client";

/**
 * Ondata 5a degli endpoint senza consumatori (2026-11-19): le famiglie dei modelli operativi e le
 * loro varianti si creano e si correggono da qui (`POST`/`PATCH /v1/blueprint-families` e
 * `POST /v1/blueprint-variants`). Creare chiede `blueprint:activate`, correggere
 * `blueprint:override`, come nell'API. Togliere una famiglia o una variante è ritirato: si
 * correggono nome e descrizione.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input } from "@heuresys/ui";
import type { BlueprintFamily, EnterpriseSizeBand } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { useCurrentUserPermissions } from "@/lib/api/auth";

const CAMPO =
  "w-full rounded-input border border-border bg-background px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const testo = (s: string): string | null => (s.trim() === "" ? null : s.trim());

function Famiglia({ f, puoCorreggere }: { f: BlueprintFamily; puoCorreggere: boolean }) {
  const { t } = useTranslation("blueprints");
  const qc = useQueryClient();
  const [aperta, setAperta] = useState(false);
  const [bz, setBz] = useState({ name: f.name, description: f.description ?? "" });
  const salva = useMutation({
    mutationFn: () => apiFetch(`/v1/blueprint-families/${f.blueprintFamilyId}`, { method: "PATCH", body: { name: bz.name.trim(), description: testo(bz.description) } }),
    onSuccess: () => { setAperta(false); void qc.invalidateQueries({ queryKey: ["blueprint-families"] }); },
  });
  return (
    <li className="border-t border-border py-2" data-testid="blueprint-family-row" data-id={f.blueprintFamilyId}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{f.name}</p>
          <p className="text-xs text-muted-foreground">{f.description ?? t("famiglie.senzaDescrizione")}</p>
        </div>
        {puoCorreggere && (
          <Button type="button" size="sm" variant="ghost" data-testid="blueprint-family-edit" onClick={() => setAperta((v) => !v)}>
            {aperta ? t("famiglie.chiudi") : t("famiglie.correggi")}
          </Button>
        )}
      </div>
      {aperta && (
        <div className="mt-2 grid grid-cols-1 items-end gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">{t("famiglie.nome")}
            <Input value={bz.name} onChange={(e) => setBz({ ...bz, name: e.target.value })} data-testid="blueprint-family-edit-name" /></label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">{t("famiglie.descrizione")}
            <Input value={bz.description} onChange={(e) => setBz({ ...bz, description: e.target.value })} data-testid="blueprint-family-edit-description" /></label>
          <Button type="button" size="sm" data-testid="blueprint-family-edit-save" disabled={bz.name.trim() === "" || salva.isPending} onClick={() => salva.mutate()}>
            {salva.isPending ? t("common:saving") : t("famiglie.salva")}
          </Button>
          {salva.isError && <p className="text-sm text-danger md:col-span-3">{t("famiglie.errore")}</p>}
        </div>
      )}
    </li>
  );
}

export function FamiglieVarianti({ famiglie }: { famiglie: BlueprintFamily[] }) {
  const { t } = useTranslation("blueprints");
  const qc = useQueryClient();
  const perms = useCurrentUserPermissions().data?.permissions ?? [];
  const puoCreare = perms.includes("blueprint:activate");
  const puoCorreggere = perms.includes("blueprint:override");
  const fasce = useQuery({
    queryKey: ["enterprise-size-bands"],
    queryFn: () => apiFetch<{ items: EnterpriseSizeBand[] }>("/v1/enterprise-size-bands?limit=200"),
    enabled: puoCreare,
  });
  const vuotaF = { code: "", name: "", description: "" };
  const [nf, setNf] = useState(vuotaF);
  const creaF = useMutation({
    mutationFn: () => apiFetch("/v1/blueprint-families", { method: "POST", body: { code: nf.code.trim(), name: nf.name.trim(), description: testo(nf.description) } }),
    onSuccess: () => { setNf(vuotaF); void qc.invalidateQueries({ queryKey: ["blueprint-families"] }); },
  });
  const vuotaV = { familyId: "", code: "", name: "", description: "", sizeBandId: "" };
  const [nv, setNv] = useState(vuotaV);
  const creaV = useMutation({
    mutationFn: () => apiFetch("/v1/blueprint-variants", {
      method: "POST",
      body: { familyId: nv.familyId, code: nv.code.trim(), name: nv.name.trim(), description: testo(nv.description), sizeBandId: nv.sizeBandId || null },
    }),
    onSuccess: () => { setNv(vuotaV); void qc.invalidateQueries({ queryKey: ["blueprint-variants"] }); },
  });
  if (!puoCreare && !puoCorreggere) return null;
  const ordinate = [...famiglie].sort((a, b) => a.name.localeCompare(b.name, "it"));
  return (
    <section data-testid="blueprint-families-panel" className="mx-auto max-w-7xl rounded-card border border-border bg-card px-6 py-4 shadow-card">
      <h2 className="text-base font-semibold text-foreground">{t("famiglie.titolo")}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{t("famiglie.hint")}</p>
      <p className="mt-2 text-sm text-muted-foreground" data-testid="blueprint-families-count">{t("famiglie.conto", { count: ordinate.length })}</p>
      <ul className="mt-1">{ordinate.map((f) => <Famiglia key={`${f.blueprintFamilyId}:${f.updatedAt}`} f={f} puoCorreggere={puoCorreggere} />)}</ul>
      {puoCreare && (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-4" data-testid="blueprint-family-new">
            <p className="text-sm font-medium text-foreground md:col-span-4">{t("famiglie.nuova")}</p>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">{t("famiglie.codice")}
              <Input value={nf.code} onChange={(e) => setNf({ ...nf, code: e.target.value })} data-testid="blueprint-family-new-code" /></label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">{t("famiglie.nome")}
              <Input value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} data-testid="blueprint-family-new-name" /></label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">{t("famiglie.descrizione")}
              <Input value={nf.description} onChange={(e) => setNf({ ...nf, description: e.target.value })} /></label>
            <Button type="button" data-testid="blueprint-family-new-save" disabled={nf.code.trim() === "" || nf.name.trim() === "" || creaF.isPending} onClick={() => creaF.mutate()}>
              {creaF.isPending ? t("common:saving") : t("famiglie.aggiungi")}
            </Button>
            {creaF.isError && <p className="text-sm text-danger md:col-span-4">{t("famiglie.errore")}</p>}
          </div>
          <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-5" data-testid="blueprint-variant-new">
            <p className="text-sm font-medium text-foreground md:col-span-5">{t("varianti.nuova")}</p>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">{t("varianti.famiglia")}
              <select className={CAMPO} value={nv.familyId} onChange={(e) => setNv({ ...nv, familyId: e.target.value })} data-testid="blueprint-variant-new-family">
                <option value="">{t("varianti.scegli")}</option>
                {ordinate.map((f) => <option key={f.blueprintFamilyId} value={f.blueprintFamilyId}>{f.name}</option>)}
              </select></label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">{t("famiglie.codice")}
              <Input value={nv.code} onChange={(e) => setNv({ ...nv, code: e.target.value })} data-testid="blueprint-variant-new-code" /></label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">{t("famiglie.nome")}
              <Input value={nv.name} onChange={(e) => setNv({ ...nv, name: e.target.value })} data-testid="blueprint-variant-new-name" /></label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">{t("varianti.fascia")}
              <select className={CAMPO} value={nv.sizeBandId} onChange={(e) => setNv({ ...nv, sizeBandId: e.target.value })}>
                <option value="">{t("varianti.nessunaFascia")}</option>
                {(fasce.data?.items ?? []).map((b) => <option key={b.enterpriseSizeBandId} value={b.enterpriseSizeBandId}>{b.name}</option>)}
              </select></label>
            <Button type="button" data-testid="blueprint-variant-new-save" disabled={!nv.familyId || nv.code.trim() === "" || nv.name.trim() === "" || creaV.isPending} onClick={() => creaV.mutate()}>
              {creaV.isPending ? t("common:saving") : t("varianti.aggiungi")}
            </Button>
            {creaV.isError && <p className="text-sm text-danger md:col-span-5">{t("varianti.errore")}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
