import Link from "next/link";

export const metadata = { title: "Showcase / Forms — Heuresys" };

const SKILL_LEVELS = ["Novice", "Beginner", "Competent", "Proficient", "Expert"] as const;

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1.5">{children}</div>;
}

function Label({ children, required = false, htmlFor }: { children: React.ReactNode; required?: boolean; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-medium text-neutral-800">
      {children} {required ? <span className="text-red-600">*</span> : null}
    </label>
  );
}

function HelpText({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-neutral-500">{children}</p>;
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-red-600">{children}</p>;
}

export default function FormsShowcasePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-neutral-500">Showcase</p>
        <h1 className="text-3xl font-semibold tracking-tight">Forms — controls + states</h1>
        <p className="max-w-2xl text-sm text-neutral-600">
          Form controls and validation states on a realistic Heuresys flow: an employee self-
          assessing one of their skills. Default / focus / error / disabled states for each control.
        </p>
        <p className="text-xs text-neutral-500">
          <Link href="/showcase" className="underline">back to index</Link>
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Live form — Self-assessment skill rating</h2>
        <form className="grid grid-cols-1 gap-4 rounded-xl border border-neutral-200 bg-white p-6 md:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="skill" required>Skill</Label>
            <select id="skill" className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200">
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
                <label key={lv} className={`flex cursor-pointer flex-col items-center rounded border px-2 py-2 text-[10px] ${i === 2 ? "border-blue-500 bg-blue-50 text-blue-900" : "border-neutral-300"}`}>
                  <input type="radio" name="level" value={lv} defaultChecked={i === 2} className="sr-only" />
                  <span className="font-semibold tabular-nums">{i + 1}</span>
                  <span>{lv}</span>
                </label>
              ))}
            </div>
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="confidence">Confidence (1–10)</Label>
            <input id="confidence" type="range" min="1" max="10" defaultValue="7" className="w-full accent-blue-600" />
            <HelpText>How confident you are in this self-rating today.</HelpText>
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="last-used">Last used on a real task</Label>
            <input id="last-used" type="date" defaultValue="2026-04-12" className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="evidence">Evidence link</Label>
            <input id="evidence" type="url" placeholder="https://confluence.heuresys.com/..." className="w-full rounded border border-red-400 bg-red-50/30 px-3 py-2 text-sm" defaultValue="not a valid url" />
            <ErrorText>Enter a fully-qualified URL (https://…).</ErrorText>
          </FieldGroup>

          <FieldGroup>
            <Label>Visibility</Label>
            <div className="flex items-center gap-3 text-sm">
              <label className="inline-flex items-center gap-2"><input type="checkbox" defaultChecked className="rounded accent-blue-600" /> Manager</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" defaultChecked className="rounded accent-blue-600" /> HR Business Partner</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" className="rounded accent-blue-600" /> Mentor</label>
            </div>
          </FieldGroup>

          <FieldGroup>
            <Label>Endorsement</Label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" role="switch" className="h-5 w-9 appearance-none rounded-full bg-neutral-300 transition checked:bg-blue-600" />
              Request peer endorsement from your team lead
            </label>
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="notes">Notes (optional)</Label>
            <textarea id="notes" rows={3} className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="Context, recent projects, learning paths followed…" />
          </FieldGroup>

          <FieldGroup>
            <Label>Submitted by</Label>
            <input value="Mario Rossi · mario.rossi@rtl-bank.test" disabled className="w-full cursor-not-allowed rounded border border-neutral-200 bg-neutral-100 px-3 py-2 text-sm text-neutral-500" />
          </FieldGroup>

          <div className="md:col-span-2 mt-2 flex items-center justify-between border-t border-neutral-200 pt-4">
            <button type="button" className="text-sm text-neutral-600 hover:underline">Cancel</button>
            <div className="flex gap-2">
              <button type="button" className="rounded border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50">Save draft</button>
              <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Submit assessment</button>
            </div>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Input states</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <FieldGroup>
            <Label>Default</Label>
            <input className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm" placeholder="Type here" />
          </FieldGroup>
          <FieldGroup>
            <Label>Focus</Label>
            <input className="w-full rounded border border-blue-500 bg-white px-3 py-2 text-sm shadow ring-2 ring-blue-200" placeholder="Type here" />
          </FieldGroup>
          <FieldGroup>
            <Label>Error</Label>
            <input className="w-full rounded border border-red-400 bg-red-50/30 px-3 py-2 text-sm" defaultValue="invalid" />
            <ErrorText>Must be unique across the tenant.</ErrorText>
          </FieldGroup>
          <FieldGroup>
            <Label>Disabled</Label>
            <input disabled className="w-full cursor-not-allowed rounded border border-neutral-200 bg-neutral-100 px-3 py-2 text-sm text-neutral-500" defaultValue="read-only" />
          </FieldGroup>
        </div>
      </section>
    </div>
  );
}
