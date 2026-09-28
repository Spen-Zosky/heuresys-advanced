# 262 — Il cancello a tempo e' rosso: 3 tabelle non esposte, 1 non raggiungibile dal self-portal

> **item**: #262 · **priorità**: P2 · **stima**: da stimare (indagine per tabella + endpoint o deroga; probabile ~1 sessione per le quattro)
> **stato**: DONE — chiuso S1116 (2026-09-28), esito in `.programmi/esiti-ciclo4/262.md`
> **nasce-da**: S1116 (2026-09-28), eredità della chiusura S1115 (`marciume:fallito` tre volte di fila, stesso esito).

## Il fatto, misurato

`docs/kb/tools/check_marciume.py` esce rosso su due strumenti:

- `check_completezza_self.py`: `sys_platform_user_tenant_assignments` descrive una persona, non è
  raggiunta dal portale self e nessuno ha scritto perché (né raggiungibile né esclusa con motivo).
- `check_exposure.py`: tre tabelle popolate mai lette da un modulo API —
  `sys_classificazione_direzione_dato` (253 righe, mig. `000429`), `sys_conflitti_ibridi` (0 righe,
  mig. `000446`), `sys_ritiri_ammessi` (1 riga, mig. `000420`).

`chi_sorveglia.py` per ciascuna:
- `sys_classificazione_direzione_dato`: sentinella BLOCCANTE `sys.v_tabelle_non_classificate`, un
  test (`data-steward.integration.test.ts`), nessun modulo API la legge.
- `sys_platform_user_tenant_assignments`: tre test di integrazione, nessuna sentinella, nessun
  modulo che la espone al self-portal.

## Perché non si tampona in questa sessione

Per ciascuna delle quattro tabelle la scelta è fra costruire l'endpoint/wiring o scrivere una deroga
motivata (`docs/kb/tools/exposure_waivers.txt`, o l'esclusione dichiarata di C4). Per
`sys_classificazione_direzione_dato` in particolare la scelta tocca la direzione del dato — è una
decisione di design, non un tampone da sessione di governo.

## Fasi

- [x] **F1 — `sys_classificazione_direzione_dato`** — FATTO 2026-09-28 · decisione di Enzo: endpoint
  API. `GET /v1/data-classification` (permesso `data_classification:read`, mig. `000453`, grant a
  `DATA_STEWARD`). `check_exposure.py` non la elenca più fra le SCOPERTE.
- [x] **F2 — `sys_conflitti_ibridi` e `sys_ritiri_ammessi`** — FATTO 2026-09-28 · derogate in
  `exposure_waivers.txt` (registri di una guardia, stesso criterio delle righe già presenti).
- [x] **F3 — `sys_platform_user_tenant_assignments`** — FATTO 2026-09-28 · esclusa in
  `check_completezza_self.py` ([PIATTAFORMA]: assegnazione di accesso, non dato personale).
- [x] **F4 — verifica** — FATTO 2026-09-28 · `check_marciume.py`: «niente e' marcito».

## Chiuso quando

`check_marciume.py` esce senza `[!!]`: `check_completezza_self.py` e `check_exposure.py` sono
entrambi verdi, o le lacune residue hanno una deroga scritta con motivo.
