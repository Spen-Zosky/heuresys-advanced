# Ciclo S1060 — Sbloccare il deploy fermo dal 14 agosto

**Scelta di Enzo**: voce **#1** del menu di apertura (P0 — CI rossa che tiene ferme le due macchine).
**Confine di sessione dichiarato all'inizio**: il ciclo è **completabile in questa sessione**; l'unico
passo che non dipende da me è l'autorizzazione al `push` (contenuta nella scelta della voce #1, che
diceva «portare davvero il codice sulle due macchine»).

## Il fatto, misurato

| Cosa | Misura | Comando |
|---|---|---|
| Deploy armato su | `d016ea73` | `bash scripts/verifica-deploy.sh` |
| Macchine ferme su | `1d4672f3` (VM **e** linux-pc) | idem |
| Verdetto | **CI-ROSSA** — 1 corsa bocciata su 3 | idem |
| Corsa rossa | `Test (api integration)` run `31812844661` | `gh run list --limit 8` |
| Test falliti | **1 su 241** — `rbac-tenant-admin-allowlist.test.ts` | `gh run view 31812844661 --log-failed` |
| Messaggio | `permessi assorbiti da TENANT_ADMIN fuori allowlist: expected [ 'performance-review:read:self' ] to deeply equal []` | idem |
| Riprodotto in locale | **sì**, 5,16 s — 1 failed / 1 passed | `cd apps/api && pnpm exec vitest run test/rbac-tenant-admin-allowlist.test.ts` |
| Produzione | `readyz=200 login=200` — su, ma serve codice di ieri | `bash scripts/verifica-deploy.sh` |

**Causa**: la migrazione `000312_me_performance_reviews_self.sql` (ciclo S1059, `#92 F5`) concede
`performance-review:read:self` a `PLATFORM_ADMIN · TENANT_ADMIN · READ_ONLY · USER`, ma **non porta il
marker `TENANT_ADMIN-ALLOWLIST-EXTEND`** che la politica deny-by-default D-57 richiede (dichiarata
nell'intestazione della `000210`, righe 20-26). La sentinella ha fatto esattamente il suo lavoro:
un permesso è arrivato a `TENANT_ADMIN` senza essere dichiarato.

**Il grant è voluto, non è un errore**: gli altri 28 permessi `:self` sono già in allowlist
(`assessment:read:self`, `goal:read:self`, `skill:read:self`, …) e I17 impone il pavimento ESS
universale. Quindi si dichiara il permesso, **non** si revoca.

## Simulazione a 5 domande (prima di eseguire)

| Domanda | Risposta |
|---|---|
| **Precondizioni** | tunnel `:5433` su (BOOT: OK) · DB raggiungibile (OK) · `gh` autenticato come `Spen-Zosky` (OK) · `linux-pc` raggiungibile per la prova generale (**da verificare, V2**) |
| **Meccanismo** | letto il **formato reale**, non presunto: `000214` righe 30-35 — commento marker, `CREATE TEMP TABLE _ta_extend_<num>`, `INSERT … VALUES ('<code>');`, `DROP TABLE`. Il parser del test (`CODE_ROW`, riga 38) prende le righe `('code'),` **dopo** il marker. Effetto sul database: **nullo** (temp table creata e droppata) |
| **Propagazione** | il file entra in git → la CI lo legge dal checkout → `heuresys-advanced-deploy-watch.timer` (attivo su entrambe le macchine) riapplica la catena al primo verde. Nessun passo manuale sulle macchine |
| **Chi** | io, tranne il `push` (autorizzazione di Enzo, implicita nella scelta della voce #1 — dichiarata qui) |
| **Guardia** | non è una scrittura distruttiva né di massa. Rischio unico: collisione del nome temp table → uso `_ta_extend_000312`, univoco. Post-condizione che protegge ciò che NON deve cambiare: il **secondo** test del file (`deny-by-default è reale`) e la post-condizione della `000210` (audience == allowlist) devono restare verdi |

## Voci

| id | cosa | chi | cosa significa fatto | stato |
|---|---|---|---|---|
| V1 | Emendare `db/migrations/000312_*.sql` col blocco marker `TENANT_ADMIN-ALLOWLIST-EXTEND` | io | il file contiene il marker nel formato della `000214` | **FATTO** |
| V2 | Prova generale della catena su `linux-pc` (`ci-rehearsal.sh`) | io | catena riapplicata due volte, sentinelle interrogate, esito verde | **FATTO** — `ESITO: VERDE`, 287 applicate + 23 saltate ×2 passate (9s + 10s), `[OK] sentinelle 17/17 a zero`; la `000312` esegue `CREATE TABLE / INSERT 0 1 / DROP TABLE` e la post-condizione dichiara «permesso self a 4 ruoli; 546 comunicate, 2 non comunicate» |
| V3 | Rilanciare il test in locale: da rosso a **verde** | io | `1 failed → 0 failed`, entrambi i test del file passano | **FATTO** — `Test Files 1 passed (1) · Tests 2 passed (2)` in 2,68 s. La prova **sa fallire**: 90 s prima lo stesso comando dava `1 failed \| 1 passed` |
| V4 | Commit atomico | io | un commit che porta solo questo | DA FARE |
| V5 | Push su `main` + attesa della CI | io (autorizzazione Enzo) | le 3 corse del commit tutte verdi | DA FARE |
| V6 | Armare il deploy e verificarne l'esito **dalle macchine** | io | `verifica-deploy.sh` dice **DEPLOYATO** | DA FARE |

## Registro delle scoperte (fuori da questo ciclo — R24 §5)

| cosa | quando presentarlo |
|---|---|
| La `000312` è passata dalla prova generale di S1059 senza che nessuno vedesse la mancanza del marker: `ci-rehearsal.sh` **applica la catena** ma non esegue la suite Vitest, quindi questa classe di difetto (guardia in un test, non in una post-condizione SQL) le sfugge per costruzione. Una post-condizione dentro la `000210` che replicasse l'asserzione del test la coglierebbe in 12 secondi invece che in 47 minuti. | una volta sola, a fine ciclo |

## Chiusura

_(da scrivere leggendo la tabella qui sopra, quando tutte le voci hanno un esito misurato)_
