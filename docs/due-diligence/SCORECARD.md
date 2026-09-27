# Scorecard — heuresys-advanced — 2026-09-28

> DD investor-grade, RIVALIDATA (voce #255 del backlog). HEAD `5faa2bc2` (S1116). 16 pilastri, pesi sommano a 100. Score globale = somma ponderata (`score × peso / 100`). Score di pilastro ancorati ai finding nei `workstreams/WS-*.md`, rivalidati indipendentemente da cinque analisti (uno per gruppo di pilastri), consolidati dal DD lead. Il verdetto dell'8 settembre 2026 (58/100, NO-GO, fuori repo) NON è stato copiato: questa è una misura nuova, fatta da zero su HEAD, citata come precedente nella tabella di confronto in `REPORT.md` §11.

| # | Pilastro | Dir. | Peso | Score (0-100) | Contributo (score×peso/100) | Banda | Confidence |
|---|---|---|---:|---:|---:|---|---|
| P1 | Product readiness & GA-gap | A | 11 | 63 | 6.93 | Adeguato | Media |
| P2 | Market & competitive positioning | A | 9 | 41 | 3.69 | Debole | Media |
| P3 | Business model & economics | A | 11 | 43 | 4.73 | Debole | Media |
| P4 | AI/LLM business value | A | 5 | 50 | 2.50 | Debole | Media |
| T1 | Architecture & multi-stack soundness | B | 6 | 78 | 4.68 | Forte | Alta |
| T2 | Codebase quality & weighting | B | 6 | 78 | 4.68 | Forte | Alta |
| T3 | Technical debt & antipatterns | B | 6 | 76 | 4.56 | Forte | Alta |
| T4 | Technology fit & best-practice | B | 6 | 63 | 3.78 | Adeguato | Media |
| T5 | Data & DBMS architecture | B | 5 | 79 | 3.95 | Forte | Alta |
| T6 | Security posture (forense) | B | 6 | 85 | 5.10 | Forte | Alta |
| T7 | AI/LLM technical robustness | B | 4 | 69 | 2.76 | Adeguato | Alta |
| T8 | Operational readiness & scalability | B | 3 | 79 | 2.37 | Forte | Alta |
| T9 | Verified functional correctness (live E2E) | B | 7 | 82 | 5.74 | Forte | Alta |
| X1 | Functional debt | X | 5 | 68 | 3.40 | Adeguato | Alta |
| X2 | Legal / IP / compliance & data governance | X | 5 | 71 | 3.55 | Adeguato | Alta |
| X3 | Execution risk / team & bus factor | X | 5 | 63 | 3.15 | Adeguato | Alta |
| | **TOTALE** | | **100** | | **65.57 → 66** | | |

**Score globale = 66 / 100** (era 61 il 17 giugno; +5).

## Calcolo per esteso
```
P1 63×0.11=6.93   P2 41×0.09=3.69   P3 43×0.11=4.73   P4 50×0.05=2.50
T1 78×0.06=4.68   T2 78×0.06=4.68   T3 76×0.06=4.56   T4 63×0.06=3.78
T5 79×0.05=3.95   T6 85×0.06=5.10   T7 69×0.04=2.76   T8 79×0.03=2.37
T9 82×0.07=5.74   X1 68×0.05=3.40   X2 71×0.05=3.55   X3 63×0.05=3.15
Σ = 65.57
```
Sub-totali direttrice: **A (Product/Business/Market) = 17.85 / 36 (49,6%)** · **B (Tech/Engineering) = 37.62 / 49 (76,8%)** · **X (Cross-cutting) = 10.10 / 15 (67,3%)**.

## Check soglie del verdetto
- **Score globale**: 66/100 → rientra in `55 ≤ score < 75` (banda CONDITIONAL-GO).
- **Pilastri < 40**: **0** (il più basso è P2 a 41 — Debole, non Critico). Non scatta la soglia NO-GO da ≥2 pilastri critici.
- **Showstopper legale**: **nessuno** — X2 a 71/100 (Adeguato/verso Forte): modulo GDPR reale (export, erasure transazionale, retention), AI Act rinviato a dicembre 2027 (Digital Omnibus). Resta un difetto concreto (permesso DPO respinto dal service nonostante l'RBAC — WS-X2), ma non è uno showstopper: è un bug fixabile.
- **Showstopper security**: **nessuno** — T6 a 85/100 (Forte): nessun finding Critical. Un finding MEDIUM in T8 (`/api/metrics` raggiungibile pubblicamente via rewrite Next.js, WS-T8 F-T8-09) è un GA-blocker condizionale, non uno showstopper.
- **Difetti tecnici CRITICAL aperti**: **0** su tutti e 16 i workstream.

## → Verdetto risultante: **CONDITIONAL-GO**
Score 66 (≥55, <75); zero pilastri <40; nessuno showstopper legale o di sicurezza. Le condizioni di remediation sono in `EXECUTIVE_SUMMARY.md`.

## Lettura della distribuzione
Il profilo è lo stesso di giugno, più marcato: **direttrice B (tecnica) 76,8%** vs **direttrice A (business) 49,6%**. L'ingegneria ha continuato a maturare (T1/T2/T3/T5/T6/T8/T9 tutti in banda Forte), mentre il lato business resta la parte debole — non per stallo, ma perché il mercato si è mosso: l'unico competitor diretto di rilievo (365Talents) è stato acquisito da un attore con distribuzione europea nel banking (Docebo), e zero clienti paganti/pricing restano invariati. Il valore per l'investitore non è cambiato di natura da giugno: **base tecnica solida e ora più matura, a cui manca ancora lo strato commerciale, di go-to-market e di de-risking del key-person** (bus factor umano ancora 1, X3).

## Storico — 17 giugno 2026 (HEAD `ce26608`, S994)

Punteggio precedente per confronto (dettaglio pilastro-per-pilastro in `REPORT.md` §11):

| # | Pilastro | Score 17/6 | Banda 17/6 |
|---|---|---:|---|
| P1 | Product readiness & GA-gap | 58 | Debole→Adeguato |
| P2 | Market & competitive positioning | 44 | Debole |
| P3 | Business model & economics | 38 | **Critico** |
| P4 | AI/LLM business value | 52 | Debole |
| T1 | Architecture & multi-stack soundness | 72 | Adeguato |
| T2 | Codebase quality & weighting | 74 | Adeguato |
| T3 | Technical debt & antipatterns | 62 | Adeguato |
| T4 | Technology fit & best-practice | 65 | Adeguato |
| T5 | Data & DBMS architecture | 72 | Adeguato |
| T6 | Security posture (forense) | 78 | Forte |
| T7 | AI/LLM technical robustness | 65 | Adeguato |
| T8 | Operational readiness & scalability | 62 | Adeguato |
| T9 | Verified functional correctness (live E2E) | 79 | Forte |
| X1 | Functional debt | 60 | Adeguato |
| X2 | Legal / IP / compliance & data governance | 66 | Adeguato |
| X3 | Execution risk / team & bus factor | 58 | Debole |
| | **TOTALE (17/6)** | **60.97 → 61** | |

Verdetto 17/6: **CONDITIONAL-GO** (61/100, un pilastro critico: P3 a 38).
