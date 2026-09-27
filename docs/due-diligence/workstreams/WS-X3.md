# WS-X3 — Execution Risk / Team & Bus Factor
Agente: Cross-cutting (avversariale) | Modello: Claude Sonnet 5 | Data: 2026-09-28
HEAD: `5faa2bc2ca78c40bec603e77df9da176c6971337`

> Rivalidazione della due diligence del 2026-06-17 (HEAD `ce26608`). Numeri misurati direttamente in questa sessione con `git shortlog`, `git log --since`, `git rev-list --count`, conteggio file ADR/`.md`, grep su `docs/kb/DEBT_REGISTER.md`.

## Sintesi

Il rischio strutturale dominante — bus factor umano = 1 — è **invariato**: `git shortlog -sn --all` misura oggi 2656 commit di Enzo Spenuso + 173 di Spen-Zosky (stessa persona, due identità git) + 15 di `dependabot[bot]`, nessun secondo essere umano è mai comparso nella storia del repository. Non è comparso un co-founder tecnico né un secondo committer dal giugno 2026. Tre mitiganti sono però cresciuti in modo misurabile: (1) un canale di audit esterno automatizzato e indipendente dal founder (`.codex/`, read-only, confermato in CLAUDE.md) si è ampliato sostanzialmente; (2) un motore di guardie meccaniche (`.claude/enzo-guard.json`) riduce l'affidamento sulla sola disciplina personale per path protetti, nomi DB e migrazioni dirette; (3) è comparso, sia pure raramente, un flusso di PR-review reale (5 merge da `v1.0.0` a oggi contro 0 di giugno, incluso un vero merge di Pull Request GitHub #81), a fronte comunque di 2328 commit diretti nello stesso intervallo — la percentuale di merge resta sotto l'1%. La documentazione è raddoppiata in volume (23 → 40 ADR, 289 → 488 file `.md`) e il registro debiti è cresciuto da 37 a 92 voci mantenendo un tasso di chiusura vicino al 100%, confermando il pattern di trasparenza "il venditore sottostima sé stesso" già osservato a giugno. Restano assenti CONTRIBUTING.md e ONBOARDING.md, e permangono branch/worktree stale non ripuliti.

## Claim del venditore rivalidati

| # | Claim | Esito | Evidenza |
|---|---|---|---|
| — | "Single developer / sole coder" | **CONFERMATO, invariato** | `git shortlog -sn --all`: 2656 Enzo Spenuso + 173 Spen-Zosky (stessa persona, due identità git) + 15 dependabot[bot]; nessun terzo umano |
| — | "0 merge su commit dal v1.0.0, tutto direct-to-main" | **PARZIALMENTE SMENTITO** | `git log v1.0.0..HEAD --merges --oneline \| wc -l` → 5 merge oggi (contro 0 a giugno), incluso un vero merge di PR GitHub (#81); resta comunque <1% dei 2328+ commit nello stesso intervallo |
| — | "CONTRIBUTING/ONBOARDING assenti" | **CONFERMATO, non risolto** | Nessun file trovato sotto la root del repository |
| — | "DEBT_REGISTER onesto, drift per-difetto" | **CONFERMATO E RAFFORZATO** | `grep -oE "D-[0-9]+" docs/kb/DEBT_REGISTER.md \| sort -u \| wc -l` → 92 debiti censiti (erano 37 a giugno), nessuna voce "APERTO" residua trovata con grep mirato |
| — | "Doc abbondante ma con drift cronico" | **PARZIALMENTE MIGLIORATO** | ADR: `ls docs/architecture/adr/ \| wc -l` → 40 (erano 23), includono ADR-0040/0041/0042 sulla governance dell'agente stesso; `.md` totali sotto `docs/`: 488 (erano 289) — crescita continua, non stagnazione |

## Finding

**X3-001 · Bus factor = 1: dipendenza da key-person totale e non mitigata · Critical · risk**
Evidenza: `git shortlog -sn --all` — 2656+173 = 2829 commit di una sola persona (99,5% del totale, `dependabot[bot]` = 15) su 2844 commit complessivi (branch `all`); nessun secondo umano è mai comparso. Architettura idiosincratica che amplifica la dipendenza: niente Docker (ADR-0004), DB raggiunto via tunnel SSH su VM OCI free-tier personale, `agent-gateway` su abbonamento Claude MAX personale del founder, CI self-hosted sulla stessa VM di produzione.
Impatto: è il rischio dominante per un investitore. Se il founder diventa indisponibile, il prodotto smette di essere **operabile** (chi rinnova il tunnel, gestisce il CI-runner-che-è-la-prod, paga l'abbonamento che fa girare l'agent-gateway) prima ancora che di essere **sviluppato**.
GA-blocker: no come stato tecnico attuale; sì come rischio di investimento — condiziona qualunque term-sheet (retention founder, vesting, key-person insurance).
Remediation: hiring di un secondo sviluppatore come primo use-of-funds; de-personalizzare l'infrastruttura (DB su OCI Managed, CI runner separato dalla VM prod, agent-gateway su API-key/contratto invece che abbonamento personale). Effort: organizzativo, non risolvibile solo in codice — componente tecnica **M**. Confidence: Alta.

**X3-002 · Onboarding ripido: CONTRIBUTING/ONBOARDING ancora assenti, branch stale accumulati · High · tech-debt/process**
Evidenza: nessun `CONTRIBUTING.md`/`ONBOARDING.md` nel repository (verificato); branch locali residui (`backup-s940-rollback`, `feat/zod4-ftpz6`, `d08-f5-offprod-runner`, tra gli altri) più worktree-agent multipli sotto `.claude/worktrees/`.
Impatto: un nuovo sviluppatore ha una base documentale densa (40 ADR, 488 `.md`) su cui orientarsi, ma nessun punto d'ingresso strutturato; deve ricostruire da solo il percorso di onboarding e distinguere i branch vivi da quelli stale.
GA-blocker: no.
Remediation: CONTRIBUTING.md + ONBOARDING.md + pulizia branch/worktree stale. Effort **S**. Confidence: Alta.

**X3-003 · Governance in leggero miglioramento: primi merge PR reali, ma ancora <1% del flusso · Medium · process**
Evidenza: 5 merge (`git log v1.0.0..HEAD --merges`) contro 0 di giugno, incluso un vero merge di Pull Request GitHub (#81); il resto — oltre 2300 commit nello stesso intervallo — resta direct-to-main. CI ancora self-hosted sulla VM di produzione (invariato da giugno secondo la baseline).
Impatto: il modello operativo per un solo sviluppatore resta pragmatico, ma la comparsa (sia pure marginale) di un flusso di revisione è un segnale di direzione corretta più che di risoluzione del problema.
GA-blocker: no; diventa prerequisito al primo hire.
Remediation: branch-protection + PR-review obbligatoria + CI separata dalla VM prod. Effort **M**, gated dal secondo hire. Confidence: Alta.

**X3-004 · Mitiganti automatici cresciuti: audit esterno indipendente e guardie meccaniche · Medium · strength**
Evidenza: `.codex/` (canale di audit di Codex, read-only, esplicitamente distinto dal founder — confermato in CLAUDE.md: "non sono file da pulire né da mantenere... non si usano le sue credenziali") si è ampliato in sottocartelle (`adversarial/`, `documentation-audit-*/`, `evidence/`, `manifests/`, `reports/`); `.claude/enzo-guard.json` introduce un motore di regole automatiche (protected paths, allowlist DB-name/porta, blocco migrazioni dirette) che sostituisce parte della supervisione umana con un cancello meccanico verificabile.
Impatto: non elimina il bus factor umano, ma riduce il rischio che un errore di distrazione o un'azione distruttiva sfugga in assenza di un secondo paio d'occhi umano — è un fattore di de-risking reale e misurabile, non promesso.
GA-blocker: no (è positivo).
Remediation: nessuna correttiva; capitalizzare estendendo le guardie meccaniche man mano che emergono nuovi path/oggetti condivisi. Effort **—**. Confidence: Alta.

**X3-005 · META-FINDING — Trasparenza: il venditore continua a sottostimare sé stesso · Positiva (asset DD) · strength**
Evidenza: il registro debiti è passato da 37 a 92 voci senza che comparisse alcun "APERTO"/"blocked-on-Enzo" residuo (grep mirato, esito negativo); a giugno il pattern era identico su scala minore (counts SoT sistematicamente per-difetto, auto-audit che dichiarava assenti feature poi trovate presenti).
Impatto: per la due diligence è un fattore di de-risking forte — un venditore che continua a esporre spontaneamente il proprio debito, anche quando cresce di volume, abbassa il rischio di sorprese post-acquisizione. Non compensa il bus factor, ma riduce l'incertezza su "cosa non sappiamo ancora".
GA-blocker: no.
Remediation: nessuna correttiva. Effort **—**. Confidence: Alta.

## Score del pilastro

Score: **63 / 100 (Adeguato, limite basso)** | Confidence: Alta

Motivazione: il delta rispetto a giugno (58 → 63) riflette un fatto misurato, non un cambio di percezione: il bus factor umano resta 1 e invariato (X3-001, peso massimo nella valutazione), ma tre mitiganti sono cresciuti in modo verificabile dal 17 giugno — l'audit esterno indipendente (`.codex/`) si è ampliato, è comparso un motore di guardie meccaniche (`enzo-guard`) che riduce l'affidamento sulla sola memoria/disciplina del founder, e un primo flusso di PR-review reale è comparso (X3-003/X3-004). Non salgo oltre 63 perché CONTRIBUTING.md/ONBOARDING.md restano assenti (X3-002, remediation non eseguita da giugno) e il 99%+ del flusso di lavoro resta direct-to-main senza revisione. Non scendo sotto 60 perché la trasparenza del venditore resta eccezionale ed è essa stessa un fattore di de-risking misurabile (X3-005). Il risultato netto è "Adeguato al limite basso": il rischio key-person resta strutturale e non risolvibile in codice, ma è onestamente esposto e in leggero, misurabile miglioramento rispetto a tre mesi fa.
