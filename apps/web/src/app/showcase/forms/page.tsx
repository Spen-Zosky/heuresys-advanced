import Link from "next/link";

export const metadata = { title: "Showcase / Forms — Heuresys" };

const SKILL_LEVELS = ["Novice", "Beginner", "Competent", "Proficient", "Expert"] as const;

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1.5">{children}</div>;
}

function Label({ children, required = false, htmlFor }: { children: React.ReactNode; required?: boolean; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-medium text-[var(--card-foreground)]">
      {children} {required ? <span className="text-destructive">*</span> : null}
    </label>
  );
}

function HelpText({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-[var(--muted-foreground)]">{children}</p>;
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-destructive">{children}</p>;
}

export default function FormsShowcasePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">Showcase</p>
        <h1 className="text-3xl font-semibold tracking-tight">Forms — controls + states</h1>
        <p className="max-w-2xl text-sm text-[var(--muted-foreground)]">
          Form controls and validation states on a realistic Heuresys flow: an employee self-
          assessing one of their skills. Default / focus / error / disabled states for each control.
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">
          <Link href="/showcase" className="underline">back to index</Link>
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Live form — Self-assessment skill rating</h2>
        <form className="grid grid-cols-1 gap-4 hx-card-hover rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 md:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="skill" required>Skill</Label>
            <select id="skill" className="w-full rounded border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
              <option>Risk modelling — Basel IV</option>
              <option>Stress testing scenarios</option>
              <option>Python — pandas / numpy</option>
              <option>Stakeholder communication</option>
            </select>
            <HelpText>From the skills catalogue tied to your position blueprint.</HelpText>
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="level" required>Proficiency level</Label>
            <div role="radiogroup" aria-labelledby="level" className="grid grid-cols-5 gap-1">
              {SKILL_LEVELS.map((lv, i) => (
                <label key={lv} className={`flex cursor-pointer flex-col items-center rounded border px-2 py-2 text-[10px] ${i === 2 ? "border-primary bg-primary/10 text-primary" : "border-[var(--border)]"}`}>
                  <input type="radio" name="level" value={lv} defaultChecked={i === 2} className="sr-only" />
                  <span className="font-semibold tabular-nums">{i + 1}</span>
                  <span>{lv}</span>
                </label>
              ))}
            </div>
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="confidence">Confidence (1–10)</Label>
            <input id="confidence" type="range" min="1" max="10" defaultValue="7" className="w-full accent-primary" />
            <HelpText>How confident you are in this self-rating today.</HelpText>
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="last-used">Last used on a real task</Label>
            <input id="last-used" type="date" defaultValue="2026-04-12" className="w-full rounded border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="evidence">Evidence link</Label>
            <input id="evidence" type="url" placeholder="https://confluence.heuresys.com/..." className="w-full rounded border border-destructive bg-destructive/10 px-3 py-2 text-sm" defaultValue="not a valid url" />
            <ErrorText>Enter a fully-qualified URL (https://…).</ErrorText>
          </FieldGroup>

          <FieldGroup>
            <Label>Visibility</Label>
            <div className="flex items-center gap-3 text-sm">
              <label className="inline-flex items-center gap-2"><input type="checkbox" defaultChecked className="rounded accent-primary" /> Manager</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" defaultChecked className="rounded accent-primary" /> HR Business Partner</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" className="rounded accent-primary" /> Mentor</label>
            </div>
          </FieldGroup>

          <FieldGroup>
            <Label>Endorsement</Label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" role="switch" className="h-5 w-9 appearance-none rounded-full bg-[var(--border)] transition checked:bg-primary" />
              Request peer endorsement from your team lead
            </label>
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="notes">Notes (optional)</Label>
            <textarea id="notes" rows={3} className="w-full rounded border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="Context, recent projects, learning paths followed…" />
          </FieldGroup>

          <FieldGroup>
            <Label>Submitted by</Label>
            <input value="Mario Rossi · mario.rossi@rtl-bank.test" disabled className="w-full cursor-not-allowed rounded border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-sm text-[var(--muted-foreground)]" />
          </FieldGroup>

          <div className="md:col-span-2 mt-2 flex items-center justify-between border-t border-[var(--border)] pt-4">
            <button type="button" className="text-sm text-[var(--muted-foreground)] hover:underline">Cancel</button>
            <div className="flex gap-2">
              <button type="button" className="rounded border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium hover:bg-[var(--muted)]">Save draft</button>
              <button type="submit" className="rounded bg-primary px-4 py-2 text-sm font-medium text-background hover:opacity-90">Submit assessment</button>
            </div>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Input states</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <FieldGroup>
            <Label>Default</Label>
            <input className="w-full rounded border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" placeholder="Type here" />
          </FieldGroup>
          <FieldGroup>
            <Label>Focus</Label>
            <input className="w-full rounded border border-primary bg-[var(--card)] px-3 py-2 text-sm shadow ring-2 ring-primary/20" placeholder="Type here" />
          </FieldGroup>
          <FieldGroup>
            <Label>Error</Label>
            <input className="w-full rounded border border-destructive bg-destructive/10 px-3 py-2 text-sm" defaultValue="invalid" />
            <ErrorText>Must be unique across the tenant.</ErrorText>
          </FieldGroup>
          <FieldGroup>
            <Label>Disabled</Label>
            <input disabled className="w-full cursor-not-allowed rounded border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-sm text-[var(--muted-foreground)]" defaultValue="read-only" />
          </FieldGroup>
        </div>
      </section>
    </div>
  );
}
