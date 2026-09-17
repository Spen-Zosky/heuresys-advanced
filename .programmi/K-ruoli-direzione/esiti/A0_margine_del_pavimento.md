# A0 — Il margine che rende il pavimento un fatto, non un'opinione

Sessione S1105, 2026-09-17. Risponde al passo A0 del mandato S1105.

## Perché questa misura

Il contesto riportato dal guardiano è "un pavimento, non un soffitto": il transcript si scrive a
fine turno, quindi fra una misura e la prossima il contesto vero può già essere salito senza che
nessuno l'abbia visto. Il 16-17 settembre questo ha permesso a una sessione di passare dal 74,8%
all'87,3% (+12,5 punti) in 48 minuti senza nessuna misura in mezzo. Questa voce cerca un margine
di sicurezza: quanto può crescere il contesto fra due misure consecutive, in condizioni normali.

## Il metodo

Ho scritto uno script (`tools/misura_a0_margine.py`) che legge un transcript di sessione e replica
ESATTAMENTE la logica di campionamento di `~/.claude/tools/guardiano.py` (funzione `campiona()`):
per ogni riga del file con un blocco `message.usage`, il contesto in quel momento è
`input_tokens + cache_read_input_tokens + cache_creation_input_tokens`. Questi sono gli stessi
numeri che il guardiano userebbe se lo lanciassi in quell'istante.

Poi calcolo la differenza fra un campione e il successivo (il "salto"): quanto è cresciuto il
contesto da una misura alla successiva. Guardo la DISTRIBUZIONE dei salti — mediana, 90-esimo
percentile, massimo — non la media, perché la media è distorta da pochi salti enormi (es. la
lettura di un file grande) che non sono il caso normale.

## I quattro transcript misurati

Tutti e quattro sono sessioni reali e concluse del mandato K (verificato: ciascuno contiene
riferimenti a "K-ruoli-direzione" nel proprio testo — 120, 309, 185, 65 occorrenze rispettivamente).

Comando eseguito:

```
python .programmi/K-ruoli-direzione/tools/misura_a0_margine.py \
  ~/.claude/projects/D--heuresys-advanced/d6e7f53b-6cc2-41a1-a045-4d94215e031b.jsonl \
  ~/.claude/projects/D--heuresys-advanced/c8873c8b-4af9-44bc-b501-bd6b34d6eec4.jsonl \
  ~/.claude/projects/D--heuresys-advanced/218d2692-52ca-4b91-96d6-04b9ba9d2e3d.jsonl \
  ~/.claude/projects/D--heuresys-advanced/abbcdb70-a248-451f-88cf-37867c67f055.jsonl
```

Output completo salvato in `evidenze/A0_output_202609170*.txt`. Risultato:

| transcript | campioni | picco contesto | salto mediano | salto 90° pct | salto massimo |
|---|---|---|---|---|---|
| d6e7f53b (S1104, notte 16-17/9) | 1.295 | 873.262 (87,3%) | 386 tok (0,04%) | 2.027 tok (0,20%) | 34.701 tok (3,47%) |
| c8873c8b | 558 | 689.835 (69,0%) | 1.039 tok (0,10%) | 3.739 tok (0,37%) | 22.532 tok (2,25%) |
| 218d2692 | 722 | 703.316 (70,3%) | 778 tok (0,08%) | 3.564 tok (0,36%) | 24.985 tok (2,50%) |
| abbcdb70 | 284 | 402.553 (40,3%) | 865 tok (0,09%) | 3.531 tok (0,35%) | 25.349 tok (2,53%) |
| **aggregato (n=1.632 salti positivi)** | | | **648 tok (0,06%)** | **2.880 tok (0,29%)** | **34.701 tok (3,47%)** |

La finestra usata per le percentuali è 1.000.000 di token (Sonnet 5, la stessa dichiarata da
`context-window.json` in questa sessione): tutte e quattro le sessioni K girano sullo stesso
modello, quindi il denominatore è lo stesso per tutte e il confronto è omogeneo.

## Il margine proposto

**Il 90-esimo percentile aggregato dei salti positivi è 2.880 token, pari a 0,29 punti percentuali
della finestra. Arrotondato per eccesso al punto intero: 1 punto percentuale.**

Perché il 90° percentile e non il massimo: coprire il 90° percentile significa che nove volte su
dieci la soglia non viene scavalcata fra una misura e la successiva (è la stessa logica del
mandato). Il massimo osservato (3,47%, un singolo salto da 34.701 token su 1.295 campioni di
d6e7f53b) è un evento raro — un singolo turno con un output o una lettura molto grande — e
inseguirlo con il margine sposterebbe la soglia da 75% a 71,5%, un costo enorme per proteggersi da
un evento che capita meno di una volta su mille misure. Il 90° percentile è il compromesso che il
mandato ha chiesto di misurare, non di indovinare.

## Che cosa NON decido

Il margine non si applica da solo: le soglie (75% contesto, 80% finestra 5 ore) sono di Enzo, e un
margine le stringe. Questa voce resta in attesa della sua ratifica; nel frattempo la voce A2
(la regola del terzo momento di misura) procede senza dipendere da questo numero.

**Margine proposto: 1 punto percentuale.** Verdetto "⚠ A RIDOSSO" quindi da 74% a <75% di contesto
(o da 79% a <80% di finestra 5 ore), con lo stesso `exit 3` della soglia piena.
