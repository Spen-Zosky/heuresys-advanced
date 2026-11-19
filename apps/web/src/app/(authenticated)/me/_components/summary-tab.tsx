"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { StatsCard } from "@/components/indicatori-leggibili";
import { Briefcase, GraduationCap, TriangleAlert } from "lucide-react";
import { apiFetch } from "../../../../lib/api/fetch";
import { useCurrentUser } from "../../../../lib/api/auth";

interface MeProfile { displayName: string | null; email: string; roles: string[] }
interface MePositions { items: Array<{ positionTitle: string; positionCode: string; isPrimary: boolean }>; total: number }
interface MeCount { total: number }
interface MeLearningList { total: number; items: Array<{ status: string }> }

const ICON_CLS = "h-4 w-4";

/** Riepilogo — the original My HR landing (greeting + primary position + learning + gaps). */
export function MeSummaryTab() {
  const { t } = useTranslation("ess");
  // Il saluto si rivolge per nome («Ciao, Alice»): «Nome Cognome» e «Cognome, Nome» sono elenchi, non una voce.
  const corrente = useCurrentUser();
  const profile = useQuery({ queryKey: ["me", "profile"], queryFn: () => apiFetch<MeProfile>("/v1/me/profile") });
  const positions = useQuery({ queryKey: ["me", "positions"], queryFn: () => apiFetch<MePositions>("/v1/me/positions") });
  const learning = useQuery({ queryKey: ["me", "learning"], queryFn: () => apiFetch<MeLearningList>("/v1/me/learning") });
  const gaps = useQuery({ queryKey: ["me", "gaps"], queryFn: () => apiFetch<MeCount>("/v1/me/gaps") });

  const primary = positions.data?.items.find((p) => p.isPrimary);
  // D2-21: «assegnati» conta solo cio' che resta da fare; i completati hanno un numero a parte
  const learningDone = learning.data?.items.filter((l) => l.status === "COMPLETED").length ?? 0;
  const learningTotal = (learning.data?.total ?? 0) - learningDone;
  const gapsTotal = gaps.data?.total ?? 0;

  return (
    <div className="space-y-8" data-testid="myhr-summary">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground" data-testid="me-greeting">
          {t("landing.greeting", { name: corrente.data?.firstName?.trim() || profile.data?.displayName || profile.data?.email || "…" })}
        </h1>
        <p className="text-sm text-muted-foreground" data-testid="me-email">{profile.data?.email ?? ""}</p>
        <p className="text-sm text-muted-foreground" data-testid="me-roles">
          {t("landing.rolesLabel", { roles: profile.data?.roles.map((r) => t(`shell:roles.${r}`, { defaultValue: r })).join(", ") ?? "—" })}
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div data-testid="me-card-primary-position">
          {positions.isLoading ? (
            <StatsCard label={t("landing.primaryPositionLabel")} value="…" icon={<Briefcase className={`${ICON_CLS} text-palette-1`} />} />
          ) : primary ? (
            <>
              <StatsCard label={t("landing.primaryPositionLabel")} value={primary.positionTitle} icon={<Briefcase className={`${ICON_CLS} text-palette-1`} />} />
              <span data-testid="me-primary-position-title" className="sr-only">{primary.positionTitle}</span>
            </>
          ) : (
            <>
              <StatsCard label={t("landing.primaryPositionLabel")} value="—" description={t("landing.noPrimaryDesc")} icon={<Briefcase className={`${ICON_CLS} text-palette-1`} />} />
              <span data-testid="me-no-primary" className="sr-only">{t("landing.noPrimaryDesc")}</span>
            </>
          )}
        </div>

        <div data-testid="me-card-learning">
          <StatsCard label={t("landing.learningLabel")} value={learningTotal} unit={t("landing.learningUnit")} icon={<GraduationCap className={`${ICON_CLS} text-palette-4`} />} />
          <span data-testid="me-learning-count" className="sr-only">{t("landing.learningCount", { count: learningTotal })}{learningDone > 0 ? ` · ${t("landing.learningDone", { count: learningDone })}` : ""}</span>
        </div>

        <div data-testid="me-card-gaps">
          <StatsCard label={t("landing.gapsLabel")} value={gapsTotal} unit={t("landing.gapsUnit")} icon={<TriangleAlert className={`${ICON_CLS} text-warning`} />} />
          <span data-testid="me-gaps-count" className="sr-only">{t("landing.gapsCount", { count: gapsTotal })}</span>
        </div>
      </section>
    </div>
  );
}
