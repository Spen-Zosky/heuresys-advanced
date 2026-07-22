# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-07-22 (S1025 — D-74 chiuso + #70/#71 + audit per-user + Fase 4 census).

> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Report sessione → `docs/kb/db-forensics/USER_ROLE_COHERENCE_2026-07-22.md` + `docs/kb/frontend-forensics/F4_SURFACE_CENSUS_2026-07-22.md`.

## Last session brief (S1025)

Batch Enzo eseguito end-to-end: **D-74 CHIUSO** (unique index skill ripristinato con codice conflict-aware + eredità categorie perse dal dedup; CI integration verde dopo 4 run rosse; **i18n deployato in PROD**) · **#70 FATTO** (6 ruoli chiave coperti con riassegnazioni interne; catene assignment riparate) · **#71 FATTO** (minimi CCNL Credito rispettati, junk learning/career purgato con archivio, catalogo formativo bancario reale mappato alle skill) · **audit coerenza per-user FATTO a livello archetipo** (ogni utente ha ruolo organizzativo; residuo → #72) · **Fase 4 (#68): census meccanico COMPLETO** (68 route × 3 personas, spec `f4-sweep` riusabile) + **7 fix chirurgici verificati** (3 a11y incl. contrasto org-chart, header ruoli, self-assessment, copy organigramma, system-health) + **regressione italiano-di-default** (`default-locale.spec.ts`). Due bug API reali corretti (500 gap-results, orfani insights). Tutta la suite test ora deriva le attese dai dati (no conteggi pinnati). PROD = HEAD, CI tutta verde.

## ⚠ Top priorities (next session)

1. **#72 Audit per-user — dimensioni residue** (~1 sessione, P1) — education↔ruolo, KPI/OKR per ruolo, pattern attendance, anagrafiche satellite, lead DIR-RISKM. Metodo e stato in `docs/kb/db-forensics/USER_ROLE_COHERENCE_2026-07-22.md` §4.
2. **#68 Fase 4 — esecuzione P2** (~1 sessione, P1) — worklist clusterizzata in `docs/kb/frontend-forensics/F4_SURFACE_CENSUS_2026-07-22.md` §3: label-layer per gli enum di stato (cluster più grosso), codici tecnici/UUID renderizzati, pagine ESS sottili, pass qualitativo "a occhio", showcase/pubbliche, preload i18n (flash EN).
3. **#24 ADR-0027 F4** (asse funzionale/attività) — resta il P1 architetturale pre-esistente.

## Open questions (autorità *cosa* = Enzo)

- **Wave-3 (#17)** — sblocca il Blocco E Fase 3 (chiusura brownfield DBMS legacy VM). In HOLD.
- WAIT-INPUT invariati: **#4** pricing · **#8** app-password Outlook · **#16** SuccessFactors · **#52** SSO IdP.

## Verification (next session)

```bash
git log origin/main..HEAD --oneline               # 0 dopo il push handoff
python docs/kb/tools/handoff_lint.py              # OK atteso
ls db/migrations/*.sql | tail -1                  # 000198
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "SELECT count(*) FROM sys.sys_users"  # 163
python docs/kb/tools/session_start.py             # menu + salute
```
