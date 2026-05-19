import Link from "next/link";

export const metadata = { title: "Showcase / Icons — Heuresys" };

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "disabled";

const TONES: { tone: Tone; color: string; label: string; example: string }[] = [
  { tone: "neutral", color: "#64748B", label: "Neutral", example: "Navigation, decorative" },
  { tone: "info", color: "#2563EB", label: "Info", example: "Tooltip, in-progress task" },
  { tone: "success", color: "#16A34A", label: "Success", example: "Skill validated, certification active" },
  { tone: "warning", color: "#F59E0B", label: "Warning", example: "Certification expiring, learning overdue" },
  { tone: "danger", color: "#DC2626", label: "Danger", example: "Critical skill gap, compliance breach" },
  { tone: "disabled", color: "#CBD5E1", label: "Disabled", example: "Deprecated module, inactive position" },
];

const STATUS_ICONS = [
  { name: "CheckCircle", path: "M9 12l2 2 4-4M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Z" },
  { name: "AlertTriangle", path: "M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" },
  { name: "XCircle", path: "M15 9l-6 6M9 9l6 6M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Z" },
  { name: "Info", path: "M12 16v-4M12 8h.01M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Z" },
  { name: "Clock", path: "M12 6v6l4 2M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Z" },
];

const NAV_ICONS = [
  { name: "Users", path: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
  { name: "Briefcase", path: "M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16M2 13h20M3 7h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" },
  { name: "Layers", path: "M12 2 2 7l10 5 10-5-10-5Z M2 17l10 5 10-5 M2 12l10 5 10-5" },
  { name: "BarChart3", path: "M3 3v18h18 M7 12v5 M11 7v10 M15 9v8 M19 5v12" },
  { name: "BookOpen", path: "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" },
  { name: "Settings", path: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4Z" },
];

function IconSvg({ d, color, size = 20 }: { d: string; color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export default function IconsShowcasePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">UXIX-0008 · Accepted</p>
        <h1 className="text-3xl font-semibold tracking-tight">Icons — outline + semantic tones</h1>
        <p className="max-w-2xl text-sm text-[var(--muted-foreground)]">
          Lucide React outline style (1.75 stroke, currentColor). <code>StatusIcon</code> component
          maps a discriminated tone to semantic token. Navigation icons stay neutral; status icons
          take semantic color. Per bundle <code>docs/10_graphic_assets_and_icon_system.md</code>.
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">
          <Link href="/showcase" className="underline">back to index</Link>
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">StatusIcon tones × icon set</h2>
        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-[var(--muted)] text-left text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
                <th className="px-3 py-2">Tone</th>
                <th className="px-3 py-2">Use</th>
                {STATUS_ICONS.map((i) => (
                  <th key={i.name} className="px-3 py-2 text-center font-normal">{i.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {TONES.map((t) => (
                <tr key={t.tone}>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ background: t.color }} />
                      <span className="text-sm font-medium">{t.label}</span>
                    </span>
                    <p className="mt-0.5 font-mono text-[10px] text-[var(--muted-foreground)]">{t.tone}</p>
                  </td>
                  <td className="px-3 py-3 text-xs text-[var(--muted-foreground)]">{t.example}</td>
                  {STATUS_ICONS.map((i) => (
                    <td key={i.name} className="px-3 py-3 text-center">
                      <span className="inline-flex"><IconSvg d={i.path} color={t.color} /></span>
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
          {NAV_ICONS.map((i) => (
            <div key={i.name} className="flex flex-col items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
              <IconSvg d={i.path} color="#475569" size={24} />
              <span className="text-xs text-[var(--card-foreground)]">{i.name}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="text-base font-semibold tracking-tight">Decision rule</h2>
        <ul className="mt-2 space-y-1 text-sm text-[var(--card-foreground)]">
          <li>Navigation icons → always <code>neutral</code></li>
          <li>Action icons → neutral, unless destructive (danger) or primary CTA (info)</li>
          <li>Status icons → semantic color, never decorative</li>
          <li>Alert / notification icons → semantic color</li>
          <li>Decorative icons → muted (<code>#94A3B8</code>)</li>
        </ul>
      </section>
    </div>
  );
}
