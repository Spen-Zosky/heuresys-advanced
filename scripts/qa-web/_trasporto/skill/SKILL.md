---
name: qa-web
description: «Fai QA web» (anche «QA web», /qa-web) - QA forense completo di tutte le interfacce web del progetto, nodo per nodo e per ogni ruolo, con rapporto, piano di recovery e remediation da approvare, poi esecuzione e nuovo giro fino a chiusura binaria. Si usa ogni volta che si chiede un QA, un collaudo o un controllo delle interfacce web.
---

# Fai QA web

## Che cosa significa il comando, sempre

«Fai QA web» vuol dire, senza che Enzo debba aggiungere altro: QA forense e rapporto dettagliato di tutte le interfacce web di questo progetto, dal primo all'ultimo nodo, per ogni persona di ogni ruolo, in ogni lingua e in ogni formato dichiarati; poi un piano di recovery, remediation e risoluzione di ogni problema, presentato per l'approvazione; dopo il sì, l'esecuzione e un nuovo giro di verifica sulle righe corrette, fino a «GIRO CHIUSO». Se Enzo nomina una parte («Fai QA web sulle pagine analytics»), il perimetro si restringe a quella parte e lo si scrive nel rapporto; il metodo non cambia.

## Il principio: lo strumento fa, tu giudichi, il registro decide

Non si fa QA navigando a mano e scrivendo impressioni. Il lavoro meccanico lo fa lo strumento qa-web: scopre le pagine, censisce ogni nodo, esercita ogni elemento (clic, caselle, menu e ogni loro opzione, passaggio del mouse sui grafici, apertura di righe, modali e schede, ricorsione su ogni stato nuovo) e controlla da sé codici al posto di descrizioni, lingua, formati, testi troncati, scorrimento, accessibilità, chiamate e console. Scrive una riga per ogni verifica in un registro. A te restano le righe che chiedono un occhio: leggibilità, interpretabilità per una persona, qualità del rendering, coerenza del dato con il senso della pagina. Il rapporto e il piano si generano dal registro. Un difetto che non è nel registro non esiste; una riga senza verdetto impedisce di dire «finito».

Strumento: `~/.claude/tools/qa-web/qa-web.mjs` (Node 22 o più, Playwright). Comandi: `avvia`, `esegui`, `giudica`, `stato`, `rapporto`; `node qa-web.mjs` senza argomenti stampa l'uso.

## Procedura

1. **Profilo del progetto.** Cerca `qa-web.json` alla radice del repository. Se manca, ricavalo dal codice (base URL, rotte: per Next.js `"rotte": {"tipo": "next-app", "cartella": "<app>"}`, altrimenti un elenco; lingue; formati; ambiente) e scrivilo; per l'accesso delle persone scrivi un adattatore (`persone`, `entra`, facoltativo `impostaLingua`) nel repository, mai password in chiaro. Chiedi a Enzo solo ciò che non si ricava: chi può entrare e con quali credenziali, se il sito è di produzione.
2. **Sicurezza.** Se l'ambiente è di produzione, `"ambiente": "produzione"`: lo strumento blocca nel browser ogni richiesta che non sia GET, HEAD o OPTIONS, salvo `scritture_ammesse` (di solito login e rinnovo della sessione). Un login con persone vere in produzione richiede una frase scritta di Enzo; chiedila una volta, con il testo esatto. Escludi dal giro uscita e logout (`escludi`, `escludi_nodi`). Mai inviare form veri, mai caricare file, mai aggirare il blocco.
3. **Avvio.** `node ~/.claude/tools/qa-web/qa-web.mjs avvia --profilo qa-web.json --giro <cartella del giro>`. La cartella del giro sta in una sede durevole del progetto o della macchina, mai in una cartella temporanea. Se l'adattatore importa TypeScript, lancia con `npx tsx` dalla cartella che ha le dipendenze.
4. **Esecuzione.** `esegui --giro <cartella>`, anche in più riprese (`--minuti N`): il registro riprende da dove era. Un giro di un'applicazione grande dura ore o giorni ed è normale. Fra una ripresa e l'altra guarda `stato` e annota l'avanzamento nella checklist.
5. **Giudizio.** `giudica --giro <cartella> --limite 200` elenca le righe senza verdetto, con la schermata. Guarda davvero ogni schermata citata (aprila e leggila) e scrivi un file TSV `id<TAB>verdetto<TAB>causa`, con verdetto fra OK, DIFETTO, NON-APPLICABILE, BLOCCATO; tutto ciò che non è OK porta una causa. `giudica --giro <cartella> --verdetti <file>` lo registra e scarta le righe malformate. Le righe DIFETTO automatiche si possono rovesciare solo con una causa che spieghi perché non è un difetto. Le righe P-NON-RAGGIUNTA (rotte con parametri che nessun collegamento raggiunge) si chiudono trovando la strada nell'interfaccia o scrivendo perché manca: se manca la strada, è un difetto.
6. **Lista di controllo del giudizio, per tipo di oggetto.** Pagina (G-RENDER): impaginazione, gerarchia dei titoli, sovrapposizioni, spazi, stati vuoti e di errore comprensibili, coerenza con le altre pagine. Tabella (G-TABELLA): ogni colonna ha un senso per una persona, descrizioni e non codici, unità di misura, ordinamento sensato, totali coerenti, paginazione. Grafico (G-GRAFICO): assi, legenda, unità, colori distinguibili anche in grigio, valori plausibili, suggerimento al passaggio. Elemento senza effetto (E-ESERCIZIO): è decorativo o è rotto? Testo troncato o corpo piccolo: si legge? Lingua: la stessa parola tradotta allo stesso modo ovunque. Dato: un numero è credibile rispetto al resto della pagina e alla persona che la guarda.
7. **Chiusura del giro.** `stato --giro <cartella>` esce 0 solo con coda vuota e ogni riga con un verdetto. Finché esce 3 il QA non è finito, qualunque cosa sembri.
8. **Rapporto e piano.** `rapporto --giro <cartella>` scrive `RAPPORTO.md`, `PIANO.md` e `registro.tsv`. Completa il piano: per ogni voce la causa radice comune accertata nel codice (spesso un componente o un formattatore), la correzione, il rischio, l'ordine. Presenta a Enzo l'esito in poche righe e il piano per l'approvazione. Niente si corregge prima del sì.
9. **Esecuzione e verifica.** Dopo il sì, correggi seguendo le regole del progetto (rami, PR, rilascio deciso da Enzo). Poi un giro nuovo con lo stesso profilo; una voce del piano è chiusa quando le sue righe tornano OK. Chiusura binaria: «QA CHIUSO — N/N voci» oppure «QA NON CHIUSO — manca la voce K, serve Enzo per Y».

## Divieti

- Non campionare: «tutte le pagine» vuol dire tutte le rotte del codice per tutte le persone. Ogni riga saltata ha una causa scritta.
- Non dichiarare finito, completo o «a posto» prima che `stato` esca 0.
- Non sostituire lo strumento con una navigazione a mano o con un giro sulle sole voci di menu.
- Non scrivere difetti nel rapporto che non siano righe del registro.
- Non modificare il profilo per far sparire righe: un'eccezione si dichiara con codice, perimetro e ragione, e resta nel registro come NON-APPLICABILE.

## Se lo strumento non basta

Se un tipo di oggetto non viene censito o esercitato (un componente custom, un grafico su canvas), non lo si salta: si aggiunge allo strumento il riconoscimento, nella fonte dell'ecosistema, e lo si dice nel rapporto. Se una skill più vecchia (web-qa-audit) si attiva al posto di questa, segnalalo a Enzo.
