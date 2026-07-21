# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-07-21 (S1024 — mandato forense Fasi 1-3 eseguite; Fase 4 da fare).

> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Diagnosi+piani forensi → `docs/kb/db-forensics/F2_DB_CENSUS_2026-07-21.md` + `F3_SEMANTIC_COHERENCE_2026-07-21.md`.

## Last session brief (S1024)

Mandato forense S1023 eseguito su 3 fasi (di 4). **Fase 1** (debiti): ogni riga del register verificata contro codice/DB, D-61..D-73 nuove, fix parser dashboard (D-57 era invisibile) + 8 righe malformate. **Fase 2** (DB capillare): census 7 analisi + mig 000188 (igiene: indice lineage anti-10.9B-tuple, 3 FK, offboarding, 5 indici morti) + 000189 (dedup 24 skill, 573 ref repointate) + **bilinguismo IT/EN COMPLETO** (ADR-0029: mig 000190-000191, tabella `sys_reference_translations` + 29.511 traduzioni — 358 governance + 14k skill + 640 gruppi da dataset **ESCO ufficiale IT+EN** fornito da Enzo, NO fetch live) + **ontologia 100%** (ADR-0030: mig 000192, `sys_skill_groups` 640 nodi gerarchia 4 livelli, 13.647 skill→gruppo, 6.456 IS-A; copertura 99,4%) + **wiring API i18n** (middleware `req.locale` + overlay su skills+cataloghi, test verdi). **Fase 3** (coerenza/seeding/brownfield): mig 000193 (drop 34 residui brownfield morti) + seed banking RTL (792 requisiti + 576 possessi + 156 gap ricalcolati con position_id — sostituito il seed demo) + comp/date (salari monotoni per banda 32k→212k, 8 executive→Dirigente, date sintetiche corrette, 468 pay-slip) + org (Tesoreria + Internal Audit + 18 posizioni, org integro). **16 commit sul branch `forense/f2-db-hygiene`** (merge in main nel handoff). DB condiviso già popolato live.

## Top priorities (next session) — ORDINE ENZO S1024

1. **#70 Coprire i ruoli chiave vacanti RIASSEGNANDO dipendenti esistenti** (~0.5 sessione) — CRO, Capo Tesoreria, capi delle nuove unità (Audit/Marketing/Legal); NON creare incumbent fittizi.
2. **#71 Realismo dati via ricerca-web focalizzata (Italia, banca tipo RTL) — PRECEDE la Fase 4** (~1-2 sessioni). Criterio PERMANENTE: verificare/correggere via ricerca web ogni tabella-dominio popolabile. (a) **retribuzioni** allineate a **CCNL Bancari** + mercato (le bande/salari rimodulati in S1024 vanno validati contro lo standard reale); (b) estendere a KPI, OKR, percorsi formativi, requisiti, titoli di studio/specializzazione, percorsi di carriera, descrizioni ruoli/posizioni, anzianità, ecc. **Claude analizza il DBMS e sceglie tabelle/campi** → seed idempotenti di correzione.
3. **#68 Fase 4 forense frontend** (~1-2 sessioni) — SOLO dopo #70+#71: admin SPA + ESS + showcase; codici illeggibili, mock residui, mix IT/EN, link rotti, formati. Kickoff §4 in `docs/kb/NEXT_SESSION_DB_FRONTEND_FORENSICS_KICKOFF.md`.
4. **#69 Blocco E Fase 3** — GATED su Wave-3 (#17, HOLD): drop `staging.wave1_*` + decommission DB legacy sulla VM + rotazione `POSTGRES_PASSWORD`.

## Open questions (autorità *cosa* = Enzo)

- **Wave-3 (#17)** — sblocca il Blocco E Fase 3 (chiusura definitiva brownfield lato DBMS legacy VM). In HOLD.
- WAIT-INPUT invariati: **#4** pricing · **#8** app-password Outlook · **#16** SuccessFactors · **#52** SSO IdP.

## Verification (next session)

```bash
git log origin/main..HEAD --oneline               # 0 dopo il push handoff
python docs/kb/tools/handoff_lint.py              # OK atteso
ls db/migrations/*.sql | tail -1                  # 000193
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "SELECT count(*) FROM sys.sys_reference_translations"  # 29511
python docs/kb/tools/session_start.py             # menu + salute
```
