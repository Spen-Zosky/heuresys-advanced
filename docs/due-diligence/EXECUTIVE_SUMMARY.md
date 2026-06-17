# Executive Summary — Due Diligence heuresys-advanced — 2026-06-17

**Score globale: 61/100 — Verdetto: CONDITIONAL-GO**

(HEAD `ce26608` · v1.0.0 GA tecnica · DD forense indipendente su 16 pilastri · postura avversariale)

## Razionale del verdetto

heuresys-advanced è un **asset di ingegneria genuinamente forte** (direttrice tecnica 69% del peso disponibile) attaccato a un **business che non esiste ancora** (direttrice product/business 48%). La verifica indipendente ha **confermato** la sostanza tecnica — typecheck pulito, 0 vulnerabilità prod, 1012 test su DB reale, 0 SQL-injection/IDOR, security self-built solida (T6 78), asset-dati ESCO raro (T5 72) — e ha persino trovato che **il venditore sottostima sé stesso** (feature dichiarate assenti che esistono; l'unico difetto "CRITICAL" emerso era già fixato). Ma non c'è monetizzazione, né clienti, né infra commerciale, né strato di compliance, e tutto poggia su **un solo sviluppatore**. Non è un prodotto difettoso da riparare: è una **fondazione sana cui manca interamente lo strato di go-to-market**. Per questo non è NO-GO (zero showstopper, 1 solo pilastro <40, base eccellente) ma neanche GO (manca tutto il business). → **CONDITIONAL-GO**: investibile come *acqui-hire / technical-asset acquisition*, oppure come seed a tesi "fund-to-commercial-GA", **a condizione** di neutralizzare il key-person risk e finanziare il layer commerciale/enterprise.

## Top 5 punti di forza

1. **Security forense verificata** (T6 78/100): auth self-built fatto bene, 0 falle trovate, supply-chain SHA-pinned, TOTP cifrato at-rest.
2. **Qualità ingegneristica sopra-media per lo stadio** (T1 72 / T2 74 / T9 79): architettura pulita, 1012 test su DB reale, 0 mock, 130 migration idempotenti, PROD live verificato.
3. **Asset dati / knowledge-layer difendibile** (T5 / P4): tassonomia ESCO completa (21.939 skill, 126k occupation-skill) + embeddings pgvector operativi — difficile da replicare.
4. **Trasparenza e disciplina eccezionali** (X3 meta-finding): DEBT_REGISTER auto-espone i CRITICAL, 23 ADR, under-promise sistematico. Il rischio-frode/sorpresa è basso.
5. **Capital-efficiency reale** (P3 strength): burn ≈ €0, IP 100% del founder, 0 licenze copyleft virali, spiegabilità AI = plus AI-Act.

## Top 5 rischi (con severità e GA-blocker)

1. **Nessun business / zero monetizzazione** — P3 38 Critico (peso 11). High. GA-blocker commerciale. *Il fattore che prezza tutto.*
2. **Bus factor = 1 / key-person** — X3-001 Critical. Infra in parte personale (agent-gateway su abbonamento MAX del founder). Da prezzare con retention + clausole.
3. **Infra non-enterprise** — T4-002/T8 (HIGH): OCI free-tier single-VM, no HA, CI-runner = VM-PROD (SPOF), no observability. GA-blocker SLA.
4. **Compliance enterprise da costruire** — X2-001 / T3-005 (HIGH cond.): zero GDPR operativo, AI Act high-risk non formalizzato. GA-blocker al primo tenant EU reale.
5. **Promessa "BPM" non mantenuta** — X1-001 (HIGH): nessun runtime di processo. Erode il claim di prodotto.

## GA-blocker (finding che bloccano il rilascio commerciale)

> **Nessun difetto tecnico CRITICAL aperto.** I GA-blocker sono **condizionali** ("scattano al primo cliente reale / multi-tenant / SLA"), cioè layer da costruire, non codice rotto:
- **Commerciale**: assenza totale di signup/pricing/billing/onboarding (P1-001/P3-001).
- **Infra/SLA**: free-tier non-HA + CI=PROD + no-observability + no-rollback-1cmd (T4-002/T4-003/T1-003/T8).
- **Compliance EU**: GDPR tooling + classificazione AI Act assenti (X2-001/T3-005).
- **Licensing AI**: agent-gateway su abbonamento personale, vietato per serving commerciale (T7-001).
- **Multi-tenant reale**: cross-tenant revoke latente (T6-002) + auth-token bloat (T5-001) da chiudere prima di onboardare un tenant reale.

## Condizioni di remediation (sbloccano l'investimento — CONDITIONAL-GO)

| # | Condizione | Effort | Priorità |
|---|---|---|---|
| C1 | De-personalizzare l'infra: managed-DB + app HA, 2° CI runner (separa CI/PROD), rollback ≤1 cmd, backup off-host, observability, agent-gateway → API key commerciale | 6-10 ww | **P0** |
| C2 | Neutralizzare il key-person: hire 2° dev senior + CONTRIBUTING/ONBOARDING + founder-retention con clausole | continuo | **P0** |
| C3 | Costruire il layer commerciale: signup/provisioning multi-tenant + pricing/billing + onboarding | 5-8 ww | **P1** |
| C4 | Chiudere i blocker multi-tenant reali: auth-token retention/famiglie (T5-001) + cross-tenant revoke scope-check (T6-002) | S-M | **P1** (prima del 1° tenant) |
| C5 | Strato compliance EU: GDPR tooling + classificazione formale AI Act high-risk | 4-6 ww | **P1** (gate primo tenant EU) |
| C6 | Validare la domanda: 1 pilota cliente reale firmato entro F2 (kill-criteria) | — | **P1** |

**Effort totale verso GA commerciale: ~27-45 person-week** (~3-5 mesi con team 2-3 dev). Nessun rewrite — costruzione additiva su base sana.

## Tesi d'investimento (sintesi)

- **Come asset technical/acqui-hire**: forte. Codice, dati e security valgono; il founder è il moltiplicatore (e il rischio). Prezzare sul valore di sostituzione della codebase + dell'asset-dati ESCO + retention del founder.
- **Come seed-to-GA**: condizionato. La tecnica non è il rischio; il rischio è **commercializzazione non provata + key-person + tempo-a-revenue**. Strutturare il funding in tranche legate ai kill-criteria (C2→pilota reale→compliance).
- **Red flag occulti**: nessuno trovato. La sorpresa, in DD, è stata **positiva** (più prodotto del dichiarato).

## Assunzioni aperte / domande al founder (da confermare prima del closing)

Financials/runway/funding-ask (assunto pre-revenue, burn ≈€0) · pricing/ICP/target (assunto HR/BPM EU-IT) · titolarità IP e diritto d'uso del legacy `heuresys-evo` (assunto sole-owner) · piano di hiring post-funding · timeline GA-commerciale e impegno di full-time del founder. Dettaglio: `01_DISCOVERY.md` §domande founder.
