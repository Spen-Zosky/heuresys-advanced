import Link from "next/link";
import { LogoCandidateAFull } from "@heuresys/ui/brand/candidates";

export const metadata = { title: "Showcase / Login page — Heuresys" };

export default function LoginPageShowcase() {
  return (
    <div className="-mx-6 -my-10">
      <div className="border-b border-[var(--border)] bg-[var(--card)] px-6 py-3">
        <Link href="/showcase" className="text-xs text-[var(--muted-foreground)] underline">← back to showcase index</Link>
      </div>

      <div className="grid min-h-[calc(100vh-44px)] grid-cols-1 lg:grid-cols-[5fr_4fr]">
        <section className="flex items-center justify-center bg-[var(--card)] px-6 py-16">
          <div className="w-full max-w-sm">
            <LogoCandidateAFull className="h-10 w-auto text-blue-700" />
            <h1 className="mt-8 text-2xl font-semibold tracking-tight">Accedi a Heuresys</h1>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">Console amministrativa e portale dipendente.</p>

            <form className="mt-8 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-xs font-medium text-[var(--card-foreground)]">Email aziendale</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="nome.cognome@rtl-bank.it"
                  className="w-full rounded border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-xs font-medium text-[var(--card-foreground)]">Password</label>
                  <a href="#" className="text-xs text-blue-700 hover:underline">Password dimenticata?</a>
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  className="w-full rounded border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-[var(--card-foreground)]">
                <input type="checkbox" className="rounded accent-blue-600" />
                Tieni la sessione aperta su questo dispositivo
              </label>

              <button type="submit" className="w-full rounded bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
                Accedi
              </button>

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[var(--border)]" /></div>
                <div className="relative flex justify-center text-[11px] uppercase tracking-wider"><span className="bg-[var(--card)] px-2 text-[var(--muted-foreground)]">oppure</span></div>
              </div>

              <button type="button" className="w-full rounded border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm font-medium text-[var(--card-foreground)] hover:bg-[var(--muted)]">
                Accedi con SSO aziendale
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-[var(--muted-foreground)]">
              Hai problemi di accesso?{" "}
              <a href="#" className="text-blue-700 hover:underline">Contatta l&apos;amministratore del tuo tenant</a>.
            </p>
            <p className="mt-2 text-center text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
              v0.3.0-brand-v1 · TLS 1.3 · Tenant: auto-detect
            </p>
          </div>
        </section>

        <aside className="relative hidden flex-col justify-between bg-blue-900 px-10 py-12 text-white lg:flex">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-200">Workforce intelligence</p>
            <h2 className="mt-3 max-w-md text-3xl font-semibold leading-tight tracking-tight">
              Le decisioni HR si misurano sui dati.<br />
              Heuresys ti dà i dati.
            </h2>
            <p className="mt-4 max-w-md text-sm text-blue-100">
              Posizioni, skill, processi e learning in un grafo coerente. Un solo punto di verità per
              il tuo tenant, isolato per design (FK + middleware, mai RLS).
            </p>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-3 max-w-md">
            <div className="rounded-lg bg-[var(--card)]/10 p-4 backdrop-blur">
              <p className="text-[10px] uppercase tracking-wider text-blue-200">Positions</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">1,284</p>
            </div>
            <div className="rounded-lg bg-[var(--card)]/10 p-4 backdrop-blur">
              <p className="text-[10px] uppercase tracking-wider text-blue-200">Skills tracked</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">812</p>
            </div>
            <div className="rounded-lg bg-[var(--card)]/10 p-4 backdrop-blur">
              <p className="text-[10px] uppercase tracking-wider text-blue-200">Tenants</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">23</p>
            </div>
            <div className="rounded-lg bg-[var(--card)]/10 p-4 backdrop-blur">
              <p className="text-[10px] uppercase tracking-wider text-blue-200">EU residency</p>
              <p className="mt-1 text-2xl font-semibold">100%</p>
            </div>
          </div>

          <p className="mt-12 text-xs text-blue-200">
            © 2026 Heuresys S.r.l. · <a className="underline" href="https://heuresys.com">heuresys.com</a>
          </p>
        </aside>
      </div>
    </div>
  );
}
