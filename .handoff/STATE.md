# STATE — vista rapida

> Priorità e domande aperte. I numeri (versioni, conteggi, architettura) stanno in
> `docs/kb/SOT_STATE.md`, che è l'altra metà e non ripete niente di quanto è scritto qui.

## Last session brief — l'ultima sessione, in breve

**S1077 — corsa autonoma su mandato in blocco: dieci voci su dieci, e tre errori che valgono
quanto il lavoro.** Chiuse per intero le due ondate di remediation rimaste (`#222` W3 e `#223`
W4), più la manutenzione, il quarto perimetro dell'agente e i due presidi continuativi.

Il filo che tiene insieme la sessione è **una sola forma d'errore, incontrata tre volte**: una
misura vera che porta a una conclusione falsa. Il rosso «orologio fuori di 11s» era la latenza
del tunnel — lo strumento misurava sé stesso. Sul secondo fattore ho concluso dal *default* del
codice che fosse attivo in produzione: è spento, e a dirlo il falso era un **commento** che
descriveva l'intenzione mentre chi lo leggeva ne deduceva la configurazione. Sui pesi ho
misurato i valori presenti (tutti sotto 1) e ne ho dedotto il dominio ammesso: il contratto
diceva `max(10)`, e la CI mi ha smentito in venti minuti. Ogni volta la correzione è stata
scritta **accanto al codice**, non solo nel commit.

Il lavoro più utile non era in programma: tre competenze esistevano **in doppio** — una globale
e una residuo del brownfield — e le prove delle persone stavano spalmate fra le due, così chi
contava dalla riga canonica ne vedeva un quarto. Fuse, con un giornale di annullamento provato
davvero. E i due allarmi fermi da giorni sulla VM erano **tre** guasti: uno l'ha nascosto
l'altro.

## Top priorities — le priorità

1. **`#224` — un controllo che cambia verdetto a seconda di dove lo lanci.** La custodia della
   storia è verde in produzione e rossa sul gemello **con gli stessi dati**: il check fa
   `timestamptz::date` e quindi dipende dal fuso della sessione. La conseguenza è scomoda e va
   accettata: sistemandolo, sette eventi diventano rossi **anche in produzione**, ed è corretto.
   Ordine obbligato — prima i dati e chi li genera, poi il controllo.
   → `.programmi/224-check-non-deterministico-fuso.md` · ~40-60k
2. **`#222` F6-07 — le 4.467 competenze isolate vogliono un piano proprio.** Il dossier ne
   contava 84: sono un terzo del catalogo senza alcun arco tassonomico. Non è una fase dentro
   un'altra voce, è curatela che va pianificata per sé.
   → `.programmi/222-remediation-w3-integrita-contenuti.md` · da decomporre
3. **`#132` F7 — le due prove.** ⏸ **Aspetta te, e per una cosa sola**: approvare la prima
   fonte. La corsa di F4h ha già lasciato una proposta `PASSED` — Banca d'Italia. Decisa e
   applicata, i domini diventano ricercabili e F7 può girare.
   → `.programmi/132-ricerca-genera-il-modello.md` · ~1 sessione dopo lo sblocco

## Open questions — le domande aperte

1. **Il fornitore di proposte non è configurato in produzione.** Le due variabili
   (`RESEARCH_GATEWAY_URL` / `RESEARCH_GATEWAY_TOKEN`) vanno nel `.env` — che è tuo. Finché
   mancano, l'API dice «non c'è chi propone», ed è il comportamento voluto.
2. **Sulla VM c'è una vecchia unit di servizio lasciata accanto a quella viva**
   (`heuresys-advanced-web.service.dev.bak`, in modalità *sviluppo*). È **inerte** — verificato,
   il sistema non la carica — ma è configurazione di un servizio di produzione e non l'ho
   toccata. Si sposta, si tiene, o si lascia dov'è?
3. **La prova live del quarto perimetro dell'agente non è stata eseguita.** L'apertura di
   `content` è registrata e la mappa lo dimostra (24 operazioni), ma la dimostrazione end-to-end
   pretende gateway e API avviati più una corsa dell'agente: è il primo passo del prossimo giro.

## Verification — la verifica

```bash
python docs/kb/tools/session_start.py          # menu + salute, un giro solo
python docs/kb/tools/guardiano.py              # contesto e finestra 5h, misurati
python docs/kb/tools/db_health.py              # le sentinelle, che devono stare a zero
bash scripts/verifica-deploy.sh                # com'è finita in produzione
bash db/scripts/storia36.sh custodia           # verde qui, rossa sul gemello → #224
```
