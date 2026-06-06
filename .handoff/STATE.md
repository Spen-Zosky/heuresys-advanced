# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-06 (S971).

> **Vista rapida** dello stato di lavoro (priorità · open questions). Lo **snapshot granulare** (versioni, DB/API/web/CI counts, architettura, migration) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero duplicato qui.

## Last session brief (S971 — ultracode)

Capability **② AI Semantic Matching — P1** consegnata e **live in PROD**. Sbloccato il gate `VOYAGE_API_KEY` (Enzo ha aggiunto un metodo di pagamento Voyage via Billing→Preferences → **Tier 1**, **$0** entro i 200M gratis; budget limit impostato). Pipeline embedding (client Voyage `voyage-4-lite` dietro `Embedder` iniettabile + `FakeEmbedder` per CI; backfill idempotente hash-skip) + modulo API `semantic-matching` (`/v1/matching/{me/occupations, users/:id/occupations, skills/:id/similar}`, kNN cosine su pgvector, `matching:read`, reads-only). Backfill PROD: **21939 skill + 3040 occupazioni + 227 ruoli + 156 profili** (mean-pool SQL `avg(vector)` su DISTINCT user×skill); il serving non chiama mai Voyage. **Review adversarial 3-lenti** → 1 HIGH I5 (leak cross-tenant similar-skills) + dedup + batch-guard fixati; **opzione-b** (peer occupation-fit solo a ruoli elevati). **6 commit pushati, CI verde, vm-deploy fatto** (`/v1/matching` 401-gated live). kNN reale validato. Granulare → `SOT_STATE.md` §0-sexies.

## Top priorities (next session)

1. **② AI P1b — pagina ESS `/me/matching`** (occupazioni) + Playwright E2E live, pattern BI P1→P1b. ~3-4h. Spec `docs/superpowers/specs/2026-06-03-ai-semantic-matching-design.md` §3.
2. **② AI P2** — `POST /v1/matching/reindex` (`matching:admin`, già seedato) + ricerca free-text (embed query-time) + Fase 2 (person→job_roles, person↔person). ~4-6h.
3. **#2·m2 Surveys + #2·m3 PredictionsML** — 2 milestone B-10b residue (Surveys ~7-9h MED; PredictionsML ~8-10h MED-HIGH). `SOT_BACKLOG.md` B-10b.
4. **#7 MVP-4** · **#8 cap ③④⑤** — roadmap, decisione Enzo.

## Open questions

- ② sequenza: **P1b** (frontend ESS) prima, o **P2** (backend reindex/free-text/Fase 2)?
- Opzione-b role-set "self-only" = `{USER, TEAM_MEMBER, READ_ONLY}` (tutto il resto vede i peer) — confermi, o sposti TEAM_LEADER tra i self-only?
- B-10b: sequenza Surveys→PredictionsML?
- Mac (`mac-local`) NON allineato in-session a `fab74ce` → allineare ad-hoc o al prossimo handoff (VM/PROD già allineata).

## Verification (next session)
```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
gh run list --limit 6                                         # main CI verde
curl -s -o /dev/null -w '%{http_code}\n' http://80.225.82.207:8013/v1/matching/me/occupations   # 401 = route live
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT count(*) FROM sys.sys_skill_embeddings"   # 21939
```
