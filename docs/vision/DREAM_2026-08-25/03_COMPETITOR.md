# Competitor — tre schede (consultazioni 2026-08-25, riverifiche mirate 2026-08-26)

**Fonti integrali** (una per prodotto, con URL e data per ogni voce): [`_raccolta/competitor_personio.md`](_raccolta/competitor_personio.md) (95 voci) · [`_raccolta/competitor_eightfold.md`](_raccolta/competitor_eightfold.md) (52 voci) · [`_raccolta/competitor_zucchetti.md`](_raccolta/competitor_zucchetti.md) (24 voci). Il verifier ha ricontrollato sul web le 6 fonti che reggono MUST ed eretiche: **6/6 hanno tenuto** (dettaglio in `verifier_verdetti.md` §Fonti).

## Personio — CONCORRENTE DIRETTO

**Cos'è**: piattaforma HR all-in-one, nata in Germania, forte DACH, mid-market EU (crescita nel segmento 200-2.000 dipendenti). Piano base in due versioni + app add-on a pagamento (recruiting, survey, performance, compensation, whistleblowing). Prezzo non pubblico.
**Dove è forte**: core HR e assenze molto rifiniti, workflow configurabili, marketplace 200+ integrazioni, API/webhook documentate (nel piano alto), AI assistant per i dipendenti, localizzazione italiana dell'interfaccia.
**Dove è scoperto (verificato)**: succession planning — nessuna funzione dedicata documentata (solo via terzi); LMS nativo — non trovato (delega a terzi); whistleblowing — **add-on a pagamento**; per l'Italia solo pre-payroll; reporting rigido (lamentela ricorrente G2).
**Riserva dichiarata**: il dominio ha bloccato i fetch (403/429) per l'intera raccolta — le voci vengono da snippet indicizzati del dominio vendor; il nome del piano alto ("Core Pro") non è verificato su pagina.

## Eightfold AI — METRO DI RIFERIMENTO (mai MUST)

**Cos'è**: "AI-native Talent Intelligence Platform" enterprise (best leveraged da 10.000+ dipendenti; stima $7-10 PEPM), quattro moduli sopra un motore comune, dataset dichiarato di 1,6 mld traiettorie.
**Cosa indica come stato dell'arte**: inferenza delle skill da segnali di lavoro reale (Digital Twin), succession raccomandata automaticamente per ogni ruolo, talent marketplace interno, integrazione dichiarata come «system of intelligence» SOPRA il system of record del cliente — lo stesso posizionamento architetturale del nostro "complemento".
**Il fatto che pesa**: class action depositata il 20-01-2026 (California) sulla provenienza del dataset — scraping contestato su oltre un miliardo di lavoratori, score 0-5, scarto pre-revisione umana, FCRA. Il vendor nega. Per noi: l'argomento «AI dichiarabile» (P-15/P-19) nasce qui.
**Lamentele ricorrenti**: integrazioni lunghe, UI sovraccarica, analytics senza drill-down, costi proibitivi sotto i 2.000 dipendenti.

## Zucchetti — PIATTAFORMA COESISTENTE (superfici, non lacune)

**Cos'è**: la suite HR dominante in Italia — paghe, presenze, note spese (ZTravel), budget del personale, recruiting (Inrecruiting), formazione, valutazione, welfare. È il "gestionale esistente" del nostro posizionamento: non si sostituisce, ci si collega.
**Le superfici di integrazione concrete**: 5 tracciati presenze documentati pubblicamente (TRRIPW XML, HGAL_TIMEIMP_TMP, H1TR_CSVVOCI, TRRIPA, FOGPRE) — **import unidirezionale VERSO Paghe** (riverificato con fetch diretto: sono i file che i rilevatori producono per Zucchetti; leggerne una copia è la via, P-02); Inrecruiting integrabile via API; API generali dietro login SSO col modello "chiedi al commerciale" (`apiportal.zucchetti.it` non risolve — ENOTFOUND verificato).
**Conseguenza per la matrice**: payroll, timbrature, turni, note spese NON sono lacune — ogni proposta che li replicasse dovrebbe motivare perché rifare batte collegarsi (nessuna l'ha fatto: P-26 dichiara il non-fare).
