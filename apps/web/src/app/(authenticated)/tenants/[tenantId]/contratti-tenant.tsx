"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import type { TenantContractsResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { useFormat } from "@/lib/format";
import { StatoCaricamento, StatoErrore, StatoVuoto } from "@/components/stato-pagina";

/** Scheda «Contratti» del tenant: contratti collettivi del modello attivo, livelli, minimi, lacune, persone. */
export function ContrattiTenant({ tenantId }: { tenantId: string }) {
  const { t } = useTranslation("admin");
  const fmt = useFormat();
  const q = useQuery({
    queryKey: ["tenants", tenantId, "contracts"],
    queryFn: () => apiFetch<TenantContractsResponse>(`/v1/tenants/${tenantId}/contracts`),
  });

  if (q.isLoading) return <StatoCaricamento />;
  if (q.isError) return <StatoErrore errore={q.error} titolo={t("tenants.detail.contracts.loadError")} testId="tenant-contracts-error" onRiprova={() => void q.refetch()} />;
  const d = q.data!;
  const s = d.summary;
  if (d.contracts.length === 0) return <StatoVuoto titolo={t("tenants.detail.contracts.empty")} testId="tenant-contracts-empty" />;

  return (
    <div className="space-y-4" data-testid="tenant-tab-content-contracts">
      <Card>
        <CardHeader><CardTitle as="h2">{t("tenants.detail.contracts.title")}</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>{t("tenants.detail.contracts.industry", { name: d.industryName ?? d.industryCode })}</p>
          {d.source.kind === "OTHER_VERSION" && (
            <p className="rounded-card border border-border px-3 py-2" data-testid="tenant-contracts-source">
              {t("tenants.detail.contracts.otherVersion", { n: d.source.versionNumber ?? "" })}
            </p>
          )}
          <p data-testid="tenant-contracts-summary">
            {t("tenants.detail.contracts.summary", {
              contracts: fmt.numero(s.contracts), levels: fmt.numero(s.levels), gaps: fmt.numero(s.levelsWithoutMinimum),
              people: fmt.numero(s.peopleWithContract),
            })}
          </p>
          {s.levelsWithoutMinimum > 0 && (
            <p className="rounded-card border border-border px-3 py-2" data-testid="tenant-contracts-gap-warning">
              {t("tenants.detail.contracts.gapWarning", { n: fmt.numero(s.levelsWithoutMinimum) })}
            </p>
          )}
          {s.peopleOutsideModelLevels > 0 && (
            <p className="rounded-card border border-border px-3 py-2" data-testid="tenant-contracts-outside-warning">
              {t("tenants.detail.contracts.outsideWarning", { n: fmt.numero(s.peopleOutsideModelLevels) })}
            </p>
          )}
        </CardContent>
      </Card>

      {d.contracts.map((c) => (
        <Card key={c.code} data-testid="tenant-contract">
          <CardHeader><CardTitle as="h3">{c.name}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              {c.scope && <div><dt className="text-muted-foreground">{t("tenants.detail.contracts.scope")}</dt><dd>{c.scope}</dd></div>}
              {c.parties && <div><dt className="text-muted-foreground">{t("tenants.detail.contracts.parties")}</dt><dd>{c.parties}</dd></div>}
              {c.effective && <div><dt className="text-muted-foreground">{t("tenants.detail.contracts.effective")}</dt><dd>{c.effective}</dd></div>}
            </dl>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="tenant-contract-levels">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">{t("tenants.detail.contracts.level")}</th>
                    <th className="py-2 pr-3 font-medium">{t("tenants.detail.contracts.category")}</th>
                    <th className="py-2 pr-3 text-right font-medium">{t("tenants.detail.contracts.minimum")}</th>
                    <th className="py-2 pr-3 text-right font-medium">{t("tenants.detail.contracts.people")}</th>
                    <th className="py-2 font-medium">{t("tenants.detail.contracts.state")}</th>
                  </tr>
                </thead>
                <tbody>
                  {c.levels.map((l) => (
                    <tr key={l.code} className="border-b border-border/60" data-testid="tenant-contract-level">
                      <td className="py-2 pr-3" title={l.duties ?? undefined}>{l.name}</td>
                      <td className="py-2 pr-3">{l.category ? t(`tenants.detail.contracts.categories.${l.category}`, { defaultValue: l.category }) : t("tenants.detail.dash")}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{l.annualMinimumEur === null ? t("tenants.detail.dash") : fmt.importo(l.annualMinimumEur, "EUR", 0)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{fmt.numero(l.people)}</td>
                      <td className="py-2">{l.annualMinimumEur === null ? t("tenants.detail.contracts.gap") : (l.minimumNote ?? t("tenants.detail.contracts.complete"))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
