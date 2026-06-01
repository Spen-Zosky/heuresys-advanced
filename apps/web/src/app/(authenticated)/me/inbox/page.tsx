"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AuditFeed,
  type AuditEvent,
  type AuditTone,
  Badge,
  EmptyState,
  PageHeader,
  formatRelativeTime,
} from "@heuresys/ui";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Inbox,
  Info,
} from "lucide-react";
import { apiFetch } from "@/lib/api/fetch";

interface MeNotification {
  notificationId: string;
  type: string;
  subject: string;
  body: string | null;
  status: string;
  priority: string;
  createdAt: string;
}

// Polling cadence — chosen so the inbox feels reactive without hammering the
// API: 30s when the tab is visible (refetchInterval), and refetchOnWindowFocus
// for the immediate refresh when the user returns to the tab. Server-sent
// events / websocket push is a post-MVP-3 enhancement; polling is the safe
// and simple baseline.
const INBOX_POLL_MS = 30_000;

const ICON_CLS = "h-3.5 w-3.5";

/** Derive an AuditFeed icon + tone from the notification's OWN real priority/
 *  status fields (no fabricated severity). Falls back to a neutral-ish "info"
 *  tone when the backend provides nothing recognisable. */
function notificationVisual(n: MeNotification): { icon: AuditEvent["icon"]; tone: AuditTone } {
  const p = n.priority.toUpperCase();
  const s = n.status.toUpperCase();
  if (p === "CRITICAL" || p === "URGENT" || p === "HIGH") {
    return { icon: <AlertTriangle className={ICON_CLS} />, tone: "danger" };
  }
  if (p === "MEDIUM" || p === "NORMAL") {
    return { icon: <Bell className={ICON_CLS} />, tone: "warning" };
  }
  if (s === "READ" || s === "DONE" || s === "ARCHIVED") {
    return { icon: <CheckCircle2 className={ICON_CLS} />, tone: "success" };
  }
  return { icon: <Info className={ICON_CLS} />, tone: "info" };
}

export default function MeInboxPage() {
  const inbox = useQuery({
    queryKey: ["me", "inbox"],
    queryFn: () => apiFetch<{ items: MeNotification[]; total: number }>("/v1/me/inbox"),
    refetchInterval: INBOX_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });

  const unreadCount =
    inbox.data?.items.filter((n) => n.status === "UNREAD" || n.status === "PENDING")
      .length ?? 0;

  const events: AuditEvent[] = (inbox.data?.items ?? []).map((n) => {
    const v = notificationVisual(n);
    return {
      icon: v.icon,
      tone: v.tone,
      title: n.subject,
      description: n.body ?? undefined,
      meta: `${formatRelativeTime(n.createdAt)} · ${n.priority} · ${n.status}`,
    };
  });

  return (
    <main data-testid="me-inbox-page" className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="me-inbox-title"
        title="Inbox"
        description="Le tue notifiche e comunicazioni recenti."
        badges={
          <div className="flex items-center gap-2">
            <Badge variant="secondary" data-testid="me-inbox-count">
              {inbox.data ? `${inbox.data.total} notifiche` : "Caricamento…"}
            </Badge>
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                data-testid="me-inbox-unread-badge"
                aria-label={`${unreadCount} notifiche non lette`}
              >
                {unreadCount} non lette
              </Badge>
            )}
          </div>
        }
      />

      {inbox.isLoading ? (
        <p className="text-sm text-muted-foreground" data-testid="me-inbox-loading">
          Caricamento…
        </p>
      ) : inbox.data && inbox.data.items.length === 0 ? (
        <EmptyState
          data-testid="me-inbox-empty"
          icon={<Inbox className="h-6 w-6" />}
          title="Nessuna notifica"
          description="Non hai notifiche al momento."
        />
      ) : (
        <div data-testid="me-inbox-list">
          <AuditFeed events={events} title="Notifiche" />
        </div>
      )}
    </main>
  );
}
