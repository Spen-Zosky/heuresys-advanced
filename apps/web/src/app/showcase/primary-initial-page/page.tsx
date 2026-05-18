import Link from "next/link";
import { LogoCandidateASymbol } from "@heuresys/ui/brand/candidates";

export const metadata = { title: "Showcase / Primary initial page — Heuresys" };

const QUICK_KPIS = [
  { label: "Your open tasks", value: "3", color: "amber" },
  { label: "Pending approvals (you)", value: "1", color: "red" },
  { label: "Direct reports active", value: "8", color: "neutral" },
  { label: "Open positions in your unit", value: "2", color: "blue" },
];

const QUICK_ACTIONS = [
  { title: "Self-assess a skill", desc: "Update your proficiency on one of your position skills", icon: "📚" },
  { title: "Review a direct report", desc: "Open the 2026 H1 review for your team", icon: "✓" },
  { title: "Submit career target", desc: "Pick a target position for the next 18 months", icon: "→" },
  { title: "Upload certification", desc: "Add a new certificate to your profile", icon: "🎓" },
];

const ACTIVITY = [
  { who: "Anna Bianchi", action: "completed 'GDPR Foundations'", when: "10 min ago", tag: "Learning" },
  { who: "Marco Conti", action: "submitted skill self-assessment (Risk modelling)", when: "1 h ago", tag: "Skills" },
  { who: "Sofia Greco", action: "applied to position 'Senior Quant Researcher'", when: "2 h ago", tag: "Career" },
  { who: "Luca Romano", action: "marked AML training complete", when: "Yesterday", tag: "Learning" },
  { who: "Davide Marini", action: "uploaded GCP Professional Data Engineer certification", when: "Yesterday", tag: "Certifications" },
];

const TAG_CLASS: Record<string, string> = {
  Learning: "bg-purple-100 text-purple-900",
  Skills: "bg-blue-100 text-blue-900",
  Career: "bg-emerald-100 text-emerald-900",
  Certifications: "bg-amber-100 text-amber-900",
};

export default function PrimaryInitialPageShowcase() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-neutral-500">Showcase</p>
        <h1 className="text-3xl font-semibold tracking-tight">Primary authenticated initial page</h1>
        <p className="max-w-2xl text-sm text-neutral-600">
          Per ADR-0011 ESS, this is the post-login landing — distinct from role-specific dashboards
          (executive / manager / employee). Welcome strip, personal quick KPIs, quick actions, recent
          team activity. Bundle page type per <code>docs/12_page_types_to_design.md</code>.
        </p>
        <p className="text-xs text-neutral-500">
          <Link href="/showcase" className="underline">back to index</Link>
        </p>
      </header>

      <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="flex items-center gap-5 bg-gradient-to-r from-blue-50 to-purple-50 px-8 py-7">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm">
            <LogoCandidateASymbol className="h-10 w-10 text-blue-700" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-neutral-500">Buongiorno · martedì 19 maggio 2026</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">Bentornato, Enzo.</h2>
            <p className="mt-1 text-sm text-neutral-700">
              Hai <strong>3 task aperti</strong> e <strong>1 approvazione</strong> in attesa. Il tuo
              tenant <code>RTL_BANK_REFERENCE</code> è stato sincronizzato 14 min fa.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px bg-neutral-200 lg:grid-cols-4">
          {QUICK_KPIS.map((k) => (
            <div key={k.label} className="bg-white p-5">
              <p className="text-[11px] uppercase tracking-wider text-neutral-500">{k.label}</p>
              <p className={`mt-1 text-3xl font-semibold tabular-nums ${
                k.color === "red" ? "text-red-700" : k.color === "amber" ? "text-amber-700" : k.color === "blue" ? "text-blue-700" : "text-neutral-900"
              }`}>{k.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Quick actions</h2>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {QUICK_ACTIONS.map((a) => (
            <li key={a.title}>
              <button className="w-full rounded-xl border border-neutral-200 bg-white p-5 text-left transition hover:border-blue-400 hover:shadow">
                <span aria-hidden className="text-2xl">{a.icon}</span>
                <p className="mt-2 text-sm font-semibold tracking-tight">{a.title}</p>
                <p className="mt-1 text-xs text-neutral-600">{a.desc}</p>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight">Team activity</h2>
            <a href="#" className="text-xs text-blue-700 hover:underline">View all →</a>
          </div>
          <ul className="divide-y divide-neutral-100">
            {ACTIVITY.map((a, i) => (
              <li key={i} className="flex items-start gap-3 py-3 text-sm">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-700">
                  {a.who.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                </span>
                <span className="flex-1">
                  <span className="font-medium text-neutral-900">{a.who}</span>{" "}
                  <span className="text-neutral-700">{a.action}</span>
                  <span className="block text-[11px] text-neutral-500">{a.when}</span>
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TAG_CLASS[a.tag] ?? "bg-neutral-100 text-neutral-700"}`}>
                  {a.tag}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <aside className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-base font-semibold tracking-tight">Heuresys today</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex justify-between"><span className="text-neutral-700">Tenant</span><span className="font-mono text-xs">RTL_BANK_REFERENCE</span></li>
            <li className="flex justify-between"><span className="text-neutral-700">Active positions</span><span className="tabular-nums">1,284</span></li>
            <li className="flex justify-between"><span className="text-neutral-700">Skill gaps</span><span className="tabular-nums">342</span></li>
            <li className="flex justify-between"><span className="text-neutral-700">Learning YTD</span><span className="tabular-nums">5,917</span></li>
            <li className="flex justify-between"><span className="text-neutral-700">Last refresh</span><span className="text-xs text-neutral-500">14:02</span></li>
          </ul>
          <p className="mt-4 rounded-lg bg-blue-50 p-3 text-xs text-blue-900">
            Distinto da <code>/dashboard</code> role-specific: questa è la <em>primary initial page</em>,
            atterraggio post-login per <strong>tutti</strong> i ruoli. Le dashboard role-specific si
            raggiungono dalla sidebar.
          </p>
        </aside>
      </section>
    </div>
  );
}
