"use client";

import Link from "next/link";
import { StatusIcon, type StatusTone } from "@heuresys/ui";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Briefcase,
  CheckCircle,
  Clock,
  Info,
  Layers,
  Settings,
  Users,
  XCircle,
} from "lucide-react";

// metadata export is not allowed in client components; the title is set by
// the parent showcase layout. Keeping the constant inline as documentation:
// page-title = "Showcase / Icons — Heuresys"

type ToneRow = {
  tone: StatusTone;
  label: string;
  example: string;
};

const TONES: ToneRow[] = [
  { tone: "neutral", label: "Neutral", example: "Navigation, decorative" },
  { tone: "info", label: "Info", example: "Tooltip, in-progress task" },
  { tone: "success", label: "Success", example: "Skill validated, certification active" },
  { tone: "warning", label: "Warning", example: "Certification expiring, learning overdue" },
  { tone: "danger", label: "Danger", example: "Critical skill gap, compliance breach" },
  { tone: "disabled", label: "Disabled", example: "Deprecated module, inactive position" },
];

const TONE_SWATCH_CLASS: Record<StatusTone, string> = {
  neutral: "bg-muted-foreground",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  disabled: "bg-muted-foreground/40",
};

const STATUS_ICONS = [
  { name: "CheckCircle", icon: CheckCircle },
  { name: "AlertTriangle", icon: AlertTriangle },
  { name: "XCircle", icon: XCircle },
  { name: "Info", icon: Info },
  { name: "Clock", icon: Clock },
] as const;

const NAV_ICONS = [
  { name: "Users", icon: Users },
  { name: "Briefcase", icon: Briefcase },
  { name: "Layers", icon: Layers },
  { name: "BarChart3", icon: BarChart3 },
  { name: "BookOpen", icon: BookOpen },
  { name: "Settings", icon: Settings },
] as const;

export default function IconsShowcasePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">UXIX-0008 · Accepted</p>
        <h1 className="text-3xl font-semibold tracking-tight">Icons — Lucide + StatusIcon</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Lucide React outline (1.75 stroke, <code>currentColor</code>) imported direct from{" "}
          <code>lucide-react</code>. <code>StatusIcon</code> from <code>@heuresys/ui</code> wraps any
          lucide component with a discriminated <code>tone</code> prop that maps to semantic tokens
          (<code>--muted-foreground</code>, <code>--info</code>, <code>--success</code>,{" "}
          <code>--warning</code>, <code>--danger</code>). Navigation icons stay neutral; status
          icons take semantic color. Per bundle <code>docs/10_graphic_assets_and_icon_system.md</code>{" "}
          + ADR-0008 (icons = lucide) + ADR-0013 R2 (portability invariant).
        </p>
        <p className="text-xs text-muted-foreground">
          Source of truth: <code>lucide-react</code> + <code>@heuresys/ui/StatusIcon</code> ·{" "}
          <Link href="/showcase" className="underline">back to index</Link>
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">StatusIcon tones × icon set</h2>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2">Tone</th>
                <th className="px-3 py-2">Use</th>
                {STATUS_ICONS.map((i) => (
                  <th key={i.name} className="px-3 py-2 text-center font-normal">{i.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {TONES.map((t) => (
                <tr key={t.tone}>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-2">
                      <span className={`inline-block h-3 w-3 rounded-full ${TONE_SWATCH_CLASS[t.tone]}`} />
                      <span className="text-sm font-medium">{t.label}</span>
                    </span>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{t.tone}</p>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{t.example}</td>
                  {STATUS_ICONS.map((i) => (
                    <td key={i.name} className="px-3 py-3 text-center">
                      <span className="inline-flex"><StatusIcon icon={i.icon} tone={t.tone} /></span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Navigation icon set — neutral</h2>
        <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
          {NAV_ICONS.map((i) => {
            const Icon = i.icon;
            return (
              <div key={i.name} className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4">
                <Icon size={24} className="text-muted-foreground" />
                <span className="text-xs text-card-foreground">{i.name}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold tracking-tight">Usage</h2>
        <pre className="mt-3 overflow-x-auto rounded bg-muted p-3 text-xs">
{`import { StatusIcon } from "@heuresys/ui";
import { CheckCircle } from "lucide-react";

<StatusIcon icon={CheckCircle} tone="success" />
// renders the lucide CheckCircle with text-success token applied`}
        </pre>
        <p className="mt-3 text-sm text-card-foreground">
          For pure decorative icons (sidebar nav, button glyphs), import lucide directly and apply
          a Tailwind class like <code>text-muted-foreground</code> or omit color to inherit{" "}
          <code>currentColor</code>. Use <code>StatusIcon</code> only when the tone carries
          semantic meaning (status, alert, validation).
        </p>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold tracking-tight">Decision rule</h2>
        <ul className="mt-2 space-y-1 text-sm text-card-foreground">
          <li>Navigation icons → always <code>neutral</code> (text-muted-foreground) or inherit currentColor</li>
          <li>Action icons → neutral, unless destructive (danger) or primary CTA (info)</li>
          <li>Status icons → semantic tone via <code>&lt;StatusIcon tone=… /&gt;</code>, never decorative</li>
          <li>Alert / notification icons → semantic tone</li>
          <li>Decorative icons → <code>disabled</code> tone or omit class</li>
        </ul>
      </section>
    </div>
  );
}
