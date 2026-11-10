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

## Ordine dei passi

| id | passo | fatto quando | stato |
| --- | --- | --- | --- |
| D-1 | Copia di ritorno: `bash scripts/copia-fase.sh copia rtl-persone-20261110`, poi `prova` | ripristino su un database a parte con tutti i conteggi uguali | WAIT-INPUT: frase di Enzo per la copia di fase e la lettura della produzione |
| D-2 | Conteggio delle righe di RTL per ognuna delle 206 tabelle e classificazione (ANAGRAFICA_UTENZA, ORGANIZZAZIONE, ALTRO), sul database ripristinato | TSV completo | GATED: D-1 |
| D-3 | Piano di modifica tabella per tabella, con un giornale `staging.*_undo` per ogni tabella toccata | piano scritto | GATED: D-2 |
| D-4 | Prova del piano sul database ripristinato: nessuna riga orfana, ogni vincolo soddisfatto, anagrafica e utenze identiche per impronta riga per riga, storia 36 mesi coerente | prova verde | GATED: D-3 |
| D-5 | Scrittura in produzione con le guardie di ADR-0035 e la post-condizione di D-4, poi dimostrazione dal vivo con un login di una persona RTL | dimostrazione | GATED: D-4 |
