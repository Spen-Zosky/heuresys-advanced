"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, Card, CardContent, ErrorState, PageHeader, Spinner } from "@heuresys/ui";
import { Check } from "lucide-react";
import { apiFetch } from "../../../../lib/api/fetch";

interface RolePermItem {
  roleCode: string;
  permissionCode: string;
  permissionResource: string;
  permissionAction: string;
}

export default function AdminRolesPage() {
  const { t } = useTranslation("admin");
  const rp = useQuery({
    queryKey: ["auth", "role-permissions"],
    queryFn: () => apiFetch<{ items: RolePermItem[]; total: number }>("/v1/auth/role-permissions"),
  });

  const { roles, perms, matrix } = useMemo(() => {
    const rolesSet = new Set<string>();
    const permsSet = new Set<string>();
    const mat = new Map<string, Set<string>>(); // role → set of perms
    for (const r of rp.data?.items ?? []) {
      rolesSet.add(r.roleCode);
      permsSet.add(r.permissionCode);
      let s = mat.get(r.roleCode);
      if (!s) { s = new Set<string>(); mat.set(r.roleCode, s); }
      s.add(r.permissionCode);
    }
    return {
      roles: [...rolesSet].sort(),
      perms: [...permsSet].sort(),
      matrix: mat,
    };
  }, [rp.data]);

  const countLabel = rp.data
    ? t("roles.count", { roles: roles.length, perms: perms.length, total: rp.data.total })
    : t("common:loading");

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

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {rp.isLoading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Spinner /> {t("common:loading")}
            </div>
          ) : rp.isError ? (
            <div className="p-6" data-testid="admin-roles-error">
              <ErrorState
                title={t("roles.accessDeniedTitle")}
                description={t("roles.accessDeniedDesc")}
                retry={() => void rp.refetch()}
              />
            </div>
          ) : (
            <table className="min-w-full border-collapse text-xs" data-testid="admin-roles-table">
              <thead>
                <tr className="sticky top-0 border-b border-border bg-card text-left text-muted-foreground">
                  <th className="px-3 py-2 font-mono font-medium">{t("roles.headerCell")}</th>
                  {roles.map((r) => (
                    <th
                      key={r}
                      className="px-3 py-2 text-center font-medium text-foreground"
                      data-testid="admin-roles-role-col"
                    >
                      {r}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {perms.map((p) => (
                  <tr
                    key={p}
                    className="border-b border-border last:border-b-0 transition-colors hover:bg-muted/50"
                    data-testid="admin-roles-perm-row"
                  >
                    <td className="px-3 py-1.5 font-mono whitespace-nowrap text-foreground">{p}</td>
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
