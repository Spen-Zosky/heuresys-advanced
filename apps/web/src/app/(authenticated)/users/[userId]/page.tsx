"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { FieldGrid } from "@/components/detail-panel";
import { StatusBadge } from "@/components/status-pill";

interface UserDetail {
  userId: string;
  email: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  tenantId: string | null;
  status: string;
  type: string;
  locale: string | null;
  timezone: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export default function UserDetailPage() {
  const { t } = useTranslation("admin");
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const user = useQuery({
    queryKey: ["users", userId],
    queryFn: () => apiFetch<UserDetail>(`/v1/users/${userId}`),
    enabled: !!userId,
  });

  if (user.isLoading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-8">
        <span className="text-sm text-muted-foreground">{t("common:loading")}</span>
      </main>
    );
  }
  if (user.isError) {
    const code = isApiError(user.error) ? user.error.status : 0;
    return (
      <main className="mx-auto max-w-5xl px-6 py-8" data-testid="user-error">
        <Link href="/users" className="text-sm underline">{t("users.detail.back")}</Link>
        <p className="mt-4 text-danger">{code === 404 ? t("users.detail.notFound") : t("users.detail.loadError")}</p>
      </main>
    );
  }
  const u = user.data!;
  return (
    <main data-testid="user-detail-page" className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="user-display-name"
        title={u.displayName ?? t("users.detail.unnamed")}
        breadcrumbs={
          <Link href="/users" data-testid="user-back" className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            {t("users.detail.back")}
          </Link>
        }
        badges={
          <>
            <span data-testid="user-email-detail" className="text-sm text-muted-foreground">{u.email}</span>
            <StatusBadge value={u.status} />
          </>
        }
      />

      <Card>
        <CardHeader><CardTitle>{t("users.detail.cardTitle")}</CardTitle></CardHeader>
        <CardContent>
          <FieldGrid
            testId="user-fields"
            fields={[
              { label: t("users.detail.fields.userId"), value: u.userId, mono: true, testId: "field-userId" },
              { label: t("users.detail.fields.tenantId"), value: u.tenantId ?? t("users.detail.dash"), mono: true },
              { label: t("users.detail.fields.status"), value: <StatusBadge value={u.status} /> },
              { label: t("users.detail.fields.type"), value: u.type },
              { label: t("users.detail.fields.locale"), value: u.locale ?? t("users.detail.dash") },
              { label: t("users.detail.fields.timezone"), value: u.timezone ?? t("users.detail.dash") },
              { label: t("users.detail.fields.createdAt"), value: u.createdAt },
            ]}
          />
        </CardContent>
      </Card>
    </main>
  );
}
