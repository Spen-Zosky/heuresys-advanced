# #92 F6 — Frontend del ciclo di valutazione

> Ripreso su richiesta di Enzo subito dopo la chiusura di S1061. Budget dichiarato dal
> programma: **~200k**. Contesto misurato all'apertura: **358.629 token residui**.
> ⚠ **La finestra 5h è NON MISURATA** (dato stantio, 30 min > 15): un ramo su due è cieco, e
> lo strumento lo dichiara invece di stimarlo — `✓ si continua` viene dal solo ramo contesto.

## Precondizione verificata, non assunta

Gli endpoint esistono già (F3/F4/F5) e sono **9 + 1**:

| modulo | rotte | permesso |
|---|---|---|
| `review-cycles` | `GET /` · `GET /:id` · `POST /` · `POST /:id/transition` | `performance-review:read` · `review-cycle:manage` |
| `performance-reviews` | `GET /` · `GET /:id` | `performance-review:read` |
| `calibration-sessions` | `GET /` · `GET /:id` · `GET /:id/discussions` | `performance-review:read` |
| `me` | `GET /v1/me/performance` | `performance-review:read:self` (mig `000312`) |

**Nessuna pagina web esiste**: misurato, `(authenticated)` non ha alcuna cartella
`performance`/`review`/`calibration`, e `/me` non ha `performance`. F6 le crea.

## Le voci — una riga per deliverable

| id | cosa | fatto significa | stato |
|---|---|---|---|
| **V1** | Migrazione: le due voci di sidebar | le pagine sono **raggiungibili** dal menu, che vive nel DB e non nel frontend (lezione `#125`) | ⬜ |
| **V2** | Pagina manageriale `/performance` | cicli + valutazioni + calibrazioni, dati **live**, nessun mock | ⬜ |
| **V3** | Pagina ESS `/me/performance` | le proprie valutazioni, e ciò che è mascherato **dichiarato** | ⬜ |
| **V4** | i18n it/en in parità | `pnpm i18n:check` verde | ⬜ |
| **V5** | Verifiche + dimostrazione live | typecheck/lint/i18n + prova generale DB + login reale | ⬜ |

## Simulazione (R24 §3)

- **Precondizioni** — gli endpoint esistono (tabella sopra, misurata). Il permesso
  `performance-review:read` ha la platea corretta dopo `#92 F4` (4 ruoli, mig `000309`).
  **Da misurare prima di V2**: quante righe vedono davvero le tre liste, o la pagina nasce
  su un empty-state e non dimostra nulla.
- **Meccanismo** — la voce di menu **non è un file del frontend**: è una riga di
  `sys.sys_ui_interfaces` (`ui_interface_route` + `_required_resource`/`_action` +
  `_sidebar_group` + `_order`). Verificato leggendo la tabella, non a memoria.
- **Propagazione** — c'è una migrazione ⟹ **`ci-rehearsal.sh` prima del push**, che è
  vincolante per ogni tocco a `db/**`.
- **Chi** — io, per intero.
- **Guardia** — la migrazione è idempotente e si auto-verifica (le due voci devono esistere
  e essere attive alla fine); non tocca alcuna voce esistente, e la post-condizione lo
  verifica **anche in negativo** (il conteggio delle altre voci non deve cambiare).

## Vincoli che valgono qui

- **Nessun componente riusabile in `apps/web`**: si compongono le primitive `@heuresys/ui`.
- **Nessuna UI runtime dep** aggiunta a questo repo.
- **Nessun mock**: ogni cella viene da una chiamata `/v1/*` reale.
- **`masked` si dichiara**: `MePerformanceReviewSchema` porta `masked: string[]`. Un campo
  ritirato per mandato non si mostra vuoto — è la stessa lezione di `#188`, dove il «—» muto
  non distingueva «non c'è» da «non te lo mostro».
