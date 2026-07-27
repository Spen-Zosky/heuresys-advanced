# storia36 — Registro dei dossier (derivato dal grafo FK, mai a mano)

> Nato al C0 del piano `docs/superpowers/plans/2026-07-27-rtl-storia-36-mesi.md`.
> **Il registro non si elenca a mano: si DERIVA da `pg_constraint`** (anti-pattern AP-03 —
> un elenco manuale vale quanto la fantasia di chi lo scrive). La forma ESEGUIBILE del
> registro è `db/scripts/verify-storia36-dossier.sql` (funzione
> `staging.storia36_assert_dossier_completeness()`): questo file spiega il metodo e fissa
> lo snapshot; in caso di divergenza fa fede l'eseguibile.

## Metodo di derivazione

1. **Edge di business**: tutte le FK `sys.* → sys.*` da `pg_constraint` (contype `f`),
   **escluse** le colonne write-audit — la lezione I14: l'attore che SCRIVE una riga non è
   il soggetto della riga. Tre forme escluse: `*_by`, `*_actor*`,
   `(created|updated|deleted)_by_user_id` (variante lunga scoperta in self-review C0:
   4 colonne, 2 tabelle che entravano in PERSONA solo per l'audit di scrittura). Le
   colonne-RUOLO (approver, reviewer, validator, performer…) restano business: fanno
   parte del record, non del suo audit trail. Nota P-06: `confdeltype` non basta a
   discriminare (44 archi soggetto sono anch'essi `SET NULL`) — serve il nome.
2. **Hub**: le entità su cui convergono famiglie di riferimenti, misurate dal grafo
   (snapshot 2026-07-27: tenancies←144 tabelle, users←135, positions←30, org_units←10,
   kpi_definitions←8; teams e blueprint_process_registry come hub di dominio del piano).
3. **Membership**: chiusura ricorsiva — una tabella appartiene al dossier H se una catena
   di FK di business la porta a H (direttamente o via tabelle intermedie).
4. **CATALOGO** (famiglia derivata): tabelle raggiunte in senso INVERSO — referenziate,
   direttamente o transitivamente, dai membri dei dossier. Sono i dati di riferimento a
   monte (taxonomy skill, job families, tipi/OU-template, metodi, blueprint plane).
5. **PIATTAFORMA** (allowlist esplicita, GIUSTIFICATA riga per riga nel .sql): il residuo
   che non ha FK né verso né dai dossier — infra (schema_migrations, i18n, embeddings,
   crosswalk non ancora agganciati, RBAC platform-global, leads GTM, gdpr_data_map,
   reconciliation_registry, ui_interfaces, kpi_weighting_rules, skill_proficiency_levels
   che è agganciato via `varchar+CHECK` RD-08 e non via FK).

**Check di completezza (falsificabile)**: ogni tabella `sys.*` ∈ membri ∪ CATALOGO ∪
allowlist, ricalcolato dal catalogo di sistema a ogni esecuzione — una tabella nuova non
classificata rende il registro ROSSO (self-test al C0: tabella orfana iniettata in
transazione → il check DEVE scattare → rollback).

## Snapshot 2026-07-27 (derivazione su 206 tabelle — conteggi, non elenchi)

| Dossier / famiglia | Tabelle | Note |
|---|---|---|
| TENANT | 172 | il perimetro I5: tutto ciò che è tenant-scoped |
| PERSONA | 126 | la persona è UNA istanza della classe generale |
| UNITA_ORG | 52 | include la discesa posizioni→assignments |
| POSIZIONE | 34 | position-centric (I1) |
| CASCATA_KPI | 9 | definizione→template→target→misurazioni |
| PROCESSO | 6 | blueprint_process_registry + discendenza (RACI, KPI templates) |
| TEAM | 2 | `sys_teams` + `sys_team_members` (lo scope funzionale I16 vive qui) |
| CATALOGO (derivata) | 16 | reference data a monte dei dossier |
| PIATTAFORMA (allowlist) | 17 | giustificazioni nel .sql, una per riga |
| **Membri distinti** | **173** | 173 + 16 + 17 = **206/206** ✓ |

Una tabella può appartenere a PIÙ dossier (es. `sys_user_position_assignments` ∈ PERSONA
∩ POSIZIONE ∩ UNITA_ORG ∩ TENANT): è la natura del grafo, non un errore.

## Differenze rispetto all'elenco atteso dal piano (capite, non zittite)

- **+CATALOGO, +PIATTAFORMA**: il piano elencava 7 dossier di business; la derivazione
  mostra che 33 tabelle vivono a monte o a lato dei dossier. Sono famiglie legittime con
  regole di verifica proprie (un catalogo si verifica per integrità interna, non per
  storia d'uso).
- **`sys_blueprint_process_registry` è l'unico membro fuori dal perimetro TENANT**: è il
  registro globale dei processi (piano blueprint condiviso); la tenant-scoping avviene
  alle attivazioni (`sys_blueprint_activations`, C6). Il check I5 del dossier TENANT lo
  esclude esplicitamente per questo motivo.
- **TEAM è piccolo (2 tabelle)**: la derivazione da OU e la sincronia lead/membership
  sono asserzioni di CONTENUTO (batteria del dossier), non di struttura FK.

## Le batterie per-dossier

Vivono in `db/scripts/verify-storia36-dossier.sql`, una sezione per dossier, e vengono
riempite dal cluster che tocca il dossier (C1→PERSONA presenze, C2→PERSONA valutazioni,
C6→UNITA_ORG history, C7→PROCESSO, ...). La batteria per-persona 162/162 (mai a campione)
è `db/scripts/verify-storia36-person.sql` (arriva con i cluster C1-C5). Ogni check è
un'**asserzione di proprietà** con finestra a parametro, mai una fotografia.
