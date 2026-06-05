"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Badge, Button, Input, PageHeader } from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";

interface LearningPath {
  learningPathId: string;
  code: string;
  name: string;
  description: string | null;
  isMandatoryDefault: boolean;
  isGlobal: boolean;
}

export default function MeLearningCataloguePage() {
  const { t } = useTranslation("ess");
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [lastEnrolled, setLastEnrolled] = useState<string | null>(null);

  const paths = useQuery({
    queryKey: ["learning-paths", "catalogue"],
    queryFn: () => apiFetch<{ items: LearningPath[]; total: number }>("/v1/learning-paths?limit=200"),
  });

  const enroll = useMutation({
    mutationFn: (learningPathId: string) =>
      apiFetch("/v1/me/learning/enrollments", {
        method: "POST",
        body: { learningPathId },
      }),
    onSuccess: (_data, learningPathId) => {
      setLastEnrolled(learningPathId);
      qc.invalidateQueries({ queryKey: ["me", "learning"] });
    },
  });

  const filtered = (paths.data?.items ?? []).filter((p) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
  });

  const columns: DataColumn<LearningPath>[] = [
    {
      header: t("catalogue.colPath"),
      cell: (p) => (
        <div>
          <p className="font-medium text-foreground">{p.name}</p>
          {p.description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{p.description}</p>
          ) : null}
        </div>
      ),
    },
    { header: t("catalogue.colCode"), cell: (p) => <span className="font-mono text-xs text-muted-foreground">{p.code}</span> },
    {
      header: t("catalogue.colType"),
      cell: (p) => (
        <div className="flex flex-wrap gap-1">
          <StatusPill tone={p.isMandatoryDefault ? "warning" : "neutral"}>
            {p.isMandatoryDefault ? t("catalogue.mandatory") : t("catalogue.optional")}
          </StatusPill>
          {p.isGlobal ? <StatusPill tone="info">{t("catalogue.global")}</StatusPill> : null}
        </div>
      ),
    },
    {
      header: t("catalogue.colAction"),
      align: "right",
      cell: (p) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="learning-catalogue-enroll"
          disabled={enroll.isPending}
          onClick={() => void enroll.mutate(p.learningPathId)}
        >
          {enroll.isPending ? t("catalogue.enrolling") : t("catalogue.enroll")}
        </Button>
      ),
    },
  ];

  return (
    <main data-testid="learning-catalogue-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <Link
        href="/me/learning"
        className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        data-testid="learning-catalogue-back"
      >
        {t("catalogue.back")}
      </Link>

      <PageHeader
        data-testid="learning-catalogue-title"
        title={t("catalogue.title")}
        description={t("catalogue.description")}
        badges={
          <Badge variant="secondary" data-testid="learning-catalogue-count">
            {paths.data ? t("catalogue.count", { count: paths.data.total }) : t("common:loading")}
          </Badge>
        }
      />

      <div className="max-w-md">
        <Input
          data-testid="learning-catalogue-filter"
          placeholder={t("catalogue.filterPlaceholder")}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div data-testid="learning-catalogue-list">
        <EntityTable<LearningPath>
          isLoading={paths.isLoading}
          isError={paths.isError}
          errorMessage={t("catalogue.errorMessage")}
          rows={filtered}
          rowKey={(p) => p.learningPathId}
          rowTestId="learning-catalogue-row"
          columns={columns}
          emptyTestId="learning-catalogue-empty"
          emptyTitle={t("catalogue.emptyTitle")}
          emptyDescription={t("catalogue.emptyDesc")}
          caption={t("catalogue.caption")}
        />
      </div>

      {enroll.isError ? (
        <Badge variant="destructive" data-testid="learning-catalogue-error">
          {t("catalogue.errorEnroll")}
        </Badge>
      ) : null}
      {lastEnrolled ? (
        <Badge variant="success" data-testid="learning-catalogue-enrolled">
          {t("catalogue.enrolledConfirm", { path: lastEnrolled })}
        </Badge>
      ) : null}
    </main>
  );
}
