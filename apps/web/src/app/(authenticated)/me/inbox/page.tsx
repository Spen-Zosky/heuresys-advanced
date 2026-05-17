"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../../lib/api/fetch";

interface MeNotification {
  notificationId: string;
  type: string;
  subject: string;
  body: string | null;
  status: string;
  priority: string;
  createdAt: string;
}

export default function MeInboxPage() {
  const inbox = useQuery({
    queryKey: ["me", "inbox"],
    queryFn: () => apiFetch<{ items: MeNotification[]; total: number }>("/v1/me/inbox"),
  });

  return (
    <main data-testid="me-inbox-page" className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold" data-testid="me-inbox-title">Inbox</h1>
        <p className="text-sm opacity-70" data-testid="me-inbox-count">
          {inbox.data ? `${inbox.data.total} notifiche` : "Caricamento…"}
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle>Notifiche</CardTitle></CardHeader>
        <CardContent className="p-0">
          {inbox.isLoading ? (
            <div className="p-6 opacity-60">Caricamento…</div>
          ) : inbox.data && inbox.data.items.length === 0 ? (
            <div className="p-6 opacity-60" data-testid="me-inbox-empty">Nessuna notifica.</div>
          ) : (
            <ul className="divide-y" data-testid="me-inbox-list">
              {inbox.data!.items.map((n) => (
                <li key={n.notificationId} className="px-4 py-3" data-testid="me-inbox-item">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-medium">{n.subject}</span>
                    <span className="text-xs uppercase opacity-70">{n.priority} · {n.status}</span>
                  </div>
                  {n.body && <p className="text-sm mt-1">{n.body}</p>}
                  <p className="text-xs opacity-60 mt-1">{n.createdAt}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
