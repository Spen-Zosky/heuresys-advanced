"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../../../lib/api/fetch";
import { useEnumLabel } from "@/lib/enum-labels";
import { fmtDate } from "./field";

interface MeDoc {
  userDocumentId: string;
  kind: string;
  title: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

/** Documenti — personal documents from /v1/me/documents (existing endpoint), lazy on tab open. */
export function DocumentsTab() {
  const { t } = useTranslation("ess");
  const enumLabel = useEnumLabel();
  const q = useQuery({
    queryKey: ["me", "documents", "profileTab"],
    queryFn: () => apiFetch<{ items: MeDoc[]; total: number }>("/v1/me/documents"),
  });

  if (q.isLoading) {
    return <span className="text-sm text-muted-foreground" data-testid="profile-documents-loading">{t("common:loading")}</span>;
  }
  if (q.isError || !q.data) {
    return <p className="text-sm text-danger" data-testid="profile-documents-error">{t("profile.full.error")}</p>;
  }
  const items = q.data.items;

  return (
    <Card data-testid="profile-documents">
      <CardHeader><CardTitle>{t("profile.full.documentsTab.title")}</CardTitle></CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="profile-documents-empty">
            {t("profile.full.documentsTab.none")}
          </p>
        ) : (
          <ul className="divide-y divide-border" data-testid="profile-documents-list">
            {items.map((d) => (
              <li key={d.userDocumentId} className="flex items-center justify-between gap-4 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{d.title}</p>
                  <p className="text-xs text-muted-foreground">{enumLabel("documentKind", d.kind)}{d.mimeType ? ` · ${d.mimeType}` : ""}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {fmtDate(d.createdAt ? d.createdAt.slice(0, 10) : null)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
