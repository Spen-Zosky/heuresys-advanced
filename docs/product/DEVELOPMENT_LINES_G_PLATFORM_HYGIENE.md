# Development Lines — Serie G: piattaforma & igiene (il valore è affidabilità e costi)

> **Stato**: PROPOSTO — selezione = Enzo (molte voci sono CLASSE-A eseguibili in batch su via libera). **Provenienza**: atlas + sweep S1016 (ATLAS_CURATED §7 e §10). Regola T2.
> **Perimetro**: non-feature che proteggono le feature: retention, permessi, integrità, doc-drift. Quasi tutte piccole; il valore aggregato è alto (DB -40%+, superficie RBAC coerente, SoT senza drift).

## Le linee

### G1 — Retention & storage (il DB dimagrisce del ~45%)
- `audit.import_validation_results` **1,55M righe / 547 MB = ~44% del DB** → partition/archive con policy dichiarata (i 21 import COMPLETED sono storia, non runtime).
- `sys_auth_refresh_tokens` 44k/26MB + `sys_auth_login_events` 91k/29MB per 162 utenti → verificare/stringere le soglie del job `auth-housekeeping` esistente.
- `staging.wave1_*` 18 tabelle 0-righe con bloat → TRUNCATE/VACUUM; schema `temp_sdbi` (4 tabelle pf_* popolate) → verifica e drop **con backup e conferma** (op distruttiva).
- `deploy/reports/claude-align` ~81 report senza retention → policy N-ultimi.
- **Effort**: ~1-1,5. **Webapp**: nessuna.

### G2 — Igiene RBAC (la matrice torna onesta)
- Permission `:delete` dedicate dove DELETE gira sotto `:update` (~10 moduli censiti) · sanare le proxy (observability←`tenant:create`, operating-models/ou-kpi←`enterprise_typing:*`/`bpm_process:*`, role-matrix←`auth:revoke_user`) · permission dedicate `tenant_materialization:*` (oggi POST senza requirePermission, solo service-gate) · portare i gate hardcoded PLATFORM_ADMIN dei service taxonomy/job-* nella matrice.
- **Effort**: ~1,5 (migration grant + routes, meccanico ma esteso). **Webapp**: `/admin/roles` beneficia (matrice leggibile).

### G3 — Integrità dati preventiva
- Check aciclicità sul grafo skill IS_A (oggi solo self-loop — cicli creabili) · fix LIMIT 5000 hardcoded in insights (truncation silente futura) · paginazione+filtri su `/v1/leads` · unificazione dual-shape `response_answers` (se non già assorbita da D2).
- **Effort**: ~1. **Webapp**: nessuna direttamente.

### G4 — Doc-drift & SoT (da fare al prossimo handoff, costo ~0)
- CLAUDE.md: "11 roles"→12 (ORG_DIRECTOR) · §Design System `^0.1.1`→`^0.1.9` · §U2 filtro PET ritirato (S1009).
- Ledger prodotto: ri-allineamento post-Gap#1 (MLCE/Maturity esistono; `sys_nine_box_grid` NON esiste; time_off_balances già esposta) — già censito nei dossier A/F.
- `/investors` STATIC_FACTS + commento CI "41 integration tests" (pattern D-01) · commenti stale nel codice (6 censiti).
- `showcase/layout.tsx:70` path assoluto Windows nel footer (viola no-absolute-paths) · `landing.ts` ADMIN_ROLES hardcoded senza ruoli funzionali.
- **Effort**: ~0,5-1 in batch.

### G5 — Archiviazione script esauriti
- `bisect-cw-b59-createctx.ps1`, `restore-showcase-routes.ps1`, codemod `s983-mfa-loginraw.mjs`, `encrypt-totp-secrets.ts` (one-time eseguito), `scripts/cowork-exchange/` (protocollo congelato S939) → `docs/archive`/subdir dedicata (spostamento, non cancellazione — conferma Enzo su ogni rimozione).
- **Effort**: ~0,5.

### G6 — Wiki & grafi: refresh o declassamento esplicito
- La wiki advanced è pre-GA (748 commit indietro, ADR 19/26, path morti nel manifest): o refresh linked-mode (fattibile, manifest sha256 incrementale) o banner "storico" esplicito. Il grafo graphify ha il top-up semantico pendente (26 chunk, `graphify-out/PENDING_SEMANTIC_TOPUP.md`) — riprenderlo quando il limite di spesa si resetta.
- **Effort**: ~0,5-1 (decisione inclusa).

## Webapp impattate (riepilogo serie)

Nessuna pagina nuova; beneficiano indirettamente `/admin/roles` (G2), `/system-health` (G1 osservabile), tutte le liste (G3 paginazione leads è API-only).

## Sequenza raccomandata

G4 (al prossimo handoff, quasi gratis) → G1 (il DB respira) → G2 → G3 → G5 → G6. Totale ~5-6 sessioni se tutto; molte voci sono batch-abili in una sessione unica di igiene.
