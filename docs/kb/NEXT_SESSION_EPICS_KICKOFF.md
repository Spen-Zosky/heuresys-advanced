# NEXT SESSION — Residuo epiche GO-BRANCH (KICKOFF)

> **✅ ESEGUITO S1023 (2026-07-21)** — mandato completato (D-08 F2-F5, D-14 F2-F4, D-09 F5 + coda). Documento storico. Kickoff successivo: `NEXT_SESSION_DB_FRONTEND_FORENSICS_KICKOFF.md`.

**Autorità del mandato**: Enzo, chiusura S1022 (2026-07-20/21).
**Priorità**: fresh session dedicata al residuo delle 3 epiche GO-BRANCH. Le fasi F1 autonome sono già in produzione (S1022); qui si completa il resto — **e da ora è TUTTO Claude-executable** (Enzo ha delegato le decisioni tecniche, `[[feedback_claude_decides_technical]]`).

---

## 0. Lo standard di lavoro (NON aspirazionale — è il contratto operativo)

Questa sezione esiste perché la qualità di una sessione NON si eredita dal "mood": si eredita da queste pratiche, che vanno applicate SEMPRE. Non sono suggerimenti — sono il gate d'ingresso.

1. **Verifica dal reale, mai dalla doc** (`[[feedback_code_over_docs]]`). Ogni numero/stato/comportamento si prova con `psql`/`git grep`/route reali/curl. La doc di questo repo è cresciuta nel tempo ed è inaffidabile: NON citarla come fonte.
2. **Evidence, non impressione** (R5 test-before-claim). Ogni claim ha comando + output. Zero "dovrebbe", zero stime a memoria (R20).
3. **Gate meccanici prima di "fatto"**: typecheck + test + build (tsup/next) + **verifica LIVE su dati reali** (DoD ADR-0026). "Green test" = in-progress, MAI done. Un endpoint è "done" solo con una dimostrazione live (login persona reale, curl, count DB).
4. **Riconosci e correggi ogni errore, subito** (R3/R4). In S1022 ne sono emersi 3 (gate tsup saltato, dato stale propagato, peer-auth). Nessun "pre-esistente", nessuna scusa. Il codebase si lascia migliore.
5. **Solo soluzioni professionali** (mandato Enzo, vincolante): zero workaround/scorciatoie/placeholder/euristiche arbitrarie. Se il fix corretto è grande, si dimensiona e si fa bene.
6. **Claude decide il tecnico** (`[[feedback_claude_decides_technical]]`): scope GDPR, topologia CI, design — li decido io con criteri best-practice/top-developer/obiettivo-SAP. A Enzo solo business puro + input-solo-suo.
7. **Cambi strutturali su branch dedicato + gate verdi + commit atomici**; merge in main solo a gate verdi; push/deploy = azione consapevole (in-sessione l'autorizzazione è session-scoped).
8. **Fan-out per l'esplorazione, sintesi nel main thread** (mai delegare la sintesi). Il fan-out multi-agente è disponibile (in S1022 un rate-limit temporaneo l'aveva bloccato ma si è ripristinato).

Se una sessione salta questi punti, la qualità cala — non per mancanza di concentrazione, ma per aver saltato il processo. Il processo è qui apposta.

## 1. Stato reale al kickoff (ri-verificare live — non fidarsi di questi numeri)

- **HEAD**: main `a7531adc` (S1022, 18 commit). Ri-derivare: `python docs/kb/tools/session_start.py`.
- **In PROD/main (S1022)**: D-58 risolto · R3 FK-index (000182) · R4 dead-schema (000183) · R2 F4 (000184, `sys_process_participants` 1086 righe) · **D-09** /metrics (gated OFF) · **D-14 F1** provision-engine (`POST /v1/tenants/provision`) · **D-08 F1** CI su `heuresys_ci` (DB isolato, mai più PROD).
- **Verdetto finance-readiness**: CONDITIONAL-GO (audit `docs/kb/full-forensic-audit/*_2026-07-20_022239.*`).

## 2. Il residuo — spec eseguibili in `docs/kb/improvement/EPICS_SPEC_S1022.md`

Ordine consigliato (impatto/rischio; tutto Claude-executable):

1. **D-08 F5 — 2° runner off-prod su linux-pc** (PRIMA: chiude lo SPOF — in S1022 le run CI erano in coda >1h sul runner unico==PROD). Registrare linux-pc (192.168.1.11, twin x86_64 con DB locale) come self-hosted runner `off-prod`, spostare i gate DB a girare sul DB LOCALE del twin. Poi **F4** required-checks su main (typecheck+lint per iniziare), **F2** deploy-gate-CI in vm-deploy, **F3** cgroup resource-slice.
2. **D-14 F2-4 — completezza provision + GDPR-tooling**. F2 ruoli/archetipo/feature-flag. **F3-4 GDPR** (scope tecnico deciso da Claude, best-practice): DSR-export (satelliti `sys_user_*`, formato), erasure vs legal-hold (payroll/contratti = ritenzione legale), retention per data-class, consent-ledger. Dimostrato su RTL Bank.
3. **D-09 F5 — collector systemd VM** + retention (abilitare `PROM_METRICS_ENABLED=true` sulla VM via env-key-merge, collector che scrapa 127.0.0.1:8013/metrics).

Coda non-epica (register/DEBT): GO-INLINE D-03/04/11 · D-59 retention login-events · #65 NACE 920 orfani · unit-layer (F-A07).

## 3. Boot della sessione

`python docs/kb/tools/session_start.py` (menu + salute, 1 round). Poi questo kickoff + `EPICS_SPEC_S1022.md`. NON aprire il menu generico prima: questa è la priorità.
