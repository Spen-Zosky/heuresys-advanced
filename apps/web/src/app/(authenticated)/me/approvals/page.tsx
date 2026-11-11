"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@heuresys/ui";
import { PageHeader } from "@/components/intestazione-pagina";
import { CheckSquare } from "lucide-react";
import type { MeApprovalsResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { StatoCaricamento, StatoErrore, StatoVuoto } from "@/components/stato-pagina";
import { EnumStatusBadge } from "@/components/enum-badge";
import { useEnumLabel } from "@/lib/enum-labels";
import { useFormat } from "@/lib/format";
import { EntityTable } from "@/components/data-table-panel";

/** Le mie approvazioni (S1011 F5.3) — track-only view of the caller's own approval requests. */
export default function MeApprovalsPage() {
  const { t } = useTranslation("ess");
  const fmt = useFormat();
  const enumLabel = useEnumLabel();
  const q = useQuery({
    queryKey: ["me", "approvals"],
    queryFn: () => apiFetch<MeApprovalsResponse>("/v1/me/approvals"),
  });
  const data = q.data;
  const items = data?.items ?? [];
  const stats = [
    { key: "pending", value: data?.byStatus.pending },
    { key: "approved", value: data?.byStatus.approved },
    { key: "rejected", value: data?.byStatus.rejected },
  ];

  return (
    <main data-testid="me-approvals-page" className="mx-auto max-w-5xl space-y-6 px-6 pb-8">
      <PageHeader title={t("approvals.title")} description={t("approvals.description")} />

      {q.isLoading ? (
        <StatoCaricamento />
      ) : q.isError || !data ? (
        <StatoErrore errore={q.error} titolo={t("approvals.error")} testId="me-approvals-error" onRiprova={() => void q.refetch()} />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-3" data-testid="approvals-stats">
            {stats.map((s) => (
              <Card key={s.key} data-testid={`approvals-stat-${s.key}`}>
                <CardContent className="p-5">
                  <div className="text-2xl font-semibold tabular-nums">{s.value ?? 0}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{t(`approvals.status.${s.key}`)}</p>
                </CardContent>
              </Card>
            ))}
          </section>

          {items.length === 0 ? (
            <StatoVuoto
              testId="me-approvals-empty"
              icona={<CheckSquare className="h-6 w-6" />}
              titolo={t("approvals.emptyTitle")}
              motivo={t("approvals.emptyDesc")}
            />
          ) : (
            /* C5, C12: 179 richieste in una tabella sola erano dodici schermate; ora pagine da 25,
               e ogni riga apre la sua scheda */
            <div data-testid="me-approvals-table">
              <EntityTable<(typeof items)[number]>
                isLoading={false}
                isError={false}
                rows={items}
                rowKey={(a) => `${a.createdAt}-${a.title ?? ""}-${a.status}`}
                rowTestId="me-approvals-row"
                originPath="/v1/me/approvals"
                caption={t("approvals.title")}
                columns={[
                  { header: t("approvals.colTitle"), cell: (a) => <span className="font-medium text-foreground">{a.title ?? "—"}</span> },
                  {
                    header: t("approvals.colProcess"),
                    cell: (a) => a.processName ? (
                      <span className="text-xs">
                        <span className="text-foreground">{a.processName}</span>
                        {a.processStepName && <span className="block text-muted-foreground">{a.processStepName}</span>}
                      </span>
                    ) : <span className="text-xs text-muted-foreground">{t("approvals.noProcess")}</span>,
                  },
                  { header: t("approvals.colPriority"), cell: (a) => <span className="text-xs text-muted-foreground">{enumLabel("notificationPriority", a.priority)}</span> },
                  { header: t("approvals.colCreated"), cell: (a) => <span className="text-xs text-muted-foreground">{fmt.data(a.createdAt)}</span> },
                  { header: t("approvals.colStatus"), cell: (a) => <EnumStatusBadge domain="approvalStatus" value={a.status} /> },
                ]}
              />
            </div>
          )}
        </>
      )}
    </main>
  );
}
