"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { EmptyState, PageHeader } from "@heuresys/ui";
import { Target } from "lucide-react";
import { apiFetch } from "@/lib/api/fetch";
import { StatusBadge } from "@/components/status-pill";

interface MeCareerTarget {
  userCareerPlanId: string;
  positionId: string;
  positionTitle: string;
  status: string;
  targetDate: string | null;
  notes: string | null;
}

export default function MeCareerPage() {
  const { t } = useTranslation("ess");
  const career = useQuery({
    queryKey: ["me", "career"],
    queryFn: () => apiFetch<{ items: MeCareerTarget[]; total: number }>("/v1/me/career"),
  });

  const items = career.data?.items ?? [];

  return (
    <main data-testid="me-career-page" className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="me-career-title"
        title={t("career.title")}
        description={t("career.description")}
        badges={
          <span
            data-testid="me-career-count"
            className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
          >
            {career.data ? t("career.count", { count: career.data.total }) : t("common:loading")}
          </span>
        }
      />

      {career.isLoading ? (
        <div className="rounded-card border border-border bg-card p-6 text-sm text-muted-foreground">
          {t("common:loading")}
        </div>
      ) : career.isError ? (
        <div className="rounded-card border border-border bg-card p-6 text-sm text-danger" data-testid="me-career-error">
          {t("career.error")}
        </div>
      ) : career.data && items.length === 0 ? (
        <EmptyState
          data-testid="me-career-empty"
          icon={<Target className="h-6 w-6" />}
          title={t("career.emptyTitle")}
          description={t("career.emptyDesc")}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
          <table data-testid="me-career-table" className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2">{t("career.colPosition")}</th>
                <th className="px-4 py-2">{t("career.colStatus")}</th>
                <th className="px-4 py-2">{t("career.colDate")}</th>
                <th className="px-4 py-2">{t("career.colNotes")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((c) => (
                <tr
                  key={c.userCareerPlanId}
                  data-testid="me-career-row"
                  className="transition-colors hover:bg-muted/60"
                >
                  <td className="px-4 py-2 align-middle font-medium text-foreground">{c.positionTitle}</td>
                  <td className="px-4 py-2 align-middle">
                    <StatusBadge value={c.status} />
                  </td>
                  <td className="px-4 py-2 align-middle text-xs text-muted-foreground">{c.targetDate ?? "—"}</td>
                  <td className="px-4 py-2 align-middle text-xs text-muted-foreground">{c.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
