---
dominio: agenti-ia
natura: riferimento
stato: vivo
aggiornato_il: 2026-11-26
sintesi: Agenti e assistente con l'abbonamento di Enzo, dentro i permessi di chi chiede
fonti: [CLAUDE.md, docs/architecture/adr/0063_heuresys_ai_driven_l_organizzazione_ghost.md, docs/architecture/adr/0053_gli_agenti_agiscono_senza_conferma_una_capacita_alla_volta.md, docs/architecture/adr/0056_i_principi_agentici_dottrina_comune_degli_agenti.md, apps/agent-gateway]
concetti: [agente, assistente, applet]
---

# Agenti e IA

## Com'è oggi

- Gli agenti e l'assistente pensano con l'abbonamento Claude di Enzo; nessuna chiave API nel codice o nell'ambiente (ADR-0056 D3). La questione è chiusa e non si solleva.
- Ogni agente su systemd, timer o `claude -p` carica il token di lunga durata con `. ~/.claude/tools/token-agenti.sh carica`; lo stato si legge con `bash ~/.claude/tools/token-agenti.sh verifica`.
- L'agente legge ciò che legge la persona (ADR-0040). Il meccanismo per agire senza conferma, una capacità alla volta, esiste (ADR-0053), ma il modo `LIBERA` resta spento: ogni scrittura parte solo con la conferma della persona collegata che la chiede (ADR-0063 D3, D4).
- ADR-0063 è il metro: un'organizzazione ghost di agenti, un Capo per divisione e direzione con la sua squadra, lavora con tutte le persone del tenant su tutte le funzioni dell'HR manager e sugli scenari what-if; il piano è [PIANO_heuresys-ai-driven_20261126.md](../../piani/PIANO_heuresys-ai-driven_20261126.md).
- Le applet dell'assistente lavorano entro i permessi di chi le chiede (ADR-0060); i principi agentici sono comuni ad advanced e datastore (ADR-0056).

## Decisioni in vigore

<!-- generato:decisioni -->
| ADR | Decisione | Status nel file |
|---|---|---|
| [0033](../../architecture/adr/0033_generic_tool_catalogue_over_domain_metadata.md) | Catalogo di strumenti generici sui metadati di dominio, invece di uno strumento per modulo | PROPOSED |
| [0040](../../architecture/adr/0040_l_agente_legge_cio_che_legge_la_persona.md) | L'agente legge ciò che legge la persona; il freno si sposta dal tipo di dato all'uso | ACCEPTED · in parte superato da ADR-0053 |
| [0053](../../architecture/adr/0053_gli_agenti_agiscono_senza_conferma_una_capacita_alla_volta.md) | Gli agenti agiscono senza conferma anche in produzione, una capacità alla volta | ACCETTATO il 2026-11-03 da Enzo Spenuso · in parte superato da ADR-0063 |
| [0056](../../architecture/adr/0056_i_principi_agentici_dottrina_comune_degli_agenti.md) | I principi agentici sono la dottrina comune degli agenti di advanced e del datastore | ACCETTATO il 2026-11-06 da Enzo Spenuso, alle 04:00 UTC |
| [0060](../../architecture/adr/0060_le_applet_dell_assistente.md) | Le applet dell'assistente: il lavoro che l'assistente costruisce e svolge, entro i permessi di chi lo chiede | ACCETTATO il 2026-11-18 da Enzo Spenuso, alle 15:50 UTC |
| [0063](../../architecture/adr/0063_heuresys_ai_driven_l_organizzazione_ghost.md) | Heuresys è AI-driven: un'organizzazione ghost di agenti lavora con le persone del tenant | ACCETTATO il 2026-11-26 da Enzo Spenuso |
<!-- /generato -->

## Come si fa

| cosa | comando |
|---|---|
| perimetri dei concetti dell'agente | `python docs/kb/tools/check_concetti_agente.py` |

## Costi, rischi e ritorno del gateway

Dalla nota del 2026-11-05 per le decisioni A-7 e A-11 del piano interfacce, accorpata qui il 2026-11-25 dalla cartella del progetto (`gateway-agenti/`; l'originale è stato cancellato il 2026-11-26 con lo svuotamento del cestino, voce R14). Le misure sono di quel giorno.

- **Costo**: il gateway pensa con l'abbonamento (`AGENT_GATEWAY_SUBSCRIPTION_AUTH=1`, `apps/agent-gateway/src/subscription-auth.ts`), quindi il costo in euro per conversazione è zero; il costo vero è la capacità dell'abbonamento, condivisa con i thread di sviluppo. Una conversazione fa da 3 a 10 giri col modello (stima del 5/11, non misura). Ogni conversazione avvia un processo `claude` da 85-135 MB sulla VM (misura `ps` del 5/11).
- **Rischi e come si tolgono**: l'approvazione di una scrittura è legata alla persona che l'ha chiesta e le conversazioni hanno un tetto per persona e in totale (`apps/agent-gateway/src/server.ts`, `apps/agent-gateway/src/limiti.ts`; erano R3 e R4 della nota); il gateway e il giudice del consolidamento stanno nello stesso processo, quindi un sovraccarico dell'uno ferma l'altro (R5); le risposte dell'API mandate al modello non si richiamano, e per questo ci sono il contatore delle persone distinte e le soglie (`persone-distinte.ts`, `soglie-persone.ts`, R6); ogni scrittura dell'assistente passa dall'approvazione umana con il diniego come scelta predefinita (`write-gate.ts`, R7); il diario va nel database solo con la sua configurazione, altrimenti su file (R8, da misurare nella dimostrazione); `API_DOCS_ENABLED` mostra la mappa OpenAPI a chi ha fatto login (R9); `NEXT_PUBLIC_ENABLE_AGENT_DEV` si fissa alla costruzione del web, quindi cambiarlo vuol dire ricostruire e rilasciare (R10).
- **Come si torna indietro**: assistente aperto al web, si toglie la regola nginx verso la porta 8790 o si spegne la rotta `/agent` (un minuto); gateway intero, `systemctl stop heuresys-agent-gateway`, che ferma anche il giudice (secondi); `API_DOCS_ENABLED`, si rimette a false e si riavvia l'API (un minuto); `NEXT_PUBLIC_ENABLE_AGENT_DEV`, si ricostruisce il web e si rilascia (10-20 minuti); le scritture dell'agente sono scritture approvate da una persona e si correggono come le altre; i dati già inviati al modello sono la sola parte che non torna indietro.

## Storia

<!-- generato:storia -->
Il riordino del 2026-11-25 ha ritirato **7** documenti di questo dominio (lotti: ACC-campioni 2, B 5). Si recuperano con `git show <commit>:<percorso>` dai commit a1872a180, dbd339511, (il cestino del riordino è stato svuotato il 2026-11-26, voce R14); l'elenco completo è nel [registro dei ritiri](../../piani/riordino-documentazione_20261125/REGISTRO_RITIRI.tsv).

Da dove venivano: `docs/superpowers/specs` 3, `docs/superpowers/plans` 2, `docs/wargames/reviews` 1, `docs/wargames/tasks` 1.
<!-- /generato -->

## Vedi anche

[sicurezza-accessi](sicurezza-accessi.md), [prodotto-visione](prodotto-visione.md).
