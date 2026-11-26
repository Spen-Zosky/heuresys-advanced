---
dominio: consolidamento-tenant
natura: riferimento
stato: vivo
aggiornato_il: 2026-11-25
sintesi: Allineamento e consolidamento del tenant con le corse del datastore
fonti: [docs/architecture/adr/0059_allineamento_e_consolidamento_due_modi.md, apps/api/src/modules/tenant-consolidation]
concetti: [consolidamento, corsa, tenant, fascicolo]
---

# Consolidamento del tenant

## Com'è oggi

- Allineamento e consolidamento sono due modi dello stesso motore (ADR-0059), in `apps/api/src/modules/tenant-consolidation/`.
- Il fascicolo del tenant ha un contratto: consegna per file, identità della versione, versione fissata sull'attivazione (ADR-0047); le personalizzazioni sopravvivono a una versione nuova del modello secondo ADR-0048; ricerche, liste e agente leggono solo dentro il fascicolo (ADR-0046).
- Il confronto di RTL con una corsa del datastore produce decisioni in bozza; solo il pulsante rosso scrive nel database, e decide l'`HRMS_MANAGER` del tenant.

## Decisioni in vigore

<!-- generato:decisioni -->
| ADR | Decisione | Status nel file |
|---|---|---|
| [0042](../../architecture/adr/0042_catena_del_semilavorato.md) | La catena del semilavorato: la piattaforma genera, il cliente possiede | ACCETTATO |
| [0046](../../architecture/adr/0046_perimetro_del_tenant.md) | Il perimetro del tenant: ricerche, liste di scelta e agente leggono solo dentro il fascicolo | ACCETTATO il 2026-10-23 da Enzo Spenuso |
| [0047](../../architecture/adr/0047_contratto_del_fascicolo.md) | Il contratto del fascicolo: consegna per file, identità della versione, versione fissata sull'attivazione | ACCETTATO il 2026-10-23 da Enzo Spenuso |
| [0048](../../architecture/adr/0048_personalizzazioni_del_tenant.md) | Le personalizzazioni del tenant all'arrivo di una versione nuova del modello | ACCETTATO il 2026-10-23 da Enzo Spenuso |
| [0059](../../architecture/adr/0059_allineamento_e_consolidamento_due_modi.md) | Allineamento e Consolidamento: due modi dello stesso motore | ACCETTATO il 2026-11-16 da Enzo Spenuso, alle 01:35 UTC |
<!-- /generato -->

## Storia

<!-- generato:storia -->
Il riordino del 2026-11-25 ha ritirato **1** documenti di questo dominio (lotti: B 1). Si recuperano con `git show <commit>:<percorso>` dai commit a1872a180, (il cestino del riordino è stato svuotato il 2026-11-26, voce R14); l'elenco completo è nel [registro dei ritiri](../../piani/riordino-documentazione_20261125/REGISTRO_RITIRI.tsv).

Da dove venivano: `docs/integrations` 1.
<!-- /generato -->

## Vedi anche

[tassonomie-conoscenza](tassonomie-conoscenza.md), [dati-db](dati-db.md).
