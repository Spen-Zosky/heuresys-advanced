# ADR-0038 — Il database è autosufficiente: il brownfield è storia, non una fonte

**Status**: ACCEPTED
**Date**: 2026-08-14
**Supersedes**: ADR-0023 (brownfield ingestion — authoritative data source)
**Amends**: invariante **I12** del `CLAUDE.md`
**Decided by**: Enzo Spenuso

---

## Contesto

Per due anni il database legacy `heuresys-evo` (`heuresys_evo_platform_db` / db
`heuresys_platform`) è stato la **fonte** che ha popolato `sys.*`. ADR-0023 lo dichiarava
«authoritative data source», e l'invariante I12 lo ripeteva: il legacy è la sorgente canonica,
`sys.*` è l'autorità strutturale, e il legacy vi si adatta.

Quella fase è finita. Il database advanced non è più un contenitore che aspetta righe da
altrove: **contiene la storia dell'azienda, coerente e presidiata** — persone, posizioni, unità
organizzative, tre anni di presenze, buste, valutazioni, formazione e obiettivi, con un corredo
di viste-sentinella che ne guardano l'integrità a ogni sessione. Ciò che serve, oggi, si
costruisce o si deriva **da qui**.

> I **conteggi non stanno in questo documento**, per scelta. Sono dati che variano, e un numero
> cristallizzato in un ADR è falso il giorno dopo — è il difetto **D-01**, già pagato una volta.
> Si ri-derivano: `python docs/kb/tools/session_start.py`, oppure `docs/kb/SOT_STATE.md`, che è
> la loro unica sede e viene riscritta a ogni chiusura di sessione.

## Decisione

> **Nessun dato riferito al brownfield deve essere rimesso in circolo. Tutto va ricostruito con
> il DBMS attuale.** *(Enzo, 2026-08-14)*

In concreto:

1. **Il rubinetto è chiuso.** Nessun nuovo import, ingestione, estrazione o backfill che prenda
   righe dal database legacy. Nessun piano futuro può prevederne uno: un piano che lo prevede è
   un piano **da riscrivere**, non da eseguire.
2. **Il legacy resta consultabile come fonte di *concetti*, mai di righe.** Quali entità un
   dominio ha, come si legano, quali sono servite davvero all'uso: questa è conoscenza di
   dominio e si porta. Le righe no.
3. **`sys.*` è autosufficiente.** Ciò che manca si modella e si popola con i dati che il DBMS
   già contiene, oppure si costruisce ex-novo secondo il modello v5.
4. **Ciò che è già entrato resta.** I dati importati fino a oggi **sono** il database attuale:
   non si rimuovono e non si ri-derivano. La decisione guarda avanti, non indietro — altrimenti
   negherebbe l'azienda che il database rappresenta.
5. **ADR-0023 e la vecchia formulazione di I12 diventano cronaca.** Restano leggibili perché
   spiegano **la provenienza** dei dati odierni. Non sono più un mandato.

## Cosa NON cambia

- `sys.*` resta l'**autorità strutturale** (invariato).
- I dati si trattano come **produzione reale** — l'ingestione storica non ha mai avuto uno strato
  di anonimizzazione (`pii_disposition=NONE` su tutte le `column_mappings`), e la **OUTPUT RULE**
  del `CLAUDE.md` resta in vigore: un dato si descrive per ciò che **è**.
- `reference_sync` **non è toccato da questa decisione**: ISTAT, ATECO, ESCO, NACE sono
  **classificazioni esterne ufficiali**, non il brownfield. La loro sincronizzazione continua.
  Confonderli sarebbe l'errore più facile da fare leggendo questo ADR.
- Gli artefatti storici di ingestione (migrazioni e seed già in catena) **restano dove sono**: la
  catena si ri-applica per intero a ogni deploy (ADR-0034), e rimuoverli riscriverebbe la storia
  del database. Sono congelati, non cancellati — ADR-0035.

## Come si fa rispettare — il cancello, non il paragrafo

Una regola scritta solo in un documento viene aggirata per distrazione fra sei mesi. Perciò la
decisione porta con sé un controllo automatico e falsificabile:

```bash
python docs/kb/tools/check_no_legacy_ingest.py    # exit 1 se compare un artefatto nuovo
python docs/kb/tools/check_no_legacy_ingest.py --selftest
```

Lo strumento conosce l'elenco **congelato** dei 30 artefatti storici che nominano il database
legacy (`docs/kb/tools/legacy_ingest_allowlist.txt`). Se un file **nuovo** lo nomina, esce 1 e
dice quale. L'elenco si allarga solo con una modifica esplicita e motivata — cioè con una
decisione, non per inerzia.

## Conseguenze già misurate (2026-08-14)

- **#69** («chiusura brownfield lato DBMS legacy») **si sblocca**: era GATED perché Wave-3
  avrebbe riusato il legacy come sorgente. Nessuno lo riuserà più. ⚠ Lo spegnimento del
  container e la rotazione della credenziale restano **da autorizzare**: altri servizi sulla VM
  condividono quello stack.
- **#17** (Wave-3 L2/L3) **cambia oggetto**: era l'onboarding di due tenant legacy — cioè un
  import. La domanda «la piattaforma regge un tenant non-banking?» si risponde **creandone uno**
  col Tenant Builder (#131), non riesumando SmartFood.
- **#54** (recruiting): la domanda «quale delle due famiglie ATS legacy importare» **decade**. Le
  19 tabelle legacy restano utili per sapere **cosa modellare**, non da dove prendere le righe.
- **#50** (grafo delle competenze): già riorientato lo stesso giorno, e per la stessa ragione
  trovata per un'altra strada — l'inventario brownfield classificava `kg_nodes`/`kg_edges`
  `EXCLUDE` perché **derivati e ricomputabili**. Il grafo in advanced **esiste già**, in
  `sys_skill_taxonomy_edges` (il conteggio si misura, non si cita qui).

## Alternative scartate

- **Tenere I12 e aggiungere un'eccezione**: avrebbe lasciato in vigore una regola che dice il
  contrario di ciò che si fa, e la prossima sessione avrebbe seguito quella scritta.
- **Rimuovere gli artefatti storici di ingestione**: li ri-applica la catena a ogni deploy, e
  cancellarli negherebbe la provenienza dei dati odierni. Congelati e sorvegliati, non rimossi.
- **Fidarsi del solo documento**: è il modo in cui la regola torna indietro senza che nessuno lo
  decida. Da qui il cancello.
