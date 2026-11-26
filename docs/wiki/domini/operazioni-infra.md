---
dominio: operazioni-infra
natura: riferimento
stato: vivo
aggiornato_il: 2026-11-25
sintesi: VM di produzione, gemello sulla Debian, CI, rilascio armato e copie ripristinabili
fonti: [CLAUDE.md, scripts/rilascia.sh, scripts/verifica-deploy.sh, scripts/copia-fase.sh, docs/piani/PIANO_turni-advanced-datastore_20261110.md]
concetti: [rilascio, gemello, copia-di-fase, turno]
---

# Operazioni e infrastruttura

## Com'è oggi

- La produzione è sulla VM Oracle (ADR-0010); il linux-pc ne tiene una copia, il gemello, per le prove pesanti.
- Il deploy parte solo da `refs/heads/prod`, che si muove con `bash scripts/rilascia.sh <sha>`; il rollout lo fa il timer `heuresys-advanced-deploy-watch` con la CI verde (ADR-0028).
- A ogni fine fase si fa una copia ripristinabile (ADR-0052): `bash scripts/copia-fase.sh copia <nome>`, poi `prova` e `drive`.
- Repo della VM e della Debian lavorano a turno ([piano dei turni](../../piani/PIANO_turni-advanced-datastore_20261110.md)).
- Copie di prova del repo solo con `bash scripts/copia-prova.sh apri|chiudi`.

## Decisioni in vigore

<!-- generato:decisioni -->
| ADR | Decisione | Status nel file |
|---|---|---|
| [0004](../../architecture/adr/0004_no_docker_native_postgresql.md) | Runtime: Native PostgreSQL Only, No Docker | Accepted |
| [0010](../../architecture/adr/0010_postgresql_runtime_location.md) | PostgreSQL Runtime Location: OCI VM `oracle-vm-default` (Option B) | Accepted |
| [0021](../../architecture/adr/0021_ssh_tunnel_automation_and_service_key.md) | SSH tunnel automation via restricted service-account key (B-31 / CW-B62 closure) | ACCEPTED |
| [0028](../../architecture/adr/0028_ci_enforcement_at_deploy_gate.md) | CI enforcement point: deploy gate, not branch-protection required checks | Accepted |
| [0052](../../architecture/adr/0052_la_copia_ripristinabile_a_ogni_fine_fase.md) | La copia ripristinabile di advanced a ogni fine fase | ACCETTATO il 2026-11-01 da Enzo Spenuso |
<!-- /generato -->

## Come si fa

| cosa | comando |
|---|---|
| esito del deploy | `bash scripts/verifica-deploy.sh` |
| propagazione fra le macchine | `bash scripts/close-propagate.sh` |
| corse della CI | `gh run list` |

## Storia

<!-- generato:storia -->
Il riordino del 2026-11-25 ha ritirato **6** documenti di questo dominio (lotti: B 5, B-campioni 1). Si recuperano con `git show <commit>:<percorso>` dai commit 87d7ce9d9, a1872a180, (il cestino del riordino è stato svuotato il 2026-11-26, voce R14); l'elenco completo è nel [registro dei ritiri](../../piani/riordino-documentazione_20261125/REGISTRO_RITIRI.tsv).

Da dove venivano: `docs/piani` 3, `docs/superpowers/plans` 2, `docs/superpowers/specs` 1.
<!-- /generato -->

## Vedi anche

[governo](governo.md), [qualita-verifica](qualita-verifica.md).
