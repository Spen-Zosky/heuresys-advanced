# ADR-0034 — La catena di migrazioni è uno strato di schema e controlli sopra una base di dati, non un ricostruttore

**Status**: Accepted (S1049, 2026-08-07)
**Contesto**: `#166` — «l'ambiente non è ricostruibile dalle sole migrazioni»
**Autorità della decisione**: Claude (decisione tecnica, `feedback_claude_decides_technical`)

## Il fatto, misurato

Costruendo la prova generale della CI (`#165`) è emerso che
`db/scripts/ci-rehearsal.sh --from-zero` — database vergine, estensioni pre-create, catena
applicata dall'inizio — **si ferma alla `000049`**. La domanda che ne è nata era se fosse un
caso isolato o il primo di molti.

Misurato il 2026-08-07 con `db/scripts/ci-rehearsal-census.sh`, che applica i file **uno per
uno** e prosegue oltre gli errori invece di fermarsi:

```
applicate: 217      cadute: 73      totale: 290
```

Le 73 cadute non sono 73 difetti. Lette nei messaggi, si dividono in **due sole categorie**:

| categoria | quante | esempio del messaggio |
|---|---|---|
| **Post-condizioni che pretendono DATI** che la catena non crea | ~72 | `expected >=60 CRS-* re-homed modules, found 0` · `R2: expected >=4 active grants, got 0` · `attese almeno 10 unita (le «Direzione»), trovate 0` · `le voci ATECO 70.20 e 64.19 non sono nella tassonomia` · 21 cadute nominano `UNCLASSIFIED`, cioè il registro di riconciliazione che su un database vuoto non arriva mai a zero |
| **Difetto vero della catena** | 1 | `000048` → `la relazione "_b51_derivation" non esiste`: dipende da una tabella temporanea creata da un altro file, quindi non regge da sola |

## La decisione

**La catena `db/migrations/*.sql` è dichiarata uno strato di SCHEMA e CONTROLLI applicato sopra
una base di dati preesistente. Non è, e non diventerà, un ricostruttore dell'ambiente da zero.**

La ragione non è pigrizia: è che **166 file su 290 portano una post-condizione che verifica un
invariante**, ed è la proprietà più preziosa della catena — è ciò che fa fallire un deploy quando
un dato è incoerente, e in `#167` è ciò che ha fatto emergere quattro difetti reali su dati di
produzione. Quelle verifiche *devono* poter parlare dei dati. Renderle vere anche su un database
vuoto significherebbe una delle due:

- **seminare i dati dentro le migrazioni** — cioè mescolare struttura e contenuto, che è
  esattamente ciò che l'architettura tiene separato (`db/seeds/`, ingestione brownfield);
- **rendere condizionale ogni post-condizione** («se ci sono righe, allora…») — cioè spegnere il
  61% del valore della catena per ottenere una proprietà che nessuno usa.

## Cosa garantisce la ricostruibilità al posto suo

La domanda «se il database si perde, come si ritorna su?» ha già una risposta, ed è **il
ripristino**, non il replay:

1. **Backup notturni** su PROD (`heuresys-advanced-backup.timer`), tirati anche sul linux-pc;
2. **istantanea pre-deploy** (`pg_dump -Fc`) presa da `vm-deploy.sh` **prima** della prima
   mutazione, con ritenzione delle ultime 10;
3. **clone bare-metal** sul gemello PROD (`scripts/clone-vm-db.sh`), che è un ambiente completo
   ricreato dalla copia;
4. **prova di ripristino periodica** (`heuresys-advanced-dr-drill.timer`), che è la verifica che
   il punto 1 funzioni davvero.

Chi crea un ambiente nuovo parte da una **copia** (`setup-ci-database.sh` per la CI,
`clone-vm-db.sh` per il gemello) e poi applica la catena per portarla a HEAD. È il percorso che
tutti gli ambienti usano già oggi — questo ADR lo dichiara invece di lasciarlo implicito.

## Conseguenze

- `ci-rehearsal.sh --from-zero` resta come **strumento di misura**, non come cancello: risponde
  alla domanda «quanto dipende dai dati», che è informativa, non «la catena è rotta».
- Il modo predefinito della prova generale (copia di `heuresys_ci` + doppia passata) resta
  l'unico cancello, ed è quello fedele alla CI.
- **Il difetto vero resta da correggere**: `000048` dipende da una tabella temporanea creata
  altrove. Un file di migrazione deve essere applicabile per conto suo, e questo non lo è. È
  registrato in `#166` come residuo puntuale, separato da questa decisione.
- Se un domani servisse davvero un ambiente ricostruito dal nulla — per esempio per un tenant
  nuovo senza base dati — la strada è il **Tenant Builder** (`#131`), che nasce per creare
  un'azienda da una configurazione, non la riesumazione della catena.

## Quando rivedere

Se la separazione fra struttura e contenuto cambiasse — per esempio se i seed diventassero parte
della catena, o se le post-condizioni migrassero in una batteria esterna eseguita dopo i seed —
questa decisione va rivista: in quel mondo il replay da zero tornerebbe possibile e utile.
