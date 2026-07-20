# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-07-20 (S1022 — mandato forense ESEGUITO: audit + verdetto CONDITIONAL-GO + remediation R1-R4, **D-58 RISOLTO e LIVE in PROD**).

> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Audit S1022 → `docs/kb/full-forensic-audit/AUDIT_FORENSE_heuresys_2026-07-20_022239.md`.

## Last session brief (S1022)

Eseguito il **mandato forense** (memoria `project_next_session_forensic_mandate`): audit read-only intero repo + gate avvocato-del-diavolo + verdetto finance-readiness. **Fan-out multi-agente fallito su session-limit account** (reset 6:20am) → audit completato in main thread, evidence-based (verifica di persona = gate fp-check). **8 finding verificati** (0 Critical/1 High/3 Medium/4 Low) + 4 refutati + 7 asset. Scorecard: arch 83 / security 85 / db 76 / test 80. I **4 TP storici (S1014) tutti chiusi** (secrets · open-redirect · CSV · fork-runner); 0 vuln pnpm; SQL 100% param; authz completa (gate boot). **Verdetto: CONDITIONAL-GO** (competenza esecutiva dimostrata; 3 condizioni). **Remediation eseguita**: **R1 D-58 RISOLTO e DEPLOYATO** (exports condizionali dev(src)/prod(dist) + `emitDeclarationOnly:false` + tsup `--conditions development`; www 200, next build verde in PROD — corretti 3 fix in catena dopo un mio errore sul gate tsup, riconosciuto) · **R3 17 indici FK applicati LIVE** (mig 000182) · **R4 drop dead-schema OU** (mig 000183, apply al deploy). **Doc-tank**: backup completo (`../heuresys-advanced-docs-tank/archivio-2026-07-20`) + clone rigenerato (`clone-2026-07-20`, README/START_HERE ricreati, CLAUDE.md drift-corretto, MANIFEST + validazione). **2ª parte (fan-out ripristinato)**: **R2 F4 RISOLTO e LIVE** (mig 000184, RULE-B, 1086 righe; DoD: alice.rossi OWNER reale vede 38 partecipanti) · **audit 8-P1** (2/8 difetti: F4 fatto, B3 event-driven empty-by-design) · **WS-L** + **triage D-01..D-14** FATTI.

## Top priorities (next session)

Il debito strutturale genuino residuo = **3 epiche su branch** (dal triage D-01..D-14):
1. **D-08 — CI-SPOF** (GO-BRANCH): il runner self-hosted **è** il PROD host + la CI gira sul **DB prod** + `main` non protetto → separare CI/DB (`heuresys_ci`) + runner off-prod (linux-pc twin già pronto) + required-checks + deploy atomico.
2. **D-14 — provisioning + GDPR** (GO-BRANCH, §3.1 IBRIDO PM-approvata S987, 0 live): provision-engine self-service transazionale + GDPR-tooling minimo (DSR/retention).
3. **D-09 — observability** (GO-BRANCH): `/metrics` Prometheus + persistenza (oggi solo ring in-RAM volatile).

Coda: GO-INLINE (D-03 subpath exports / D-04 loading-error boundary / D-11 brownfield freeze-flag) · **D-59** retention login-events (policy) · **#65** NACE 920 orfani · unit-layer (F-A07).

## Open questions (autorità *cosa* = Enzo)

- **R2 sorgente**: da dove popolare `sys_process_participants` (legacy heuresys-evo o materializzazione)?
- **NACE 920 orfani**: pulire i dati o documentare la scelta adjacency-senza-integrità-parent?
- **Retention login-events** (F-A02): periodo + archive vs delete (audit-log security).
- **Doc-tank clone**: rimpiazzare `docs/` con `clone-2026-07-20` dopo ri-sync SoT? (decisione Enzo).
- WAIT-INPUT invariati: **#4** pricing · **#8** app-password Outlook · **#16** SuccessFactors · **#52** SSO IdP.

## Verification (next session)

```bash
git log origin/main..HEAD --oneline               # 0 dopo il push handoff
python docs/kb/tools/handoff_lint.py              # OK atteso
ls db/migrations/*.sql | tail -1                  # 000183
curl -s -o /dev/null -w "%{http_code}" https://www.heuresys.com/login   # 200 (D-58 live)
python docs/kb/tools/session_start.py             # menu + salute
```
