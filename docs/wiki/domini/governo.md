---
dominio: governo
natura: riferimento
stato: vivo
aggiornato_il: 2026-11-25
sintesi: Chi decide, chi scrive dove, come si apre e si chiude una sessione
fonti: [CLAUDE.md, .claude/rules/regole-di-progetto.md, docs/kb/xtras/SESSION_MODES.md, docs/kb/tools/chiudi.py]
concetti: [sessione, chiusura, rilascio, canale-cowork]
---

# Governo

## Com'è oggi

- Il committente è Enzo; le regole di lavoro stanno in [CLAUDE.md](../../../CLAUDE.md) e in `.claude/rules/` ([regole di progetto](../../../.claude/rules/regole-di-progetto.md)). Gli invarianti si cambiano solo con un nuovo ADR.
- Un solo ambiente di produzione con due tenant, RTL Bank e Heuresys System (ADR-0026). RTL Bank è un tenant dimostrativo trattato come reale per lo sviluppo e le prove.
- La sessione si apre con la modalità scelta dal primo messaggio ([SESSION_MODES](../../kb/xtras/SESSION_MODES.md)) e il menu di `python docs/kb/tools/session_start.py`; si chiude con `python docs/kb/tools/chiudi.py` (livelli `leggero`, `onda`, `rilascio`).
- Chi scrive `docs/kb/` è Claude Code; Cowork scrive solo in fondo a [COWORK_INBOX](../../kb/COWORK_INBOX.md). Il canale `cowork_code_exchange/` è ritirato.
- Un passo è fatto solo con una dimostrazione dal vivo su dati reali (comando, output, percorso, orario).
- Rilascio: delega permanente del 13/11/2026, `bash scripts/rilascia.sh <sha>` controlla da sé le condizioni; dopo si dice «armato» e si legge l'esito con `scripts/verifica-deploy.sh`.

## Decisioni in vigore

<!-- generato:decisioni -->
| ADR | Decisione | Status nel file |
|---|---|---|
| [0026](../../architecture/adr/0026_single_production_environment_two_tenants.md) | Single production-grade environment: RTL Bank & Heuresys are the current production tenants | ACCEPTED |
| [0035](../../architecture/adr/0035_retirement_amends_the_source_never_deletes_downstream.md) | Ritirare un oggetto: si emenda la fonte, non si cancella a valle | Accepted |
| [0052](../../architecture/adr/0052_la_copia_ripristinabile_a_ogni_fine_fase.md) | La copia ripristinabile di advanced a ogni fine fase | ACCETTATO il 2026-11-01 da Enzo Spenuso |
| [0055](../../architecture/adr/0055_la_piattaforma_concede_ruoli_nel_cliente_con_un_motivo.md) | La piattaforma concede ruoli dentro un cliente solo con un motivo scritto | ACCETTATO il 2026-11-06 da Enzo Spenuso, alle 01:22 UTC |
<!-- /generato -->

## Come si fa

| cosa | comando |
|---|---|
| menu d'avvio | `python docs/kb/tools/session_start.py` |
| chiusura | `python docs/kb/tools/chiudi.py` |
| voci aperte del canale Cowork | `python docs/kb/tools/check_canale_cowork.py` |
| integrità dei registri | `python3 docs/kb/tools/handoff_lint.py` |
| rilascio | `bash scripts/rilascia.sh <sha>`, poi `bash scripts/verifica-deploy.sh` |

## Stato e pendenze

Lo stato vive nei registri, non qui: [.handoff/STATE.md](../../../.handoff/STATE.md), [SOT_STATE](../../kb/SOT_STATE.md), [SOT_BACKLOG](../../kb/SOT_BACKLOG.md), [DEBT_REGISTER](../../kb/DEBT_REGISTER.md); la vista per il cruscotto di Enzo è `cruscotto/stato.json`.

## Storia

<!-- generato:storia -->
Il riordino del 2026-11-25 ha ritirato **5** documenti di questo dominio (lotti: A4 3, B 2). Si recuperano con `git show <commit>:<percorso>` dai commit 87d7ce9d9, a1872a180, oppure dalla copia nel cestino della cartella del progetto; l'elenco completo è nel [registro dei ritiri](../../piani/riordino-documentazione_20261125/REGISTRO_RITIRI.tsv).

Da dove venivano: `cowork_reserved` 3, `docs/superpowers/plans` 1, `docs/superpowers/specs` 1.
<!-- /generato -->

## Vedi anche

[stato-pianificazione](stato-pianificazione.md), [qualita-verifica](qualita-verifica.md), [operazioni-infra](operazioni-infra.md).
