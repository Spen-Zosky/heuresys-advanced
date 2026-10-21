# cruscotto/stato.json — schema `cruscotto-stato/1`

Questo file alimenta il "Cruscotto progetti" di Enzo. Lo legge ogni mattina una raccolta automatica in sola lettura: niente viene interpretato, quindi conta che sia vero e aggiornato. Si aggiorna a fine sessione, insieme agli altri file di stato del progetto, e si committa con il resto.

Regole: ogni voce deve poggiare su un file o un comando (campo `fonte`); niente password, token, chiavi o valori di `.env`; gli `id` sono stabili (la stessa pendenza tiene lo stesso id finché non si chiude, poi si toglie dalla lista); le date sono `AAAA-MM-GG`. Se in una sessione non cambia niente di quello che il file descrive, basta aggiornare `aggiornato_il`.

| campo | cosa contiene |
|---|---|
| `schema` | sempre `cruscotto-stato/1` |
| `progetto` | nome del progetto |
| `aggiornato_il`, `aggiornato_da` | data dell'ultimo aggiornamento e sessione o persona che l'ha fatto |
| `fase` | una frase: in che fase è il progetto |
| `stato`, `stato_motivo` | `verde`, `giallo` o `rosso`, con il motivo in una frase |
| `avanzamento` | `null`, oppure `{valore: 0-100, fonte}` solo se un piano lo misura davvero |
| `decisioni_attese` | ciò che aspetta una decisione di Enzo: `{id, titolo, dal, blocca, raccomandazione, fonte}` |
| `pendenze` | lavoro aperto: `{id, titolo, priorita: alta/media/bassa, chi: enzo/claude/esterno, fonte}` |
| `rischi` | `{id, titolo, impatto: alto/medio/basso, mitigazione, fonte}` |
| `tappe` | le tappe significative, si aggiungono e non si tolgono: `{data, titolo, tipo: milestone/release/decisione/incidente, fonte}` |
| `aree` | aree funzionali: `{nome, stato: fatto/in corso/da fare, nota}` |
| `prossimi_passi` | lista di frasi |
| `ambienti` | `{nome, dove, indirizzo, note}` |

Una decisione presa esce da `decisioni_attese` (e, se è significativa, entra in `tappe` come `decisione`). Il cruscotto calcola da solo da quanti giorni una voce è aperta, a partire dalla prima volta che l'ha vista.
