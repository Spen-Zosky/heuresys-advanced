# DD Charter — heuresys-advanced

Generato dalla skill `saas-investor-due-diligence`. Data avvio: 2026-06-17. HEAD `ce26608` (S994).

## Mandato
Due diligence **forense investor-grade** per una decisione **FUND / ACQUIRE / INVEST** (porta a GA commerciale / acquisizione). Prospettiva costante: **interessi dell'investitore/acquirente**. Postura: indipendente e avversariale — ogni claim del venditore rivalidato con evidenza reale.

## Perimetro
- Target: `D:\heuresys-advanced` (HRMS/BPM SaaS, monorepo pnpm).
- Inclusa **tutta** la documentazione globale + lo scenario di brevissimo periodo `docs/kb/improvement/**` (programma "RELEASE 100X": audit A1..A11 + 14 dossier decisionali), trattato come rappresentazione del venditore.
- Ambiente verifiche: host Windows + tunnel SSH :5433 → OCI VM PostgreSQL 16; PROD live HTTPS `www.heuresys.com` (read-only, mai mutante).

## Metodo
16 pilastri (rubrica `references/scoring-rubric.md`), 2 direttrici + cross-cutting. Fasi: Discovery → Live E2E (T9) → Workstream per pilastro (fan-out agenti) → Consolidamento (SCORECARD / REPORT / EXECUTIVE_SUMMARY) → verdetto **GO / CONDITIONAL-GO / NO-GO**.

## Output
`docs/due-diligence/`: `01_DISCOVERY.md` · `workstreams/WS-*.md` · `SCORECARD.md` · `REPORT.md` · `EXECUTIVE_SUMMARY.md`.

## Indipendenza
Materiale interno = input, non verità. Discrepanze dichiarato↔osservato = finding (pesano su X3). Soglie verdetto e pesi applicati alla lettera, senza ammorbidimenti.
