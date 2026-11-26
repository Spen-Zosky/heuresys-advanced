# Mandato — applicare le sette decisioni sulle persone di RTL Bank (2026-11-10)

Approvate da Enzo il 2026-11-10 alle 21:27 Roma («tutti sì»), sul documento https://claude.ai/artifact/RUA1rvyQRp8VmQsrwLpZPt, sezione «Decisioni sulle persone». Scrittura in produzione autorizzata da Enzo alle 21:30 Roma con la frase «autorizzo la scrittura in produzione delle sette decisioni sulle persone di RTL, dopo la prova sulla copia e con la copia di ritorno provata». La frase vale solo con le due condizioni soddisfatte.

Regole di Enzo che valgono per tutto il mandato:

- La corsa del datastore p20261010010521tjb è la fonte di verità. RTL è un tenant di prova: niente vincoli di demansionamento o di stipendio, il livello e la retribuzione seguono il posto della corsa, in salita e in discesa.
- Ogni cambiamento controlla e aggiorna tutta la catena relazionale dei dati, senza escludere nessuna tabella (mappa NC-7: 206 tabelle che dipendono da `sys.sys_users`, `sys.sys_positions`, `sys.sys_organization_units`). Restano invariati soltanto i dati anagrafici e di utenza: data di nascita, indirizzo, email, password, titolo di studio e simili, e le tabelle `sys.sys_auth_*` (I7).
- Le filiali sono le 10 reali di RTL, con il modello di filiale della corsa applicato a ciascuna. Il livello di Area sparisce.

Allegati: `allegati/agente-non-corrispondenze/COERENZA_PERSONE_20261110.tsv` (una riga per persona RTL, con il posto della corsa abbinato e i livelli) e `allegati/agente-non-corrispondenze/POSIZIONI_CORSA_TJB_20261110.psv` (i 109 posti della corsa, con livello, organico e riporto).

## Le sette decisioni

1. Abbinamenti corretti. Monti G. va al Legale (con Benedetti R. e Russo M.), non su R003, che resta vacante. Sala M., Dangelo C., Gallo F., Mariani P. e Rinaldi M. restano nel bilancio e nelle segnalazioni: i ruoli di bilancio e segnalazioni si aggiungono alla corsa presi da RTL, e R097-R099 (controllo di gestione) restano vacanti. Russo B. resta nella formazione sotto Barbieri P. (R092) e R095 resta vacante. De Rosa F. va su R068 Direttore Finanza e Tesoreria. Villa O. non è R041: R041 corrisponde al Retail Director Caputo S. Serra C. passa a R063, R062 Direttore Crediti va a Caputo P. Cattaneo B. passa a R069 Responsabile Tesoreria.
2. Ognuno prende il livello CCNL del suo posto della corsa (POSIZIONI_CORSA, colonna `livello`), in salita (17) e in discesa (60), e la retribuzione segue il livello.
3. Pellegrini M. diventa R042 Responsabile Gestione Cassa e Pagamenti della rete; Leone X. diventa Responsabile Consulenza Clienti e Fidi di Milano Centro. Le due Aree spariscono e i 10 direttori di filiale riportano al Retail Director.
4. Posti per le 13 persone senza posto: Mancini G. e Villa P. su R080 Addetto Chiusura Conti (2 posti liberi). Fiore G., Greco F., Monti M., Testa N. su R049 e R051 nella loro filiale. Fontana G. e Ricci G. su R065 (organico da 3 a 5). Sanna P. e Santoro N. su R039 (da 2 a 4). Fontana D. su R020 (da 1 a 2). Greco A. su R023 (da 1 a 2). Rinaldi M. nel bilancio e nelle segnalazioni (decisione 1). Le 6 persone del recupero crediti (Galli F., Fontana G., Lombardi N., Palmieri T., Morelli S., Rossetti A.) e le 2 del Legale entrano con i processi 11 e 21 del catalogo approvato.
5. Gallo P. diventa R085 Responsabile Sviluppo Applicativi, Costa A. diventa R086 Responsabile Infrastrutture e Sicurezza IT; Greco S., Mariani L., Zanetti C., Rinaldi S. e Gatti P. riportano a Bellini Q., IT Director (R084).
6. In tutte e 10 le filiali un Responsabile Sportello e Cassa e un Responsabile Consulenza Clienti e Fidi, con i livelli della corsa; i cassieri e i consulenti riportano a loro, loro al direttore. Candidati: Bergamo Centro De Santis C. / Esposito M.; Brescia Centro Gatti M. / Cattaneo D.; Como Colombo F. / Mariani D.; Dalmine Esposito T. / Pagano M.; Milano Centro Moretti A. / Leone X.; Milano Porta Romana Colombo S. / Ferrara P.; Milano Sempione Deluca U. / Costa F.; Monza Caruso M. / Mariani E.; Sesto San Giovanni Fabbri G. / Marchetti N.; Varese Caruso S. / Romano C. Il vice direttore non è un ruolo della corsa: Orlando I. va su R044 Specialista Customer Care e Gestione Reclami.
7. Martino A. diventa «Responsabile Compliance e Protezione Dati».

## Estensione del mandato (Enzo, 2026-11-11 ore 00:23 Roma)

Messaggio di Enzo nella chat del progetto (id cmsg_01FMWxNibmDwSNyptL3ETuJq7tMTyzRRbx9CHfQhAuZQ3J), passi rilevanti alla lettera: «non riesci a definire un programma preliminare di allineamento e omogeneizzazione dei dati, specialmente per riempire gap e differenze tra il modello e i dati reali: ti ho chiesto di creare e attivare un assistente esperto di banche proprio per fare questo lavoro ma quello che fa è presentarmi report lunghi e noiosi che devo leggermi e approvare o cassare punto per putno invede di prendere decisioni e agire»; «ccnl mischiati (rtl è una banca, cosa c'entra il commercio)»; «ti ostini a fare il notaio su questioni formali e su tecnicismi che nella catena di sviluppo arrivano solo alla fine».

Quindi il mandato comprende, oltre alle sette decisioni (A):

- B. Il CCNL del Credito (ABI) per ogni persona, posto, livello e retribuzione del tenant; nessun CCNL di altri settori in nessuna tabella.
- C. I 21 processi del catalogo approvato, con fasi, responsabili e partecipazioni.
- D. Gli altri domini (skill, formazione, obiettivi e metriche, criticità, carriere, inquadramento) con i criteri di `apps/agent-gateway/src/settori/profili.ts`: l'agente colma i vuoti dalla corsa e corregge le incoerenze, e decide da solo.

L'agente decide e agisce; a Enzo arrivano un esito breve e solo le decisioni strategiche. Letture e prove sul gemello o su copie, senza leggere la produzione. La scrittura in produzione resta legata alle due condizioni della frase del 2026-11-10 ore 21:30 (prova sulla copia, copia di ritorno provata); per B, C e D serve in più la frase di Enzo chiesta nel thread alle 00:25 Roma.

## Ordine dei passi

| id | passo | fatto quando | stato |
| --- | --- | --- | --- |
| D-0 | Copia di lavoro sul gemello (linux-pc), senza leggere la produzione: clone esistente o copia usa-e-getta con `bash db/scripts/sul-gemello.sh` | copia aperta | ACTIVE |
| D-1 | Copia di ritorno: `bash scripts/copia-fase.sh copia rtl-persone-20261110`, poi `prova` | ripristino su un database a parte con tutti i conteggi uguali | WAIT-INPUT: serve prima della produzione, non prima delle prove |
| D-2 | Conteggio delle righe di RTL per ognuna delle 206 tabelle e classificazione (ANAGRAFICA_UTENZA, ORGANIZZAZIONE, ALTRO), sulla copia del gemello | TSV completo | GATED: D-0 |
| D-3 | Piano di modifica tabella per tabella, con un giornale `staging.*_undo` per ogni tabella toccata | piano scritto | GATED: D-2 |
| D-4 | Prova del piano sulla copia del gemello: nessuna riga orfana, ogni vincolo soddisfatto, anagrafica e utenze identiche per impronta riga per riga, storia 36 mesi coerente | prova verde | GATED: D-3 |
| D-5 | Dopo D-1 e D-4: scrittura in produzione con le guardie di ADR-0035 e la post-condizione di D-4, poi dimostrazione dal vivo con un login di una persona RTL | dimostrazione | GATED: D-4 |
