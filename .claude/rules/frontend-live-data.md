---
paths:
  - "apps/web/**"
  - "apps/showcase/**"
---

# MVP-2a / MVP-2b frontend — LIVE DATA E2E ONLY (non-negotiable)

Gli MVP sono **shipped**, ma la dottrina vincola **ogni nuovo lavoro frontend**:

- **No mock data / demo fixtures / placeholder hard-codes / stubbed endpoints / static-JSON Next.js routes / hard-coded TanStack `initialData`/`placeholderData`.** Ogni cella, grafico, tabella, form è alimentato da una chiamata `/v1/*` reale sul PostgreSQL della VM via pool live; l'unico "dato vuoto" ammesso è un empty-state reale quando l'API ritorna una lista vuota.
- **API-first**: mai costruire UI prima che l'endpoint esista, sia tipato in `@heuresys/shared` e coperto da un integration test verde. Se una pagina ha bisogno di un endpoint mancante, si apre una mini-milestone API e si spedisce prima endpoint + test (commit atomico).
- **Wiring completo prima di "done"**: schema Zod condiviso → repository/service/route API → integration test → tipi frontend da `@heuresys/shared` → hook TanStack Query → componente composto da primitive `@heuresys/ui` → **Playwright E2E verde** (login reale, navigate + assert su dati seminati; le mutazioni si verificano via re-fetch). Qualunque strato mancante = non done.
- **Correzione + retest obbligatori**: ogni regressione TypeScript, vitest, Playwright o i18n parity blocca il merge. Nessun "TODO: fix later" in codice di produzione.

Dottrina completa (audit-first / TDD ordering, loop pagina per pagina): `docs/archive/NEXT_SESSION_MVP_2A.md`.
