import Link from "next/link";
import { HeuresysWordmark } from "@heuresys/ui";

export const metadata = { title: "Showcase / Login page — Heuresys" };

export default function LoginPageShowcase() {
  return (
    <div className="-mx-6 -my-10">
      <div className="border-b border-border bg-card px-6 py-3">
        <Link href="/showcase" className="text-xs text-muted-foreground underline">← back to showcase index</Link>
      </div>

      <div className="grid min-h-[calc(100vh-44px)] grid-cols-1 lg:grid-cols-[5fr_4fr]">
        <section className="flex items-center justify-center bg-card px-6 py-16">
          <div className="w-full max-w-sm">
            <HeuresysWordmark variant="brand" size="xl" />
            <h1 className="mt-8 text-2xl font-semibold tracking-tight text-foreground">Accedi a Heuresys</h1>
            <p className="mt-1 text-sm text-muted-foreground">Console amministrativa e portale dipendente.</p>

            <form className="mt-8 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-xs font-medium text-card-foreground">Email aziendale</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="nome.cognome@rtl-bank.it"
                  className="w-full rounded-control border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-xs font-medium text-card-foreground">Password</label>
                  <a href="#" className="text-xs text-primary hover:underline">Password dimenticata?</a>
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  className="w-full rounded-control border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-card-foreground">
                <input type="checkbox" className="rounded accent-primary" />
                Tieni la sessione aperta su questo dispositivo
              </label>

              <button
                type="submit"
                className="w-full rounded-control bg-primary px-3 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
                style={{ color: "var(--color-background)" }}
              >
                Accedi
              </button>

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-[11px] uppercase tracking-wider"><span className="bg-card px-2 text-muted-foreground">oppure</span></div>
              </div>

              <button
                type="button"
                className="w-full rounded-control border border-border bg-card px-3 py-2.5 text-sm font-medium text-card-foreground hover:bg-muted"
              >
                Accedi con SSO aziendale
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Hai problemi di accesso?{" "}
              <a href="#" className="text-primary hover:underline">Contatta l&apos;amministratore del tuo tenant</a>.
            </p>
            <p className="mt-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
              v0.3.0-brand-v1 · TLS 1.3 · Tenant: auto-detect
            </p>
          </div>
        </section>

        <aside className="relative hidden flex-col justify-between px-10 py-12 lg:flex bg-primary text-background">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider opacity-70">Workforce intelligence</p>
            <h2 className="mt-3 max-w-md text-3xl font-semibold leading-tight tracking-tight">
              Le decisioni HR si misurano sui dati.<br />
              Heuresys ti dà i dati.
            </h2>
            <p className="mt-4 max-w-md text-sm opacity-80">
              Posizioni, skill, processi e learning in un grafo coerente. Un solo punto di verità per
              il tuo tenant, isolato per design (FK + middleware, mai RLS).
            </p>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-3 max-w-md">
            <div className="rounded-card bg-background/10 p-4 backdrop-blur">
              <p className="text-[10px] uppercase tracking-wider opacity-70">Positions</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">1,284</p>
            </div>
            <div className="rounded-card bg-background/10 p-4 backdrop-blur">
              <p className="text-[10px] uppercase tracking-wider opacity-70">Skills tracked</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">812</p>
            </div>
            <div className="rounded-card bg-background/10 p-4 backdrop-blur">
              <p className="text-[10px] uppercase tracking-wider opacity-70">Tenants</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">23</p>
            </div>
            <div className="rounded-card bg-background/10 p-4 backdrop-blur">
              <p className="text-[10px] uppercase tracking-wider opacity-70">EU residency</p>
              <p className="mt-1 text-2xl font-semibold">100%</p>
            </div>
          </div>

          <p className="mt-12 text-xs opacity-70">
            © 2026 Heuresys S.r.l. ·{" "}
            <a className="underline" href="https://heuresys.com">heuresys.com</a>
          </p>
        </aside>
      </div>
    </div>
  );
}
