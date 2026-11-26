---
dominio: qualita-verifica
natura: riferimento
stato: vivo
aggiornato_il: 2026-11-25
sintesi: Fatto vuol dire dimostrato dal vivo; cancelli in CI e controlli dei documenti
fonti: [CLAUDE.md, .claude/rules/tests.md, docs/kb/tools/verify_gate.py, docs/kb/tools/check_documenti.py]
concetti: [prova-dal-vivo, cancello, ci]
---

# Qualità e verifica

## Com'è oggi

- Un passo si chiude solo con una dimostrazione dal vivo su dati reali; un test verde significa «in corso» (ADR-0026). Per una pagina autenticata è il login di una persona reale del tenant.
- Una prova nuova si vede rossa prima e verde dopo ([tests](../../../.claude/rules/tests.md)).
- La CI è il punto di controllo del deploy (ADR-0028); `verify_gate.py` è il cancello della chiusura.
- I documenti vivi si controllano con `python3 docs/kb/tools/check_documenti.py` (metadati, link, rimandi a documenti ritirati, affermazioni vietate), anche nel workflow `state-lint.yml`.

## Decisioni in vigore

<!-- generato:decisioni -->
| ADR | Decisione | Status nel file |
|---|---|---|
| [0026](../../architecture/adr/0026_single_production_environment_two_tenants.md) | Single production-grade environment: RTL Bank & Heuresys are the current production tenants | ACCEPTED |
| [0028](../../architecture/adr/0028_ci_enforcement_at_deploy_gate.md) | CI enforcement point: deploy gate, not branch-protection required checks | Accepted |
<!-- /generato -->

## Come si fa

| cosa | comando |
|---|---|
| cancello di chiusura | `python docs/kb/tools/verify_gate.py check` |
| controllo dei documenti | `python3 docs/kb/tools/check_documenti.py` |
| indice degli ADR | `python3 docs/kb/tools/build_adr_index.py --check` |

## Storia

<!-- generato:storia -->
Il riordino del 2026-11-25 ha ritirato **70** documenti di questo dominio (lotti: A4 45, ACC-1 5, B 20). Si recuperano con `git show <commit>:<percorso>` dai commit 87d7ce9d9, a1872a180, dbd339511, (il cestino del riordino è stato svuotato il 2026-11-26, voce R14); l'elenco completo è nel [registro dei ritiri](../../piani/riordino-documentazione_20261125/REGISTRO_RITIRI.tsv).

Da dove venivano: `qa_artifacts` 46, `docs/kb/improvement/FINDINGS` 12, `docs/piani/forense-frontend_20261115` 5, `ux-design/heuresys_uxix_brand_identity_bundle_v1/governance` 5, `audit` 1, `qa_artifacts/data_integrity/20260531_s952` 1.
<!-- /generato -->

## Vedi anche

[governo](governo.md), [frontend-ux](frontend-ux.md).
