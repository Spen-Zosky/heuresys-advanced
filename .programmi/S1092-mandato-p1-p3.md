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
| 9a | Rigenera l'atlante (`build_atlas.py`) | io | STALENESS self-check verde sulla riga atlante | ✅ |
| 9b | Rigenera i derivati (`build_derivati.py`) | io | 3/3 derivati freschi | ✅ |
| 9c | Compatta il register (`compatta_register.py --esegui`) | io | cronaca < 25% del register | ✅ 27% → 22% |
| 9d | Commit atomico dell'igiene | io | working tree pulito, handoff_lint 0 FAIL | ✅ `c6a46985` + `c96354f2` |
| 10a | Suite API completa **sul gemello**, gemello allineato a HEAD | io | numero di test falliti misurato, log allegato | ✅ **1883/1883**, exit 0 |
| 10b | Verdetto `verify_gate` rimesso in pari o dichiarato non-misurabile con la ragione | io | `.zp/verify-verdict.json` fresco su HEAD, o ragione scritta | ✅ misura vera acquisita; il file resta `not-measured` (il diff non instrada nulla) |
| 3 | #54 F3 — fette `feedback` e `offers` | io | endpoint live + prova su dati reali | ✅ **F3 CHIUSA 7/7** |
| 4 | #143 F3 — asse funzionale vivo | io | `isInFunctionalScope` ha un consumatore reale | ✅ **F3 CHIUSA**, due consumatori |
| 5 | #169 F3 — il segreto smette di essere derivato | io | secondo fattore da segreto proprio, migrazione applicata | ⛔ → **WAIT-INPUT**: due decisioni di Enzo, nominate con i numeri |
| 6 | #214 F6 — consumo della coda dei neutri | io | ≥1 perimetro aperto con riga di decisione datata | ✅ **decimo perimetro**, live in produzione |
| 7 | #79 F3 — cancello di esposizione sul lavoro nuovo | io | `check_exposure.py` verde sulle tabelle toccate | ✅ 73/73, exit 0 sul processo |
| 8 | #149 F4 — prossima consegna del lab trattata come non verificata | io | consegna misurata o dichiarata assente | ✅ inbox vuota (2 misure) + **3 affermazioni ereditate smentite** |
| 9v | #159 F2 — il ponte | io | ponte con criterio di idoneità, o confine dichiarato | ✅ prova dinamica costruita; componente **fuori repo**, dichiarato |
| 10v | #205 — ri-misura del gate su #132 | io | gate confermato o sciolto, con la misura | ✅ misurato: **1 → 5 domini**, conclusione precedente ribaltata |

Legenda stato: ⏳ da fare · 🔄 in corso · ✅ fatto · ⛔ bloccato · ⏭ fuori sessione (guardiano)

**ESITO — 13/14 voci fatte.** L'unica non fatta è la **5** (`#169` F3), e non per capienza:
è passata a **WAIT-INPUT** perché l'indagine ha prodotto un fatto che sposta la decisione su
Enzo. Il guardiano non ha mai tagliato: contesto **41,9%**, finestra 5h **36%**, verdetto
«si continua» a ogni misura.

⛔ **Le due GATED, ri-misurate e non ereditate**: `#198` regge (le 4 `sys_blueprint_content_*`
sono ancora tutte a **0**) · `#41` è bloccata da un limite di spesa, che è di Enzo.

---

## Registro delle scoperte (R24 §5 — presentate una volta sola, fuori da «cosa resta»)

1. **La separazione delle due chiavi è formale** (`#169`): `dev-access-master.key` e
   `collaudo-access.key` convivono in `.secrets/` su tutte e tre le macchine e nello stesso
   file `.env` del runner CI. Registrato nel register come input richiesto.
2. **`enterprise_typing_metadata` ha già un nome proprio in chiaro** (`decided_by` =
   «Enzo 2026-06-15»): il criterio dell'indirizzo di posta non lo vede. Registrato nella
   `000381` e in `agent-perimetri.json`.
3. **`resolveActivityScope` registrava `self` per un capo senza membri** — corretto in
   `#143` F3, ma la classe del difetto (un conteggio che misura la portata e non il titolo)
   può ripresentarsi altrove.
4. **`apps/web` non aveva alcuna suite unitaria** — ora ne ha una minima. Estenderla a React
   pretende dipendenze nuove: non fatto, dichiarato.
