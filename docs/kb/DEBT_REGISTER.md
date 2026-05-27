# DEBT_REGISTER — Debiti / incoerenze rilevati (CLI-owned)

> Tutti i debiti, drift e incoerenze emersi nella ricognizione forense S939 (4-root). Per ognuno: severità, evidenza, remediation, stato. **Tutti in scope** (R3 cross-project: il codebase va lasciato migliore). Quelli operativi sono linkati al `SOT_BACKLOG.md`.
> **Aggiornato**: 2026-05-27 (S939).

| ID | Sev | Debito | Evidenza | Remediation | Stato |
|---|---|---|---|---|---|
| **D-01** | 🔴 alta | **Doc drift `CLAUDE.md` + `README.md`**: descrivono stato MVP-1 ("11/22 moduli + auth", "web ancora vuoto", "MVP-1 = API build-out", "69/69 test @64c2a27"). Realtà: ~58 moduli + auth, web MVP-2a/2b shipped, MVP-3 done, MVP-4 in corso, 334 test case. | `CLAUDE.md` §"What this is"; `app.ts:206-265` (60 register); 64 `page.tsx` | Aggiornare le sezioni di stato di `CLAUDE.md` + `README.md` puntando a `docs/kb/SOT_STATE.md` come SoT viva. Le parti invarianti/design-system/security restano valide. | **in scope** → `SOT_BACKLOG.md` B-01 |
| **D-02** | 🟡 media | **Duplicati cross-location**: `GOAL_B_REPORT_2026-05-18.md` e `MIGRATION_STATUS_2026-05-18.md` esistono sia in repo root sia in `Claude Desktop\outputs\`; `HANDOVER_CLI` esiste in **3 copie** (repo `cowork_code_exchange/`, `outputs/`, `Claude Desktop\heuresys-advanced\sessioni\...`). SHA identici. | recon agent + `find` | Canonicalizzare: la copia repo è SoT; le copie Claude Desktop diventano archivio read-only (marker, no delete — vedi `COWORK_ARCHIVE_NOTE.md`). Niente duplicazione in ingestion (Plan 2 legge l'indice una sola volta per path). | **gestito** in P1-9 + Plan 2 |
| **D-03** | 🟡 media | **Snapshot CLAUDE.md obsoleto** `outputs\depot\staging-P0-2026-04-22\CLAUDE.md` = regole R1-R17 (vs SoT viva R1-R23). Rischio: una sessione lo scambia per la SoT. | recon agent | Marcare esplicitamente come snapshot storico nell'indice (status `external-archive`) + nota in `COWORK_ARCHIVE_NOTE.md`. SoT regole = `C:\Users\enzospenuso\.claude\CLAUDE.md`. | **gestito** (indice + archive note) |
| **D-04** | 🟢 bassa | **Root repo cluttered** da doc di milestone chiuse: `GOAL_B_REPORT`, `MIGRATION_STATUS`, `BRAND_SESSION_CHARTER`, `HANDOFF_BRAND`, `NEXT_SESSION_MVP_2A`, `NEXT_SESSION_MVP_CLOSURE`. | `git ls-files` root | Candidati a `docs/archive/` (NON ora — alcuni ancora referenziati, es. NEXT_SESSION_MVP_2A è dottrina E2E live). Spostamento deferito post-doc-drift fix, con grep delle reference prima. | **registrato**, deferito |
| **D-05** | 🟢 bassa | **`.handoff/STATE.md` lag 1 commit**: mostra HEAD `c2f95ad`, reale `9cd906e` (il commit di handoff stesso). | `git rev-parse HEAD` vs STATE.md | Atteso (il commit handoff aggiorna STATE poi viene committato). Allineare al prossimo handoff. | **non-issue**, monitor |
| **D-06** | ⚪ info | **Falsa discrepancy bias 26 vs 62**: grep `CW-B[0-9]+` su `bias_registry.md` ritorna 26 unici, ma il tally reale è 62. Causa: la registry usa numeri nudi in tabella (`\| 38 \|`) non `CW-B38`. | grep vs §5 tally | Nessuna azione — chiarito. Il tally 62 (B17→B63, B57 withdrawn) è corretto. | **risolto** (chiarimento) |
| **D-07** | ⚪ info | **Gap migration `000035`**: 43 file ma numerati a 000044. | `ls db/migrations` | Cosmetico, documentato (handover §5 "NO 000035 gap cosmetic"). Nessuna azione. | **non-issue** |
| **D-08** | 🟡 media | **Dual-ownership SoT** (Cowork `cowork_reserved/` + Claude Desktop vs CLI): handoff/state/bias vivevano in spazio Cowork → rischio drift ora che il CLI opera in autonomia. | obiettivo sessione | Spostare la SoT viva in `docs/kb/` (CLI-owned, questa sessione); congelare Cowork come archivio read-only. | **in risoluzione** (P1-6..P1-10) |
| **D-09** | 🟢 bassa | **Dependabot churn**: 7 PR `defer-major` auto-rebasano → CI re-trigger ad ogni move di main (runner singolo). | HANDOFF.md tail; recon | Condition `skip defer-major` o paths-filter nei 6 workflow. | **registrato** → `SOT_BACKLOG.md` B-25 |
| **D-10** | 🟡 media | **Policy numerazione bias post-Cowork**: il protocollo claim CW-B<N> era anti-race Cowork↔CLI. Ora che il CLI è solo, serve regola chiara per non rompere la continuità storica. | bias_registry §1 | Il CLI continua la numerazione da **CW-B64** scrivendo direttamente in una sezione "post-Cowork" di `docs/kb/` (o estendendo bias_registry come archivio append-only). Documentato in `COWORK_ARCHIVE_NOTE.md`. | **gestito** (archive note) |
| **D-11** | 🟢 bassa | **Overlap script Claude Desktop ↔ repo**: `Claude Desktop\scripts` (bootstrap/OCI/SSH) parzialmente sovrapposto a `repo/scripts/` e `db/scripts/`; converter generici/nose/SMB non-dominio mescolati. | recon agent | Già separati nell'indice (solo 6 file heuresys inclusi; esclusi elencati in `INDEX_PATHS.md` appendice). Nessuna azione fisica. | **gestito** (indice) |

## Sintesi scope

- **Trattati in questa sessione (S939)**: D-02, D-03, D-08, D-10, D-11 (via indice + SoT + archive note); D-06, D-07 (chiariti).
- **In backlog operativo**: D-01 (B-01, P0), D-09 (B-25).
- **Deferiti con registrazione**: D-04 (spostamento root docs, post grep reference), D-05 (monitor).

> Nessun debito scartato. Ogni riga ha owner (CLI) e remediation. R3: il codebase va lasciato in stato migliore.
