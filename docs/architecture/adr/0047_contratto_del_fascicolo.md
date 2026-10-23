# ADR-0047 — Il contratto del fascicolo: consegna per file, identità della versione, versione fissata sull'attivazione

- **Status**: ACCETTATO il 2026-10-23 da Enzo Spenuso (approvazione data in chat alle 15:19 UTC, 17:19 ora di Roma, con le raccomandazioni del riepilogo del mattino)
- **Date**: 2026-10-23
- **Decided by**: Enzo Spenuso, 2026-10-23
- **Redatto da**: Claude Code, programma di consolidamento advanced ↔ datastore (`.programmi/consolidamento/`), Fase C
- **Completa**: ADR-0043 (accettato), ADR-0046 (proposto)
- **Emenda**: niente su chi produce lo stato «pubblicato»: la domanda 1 è stata decisa nella forma A, che lascia ADR-0043 voce 14 e D-72 come sono
- **Poggia su**: `.programmi/consolidamento/02_ARCHITETTURA.md` §3, `01_RILIEVI.md` (R-01, R-02, R-12, R-20, R-50, R-51, R-52, R-53, R-54), `lavoro/G_revisione_indipendente.md` (M-03, M-04); datastore `src/contratto/impronta.ts`, `src/contratto/consegna/`, `src/fascicoli/consegna.ts`; advanced `db/scripts/pacchetto/manifesto-consegna.mjs`

> **In parole semplici.**
> 1. Il datastore consegna un fascicolo scrivendo due file in una cartella: il pacchetto e un manifesto che dice quale versione è, con quale impronta, con quali edizioni dei cataloghi, chi l'ha consegnato e quando.
> 2. Advanced lo riceve leggendo quella cartella e ricalcolando l'impronta. Nessun collegamento fra i due database, in nessuno dei due versi.
> 3. Una versione si riconosce da due cose: il codice del prototipo e il numero del pacchetto nel datastore.
> 4. Il tenant non segue da solo l'ultima versione pubblicata: la sua attivazione dice quale versione usa, e il passaggio a una nuova è un gesto per quel tenant, dopo aver visto le differenze.
> 5. Chi dichiara che una versione è «pubblicata» resta il datastore, come dicono ADR-0043 e D-72.

---

## Contesto

ADR-0043 ha separato i ruoli: il datastore tiene i cataloghi e genera il fascicolo, advanced tiene il fascicolo del tenant. Il percorso fra i due non era definito. Il caricatore di advanced (`db/scripts/pacchetto/accogli-pacchetto.mjs`) lavora solo su database di prova, il pacchetto non porta la propria identità d'istanza, e due impronte diverse dello stesso pacchetto convivevano nel datastore (R-01, R-02, R-12).

La revisione indipendente della Fase B ha trovato due difetti di disegno che questo ADR risolve (M-03) o porta a te (M-04):

- l'attivazione di un tenant punta alla variante e non alla versione (`db/migrations/000008:75`, `apps/api/src/lib/scope/profilo.ts:87-101`): pubblicare una versione nuova cambierebbe nello stesso istante il profilo, e domani il perimetro, di tutti i tenant su quella variante (R-52);
- ADR-0043 (tabella, voce 14) e D-72 assegnano lo stato «pubblicato» al datastore, mentre parte del piano lo metteva in advanced (R-53).

## Decisione proposta

1. **Canale**: file con manifesto. Il verbo `POST /v1/fascicoli/:prototipo/consegna` del datastore scrive `pacchetto.json` e `manifesto.json` in `_pubblicazioni/consegne/<prototipo>/<versione>/`. Una consegna non si cancella e non si sovrascrive; una seconda richiesta della stessa versione con la stessa impronta non riscrive niente; un'impronta diversa nella stessa cartella è un conflitto.
2. **Manifesto** `heuresys.fascicolo.consegna/1` (schema in `src/contratto/consegna/manifesto.schema.json`, copia in advanced con impronta verificata): prototipo, versione, contratto, impronta, `fascicoloVersione`, edizioni dei cataloghi, correlazione, istante, autore. Il contratto del pacchetto (v0.2, v0.3) non cambia.
3. **Identità**: `(prototipoId, versione del pacchetto nel datastore)`. Nessun uuid attraversa i database. Advanced la registra con unicità al ricevimento (migrazione prenotata `000460`, incremento C3).
4. **Impronta**: una sola, `sha256-json-canonico` del pacchetto intero, definita in `src/contratto/impronta.ts` e ricalcolata da advanced con lo stesso caso di prova condiviso. Limite dichiarato: l'impronta prova che il file non è cambiato dopo la consegna, non chi l'ha scritto; non è una firma. Con i due progetti sulla stessa VM e lo stesso utente basta; una firma vera arriva con la porta dell'onda 4.
5. **Versione fissata sull'attivazione** (M-03): colonna additiva `blueprint_activation_variant_version_id` sull'attivazione (migrazione prenotata `000459`, incremento C4), riempita per le attivazioni esistenti con la versione PUBLISHED più alta della variante. Profilo e perimetro si risolvono su quella versione; dove è nulla vale, in via transitoria, la regola di oggi. PUBLISHED vuol dire «disponibile per l'adozione» e più versioni PUBLISHED possono coesistere; RETIRED vuol dire «non più adottabile», non «non più in vigore» per chi la usa. Il recupero è riportare l'attivazione di quel tenant alla versione precedente; non si cancella niente.
6. **Flusso inverso**: il datastore non legge il database di advanced. Ciò che gli serve del tenant arriva da una proiezione con un elenco chiuso di colonne ammesse, prodotta da uno script di piattaforma di advanced; le letture dirette di oggi si ritirano (R-20).
7. **Correzione di ADR-0043**: voce 3, `sys_industry_codes` si trasforma e non si ritira; voce 17, l'esito della misura pagina per pagina è in `.programmi/consolidamento/lavoro/F_webapp.md`.

## Domande, decise il 2026-10-23

1. **Chi registra lo stato «pubblicato» di una versione** (M-04, R-53).
   - **A — il datastore, come oggi deciso** (ADR-0043 voce 14, D-72): il manifesto porta lo stato «pubblicabile», advanced lo registra così com'è e non ha un gesto «pubblica». Non emenda niente.
   - **B — advanced**: il datastore consegna, una persona con mandato di piattaforma in advanced pubblica dopo l'anteprima. Emenda ADR-0043 voce 14 e D-72.
   - Raccomandazione: **A**, perché non emenda decisioni già prese e il gesto per tenant del punto 5 dà già il controllo che B cercava.
   - **Decisa il 2026-10-23 alle 14:57 UTC dall'Amministratore di Sistema: A.** Lo stato «pubblicato» resta al datastore: il manifesto lo dichiara e advanced lo registra così com'è, senza un gesto «pubblica» proprio. ADR-0043 voce 14 e D-72 non cambiano.
2. **ADR-0046, riga 42**: approvarlo con la formulazione «il perimetro di un tenant è quello della versione fissata dalle sue attivazioni ACTIVE nella finestra di validità; dove l'attivazione non fissa una versione vale, in via transitoria, la regola di oggi». Raccomandazione: sì.
   - **Decisa il 2026-10-23 alle 15:19 UTC da Enzo Spenuso: sì**, con questa formulazione (ADR-0046, §1).

## Conseguenze

- La migrazione `000400`, che si riesegue a ogni deploy, esige oggi esattamente due versioni PUBLISHED in tutto il database: va emendata prima del primo ricevimento in produzione, altrimenti il deploy successivo fallisce (R-50, incremento C3a). Va provata su una copia usa-e-getta, che oggi non c'è.
- Le migrazioni `000398`, `000400`, `000401` scrivono nelle versioni PUBLISHED risolvendole per stato; con più PUBLISHED per variante devono risolverle per identità (R-51, C3a).
- Un pacchetto valido per il datastore può essere rifiutato da advanced, che è più severo sui limiti delle colonne (R-54): il ricevimento lo dichiara come rifiuto motivato.

## Prove

- Datastore: `node --test tests/fascicolo_manifesto.test.ts tests/fascicolo_consegna_deposito.test.ts` (senza database), `tests/fascicolo_consegna.test.ts` (sul database delle prove).
- Advanced: `node --test db/scripts/pacchetto/manifesto-consegna.test.mjs`.
- Esiti e date: `.programmi/consolidamento/04_VERIFICHE.md`.
