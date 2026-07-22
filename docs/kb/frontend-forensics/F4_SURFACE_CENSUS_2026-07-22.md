# Fase 4 — Forense frontend per-superficie · S1025 · 2026-07-22

> Kickoff: `docs/kb/NEXT_SESSION_DB_FRONTEND_FORENSICS_KICKOFF.md` §4. Eseguito DOPO le
> Fasi 1-3 (fix dati) e dopo il deploy i18n, come impone la sequenza. Bersaglio: PROD
> (`www.heuresys.com`) con login reali (admin, federica TENANT_ADMIN, paolo MANAGER,
> tommaso USER).

## §1 Inventario superfici (104 route — derivato da `apps/web/src/app`, 2026-07-22)

- **Admin SPA (autenticate)**: dashboard · users(+detail) · positions(+detail/kpis/skills/learning)
  · organization(+org-chart) · skills · kpis · goals · okrs · gaps · learning(+training-initiatives)
  · career-succession · compensation-intelligence · talent-review · time-off · approvals(+detail)
  · engagement(+detail) · insights(+skill-gap/succession-readiness) · analytics (9 viste)
  · blueprints(+variant) · tenants(+detail/enterprise-typing) · processes · process-owner
  · org-director · content(+detail) · visualizations(+detail) · system-health · provenance
  · seed-acquisition/runs · brownfield-adaptation · admin/roles · admin/mfa-policy · dev/agent · evidence/whistleblowing se presenti
- **ESS `/me/*` (18)**: me · analytics · approvals · career(+target) · certifications · documents
  · gaps · handbook(+detail) · inbox · kpis · learning(+catalogue) · matching · org-chart
  · positions · profile · security · skills(+self-assessment) · surveys(+detail) · team
- **Pubbliche**: `/` · /login · /demo · /investors · /privacy · /app
- **Showcase in-app** (18 route design) + sito statico `apps/showcase` (GitHub Pages)

## §2 Metodo (per pagina)

Checklist dal kickoff: codici/chiavi illeggibili dove serve la descrizione · testi non
intellegibili o mock/hardcoded · formati (date, valute, numeri) · mix IT/EN · link e
navigazioni rotte · dataset poveri dove il DB ha di più · errori console/network.
Strumento: chrome-devtools/Playwright su PROD, login per ruolo. Esito: scheda finding
per pagina → piano chirurgico (API-first se manca il dato; fix UI se è presentazione).

## §3 Schede findings

_(compilate nella sweep — vedi sotto)_

## §4 Stato

- [x] Inventario derivato dal codice
- [ ] Sweep superfici P1 (dashboard, users, positions, skills, learning, gaps, insights, analytics, me/* core, login/demo)
- [ ] Sweep superfici P2 (resto admin + surveys/engagement + showcase)
- [ ] Piani chirurgici + esecuzione fix
