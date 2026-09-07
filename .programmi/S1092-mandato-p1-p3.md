# S1092 — mandato «9 e 10, poi tutto P1→P3 in autonomia»

**Mandato di Enzo (2026-09-08)**: *«inizia da 9 e 10 e poi esegui tutti da P1 a P3 in
autonomia e automaticamente prendendo decisioni per mio conto, nell'ordine che ritieni più
appropriato. L'unico guardiano che comanda è quello della capienza.»*

**Confine di sessione dichiarato all'inizio (R24 §4)**: il mandato copre **9 voci**. Alla
capienza misurata all'avvio (contesto 10,2% · finestra 5h 10,0% · residuo ~898k token) non
è dichiarabile che tutte e 9 stiano in questa sessione: le stime del register sommano
~15-20 sessioni di lavoro. **Il taglio lo decide il guardiano, non io**: si procede in
ordine finché contesto < 75% e finestra 5h < 80%, poi si chiude. Ciò che resta è dichiarato
nella chiusura, voce per voce.

**Ordine deciso da me, e la ragione di ciascuna posizione:**

| ord | id | perché qui |
|---|---|---|
| 1 | 9 igiene | corto, deterministico, e l'atlante superato falsa ogni strumento che lo interroga |
| 2 | 10 verify_gate | lungo ma **in background sul gemello**: parte per primo e matura mentre lavoro |
| 3 | #54 F3 | pattern rodato, 2 fette su 4, chiude una P2 grossa con lavoro prevedibile |
| 4 | #143 F3 | P1, ma serve una superficie che gatti il singolo record: dipende da lavoro API |
| 5 | #169 F3 | P2 da ~1 sessione, è sicurezza, ed è la più corta delle restanti |
| 6 | #214 F6 | 6/7 fatte, consumo di coda: una riga di decisione per perimetro |
| 7 | #79 F3 | continuativo, si applica **sopra** il lavoro fatto ai punti 3-5 |
| 8 | #149 F4 | P1 continuativo, non ha un innesco proprio in questa sessione |
| 9 | #159 F2 | il componente sta in `ux-design-shared`, altro repository: rischio di confine |
| — | #205 | ⛔ GATED su #132 — si ri-misura il gate, non si forza |

---

## Tabella dei deliverable

| id | cosa | chi | «fatto» significa | stato |
|---|---|---|---|---|
| 9a | Rigenera l'atlante (`build_atlas.py`) | io | STALENESS self-check verde sulla riga atlante | ⏳ |
| 9b | Rigenera i derivati (`build_derivati.py`) | io | 3/3 derivati freschi | ⏳ |
| 9c | Compatta il register (`compatta_register.py --esegui`) | io | cronaca < 25% del register | ⏳ |
| 9d | Commit atomico dell'igiene | io | working tree pulito, handoff_lint 0 FAIL | ⏳ |
| 10a | Suite API completa **sul gemello**, gemello allineato a HEAD | io | numero di test falliti misurato, log allegato | ⏳ |
| 10b | Verdetto `verify_gate` rimesso in pari o dichiarato non-misurabile con la ragione | io | `.zp/verify-verdict.json` fresco su HEAD, o ragione scritta | ⏳ |
| 3 | #54 F3 — fette `feedback` e `offers` | io | endpoint live + prova su dati reali | ⏳ |
| 4 | #143 F3 — asse funzionale vivo | io | `isInFunctionalScope` ha un consumatore reale | ⏳ |
| 5 | #169 F3 — il segreto smette di essere derivato | io | secondo fattore da segreto proprio, migrazione applicata | ⏳ |
| 6 | #214 F6 — consumo della coda dei neutri | io | ≥1 perimetro aperto con riga di decisione datata | ⏳ |
| 7 | #79 F3 — cancello di esposizione sul lavoro nuovo | io | `check_exposure.py` verde sulle tabelle toccate | ⏳ |
| 8 | #149 F4 — prossima consegna del lab trattata come non verificata | io | consegna misurata o dichiarata assente | ⏳ |
| 9v | #159 F2 — il ponte | io | ponte con criterio di idoneità, o confine dichiarato | ⏳ |
| 10v | #205 — ri-misura del gate su #132 | io | gate confermato o sciolto, con la misura | ⏳ |

Legenda stato: ⏳ da fare · 🔄 in corso · ✅ fatto · ⛔ bloccato · ⏭ fuori sessione (guardiano)

---

## Registro delle scoperte (R24 §5 — non entrano in «cosa resta»)

*(vuoto all'apertura)*
