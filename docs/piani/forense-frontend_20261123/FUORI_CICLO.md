# Fuori da questo ciclo

Registro delle cose scoperte o decise durante il ciclo forense del 23/11/2026 che non servono a chiuderlo. Nessuna è stata avviata. Si riprendono solo con il sì di Enzo.

| id | cosa | origine | perché fuori ciclo |
|---|---|---|---|
| F1 | K11: incoerenze del dato di RTL Bank (righe doppie in /job-catalog e /learning, date di scadenza prima dell'iscrizione, compensi orari implausibili in /analytics/overtime, sezioni NACE in maiuscolo in /tassonomie; 1.161 righe del giro, 21 pagine) | decisione di Enzo del 24/11/2026: «metterlo nell'elenco fuori da questo ciclo, da riprendere dopo» | è un lavoro sul dato, già in parte in carico al thread del dato di RTL |
| F2 | K08: riscrittura del criterio nel dato (le migrazioni 000510-000512 scrivono «Proposta dell'agente (0005xx)») e spostamento del marcatore in un campo a parte | la decisione di Enzo del 24/11/2026 è nascondere il prefisso solo nella pagina | scrivere sul database e modificare le migrazioni non è stato autorizzato |
| F3 | K24: popolamento vero dei dati delle attività dei processi (ingresso, uscita, esecutore, natura del lavoro, modalità, ore per ciclo) | decisione di Enzo del 24/11/2026: nascondere le colonne vuote nella pagina | è un lavoro sul dato |
| F4 | Frecce «›» isolate al posto dei sottogruppi del menu laterale a barra chiusa (`menu-laterale.tsx`) | trovato dalla correzione di K21 (#465) | non è fra le cause di K21 |
| F5 | Nome dell'asse «Mese» sovrapposto alle etichette ruotate in /analytics/attendance | trovato dalla correzione di K17 (#461) | non era fra i difetti chiesti |
| F6 | K25: pagine lente, da indagare prima di sapere se la causa è nel codice | classi-difetti.md | non si sa se è un difetto da correggere |
| F7 | K05 residuo: «Data table» sulle tabelle senza didascalia, «Aggiorna» di PageActions, riga del centro notifiche | adozione della libreria 1.7.1 (#454) | la libreria non li copre e non sono fra le righe da chiudere |
| F8 | Il pulsante «Esci» a barra compressa mostra il testo intero in 72 px | revisione di #465 | fuori dal perimetro di K21 |
| F9 | `da-eliminare.sh` segue i collegamenti simbolici e dà lo stesso nome di arrivo a due file con lo stesso nome (il secondo sovrascrive il primo); il CI del repo ux-design-shared (deploy-storybook.yml) è rosso da prima e non installa Chromium per la prova nel browser | incidenti del ciclo e revisione di ux-design-shared #19 | riguardano l'ecosistema e un altro repo |
| F10 | Radice e `apps/showcase` di advanced restano su `@heuresys/ui ^1.6.0` | revisione di #454 e #470 | fuori dal perimetro del frontend verificato |
| F11 | Chiusa: le route dinamiche erano tutte raggiunte da almeno un giro; i fascicoli di configurazione sono stati visitati per tutte le persone (s7) | giro di verifica del 25/11 | non è più un limite |
| F12 | Clic automatico sulle intestazioni di corsia della scheda Fasi: scade perché il centro del gruppo SVG è coperto dalle caselle; la pagina si apre con il doppio clic | giro di verifica del 25/11 | limite dello strumento |
| F13 | Chiusa: le 209 righe bloccate erano clic scaduti e 6 accessi rifiutati, rifatte; i verdetti ereditati di impaginazione, tabelle e grafici sono stati rigiudicati | giro di verifica del 25/11 | non è più un limite |
| F14 | Chiusa (26/11, decisione di Enzo): il gestore dei modelli apre anche la scheda del fascicolo; elenco e scheda non hanno più il perimetro dei clienti per BLUEPRINT_MANAGER, come già il confronto | correzione #487 | non è più un limite |
| F15 | Le attività dei processi non sono assegnate ai sottoprocessi: la colonna «Sottoprocesso» compare solo quando il dato c'è | correzione #482 | è un dato, non codice |
