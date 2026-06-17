# Scorecard — heuresys-advanced — 2026-06-17

> DD investor-grade. HEAD `ce26608` (S994). 16 pilastri, pesi sommano a 100. Score globale = somma ponderata (`score × peso / 100`). Score di pilastro ancorati ai finding nei `workstreams/WS-*.md`, rivalidati indipendentemente dal DD lead.

| # | Pilastro | Dir. | Peso | Score (0-100) | Contributo (score×peso/100) | Banda | Confidence |
|---|---|---|---:|---:|---:|---|---|
| P1 | Product readiness & GA-gap | A | 11 | 58 | 6.38 | Debole→Adeguato | Media |
| P2 | Market & competitive positioning | A | 9 | 44 | 3.96 | Debole | Media |
| P3 | Business model & economics | A | 11 | 38 | 4.18 | **Critico** | Media |
| P4 | AI/LLM business value | A | 5 | 52 | 2.60 | Debole | Media |
| T1 | Architecture & multi-stack soundness | B | 6 | 72 | 4.32 | Adeguato | Alta |
| T2 | Codebase quality & weighting | B | 6 | 74 | 4.44 | Adeguato | Alta |
| T3 | Technical debt & antipatterns | B | 6 | 62 | 3.72 | Adeguato | Alta |
| T4 | Technology fit & best-practice | B | 6 | 65 | 3.90 | Adeguato | Alta |
| T5 | Data & DBMS architecture | B | 5 | 72 | 3.60 | Adeguato | Alta |
| T6 | Security posture (forense) | B | 6 | 78 | 4.68 | Forte | Alta |
| T7 | AI/LLM technical robustness | B | 4 | 65 | 2.60 | Adeguato | Alta |
| T8 | Operational readiness & scalability | B | 3 | 62 | 1.86 | Adeguato | Alta |
| T9 | Verified functional correctness (live E2E) | B | 7 | 79 | 5.53 | Forte | Alta |
| X1 | Functional debt | X | 5 | 60 | 3.00 | Adeguato | Media |
| X2 | Legal / IP / compliance & data governance | X | 5 | 66 | 3.30 | Adeguato | Media |
| X3 | Execution risk / team & bus factor | X | 5 | 58 | 2.90 | Debole | Alta |
| | **TOTALE** | | **100** | | **60.97 → 61** | | |

**Score globale = 61 / 100.**

## Calcolo per esteso
```
P1 58×0.11=6.38   P2 44×0.09=3.96   P3 38×0.11=4.18   P4 52×0.05=2.60
T1 72×0.06=4.32   T2 74×0.06=4.44   T3 62×0.06=3.72   T4 65×0.06=3.90
T5 72×0.05=3.60   T6 78×0.06=4.68   T7 65×0.04=2.60   T8 62×0.03=1.86
T9 79×0.07=5.53   X1 60×0.05=3.00   X2 66×0.05=3.30   X3 58×0.05=2.90
Σ = 60.97
```
Sub-totali direttrice: **A (Product/Business/Market) = 17.12 / 36** · **B (Tech/Engineering) = 33.65 / 49** · **X (Cross-cutting) = 9.20 / 15**.

## Check soglie del verdetto
- **Score globale**: 61/100 → rientra in `55 ≤ score < 75` (banda CONDITIONAL-GO).
- **Pilastri < 40**: **1** → P3 (38). Per NO-GO ne servono ≥2 → non scatta.
- **Showstopper legale**: **nessuno** (X2: no-PII verificato 1225/1225 `pii_disposition=NONE`; GDPR/AI-Act gated al primo tenant reale, dichiarati e non occulti).
- **Showstopper security**: **nessuno** (T6: 0 SQL-injection attiva, 0 IDOR funzionale, 0 secret in risposta/log, 0 bypass auth su HEAD `ce26608`).
- **Difetti tecnici CRITICAL aperti**: **0** — l'unico CRITICAL emerso (N+1 broadcast, finding T3-001) è risultato **GIÀ FIXATO** alla verifica diretta del DD lead (`apps/api/src/lib/notifications/emit.ts:105` `emitNotificationsBulk` set-based, 2 query a prescindere da N; falso positivo da finding-list stale del venditore — vedi REPORT §6).

## → Verdetto risultante: **CONDITIONAL-GO**
Score 61 (≥55, <75); un solo pilastro <40 (P3, fixabile = "costruire il layer commerciale", non difetto); nessuno showstopper. Le condizioni di remediation sono in `EXECUTIVE_SUMMARY.md`.

## Lettura della distribuzione
La dispersione è il dato più informativo: **direttrice B (tecnica) 33.65/49 = 69%** vs **direttrice A (business) 17.12/36 = 48%**. Il profilo è inequivocabile: **asset di ingegneria forte e verificato, business non ancora esistente**. Il valore per l'investitore non è "un prodotto difettoso da sistemare" ma "una base tecnica solida a cui manca interamente lo strato di go-to-market, compliance enterprise e de-risking del key-person".
