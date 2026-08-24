# 226 — La storia di RTL diventa scorrevole: l'avanzamento va schedulato, e solo dove il database e' quello vero

> **item**: #226
> **stato**: IN CORSO (S1079, 2026-08-24)
> **lab-id**: 2026-08-24-presenze-ferme-avanzamento-non-schedulato

## Decisione vincolante (non si ri-chiede)

**Enzo, 2026-08-24 — `D-STORIA-B`.** Alla domanda *«la storia di RTL si ferma alla finestra
dichiarata, o continua ad avanzare?»* la risposta e' **B: si schedula l'avanzamento**. La storia
di RTL Bank diventa **scorrevole**: arriva sempre a ieri. La finestra `2023-08-01 → 2026-07-31`
**cessa di essere una fine** e resta la **finestra di costruzione**.

**Ragione**: RTL Bank e' l'azienda che si mostra. Presenze ferme a due settimane fa la fanno
sembrare rotta anche quando e' sana, ed e' il primo posto dove si guarda per capire se il sistema
e' vivo.

## Il sintomo, misurato in S1079

`db_health.py` → 1 allarme, l'unico: *«giorni dall'ultimo dato: presenze — 10»*, soglia 7.
Sul gemello: `max(attendance_date) = 2026-08-14`, `count = 118.360`. Fermo, non rotto.

## La causa

Il timer settimanale esegue **`custodia`**, non `avanzamento`. `custodia` verifica **proprieta'**
(coerenza, integrita') ed e' verde perche' cio' che c'e' e' sano; `db_health` verifica la
**freschezza** ed e' rosso perche' non arriva piu' niente. C'era un automatismo per la prima
domanda e **nessuno** per la seconda.

## Le quattro decisioni tecniche

### ① Cadenza giornaliera — ma alle **03:45**, non alle 04:00 (deviazione dalla consegna)

La consegna proponeva 04:00 guardando la sola custodia delle 04:30. **Griglia completa misurata**
(`grep OnCalendar deploy/systemd/*.timer`): sulla VM **`dr-drill` gira `Sun 04:00`**, e
`scripts/dr-drill.sh:57-63` fa `pg_restore` di un dump intero in un DB scratch **sulla stessa
istanza**, poi **confronta i conteggi dello scratch con quelli della produzione VIVA**.

Un avanzamento che scrive in quel momento produrrebbe uno scostamento **sistematico ogni
domenica** — un WARN ricorrente, cioe' esattamente il difetto che la consegna dichiara di voler
evitare (*«un allarme a intermittenza e' un allarme che si smette di guardare»*).

**03:45** e' libero tutti i giorni tranne la coda dello scraping domenicale (Sun 03:30, che scrive
su `reference_sync`, non su `sys.*`), e resta prima della custodia delle 04:30.

Perche' comunque **giornaliera** e non settimanale: la custodia sulla VM dura **43 secondi**
(journal: ExecMainStart 04:31:10 → Exit 04:31:53), e con cadenza settimanale la distanza
dall'ultimo dato toccherebbe 7 giorni — la soglia — ogni fine settimana.

### ② La guardia: `STORIA36_AVANZAMENTO=1` nel `.env` della macchina

`vm-deploy.sh:268-278` installa **e abilita** ogni unit di `deploy/systemd/` su **entrambe** le
macchine (glob non ricorsivo). Sul gemello `storia36.sh` prende il bersaglio dal `.env` locale
(righe 44-52) e scriverebbe **nel clone**, che `clone-vm-db.sh` sovrascrive e che deve restare
1:1 con la produzione — un clone che si scrive la propria storia diverge (specie di **D-86**).

**Non** un controllo sul nome della macchina: sarebbe **D-39** un'altra volta. Il default e' **non
scrivere**: una macchina nuova non comincia da se' ad allungare una storia.

**Deviazione D2 — la guardia sta sul modo `avanzamento`, con bypass `--forza`**, non su un modo
schedulato separato. `avanzamento` e' un comando **documentato nel CLAUDE.md**: ci si arriva anche
per copia-incolla sulla macchina sbagliata, e una guardia che copre solo il timer lascia aperta la
strada piu' probabile per un errore umano. `--forza` va scritto a mano, quindi non diventa
un'abitudine.

**Deviazione D3 — `${STORIA36_AVANZAMENTO:-0}`, mai il riferimento nudo.** Lo script ha
`set -euo pipefail`: un riferimento a una variabile assente **abortirebbe con exit != 0**, e un
timer fallito ogni notte sul gemello e' proprio il rumore che questa guardia deve evitare.

### ③ La custodia settimanale resta

Se l'avanzamento fallisce presto, la custodia **dentro di esso** non viene mai eseguita: togliendo
il timer settimanale, il presidio d'integrita' sparirebbe esattamente nel giorno in cui serve.

### ④ Cosa non si rompe avanzando per sempre

`verify-storia36.sql:4109` tratta la finestra come **limite inferiore** (`v_max < DATE
'2026-07-31'` fallisce se il calendario non ci **arriva**), e il commento sopra lo dichiara:
*«proprieta', non fotografia: il massimo puo' crescere»*. Il caso limite e' gia' stato curato:
`13_avanzamento.sql:590-604` racconta le 5 abilitazioni scadute quando la frontiera si sposto' al
2026-08-07, e la regola dei rinnovi riparte dall'**ultimo anello**.

**Retention**: la cadenza giornaliera produce ~30 report `qa_artifacts/storia36/custodia-*.md` al
mese. Sono gitignored (`.gitignore:123`), quindi non sporcano l'albero, ma crescono senza fine:
si tengono gli **ultimi 30**.

## Le tre prove che devono poter fallire

1. **Sul gemello**, senza la variabile: l'unit esce **0 senza scrivere**, e `max(attendance_date)`
   sul clone non si muove (baseline: `2026-08-14`, 118.360 righe). Se si muove, la guardia non
   guarda cio' che credo.
2. **Sulla VM**, dopo la prima corsa: `db_health.py` esce **0** con la sonda delle presenze verde.
   Se restasse rossa, l'avanzamento non ha scritto le presenze e la causa e' un'altra.
3. **Idempotenza**: due corse di fila, la seconda a **delta zero**. Se scrive, l'idempotenza non
   regge sulla finestra mobile.

## Reperto che la consegna non nomina

Esiste gia' `deploy/systemd/solo-linux-pc/` con un README che documenta la dottrina delle unit
machine-specific: una sottodirectory le tiene fuori dal glob di `vm-deploy`. **Non creo il gemello
`solo-vm/`**: la guardia nel `.env` e' piu' forte della collocazione, perche' protegge **anche**
l'invocazione a mano, che una sottodirectory non tocca.

## Chiuso quando

Il timer giornaliero esiste ed e' attivo su entrambe le macchine ma **scrive solo sulla VM**
(verificato con `systemctl` e con la prova 1) · `db_health` esce 0 · la seconda corsa e' a delta
zero · `D-STORIA-B` e' registrata dove la finestra e' dichiarata (`.storia36/PROGRESS.md` e il
piano storia36).
