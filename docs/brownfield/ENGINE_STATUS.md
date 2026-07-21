# Brownfield ETL engine — status: FROZEN in PROD (D-11, S1023)

**State**: the legacy→advanced ingestion is **complete** (ADR-0023: the legacy
`heuresys-evo` DB is the authoritative data *source*; the `sys.*` schema is the
structural authority; RTL rebuild S950 + wave imports concluded). The 4 ETL
API surfaces remain in the codebase for future waves (D/D1-D5 lines) but are
**not registered in PROD**.

## Mechanism

`BROWNFIELD_ENGINE_ENABLED` (env, `z.enum` true/false):

| Context | Value | Effect |
|---|---|---|
| dev / test / CI | `true` (default) | 4 route-plugins registered; the integration suites keep covering them |
| PROD (VM `.env`) | `false` (set deliberately) | plugins skipped at registration → `/v1/brownfield-*` and `/v1/brownfield/wave-executor` return 404; one warn log at boot |

The flag is in the `env-key-merge.sh` denylist: a local value never propagates
to a remote host — flipping PROD is always a deliberate act on the box.

## Re-enabling for a new import wave

1. On the VM: set `BROWNFIELD_ENGINE_ENABLED=true` in the repo `.env`.
2. `sudo systemctl restart heuresys-advanced-api` (or a normal deploy).
3. Run the wave; then set the flag back to `false` and restart.

Frozen surfaces: `brownfield-source-exports`, `brownfield-import-runs`,
`brownfield-table-mappings`, `brownfield/wave-executor` (routes.ts files under
`apps/api/src/modules/brownfield-*`). The read-only registry/reconciliation
views (`sys.sys_reconciliation_registry`, `sys.v_reconciliation_status`) are
NOT part of the engine and stay live.
