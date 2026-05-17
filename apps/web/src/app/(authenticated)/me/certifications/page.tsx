"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../../lib/api/fetch";

interface MeCertification {
  userCertificationId: string;
  name: string;
  issuer: string;
  issuedDate: string | null;
  expiresDate: string | null;
  credentialId: string | null;
  documentUri: string | null;
}

export default function MeCertificationsPage() {
  const certs = useQuery({
    queryKey: ["me", "certifications"],
    queryFn: () => apiFetch<{ items: MeCertification[]; total: number }>("/v1/me/certifications"),
  });

  return (
    <main data-testid="me-certifications-page" className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold" data-testid="me-certifications-title">
          Le mie certificazioni
        </h1>
        <p className="text-sm opacity-70" data-testid="me-certifications-count">
          {certs.data ? `${certs.data.total} certificazioni` : "Caricamento…"}
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle>Elenco</CardTitle></CardHeader>
        <CardContent className="p-0">
          {certs.isLoading ? (
            <div className="p-6 opacity-60">Caricamento…</div>
          ) : certs.data && certs.data.items.length === 0 ? (
            <div className="p-6 opacity-60" data-testid="me-certifications-empty">
              Nessuna certificazione caricata.
            </div>
          ) : (
            <table className="w-full text-sm" data-testid="me-certifications-table">
              <thead>
                <tr className="text-left border-b">
                  <th className="px-4 py-2">Nome</th>
                  <th className="px-4 py-2">Ente</th>
                  <th className="px-4 py-2">Rilasciato</th>
                  <th className="px-4 py-2">Scadenza</th>
                  <th className="px-4 py-2">Credential ID</th>
                </tr>
              </thead>
              <tbody>
                {certs.data!.items.map((c) => (
                  <tr key={c.userCertificationId} className="border-b last:border-b-0" data-testid="me-certification-row">
                    <td className="px-4 py-2">{c.name}</td>
                    <td className="px-4 py-2">{c.issuer}</td>
                    <td className="px-4 py-2 text-xs">{c.issuedDate ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{c.expiresDate ?? "—"}</td>
                    <td className="px-4 py-2 font-mono text-xs">{c.credentialId ?? "—"}</td>
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
