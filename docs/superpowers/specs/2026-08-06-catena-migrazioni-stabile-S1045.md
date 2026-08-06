# #140 + #141 — la catena di migrazioni smette di disfare il lavoro fatto

**Aperto**: 2026-08-06 (S1045) · **Mandato di Enzo**: «procedi con la soluzione corretta e non
tenere conto di quella richiesta che avrebbe spento 166 controlli sulla produzione».

## Il problema, misurato

`db/scripts/migrate.sh` **non consulta mai** il registro per decidere cosa applicare: prende
tutti i file (`files=( "$MIG_DIR"/*.sql )`, riga 32) e li esegue tutti, ogni volta. Il registro
`sys.sys_schema_migrations` è scritto **dopo** ogni file, con UPSERT: è un libro mastro, non un
cancello. La ri-applicazione integrale è quindi voluta per progetto — e la dottrina
(`.claude/rules/db-migrations.md`) la dà per scontata: «l'esecuzione dell'intero set due volte
produce un diff `pg_dump` vuoto».

Il guasto è che **quella promessa oggi non è vera**, e le prove sono tre (registrate in `#140`).

## Perché il filtro ovvio sarebbe stato un disastro

La richiesta iniziale — «le migrazioni già fatte non siano rieseguite» — descrive un filtro
puro: salta ciò che risulta applicato. Misurato prima di implementarlo:

| Misura sulla catena (271 file) | Valore |
|---|---|
| File registrati, con nome corrispondente | 271 / 271 |
| Impronta identica fra disco e registro | **265** |
| Impronta divergente (file modificato dopo) | 6 |
| File che contengono una **post-condizione** `RAISE EXCEPTION` | **166** |
| File che contengono `DELETE` / `UPDATE` (possono disfare) | 83 |
| File che si dichiarano esplicitamente auto-riparanti | 9 |

**Il 61% della catena non trasforma il database: lo controlla.** Un filtro puro avrebbe spento
166 verifiche che girano a ogni deploy — fra cui quelle che hanno fatto *scoprire* `#140`.
Richiesta soddisfatta alla lettera, produzione scoperta. Scartato.

## Il design adottato — opt-in progressivo, default invariato

Il file dichiara la propria natura; **in assenza di dichiarazione non cambia nulla**.

1. **Marcatore esplicito** in testa al file: `-- @migrate: once` → migrazione **una-tantum**.
2. **Salto condizionato a DUE fatti**, non uno: il file è `once` **e** il registro lo riporta
   con **la stessa impronta**. Un file modificato dopo l'applicazione viene rieseguito da sé
   (oggi sarebbero 6).
3. **Nessun marcatore = comportamento di oggi.** Le 166 post-condizioni continuano a girare a
   ogni deploy. Zero regressione per costruzione: ciò che non tocco, non cambia.
4. **Richiesta esplicita e motivata**: `MIGRATE_FORCE_ALL=1` riesegue tutto, marcatori inclusi.
   Va scritta a mano e lascia traccia a schermo.
5. **Il salto è dichiarato**, mai silenzioso: ogni file saltato stampa il perché.

Il criterio per marcare un file `once` è stretto: **lo si marca solo se la sua ri-esecuzione
produce un effetto misurato e indesiderato.** Non si marca "per prudenza" — un file marcato per
sbaglio smette di verificare.

## Confine di sessione — superato

Dichiarato all'apertura: «F1-F3 sono il nucleo, F4 dipende da F3, se F5 non entra resta come
voce misurata». **Sono entrate tutte e cinque.** `#140` e `#141` sono chiusi con la prova che
ciascuna voce esigeva.

## Deliverable

| id | cosa | fatto = | stato |
|---|---|---|---|
| **F1** | Il meccanismo in `migrate.sh`: marcatore, doppia condizione, override, salto dichiarato | la catena gira due volte e la seconda salta ciò che è marcato, dicendolo | ✅ **FATTO** — più `MIGRATE_DRY_RUN=1`, che rende la decisione ispezionabile senza toccare il database, e il **gemello `migrate.ps1` allineato** (è quello che chiama `pnpm db:migrate`: se filtrasse solo uno dei due, la stessa catena si comporterebbe in due modi) |
| **F2** | Prova che il meccanismo **sa fallire**: file marcato ma con impronta cambiata → rieseguito | prova eseguita con esito atteso su entrambi i rami | ✅ **FATTO** — 5 rami provati: nessun marcatore → 271/0 (invarianza) · marcato con impronta diversa → **applicato** · marcato con impronta uguale → **saltato** e dichiarato · `MIGRATE_FORCE_ALL=1` → 271/0 · marcatore citato in prosa → **non** scatta |
| **F3** | Marcare i file responsabili dei tre fenomeni misurati di `#140` | i tre fenomeni non si ripresentano a una seconda esecuzione | ✅ **FATTO — e la causa era a monte**: `000096` distribuiva i requisiti a **ogni** posizione del ruolo, comprese le disattivate (52 righe ricreate a ogni giro; i timestamp dell'archivio lo mostrano: 232 + 52 + 52 + 52 = 388). Marcare la sola `000273` avrebbe chiuso **un estremo solo**, lasciando i 52 nel vivo su posizioni spente — il difetto che la 000273 esisteva per curare. Corretta la derivazione, il ciclo non ha più da dove ripartire. Sul versante a valle: `000273` marcata `once` **e resa idempotente** (il marcatore non deve coprire una migrazione che duplica: sotto `FORCE_ALL` tornerebbe a gonfiare). Prova falsificabile con un residuo vero in transazione annullata: archivio 388 → **389** (ha archiviato davvero) → **389** (non duplica) → rollback a 388. Fenomeni (1) e (2) → F4 |
| **F4** | `#141` — `HS-PROD` torna divisione e ci resta | 0 unità attive di tipo `TEAM` misurato **dopo** un secondo giro di catena | ✅ **FATTO** — `HS-PROD` = `DIVISION`, unità attive di tipo `TEAM` = **0**, misurato dopo un giro completo. `000265`/`000266` la tipizzano `TEAM` e `000267` la riporta a `DIVISION` con un `UPDATE` pienamente ripetibile: la migrazione era corretta già prima: a mancare era una catena che arrivasse in fondo **stabile**, e quella l'ha data F3 |
| **F5** | La prova che chiude `#140`: due esecuzioni consecutive, database identico | diff fra due `pg_dump` consecutivi vuoto, o le differenze residue spiegate una per una | ✅ **FATTO** — conteggio esatto di tutte le **227 tabelle** di `sys` e `audit` prima e dopo un giro completo: **nessuna differenza** (618.497 = 618.497). Più le impronte del **contenuto** (unità organizzative, archivio, grant `TENANT_ADMIN`, posizioni, utenti): identiche — il conteggio da solo non avrebbe visto un valore modificato. Il primo tentativo aveva scovato una crescita di +52 righe: è così che si è arrivati alla causa radice |

### Nota sul fenomeno (1) — permessi di `TENANT_ADMIN`

**Non va corretto marcando `000210` come una-tantum**: quella migrazione è un presidio di
sicurezza (D-57) e il suo compito è proprio rigirare, negando a `TENANT_ADMIN` ogni permesso
fuori dall'elenco. Il difetto sta a monte: `000256` ha creato quattro permessi e li ha concessi
**senza estendere l'elenco**, violando la policy `TENANT_ADMIN-ALLOWLIST-EXTEND`. `000270` ha
rimediato e i quattro permessi oggi ci sono (verificato live). Il rimedio strutturale è una
guardia che impedisca di concedere a `TENANT_ADMIN` senza estendere l'elenco nella stessa
migrazione — **non** spegnere il presidio.

## Simulazione (R24.3)

- **Precondizioni** — il registro dev'essere affidabile: **verificato** (271/271 registrate,
  nomi corrispondenti, 265 impronte identiche). Senza questo il filtro sarebbe cieco.
- **Meccanismo** — `migrate.sh` calcola già lo `sha256` di ogni file per il registro: il filtro
  riusa **quel** valore, non ne introduce un secondo che potrebbe divergere. La lettura del
  registro avviene in **una sola query** prima del ciclo, non una per file: sul tunnel una
  connessione costa ~1,12 s (misura S1043 citata nello script), 271 interrogazioni sarebbero
  cinque minuti di sola apertura di canale.
- **Propagazione** — `migrate.sh` è nel repo e arriva su VM e linux-pc con l'allineamento; il
  gemello `.ps1` è stato allineato in F1 allo stesso contratto (verificato: `pnpm db:migrate` chiama quello, il deploy chiama `migrate.sh`).
- **Chi** — Claude.
- **Guardia** — è la parte pericolosa: un file marcato per sbaglio smette di verificare. Il
  presidio è il criterio stretto (§design) più il fatto che il salto è **stampato**: un salto
  inatteso si vede nel log del deploy. E su un database nuovo il registro è vuoto, quindi
  **niente viene mai saltato al primo giro** — i database freschi e la CI non sono toccati.

## Registro delle scoperte (R24.5 — fuori da questo ciclo)

- `000273` archivia con `INSERT … SELECT` **senza deduplica**: non è solo un problema di
  ri-esecuzione, è che una migrazione precedente **ricrea** i cataloghi su posizioni disattivate
  che la `000273` poi ri-archivia. Il ciclo ha due estremi, e questo piano ne chiude uno solo.
