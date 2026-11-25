---
dominio: agenti-ia
natura: riferimento
stato: vivo
aggiornato_il: 2026-11-25
sintesi: Agenti e assistente con l'abbonamento di Enzo, dentro i permessi di chi chiede
fonti: [CLAUDE.md, docs/architecture/adr/0053_gli_agenti_agiscono_senza_conferma_una_capacita_alla_volta.md, docs/architecture/adr/0056_i_principi_agentici_dottrina_comune_degli_agenti.md, apps/agent-gateway]
concetti: [agente, assistente, applet]
---

# Agenti e IA

## Com'è oggi

- Gli agenti e l'assistente pensano con l'abbonamento Claude di Enzo; nessuna chiave API nel codice o nell'ambiente (ADR-0056 D3). La questione è chiusa e non si solleva.
- Ogni agente su systemd, timer o `claude -p` carica il token di lunga durata con `. ~/.claude/tools/token-agenti.sh carica`; lo stato si legge con `bash ~/.claude/tools/token-agenti.sh verifica`.
- L'agente legge ciò che legge la persona (ADR-0040) e agisce senza conferma anche in produzione, una capacità alla volta (ADR-0053).
- Le applet dell'assistente lavorano entro i permessi di chi le chiede (ADR-0060); i principi agentici sono comuni ad advanced e datastore (ADR-0056).

## Decisioni in vigore

<!-- generato:decisioni -->
| ADR | Decisione | Status nel file |
|---|---|---|
| [0033](../../architecture/adr/0033_generic_tool_catalogue_over_domain_metadata.md) | Catalogo di strumenti generici sui metadati di dominio, invece di uno strumento per modulo | PROPOSED |
| [0040](../../architecture/adr/0040_l_agente_legge_cio_che_legge_la_persona.md) | L'agente legge ciò che legge la persona; il freno si sposta dal tipo di dato all'uso | ACCEPTED · in parte superato da ADR-0053 |
| [0053](../../architecture/adr/0053_gli_agenti_agiscono_senza_conferma_una_capacita_alla_volta.md) | Gli agenti agiscono senza conferma anche in produzione, una capacità alla volta | ACCETTATO il 2026-11-03 da Enzo Spenuso |
| [0056](../../architecture/adr/0056_i_principi_agentici_dottrina_comune_degli_agenti.md) | I principi agentici sono la dottrina comune degli agenti di advanced e del datastore | ACCETTATO il 2026-11-06 da Enzo Spenuso, alle 04:00 UTC |
| [0060](../../architecture/adr/0060_le_applet_dell_assistente.md) | Le applet dell'assistente: il lavoro che l'assistente costruisce e svolge, entro i permessi di chi lo chiede | ACCETTATO il 2026-11-18 da Enzo Spenuso, alle 15:50 UTC |
<!-- /generato -->

## Come si fa

| cosa | comando |
|---|---|
| perimetri dei concetti dell'agente | `python docs/kb/tools/check_concetti_agente.py` |

## Storia

<!-- generato:storia -->
Il riordino del 2026-11-25 ha ritirato **5** documenti di questo dominio (lotti: B 5). Si recuperano con `git show <commit>:<percorso>` dai commit a1872a180, oppure dalla copia nel cestino della cartella del progetto; l'elenco completo è nel [registro dei ritiri](../../piani/riordino-documentazione_20261125/REGISTRO_RITIRI.tsv).

Da dove venivano: `docs/superpowers/specs` 3, `docs/superpowers/plans` 2.
<!-- /generato -->

## Vedi anche

[sicurezza-accessi](sicurezza-accessi.md), [prodotto-visione](prodotto-visione.md).
