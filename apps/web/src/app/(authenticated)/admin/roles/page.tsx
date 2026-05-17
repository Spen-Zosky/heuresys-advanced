"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../../lib/api/fetch";

interface RolePermItem {
  roleCode: string;
  permissionCode: string;
  permissionResource: string;
  permissionAction: string;
}

export default function AdminRolesPage() {
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

  return (
    <main data-testid="admin-roles-page" className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold" data-testid="admin-roles-title">
          Ruoli × Permessi
        </h1>
        <p className="text-sm opacity-70" data-testid="admin-roles-count">
          {rp.data
            ? `${roles.length} ruoli, ${perms.length} permessi, ${rp.data.total} mapping`
            : "Caricamento…"}
        </p>
        <p className="text-xs opacity-60 mt-1">
          Matrice sola lettura — la modifica live di permessi e ruoli arriverà in MVP-3.
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle>Matrice</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {rp.isLoading ? (
            <div className="p-6 opacity-60">Caricamento…</div>
          ) : rp.isError ? (
            <div className="p-6 text-red-600" data-testid="admin-roles-error">
              Accesso negato (richiede PLATFORM_ADMIN).
            </div>
          ) : (
            <table className="min-w-full text-xs" data-testid="admin-roles-table">
              <thead>
                <tr className="text-left border-b sticky top-0 bg-white">
                  <th className="px-3 py-2 font-mono">permission \ role</th>
                  {roles.map((r) => (
                    <th key={r} className="px-3 py-2" data-testid="admin-roles-role-col">{r}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {perms.map((p) => (
                  <tr key={p} className="border-b last:border-b-0 hover:bg-gray-50" data-testid="admin-roles-perm-row">
                    <td className="px-3 py-1 font-mono whitespace-nowrap">{p}</td>
                    {roles.map((r) => {
                      const has = matrix.get(r)?.has(p) ?? false;
                      return (
                        <td
                          key={r}
                          className={`px-3 py-1 text-center ${has ? "" : "opacity-30"}`}
                          data-testid={`admin-roles-cell-${r}-${p}`}
                        >
                          {has ? "✓" : "·"}
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
