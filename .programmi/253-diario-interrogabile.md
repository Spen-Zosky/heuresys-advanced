# 253 — Il diario del gate diventa interrogabile: identificativo di conversazione, tabella, vista sentinella

> **item**: #253 · **priorità**: P2 · **stima**: ~1 sessione
> **stato**: NON AVVIATO
> **nasce-da**: ADR-0040 R2, terzo passo: «quante persone distinte per conversazione», raccolta da `db_health` come le altre sentinelle.

## Il fatto misurato in S1101 (2026-09-14), che allunga il piano rispetto alla dottrina

Il diario **non è nel database**. `FileAuditSink` (`apps/agent-gateway/src/audit-sink.ts`) scrive un JSONL — `AGENT_GATEWAY_AUDIT_PATH`, default `.data/agent-audit.jsonl`; sulla VM 242 righe, ultima del 2026-09-13 — e la voce (`AuditEntry`: `ts`, `who`, `tenant`, `tool`, `argsHash`, `concept`, `operation`, `decision`, `reason`) **non porta un identificativo di conversazione**. «Una vista SQL sul diario» pretende quindi tre cose che mancano, e questa voce le costruisce.

## Decisioni già prese (non si ri-chiedono)

- **Decisione tecnica, mia**: la casa del diario è lo schema **`audit`** (ausiliario dichiarato in I3/I4); il file resta come fallback dove non c'è database. Il commento di giugno in `audit-sink.ts` riservava «la forma della tabella» a Enzo: è una scelta tecnica, dichiarata qui — vale il veto.
- La vista è **informativa** (una misura), non una sentinella a zero atteso: `db_health` la raccoglie e la stampa, non la fa rossa (memoria: una `v_*` nuova in `sys` diventa sentinella bloccante da sola — quindi o vive in `audit`, o si dichiara informativa).
- **Mai PII** nel diario, invariato: id di conversazione, concetto, operazione, numero di persone — mai i nomi.

## Fasi

- [ ] **F1 — L'identificativo di conversazione** — `runHrAgent` genera un `runId` (UUID v4) per richiesta e lo passa al sink; `AuditEntry` lo porta; il file JSONL lo scrive. **fatto =** i test del sink mostrano il campo, e le due guardie preesistenti sul «mai PII» restano verdi.
- [ ] **F2 — La tabella e il sink** — migrazione `db/migrations/`: `audit.agent_gate_decisions` (colonne = i campi di `AuditEntry` + `run_id` + `persone_distinte`), `DbAuditSink implements AuditSink` che vi scrive; scelta del sink via `.env` (`AGENT_GATEWAY_AUDIT=db|file`). **fatto =** `ci-rehearsal.sh` verde a due passate; una corsa dell'agente sul gemello produce righe nella tabella.
- [ ] **F3 — La vista** — `audit.v_agente_persone_per_conversazione` (`run_id`, `tenant`, `max(persone_distinte)`, decisioni, prima/ultima ora); raccolta da `db_health` come **informativa**. **fatto =** `db_health` la stampa; la prova generale resta verde.
- [ ] **F4 — La prova che può fallire** — sabotaggio dichiarato: un sink che omette `run_id` fa fallire il test di F1; la vista con una riga finta da 200 persone la mostra. **fatto =** coppia rosso/verde nella cronaca.

## Cronaca
