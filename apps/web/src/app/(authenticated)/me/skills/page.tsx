"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, EmptyState, PageHeader } from "@heuresys/ui";
import { Inbox } from "lucide-react";
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
  const skills = useQuery({
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
            {skills.data ? t("skills.count", { count: skills.data.total }) : t("common:loading")}
          </Badge>
        }
      />

      {skills.isLoading ? (
        <div className="rounded-card border border-border bg-card p-6 text-sm text-muted-foreground">
          {t("common:loading")}
        </div>
      ) : skills.isError ? (
        <div className="rounded-card border border-border bg-card p-6 text-sm text-danger" data-testid="me-skills-error">
          {t("skills.error")}
        </div>
      ) : skills.data && skills.data.items.length === 0 ? (
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
                <th className="px-4 py-2">{t("skills.colSource")}</th>
                <th className="px-4 py-2">{t("skills.colScore")}</th>
                <th className="px-4 py-2">{t("skills.colDate")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {skills.data!.items.map((s) => (
                <tr
                  key={s.userSkillEvidenceId}
                  data-testid="me-skill-row"
                  className="transition-colors hover:bg-muted/60"
                >
                  <td className="px-4 py-2 align-middle font-medium text-foreground" title={s.skillCode}>{s.skillName}</td>
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
        </div>
      )}
    </main>
  );
}
