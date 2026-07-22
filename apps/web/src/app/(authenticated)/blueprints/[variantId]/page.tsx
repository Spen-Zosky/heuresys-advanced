"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { EntityTable } from "@/components/data-table-panel";
import { StatusBadge, StatusPill } from "@/components/status-pill";
import { EnumStatusBadge } from "@/components/enum-badge";

interface BlueprintVariant {
  blueprintVariantId: string;
  familyId: string;
  code: string;
  name: string;
  description: string | null;
}
interface BlueprintProcess {
  blueprintProcessId: string;
  code: string;
  name: string;
  ordinal: number;
  isOptional: boolean;
}
interface BlueprintActivation {
  blueprintActivationId: string;
  tenantId: string;
  variantId: string;
  status: string;
  activatedAt: string | null;
}

interface LinkedDoc {
  linkId: string;
  role: string;
  documentId: string;
  documentTitle: string;
  documentKind: string;
  documentStatus: string;
  blueprintProcessName: string;
}

type Tab = "processes" | "activations" | "documentation";

const TAB_KEYS: ReadonlyArray<Tab> = ["processes", "activations", "documentation"];

export default function BlueprintVariantDetailPage() {
  const { t } = useTranslation("blueprints");
  const params = useParams<{ variantId: string }>();
  const variantId = params.variantId;
  const [tab, setTab] = useState<Tab>("processes");

  const variant = useQuery({
    queryKey: ["blueprint-variants", variantId],
    queryFn: () => apiFetch<BlueprintVariant>(`/v1/blueprint-variants/${variantId}`),
    enabled: !!variantId,
  });
  const processes = useQuery({
    queryKey: ["blueprint-processes", variantId],
    queryFn: () =>
      apiFetch<{ items: BlueprintProcess[]; total: number }>(
        `/v1/blueprint-processes?variantId=${variantId}&limit=200`,
      ),
    enabled: !!variantId && tab === "processes",
  });
  const activations = useQuery({
    queryKey: ["blueprint-activations", variantId],
    queryFn: () =>
      apiFetch<{ items: BlueprintActivation[]; total: number }>(
        `/v1/blueprint-activations?variantId=${variantId}&limit=200`,
      ),
    enabled: !!variantId && tab === "activations",
  });
  // cap④ P3: content documents cross-linked to ANY process of this variant.
  const documentation = useQuery({
    queryKey: ["blueprint-docs", variantId],
    queryFn: () =>
      apiFetch<{ items: LinkedDoc[]; total: number }>(
        `/v1/content-blueprint-links/by-variant?variantId=${variantId}`,
      ),
    enabled: !!variantId && tab === "documentation",
  });

  if (variant.isLoading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-8">
        <span className="text-sm text-muted-foreground">{t("common:loading")}</span>
      </main>
    );
  }
  if (variant.isError) {
    const status = isApiError(variant.error) ? variant.error.status : 0;
    return (
      <main className="mx-auto max-w-5xl px-6 py-8" data-testid="blueprint-error">
        <Link href="/blueprints" className="text-sm underline">{t("detail.back")}</Link>
        <p className="mt-4 text-danger">
          {status === 404 ? t("detail.notFound") : t("detail.error")}
        </p>
      </main>
    );
  }
  const v = variant.data!;
  return (
    <main data-testid="blueprint-detail-page" className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="blueprint-name"
        title={v.name}
        breadcrumbs={
          <Link
            href="/blueprints"
            data-testid="blueprint-back"
            className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {t("detail.back")}
          </Link>
        }
        badges={
          <span data-testid="blueprint-code" className="font-mono text-sm text-muted-foreground">{v.code}</span>
        }
      />

      <nav className="flex gap-1 border-b border-border" data-testid="blueprint-tabs">
        {TAB_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            data-testid={`blueprint-tab-${key}`}
            className={`px-3 py-2 text-sm transition-colors ${
              tab === key
                ? "border-b-2 border-primary font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(`detail.tabs.${key}`)}
          </button>
        ))}
      </nav>

      {tab === "processes" && (
        <Card data-testid="blueprint-tab-content-processes">
          <CardHeader><CardTitle>{t("detail.processesTitle")}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <EntityTable<BlueprintProcess>
              isLoading={processes.isLoading}
              isError={processes.isError}
              rows={processes.data?.items ?? []}
              rowKey={(p) => p.blueprintProcessId}
              rowTestId="blueprint-process-row"
              emptyTestId="blueprint-processes-empty"
              emptyTitle={t("detail.processesEmpty")}
              caption={t("detail.processesCaption")}
              columns={[
                { header: t("detail.processColumns.ordinal"), cell: (p) => <span className="text-xs text-muted-foreground">{p.ordinal}</span> },
                { header: t("detail.processColumns.code"), cell: (p) => <span className="font-mono text-xs">{p.code}</span> },
                { header: t("detail.processColumns.name"), cell: (p) => p.name },
                {
                  header: t("detail.processColumns.optional"),
                  cell: (p) => (
                    <StatusPill tone={p.isOptional ? "info" : "neutral"}>
                      {p.isOptional ? t("detail.yes") : t("detail.no")}
                    </StatusPill>
                  ),
                },
              ]}
            />
          </CardContent>
        </Card>
      )}

      {tab === "activations" && (
        <Card data-testid="blueprint-tab-content-activations">
          <CardHeader><CardTitle>{t("detail.activationsTitle")}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <EntityTable<BlueprintActivation>
              isLoading={activations.isLoading}
              isError={activations.isError}
              rows={activations.data?.items ?? []}
              rowKey={(a) => a.blueprintActivationId}
              rowTestId="blueprint-activation-row"
              emptyTestId="blueprint-activations-empty"
              emptyTitle={t("detail.activationsEmpty")}
              caption={t("detail.activationsCaption")}
              columns={[
                { header: t("detail.activationColumns.tenantId"), cell: (a) => <span className="font-mono text-xs">{a.tenantId.slice(0, 8)}</span> },
                { header: t("detail.activationColumns.status"), cell: (a) => <EnumStatusBadge domain="blueprintActivationStatus" value={a.status} /> },
                { header: t("detail.activationColumns.activatedAt"), cell: (a) => <span className="text-xs">{a.activatedAt ?? t("common:value.none")}</span> },
              ]}
            />
          </CardContent>
        </Card>
      )}

      {tab === "documentation" && (
        <Card data-testid="blueprint-tab-content-documentation">
          <CardHeader><CardTitle>{t("detail.documentationTitle")}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <EntityTable<LinkedDoc>
              isLoading={documentation.isLoading}
              isError={documentation.isError}
              rows={documentation.data?.items ?? []}
              rowKey={(d) => d.linkId}
              rowTestId="blueprint-doc-row"
              emptyTestId="blueprint-documentation-empty"
              emptyTitle={t("detail.documentationEmpty")}
              caption={t("detail.documentationCaption")}
              columns={[
                { header: t("detail.docColumns.title"), cell: (d) => <Link href={`/content/${d.documentId}`} data-testid="blueprint-doc-link" className="font-medium text-foreground hover:underline">{d.documentTitle}</Link> },
                { header: t("detail.docColumns.process"), cell: (d) => <span className="text-muted-foreground">{d.blueprintProcessName}</span> },
                { header: t("detail.docColumns.kind"), cell: (d) => <span className="text-xs text-muted-foreground">{d.documentKind}</span> },
                { header: t("detail.docColumns.status"), cell: (d) => <StatusBadge value={d.documentStatus} /> },
              ]}
            />
          </CardContent>
        </Card>
      )}
    </main>
  );
}
