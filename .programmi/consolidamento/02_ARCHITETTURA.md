# Consolidamento — architettura di destinazione, contratto, decisioni

Fase B, 2026-10-23. Questo documento **non sostituisce** ADR-0043 (accettato) né ADR-0046 (proposto): ne è il completamento. Dove li corregge lo dice, e la correzione diventa un ADR nuovo (ADR-0047, ADR-0048), come vuole la regola degli invarianti. I rilievi citati (R-nn) sono in `01_RILIEVI.md`.

## 1. La tesi in breve

La separazione è già decisa e già per metà costruita: il datastore genera il fascicolo (cascata a 31 passi, pacchetto v0.3, ventaglio del perimetro, estensione), advanced lo carica nelle tabelle di modello (`sys_blueprint_content_*`, migrazione 000458) e costruisce il tenant. Il percorso **Datastore → Platform → Tenant** però non è ancora affidabile in tre punti, e sono questi tre che il consolidamento chiude prima di ogni altra cosa:

1. **La consegna non esiste** (R-01, R-02, R-12): né il canale, né l'identità del pacchetto che viaggia, né la correlazione.
2. **Il ricevimento è una prova di laboratorio** (R-03, R-04, R-05, R-06, R-08): il caricatore gira solo su copie, non aggiorna, scrive catalogo di piattaforma; la pubblicazione è un gesto a mano; il profilo legge versioni superate; tre strade di materializzazione.
3. **Il confine ha una falla nel verso opposto** (R-20): il datastore legge il database di advanced, dati personali compresi.

Il resto (perimetro, parità, ritiro, webapp) segue l'ordine già fissato da ADR-0043: niente si commuta prima che il datastore abbia tutto, niente si ritira prima che nessuno lo legga.

## 2. Modello di responsabilità

| oggetto | possiede il significato | modifica | distribuisce | usa |
|---|---|---|---|---|
| cataloghi di dominio (ESCO, ISCO, CP2021, ATECO, NACE, APQC, CCNL, indicatori di catalogo, ruoli di catalogo, moduli formativi di catalogo) | datastore | Amministratore di Sistema, caricatori del datastore | datastore, solo dentro un fascicolo (perimetro) | advanced, solo il perimetro |
| famiglie di settore, prototipi, corse, pacchetti | datastore | cascata e banco | datastore (consegna) | advanced (registra) |
| versione di modello ricevuta (`sys_blueprint_variant_versions` + `sys_blueprint_content_*`) | datastore (contenuto) | **nessuno** dopo il caricamento, come destinazione: oggi non è vero, perché 000398/000400/000401 vi scrivono a ogni deploy (R-51), e C3a lo corregge | — | advanced: profilo, perimetro, costruzione |
| registro e attivazione per tenant, con la **versione fissata sull'attivazione** | advanced | TENANT_ADMIN / PLATFORM_ADMIN (attiva, passa a una versione nuova dopo l'anteprima) | — | advanced |
| stato «pubblicato» di una versione (= disponibile per l'adozione) | datastore secondo ADR-0043 voce 14 e D-72; dove lo si registri in advanced lo decide Enzo in ADR-0047 (R-53) | — | datastore | advanced |
| righe del tenant (unità, posizioni, competenze proprie, indicatori, persone, contratti) | tenant | ruoli del tenant secondo ADR-0036 | — | tenant; **mai** il datastore in forma nominativa |
| cataloghi del prodotto advanced (permessi, ruoli di accesso, interfacce, classi di dato) | advanced | migrazioni di advanced | — | advanced |
| operatori del datastore | datastore | — (oggi un'identità sola, protezione di rete) | — | datastore |
| utenti dei tenant | advanced (`sys_users`, `sys_auth_*`) | advanced | — | advanced |

Verificato: il datastore non ha tabelle di utenti e non gestisce utenti dei tenant (`D_schede_riconciliazione.md` S15). Non verificato: che non ne conservi copie, perché le copie dei database di advanced sul suo motore lo smentiscono (R-20).

## 3. Il contratto del fascicolo (destinazione)

Si chiama **contratto del fascicolo** per non confonderlo con il contratto di pubblicazione dei cataloghi (documento 17 del datastore, R-43). È lo schema del pacchetto più le regole di consegna qui sotto. Le sue parti, requisito per requisito del mandato:

| # | requisito | oggi | destinazione | incremento |
|---|---|---|---|---|
| 1 | struttura, versione, provenienza, integrità | schema v0.3 approvato, impronte dei file del contratto verificate da advanced; il pacchetto porta `perimetro.fascicoloVersione` ma non la propria impronta; nessun manifesto delle edizioni | **v0.3.1**: `meta.pacchetto = { versione, impronta, edizioni: [{schema, edizione}], correlazione }`. Non è leggibile da un convalidatore v0.3 (`additionalProperties: false` su `meta`): advanced accetta le due versioni, ciascuna col suo schema. **Una sola numerazione**: la versione è `bench_package_version_no` e `perimetro.fascicoloVersione` deve coincidere. **Una sola impronta**: SHA-256 della forma canonica senza `meta.pacchetto`, definita una volta nel datastore con un caso di prova condiviso che advanced ricalcola identico. La v0.4 (cruscotti, porte, famiglia, stato, peso economico: D-72) resta un passo separato | C1 |
| 2 | identità template / istanza | template = `prototipoId` + versione del pacchetto nel datastore; in advanced famiglia → variante (= `prototipoId`) → versione; istanza = righe del tenant legate per codice | chiave stabile **(prototipoId, versione del pacchetto)** scritta in `sys_blueprint_content_packages` con unicità; nessun uuid attraversa i database; il legame tenant→modello resta per codice | C3 |
| 3 | ciclo di vita | prepara, valida, deposita nel datastore; carica solo su copia; PUBLISHED scritto da trigger e migrazioni; tre strade per costruire | **prepara** (cascata) → **valida** (schema + regole) → **consegna** (verbo nuovo del datastore: file + manifesto, che dichiara anche lo stato «pubblicabile» come vuole D-72) → **riceve** (caricatore: verifica manifesto, idempotente) → **registra lo stato** (dove e da chi: ADR-0047, decisione di Enzo) → **adotta** (l'attivazione del tenant fissa la versione; il passaggio a una versione nuova è un gesto per tenant, dopo l'anteprima) → **costruisce** (una sola strada, con registro dell'origine) → **ritira** (RETIRED = non più adottabile; chi la usa la tiene finché non passa a un'altra; mai cancellata) | C2–C5 |
| 4 | idempotenza, ripresa, concorrenza | datastore idempotente per impronta; caricatore no | caricatore idempotente per impronta (secondo caricamento = «già presente», esito 0); una transazione per pacchetto; blocco consultivo per variante; ripresa = rilancio | C3 |
| 5 | personalizzazioni | campi bloccanti; `ON CONFLICT DO NOTHING`; nessuna politica per campo | politica per famiglia di dato (ADR-0048): **ereditato** finché il tenant non lo tocca, **conservato** quando il tenant l'ha modificato, **segnalato** (mai sovrascritto) quando il modello cambia una voce modificata; una voce tolta dal modello non si cancella nel tenant, si marca «fuori modello»; il confronto `diff.ts` calcola l'impatto | C6 |
| 6 | compatibilità e recupero | v0.2/v0.3 additive, doppia lettura; anteprima nel datastore e in advanced | ogni versione del contratto ha la sua cartella con impronte e il caricatore le accetta tutte quelle dichiarate; anteprima delle differenze prima che un tenant adotti una versione; recupero = riportare l'attivazione del tenant alla versione precedente (per tenant, non per tutti), mai cancellare | C3, C4 |
| 7 | sicurezza, audit, correlazione | il datastore non autentica; il caricatore richiede le credenziali del database; nessuna correlazione | la consegna è un file con manifesto che porta l'impronta (nessuna rete fra i due servizi). **Limite dichiarato**: un'impronta nello stesso file non prova l'origine, non è una firma; con i due progetti sulla stessa VM e lo stesso utente è accettabile, una firma vera arriva con la porta dell'onda 4; il caricamento registra in una tabella d'esito di advanced chi, quando, quale impronta, quale correlazione; la correlazione nasce nel datastore (`datastore_call`) e viaggia nel manifesto | C2, C3 |
| 8 | invarianti post-importazione | rilettura per percorso (257/257), conteggi per tabella, sentinelle | le stesse prove, più: ogni voce del perimetro esiste nel catalogo che la deve accogliere oppure è dichiarata mancante nel rapporto di caricamento; nessuna riga di catalogo senza tenant scritta dal caricatore | C3 |

### Il canale: perché un file, e dove

Opzioni valutate:

- **File con manifesto** (scelta). Il datastore scrive `pacchetto.json` e `manifesto.json` (impronta, versione, correlazione, edizioni) nella cartella `_pubblicazioni/consegne/<prototipo>/<versione>/` del proprio deposito (la cartella `_pubblicazioni/` esiste già ed è fuori da Git); advanced la legge dal percorso. Pro: nessuna rete e nessuna credenziale condivisa, ispezionabile, ripetibile, funziona anche quando uno dei due servizi è spento, i due progetti oggi vivono sulla stessa VM. Contro: serve una regola di conservazione della cartella e l'impronta come unica garanzia (sufficiente: il manifesto la porta e il caricatore la ricalcola).
- **Pull HTTP da advanced verso il datastore al momento del caricamento** (scartata per ora). Il datastore non ha autenticazione applicativa (identità costante, protezione di rete): aprire una rotta a un altro servizio vuol dire costruirla prima. Diventa la strada naturale quando arriverà la «porta a consumo» dell'onda 4.
- **Collegamento fra i database** (scartata): ADR-0043 la esclude, e il principio del mandato vieta scritture remote e sincronizzazioni continue.

### Il flusso inverso (R-20)

Oggi il datastore legge il database di advanced per confrontare un prototipo con il tenant reale RTL Bank. Il bisogno è legittimo (misurare i vuoti fra modello e realtà, ADR-0043 regola 3: «fuori perimetro si chiede alla piattaforma»), il mezzo no. Destinazione:

- advanced produce una **proiezione minima del tenant** con uno script di piattaforma (non una rotta nuova, ADR-0043 regola 6): un elenco chiuso di colonne ammesse (allow-list: unità, tipi, posizioni senza peso economico, processi, codici di catalogo usati), nessun nome, contratto, retribuzione, persona, nessun conteggio sotto soglia; la guardia è la allow-list più la classificazione `sys_classificazione_direzione_dato`, così una colonna nuova non classificata non passa;
- il datastore legge solo quella proiezione; le letture dirette (`servizio_rtl.ts`, `rtl_lettura.ts`, `config.ts` `PRODUZIONE_SOLA_LETTURA`, `scripts/piano034/*`) si ritirano;
- le copie intere dei database di advanced sul motore del datastore del PC (`heuresys_advanced_20260819`, `_20261010`) e il dump in `_dump/` si **distruggono**, non si archiviano, perché contengono credenziali e IBAN: gesto di Enzo con verbale, preceduto dalla verifica di dove siano finite altre copie (backup notturno del PC, Drive) e, se sono uscite dalla VM, dalla rotazione delle credenziali. Il trasloco D-85 del 23/10 **non** le ha portate sulla VM (risposta del thread «Prossimi passi datastore», 02:33 UTC);
- subito, a costo zero e reversibile: non usare più `DATASTORE_RTL_FONTE=produzione` (oggi i servizi del datastore sul PC sono spenti).

## 4. Decisioni architetturali

| id | decisione | stato | chi decide |
|---|---|---|---|
| ADR-0046 | Perimetro del tenant | PROPOSTO; approvabile **solo** sostituendo la regola del §1 con: «il perimetro di un tenant è quello della versione fissata dalle sue attivazioni ACTIVE nella finestra di validità; dove l'attivazione non fissa una versione vale, in via transitoria, la regola di oggi» (R-06, R-52). La revisione indipendente ha scartato la prima correzione proposta («una sola PUBLISHED in vigore»), che avrebbe cambiato insieme il perimetro di tutti i tenant | Enzo |
| ADR-0047 (nuovo) | Il contratto del fascicolo: consegna per file con manifesto, identità `(prototipoId, versione)`, impronta unica, versione fissata sull'attivazione, flusso inverso solo come proiezione con allow-list; domanda esplicita a Enzo su **chi registra lo stato pubblicato** (ADR-0043 voce 14 e D-72 lo danno al datastore, R-53); emenda ADR-0043 voce 3 (`sys_industry_codes` si trasforma, non si ritira) e voce 17 (esito della misura pagina per pagina) | bozza PROPOSTA in Fase C, passo C1 | Enzo |
| ADR-0048 (nuovo) | Le personalizzazioni del tenant all'arrivo di una versione nuova: ereditato / conservato / segnalato / fuori modello; il passaggio a una versione è un gesto per tenant dopo l'anteprima | bozza PROPOSTA, passo C6 | Enzo |
| #270 | Passo 3 della partecipazione | aperta, fuori da questo programma (onda 2, O2-09/O2-10): resta dove sta | Enzo |
| `leads/` | Dove vive la gestione delle richieste commerciali | scelta di prodotto: **raccomandazione** tenerla in advanced come funzione del tenant «Heuresys System» finché non esiste un CRM; non è catalogo | Enzo |
| D-85 | Passaggio del database di lavoro del datastore sulla VM | in corso in un altro thread; questo programma ne dipende per la consegna sulla VM | Enzo / altro thread |

## 5. Alternative scartate a livello di programma

- **Ripartire con un nuovo programma di consolidamento** accanto al piano di adesione: due fonti concorrenti; scartata. Questo programma vive in `.programmi/consolidamento/` e ogni suo incremento è una voce che rimanda al piano di adesione dove ne esiste già una (O2-0x, S3-S6).
- **Fondere i due database**: contraddice ADR-0043 e il mandato.
- **Commutare RTL Bank sul perimetro subito**: senza parità S3 perderebbe ciò che usa (R-21); resta S5, dopo.
- **Ritirare subito i cataloghi duplicati in advanced**: irreversibile su produzione, ADR-0043 lo mette per ultimo; resta S6 con archivio e prova di ripristino.
