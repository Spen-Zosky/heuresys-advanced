"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, Card, CardContent, PageHeader } from "@heuresys/ui";
import { StatoCaricamento, StatoErrore } from "@/components/stato-pagina";
import { Check } from "lucide-react";
import { apiFetch } from "../../../../lib/api/fetch";
import { MandateActsQueue } from "./_components/mandate-acts-queue";

interface RolePermItem {
  roleCode: string;
  permissionCode: string;
  permissionResource: string;
  permissionAction: string;
}

/**
 * Repertorio interfacce (blocco B2): ogni riga dice il permesso in parole, «Utenti · leggere»,
 * e il codice tecnico (`user:read`) resta solo nel suggerimento al passaggio del mouse (R4).
 * Le righe sono in ordine alfabetico delle parole, così i permessi di una stessa area stanno insieme.
 */
export default function AdminRolesPage() {
  const { t } = useTranslation("admin");
  const rp = useQuery({
    queryKey: ["auth", "role-permissions"],
    queryFn: () => apiFetch<{ items: RolePermItem[]; total: number }>("/v1/auth/role-permissions"),
  });

  const { roles, perms, matrix } = useMemo(() => {
    const rolesSet = new Set<string>();
    const permsMap = new Map<string, { label: string }>();
    const mat = new Map<string, Set<string>>(); // role → set of perms
    for (const r of rp.data?.items ?? []) {
      rolesSet.add(r.roleCode);
      if (!permsMap.has(r.permissionCode)) {
        const area = t(`roles.resources.${r.permissionResource}`, { defaultValue: r.permissionResource });
        const azione = t(`roles.actions.${r.permissionAction}`, { defaultValue: r.permissionAction });
        permsMap.set(r.permissionCode, { label: `${area} · ${azione}` });
      }
      let s = mat.get(r.roleCode);
      if (!s) { s = new Set<string>(); mat.set(r.roleCode, s); }
      s.add(r.permissionCode);
    }
    return {
      roles: [...rolesSet].sort(),
      perms: [...permsMap.entries()]
        .map(([code, v]) => ({ code, label: v.label }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" })),
      matrix: mat,
    };
  }, [rp.data, t]);

  const countLabel = rp.data
    ? t("roles.count", { roles: roles.length, perms: perms.length, total: rp.data.total })
    : rp.isError ? t("common:stato.nonDisponibile") : t("common:loading");

  return (
    <main data-testid="admin-roles-page" className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title={t("roles.title")}
        description={t("roles.description")}
        badges={
          <Badge variant="secondary" data-testid="admin-roles-count">
            {countLabel}
          </Badge>
        }
      />

      {/* ADR-0050 D4: gli atti di mandato da decidere stanno sopra la matrice, perché aspettano qualcuno. */}
      <MandateActsQueue />

      <Card>
        {/* tabIndex/role: the matrix is a wide scrollable region whose content
            (text + decorative icons) has nothing focusable — without these,
            keyboard users cannot scroll it (axe scrollable-region-focusable). */}
        <CardContent
          className="p-0 overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label={t("roles.title")}
        >
          {rp.isLoading ? (
            <div className="p-6">
              <StatoCaricamento />
            </div>
          ) : rp.isError ? (
            <div className="p-6">
              <StatoErrore
                errore={rp.error}
                motivoNegato={t("roles.accessDeniedDesc")}
                testId="admin-roles-error"
                onRiprova={() => void rp.refetch()}
              />
            </div>
          ) : (
            <table className="min-w-full border-collapse text-xs" data-testid="admin-roles-table">
              <thead>
                <tr className="sticky top-0 border-b border-border bg-card text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">{t("roles.headerCell")}</th>
                  {roles.map((r) => (
                    <th
                      key={r}
                      className="px-3 py-2 text-center font-medium text-foreground"
                      data-testid="admin-roles-role-col"
                      title={r}
                    >
                      {t(`shell:roles.${r}`, { defaultValue: r })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {perms.map(({ code: p, label }) => (
                  <tr
                    key={p}
                    className="border-b border-border last:border-b-0 transition-colors hover:bg-muted/50"
                    data-testid="admin-roles-perm-row"
                  >
                    <td className="px-3 py-1.5 whitespace-nowrap text-foreground" title={p} data-testid="admin-roles-perm-label">
                      {label}
                    </td>
                    {roles.map((r) => {
                      const has = matrix.get(r)?.has(p) ?? false;
                      return (
                        <td
                          key={r}
                          className="px-3 py-1.5 text-center"
                          data-testid={`admin-roles-cell-${r}-${p}`}
                        >
                          {has ? (
                            <Check
                              className="mx-auto h-3.5 w-3.5 text-green-600"
                              aria-label={t("roles.granted")}
                            />
                          ) : (
                            <span className="text-muted-foreground/40" aria-label={t("roles.denied")}>·</span>
                          )}
                        </td>
                      );
                    })}
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
