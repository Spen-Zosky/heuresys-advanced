# Scorecard ripesata — orientamento ACQUIRENTE "spietato" — heuresys-advanced

> Rielaborazione indipendente della DD `docs/due-diligence/SCORECARD.md` con pesi **e** punteggi
> orientati interamente agli interessi del potenziale acquirente. NON sostituisce la DD originale:
> è una lettura avversariale aggiuntiva, deliberatamente pessimistica (lente "spietata").
> Data: 2026-06-17 · HEAD `ce26608` (S994) · Baseline DD = **61/100 CONDITIONAL-GO**.

## Principio del peso

Un acquirente non compra "bel codice": compra **revenue futura de-rischiata**. La qualità ingegneristica
conta solo in modo strumentale ("l'asset funziona, bene"); pesano di più le tre domande che decidono se
c'è qualcosa da comprare: *si può fare un business? sopravvive se il founder se ne va? può servire un
cliente pagante con un SLA?*. Le direttrici passano da **A36 / B49 / X15** (DD) a **A46 / B34 / X20**.
La colonna "score spietato" abbassa i punteggi dove la DD era morbida (giustificazione per pilastro sotto).

## Scorecard ripesata

| # | Pilastro | Dir | Peso DD | Peso spietato | Score DD | Score spietato | Contributo spietato |
|---|---|---|---:|---:|---:|---:|---:|
| P1 | Product readiness & GA-gap | A | 11 | 12 | 58 | 45 | 5.40 |
| P2 | Market & competitive positioning | A | 9 | 12 | 44 | 35 | 4.20 |
| P3 | Business model & economics | A | 11 | 16 | 38 | 25 | 4.00 |
| P4 | AI/LLM business value | A | 5 | 6 | 52 | 42 | 2.52 |
| T1 | Architecture & soundness | B | 6 | 3 | 72 | 68 | 2.04 |
| T2 | Codebase quality | B | 6 | 3 | 74 | 66 | 1.98 |
| T3 | Technical debt & antipatterns | B | 6 | 3 | 62 | 58 | 1.74 |
| T4 | Technology fit & best-practice | B | 6 | 4 | 65 | 55 | 2.20 |
| T5 | Data & DBMS (asset ESCO) | B | 5 | 5 | 72 | 68 | 3.40 |
| T6 | Security posture (forense) | B | 6 | 4 | 78 | 62 | 2.48 |
| T7 | AI/LLM technical robustness | B | 4 | 2 | 65 | 52 | 1.04 |
| T8 | Operational readiness & scalability | B | 3 | 6 | 62 | 38 | 2.28 |
| T9 | Verified functional correctness | B | 7 | 4 | 79 | 64 | 2.56 |
| X1 | Functional debt (BPM mancante) | X | 5 | 5 | 60 | 50 | 2.50 |
| X2 | Legal / IP / compliance | X | 5 | 7 | 66 | 48 | 3.36 |
| X3 | Execution risk / bus factor | X | 5 | 8 | 58 | 40 | 3.20 |
| | **TOTALE** | | **100** | **100** | | | **44.90** |

Sub-totali direttrice (pesi spietati × score spietati): **A = 16.12 / 46** · **B = 19.72 / 34** · **X = 9.06 / 20**.

## I tre numeri

- **61** — baseline DD (pesi DD × score DD).
- **57** — *solo riponderazione* (pesi spietati × score DD invariati): isola l'effetto-peso. Il "61" perde
  4 punti solo spostando i pesi verso ciò che conta per chi compra. Resta CONDITIONAL-GO, ma a **2 punti
  dalla soglia NO-GO (55)**.
- **45** — riponderazione **+** score spietati. Numero acquirente-pessimista.

Calcolo colonna "solo riponderazione" (pesi spietati × score DD) = 57.44.
Calcolo colonna spietata (pesi spietati × score spietati) = 44.90 → **45**.

## Spostamento dei pesi (perché)

Direttrice A (business) 36 → 46, X (rischio/legal/persona) 15 → 20, B (tecnica) 49 → 34.
- **T8 raddoppia (3 → 6)**: "può reggere un cliente con SLA" è quasi disqualificante oggi.
- **X3 sale a 8, X2 a 7**: key-person e titolarità IP possono azzerare il deal.
- **T1/T2/T3/T7 scendono**: la perfezione del codice non è ciò che si paga.
- **T5 invariato (5)**: l'asset-dati ESCO è l'unico vero moat → non si svaluta.

## Tagli di punteggio che pesano (lente spietata)

- **P3 38 → 25** — la DD ha tenuto il 38 "non sotto 30" usando la capital-efficiency: logica da
  *valore-asset*, non da *qualità del business model*. Qui misuriamo il business model: zero monetizzazione,
  zero ricavi, unit economics non calcolabili → ~25.
- **T8 62 → 38** — free-tier single-VM, no HA, no managed-DB, **CI runner = la VM di PROD** (SPOF + DB di CI
  = DB di PROD), zero observability, rollback manuale. Per chi deve offrire uptime contrattuale, vicino al
  disqualificante.
- **X2 66 → 48** — titolarità IP del legacy `heuresys-evo` e dei dati **assunta, non verificata** (Q5/Q6):
  per un acquirente è **potenziale showstopper**, non un 66. In più zero strato GDPR operativo, AI-Act
  high-risk non formalizzato.
- **X3 58 → 40** — bus factor 1 (99.6% commit una persona), infra su abbonamento personale del founder,
  zero PR-review, nessun onboarding doc. La trasparenza non riavvia i systemd se il founder sparisce.
- **T6 78 → 62** — ben costruito ma **forense ≠ pentestato** (la DD stessa mette il pentest in F5);
  cross-tenant revoke (T6-002) non esercitato con tenant reali. "Forte" solo a ciò che un terzo ha testato.
- **T9 79 → 64** — solo **~7% degli endpoint** verificati live dalla DD; il resto poggia sulla CI verde
  *del venditore stesso*. Forte dove testato, non verifica indipendente completa.
- Tagli minori (T1 72→68, T2 74→66, T3 62→58, T4 65→55, T5 72→68, T7 65→52, P1 58→45, P2 44→35, P4 52→42,
  X1 60→50): erosione coerente con il rischio commerciale/onboarding non incassato dalla DD.

## Verdetto ricalcolato sulle soglie della DD

Regola DD: `score < 55` = banda NO-GO · **≥2 pilastri < 40 = NO-GO** · showstopper legale = NO-GO.

Scenario spietato: **score 45 (< 55)** e **due pilastri < 40** (P3 = 25, T8 = 38), con X3 sul filo (40) e
X2 a rischio-showstopper se la titolarità IP non è confermata. **Entrambe le condizioni di NO-GO scattano.**

→ Verdetto ribaltato da CONDITIONAL-GO a **NO-GO come investimento in un'azienda**. Sopravvive *solo*
riformulato come **acquisto di asset / acqui-hire a forte sconto**: si prezza il valore-di-sostituzione
della codebase + l'asset-dati ESCO (T5) + retention del founder, trattando l'intero potenziale di business
come **opzione gratuita, non come valore pagato**.

## Bottom line per l'acquirente

Il "61" della DD è il voto a un *asset visto con peso tecnico*. Spietato e acquirente-first, il numero reale
è **45-57** secondo quanto si è duri sui punteggi; entrambi gli estremi dicono la stessa cosa: **paga per il
codice, i dati e la persona — non per il business (inesistente) né per l'infrastruttura (non regge un
cliente)**. Le due leve che spostano il prezzo prima di firmare:
1. **Confermare la titolarità IP** del legacy e di `@heuresys/ui` — finché è un'assunzione, è un rischio.
2. **Vincolare il founder** (lock-up / earn-out) — senza di lui l'asset perde gran parte del valore.

**In una riga:** con l'occhio dell'acquirente è un **NO-GO come "finanzio un'azienda"**, un **forse-SÌ come
"compro un asset scontato + la persona che lo sa far girare"**.

---
*Limiti: i pesi e gli score "spietati" sono giudizi avversariali espliciti, non verità oggettive. La DD
originale (61/CONDITIONAL-GO) resta difendibile nel suo frame; questo documento è la lente acquirente-pessimista.
Fonti dati: `SCORECARD.md`, `REPORT.md`, `01_DISCOVERY.md`, `workstreams/WS-P3.md`, `WS-X3.md`, `WS-T9.md`.*
