"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PageHeader, StatsCard } from "@heuresys/ui";
import { Briefcase, GraduationCap, TriangleAlert } from "lucide-react";
import { apiFetch } from "../../../lib/api/fetch";

interface MeProfile {
  userId: string;
  email: string;
  displayName: string | null;
  tenantId: string | null;
  locale: string | null;
  timezone: string | null;
  roles: string[];
  bio: string | null;
}
interface MePositions {
  items: Array<{
    userPositionAssignmentId: string;
    positionTitle: string;
    positionCode: string;
    isPrimary: boolean;
    status: string;
  }>;
  total: number;
}
interface MeLearning {
  items: Array<{ learningPathName: string; status: string; dueDate: string | null }>;
  total: number;
}
interface MeGaps {
  items: Array<{ learningGapId: string; severity: string; skillName: string | null }>;
  total: number;
}

const ICON_CLS = "h-4 w-4";

export default function MeLandingPage() {
  const { t } = useTranslation("ess");
  const profile = useQuery({
    queryKey: ["me", "profile"],
    queryFn: () => apiFetch<MeProfile>("/v1/me/profile"),
  });
  const positions = useQuery({
    queryKey: ["me", "positions"],
    queryFn: () => apiFetch<MePositions>("/v1/me/positions"),
  });
  const learning = useQuery({
    queryKey: ["me", "learning"],
    queryFn: () => apiFetch<MeLearning>("/v1/me/learning"),
  });
  const gaps = useQuery({
    queryKey: ["me", "gaps"],
    queryFn: () => apiFetch<MeGaps>("/v1/me/gaps"),
  });

  const primary = positions.data?.items.find((p) => p.isPrimary);
  const learningTotal = learning.data?.total ?? 0;
  const gapsTotal = gaps.data?.total ?? 0;

  return (
    <main data-testid="me-page" className="mx-auto max-w-7xl space-y-8 px-6 py-8">
      <PageHeader
        title={t("landing.title")}
        description={t("landing.description")}
      />

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground" data-testid="me-greeting">
          {t("landing.greeting", { name: profile.data?.displayName ?? profile.data?.email ?? "…" })}
        </h1>
        <p className="text-sm text-muted-foreground" data-testid="me-email">
          {profile.data?.email ?? ""}
        </p>
        <p className="text-sm text-muted-foreground" data-testid="me-roles">
          {t("landing.rolesLabel", { roles: profile.data?.roles.join(", ") ?? "—" })}
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div data-testid="me-card-primary-position">
          {positions.isLoading ? (
            <StatsCard
              label={t("landing.primaryPositionLabel")}
              value="…"
              icon={<Briefcase className={`${ICON_CLS} text-palette-1`} />}
            />
          ) : primary ? (
            <>
              <StatsCard
                label={t("landing.primaryPositionLabel")}
                value={primary.positionTitle}
                description={primary.positionCode}
                icon={<Briefcase className={`${ICON_CLS} text-palette-1`} />}
              />
              <span data-testid="me-primary-position-title" className="sr-only">
                {primary.positionTitle}
              </span>
            </>
          ) : (
            <>
              <StatsCard
                label={t("landing.primaryPositionLabel")}
                value="—"
                description={t("landing.noPrimaryDesc")}
                icon={<Briefcase className={`${ICON_CLS} text-palette-1`} />}
              />
              <span data-testid="me-no-primary" className="sr-only">
                {t("landing.noPrimaryDesc")}
              </span>
            </>
          )}
        </div>

        <div data-testid="me-card-learning">
          <StatsCard
            label={t("landing.learningLabel")}
            value={learningTotal}
            unit={t("landing.learningUnit")}
            icon={<GraduationCap className={`${ICON_CLS} text-palette-4`} />}
          />
          <span data-testid="me-learning-count" className="sr-only">
            {t("landing.learningCount", { count: learningTotal })}
          </span>
        </div>

        <div data-testid="me-card-gaps">
          <StatsCard
            label={t("landing.gapsLabel")}
            value={gapsTotal}
            unit={t("landing.gapsUnit")}
            icon={<TriangleAlert className={`${ICON_CLS} text-warning`} />}
          />
          <span data-testid="me-gaps-count" className="sr-only">
            {t("landing.gapsCount", { count: gapsTotal })}
          </span>
        </div>
      </section>
    </main>
  );
}
