"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../../lib/api/fetch";

interface MeDocument {
  userDocumentId: string;
  kind: string;
  title: string;
  uri: string;
  mimeType: string | null;
  sizeBytes: number | null;
}

export default function MeDocumentsPage() {
  const docs = useQuery({
    queryKey: ["me", "documents"],
    queryFn: () => apiFetch<{ items: MeDocument[]; total: number }>("/v1/me/documents"),
  });

  return (
    <main data-testid="me-documents-page" className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold" data-testid="me-documents-title">I miei documenti</h1>
        <p className="text-sm opacity-70" data-testid="me-documents-count">
          {docs.data ? `${docs.data.total} documenti` : "Caricamento…"}
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle>Elenco</CardTitle></CardHeader>
        <CardContent className="p-0">
          {docs.isLoading ? (
            <div className="p-6 opacity-60">Caricamento…</div>
          ) : docs.data && docs.data.items.length === 0 ? (
            <div className="p-6 opacity-60" data-testid="me-documents-empty">
              Nessun documento caricato.
            </div>
          ) : (
            <table className="w-full text-sm" data-testid="me-documents-table">
              <thead>
                <tr className="text-left border-b">
                  <th className="px-4 py-2">Tipo</th>
                  <th className="px-4 py-2">Titolo</th>
                  <th className="px-4 py-2">URI</th>
                </tr>
              </thead>
              <tbody>
                {docs.data!.items.map((d) => (
                  <tr key={d.userDocumentId} className="border-b last:border-b-0" data-testid="me-document-row">
                    <td className="px-4 py-2 text-xs uppercase">{d.kind}</td>
                    <td className="px-4 py-2">{d.title}</td>
                    <td className="px-4 py-2 text-xs font-mono break-all">{d.uri}</td>
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
