---
name: full-alignment-deploy
description: Dottrina di allineamento dei cloni (VM OCI, linux-pc) e deploy in produzione per heuresys-advanced. Usa questa skill quando Enzo dice "allinea i cloni", "allinea la VM", "deploy", "porta in produzione", "propaga", "aggiorna il linux-pc", oppure quando nomina align-clones.sh, vm-deploy.sh, close-propagate.sh, align-claude-ecosystem.sh. Copre cosa compone l'allineamento per target, cosa git pull NON porta, e il comportamento fail-loud/skip-warn a chiusura sessione.
---

# Allineamento cloni e deploy

## Cosa vuol dire "allinea i cloni"

Rendere i remoti (VM OCI + linux-pc) **cloni veri** del repo locale sul PC — idempotenza modulo OS e architettura — **incluso il payload gitignored che `git pull` non porta mai**. È questo il punto: un `git pull` lascia fuori `.secrets/`, i dati gitignored, il `.env` e l'albero di memoria di Claude.

## Entrypoint canonico

```bash
bash scripts/align-clones.sh <vm|linuxpc|all> [--deploy]
```

Pusha prima i commit locali; i remoti fanno `reset --hard origin/main`.

**Il Mac è RITIRATO da `all` e da `close-propagate`** (S1007): era peso morto — la sua CLI Claude va in SIGILL sulla CPU Ivy Bridge e il canale ecosistema falliva di continuo su 16 plugin più drift. Resta un target on-demand (`align-clones.sh mac`) se mai venisse rianimato.

## Cosa compone, per target

| Passo | Cosa fa |
|---|---|
| hard git sync | `reset --hard origin/main` |
| dipendenze | `pnpm install --frozen-lockfile -r` |
| payload gitignored | `sync-gitignored-to-vm.sh` — `.secrets/` e dati |
| `.env` | `env-key-merge.sh` — **merge additivo di chiavi, non sovrascrive mai la topologia per-macchina** |
| memoria Claude | `sync-memory-tree.sh` |
| deploy (solo VM, con `--deploy`) | `vm-deploy.sh` |

## `vm-deploy.sh`

Garantisce una PROD completamente aggiornata: versioni esatte da lockfile, clean-reinstall se cambia l'ABI di Node, re-exec con self-modify-buffer, `db:migrate:sh`, rebuild in ordine shared → api → web, restart.

## A chiusura di sessione

L'orchestratore canonico è **`scripts/close-propagate.sh`**, invocato dalla skill `handoff` allo Step 4b. Esegue **entrambi** i canali:

1. `align-clones` — repo, payload, memorie di progetto
2. `align-claude-ecosystem` — CLAUDE.md, skill, comandi, settings, SDK, con verifica SHA dei plugin

più il clone-DB condizionale su linux-pc, e infine l'**armamento** del deploy.

**Comportamento**: `fail-loud` su un host raggiungibile, `skip+warn` su un host spento. Un host irraggiungibile non deve bloccare la chiusura; un host raggiungibile che fallisce sì.

### Il deploy NON si aspetta più (#165, S1049)

Prima, la chiusura deployava in linea e `vm-deploy.sh` chiamava `ci-gate.sh`, che **polla fino a 900 s** aspettando la CI: la sessione restava aperta 20-30 minuti a guardare un controllo che non richiede nessuno che guardi (misura S1048).

Adesso la chiusura **arma e basta**: spinge `refs/heads/prod` sullo sha appena pushato e ritorna. Il deploy lo esegue `heuresys-advanced-deploy-watch.timer` su VM e linux-pc, che ogni 5 minuti chiede *«c'è uno sha armato, verde e non ancora in produzione?»* e chiama `vm-deploy.sh` quando la risposta è sì. Il cancello CI è **lo stesso di prima**, spostato: non è stato indebolito.

| voglio | comando |
|---|---|
| chiusura normale (arma, non aspetta) | `bash scripts/close-propagate.sh --delta --auto-deploy` |
| armare comunque, anche senza modifiche a codice | `... --deploy` |
| **guardare il deploy adesso** (comportamento pre-#165) | `... --deploy-now` |
| non armare né deployare | `... --no-deploy` (o `HEURESYS_CLOSE_NODEPLOY=1`) |

**Perché armato e non «deploya ogni main verde»**: il deploy continuo aggirerebbe in silenzio il veto `HEURESYS_CLOSE_NODEPLOY=1` (che impedisce al ciclo non presidiato di spedire in PROD alle 03:00) e deployerebbe anche i push di metà sessione. Con l'armamento, chi non deve deployare semplicemente non arma.

**Se il deploy non è arrivato in PROD**, in ordine: `git rev-parse origin/prod` e `origin/main` coincidono? · sull'host, `cat pg_dump_snapshots/LAST_GOOD_SHA` · `systemctl status heuresys-advanced-deploy-watch.timer` · `journalctl -u heuresys-advanced-deploy-watch -n 50` (dice sempre PERCHÉ non ha deployato) · la CI è verde su quello sha?

## Dove sta il resto

- Razionale completo: `memory/feedback_full_alignment_doctrine.md`
- Dettaglio operativo: `deploy/README.md` §"Full alignment"
- Design del comportamento fail-loud/skip-warn: `docs/superpowers/specs/2026-06-20-handoff-rigor-and-hold-lane-design.md` §12-§13

## Vincolo che resta valido

**Mai `git push` senza richiesta esplicita di Enzo.** L'allineamento pusha i commit locali: quindi «allinea i cloni» **è** l'autorizzazione al push per quella sessione. Se non è stata data, chiedi prima di lanciare `align-clones.sh`.
