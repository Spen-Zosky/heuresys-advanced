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

import { EntityTable } from "@/components/data-table-panel";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { PageHeader } from "@/components/intestazione-pagina";
import { Inbox } from "lucide-react";
import type { MeSkillPossession, MeSkillPossessionResponse } from "@heuresys/shared";
import { EnumStatusPill } from "@/components/enum-badge";
import { apiFetch } from "@/lib/api/fetch";
import { useEnumLabel } from "@/lib/enum-labels";
import { useFormat } from "@/lib/format";
import { StatoCaricamento, StatoErrore, StatoVuoto } from "@/components/stato-pagina";

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
  const fmt = useFormat();
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
    <main data-testid="me-skills-page" className="mx-auto max-w-7xl space-y-6 px-6 pb-8">
      <PageHeader
        data-testid="me-skills-title"
        title={t("skills.title")}
        description={t("skills.description")}
        badges={
          <Badge variant="secondary" data-testid="me-skills-count">
            {possession.data ? t("skills.count", { count: possession.data.total }) : possession.isError ? t("common:stato.nonDisponibile") : t("common:loading")}
          </Badge>
        }
      />

      {/* Current possession — the primary view (#46 D1) */}
      {possession.isLoading ? (
        <StatoCaricamento />
      ) : possession.isError ? (
        <StatoErrore errore={possession.error} titolo={t("skills.error")} testId="me-skills-error" onRiprova={() => void possession.refetch()} />
      ) : possession.data && possession.data.items.length === 0 ? (
        <StatoVuoto
          testId="me-skills-empty"
          icona={<Inbox className="h-6 w-6" />}
          titolo={t("skills.emptyTitle")}
          motivo={t("skills.emptyDesc")}
        />
      ) : (
        /* C12: ogni competenza apre la sua scheda; il codice ESCO resta fuori dalla vista */
        <div data-testid="me-skills-table">
          <EntityTable<MeSkillPossession>
            isLoading={false}
            isError={false}
            rows={possession.data?.items ?? []}
            rowKey={(s) => s.userSkillId}
            rowTestId="me-skill-row"
            originPath="/v1/me/skills"
            caption={t("skills.colSkill")}
            columns={[
              {
                header: t("skills.colSkill"),
                cell: (s) => (
                  <span className="font-medium text-foreground">
                    {s.skillName}
                    {s.isPrimary && <span className="ml-2 text-[10px] uppercase text-muted-foreground">{t("skills.primaryTag")}</span>}
                  </span>
                ),
              },
              { header: t("skills.colLevel"), cell: (s) => <EnumStatusPill domain="proficiency" value={s.proficiency} tone="info" /> },
              { header: t("skills.colYears"), cell: (s) => <span className="text-xs text-muted-foreground tabular-nums">{s.yearsExperience !== null ? t("skills.years", { count: s.yearsExperience }) : "—"}</span> },
              { header: t("skills.colSource"), cell: (s) => <span className="text-xs text-muted-foreground">{enumLabel("skillSource", s.source)}</span> },
              {
                header: t("skills.colVerified"),
                cell: (s) => s.isVerified
                  ? <span className="text-xs text-success">{t("skills.verifiedYes")}</span>
                  : <span className="text-xs text-muted-foreground">{t("skills.verifiedNo")}</span>,
              },
            ]}
          />
        </div>
      )}

      {/* Evidence trail — append-only history (assessments, manager reviews) */}
      <Card>
        <CardHeader><CardTitle>{t("skills.evidenceTitle")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {evidence.isLoading ? (
            <StatoCaricamento />
          ) : evidence.isError ? (
            <StatoErrore errore={evidence.error} titolo={t("skills.error")} testId="stato-errore-evidenze" onRiprova={() => void evidence.refetch()} />
          ) : (evidence.data?.items.length ?? 0) === 0 ? (
            <StatoVuoto titolo={t("skills.evidenceEmpty")} testId="me-skill-evidence-empty" />
          ) : (
            <div data-testid="me-skill-evidence-table">
              <EntityTable<(NonNullable<typeof evidence.data>)["items"][number]>
                isLoading={false}
                isError={false}
                rows={evidence.data?.items ?? []}
                rowKey={(s) => s.userSkillEvidenceId}
                rowTestId="me-skill-evidence-row"
                caption={t("skills.evidenceTitle")}
                columns={[
                  { header: t("skills.colSkill"), cell: (s) => <span className="text-foreground">{s.skillName}</span> },
                  { header: t("skills.colLevel"), cell: (s) => <EnumStatusPill domain="proficiency" value={s.declaredProficiency} tone="info" /> },
                  { header: t("skills.colSource"), cell: (s) => <span className="text-xs text-muted-foreground">{enumLabel("skillEvidenceSource", s.source)}</span> },
                  { header: t("skills.colScore"), cell: (s) => <span className="text-xs text-muted-foreground">{s.score ?? "—"}</span> },
                  { header: t("skills.colDate"), cell: (s) => <span className="text-xs text-muted-foreground">{fmt.data(s.assessedAt)}</span> },
                ]}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
