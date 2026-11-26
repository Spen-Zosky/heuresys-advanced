---
dominio: processi-organizzazione
natura: riferimento
stato: vivo
aggiornato_il: 2026-11-25
sintesi: Posizioni, unità, processi e attività: la partecipazione si lega alla posizione
fonti: [docs/architecture/adr/0044_partecipazione_ai_processi_legata_alla_posizione.md, docs/architecture/adr/0049_le_attivita_appartengono_a_un_processo.md, docs/architecture/adr/0061_tassonomia_e_metamodel_dei_processi.md]
concetti: [posizione, unità, processo, attività, organigramma]
---

# Processi e organizzazione

## Com'è oggi

- Il modello è centrato sulla posizione; proprietario della posizione e titolare sono distinti (I1).
- La partecipazione ai processi si lega alla posizione, non alla persona (ADR-0044); le attività appartengono a un processo (ADR-0049) e si delegano lungo la catena (ADR-0051).
- La tassonomia dei processi è multidimensionale, con un metamodello comune (ADR-0061).
- Gli organigrammi della SPA sono a blocchi e navigabili, con dati vivi.

## Decisioni in vigore

<!-- generato:decisioni -->
| ADR | Decisione | Status nel file |
|---|---|---|
| [0044](../../architecture/adr/0044_partecipazione_ai_processi_legata_alla_posizione.md) | La partecipazione ai processi si lega alla posizione, non alla persona | ACCETTATO il 2026-10-12 da Enzo Spenuso |
| [0049](../../architecture/adr/0049_le_attivita_appartengono_a_un_processo.md) | Le attività appartengono a un processo | ACCETTATO il 2026-10-29 da Enzo Spenuso |
| [0051](../../architecture/adr/0051_attivita_delegate_lungo_la_catena.md) | Le attività delegate lungo la catena | ACCETTATO il 2026-10-31 da Enzo Spenuso |
| [0061](../../architecture/adr/0061_tassonomia_e_metamodel_dei_processi.md) | Tassonomia multidimensionale e metamodel dei processi | ACCETTATO il 2026-11-22 da Enzo Spenuso, alle 03:21 UTC |
<!-- /generato -->

## Storia

<!-- generato:storia -->
Il riordino del 2026-11-25 ha ritirato **8** documenti di questo dominio (lotti: ACC-1 1, ACC-2 5, B 2). Si recuperano con `git show <commit>:<percorso>` dai commit a1872a180, dbd339511, (il cestino del riordino è stato svuotato il 2026-11-26, voce R14); l'elenco completo è nel [registro dei ritiri](../../piani/riordino-documentazione_20261125/REGISTRO_RITIRI.tsv).

Da dove venivano: `docs/source_bundle/extracted_bootstrap/industry_blueprints/FIN_BANKING/processes` 5, `docs/superpowers/specs` 2, `docs/piani` 1.
<!-- /generato -->

## Vedi anche

[tassonomie-conoscenza](tassonomie-conoscenza.md), [consolidamento-tenant](consolidamento-tenant.md).
