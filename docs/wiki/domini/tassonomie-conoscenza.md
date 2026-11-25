---
dominio: tassonomie-conoscenza
natura: riferimento
stato: vivo
aggiornato_il: 2026-11-25
sintesi: ESCO, ISCO, NACE, ATECO, CCNL: aperte a tutte le industrie nel datastore, il tenant vede il suo perimetro
fonti: [docs/architecture/adr/0043_separazione_dal_datastore.md, docs/kb/GLOSSARIO_dieci-oggetti_v0.3.md]
concetti: [tassonomia, competenza, ccnl, glossario]
---

# Tassonomie e conoscenza

## Com'è oggi

- Le tassonomie (ESCO, ISCO, NACE, ATECO, CCNL, modelli operativi) restano aperte a tutte le industrie nel datastore; in advanced un tenant ne vede solo il proprio perimetro (I21, ADR-0043).
- Le competenze ESCO sono cittadine di prim'ordine (ADR-0030); catalogo, profilo e voci proprie del cliente seguono ADR-0039, in parte superato da ADR-0043.
- Il glossario dei dieci oggetti è [GLOSSARIO_dieci-oggetti_v0.3](../../kb/GLOSSARIO_dieci-oggetti_v0.3.md), gemello di quello del datastore.
- I dati derivati dall'industria di un tenant sono coerenti con essa: RTL Bank segue il CCNL del credito.

## Decisioni in vigore

<!-- generato:decisioni -->
| ADR | Decisione | Status nel file |
|---|---|---|
| [0030](../../architecture/adr/0030_esco_skill_group_ontology.md) | Ontologia competenze ESCO come cittadino di prim'ordine (`sys_skill_groups`) | Accepted |
| [0039](../../architecture/adr/0039_catalogo_profilo_e_voci_proprie_del_cliente.md) | Catalogo, profilo, voci proprie: dove vive ciò che un cliente può farsi su misura | ACCEPTED · in parte superato da ADR-0043 |
| [0042](../../architecture/adr/0042_catena_del_semilavorato.md) | La catena del semilavorato: la piattaforma genera, il cliente possiede | ACCETTATO |
| [0043](../../architecture/adr/0043_separazione_dal_datastore.md) | La separazione dal datastore: la piattaforma tiene i cataloghi e genera i modelli, advanced tiene il tenant | ACCETTATO il 2026-10-12 da Enzo Spenuso |
| [0061](../../architecture/adr/0061_tassonomia_e_metamodel_dei_processi.md) | Tassonomia multidimensionale e metamodel dei processi | ACCETTATO il 2026-11-22 da Enzo Spenuso, alle 03:21 UTC |
<!-- /generato -->

## Storia

<!-- generato:storia -->
Il riordino del 2026-11-25 ha ritirato **20** documenti di questo dominio (lotti: A4 1, B 19). Si recuperano con `git show <commit>:<percorso>` dai commit 87d7ce9d9, a1872a180, oppure dalla copia nel cestino della cartella del progetto; l'elenco completo è nel [registro dei ritiri](../../piani/riordino-documentazione_20261125/REGISTRO_RITIRI.tsv).

Da dove venivano: `docs/source_bundle/extracted_bootstrap/seed_acquisition/prompts` 8, `docs/source_bundle/extracted_bootstrap/seed_acquisition` 5, `docs/integrations` 2, `docs/superpowers/specs` 2, `qa_artifacts/data_integrity/20260531_s952` 1, `cowork_code_exchange` 1, `docs/kb/tools/atlas-sweep-templates` 1.
<!-- /generato -->

## Vedi anche

[processi-organizzazione](processi-organizzazione.md), [consolidamento-tenant](consolidamento-tenant.md).
