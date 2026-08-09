# «gov» fase 2 — il governo dei lavoratori

**Origine**: analisi di processo di Enzo, 2026-08-09, dopo la quarta corsa presidiata.
**Fase 1** (costruzione e prime corse): `docs/superpowers/plans/2026-08-09-modalita-gov.md`.
**Stato**: piano scritto. Esecuzione in corso.

> **Cosa ci interessa in questa fase** (Enzo): *analizzare e perfezionare il processo*, non
> chiudere cluster. Il lavoro prodotto è materiale di prova, non produzione.

---

## 1. I cinque rilievi, e cosa hanno in comune

| # | Rilievo di Enzo | Natura |
|---|---|---|
| **R1** | Il governo dei lavoratori è troppo debole | fiducia al posto di meccanismo |
| **R2** | Nessun obbligo di registrare **ogni azione** in un registro verificabile dopo la corsa | idem |
| **R3** | Un lavoratore può **uscire dal perimetro**, con conseguenze non prevedibili | idem |
| **R4** | «Questi due possono correre insieme» si basa su un'informazione **che nessuno verifica** | conseguenza di R3 |
| **R5** | Nessuna **misura predittiva** del costo: il lavoro si ferma quasi sempre a metà | dato mancante |
| **R6** | Il lavoro deve **restare nei rami** anche da concluso; i gate di chiusura sono di **gov** | responsabilità mal collocata |

**R1, R2, R3, R4 sono lo stesso difetto visto da quattro lati**: tutto ciò che il lavoratore
deve fare gli è stato *chiesto in prosa*. Questo progetto ha già scritto, in testa a
`session_mode.py`, che *«la modalità non è una promessa del modello, è uno stato su disco»*.
Il perimetro e il registro delle azioni devono diventare la stessa cosa: **hook**, non frasi.

---

## 2. I deliverable

| id | cosa | chiude | cosa significa fatto | stato |
|---|---|---|---|---|
| **F1** | **Recinto**: hook `PreToolUse` nell'albero del lavoratore che **rifiuta** le scritture fuori dal perimetro assegnato | R1 R3 R4 | un lavoratore che prova a scrivere fuori perimetro riceve un rifiuto motivato; provato iniettando il tentativo | da fare |
| **F2** | **Diario**: hook `PostToolUse` che scrive **ogni** azione in un giornale append-only nell'albero | R1 R2 | dopo la corsa, `stato-gov --diario <n>` elenca ogni comando e ogni scrittura, con orario; il lavoratore non può disattivarlo | da fare |
| **F3** | **Consuntivo**: a fine giro il driver confronta i file toccati col perimetro e **lo dichiara** | R2 R4 | una violazione compare nel log del giro e nel giornale, anche se il recinto l'avesse mancata | da fare |
| **F4** | **Storico dei costi**: ogni corsa registra costo reale ↔ effort dichiarato, e `zp_state` ne deriva una stima per il prossimo | R5 | `zp_state costo Z-nnn` risponde con una stima basata su misure, o dice «non ho dati» | da fare |
| **F5** | **Budget dal dato, non dal numero fisso**: il tetto per cluster deriva dalla stima di F4 | R5 | un cluster da 1h non parte più con un tetto che lo tronca a metà | da fare |
| **F6** | **Chiusura in capo a gov**: i gate girano sul ramo del lavoratore, il merge su main è un atto separato e presidiato | R6 | `gov chiudi <n>` esegue typecheck+lint+test+gate sul ramo e produce un verdetto; nessun merge automatico | da fare |

## 3. Cosa NON cambia

- Il **freno** resta, e resta di Enzo.
- La **corsia** resta (safe = A e B).
- Il lavoro **non va mai su main da solo**: F6 produce un verdetto, non un merge.
- `gov` resta **dispatcher** — con una precisazione che la fase 1 non aveva: *eseguire i gate
  non è toccare il codice*. Verificare è suo mestiere; scrivere no.

## 4. Il dato che abbiamo già, e che F4/F5 devono usare

Dalla quarta corsa, primi due punti misurati di sempre:

| cluster | effort dichiarato | costo reale | esito | costo/ora dichiarata |
|---|---|---|---|---|
| `Z-230` | 0,8 h | **$5,15** | troncato (budget) | ~$6,4/h |
| `Z-112` | 1,0 h | **$11,17** | interrotto (budget) | ~$11,2/h |

**Nessuno dei due è finito**, entrambi contro un tetto di **$12**. È esattamente il rilievo R5:
il tetto per-giro non protegge, tronca. Due punti non fanno una stima — ma dicono già che
$12 per un cluster da 1 ora è **sotto** il costo reale, non sopra.

## 5. Ordine di esecuzione

1. **F1 + F2 insieme** — stesso meccanismo (hook nell'albero), e sono i due che Enzo mette per
   primi. Chiudono R1, R2, R3, R4.
2. **F3** — piccolo, e rende visibile ciò che il recinto eventualmente manca.
3. **F6** — la chiusura, che è la responsabilità mal collocata.
4. **F4 + F5** — richiedono corse per accumulare dati: si costruisce il meccanismo, i numeri
   arrivano dopo.
