# A2 — La distanza fra RTL Bank e la corsa p20261010010521tjb, misurata il 2026-11-16

Voce A2 del piano `docs/piani/PIANO_allineamento-consolidamento_20261116.md`. Criterio di «fatta»: su RTL contro la corsa `p20261010010521tjb` la misura ridà i numeri di `confronto-corsa-rtl/dati_20261111/riepilogo.json` (file del progetto) o spiega ogni differenza con una query.

## Lo strumento

- Codice: `apps/api/src/modules/tenant-consolidation/distanza.ts` (sola lettura, 24 domini).
- Comando: `pnpm --filter @heuresys/api consolidation:distance -- --tenant RTL_BANK --run p20261010010521tjb [--dettaglio] [--dominio <d>]`. Tutte le query girano in una transazione `READ ONLY` chiusa con ROLLBACK.
- Rotta: `GET /v1/consolidation-runs/:runId/distance?dettaglio=true&dominio=<d>` (la legge solo chi ha la lettura piena del consolidamento; un delegato limitato ad alcuni gruppi riceve `PERMISSION_DENIED`).
- Misura dal vivo: produzione, 2026-11-16 01:50:40 UTC, versione di modello `dc246c24-d3d0-498c-a853-47f9b48b4180` (la corsa nel registro `sys_blueprint_runs`, stato `IN_CONSOLIDAMENTO`). Esito completo con il dettaglio di ogni riga: `A2_distanza_RTL_tjb_20261116.json` nei file del progetto (cartella `consolidamento/`), non nel repository perché contiene i nomi di unità e posizioni di produzione; si rigenera con il comando e `--dettaglio`.

Totale: 2.167 righe, 508 uguali, 310 parziali, 81 diverse, 918 solo nel modello, 350 solo in RTL; ricchezza persa 16 (8 attributi di unità, 8 di indicatori).

## Oggi contro l'11/11

Colonne: righe, uguali, parziali, diverse, solo modello, solo tenant, ricchezza persa di oggi; poi righe, corrispondenti, parziali, diverse, solo corsa, solo RTL dell'11/11; infine le voci del lato modello e del lato tenant, oggi / 11/11.

| dominio | righe | ug | pa | di | sM | sT | rp | 11/11 righe | co | pa | di | sC | sR | lato modello | lato tenant |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ateco | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 3 | 1 | 0 | 0 | 2 | 0 | 1 / 3 | 1 / 1 |
| classe | 8 | 1 | 3 | 0 | 2 | 2 | 0 | 7 | 6 | 0 | 0 | 0 | 1 | 6 / 6 | 6 / 7 |
| ccnl | 29 | 10 | 0 | 0 | 14 | 5 | 0 | 28 | 9 | 3 | 0 | 12 | 4 | 24 / 24 | 15 / 16 |
| processi | 43 | 1 | 7 | 0 | 22 | 13 | 0 | 36 | 11 | 17 | 0 | 2 | 6 | 30 / 30 | 21 / 34 |
| unita | 50 | 5 | 14 | 0 | 12 | 19 | 8 | 48 | 16 | 13 | 0 | 10 | 9 | 31 / 39 | 38 / 38 |
| organigramma | 50 | 6 | 13 | 0 | 12 | 19 | 0 | 48 | 12 | 17 | 0 | 10 | 9 | 31 / 39 | 38 / 38 |
| obblighi | 20 | 0 | 0 | 0 | 20 | 0 | 0 | 20 | 0 | 0 | 0 | 20 | 0 | 20 / 20 | 0 / 0 |
| ruoli | 160 | 6 | 72 | 0 | 47 | 35 | 0 | 166 | 47 | 77 | 0 | 40 | 2 | 125 / 164 | 113 / 126 |
| copertura | 20 | 8 | 8 | 0 | 4 | 0 | 0 | 20 | 0 | 16 | 0 | 4 | 0 | 20 / 20 | 16 / 16 |
| inquadramento | 109 | 49 | 0 | 13 | 47 | 0 | 0 | 164 | 107 | 0 | 17 | 40 | 0 | 109 / 164 | 62 / 124 |
| fasi | 219 | 23 | 56 | 0 | 88 | 52 | 0 | 251 | 40 | 7 | 0 | 120 | 84 | 167 / 167 | 131 / 131 |
| skill | 109 | 44 | 6 | 12 | 47 | 0 | 0 | 164 | 115 | 1 | 8 | 40 | 0 | 109 / 164 | 62 / 124 |
| obiettivi | 285 | 150 | 2 | 0 | 95 | 38 | 0 | 263 | 157 | 39 | 0 | 51 | 16 | 247 / 247 | 190 / 212 |
| metriche | 346 | 56 | 5 | 0 | 266 | 19 | 8 | 350 | 67 | 61 | 0 | 199 | 23 | 327 / 327 | 80 / 151 |
| derivati | 109 | 20 | 0 | 42 | 47 | 0 | 0 | 167 | 96 | 1 | 28 | 42 | 0 | 109 / 167 | 62 / 125 |
| bersagli | 107 | 37 | 25 | 0 | 27 | 18 | 0 | 347 | 0 | 128 | 0 | 199 | 20 | 89 / 327 | 80 / 148 |
| formazione | 45 | 30 | 0 | 0 | 0 | 15 | 0 | 45 | 30 | 0 | 0 | 0 | 15 | 30 / 30 | 45 / 45 |
| carriere | 16 | 6 | 2 | 0 | 1 | 7 | 0 | 16 | 0 | 8 | 0 | 1 | 7 | 9 / 9 | 15 / 15 |
| incentivi | 11 | 0 | 0 | 0 | 5 | 6 | 0 | 10 | 0 | 1 | 0 | 4 | 5 | 5 / 5 | 6 / 6 |
| commesse | 29 | 0 | 0 | 0 | 4 | 25 | 0 | 25 | 0 | 4 | 0 | 0 | 21 | 4 / 4 | 25 / 25 |
| criticita | 109 | 48 | 0 | 14 | 47 | 0 | 0 | 164 | 115 | 0 | 9 | 40 | 0 | 109 / 164 | 62 / 124 |
| condizioni | 34 | 0 | 0 | 0 | 29 | 5 | 0 | 16 | 0 | 2 | 0 | 10 | 4 | 29 / 12 | 5 / 6 |
| ruoli_funzionali | 18 | 0 | 0 | 0 | 0 | 18 | 0 | 24 | 0 | 0 | 0 | 0 | 24 | 0 / 0 | 18 / 24 |
| utenti | 240 | 7 | 97 | 0 | 82 | 54 | 0 | 243 | 50 | 86 | 0 | 85 | 22 | 186 / 221 | 158 / 158 |

Uguale in tutti e due i lati: formazione (stesse 45 righe, 30 uguali e 15 solo in RTL), obblighi (20 solo nel modello), e i lati di fasi, obiettivi del modello, metriche del modello, carriere, incentivi, commesse.

## Perché i numeri differiscono

Le differenze hanno quattro cause, e ogni dominio dice quale. Le query si eseguono in sola lettura su `heuresys_advanced`; `$V` è la versione `dc246c24-d3d0-498c-a853-47f9b48b4180`, `$T` il tenant RTL Bank `86ba7a65-217f-48ba-8ce5-5c09b40a66b0`.

**C1 — Il modello è il pacchetto caricato in advanced, non il JSON della corsa del datastore.** Il confronto dell'11/11 leggeva la corsa dal servizio del datastore, dove le filiali ripetevano le loro unità (U16-U21, tre volte gli stessi uffici) e un ruolo della corsa poteva dare più righe. In advanced la versione ha 31 unità e 109 posizioni: `SELECT count(*) FROM sys.sys_blueprint_content_units WHERE blueprint_content_unit_version_id = $V` dà 31; con `sys_blueprint_content_positions` 109. Spiega il lato modello di unita e organigramma (31 contro 39), di ruoli, inquadramento, skill, criticita, derivati (109 contro 164-167) e di utenti (186 posti previsti contro 221). Per ateco l'11/11 contava anche le due alternative scartate dalla corsa, che il pacchetto non porta (1 contro 3). Per bersagli il modello conta gli indicatori con un valore obiettivo (`... sys_blueprint_content_kpis WHERE ... AND blueprint_content_kpi_target_value IS NOT NULL` dà 65) più quelli abbinati, non una riga per indicatore e per persona. Per condizioni il pacchetto porta 29 condizioni degli istituti (`sys_blueprint_content_ccnl_conditions`), l'11/11 ne mostrava 12.

**C2 — RTL non è più quello dell'11/11.** Oggi RTL ha 162 posizioni attive, 113 ruoli distinti per titolo e unità (`SELECT count(*), count(DISTINCT (position_title, position_organization_unit_id)) FROM sys.sys_positions WHERE position_tenant_id = $T AND position_is_active`), contro i 126 gruppi dell'11/11; 62 ruoli abbinati portano inquadramento, competenze, criticità e riporto (contro 124). I processi del tenant sono 23 (`sys_tenant_processes`, catalogo approvato il 10/11); l'11/11 leggeva invece i 34 processi del registro del modello attivo v1. Gli indicatori usati da RTL sono 80 (requisiti di posizione o bersagli), i modelli di obiettivo attivi 190, gli indicatori con bersagli 75 (`count(DISTINCT kpi_definition_name)` su `sys_kpi_targets` del tenant), le persone con un incarico attivo 158 come l'11/11. Le unità sono state toccate anche il 16/11 (`max(updated_at)` di `sys_organization_units` del tenant: 2026-11-16 01:41 UTC).

**C3 — Il riconoscimento è automatico, l'11/11 era scritto a mano.** `costruisci.py` (datastore, `scripts/confronto_rtl/`) abbinava ruoli e unità con due tabelle scritte a mano (`M` e `UM`, con note come «Filiale 1 abbinata a Milano Centro») e contava come corrispondenti abbinamenti uno-a-molti. Qui l'abbinamento è deterministico: nome uguale dopo la normalizzazione o somiglianza per parole di almeno 0,7 (la stessa `sim` dell'11/11), parziale da 0,35, uno a uno. Per questo calano gli uguali di unita (5 contro 16), ruoli (6 contro 47) e utenti (7 contro 50), e salgono i solo nel tenant. Per i ruoli un titolo uguale in un'unità che non corrisponde è parziale; un ruolo di RTL ripetuto in altre unità (le filiali che il modello non ha) con il titolo di un ruolo già abbinato è parziale, come l'11/11 faceva per le filiali. Nei domini che l'11/11 già abbinava per somiglianza (formazione, obiettivi, metriche) i numeri sono vicini o uguali: formazione è identica.

**C4 — Alcuni domini hanno una definizione dichiarata qui.** copertura: un obbligo è coperto se le posizioni che il modello designa hanno una posizione abbinata in RTL (8 tutte, 8 in parte, 4 nessuna). bersagli: uguale se uno dei bersagli di RTL per l'indicatore abbinato ha il valore obiettivo del modello (37). ccnl: contratti, livelli nella forma 3A3L/QD2/Dirigente e istituti contro le regole di maturazione. ruoli_funzionali: il modello non porta ruoli di accesso (`sys_blueprint_content_decision_rights` vuota per $V), quindi tutto è solo in RTL; si contano i 18 ruoli assegnati, una riga per ruolo, dove l'11/11 dava una riga per titolare dei ruoli non generici (24). La definizione di ogni dominio è anche nel campo `nota` della risposta.

## Che cosa dice la misura

La distanza misurata oggi è il punto di partenza dell'Allineamento di RTL (ADR-0059): 918 voci del modello mancano in RTL, 350 voci di RTL non sono nel modello, 391 coppie riconosciute differiscono (parziali più diverse). Le tappe successive si chiudono rimisurando con lo stesso comando, prima su una copia e poi in produzione. Il riconoscimento migliorerà con la tappa C (candidati semantici, contesto strutturale): quando cambierà, i numeri di oggi andranno rimisurati con la nuova versione dello strumento, non confrontati con questi.

## Scoperta

`sorgenti.ts` del consolidamento legge l'indirizzo ESCO delle competenze del modello da `blueprint_content_skill_metadata->>'esco_uri'`, che è vuoto per tutte le 443 competenze della versione, mentre la colonna `blueprint_content_skill_esco_uri` lo ha per 443 su 443 (`SELECT count(*), count(blueprint_content_skill_esco_uri), count(blueprint_content_skill_metadata->>'esco_uri') FROM sys.sys_blueprint_content_skills WHERE blueprint_content_skill_version_id = $V` dà 443, 443, 0). Per le posizioni lo stesso file legge `job_role_code` ed `esco_occupation_uri` dai metadati, vuoti per tutte le 109. Il giro zero per chiave del consolidamento quindi non abbina mai per indirizzo ESCO. Registrata nel registro delle scoperte del piano; questa misura legge la colonna.
