import Link from "next/link";
import {
  DashboardFooter,
  DashboardHeader,
  DashboardShell,
  DashboardSidebar,
  HeuresysLogoBadge,
  HeuresysMark,
  HeuresysWordmark,
} from "@heuresys/ui";
import { BookOpen, Briefcase, Layers, Users } from "lucide-react";

export const metadata = { title: "Showcase / Primary initial page — Heuresys" };

const ICON_CLS = "h-4 w-4 shrink-0";

const QUICK_KPIS = [
  { label: "Your open tasks", value: "3", tone: "warning" as const },
  { label: "Pending approvals (you)", value: "1", tone: "destructive" as const },
  { label: "Direct reports active", value: "8", tone: "neutral" as const },
  { label: "Open positions in your unit", value: "2", tone: "primary" as const },
];

const QUICK_ACTIONS = [
  { title: "Self-assess a skill", desc: "Update your proficiency on one of your position skills", icon: <BookOpen className="h-5 w-5 text-primary" /> },
  { title: "Review a direct report", desc: "Open the 2026 H1 review for your team", icon: <Users className="h-5 w-5 text-primary" /> },
  { title: "Submit career target", desc: "Pick a target position for the next 18 months", icon: <Briefcase className="h-5 w-5 text-primary" /> },
  { title: "Upload certification", desc: "Add a new certificate to your profile", icon: <Layers className="h-5 w-5 text-primary" /> },
];

type ActivityTag = "Learning" | "Skills" | "Career" | "Certifications";

const ACTIVITY: ReadonlyArray<{ who: string; action: string; when: string; tag: ActivityTag }> = [
  { who: "Anna Bianchi", action: "completed 'GDPR Foundations'", when: "10 min ago", tag: "Learning" },
  { who: "Marco Conti", action: "submitted skill self-assessment (Risk modelling)", when: "1 h ago", tag: "Skills" },
  { who: "Sofia Greco", action: "applied to position 'Senior Quant Researcher'", when: "2 h ago", tag: "Career" },
  { who: "Luca Romano", action: "marked AML training complete", when: "Yesterday", tag: "Learning" },
  { who: "Davide Marini", action: "uploaded GCP Professional Data Engineer certification", when: "Yesterday", tag: "Certifications" },
];

const TAG_CLASS: Record<ActivityTag, string> = {
  Learning: "bg-info/10 text-info",
  Skills: "bg-primary/10 text-primary",
  Career: "bg-success/10 text-success",
  Certifications: "bg-warning/10 text-warning",
};

const SIDEBAR_GROUPS = [
  {
    id: "me",
    label: "Me",
    items: [
      { id: "home", label: "Home", href: "#", active: true, icon: <Users className={ICON_CLS} /> },
      { id: "skills", label: "My skills", href: "#", icon: <Layers className={ICON_CLS} />, aux: <span className="rounded-full bg-warning/15 px-1.5 py-0.5 font-mono text-[10px] font-medium text-warning">3</span> },
      { id: "career", label: "My career", href: "#", icon: <Briefcase className={ICON_CLS} /> },
      { id: "learning", label: "Learning", href: "#", icon: <BookOpen className={ICON_CLS} /> },
    ],
  },
  {
    id: "team",
    label: "Team",
    items: [
      { id: "reports", label: "Direct reports", href: "#", icon: <Users className={ICON_CLS} /> },
      { id: "open-positions", label: "Open positions", href: "#", icon: <Briefcase className={ICON_CLS} />, aux: <span className="font-mono text-[10px] text-muted-foreground">2</span> },
    ],
  },
];

function QuickKpiCard({ label, value, tone }: { label: string; value: string; tone: "primary" | "destructive" | "warning" | "neutral" }) {
  const cls =
    tone === "destructive" ? "text-destructive" :
    tone === "warning" ? "text-warning" :
    tone === "primary" ? "text-primary" : "text-foreground";
  return (
    <div className="bg-card p-5">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${cls}`}>{value}</p>
    </div>
  );
}

export default function PrimaryInitialPageShowcase() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Showcase</p>
        <h1 className="text-3xl font-semibold tracking-tight">Primary authenticated initial page</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Per ADR-0011 ESS, this is the post-login landing — distinct from role-specific dashboards
          (executive / manager / employee). Rendered <em>inside</em> the canonical{" "}
          <code>DashboardShell</code> from <code>@heuresys/ui</code>: welcome strip + quick KPIs +
          quick actions + recent team activity, all token-driven so palette + theme switches in the
          showcase header propagate down. Bundle page type per{" "}
          <code>docs/12_page_types_to_design.md</code>.
        </p>
        <p className="text-xs text-muted-foreground">
          <Link href="/showcase" className="underline">back to index</Link>
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Live primary initial page (inside DashboardShell)</h2>
        <div className="relative h-[760px] overflow-hidden rounded-xl border border-border shadow-sm">
          <DashboardShell
            className="!h-full"
            header={
              <DashboardHeader
                breadcrumb={[{ label: "Home" }]}
                user={{ initials: "ES", username: "enzo.spenuso", role: "USER", roleTone: "info" }}
                language="IT"
                logo={<HeuresysWordmark variant="brand" size={24} />}
                logoBadge={<HeuresysLogoBadge>advanced</HeuresysLogoBadge>}
              />
            }
            sidebar={<DashboardSidebar groups={SIDEBAR_GROUPS} />}
            footer={
              <DashboardFooter
                rightSlot={
                  <>
                    <span>v5.0.0-mvp3</span>
                    <span aria-hidden="true" className="text-border">·</span>
                    <span>RTL_BANK_REFERENCE</span>
                    <span aria-hidden="true" className="text-border">·</span>
                    <span>↻ refreshed 14:02</span>
                  </>
                }
              />
            }
          >
            <div className="space-y-5">
              <section className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex items-center gap-5 bg-info/5 px-8 py-7">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-card shadow-sm">
                    <HeuresysMark size={40} />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Buongiorno · martedì 19 maggio 2026
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-tight">Bentornato, Enzo.</h2>
                    <p className="mt-1 text-sm text-card-foreground">
                      Hai <strong>3 task aperti</strong> e <strong>1 approvazione</strong> in attesa. Il tuo
                      tenant <code>RTL_BANK_REFERENCE</code> è stato sincronizzato 14 min fa.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-px bg-muted lg:grid-cols-4">
                  {QUICK_KPIS.map((k) => (
                    <QuickKpiCard key={k.label} label={k.label} value={k.value} tone={k.tone} />
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-base font-semibold tracking-tight">Quick actions</h3>
                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                  {QUICK_ACTIONS.map((a) => (
                    <li key={a.title}>
                      <button className="w-full hx-card-hover rounded-xl border border-border bg-card p-5 text-left transition hover:border-primary hover:shadow">
                        {a.icon}
                        <p className="mt-2 text-sm font-semibold tracking-tight">{a.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{a.desc}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
                <div className="hx-card-hover rounded-xl border border-border bg-card p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-base font-semibold tracking-tight">Team activity</h3>
                    <a href="#" className="text-xs text-primary hover:underline">View all →</a>
                  </div>
                  <ul className="divide-y divide-border">
                    {ACTIVITY.map((a, i) => (
                      <li key={i} className="flex items-start gap-3 py-3 text-sm">
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-card-foreground">
                          {a.who.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                        </span>
                        <span className="flex-1">
                          <span className="font-medium text-foreground">{a.who}</span>{" "}
                          <span className="text-card-foreground">{a.action}</span>
                          <span className="block text-[11px] text-muted-foreground">{a.when}</span>
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TAG_CLASS[a.tag]}`}>{a.tag}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <aside className="hx-card-hover rounded-xl border border-border bg-card p-5">
                  <h3 className="text-base font-semibold tracking-tight">Heuresys today</h3>
                  <ul className="mt-3 space-y-2 text-sm">
                    <li className="flex justify-between"><span className="text-card-foreground">Tenant</span><span className="font-mono text-xs">RTL_BANK_REFERENCE</span></li>
                    <li className="flex justify-between"><span className="text-card-foreground">Active positions</span><span className="tabular-nums">1,284</span></li>
                    <li className="flex justify-between"><span className="text-card-foreground">Skill gaps</span><span className="tabular-nums">342</span></li>
                    <li className="flex justify-between"><span className="text-card-foreground">Learning YTD</span><span className="tabular-nums">5,917</span></li>
                    <li className="flex justify-between"><span className="text-card-foreground">Last refresh</span><span className="text-xs text-muted-foreground">14:02</span></li>
                  </ul>
                  <p className="mt-4 rounded-lg bg-info/10 p-3 text-xs text-info">
                    Distinto da <code>/dashboard</code> role-specific: questa è la <em>primary initial page</em>,
                    atterraggio post-login per <strong>tutti</strong> i ruoli. Le dashboard role-specific si
                    raggiungono dalla sidebar.
                  </p>
                </aside>
              </section>
            </div>
          </DashboardShell>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold tracking-tight">Activity tag taxonomy</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="pb-2">Tag</th>
              <th className="pb-2">Token</th>
              <th className="pb-2">Source event</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-card-foreground">
            <tr><td className="py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TAG_CLASS["Learning"]}`}>Learning</span></td><td className="font-mono text-xs">--color-info</td><td>Course completion, certification training</td></tr>
            <tr><td className="py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TAG_CLASS["Skills"]}`}>Skills</span></td><td className="font-mono text-xs">--color-primary</td><td>Self-assessment, peer endorsement</td></tr>
            <tr><td className="py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TAG_CLASS["Career"]}`}>Career</span></td><td className="font-mono text-xs">--color-success</td><td>Career target submission, succession application</td></tr>
            <tr><td className="py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TAG_CLASS["Certifications"]}`}>Certifications</span></td><td className="font-mono text-xs">--color-warning</td><td>Certificate upload, expiry warning</td></tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
