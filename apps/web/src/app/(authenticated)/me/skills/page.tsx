"use client";

/**
 * /me/skills — #46 D1: skill POSSESSION as the primary view.
 *
 * `sys_user_skills` (current state, one row per skill — proficiency,
 * verification, seniority) feeds the main table via /v1/me/skills/possession;
 * the append-only evidence trail (/v1/me/skills, sys_user_skill_evidence)
 * stays below as history. Before this wire-up the endpoint existed and was
 * tested but no UI consumed it — the page still showed only the trail.
 */

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader } from "@heuresys/ui";
import { Inbox } from "lucide-react";
import type { MeSkillPossession, MeSkillPossessionResponse } from "@heuresys/shared";
import { EnumStatusPill } from "@/components/enum-badge";
import { apiFetch } from "@/lib/api/fetch";
import { useEnumLabel } from "@/lib/enum-labels";

interface MeSkillEvidence {
  userSkillEvidenceId: string;
  skillCode: string;
  skillName: string;
  declaredProficiency: string;
  source: string;
  assessedAt: string;
  score: number | null;
  comment: string | null;
}

export default function MeSkillsPage() {
  const { t } = useTranslation("ess");
  const enumLabel = useEnumLabel();
  const possession = useQuery({
    queryKey: ["me", "skills", "possession"],
    queryFn: () => apiFetch<MeSkillPossessionResponse>("/v1/me/skills/possession"),
  });
  const evidence = useQuery({
    queryKey: ["me", "skills"],
    queryFn: () => apiFetch<{ items: MeSkillEvidence[]; total: number }>("/v1/me/skills"),
  });

  return (
    <main data-testid="me-skills-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="me-skills-title"
        title={t("skills.title")}
        description={t("skills.description")}
        badges={
          <Badge variant="secondary" data-testid="me-skills-count">
            {possession.data ? t("skills.count", { count: possession.data.total }) : t("common:loading")}
          </Badge>
        }
      />

      {/* Current possession — the primary view (#46 D1) */}
      {possession.isLoading ? (
        <div className="rounded-card border border-border bg-card p-6 text-sm text-muted-foreground">
          {t("common:loading")}
        </div>
      ) : possession.isError ? (
        <div className="rounded-card border border-border bg-card p-6 text-sm text-danger" data-testid="me-skills-error">
          {t("skills.error")}
        </div>
      ) : possession.data && possession.data.items.length === 0 ? (
        <EmptyState
          data-testid="me-skills-empty"
          icon={<Inbox className="h-6 w-6" />}
          title={t("skills.emptyTitle")}
          description={t("skills.emptyDesc")}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
          <table className="w-full border-collapse text-sm" data-testid="me-skills-table">
            <thead>
              <tr className="border-b border-border bg-muted text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2">{t("skills.colSkill")}</th>
                <th className="px-4 py-2">{t("skills.colLevel")}</th>
                <th className="px-4 py-2">{t("skills.colYears")}</th>
                <th className="px-4 py-2">{t("skills.colVerified")}</th>
                <th className="px-4 py-2">{t("skills.colSource")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(possession.data?.items ?? []).map((s: MeSkillPossession) => (
                <tr key={s.userSkillId} data-testid="me-skill-row" className="transition-colors hover:bg-muted/60">
                  <td className="px-4 py-2 align-middle font-medium text-foreground" title={s.skillCode}>
                    {s.skillName}
                    {s.isPrimary && <span className="ml-2 text-[10px] uppercase text-muted-foreground">{t("skills.primaryTag")}</span>}
                  </td>
                  <td className="px-4 py-2 align-middle">
                    <EnumStatusPill domain="proficiency" value={s.proficiency} tone="info" />
                  </td>
                  <td className="px-4 py-2 align-middle text-xs text-muted-foreground tabular-nums">
                    {s.yearsExperience !== null ? t("skills.years", { count: s.yearsExperience }) : "—"}
                  </td>
                  <td className="px-4 py-2 align-middle text-xs">
                    {s.isVerified
                      ? <span className="text-success">{t("skills.verifiedYes")}</span>
                      : <span className="text-muted-foreground">{t("skills.verifiedNo")}</span>}
                  </td>
                  <td className="px-4 py-2 align-middle text-xs text-muted-foreground">{enumLabel("skillSource", s.source)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Evidence trail — append-only history (assessments, manager reviews) */}
      <Card>
        <CardHeader><CardTitle>{t("skills.evidenceTitle")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {evidence.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">{t("common:loading")}</p>
          ) : evidence.isError ? (
            <p className="p-4 text-sm text-danger">{t("skills.error")}</p>
          ) : (evidence.data?.items.length ?? 0) === 0 ? (
            <p className="p-4 text-sm text-muted-foreground" data-testid="me-skill-evidence-empty">{t("skills.evidenceEmpty")}</p>
          ) : (
            <table className="w-full border-collapse text-sm" data-testid="me-skill-evidence-table">
              <thead>
                <tr className="border-b border-border bg-muted text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2">{t("skills.colSkill")}</th>
                  <th className="px-4 py-2">{t("skills.colLevel")}</th>
                  <th className="px-4 py-2">{t("skills.colSource")}</th>
                  <th className="px-4 py-2">{t("skills.colScore")}</th>
                  <th className="px-4 py-2">{t("skills.colDate")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(evidence.data?.items ?? []).map((s) => (
                  <tr key={s.userSkillEvidenceId} data-testid="me-skill-evidence-row" className="transition-colors hover:bg-muted/60">
                    <td className="px-4 py-2 align-middle text-foreground" title={s.skillCode}>{s.skillName}</td>
                    <td className="px-4 py-2 align-middle">
                      <EnumStatusPill domain="proficiency" value={s.declaredProficiency} tone="info" />
                    </td>
                    <td className="px-4 py-2 align-middle text-xs text-muted-foreground">{enumLabel("skillEvidenceSource", s.source)}</td>
                    <td className="px-4 py-2 align-middle text-xs text-muted-foreground">{s.score ?? "—"}</td>
                    <td className="px-4 py-2 align-middle text-xs text-muted-foreground">{s.assessedAt.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
