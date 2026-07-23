# ADR-0031 — Self-view ESS dell'intelligence calcolata (capability + flight-risk)

**Status**: Accepted (decisione Enzo S1018; registrata e implementata S1028, 2026-07-23)
**Supersedes**: la scelta D-6 (Gap#1) che escludeva deliberatamente il self-view
dagli score calcolati (`capability-composition/routes.ts` — "no ESS self-view";
stesso perimetro per flight-risk in `insights`).
**Decision authority**: Enzo (decisione di PRODOTTO, censita in F5 di
`docs/product/DEVELOPMENT_LINES_F_PRESCRIPTIVE_INTELLIGENCE.md`); dettagli
tecnici Claude (per `feedback_claude_decides_technical`).

## Context

Gli score calcolati sulla persona (capability composition, flight-risk) erano
visibili SOLO alle audience amministrative (`capability:read`, `insights:*`) —
il dipendente non poteva vedere l'intelligence che la piattaforma calcola su di
lui. La scelta D-6 nasceva prudenziale (rischio di framing punitivo del
"flight-risk" mostrato al soggetto).

## Decision

**Tutto visibile al dipendente** (Enzo, S1018): il soggetto vede i PROPRI score
con le PROPRIE evidenze, in forma **coach** ("il mio percorso", "il mio
sviluppo") — mai il framing "rischio fuga".

- Nuovo endpoint self-scope **`GET /v1/me/development`** (permission dedicata
  **`insight:read:self`**, mig 000214 — audience derivata da
  `gap_analysis:read:self`, il sibling semantico più vicino): flight-risk
  {value, band, modelVersion, computedAt, factors} + capability EMPLOYEE
  {value, coverage, modelVersion, computedAt} del SOLO attore.
- Le **evidenze** sono la derivation del punteggio stesso (feature → weight →
  contribution): trasparenza sul perché, non solo sul quanto.
- Web: sezione "Il mio sviluppo" in `/me/analytics` (copy coach IT/EN).

## Rationale

- **I17 (universal ESS floor)**: ogni utente ha pieno accesso ai PROPRI dati —
  gli score calcolati SU di lui sono suoi dati derivati; l'esclusione D-6 era
  un'eccezione al floor, non un suo corollario.
- **Trasparenza**: mostrare le feature che compongono il punteggio rende il
  numero contestabile e correggibile (un dato di attendance errato si vede).
- **Coach framing**: la mitigazione del rischio D-6 si sposta dal NASCONDERE il
  dato al PRESENTARLO costruttivamente (linguaggio di sviluppo, mai di fuga).

## Consequences

- Self-scope ONLY: la rotta filtra su `actor.userId` — nessun dato di terzi
  transita (I18/I19 intatti: la via organizzativa resta l'unica per i dati
  altrui).
- La permission `insight:read:self` entra nell'allowlist TENANT_ADMIN (marker
  D-57 in 000214).
- D-6 resta nel log storico di Gap#1 come scelta superata da questa ADR.
