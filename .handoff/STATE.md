# heuresys-advanced — STATE

**Updated**: 2026-05-30 (S949). **Branch**: `main` HEAD = handoff commit. **3 commit locali NON pushati** (`edbe078` SQL set, `dc49d9b` D4 code, + questo handoff) — push in attesa di ok esplicito. **CI**: ultima verde su `eb55058` (i commit S949 sono draft, non eseguiti contro il DB).

## Last session brief

- **RTL tenant rebuild — Phase 0/1/2 (read-only, zero scritture DB).** Backup `pg_dump_snapshots/heuresys_advanced_pre-rtl-rebuild_eb55058_20260530.dump` (417MB) + provenance. Enumerazione live (6 scout) → **insight chiave: è match-and-wire, non re-import** (158 user reali già 100%-matchati via `user_external_code='LEGACY:'||users.id`; HR history + tassonomia ESCO già migrate). Proposta `docs/superpowers/specs/2026-05-30-rtl-tenant-rebuild-import-design.md` con **8 decisioni risolte** (§0). Snapshot canonico confermato = **live Docker `heuresys_evo_platform_db`**.
- **SQL seed set draftato** (`edbe078`): `db/seeds/rtl-rebuild/` 00-10 + README, idempotenti, FK-safe, assert KEEP=161/DELETE=272. Solo `09` distruttivo (gated). NON eseguito.
- **D4 RBAC→UI** (`dc49d9b`): endpoint `GET /v1/me/permissions` + sidebar per-permesso (`layout.tsx`). Typecheck verde + 3/3 test verdi (`me-permissions.integration.test.ts`).

## Top priorities (next session)

1. **🔴 RTL REBUILD — eseguire la WRITE** (sessione dedicata): backup fresco → `00`→`08` → `09` (gated, dry-run COUNT prima) → `10` → re-seed + test. Vedi README `db/seeds/rtl-rebuild/`. **Push dei 3 commit draft prima/dopo (chiedi a Enzo).**
2. **Finire layer codice D4/D3**: re-wire personas E2E su utenti reali (`fixtures.ts`+`auth.setup.ts`, post-08) + aggiornare test E2E nav-visibility al nuovo gating.
3. **Brand-fidelity F5 ESS / F6 admin / F7 showcase** (~6-8h) — dopo il rebuild (dati ESS reali).

## Open questions

- **D4 gate-semantics** (finding S949): il ruolo USER ha 12 read non-self nel seed → gating per-`:read` espone a USER quasi tutta la sidebar admin. Decidere: tenere `:read` / gate più stretto su governance / fixare i grant seed. Tweak piccolo a `layout.tsx`.

## Stack snapshot

- 3 commit S949 draft non pushati su `main` (origin = `eb55058`). Estrazione legacy: `db/seeds/rtl-rebuild/00_extract_legacy_subset.sh` (CSV in `extracted/`, gitignored). Connessione legacy read-only: `ssh oracle-vm-default bash <<'OUTER' docker exec -i heuresys_evo_platform_db sh -c '...psql...' <<'INNER' ... INNER OUTER`.
- HEAD precedente `eb55058`. VM swap 8G. EChartsCard solo via `_charts-client`. E2E in prod build. Tunnel DB :5433 hands-off (ADR-0021).

## Verification (next session)
```bash
nc -z localhost 5433                                          # tunnel
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # 3 commit = draft non pushati
gh run list --limit 6                                         # CI
```
