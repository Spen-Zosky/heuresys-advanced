"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import type { MeAttendanceResponse } from "@heuresys/shared";
import { apiFetch } from "../../../../lib/api/fetch";
import { Field, ProfileSection, fmtDate } from "../profile/_components/field";

/** Presenze — imported attendance/overtime/leave (read-only consultation), lazy on tab open. */
export function MeAttendanceTab() {
  const { t } = useTranslation("ess");
  const q = useQuery({
    queryKey: ["me", "attendance"],
    queryFn: () => apiFetch<MeAttendanceResponse>("/v1/me/attendance"),
  });

  if (q.isLoading) return <span className="text-sm text-muted-foreground">{t("common:loading")}</span>;
  if (q.isError || !q.data) return <p className="text-sm text-danger" data-testid="myhr-attendance-error">{t("landing.att.error")}</p>;
  const d = q.data;

  return (
    <div className="space-y-6" data-testid="myhr-attendance">
      <ProfileSection title={t("landing.att.balancesTitle")} testId="att-balances">
        {d.leaveBalances.length === 0 ? (
          <Field label={t("landing.att.none")} value={null} />
        ) : (
          d.leaveBalances.map((b, i) => (
            <Field
              key={`bal-${i}`}
              label={`${b.leaveType ?? "—"} ${b.year ?? ""}`}
              value={`${b.usedDays ?? 0}/${b.totalDays ?? 0} ${t("landing.att.daysUsed")}${b.pendingDays ? ` · ${b.pendingDays} ${t("landing.att.pending")}` : ""}`}
            />
          ))
        )}
      </ProfileSection>

      <Card data-testid="att-recent">
        <CardHeader><CardTitle>{t("landing.att.recentTitle")}</CardTitle></CardHeader>
        <CardContent>
          {d.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("landing.att.none")}</p>
          ) : (
            <ul className="divide-y divide-border text-sm" data-testid="att-recent-list">
              {d.recent.map((a, i) => (
                <li key={`att-${i}`} className="flex items-center justify-between gap-4 py-2">
                  <span className="text-foreground">{fmtDate(a.date)}</span>
                  <span className="text-muted-foreground">{a.clockIn ?? "—"}–{a.clockOut ?? "—"}</span>
                  <span className="text-muted-foreground">{a.hoursTotal != null ? `${a.hoursTotal}h` : "—"}</span>
                  <span className="text-xs text-muted-foreground">{a.status ?? ""}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {d.overtime.length > 0 && (
        <Card data-testid="att-overtime">
          <CardHeader><CardTitle>{t("landing.att.overtimeTitle")}</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {d.overtime.map((o, i) => (
                <li key={`ot-${i}`} className="flex items-center justify-between gap-4 py-2">
                  <span className="text-foreground">{fmtDate(o.date)}</span>
                  <span className="text-muted-foreground">{o.type ?? "—"}</span>
                  <span className="text-muted-foreground">{o.hours != null ? `${o.hours}h` : "—"}</span>
                  <span className="text-xs text-muted-foreground">{o.status ?? ""}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
