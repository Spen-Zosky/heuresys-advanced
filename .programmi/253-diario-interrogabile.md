# 253 — Il diario del gate diventa interrogabile: identificativo di conversazione, tabella, vista sentinella

> **item**: #253 · **priorità**: P2 · **stima**: ~1 sessione
> **stato**: CHIUSO
> **nasce-da**: ADR-0040 R2, terzo passo: «quante persone distinte per conversazione», raccolta da `db_health` come le altre sentinelle.

## Il fatto misurato in S1101 (2026-09-14), che allunga il piano rispetto alla dottrina

Il diario **non è nel database**. `FileAuditSink` (`apps/agent-gateway/src/audit-sink.ts`) scrive un JSONL — `AGENT_GATEWAY_AUDIT_PATH`, default `.data/agent-audit.jsonl`; sulla VM 242 righe, ultima del 2026-09-13 — e la voce (`AuditEntry`: `ts`, `who`, `tenant`, `tool`, `argsHash`, `concept`, `operation`, `decision`, `reason`) **non porta un identificativo di conversazione**. «Una vista SQL sul diario» pretende quindi tre cose che mancano, e questa voce le costruisce.

## Decisioni già prese (non si ri-chiedono)

- **Decisione tecnica, mia**: la casa del diario è lo schema **`audit`** (ausiliario dichiarato in I3/I4); il file resta come fallback dove non c'è database. Il commento di giugno in `audit-sink.ts` riservava «la forma della tabella» a Enzo: è una scelta tecnica, dichiarata qui — vale il veto.
- La vista è **informativa** (una misura), non una sentinella a zero atteso: `db_health` la raccoglie e la stampa, non la fa rossa (memoria: una `v_*` nuova in `sys` diventa sentinella bloccante da sola — quindi o vive in `audit`, o si dichiara informativa).
- **Mai PII** nel diario, invariato: id di conversazione, concetto, operazione, numero di persone — mai i nomi.

## Fasi

- [x] **F1 — L'identificativo di conversazione** — FATTO 2026-09-28 · `conversationId` (UUID via `randomUUID()`) generato in `runHrAgent`, fuso nel `principal` che raggiunge sia le decisioni del gate sia la voce di chiusura. Non `runId` come nominato qui in origine — stesso concetto, nome diverso deciso in corsa.
- [x] **F2 — La tabella e il sink** — FATTO 2026-09-28 · mig. `000452`: `audit.agent_gateway_decisions` (nome diverso da `agent_gate_decisions` qui pianificato — deciso in corsa per chiarezza). `DbAuditSink implements AuditSink` in `audit-sink.ts`. Scelta del sink NON via env `AGENT_GATEWAY_AUDIT=db|file` come qui pianificato, ma automatica su presenza di `POSTGRES_HOST` (`server.ts`) — stessa decisione tecnica (file resta fallback), meccanismo di selezione più semplice. `ci-rehearsal.sh` verde a due passate sul gemello.
- [x] **F3 — La vista** — FATTO 2026-09-28 · `sys.v_agente_persone_per_conversazione` (non `audit.v_*` come qui pianificato: spostata in `sys` perché `db_health.py` scopre le sentinelle SOLO in quello schema — altrimenti la vista sarebbe stata invisibile al cruscotto). Raccolta come **informativa** in `db_health.py` (`INFORMATIVE` dict). `db_health` la stampa, prova generale verde.
- [x] **F4 — La prova che può fallire** — FATTO 2026-09-28 · `git stash` dei soli file `src/` (non i test): 4 test falliti (`DbAuditSink is not a constructor`, `conversationId` `undefined`). `git stash pop`: 152/152 verdi. Coppia rosso/verde in `.programmi/esiti-ciclo4/253.md`.

## Cronaca

- 2026-09-28 (S1116) — chiusa in una sessione di governo diretta (nessuna sessione esterna: perimetro occupato dalla stessa conversazione). Tre scostamenti dal piano originale, tutti dichiarati sopra (nomi di tabella/vista, meccanismo di scelta del sink) — nessuno cambia le decisioni vincolanti della sezione precedente. Esito completo: `.programmi/esiti-ciclo4/253.md`. Register: `docs/kb/SOT_BACKLOG.md` #253 → DONE.
