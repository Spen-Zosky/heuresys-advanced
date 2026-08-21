# STATE — vista rapida

> Priorità e domande aperte. I numeri (versioni, conteggi, architettura) stanno in
> `docs/kb/SOT_STATE.md`, che è l'altra metà e non ripete niente di quanto è scritto qui.

## Last session brief — l'ultima sessione, in breve

**S1076 — il dossier forense è stato eseguito, e in gran parte smentito.** Le quattro ondate
di remediation sono state aperte tutte: `#220` e `#221` **chiuse**, `#222` a 5 fasi su 7,
`#223` a 4 su 6. Ma il risultato che conta non sono le tredici migrazioni: è che **undici
rilievi su ventotto non erano ciò che dicevano**. NACE e il crosswalk non erano persi per
incidente — li aveva rimossi una migrazione deliberata con evidenza Eurostat; i vettori
"disallineati" combaciavano 14.036 su 14.036; le competenze isolate erano 4.467 e non 84; la
migrazione più lenta non era quella indicata; e i "111 legami nei metadati" erano 111 chiavi
**vuote**. Decisione di Enzo: il crosswalk si **deriva** da ATECO_2025 invece di reimportare
l'ibrido — ed è rientrato, 3.257 corrispondenze, senza far tornare la divisione 45 abolita.

Quattro prove sono **fallite prima di passare**, ed è il motivo per cui il lavoro regge: la
prova generale sul linux-pc ne ha prese tre (una alla seconda passata), e la quarta era un
audit che registrava anche gli update a vuoto. Trovato per strada un difetto che il dossier
non vedeva: la prossima sincronizzazione ESCO avrebbe **disfatto** la normalizzazione appena
fatta, perché il connettore salvava l'indirizzo di chiamata invece dell'identificativo.

## Top priorities — le priorità

1. **`#222` F6-07 — le 4.467 competenze isolate vogliono un piano proprio.** Il dossier ne
   contava 84: sono **4.467 su 14.036**, un terzo del catalogo senza alcun arco tassonomico.
   Non è una fase dentro un'altra voce, è curatela che va pianificata per sé.
   → `.programmi/222-remediation-w3-integrita-contenuti.md` · da decomporre
2. **`#223` F4 — l'unico riavvio rimasto.** `shared_buffers` a 128MB su 11GB, su una VM che
   ospita sette progetti: la memoria presa qui la si toglie a qualcun altro. Misura della RAM
   libera prima, poi il valore, poi un riavvio annunciato.
   → `.programmi/223-remediation-w4-pipeline-ruoli.md` · ~25k
3. **`#132` F7 — le due prove.** ⏸ **Aspetta te, e per una cosa sola**: approvare la prima
   fonte. La corsa di F4h ha già lasciato una proposta `PASSED` — Banca d'Italia. Decisa e
   applicata, i domini diventano ricercabili e F7 può girare.
   → `.programmi/132-ricerca-genera-il-modello.md` · ~1 sessione dopo lo sblocco

## Open questions — le domande aperte

1. **Il fornitore di proposte non è configurato in produzione.** Le due variabili
   (`RESEARCH_GATEWAY_URL` / `RESEARCH_GATEWAY_TOKEN`) vanno nel `.env` — che è tuo. Finché
   mancano, l'API dice «non c'è chi propone», ed è il comportamento voluto.

*(Chiusa in S1076: `BACKUP_OFFHOST_SSH` **deve restare vuota** — il push non è usabile perché
il linux-pc sta dietro NAT, e la direzione giusta è il pull, che è attivo.)*

## Verification — la verifica

```bash
python docs/kb/tools/session_start.py          # menu + salute, un giro solo
python docs/kb/tools/guardiano.py              # contesto e finestra 5h, misurati
python docs/kb/tools/db_health.py              # le sentinelle, che devono stare a zero
bash scripts/verifica-deploy.sh                # com'è finita in produzione
ssh oracle-vm-default 'bash -s' < deploy/postgres/prova-identita-app.sh   # le tre identità
```
