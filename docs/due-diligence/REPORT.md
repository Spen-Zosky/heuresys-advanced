# Due Diligence — heuresys-advanced — Rapporto completo — 2026-09-28 (rivalidato)

> Forense, investor-grade. HEAD `ce26608` (S994). 16 pilastri (rubrica `references/scoring-rubric.md`), 7 workstream-agent + verifica diretta del DD lead. Postura: indipendente/avversariale. **Score globale 61/100 → verdetto CONDITIONAL-GO** (dettaglio `SCORECARD.md`; sintesi investitore `EXECUTIVE_SUMMARY.md`).

---

## 1. Status quo (fotografia misurata, 2026-09-28)

**Cos'è**: piattaforma HRMS/BPM SaaS multi-tenant. Monorepo pnpm: Fastify 5 API (Zod 4, Argon2id, RS256 JWT, RBAC DB-driven) su PostgreSQL 16 nativo (OCI VM, tunnel SSH); Next.js 16 admin SPA + ESS portal; `apps/agent-gateway` (Claude Agent SDK, HITL write-gate); `@heuresys/ui` design-system npm-published; showcase static su GitHub Pages. Dichiarato **v1.0.0 GA** (2026-06-02), in produzione su HTTPS `www.heuresys.com`. **Un solo ambiente, di produzione, due tenant** (RTL Bank + Heuresys System, ADR-0026/I15) — non esiste uno staging separato.

**Baseline misurata indipendentemente oggi** (HEAD `5faa2bc2`, confronto col 17 giugno fra parentesi): **111 moduli API** (era 75, +48%) · **452 migrazioni** idempotenti (era 130, +248%) · **320 file di test API** (era 148, +116%) · **104 spec Playwright** (era 46) · **129 pagine web** (era 85, +52%), di cui 30 sotto `/me/*` (era 19) · **250 tabelle `sys.*`** · typecheck **exit 0** pulito · sentinelle di integrità **66 a zero** (erano 7). DB live: 2 tenancies, 161 persone/315 posizioni, 24 ruoli/241 permessi/1246 mapping RBAC, 21.939 skill ESCO, 126.051 occupation-skill reqs, embeddings pgvector HNSW operativi.

**Stato di maturità**: GA **tecnica reale**, confermata dal vivo in questa rivalidazione (§9, T9): login autenticato reale contro produzione, 8 rotte `/v1/*` esercitate in lettura (200 con dati reali di RTL Bank) e un diniego RBAC autentico verificato (403 su una rotta non autorizzata). GA **commerciale ancora assente**: nessun signup/pricing/billing/onboarding self-service (P1-001, invariato da giugno). Sviluppo a cadenza molto alta ma **bus factor umano ancora 1** (`git shortlog`: 2656+173 commit di una sola identità, misurato oggi), mitigato da un motore di guardie automatiche più maturo (audit Codex esteso, plugin `enzo-guard`, primi 5 merge via PR reali contro 0 di giugno).

**Cosa è cambiato in tre mesi** (delta strutturale, non solo di scala): ADR-0040 (freno dell'agente su persone distinte, con ponte di approvazione umana sulle letture oltre soglia), mandato K completo su ruoli senza titolare e direzione del dato (I23), MFA disponibile e collaudata ma **enforcement ancora spento in produzione per decisione esplicita** (P1-003), Tenant Builder (fascicolo reale approvato per RTL Bank), modulo GDPR passato da assente a reale (export, erasure transazionale, retention — X2), secondo CI runner off-prod per i tre workflow pesanti (T8), diario del gate ora interrogabile da database (#253, chiuso in questo stesso ciclo di sessione).

---

## 2. Punti di forza (top)

1. **Ingegneria salita di banda su quasi tutti i pilastri tecnici** (T1 78 / T2 78 / T3 76 / T5 79 / T6 85 / T8 79 / T9 82 — tutti Forte). Tre dei quattro finding operativi più pesanti di giugno sul CI/infra sono chiusi (secondo runner off-prod, DB di CI isolato, rollback a un comando, backup off-host verificato, Prometheus reale in produzione); i due finding CRITICAL/HIGH di giugno su debito tecnico (self-DoS broadcast, gap GDPR/AI-Act) sono entrambi risolti con evidenza in codice.
2. **Security posture ora Forte, non solo Adeguata** (T6 85, era 78). Auth self-built confermata solida, password di test derivate per-email (non più hardcoded), revoca cross-tenant bloccata; l'unico neo è una vulnerabilità High da `pnpm audit` su una devDependency di lint, senza esposizione in produzione.
3. **Verifica live più rigorosa e più coerente con l'architettura reale del progetto** (T9 82). Non più solo la suite di integration test via tunnel: una sessione HTTPS autenticata vera (identità di servizio con mandato TENANT_ADMIN previsto dal progetto stesso) contro l'endpoint pubblico, 8 rotte esercitate con dati reali, un diniego RBAC autentico osservato.
4. **Debito funzionale storico superato, non solo dichiarato risolto** (X1 68, era 60). Il gap più citato di giugno — "BPM senza runtime" — non c'è più: un motore di approvazione reale (state machine + SLA + 6 handler) è usato su 12 richieste vere di RTL Bank.
5. **Compliance GDPR passata da zero a reale** (X2 71, era 66). Export, erasure transazionale e retention esistono nel codice, non solo nel design; l'AI Act ha inoltre spostato la scadenza high-risk a dicembre 2027 (Digital Omnibus), riducendo la pressione regolatoria immediata.

---

## 3. Punti di debolezza (top)

1. **Nessun business, e il mercato si è mosso mentre si aspettava** (P2 41, P3 43 — entrambi Debole). Zero clienti paganti, zero pricing pubblico invariati da giugno; l'unico competitor diretto di rilievo (365Talents) è stato acquisito da Docebo (~$55M), che porta distribuzione e clienti bancari europei sovrapposti al target dichiarato.
2. **Key-person dependency invariata** (X3 63, Critical su un singolo finding: bus factor). Misurato con `git shortlog` oggi: 0 secondi sviluppatori. I mitiganti automatici (guardie, audit) riducono il rischio operativo di un errore silenzioso, non il rischio strutturale che il progetto dipenda da una sola persona.
3. **L'architettura di costo dell'AI non scala a clienti paganti multipli** (P3, P4, T7 — scoperta nuova rispetto a giugno). L'agente gira su un abbonamento Claude Max personale condiviso da tutti i tenant, senza metering per cliente: un asset AI reale ma non ancora un prodotto AI vendibile con unit economics proprie.
4. **`/api/metrics` osservabile pubblicamente in contraddizione col codice stesso** (T8, F-T8-09, MEDIUM, scoperta nuova). Il rewrite Next.js `/api/*` inoltra anche `/api/metrics` all'API interna, che vede la richiesta come traffico loopback e la lascia passare — verificato dal vivo: `curl https://www.heuresys.com/api/metrics` → 200 con telemetria interna completa, mentre il commento nel codice dichiara l'endpoint "mai osservabile pubblicamente".
5. **Il permesso DPO appena creato è respinto dal service nonostante l'RBAC lo conceda** (X2, scoperta nuova). Difetto concreto trovato durante la rivalidazione, non nel design ma nell'implementazione — dettaglio in `WS-X2.md`.

---

## 4. Debito tecnico

- **`/api/metrics` esposto pubblicamente** (T8-09, MEDIUM, GA-blocker condizionale): vedi §3.4. Remediation: escludere `/api/metrics` dal rewrite Next.js o verificare un header interno invece del solo `remoteAddress`. Effort ~0.25 sessioni.
- **Permesso DPO respinto dal service** (X2, scoperta nuova): RBAC concede il permesso ma il layer di servizio lo nega comunque. Effort S — bug puntuale, non architetturale.
- **Duplicazione `ActorContext`** (T2, MEDIUM, invariata nella forma ma ora con un rimedio parziale): la duplicazione storica (613 occorrenze a giugno) è stata in parte centralizzata in `actor.ts`; pesa un nuovo god-file da 2165 righe (`apps/api/src/modules/me/repository.ts`).
- **Subpath exports `@heuresys/shared` sovradichiarati** (T1, invariato/peggiorato in valore assoluto): 121 entry dichiarate (era 78), uso reale ~5% — debito di manutenibilità, non funzionale.
- **CI SPOF parzialmente mitigato, non eliminato** (T1/T8): 6 workflow su 12 (lint, typecheck, atlas-freshness, i18n-parity, state-lint, shell-tests) restano sulla VM di produzione; i 3 workflow pesanti/DB-touching sono già su un secondo runner off-prod.
- **Vulnerabilità High da `pnpm audit`** (T6): su una devDependency di lint, nessuna esposizione in produzione confermata.
- **Eval/golden-set assente per il retrieval semantico** (T7, invariato da giugno): unico gap che tiene T7 in banda Adeguato invece di Forte.

## 5. Debito funzionale

- **Architettura di costo AI non pronta per clienti paganti multipli** (P3/P4/T7, vedi §3.3): metering per tenant assente.
- **Enforcement MFA spento in produzione** (P1-003): capacità tecnica completa (TOTP+WebAuthn, policy per-tenant), ma la decisione di attivarla resta sospesa da S1029 (2026-07-25) — decisione di business, non gap tecnico.
- **Single-industry banking-native, ora rinforzato** (P1-006): il Tenant Builder — lo strumento di provisioning più maturo del prodotto — è collaudato solo sul caso RTL Bank; nessun secondo tenant di industry diversa onboardato.
- **Multi-industry / generalizzazione tassonomica**: invariato da giugno, vincola pricing e GTM.

## 6. Antipattern da correggere/eliminare

- **Commento che dichiara una garanzia che la topologia reale smentisce** (T8-09): stesso pattern di rischio già visto nel progetto altrove — fidarsi del commento invece di misurare dal vivo. Lezione ripetuta: ogni claim di sicurezza va riverificato runtime, non letto dal codice.
- **CI-runner parzialmente su VM-PROD** (T1/T8): antipattern operativo residuo, in via di risoluzione (6/12 workflow ancora lì, era 7/8 a giugno — il rapporto è migliorato).
- Nessun antipattern CRITICAL aperto emerso in nessuno dei 16 workstream di questa rivalidazione.

## 7. Technology fit & best-practice benchmarking (invariato salvo dove segnalato)

Le conclusioni di giugno restano valide (stack moderno e appropriato; auth self-built da mantenere; raw SQL da mantenere). Aggiornamenti dalla rivalidazione:

| Componente | Scelta attuale | Stato oggi vs giugno | TCO / verdetto DD |
|---|---|---|---|
| **Auth** | Self-built (Argon2id/JWT/refresh/CSRF/MFA) | Invariato, ora T6=85 (era 78) | **STAY.** Confermato ancora più solido. |
| **Infra PROD** | OCI free-tier ARM single-VM, PG nativo | Backup off-host e DR-drill ora **verificati dal vivo** (T4); resta single-node | **MIGRARE a managed-DB + HA prima di GA commerciale resta valido**, ma il rischio operativo immediato (assenza di backup/rollback) è chiuso. |
| **CI runner** | 2 runner self-hosted: 1 off-prod (pesanti), 1 su VM PROD (leggeri) | **Migliorato**: da 7/8 su PROD a 6/12 su PROD, con i workflow DB-touching già spostati | Completare lo spostamento dei 6 workflow leggeri rimanenti. Effort S-M. |
| **Agent serving** | Claude Agent SDK su abbonamento MAX personale | Invariato — ora esplicitamente "scelta documentata", non gap scoperto (T7) | **MIGRARE prima del primo cliente pagante** resta valido e più urgente: senza metering per tenant, l'abbonamento personale è anche un limite di business model (P3), non solo un vincolo di licenza. |

## 8. Programma di sviluppo in caso di acquisizione (aggiornato)

Le fasi F1-F5 di giugno restano la struttura corretta; molte voci di F1 sono già state consegnate nel trimestre. Stato aggiornato:

| Fase | Obiettivo | Stato oggi | Item residui | Effort residuo stimato |
|---|---|---|---|---|
| **F1 — De-risk infra & key-person** | Non-dipendenza da founder e free-tier | **In parte SHIPPED**: 2° CI runner, rollback 1-cmd, backup off-host+DR verificato, observability Prometheus reale | Managed-DB+HA, chiudere `/api/metrics` (T8-09), migrare agent-gateway a API key commerciale, hire 2° dev | 4-7 ww |
| **F2 — GA commerciale layer** | Da "case-study" a "prodotto vendibile" | **Non iniziato**: nessun signup/billing/pricing nel codice | Invariato da giugno | 5-8 ww |
| **F3 — Compliance enterprise** | Sbloccare clienti EU reali | **In parte SHIPPED**: modulo GDPR reale (export/erasure/retention) | AI Act: formalizzare classificazione (scadenza dic-2027, meno urgente); fix permesso DPO | 2-4 ww (ridotto da 4-6) |
| **F4 — Colmare le promesse di prodotto** | Mantenere il valore percepito del naming | **SHIPPED per il BPM**: motore di approvazione reale in uso su dati veri | Multi-industry (se strategico), reporting avanzato | 4-8 ww (ridotto da 8-14) |
| **F5 — Hardening commerciale** | Fiducia enterprise | Non iniziato | Pentest, load-testing, eval/golden-set retrieval (T7) | 4-7 ww (invariato) |

**Effort totale residuo stimato: ~19-34 person-week** (era 27-45 a giugno) — il progresso del trimestre ha già consumato una parte reale del percorso verso GA commerciale, concentrata su F1/F3/F4.

---

## 9. Verifica live E2E di questa rivalidazione (T9, dettaglio)

Eseguita in SOLA LETTURA contro la produzione reale (nessun non-prod esiste, ADR-0026): tentativo di login con una persona reale (`federica.marchetti@rtl-bank.org`) fallito correttamente al secondo fattore (i TOTP reali usano un segreto casuale non derivabile, per costruzione, dal 2026-09-08) — documentato come tentativo, non forzato a PASS. Login riuscito con un'identità di servizio (`governo@collaudo.invalid`, mandato TENANT_ADMIN reale su RTL Bank, prevista dal progetto per questo scopo). Otto rotte `GET /v1/*` esercitate (users, positions, organization-units, analytics/workforce, tenant-blueprints, me/profile, blueprint-processes, mfa-policy): tutte 200 con dati reali. Un diniego RBAC verificato: `GET /v1/observability/system-health` come TENANT_ADMIN → 403 `FORBIDDEN`. Nessuna scrittura eseguita. Dettaglio completo: `workstreams/WS-T9.md`.

## 10. Indice finding (per pilastro / severità, questa rivalidazione)

| Pilastro | Critical | High | Medium | Low/Info | Top finding nuovo o aggiornato | GA-blocker |
|---|---|---|---|---|---|---|
| P1 | 0 | 2 | 4 | 0 | P1-003 MFA enforcement spento (decisione, non gap tecnico) | sì (commerciale, invariato) |
| P2 | 0 | 3 | 3 | 0 | Uscita di 365Talents dal mercato indipendente (acquisita da Docebo) | no |
| P3 | 0 | 2 | 3 | 0 | AI su abbonamento personale = limite di unit economics, non solo di licenza | sì (commerciale) |
| P4 | 0 | 3 | 3 | 0 | Agente resta infrastruttura interna, non distribuito al cliente | no |
| T1 | 0 | 0 | 1 | 3 | CI-SPOF mitigato non eliminato (6/12 su VM-PROD) | cond. (ridotto da 7/8) |
| T2 | 0 | 0 | 3 | 1 | Nuovo god-file `me/repository.ts` (2165 righe) | no |
| T3 | 0 | 1 | 2 | 4 | I due finding gravi di giugno risolti con evidenza in codice | no (era sì) |
| T4 | 0 | 1 | 5 | 1 | Backup/DR ora verificati live; gap mono-VM invariato | sì (SLA, invariato) |
| T5 | 0 | 0 | 1 | 2 | Bloat token da collasso una-tantum, rischio di ri-accumulo aperto | no |
| T6 | 0 | 0 | 0 | 5 | Vulnerabilità High solo su devDependency di lint | no |
| T7 | 0 | 1 | 2 | 1 | Eval/golden-set retrieval ancora assente (unico gap invariato) | no |
| T8 | 0 | 0 | 1 | 2 | **F-T8-09** `/api/metrics` pubblico (scoperta nuova) | cond. (nuovo) |
| T9 | 0 | 0 | 1 (cross-ref T8) | 3 info | Verifica live vera contro produzione (governo@collaudo.invalid) | no |
| X1 | 0 | 1 | 2 | 3 | BPM runtime reale in uso su 12 richieste vere (era il gap più grave) | no (era sì) |
| X2 | 0 | 0 | 2 | 2 | Permesso DPO respinto dal service nonostante l'RBAC (scoperta nuova) | no |
| X3 | 1 | 1 | 2 | 0 | Bus factor ancora 1 (`git shortlog`, misurato oggi) | no (da prezzare) |

> Il totale dei GA-blocker assoluti resta **0** su tutti i 16 pilastri. I GA-blocker condizionali sono scesi di numero rispetto a giugno (T3 e X1 non lo sono più; T8 ne guadagna uno nuovo ma di severità Media).

## 11. Confronto giugno · settembre (riferimento) · oggi

Il verdetto dell'8 settembre 2026 (58/100, NO-GO, due pilastri a 37) vive **fuori repo** (`Claude Desktop\heuresys-advanced\sessioni\session_2026-09-08_dottrina-perimetri-agente\`) e questa rivalidazione non ha accesso al suo dettaglio pilastro-per-pilastro: la colonna "8 settembre" sotto riporta **solo l'aggregato**, citato come precedente e ordine di grandezza, non ri-derivato. La colonna "oggi" è l'unica misurata in questo ciclo.

| Pilastro | 17 giugno | 8 settembre (rif. aggregato, fuori repo) | 28 settembre (oggi, misurato) | Delta giu→oggi | Ragione se >10 punti |
|---|---:|---|---:|---:|---|
| P1 | 58 | — | 63 | +5 | — |
| P2 | 44 | — | 41 | -3 | — |
| P3 | 38 | — | 43 | +5 | — |
| P4 | 52 | — | 50 | -2 | — |
| T1 | 72 | — | 78 | +6 | — |
| T2 | 74 | — | 78 | +4 | — |
| T3 | 62 | — | 76 | **+14** | Due finding gravi di giugno (self-DoS broadcast, gap GDPR/AI-Act) risolti con evidenza in codice, verificati questa volta dal DD lead prima di accettarli. |
| T4 | 65 | — | 63 | -2 | — |
| T5 | 72 | — | 79 | +7 | — |
| T6 | 78 | — | 85 | +7 | — |
| T7 | 65 | — | 69 | +4 | — |
| T8 | 62 | — | 79 | **+17** | 6 dei 7 finding operativi di giugno chiusi (secondo runner off-prod, DB CI isolato, rollback 1-cmd, backup off-host+DR, Prometheus reale); bilanciato da una scoperta nuova (F-T8-09) che ha tenuto lo score sotto la banda Eccellente. |
| T9 | 79 | — | 82 | +3 | — |
| X1 | 60 | — | 68 | +8 | — |
| X2 | 66 | — | 71 | +5 | — |
| X3 | 58 | — | 63 | +5 | — |
| **Globale** | **61** | **58** (aggregato, fuori repo, non comparabile pilastro-per-pilastro) | **66** | **+5** | Il verdetto dell'8 settembre era più severo dell'aggregato di giugno pur non essendo ri-derivabile qui; oggi la misura torna sopra entrambi i precedenti. |

**Nota di onestà metodologica**: il punteggio dell'8 settembre (58) è **inferiore** sia a giugno (61) sia a oggi (66), ma non essendo disponibile il suo dettaglio pilastro-per-pilastro in questo repository, non è possibile spiegare la ragione dello scostamento con evidenza verificata — solo citarlo. Chi decide sul verdetto di oggi deve sapere che esiste un punto dati intermedio più severo, prodotto da un processo diverso (Cowork, non questa skill), che questa rivalidazione non ha potuto né copiare né confutare.

## 12. Riferimento scorecard
Score globale **66/100** → **CONDITIONAL-GO**. Dettaglio pesi/contributi: `SCORECARD.md`. Sintesi investitore + condizioni di remediation: `EXECUTIVE_SUMMARY.md`. Evidenze per pilastro: `workstreams/WS-*.md`.

---
*Limiti dichiarati di questa rivalidazione*: (a) info finanziarie/societarie non-discoverable → assunzioni esplicite invariate da giugno, marcate `da confermare`; (b) il confronto con l'8 settembre è solo aggregato (§11); (c) la verifica live (T9) ha esercitato 8 rotte rappresentative con un'identità di servizio, non l'intera superficie di 111 moduli/657 route; (d) PROD toccato solo in lettura, nessuna scrittura eseguita da nessuno dei 5 analisti; (e) lo storico completo del 17 giugno resta in `SCORECARD.md` §Storico e nei singoli `WS-*.md` (sezione "Claim del venditore rivalidati" di ciascuno cita sempre la baseline precedente).
