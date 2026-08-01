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

1. `align-clones` — repo, payload, memorie di progetto, deploy PROD
2. `align-claude-ecosystem` — CLAUDE.md, skill, comandi, settings, SDK, con verifica SHA dei plugin

più il clone-DB condizionale su linux-pc.

**Comportamento**: `fail-loud` su un host raggiungibile, `skip+warn` su un host spento. Un host irraggiungibile non deve bloccare la chiusura; un host raggiungibile che fallisce sì.

## Dove sta il resto

- Razionale completo: `memory/feedback_full_alignment_doctrine.md`
- Dettaglio operativo: `deploy/README.md` §"Full alignment"
- Design del comportamento fail-loud/skip-warn: `docs/superpowers/specs/2026-06-20-handoff-rigor-and-hold-lane-design.md` §12-§13

## Vincolo che resta valido

**Mai `git push` senza richiesta esplicita di Enzo.** L'allineamento pusha i commit locali: quindi «allinea i cloni» **è** l'autorizzazione al push per quella sessione. Se non è stata data, chiedi prima di lanciare `align-clones.sh`.
