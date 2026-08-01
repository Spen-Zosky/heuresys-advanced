"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Badge, Button, Input, PageHeader } from "@heuresys/ui";
import type { LearningPath } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";

export default function MeLearningCataloguePage() {
  const { t } = useTranslation("ess");
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [lastEnrolled, setLastEnrolled] = useState<string | null>(null);

  // C4 (#42): server-side search + pagination. The catalogue holds ~4.7k paths;
  // the old `?limit=200` + in-browser filter made everything past the first 200
  // unreachable. `search` does ILIKE on name OR code — the same match.
  const debouncedFilter = useDebouncedValue(filter, 300);
  const paths = usePaginatedList<LearningPath>({
    queryKey: ["learning-paths", "catalogue"],
    path: "/v1/learning-paths",
    params: { search: debouncedFilter },
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
      // Was a MANDATORY/OPTIONAL pill driven by `isMandatoryDefault` — a field the
      // API never returns, so it read `undefined` and rendered "OPTIONAL" on every
      // row regardless of truth. Mandatory-ness is a property of a POSITION's
      // learning requirement, not of the path itself, so the honest column here is
      // the path's scope (C4 #42: local interfaces had drifted from the contract).
      header: t("catalogue.colScope"),
      cell: (p) => (
        <StatusPill tone={p.isGlobal ? "info" : "neutral"}>
          {p.isGlobal ? t("catalogue.global") : t("catalogue.tenant")}
        </StatusPill>
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
            {paths.query.data ? t("catalogue.count", { count: paths.total }) : t("common:loading")}
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
          isLoading={paths.query.isLoading}
          isError={paths.query.isError}
          errorMessage={t("catalogue.errorMessage")}
          rows={paths.rows}
          server={paths.server}
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
        <Badge variant="outline" className="border-danger text-danger" data-testid="learning-catalogue-error">
          {t("catalogue.errorEnroll")}
        </Badge>
      ) : null}
      {lastEnrolled ? (
        <Badge variant="outline" className="border-success text-success" data-testid="learning-catalogue-enrolled">
          {t("catalogue.enrolledConfirm", { path: lastEnrolled })}
        </Badge>
      ) : null}
    </main>
  );
}
