# Repertorio delle interfacce intelligenti: regole e riti per ogni tabella, elenco e casella di scelta

Regole permanenti di disegno delle interfacce di heuresys-advanced, valide per tutte le pagine attuali e future. Nascono dai rilievi di Enzo del 2026-11-10 sulla pagina Utenti («questo è un esempio di dati poveri e inefficaci») e dal giro a campione dal vivo dello stesso giorno, il cui registro sta in `docs/piani/PIANO_interfacce-intelligenti_20261110.md`. Si aggiungono alle dieci condizioni di qualità Q1-Q10 di `docs/piani/PIANO_interfacce_20261103.md`, non le sostituiscono.

Il presupposto è quello del progetto: Heuresys è una piattaforma agentica, guidata dall'intelligenza artificiale. Un'interfaccia non mostra «le colonne che la tabella del database ha»: sceglie i dati che servono a chi guarda per decidere, nel contesto in cui guarda. Se una scelta di colonne non si sa motivare con il lavoro di chi usa la pagina, la scelta è sbagliata.

## Le regole

**R1. Le persone si ordinano per cognome e si scrivono «Cognome, Nome».** Vale per ogni elenco di persone, intero o parziale: tabelle, caselle di scelta, selettori, organigrammi in forma di elenco, risultati di ricerca. L'ordine lo fa l'API su tutto l'insieme (non il browser sulla pagina caricata), così la seconda pagina continua la prima. Strumenti: `cognomeNome()` in `apps/web/src/lib/person-label.ts`; nell'API l'ordine `PERSON_ORDER` di `apps/api/src/modules/users/repository.ts`. Un'utenza senza cognome (di servizio) va in coda con il suo nome.

**R2. Le colonne si scelgono per il contesto, non per lo schema.** Prima di disegnare una tabella si scrive in una riga chi la usa e che cosa ci deve decidere; poi si scelgono le colonne che rispondono a quella domanda. Per una persona contano chi è, che cosa fa (ruolo nell'organizzazione, unità) e dove opera (sede); l'email, l'identificativo e le date tecniche stanno nella scheda di dettaglio. Un codice tecnico (`POS-00000288`) non è mai la prima colonna: prima viene il nome che una persona riconosce, e il codice si mostra solo se chi usa la pagina lo usa davvero nel suo lavoro. Quando un dato manca si dice che manca («Nessuna posizione attiva»), non si inventa.

**R3. L'etichetta di stato è l'ultima colonna di dati.** Attivo, Approvata, In corso: lo stato chiude la riga. Dopo lo stato può stare solo la colonna delle azioni, che non è un dato.

**R4. Niente codici di lavoro a video, mai.** Nessun `HR_MANAGER`, `PROCESS_OWNER`, `STANDARD`, `MEDIUM`, `ACTIVE`, `RTL_BANK` in tabelle, intestazioni, titoli, caselle di scelta, pastiglie, grafici. Si mostra la descrizione leggibile nella lingua della persona («HR Manager», «Process Owner», «Media»), presa dal livello di etichette (`useEnumLabel`, `common:enums.<dominio>.<VALORE>`, IT ed EN in parità) o dal nome che il dato già porta (`tenantName`, non `tenantCode`). Un'etichetta che non dice niente («Standard») si sostituisce con una che dice che cosa distingue («Persona», «Utenza di servizio»), oppure la colonna si toglie. `codiceInParole()` è una rete di sicurezza, non una soluzione.

**R5. Un solo numero per una cosa, coerente con il perimetro e con i filtri.** Il numero nel titolo e il totale della tabella vengono dalla stessa risposta dell'API e dicono che cosa contano («158 persone», non «167 totali» che somma anche le utenze di servizio). Nessun elenco si ferma in silenzio a 50 righe: o tutto, o pagine del server con il totale dichiarato. Il perimetro è quello di chi è entrato: una persona di RTL vede solo dati di RTL; un mandato di piattaforma vede i totali di tutti i tenant che gestisce, con la colonna Tenant e una casella di scelta con i nomi dei tenant che parte da «Tutti» (nessun filtro). Il filtro per tenant lo applica l'API, e per chi ha un tenant è ignorato: il perimetro non si allarga dalla richiesta.

**R6. Ogni casella di scelta parla come la pagina.** Le opzioni sono descrizioni ordinate in modo utile (alfabetico per i nomi, logico per gli stati), la prima opzione di un filtro è «Tutti» o «Tutte», e la scelta corrente si riflette nel numero del titolo.

**R7. Le stesse cose si chiamano nello stesso modo in tutte le pagine.** Un termine per concetto (per esempio «Dashboard», unificato con il riordino della barra laterale, PR #213), un'etichetta per valore. Se due pagine contano la stessa cosa, il numero è lo stesso.

## I riti

**Rito di progettazione, per ogni pagina nuova o toccata.** Prima del codice si scrivono nel commento in testa alla pagina tre righe: chi la usa, che cosa ci decide, quali colonne rispondono a quella domanda e perché. Poi si verifica con l'API dal vivo che quei dati esistano per il tenant reale (non su un esempio), e se mancano si apre prima la parte API (dottrina `frontend-live-data.md`).

**Rito di revisione, per blocco.** Le pagine si rivedono per area, una PR per blocco, secondo il piano. Per ogni pagina del blocco: giro dal vivo con una persona vera di RTL, misura R3-R5 con il controllo automatico, giudizio R1, R2, R6, R7 scritto nella riga della pagina nel piano, correzione, prova, dimostrazione sul banco con orario e percorso.

**Rito di chiusura.** Una pagina è conforme quando il controllo automatico la trova pulita, il suo debito è tolto dal registro e la riga del piano porta la dimostrazione dal vivo. Un test verde da solo vuol dire «in corso» (ADR-0026).

## I controlli automatici

`apps/web/tests/e2e/interfacce-intelligenti.spec.ts` apre le pagine con tabelle e misura R3 (stato in coda), R4 (codici a video) e R5 (numeri diversi) con la funzione di `interfacce-intelligenti.regole.ts`. È un cricchetto: il registro `interfacce-intelligenti.debiti.json` elenca i rilievi già noti per pagina, e il caso diventa rosso quando compare un rilievo che il registro non ha. Quando un rilievo del registro non si vede più, il caso lo annota come «debito-pagato» (non rosso, perché i dati del banco possono mancare del valore che lo mostrava). Il registro quindi può solo accorciarsi, e ogni blocco lo accorcia nella stessa PR in cui corregge le pagine. Una pagina nuova con tabelle si aggiunge al registro con l'elenco vuoto.

R1, R2, R6 e R7 sono giudizi: li fa il rito di revisione. Dove un giudizio diventa misurabile (per esempio l'ordine per cognome di `/users`) la prova sta nella spec E2E della pagina (`admin-lists.spec.ts`).
