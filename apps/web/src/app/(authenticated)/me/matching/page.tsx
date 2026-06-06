"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PageHeader, Badge } from "@heuresys/ui";
import type { OccupationMatch, PositionMatch, JobRoleMatch } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";

/**
 * Mirrors the *ListResponseSchema envelopes in @heuresys/shared. Those schemas'
 * inferred response types are not re-exported (only the row types are), so we
 * declare the envelopes locally — same convention as other /me pages.
 */
interface OccupationMatchListResponse {
  items: OccupationMatch[];
  total: number;
  evidenceCount: number;
}
interface PositionMatchListResponse {
  items: PositionMatch[];
  total: number;
  evidenceCount: number;
}
interface JobRoleMatchListResponse {
  items: JobRoleMatch[];
  total: number;
  evidenceCount: number;
}

/** Last path segment of an ESCO URI, used as a human-ish fallback when label is null. */
function escoUriTail(uri: string): string {
  const trimmed = uri.replace(/\/+$/, "");
  const idx = trimmed.lastIndexOf("/");
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
}

export default function MeMatchingPage() {
  const { t } = useTranslation("ess");

  const occupations = useQuery({
    queryKey: ["me", "matching", "occupations"],
    queryFn: () => apiFetch<OccupationMatchListResponse>("/v1/matching/me/occupations"),
  });
  const positions = useQuery({
    queryKey: ["me", "matching", "positions"],
    queryFn: () => apiFetch<PositionMatchListResponse>("/v1/matching/me/positions"),
  });
  const jobRoles = useQuery({
    queryKey: ["me", "matching", "job-roles"],
    queryFn: () => apiFetch<JobRoleMatchListResponse>("/v1/matching/me/job-roles"),
  });

  const occColumns = useMemo<DataColumn<OccupationMatch>[]>(
    () => [
      {
        header: t("matching.colOccupation"),
        cell: (m) => (
          <span className="font-medium text-foreground">{m.label ?? escoUriTail(m.escoUri)}</span>
        ),
      },
      {
        header: t("matching.colIsco"),
        cell: (m) => <span className="text-xs text-muted-foreground">{m.iscoCode ?? "—"}</span>,
      },
      {
        header: t("matching.colScore"),
        align: "right",
        cell: (m) => (
          <span className="font-medium tabular-nums text-foreground">{`${(m.score * 100).toFixed(0)}%`}</span>
        ),
      },
    ],
    [t],
  );

  const posColumns = useMemo<DataColumn<PositionMatch>[]>(
    () => [
      {
        header: t("matching.positions.colPosition"),
        cell: (p) => (
          <span className="font-medium text-foreground">{p.positionTitle ?? p.positionCode}</span>
        ),
      },
      {
        header: t("matching.positions.colScore"),
        align: "right",
        cell: (p) => (
          <span className="font-medium tabular-nums text-foreground">{`${(p.score * 100).toFixed(0)}%`}</span>
        ),
      },
    ],
    [t],
  );

  const roleColumns = useMemo<DataColumn<JobRoleMatch>[]>(
    () => [
      {
        header: t("matching.jobRoles.colRole"),
        cell: (jr) => (
          <span className="font-medium text-foreground">{jr.jobRoleName ?? jr.jobRoleCode}</span>
        ),
      },
      {
        header: t("matching.jobRoles.colSeniority"),
        cell: (jr) => <span className="text-xs text-muted-foreground">{jr.seniorityLevel ?? "—"}</span>,
      },
      {
        header: t("matching.jobRoles.colScore"),
        align: "right",
        cell: (jr) => (
          <span className="font-medium tabular-nums text-foreground">{`${(jr.score * 100).toFixed(0)}%`}</span>
        ),
      },
    ],
    [t],
  );

  const noOccEvidence = occupations.data?.evidenceCount === 0;
  const noPosEvidence = positions.data?.evidenceCount === 0;
  const noRoleEvidence = jobRoles.data?.evidenceCount === 0;

  return (
    <main data-testid="me-matching-page" className="mx-auto max-w-7xl space-y-8 px-6 py-8">
      <section className="space-y-6">
        <PageHeader
          data-testid="me-matching-title"
          title={t("matching.title")}
          description={t("matching.description")}
          badges={
            occupations.data != null ? (
              <Badge variant="secondary" data-testid="me-matching-count">
                {t("matching.count", { count: occupations.data.total })}
              </Badge>
            ) : undefined
          }
        />
        <EntityTable<OccupationMatch>
          isLoading={occupations.isLoading}
          isError={occupations.isError}
          errorMessage={t("matching.errorMessage")}
          rows={occupations.data?.items ?? []}
          rowKey={(m) => m.escoUri}
          rowTestId="me-match-row"
          columns={occColumns}
          emptyTestId="me-matching-empty"
          emptyTitle={noOccEvidence ? t("matching.emptyEvidenceTitle") : t("matching.emptyTitle")}
          emptyDescription={noOccEvidence ? t("matching.emptyEvidenceDesc") : t("matching.emptyDesc")}
          caption={t("matching.caption")}
        />
      </section>

      <section data-testid="me-matching-positions" className="space-y-6">
        <PageHeader
          data-testid="me-matching-positions-title"
          title={t("matching.positions.title")}
          badges={
            positions.data != null ? (
              <Badge variant="secondary" data-testid="me-matching-positions-count">
                {t("matching.count", { count: positions.data.total })}
              </Badge>
            ) : undefined
          }
        />
        <EntityTable<PositionMatch>
          isLoading={positions.isLoading}
          isError={positions.isError}
          errorMessage={t("matching.errorMessage")}
          rows={positions.data?.items ?? []}
          rowKey={(p) => p.positionId}
          rowTestId="me-position-row"
          columns={posColumns}
          emptyTestId="me-matching-positions-empty"
          emptyTitle={noPosEvidence ? t("matching.emptyEvidenceTitle") : t("matching.positions.title")}
          emptyDescription={noPosEvidence ? t("matching.emptyEvidenceDesc") : t("matching.positions.emptyDesc")}
          caption={t("matching.positions.title")}
        />
      </section>

      <section data-testid="me-matching-job-roles" className="space-y-6">
        <PageHeader
          data-testid="me-matching-job-roles-title"
          title={t("matching.jobRoles.title")}
          badges={
            jobRoles.data != null ? (
              <Badge variant="secondary" data-testid="me-matching-job-roles-count">
                {t("matching.count", { count: jobRoles.data.total })}
              </Badge>
            ) : undefined
          }
        />
        <EntityTable<JobRoleMatch>
          isLoading={jobRoles.isLoading}
          isError={jobRoles.isError}
          errorMessage={t("matching.errorMessage")}
          rows={jobRoles.data?.items ?? []}
          rowKey={(jr) => jr.jobRoleId}
          rowTestId="me-job-role-row"
          columns={roleColumns}
          emptyTestId="me-matching-job-roles-empty"
          emptyTitle={noRoleEvidence ? t("matching.emptyEvidenceTitle") : t("matching.jobRoles.title")}
          emptyDescription={noRoleEvidence ? t("matching.emptyEvidenceDesc") : t("matching.jobRoles.emptyDesc")}
          caption={t("matching.jobRoles.title")}
        />
      </section>
    </main>
  );
}
