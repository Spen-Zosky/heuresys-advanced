# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-15 (S990 — batch menu 1→11 + convergenza post-close: backfill ESCO + dipendenze chiuse da me).

> **Vista rapida** (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura, delta per-sessione) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui.

## Last session brief (S990 — batch 1→11 + chiusura dei fili che dipendevano solo da me)

Eseguito l'intero menu in autonomia + chiuse a fine sessione tutte le cose che potevo chiudere io, per lasciare una lista che si accorcia (canone `feedback_converge_and_plain_reporting`). **Spedito + in PROD**: #4 RBAC doc-fix · #5/D-30 doc-fix · #7 audit A3/WS-F · #3 ESCO completo (T1.1 connector **+ backfill live: skill_group_uri 0→12892** · T1.2 occupation→skill 126051 · T1.3 typing · T2.4 skill_kind · T2.5 modulo OU↔process). **Code pronto, demo live in attesa di chiave agente**: #1 M-2 write-gate · #6 dev page + harness. **Dipendenze**: 2 PR sicuri adottati, 3 lasciati deferiti (rompono — decisione chiusa). Regressione dati (test che cancellava il profilo RTL) trovata in PROD e corretta. Gate verde + PROD 200. Tutto pushato (HEAD `c343380`).

## Top priorities (next session)

1. **#9 agente — demo live** (⛔ serve **solo la chiave API** Anthropic/Bedrock/Vertex, tua): far girare M-2 (1 scrittura approvata su RTL_BANK) + le 3 skill /hr + la pagina dev. Il codice è pronto, manca solo il tuo input.
2. **Feature future (decidi tu il "cosa")**: grafico Skills-Group-Share (T3.8) + clustering skill (T2.6) — ora che i dati ESCO sono pronti · #8 Fasi 4-8 post-v1.0 (reporting/BPM/sec-audit/provisioning) · assegnazioni reali OU↔processi (T2.5, mapping di business). Memoria `project_post_v1_program_s987`.
3. **Audit 100X A4..A11** (sola lettura, opzionale) — da fare solo se vuoi continuare il programma di audit.

## Open questions

- **Un solo rischio reale, strutturale**: i test automatici girano contro il database di produzione, quindi un test scritto male può cancellare dati reali (è successo stavolta col profilo RTL; tappato il caso). La soluzione di fondo è un DB di test separato (è un lavoro a sé, dossier 100X) — vuoi affrontarlo?

## Verification (next session)

```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline   # vuoto = synced
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "SELECT count(skill_metadata->>'skill_group_uri') FROM sys.sys_skills"  # 12892
curl -s -o /dev/null -w 'PROD %{http_code}\n' https://www.heuresys.com/login   # 200
```
