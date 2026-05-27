# heuresys-advanced — STATE

**Updated**: 2026-05-27 (S939 — CLI takeover + KB integrations + security cleanup).
**Branch**: `main` — HEAD `9e67d42` (synced origin). CI verde. **0 alert Dependabot**.
**Hygiene fix 2026-05-27** (commit `9e67d42`): `migrate.sh` reso ri-eseguibile end-to-end + idempotent — risolti 3 punti di rottura pre-esistenti della chain (000007 guard CHECK, 000033 ownership→heuresys, 000044 colonna `table_mapping_classification`). Dettaglio in `docs/kb/DEBT_REGISTER.md` D-12.
**Last tag**: `v0.4.1-housekeeping-closed` (@ `01340ae`).

## Last session brief

S939: il **CLI ha ripreso il controllo diretto** (no Cowork). Creata **SoT CLI-owned in `docs/kb/`** (INDEX_PATHS 1358 file + SOT_STATE/SOT_BACKLOG/DEBT_REGISTER/COWORK_INBOX); archivio Cowork congelato read-only; **Cowork forzato ad adottare la SoT** (preferences v5.1 textarea claude.ai + redirect + freeze markers). **Integrati graphify** (knowledge graph, 8543 nodi, hub viz brand-aligned in `wiki-space`) **+ LLM-wiki** (vault `heuresys-advanced-wiki`, modo `linked` no-copie, 63 doc prosa ingeriti; skill estesa v1.3 in wiki-factory). **Security**: alert #78 `tmp` fixed (override 0.2.7); 3 CI-action → v6 (Node 24 ready); chiuse Dependabot #1/#14/#15.

## Top priorities (next session — FRESH)

1. **MVP-4 stream 2.4 — SDBI Phase 2** (~6-10h) — entry `cowork_code_exchange/_01_PROMPT_027_*` (riformulare come piano CLI-owned diretto). Migration base `000036_temp_sdbi_schema.sql`. **Porta con sé il blocco zod4** (Dependabot #3 + #5 accoppiati): valutare se fare l'upgrade zod 3→4 + fastify-type-provider-zod 4→6 dentro questo milestone o prima. Vedi `docs/kb/SOT_BACKLOG.md` B-10/B-20.
2. (minori) Dependabot residui: #6 react-i18next 15→17 (medio, standalone), #16 gh-pages 3→4 (basso).

## Open questions

- zod4 (#3+#5): upgrade dentro stream 2.4 o mini-milestone separato prima? (scope ampio: 61 schemi + provider; rischio alto, test coprono).

## Stack snapshot

- **HEAD**: `f0ce2a1`. CI 4-core + showcase verdi su v6 actions. tmp 0.2.7. next 15.5.18.
- **SoT viva**: `docs/kb/` (CLI-owned). Leggere SOT_STATE.md per primo (CLAUDE.md/README ancora stale a MVP-1 — debito D-01).
- **KB interrogabili** (fuori repo, in `wiki-space`): wiki `heuresys-advanced-wiki` (63 src, modo linked) + graph hub `heuresys-advanced-graph/index.html`. Re-sync: `docs/kb/tools/sync.sh`.
- **Cowork**: read-only sulla SoT; propone solo via `docs/kb/COWORK_INBOX.md`; unico committer = CLI.

## Verification (next session)

```bash
ssh -o BatchMode=yes oracle-vm-default 'echo OK'   # key in agent?
nc -z localhost 5433 && echo tunnel-up             # else: ssh -fN -L 5433:localhost:5432 oracle-vm-default
git log origin/main..HEAD --oneline                # empty = synced
gh run list --limit 6                              # CI green · gh api .../dependabot/alerts?state=open -> 0
```
