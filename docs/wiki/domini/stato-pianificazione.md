---
dominio: stato-pianificazione
natura: riferimento
stato: vivo
aggiornato_il: 2026-11-25
sintesi: Dove si legge lo stato, il backlog, i debiti e i piani
fonti: [.handoff/STATE.md, docs/kb/SOT_STATE.md, docs/kb/SOT_BACKLOG.md, docs/kb/DEBT_REGISTER.md, cruscotto/SCHEMA.md]
concetti: [stato, backlog, debito, piano]
---

# Stato e pianificazione

## Com'è oggi

- Stato: [.handoff/STATE.md](../../../.handoff/STATE.md) (vista rapida) e [SOT_STATE](../../kb/SOT_STATE.md) (dettaglio), riscritti dalla skill `handoff` a fine sessione. Backlog: [SOT_BACKLOG](../../kb/SOT_BACKLOG.md). Debiti: [DEBT_REGISTER](../../kb/DEBT_REGISTER.md).
- Gli stati di una voce sono un insieme chiuso: `ACTIVE`, `GATED`, `WAIT-INPUT`, `HOLD`, `INTERRUPTED`, `DONE`/`FATTO`/`WON'T-DO`.
- I piani di un ciclo stanno in `docs/piani/` come tabella di voci; un piano chiuso porta `stato: chiuso`, la sua conoscenza entra nella pagina di dominio e al giro di ritiro successivo esce dal repo.
- `cruscotto/stato.json` è la vista per il cruscotto di Enzo ([schema](../../../cruscotto/SCHEMA.md)); se diverge, valgono i registri.

## Decisioni in vigore

<!-- generato:decisioni -->
Nessun ADR assegnato a questo dominio in `docs/wiki/adr_domini.tsv`.
<!-- /generato -->

## Come si fa

| cosa | comando |
|---|---|
| integrità dei registri | `python3 docs/kb/tools/handoff_lint.py` |
| programmi multi-sessione | `python3 docs/kb/tools/programmi.py --verifica` |

## Storia

<!-- generato:storia -->
Il riordino del 2026-11-25 non ha ancora ritirato documenti di questo dominio.
<!-- /generato -->

## Vedi anche

[governo](governo.md).
