# COWORK_ARCHIVE_NOTE — Congelamento archivio Cowork & passaggio a SoT CLI-owned

> **Data**: 2026-05-27 (S939). **Decisione Enzo**: il Claude Code CLI riprende il controllo diretto dello sviluppo, in autonomia, **senza interazioni con Cowork**. Gli artefatti del protocollo Cowork↔CLI diventano **archivio storico read-only**; la verità viva (stato, backlog, debiti, bias) si sposta in `docs/kb/` (CLI-owned, versionato in git).

## 1. Cosa diventa archivio read-only (NON cancellato, NON spostato)

| Area | Path | Natura |
|---|---|---|
| Protocollo Cowork↔CLI | `D:\heuresys-advanced\cowork_code_exchange\` (202 file) | PROMPT/PLAN/EXEC/REPORT/REVIEW + .inbox. Storia di coordinamento. |
| KB Cowork | `D:\heuresys-advanced\cowork_reserved\` (118 file) | bias_registry, KB 00-12, pattern memo, auto-ship scripts, log. |
| Sessioni Cowork | `D:\heuresys-advanced\sessioni\` (12 file) | Working docs per sessione. |
| QA artifacts | `D:\heuresys-advanced\qa_artifacts\` (55 file) | Acceptance/bisect/release output. Reference. |
| Workspace Cowork | `C:\Users\enzospenuso\Claude Desktop\heuresys-advanced\` | Handover post-S937 (duplicato). |
| Output Cowork | `C:\Users\enzospenuso\Claude Desktop\outputs\` (46 file dominio) | Archivio Goal 001/002 + baselines + depot/staging-P0. |

Marker depositati (additivi): `cowork_code_exchange/_00_ARCHIVE_READONLY_NOTICE.md`, `cowork_reserved/_ARCHIVE_READONLY.md`.

## 2. Regole post-congelamento

- **Read-only**: questi file restano consultabili come riferimento storico/forense. Il CLI **non** li modifica più nel flusso di lavoro normale (eccezione: append puramente storico, vedi §3 bias).
- **Niente nuovi cicli PROMPT/PLAN/EXEC/REPORT/REVIEW**: il CLI lavora con mini-piani diretti + atomic commit + test, tracciati in `docs/kb/SOT_BACKLOG.md`.
- **Nessuna cancellazione** senza conferma esplicita di Enzo (R global + project). Eventuale pulizia/dedup (D-02, D-04) è un'azione di backlog separata, non automatica.
- **SoT viva** = `docs/kb/`: `SOT_STATE.md` (stato), `SOT_BACKLOG.md` (azioni), `DEBT_REGISTER.md` (debiti), `INDEX_PATHS.md` (indice). `HANDOFF.md` + `.handoff/STATE.md` restano i doc di handoff cross-sessione (CLI-owned già oggi).

## 3. Continuità bias (CW-B) post-Cowork (risolve D-10)

`cowork_reserved/bias_registry.md` resta l'**archivio append-only** della numerazione storica (CW-B17→B63, B57 withdrawn, 62 catalogati). **Next available: `CW-B64`.** Non essendoci più sessioni Cowork parallele, **decade il protocollo anti-race di claim**: il CLI, quando emerge un nuovo bias, lo registra direttamente incrementando `CW-B64+` in `bias_registry.md` (append in coda, riferendo il commit/file) — è l'unico "append storico" consentito sull'archivio. La sintesi delle lezioni vive in `SOT_STATE.md §10`.

## 4. Regole SoT (R1-R23) — chiarimento anti-confusione

La **Source of Truth delle regole operative** è `C:\Users\enzospenuso\.claude\CLAUDE.md` (R1-R23 globali) + `D:\heuresys-advanced\CLAUDE.md` (project). Lo snapshot `Claude Desktop\outputs\depot\staging-P0-2026-04-22\CLAUDE.md` è **R1-R17 OBSOLETO** (D-03): solo archivio, mai usare come riferimento regole.
