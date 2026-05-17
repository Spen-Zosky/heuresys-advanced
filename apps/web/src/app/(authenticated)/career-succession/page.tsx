"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../lib/api/fetch";

interface CareerPath {
  careerPathId: string;
  code: string;
  name: string;
  fromJobRoleId: string | null;
  toJobRoleId: string | null;
  difficulty: string | null;
}
interface SuccessionPool {
  successionPoolId: string;
  code: string;
  name: string;
  targetPositionId: string | null;
  status: string;
}
interface SuccessorCandidate {
  successorCandidateId: string;
  successionPoolId: string;
  userId: string;
  readinessLevel: string | null;
  status: string;
}

type Tab = "paths" | "pools" | "candidates";

export default function CareerSuccessionPage() {
  const [tab, setTab] = useState<Tab>("paths");

  const paths = useQuery({
    queryKey: ["career-paths"],
    queryFn: () => apiFetch<{ items: CareerPath[]; total: number }>("/v1/career-paths?limit=200"),
    enabled: tab === "paths",
  });
  const pools = useQuery({
    queryKey: ["succession-pools"],
    queryFn: () =>
      apiFetch<{ items: SuccessionPool[]; total: number }>("/v1/succession-pools?limit=200"),
    enabled: tab === "pools",
  });
  const candidates = useQuery({
    queryKey: ["successor-candidates"],
    queryFn: () =>
      apiFetch<{ items: SuccessorCandidate[]; total: number }>(
        "/v1/successor-candidates?limit=200",
      ),
    enabled: tab === "candidates",
  });

  return (
    <main data-testid="career-page" className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold" data-testid="career-title">Career & Succession</h1>
      </header>

      <nav className="border-b flex gap-4 text-sm" data-testid="career-tabs">
        {(["paths", "pools", "candidates"] as Tab[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            data-testid={`career-tab-${k}`}
            className={`px-3 py-2 ${tab === k ? "border-b-2 border-black font-medium" : "opacity-60"}`}
          >
            {k === "paths" ? "Career paths" : k === "pools" ? "Succession pools" : "Candidati"}
          </button>
        ))}
      </nav>

      {tab === "paths" && (
        <Card data-testid="career-content-paths">
          <CardHeader><CardTitle>Career paths</CardTitle></CardHeader>
          <CardContent className="p-0">
            {paths.isLoading ? (
              <div className="p-6 opacity-60">Caricamento…</div>
            ) : paths.data && paths.data.items.length === 0 ? (
              <div className="p-6 opacity-60" data-testid="career-paths-empty">
                Nessun career path definito.
              </div>
            ) : (
              <table className="w-full text-sm" data-testid="career-paths-table">
                <thead>
                  <tr className="text-left border-b">
                    <th className="px-4 py-2">Codice</th>
                    <th className="px-4 py-2">Nome</th>
                    <th className="px-4 py-2">Difficoltà</th>
                  </tr>
                </thead>
                <tbody>
                  {paths.data!.items.map((p) => (
                    <tr key={p.careerPathId} className="border-b last:border-b-0" data-testid="career-paths-row">
                      <td className="px-4 py-2 font-mono text-xs">{p.code}</td>
                      <td className="px-4 py-2">{p.name}</td>
                      <td className="px-4 py-2 text-xs">{p.difficulty ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "pools" && (
        <Card data-testid="career-content-pools">
          <CardHeader><CardTitle>Succession pools</CardTitle></CardHeader>
          <CardContent className="p-0">
            {pools.isLoading ? (
              <div className="p-6 opacity-60">Caricamento…</div>
            ) : pools.data && pools.data.items.length === 0 ? (
              <div className="p-6 opacity-60" data-testid="career-pools-empty">
                Nessuna pool registrata.
              </div>
            ) : (
              <table className="w-full text-sm" data-testid="career-pools-table">
                <thead>
                  <tr className="text-left border-b">
                    <th className="px-4 py-2">Codice</th>
                    <th className="px-4 py-2">Nome</th>
                    <th className="px-4 py-2">Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {pools.data!.items.map((p) => (
                    <tr key={p.successionPoolId} className="border-b last:border-b-0" data-testid="career-pools-row">
                      <td className="px-4 py-2 font-mono text-xs">{p.code}</td>
                      <td className="px-4 py-2">{p.name}</td>
                      <td className="px-4 py-2 text-xs uppercase">{p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "candidates" && (
        <Card data-testid="career-content-candidates">
          <CardHeader><CardTitle>Candidati alla succession</CardTitle></CardHeader>
          <CardContent className="p-0">
            {candidates.isLoading ? (
              <div className="p-6 opacity-60">Caricamento…</div>
            ) : candidates.data && candidates.data.items.length === 0 ? (
              <div className="p-6 opacity-60" data-testid="career-candidates-empty">
                Nessun candidato registrato.
              </div>
            ) : (
              <table className="w-full text-sm" data-testid="career-candidates-table">
                <thead>
                  <tr className="text-left border-b">
                    <th className="px-4 py-2">User</th>
                    <th className="px-4 py-2">Pool</th>
                    <th className="px-4 py-2">Readiness</th>
                    <th className="px-4 py-2">Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.data!.items.map((c) => (
                    <tr key={c.successorCandidateId} className="border-b last:border-b-0" data-testid="career-candidates-row">
                      <td className="px-4 py-2 font-mono text-xs">{c.userId.slice(0, 8)}</td>
                      <td className="px-4 py-2 font-mono text-xs">{c.successionPoolId.slice(0, 8)}</td>
                      <td className="px-4 py-2 text-xs uppercase">{c.readinessLevel ?? "—"}</td>
                      <td className="px-4 py-2 text-xs uppercase">{c.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
