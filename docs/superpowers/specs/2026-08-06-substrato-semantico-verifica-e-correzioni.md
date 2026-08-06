# Substrato semantico — verifica, due correzioni, copertura piena

**Data**: 2026-08-06 · **Root**: `D:/heuresys-advanced` (host `DESKTOP-KH728P2`)
**Mandato**: quattro task + sei verifiche, con task 4 subordinato a un ok esplicito.
**Commit prodotti** (locali, nessun push): `5b557d7a`, `2d86371b`.

---

## Esito in una riga

Il substrato semantico **risponde e risponde bene**; il salto-per-hash del backfill ora confronta
anche il modello; esiste uno strumento che misura la copertura; i 39 vettori mancanti sono stati
colmati su autorizzazione. In più: il presidio del tunnel non si rialzava da solo, e ora lo fa.

---

## Task 1 — l'API e la ricerca semantica rispondono

Eseguito in **via B** (scelta di Enzo): percorso HTTP reale
`GET /v1/matching/skills/:skillId/similar`, login reale, vettori **precalcolati** —
zero chiamate Voyage, feature flag non toccato.

*Perché non la via A*: le query in testo libero passano solo da `/v1/matching/search`, che è dietro
`MATCHING_FREETEXT_ENABLED` (default `"false"`, assente dal `.env`) e **embedda ogni query chiamando
Voyage a pagamento**. La via B esercita lo stesso motore kNN senza costo e senza toccare flag.

| # | Query (competenza reale, italiano) | Tempo | Primi risultati con punteggio |
|---|---|---|---|
| 1 | **Antiriciclaggio** | 1007 ms | Rilevamento e prevenzione delle frodi **0.8693** · Operazioni antiriciclaggio **0.8584** · individuazione delle frodi **0.8512** · prevenire le attività fraudolente **0.8425** · rilevare un crimine finanziario **0.8157** |
| 2 | **Modelli di credit scoring** | 641 ms | Erogazione prestiti **0.7752** · Gestione degli NPL **0.7711** · Stress testing e analisi di scenario **0.7558** · analizzare le informazioni relative alla storia creditizia… **0.7538** · analisi predittiva **0.7487** |
| 3 | **gestione del personale** | 398 ms | gestire le risorse umane **0.8749** · gestione delle risorse umane **0.8708** · offrire consulenza sulla gestione del personale **0.8646** · processi dell'ufficio risorse umane **0.8559** · assumere risorse umane **0.8528** |

**I risultati hanno senso**: l'antiriciclaggio tira frodi e crimine finanziario, il credit scoring
tira prestiti, NPL e stress testing. Il primo tempo include il riscaldamento; a regime **400-640 ms**.
Ri-eseguite dopo il backfill del task 4: **punteggi identici**, tempi 147-846 ms — nessuna regressione.

**Due scoperte non previste dal piano**: il login è **a due passi** (lo step 1 risponde
`mfa_required` con un `challengeToken` e **non rilascia cookie**), e il secondo fattore serve anche
con l'enforcement spento, perché la persona *possiede* un fattore verificato.

---

## Task 2 — il salto-per-hash confronta anche il modello

**Il difetto era reale**, `backfill.ts:32`:
```ts
if (existing.get(it.id) === textHash(it.text)) { stats.skipped++; return false; }
```

Il modello fa parte dell'identità di un vettore quanto il testo: due embedding dello stesso testo
prodotti da modelli diversi **non vivono nello stesso spazio**. Confrontando il solo testo, al cambio
di modello ogni riga sarebbe stata saltata e il corpus sarebbe rimasto misto — somiglianze sbagliate,
**in silenzio**, senza un errore a segnalarlo.

**Correzione**: le tre `read*Hashes` restituiscono `Map<string, EmbeddingFingerprint>` con
`(hash, modelId)`; il salto richiede che coincidano **entrambi**. Il modello si legge da
`embedder.modelId`, già iniettato → **nessun parametro nuovo**, `backfillCorpus` resta provabile in
memoria senza rete né database. `runBackfill` invariata, indici HNSW non toccati.

Un `model_id` **nullo non conta come uguale**: si ri-embedda. Non poter dimostrare che è lo stesso
modello è una ragione per rifare, non per fidarsi.

### Le prove sono state viste fallire

Rimesso per prova il vecchio predicato, i casi nuovi diventano rossi:
```
× re-embeds when the text matches but the model differs
× re-embeds when the stored model is unknown (null): unproven is not equal
AssertionError: expected { embedded: +0, skipped: 1 } to deeply equal { embedded: 1, skipped: +0 }
```
Ripristinata la correzione: **6/6 verdi**. Casi aggiunti: tre (i due richiesti + il modello nullo).

### Precisazione sul mandato

Il mandato parlava di «tutte e quattro le tabelle». Le `read*Hashes` sono **tre**: la quarta
(`sys_user_profile_embeddings`) **non passa da `backfillCorpus`** — è derivata in SQL da
`deriveUserProfiles`, che **riscrive sempre tutto** e non ha alcun salto. Non ha il difetto, e non ha
nemmeno la protezione.

---

## Task 3 — `docs/kb/tools/check_embedding_coverage.py`

Sola lettura, idempotente, nessuna dipendenza nuova, esito binario. Convenzioni prese da `db_health.py`.

**Perché due denominatori.** Contare le righe grezze dà una percentuale **falsa**: il backfill scarta
le righe senza nome, sulle occupazioni lavora su URI distinti, e il profilo persona si deriva solo da
chi ha competenze con evidenza. Le definizioni sono copiate da `repository.ts` e vanno tenute
allineate a quelle.

---

## Task 4 — colmatura, eseguita su ok esplicito

**Numeri portati prima di agire**: 39 vettori mancanti, **1 sola richiesta Voyage** (batch 500).
Nessun ri-embedding di massa, perché `VOYAGE_MODEL` è la costante `"voyage-4-lite"` e **coincide** con
il `model_id` di ogni riga già scritta.

**PRIMA** — `job_roles` 137/176, **39 scoperte**, 77,8% · exit **1**

```
{"phase":"skills","embedded":0,"skipped":14039}
{"phase":"backfill","target":"job_roles","progress":"39/39"}
{"phase":"job_roles","embedded":39,"skipped":137}
{"phase":"occupations","embedded":0,"skipped":3045}
{"phase":"user_profiles","written":156}
{"phase":"done"}
```

**DOPO** — tutti e quattro i corpus **100%**, modello unico · exit **0**

| corpus | sorgente | eleggibili | con vettore | scoperte | % | modello | dal | al |
|---|---|---|---|---|---|---|---|---|
| skills | 14039 | 14039 | 14039 | 0 | 100,0% | voyage-4-lite | 2026-06-06 | 2026-06-06 |
| job_roles | 176 | 176 | 176 | 0 | 100,0% | voyage-4-lite | 2026-06-06 | **2026-08-06** |
| occupations | 7714 | 3045 | 3045 | 0 | 100,0% | voyage-4-lite | 2026-06-06 | 2026-06-14 |
| user_profiles | 163 | 156 | 156 | 0 | 100,0% | voyage-4-lite | 2026-06-06 | 2026-06-06 |

I 39 nuovi sono ruoli bancari reali (`Analista Crediti`, `Analista Bilancio e Segnalazioni`,
`Analista Monitoraggio Crediti`, …).

---

## Verifiche 1-6 — output esatto

```
 ?column? | count | count            ?column?  | count | count
----------+-------+-------          -----------+-------+-------
 skills   | 14039 | 14039            job_roles |   176 |   137

 ?column? | count | count             model_id    | count |    min     |    max
----------+-------+-------          --------------+-------+------------+------------
 users    |   163 |   156            voyage-4-lite| 14039 | 2026-06-06 | 2026-06-06
```
```
 Test Files  1 passed (1)      ← semantic-matching-backfill
      Tests  6 passed (6)
 Test Files  6 passed (6)      ← agent-gateway
      Tests  51 passed (51)
```

**Verifiche 1, 2, 4, 5, 6: combaciano con l'atteso.** Nessuna regressione sull'agent-gateway.

### Tre divergenze, segnalate e non riallineate

1. **Verifica 3** — i numeri combaciano (`163 | 156`) ma **l'interpretazione «7 scoperti» è
   sbagliata**: il profilo si deriva da chi ha almeno una competenza con evidenza, quindi quelle 7
   persone sono **fuori corpus**, non scoperte. Copertura reale: **100%**.
2. **Occupazioni** — il denominatore grezzo (7714) direbbe «60% scoperto»; gli URI distinti
   eleggibili sono **3045**, coperti al 100%.
3. **job_roles** — le date andavano da `2026-06-06` a `2026-07-26`: **due ondate**, non una.

---

## Fuori mandato ma affrontato su richiesta: il presidio del tunnel

**La porta 5433 è tenuta da `ssh.exe`** (PID 5944). Il presidio ADR-0021 esiste su tre livelli:
attività `HeuresysTunnel5433`, `tunnel-keepalive.ps1` in ciclo (verifica ogni 15 s, rilancia con
attesa progressiva), chiave dedicata ristretta alla sola porta del database.

**Funziona**, e il registro lo prova:
```
2026-08-05T23:30:52  ssh exited code=1 after 87.320s
2026-08-06T16:15:04  tunnel down -> opening
```

**Il difetto vero**: il keepalive rialza il tunnel, ma **nulla rialzava il keepalive** — trigger solo
`AtLogOn`, `Repetition` assente, `RestartCount` 0. Morto quello, il presidio restava giù **fino al
logon successivo**: la macchina resta accesa, e nessuno rifà l'accesso perché il database non risponde.

**Corretto** in `scripts/setup-tunnel-automation.ps1`: ripetizione **ogni 15 minuti** + **3 riavvii**
su fallimento. Niente trigger `AtStartup`: il principal è `LogonType Interactive` e non partirebbe
prima dell'accesso — sarebbe un presidio dichiarato e inerte.

**Provato eseguendo**: la ripetizione è scattata alle 23:27:11 (prossima 23:42:11) e le istanze del
keepalive sono rimaste **una** — la stessa delle 16:11:49, mai riavviata né duplicata.

---

## Due cose che avevo riportato e che erano sbagliate — mie

Stessa radice: concludere da un indizio invece di misurare.

1. **«tunnel avviato a mano, nessuno lo riavvia»** → **falso**. Avevo guardato il PID di `ssh.exe`
   senza cercare chi lo avesse avviato. Il presidio esiste ed è a tre livelli.
2. **«due istanze del keepalive»** → **non esistevano**. Il filtro cercava una stringa che compariva
   nella riga di comando del filtro stesso: il mio comando **si autocontava**. Le istanze reali sono
   sempre state una, e non ho terminato alcun processo.

---

## Cosa NON è stato fatto, e perché

- **`deriveUserProfiles` riscrive sempre tutti i 156 profili**: è l'unico corpus senza salto, quindi
  un backfill «no-op» no-op non è. Segnalato come chiesto, **non implementato**: fuori dal task 2.
- **Nessuna scrittura** in `SOT_STATE`, `SOT_BACKLOG`, `DEBT_REGISTER`, `STATE.md`.
- **Nessun push**: due commit locali.
- **Indici HNSW non toccati** · **nessuno strumento MCP aggiunto all'agent-gateway**.
- **Nessun valore di segreto riportato**: di `VOYAGE_API_KEY` si dichiara solo che è presente e
  valorizzata.
