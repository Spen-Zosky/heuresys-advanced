"use client";

/**
 * /users/[id] — la scheda di una persona (#81).
 *
 * Prima mostrava soltanto l'anagrafica tecnica: identificativi grezzi, fuso
 * orario, una data in formato macchina. Nulla dei 36 mesi che il database
 * contiene. I dati c'erano tutti — mancava la scheda che li compone, e questa
 * è la pagina che si apre davanti a un cliente.
 *
 * Ora legge `/v1/users/:id/dossier` (dati sensibili, cancello organizzativo
 * ADR-0027 lato API) e racconta: dove sta nell'organizzazione, con che
 * contratto, quanto guadagna, come è stata valutata, che presenze ha, che sa
 * fare, che formazione ha seguito, che abilitazioni ha e quando scadono, che
 * obiettivi ha, dove vuole arrivare. L'anagrafica tecnica resta, in fondo,
 * per chi la cerca.
 */

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@heuresys/ui";
import type { UserDossier } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { FieldGrid } from "@/components/detail-panel";
import { EnumStatusBadge } from "@/components/enum-badge";
import { useEnumLabel } from "@/lib/enum-labels";

/* --- formattazione: mai una data ISO o un numero nudo davanti a una persona --- */
const fmtDate = (v: string | null | undefined): string =>
  v ? new Date(v).toLocaleDateString() : "—";
const fmtMoney = (v: number | string | null | undefined): string =>
  v === null || v === undefined || v === ""
    ? "—"
    : new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(v));

/** Una sezione della scheda: mostra il conteggio, e sparisce se non ha nulla da dire. */
function Section({
  title, count, children, testId,
}: { title: string; count?: number; children: ReactNode; testId: string }) {
  return (
    <Card data-testid={testId}>
      <CardHeader>
        <CardTitle>
          {title}
          {count !== undefined && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">{count}</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Tabellina compatta: le righe scorrono da sole se la pagina è stretta. */
function MiniTable({ head, rows, empty }: { head: string[]; rows: ReactNode[][]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            {head.map((h) => (
              <th key={h} className="py-2 pr-4 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b last:border-0">
              {r.map((c, j) => (
                <td key={j} className="py-2 pr-4 align-top">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function UserDetailPage() {
  const { t } = useTranslation("admin");
  const enumLabel = useEnumLabel();
  const params = useParams<{ userId: string }>();
  const userId = params.userId;

  const q = useQuery({
    queryKey: ["users", userId, "dossier"],
    queryFn: () => apiFetch<UserDossier>(`/v1/users/${userId}/dossier`),
    enabled: !!userId,
  });

  if (q.isLoading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-8">
        <span className="text-sm text-muted-foreground">{t("common:loading")}</span>
      </main>
    );
  }
  if (q.isError) {
    const code = isApiError(q.error) ? q.error.status : 0;
    return (
      <main className="mx-auto max-w-5xl px-6 py-8" data-testid="user-error">
        <Link href="/users" className="text-sm underline">{t("users.detail.back")}</Link>
        <p className="mt-4 text-danger">
          {code === 404 ? t("users.detail.notFound") : t("users.detail.loadError")}
        </p>
      </main>
    );
  }

  const d = q.data!;
  const p = d.profile;
  // accesso TIPIZZATO, non per nome indovinato: il primo giro usava
  // `orgUnitName` (che non esiste) e la scheda mostrava un trattino al posto
  // dell'unita' organizzativa. Con i tipi, un campo sbagliato non compila.
  const org = p.organization;
  const emp = p.employment;
  const primary = d.positions.find((x) => x.isPrimary) ?? d.positions[0];
  const contract = d.contracts[0];
  const s = (k: string) => t(`users.detail.dossier.${k}`);

  return (
    <main data-testid="user-detail-page" className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="user-display-name"
        title={p.displayName ?? t("users.detail.unnamed")}
        breadcrumbs={
          <Link href="/users" data-testid="user-back" className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            {t("users.detail.back")}
          </Link>
        }
        badges={
          <>
            <span data-testid="user-email-detail" className="text-sm text-muted-foreground">{p.email}</span>
            {primary && <span className="text-sm text-muted-foreground">· {primary.positionTitle}</span>}
          </>
        }
      />

      {/* Chi è, in una riga: il ruolo, l'unità, da quando, con che inquadramento */}
      <Card data-testid="dossier-summary">
        <CardContent className="pt-6">
          <FieldGrid
            testId="dossier-summary-fields"
            fields={[
              { label: s("position"), value: primary?.positionTitle ?? "—", testId: "field-position" },
              { label: s("orgUnit"), value: org.orgUnit ?? org.department ?? "—", testId: "field-orgunit" },
              { label: s("manager"), value: org.managerName ?? "—" },
              { label: s("hiredOn"), value: fmtDate(emp?.hireDate), testId: "field-hired" },
              { label: s("ccnlLevel"), value: contract?.ccnlLevel ?? "—" },
              { label: s("contractType"), value: contract?.type ? enumLabel("contractType", contract.type) : "—" },
            ]}
          />
        </CardContent>
      </Card>

      <Section title={s("positions")} count={d.positions.length} testId="dossier-positions">
        <MiniTable
          head={[s("col.position"), s("col.kind"), s("col.from"), s("col.to"), s("col.status")]}
          empty={s("empty.positions")}
          rows={d.positions.map((x) => [
            x.positionTitle,
            x.isPrimary ? s("primary") : s("secondary"),
            fmtDate(x.startDate),
            fmtDate(x.endDate),
            <EnumStatusBadge key="s" domain="assignmentStatus" value={x.status} />,
          ])}
        />
      </Section>

      <Section title={s("contracts")} count={d.contracts.length} testId="dossier-contracts">
        <MiniTable
          head={[s("col.type"), s("col.level"), s("col.ral"), s("col.hours"), s("col.from"), s("col.status")]}
          empty={s("empty.contracts")}
          rows={d.contracts.map((c, i) => [
            c.type ? enumLabel("contractType", c.type) : "—",
            c.ccnlLevel ?? "—",
            fmtMoney(c.grossAnnualSalary),
            c.workHoursWeekly ?? "—",
            fmtDate(c.startDate),
            <EnumStatusBadge key={i} domain="contractStatus" value={c.status ?? ""} />,
          ])}
        />
      </Section>

      <Section title={s("paySlips")} count={d.paySlips.length} testId="dossier-payslips">
        <MiniTable
          head={[s("col.period"), s("col.gross"), s("col.net"), s("col.paidOn")]}
          empty={s("empty.paySlips")}
          rows={d.paySlips.slice(0, 12).map((x) => [
            x.period,
            fmtMoney(x.grossPay),
            fmtMoney(x.netPay),
            fmtDate(x.paymentDate),
          ])}
        />
        {d.paySlips.length > 12 && (
          <p className="mt-3 text-xs text-muted-foreground">{s("moreRows")}</p>
        )}
      </Section>

      <Section title={s("performance")} count={d.performance.length} testId="dossier-performance">
        <MiniTable
          head={[s("col.period"), s("col.type"), s("col.overall"), s("col.box"), s("col.status")]}
          empty={s("empty.performance")}
          rows={d.performance.map((x, i) => [
            `${fmtDate(x.periodStart)} – ${fmtDate(x.periodEnd)}`,
            x.type ?? "—",
            x.overallRating ?? "—",
            x.performanceBox ?? "—",
            <EnumStatusBadge key={i} domain="reviewStatus" value={x.status ?? ""} />,
          ])}
        />
      </Section>

      <Section title={s("attendance")} count={d.attendance.leaveBalances.length} testId="dossier-attendance">
        <MiniTable
          head={[s("col.leaveType"), s("col.entitled"), s("col.used"), s("col.pending"), s("col.carryover")]}
          empty={s("empty.attendance")}
          rows={d.attendance.leaveBalances.map((b, i) => [
            <span key={i}>{b.leaveType ? enumLabel("leaveType", b.leaveType) : "—"}</span>,
            b.totalDays ?? "—",
            b.usedDays ?? "—",
            b.pendingDays ?? "—",
            b.carryoverDays ?? "—",
          ])}
        />
      </Section>

      <Section title={s("skills")} count={d.skills.length} testId="dossier-skills">
        <MiniTable
          head={[s("col.skill"), s("col.level"), s("col.source"), s("col.assessedOn")]}
          empty={s("empty.skills")}
          rows={d.skills.map((x) => [
            x.skillName,
            x.declaredProficiency,
            x.source,
            fmtDate(x.assessedAt),
          ])}
        />
      </Section>

      <Section title={s("learning")} count={d.learning.length} testId="dossier-learning">
        <MiniTable
          head={[s("col.course"), s("col.mandatory"), s("col.status"), s("col.enrolledOn")]}
          empty={s("empty.learning")}
          rows={d.learning.slice(0, 12).map((x, i) => [
            x.title ?? x.moduleTitle ?? x.pathName ?? "—",
            x.isMandatory ? s("yes") : s("no"),
            <EnumStatusBadge key={i} domain="learningStatus" value={x.status ?? ""} />,
            fmtDate(x.enrolledAt),
          ])}
        />
        {d.learning.length > 12 && (
          <p className="mt-3 text-xs text-muted-foreground">{s("moreRows")}</p>
        )}
      </Section>

      <Section title={s("certifications")} count={d.certifications.length} testId="dossier-certifications">
        <MiniTable
          head={[s("col.certification"), s("col.issuer"), s("col.issuedOn"), s("col.expiresOn")]}
          empty={s("empty.certifications")}
          rows={d.certifications.map((x) => [
            x.name,
            x.issuer,
            fmtDate(x.issuedDate),
            fmtDate(x.expiresDate),
          ])}
        />
      </Section>

      <Section title={s("goals")} count={d.goals.length} testId="dossier-goals">
        <MiniTable
          head={[s("col.goal"), s("col.progress"), s("col.due"), s("col.status")]}
          empty={s("empty.goals")}
          rows={d.goals.slice(0, 12).map((x, i) => [
            x.title,
            x.progressPercent !== null && x.progressPercent !== undefined ? `${x.progressPercent}%` : "—",
            fmtDate(x.dueDate),
            <EnumStatusBadge key={i} domain="goalStatus" value={x.status ?? ""} />,
          ])}
        />
        {d.goals.length > 12 && (
          <p className="mt-3 text-xs text-muted-foreground">{s("moreRows")}</p>
        )}
      </Section>

      <Section title={s("career")} count={d.careerTargets.length} testId="dossier-career">
        <MiniTable
          head={[s("col.target"), s("col.horizon"), s("col.review")]}
          empty={s("empty.career")}
          rows={d.careerTargets.map((x, i) => [
            x.positionId,
            x.horizon ? enumLabel("careerHorizon", x.horizon) : "—",
            <EnumStatusBadge key={i} domain="reviewStatus" value={x.reviewStatus ?? ""} />,
          ])}
        />
      </Section>

      {/* L'anagrafica tecnica resta, ma in fondo: serve a chi la cerca, non è
          il modo di presentare una persona. */}
      <Card data-testid="dossier-technical">
        <CardHeader><CardTitle>{t("users.detail.cardTitle")}</CardTitle></CardHeader>
        <CardContent>
          <FieldGrid
            testId="user-fields"
            fields={[
              { label: t("users.detail.fields.userId"), value: p.userId, mono: true, testId: "field-userId" },
              { label: s("location"), value: org.location ?? "—" },
              { label: s("employeeStatus"), value: emp?.status ?? "—" },
            ]}
          />
        </CardContent>
      </Card>
    </main>
  );
}
