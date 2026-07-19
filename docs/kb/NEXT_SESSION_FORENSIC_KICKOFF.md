# NEXT SESSION — Forensic Review + Finance-Readiness Verdict (KICKOFF)

**Autorità del mandato**: Enzo, chiusura S1021 (2026-07-20).
**Priorità**: PRIMA DI OGNI ALTRA COSA nella prossima sessione fresca. Non aprire il menu azioni, non riprendere il batch: esegui questo.

---

## 0. Il mandato, testuale

Enzo teme di aver prodotto *"una piattaforma molto scadente che non potrà mai ricevere finanziamenti"* e vuole la prova che l'esecutore (Claude) *"ha le competenze per lavorare su progetti così complessi ed estesi"*. Quindi:

1. **Review forense dell'INTERO progetto** — ogni componente e stack, non un campione: DB (schema, migrazioni, integrità, dati), API (Fastify, moduli, auth, RBAC, scope), web (Next.js, build, a11y, perf), `@heuresys/shared`, CI/CD, deploy/infra (VM + linux-pc twin), ecosistema Claude. Riportare **TUTTI** i problemi.
2. **Valutazione status quo** — onesta, senza minimizzazione (Enzo lo vieta) né ottimismo di comodo.
3. **Confronto ADVERSARIAL** — un agente "avvocato del diavolo" attacca ogni conclusione (specie quelle positive) prima che venga accettata.
4. **Dichiarazione finale** — solo dopo il gate adversarial: sono in grado di risolvere tutti i problemi e proseguire uno sviluppo che **merita il finanziamento**? Verdetto GO / CONDITIONAL-GO / NO-GO, evidence-based.

## 1. Vincolo cardine (non negoziabile)

**SOLO soluzioni professionali, stabili, avanzate. ZERO workaround, ZERO semplificazioni, ZERO scorciatoie, ZERO placeholder.** Se la fix corretta è grande, si dimensiona e si fa bene. Questo è già DoD vincolante (ADR-0026) + regola Enzo S1021. Ogni proposta di remediation va giudicata anche su questo asse: "è la soluzione giusta o un tampone?".

## 2. Come eseguire (strumenti già in casa)

- **`full-forensic-audit`** (skill) — audit read-only di heuresys-advanced, output versionati in `docs/kb/full-forensic-audit/`. Punto di partenza.
- **`saas-investor-due-diligence`** (skill) — DD investor-grade, scoring 0-100 su 15 pilastri, verdetto GO/CONDITIONAL-GO/NO-GO. È il framework che risponde alla domanda "merita finanziamento".
- **`forensic-100x-kickoff`** (skill) — genera il prompt parametrizzato di audit se serve strutturare l'intervista iniziale.
- **`superpowers:dispatching-parallel-agents`** — fan-out per coprire gli stack in parallelo.
- **Agente avvocato del diavolo** — un subagent dedicato istruito a REFUTARE ogni finding "risolvibile" e ogni verdetto positivo; il verdetto sopravvive solo se regge all'attacco.
- **Workflow multi-agente (ultracode)** — se Enzo lo autorizza esplicitamente, orchestrare find→verify-adversarial→synthesize su tutti gli stack. Chiedere prima (opt-in richiesto).
- **Metodo**: ogni claim evidence-based (grep/query/test reali con path+output+timestamp — R5/R20), mai a impressione. Risk register quantificato (prob × impatto × mitigazione).

## 3. Stato al punto di partenza (verificare live, non fidarsi di questi numeri)

- **Git**: main @ `6db1b250` (pushato fino a `bfc346b6`; `6db1b250` = commit locale D-58, verificare se pushato). Batch S1021 = 15 commit `bae0a7ef..6db1b250`.
- **DB**: 179 migrazioni (`000001..000181`), 13 ruoli RBAC / 176 perm / 776 map, 2 tenant, 162 utenti. Ri-derivare: `python docs/kb/tools/session_start.py`.
- **Gate CI**: API suite ~1394 test verdi, typecheck/lint/i18n/state-lint verdi. **Playwright-smoke ROSSO** (D-58).

## 4. Debiti aperti noti (input all'audit, NON esaustivi — l'audit ne troverà altri)

Fonte viva: `docs/kb/DEBT_REGISTER.md`. Al 2026-07-20:
- **D-58** 🟠 — CI web build (Turbopack) non risolve il barrel `.js` di `@heuresys/shared`. **Diagnosi definitiva già fatta** (non è codice, è toolchain; Turbopack risolve il src via `main`; 4 fix config tentati e falliti). **3 opzioni di fix nel register: A** (main/default→dist, tocca API 272 import, verifica full-suite) · **B** (web→solo subpath, no rischio API, 74 import) · **C** (webpack invece di Turbopack). **Enzo NON ha scelto l'approccio** — è la prima decisione tecnica da sciogliere, con soluzione professionale (non tampone).
- **D-57** 🟠 — grant a tappeto TENANT_ADMIN (`000005` CROSS JOIN): ogni permesso nuovo gli viene concesso in automatico. Mitigato sui casi noti, fix strutturale (allowlist curata) in attesa di Enzo.
- **D-55** 🟢 — flake intermittente login MFA (TOTP step-2 500).
- **D-56** ⚪ — claude-mem disabilitato (workaround locale).

## 5. Il tema di fondo emerso in S1021 (da indagare a fondo nell'audit)

In un solo batch sono emersi ~10 difetti pre-esistenti che i test verdi NON coprivano:
- catalogo skill invisibile a ogni tenant (14 036/14 093 orfane) con 844 requisiti già agganciati;
- badge che mostrava un dato FALSO ("FACOLTATIVO") su ogni percorso formativo;
- flight-risk che usava 1 sorgente engagement su 3 (~29% del segnale);
- N+1 di round-trip in un producer notifiche;
- `db:validate` rotto su Windows; drift schema↔contratto in più pagine; censimento di test congelato che chiedeva manutenzione manuale.

**Il pattern**: "verde" non significa "corretto". L'audit deve assumere che ogni componente nasconda difetti analoghi non catturati dai test, e cercarli attivamente. Domanda-guida dell'adversarial: *"quale parte sembra a posto solo perché nessun test la interroga davvero?"*.

## 6. Output atteso della sessione forense

1. Report forense completo per stack (versionato in `docs/kb/full-forensic-audit/`).
2. Scorecard finance-readiness (pilastri + punteggio + verdetto).
3. Verbale del confronto adversarial (cosa l'avvocato del diavolo ha contestato e come ha retto/ceduto).
4. **Dichiarazione onesta**: GO / CONDITIONAL-GO (con condizioni) / NO-GO, sulla capacità di portare il progetto a livello finanziabile.
5. Piano di remediation dimensionato (per il debito trovato), da eseguire in batch successivi con il vincolo "solo soluzioni professionali".
