# «gov» — analisi di sicurezza del processo e piano di remediation

**Richiesta di Enzo, 2026-08-09**: trovare *tutti* i punti di debolezza del processo di una
sessione `gov`, e proporre una remediation **blindata**. Il criterio dichiarato: *«potrebbe
creare danni irreparabili e gravissimi, e questo non è accettabile»*. Più due requisiti
espliciti:

- **R-A** — ogni lavoratore deve avere le **identiche capacità** di una sessione canonica:
  monitoraggio, verifica, correzione, gate e cancelli, verifica di falsificabilità;
- **R-B** — un lavoratore **non può dichiarare conclusa** la sua corsa senza **evidenze di
  totale successo**;
- **R-C** — valutare debolezze, incoerenze e mancanze nei **file di configurazione**.

Tutto ciò che segue è **misurato** sul repo e sull'albero di lavoro reale il 2026-08-09, non
ragionato a memoria. Ogni riga ha un comando dietro.

---

## 1. Il modello di minaccia, in una frase

Un lavoratore è **una sessione Claude non presidiata, con `bypassPermissions`, dentro un
albero che contiene i segreti di produzione e punta al database di produzione**, avviata
automaticamente da un driver che può aprirne 2-3 insieme.

Non è un ambiente di prova. È l'ambiente vero, con un operatore automatico dentro.

---

## 2. Vulnerabilità trovate

Gravità: **C** = danno irreparabile · **G** = danno grave recuperabile · **M** = difetto di processo.

### V1 · [C] Nessuna lista di divieti nei permessi

**Misurato**: `.claude/settings.local.json` → `permissions` ha `allow` con **17 voci**,
`deny` con **0**, `ask` con **0**.

Con `bypassPermissions` (concesso oggi) e nessun divieto, un lavoratore può eseguire
qualunque comando: `pnpm db:reset`, `psql -c "DROP SCHEMA sys CASCADE"`, `rm -rf`,
`git push --force`, `docker`, `ssh` verso la VM. **Nulla lo impedisce.**

Non è ipotesi: `bypassPermissions` significa esattamente «non chiedere».

### V2 · [C] Il lavoratore scrive sul database di **produzione**

**Misurato**: `.env` del repo e `.env` dell'albero `w1` sono identici —
`POSTGRES_HOST=localhost`, `POSTGRES_PORT=5433`, cioè il tunnel verso la VM.

L'albero di lavoro isola **i file**, non **i dati**. Un lavoratore che sbaglia una `DELETE`
tocca i 162 utenti veri, le 5.641 buste paga, i due tenant di produzione. Un `db:reset`
sarebbe irreversibile senza ripristino da backup.

Nota: nella quarta corsa **sei righe misurate sono sparite** e non ho potuto stabilire se le
avesse cancellate il lavoratore. Con V2 aperta, la risposta «probabilmente sì» è plausibile.

### V3 · [C] Il recinto filtra gli strumenti di scrittura, **non i comandi**

**È il buco nel lavoro appena fatto, e va detto per primo.** `gov_worker_guard.recinto`
intercetta `Write`/`Edit`/`NotebookEdit`/`MultiEdit`. Un lavoratore con `bypassPermissions`
scrive dove vuole con:

```bash
sed -i 's/x/y/' apps/web/qualsiasi.tsx      # fuori perimetro, non filtrato
cat > /qualunque/percorso <<'EOF' ... EOF   # idem
python -c "open('...','w').write(...)"      # idem
git checkout -- .                            # distrugge il lavoro, non filtrato
```

Il recinto oggi ferma il modo *educato* di uscire dal perimetro, non quello *efficace*.

### V4 · [C] Il lavoratore può pubblicare su GitHub

**Misurato**: `git remote -v` nell'albero mostra `origin` con URL di push, e
`git config credential.helper` → `manager`, cioè le credenziali dell'utente valgono anche lì.

`git checkout main` dentro l'albero è impedito da git (main è occupato dal repo principale) —
ma **`git push origin gov/w1:main` no**. Un push su `main` **arma il deploy in produzione**
tramite il watcher: è la catena che porta al danno irreparabile più veloce.

### V5 · [C] Il lavoratore ha in mano i segreti

**Misurato**: l'albero contiene `.secrets/` (**6 file**) e `.env`, copiati dalla preparazione.
Sono necessari per lavorare, ma oggi nulla impedisce a un lavoratore di trascriverli in un
file, in un commit, o in un messaggio di esito — che finisce nel giornale e nei log.

### V6 · [G] Il lavoratore può cancellare il proprio diario

`SEMPRE_CONCESSI` include `.zp/`, perché il lavoratore deve poter scrivere il proprio esito.
Ma il diario **vive lì dentro**: `rm -f .zp/diario.ndjson` lo cancella, e con V3 il comando
non è nemmeno filtrato. **Un registro che il sorvegliato può cancellare non è una prova.**

### V7 · [G] «Conclusa» è una parola del lavoratore, non un fatto verificato

Il lavoratore scrive `{"outcome": "cluster-closed"}` e il driver **gli crede**. Nessuno
esegue i gate sul suo ramo, nessuno confronta ciò che dichiara con ciò che il diario mostra,
nessuno verifica che le prove citate esistano e siano falsificabili. È esattamente **R-B**.

### V8 · [G] Il lavoratore non ha le capacità di una sessione canonica

**Misurato**: il cancello di verifica **si applica** (una sessione senza marcatore è
`canonical`, e `cancello_di_verifica_si_applica` → `True`). Questo è il pezzo che funziona.
Ma mancano gli altri: il briefing di sessione canonica (le regole del progetto, la
Definition of Done, il metodo di bonifica), l'hook di avvio con lo stato di infrastruttura,
e soprattutto **nessuna istruzione gli impone la falsificabilità delle prove**. È **R-A**.

### V9 · [G] Il tetto di spesa tronca invece di proteggere

Già rilevato da Enzo. **Misurato**: `Z-112` costato $11,17 su un tetto di $12 **senza
finire**; `Z-230` $5,15, idem. Un lavoro troncato a metà **lascia il ramo in uno stato
intermedio** che nessuno ha verificato — e con V7 può comunque essere dichiarato chiuso.

### V10 · [M] Nessun consuntivo di ciò che è stato realmente toccato

Il driver non confronta, a fine giro, i file modificati con il perimetro. Se il recinto
manca qualcosa (V3), **nessuno se ne accorge**.

### V11 · [M] Incoerenze nei file di configurazione

- **`permissions.deny` assente** (V1). Il file ha solo `allow`, che con `bypassPermissions`
  è decorativo.
- **`bypassPermissions` non era dichiarato in nessun file** fino a oggi: il driver aveva
  `acceptEdits` **scritto nel codice**, non in configurazione. È il rilievo di Enzo — una
  scelta di sicurezza che viveva in una riga di script.
- **`.claude/settings.local.json` è tracciato da git**: è il motivo per cui gli hook arrivano
  nell'albero (bene), ma significa anche che un lavoratore **può modificarlo** — e con V3
  può farlo senza passare dal recinto. **Un sorvegliato che può riscrivere le regole della
  sorveglianza.**
- **Nessuna separazione fra la configurazione del repo e quella del lavoratore**: oggi sono
  lo stesso file.

---

## 3. Piano di remediation

Principio guida: **ogni difesa deve stare fuori dalla portata del sorvegliato**. Un divieto
che il lavoratore può togliere non è un divieto.

### Fase A — le tre voragini (nessuna corsa prima che siano chiuse)

| id | rimedio | chiude | come si verifica |
|---|---|---|---|
| **A1** | **Lista di divieti esplicita** in configurazione: `psql` con verbi di scrittura, `db:*`, `rm -rf`, `git push`, `git reset --hard`, `git checkout --`, `docker`, `ssh`, `curl` verso host esterni, `close-propagate`, `vm-deploy`, `align-clones`. Con **`ask` vuoto**: in una sessione non presidiata «chiedere» equivale a bloccare | V1 V4 | una batteria che tenta ognuno dei comandi vietati e verifica il rifiuto |
| **A2** | **Il recinto passa dai comandi**, non solo dagli strumenti di scrittura: si analizza la riga di comando (redirezioni, `sed -i`, `tee`, `cp/mv`, interpreti con `-c`) e si rifiuta se il bersaglio è fuori perimetro. Stessa dottrina del `lab-guard`, che questa analisi già fa | V3 | iniezione dei cinque modi di scrivere aggirando Write |
| **A3** | **Il database non è più quello di produzione**: il lavoratore riceve un `.env` che punta a un **clone**, non al tunnel. Se un cluster richiede il DB vero, **non è di classe A/B** e non appartiene alla corsia non presidiata | V2 | il `.env` dell'albero differisce da quello del repo su host/porta/nome, verificato prima di ogni corsa |

### Fase B — le prove che il lavoratore non può falsificare

| id | rimedio | chiude | come si verifica |
|---|---|---|---|
| **B1** | **Il diario esce dall'albero**: si scrive in `<padre>/heuresys-gov-diari/<cluster>-<giro>.ndjson`, fuori dalla portata del recinto e dal perimetro del lavoratore. In più il file è **append-only per costruzione** (apertura in `a`, mai `w`) e il driver ne prende un'impronta prima e dopo | V6 | il lavoratore prova a cancellarlo e il diario sopravvive; l'impronta cambia solo per aggiunta |
| **B2** | **Consuntivo obbligatorio a fine giro**: il driver confronta `git diff --name-only` del ramo con il perimetro dichiarato e **rifiuta l'esito** se c'è anche un solo file fuori. L'esito diventa `blocked-fuori-perimetro` | V3 V10 | si fa uscire un finto lavoratore dal perimetro e si verifica che il giro non chiuda in verde |
| **B3** | **La chiusura la esegue gov, non il lavoratore**: `gov chiudi <n>` gira sul ramo ed esegue typecheck, lint, test, `zp_gate`, `verify_gate` e `zp_evidence`. Il verdetto è **di gov**; il lavoratore può solo *proporre*. Nessun `cluster-closed` è accettato senza verdetto verde | V7 R-B | un ramo con un test rosso non ottiene il verdetto verde |
| **B4** | **Le evidenze devono essere falsificabili**: si riusa `zp_evidence` (che già rifiuta `echo`/`printf`/`true` come prova e pretende coppie di livelli diversi). Un esito senza evidenze ammesse è `blocked` | V7 R-B | una prova finta viene rifiutata |

### Fase C — parità di capacità col canonico (R-A)

| id | rimedio | chiude | come si verifica |
|---|---|---|---|
| **C1** | **Briefing di lavoratore**: l'hook consegna al lavoratore, all'apertura, le stesse regole che una sessione canonica riceve — Definition of Done, metodo di bonifica, «le prove devono poter fallire» — più il suo incarico e il perimetro. Non è prosa nel prompt del driver: è un hook, come per `gov` | R-A | il briefing arriva, misurato sul payload reale |
| **C2** | **Stesso cancello, stesse sentinelle**: verificare che `verify_gate` giri davvero a fine turno del lavoratore (oggi si applica per default, ma non è mai stato osservato in una corsa) e che il suo verdetto sia leggibile da gov | R-A V8 | si osserva il verdetto nel diario di una corsa vera |
| **C3** | **Capacità di correzione**: un lavoratore che trova un rosso deve poterlo correggere **dentro il perimetro**; se il rosso è fuori, si ferma e lo dichiara. Oggi non c'è istruzione in merito | R-A | un caso costruito con un rosso fuori perimetro |

### Fase D — il budget dal dato (V9)

| id | rimedio | come si verifica |
|---|---|---|
| **D1** | **Storico costo↔effort**: ogni corsa registra costo reale, effort dichiarato, esito. `zp_state costo <cluster>` stima dal misurato | la stima esiste dopo N corse, e dice «non ho dati» quando non ne ha |
| **D2** | **Tetto derivato, con margine**: il tetto per cluster = stima × margine, mai un numero fisso. Un cluster la cui stima supera il tetto della corsa **non parte**, invece di partire e troncarsi a metà | un cluster troppo caro viene escluso prima, con il motivo |

### Fase E — la configurazione (R-C, V11)

| id | rimedio | come si verifica |
|---|---|---|
| **E1** | **La configurazione del lavoratore esce dal repo**: gli hook e i divieti che governano un lavoratore stanno in un file che il lavoratore **non può modificare** (fuori dall'albero, o in sola lettura). Oggi `.claude/settings.local.json` è nell'albero e scrivibile | il lavoratore prova a riscriverlo e non ci riesce |
| **E2** | **Ogni scelta di sicurezza in configurazione, mai nel codice**: come già fatto per `permessi.modalita_lavoratore`, così per i divieti, il database, il tetto | nessun valore di sicurezza resta scritto in uno script |
| **E3** | **Un controllo di coerenza prima di ogni corsa**: il driver verifica che i divieti ci siano, che il database non sia quello di produzione, che il diario sia fuori dall'albero. Se una condizione manca, **non parte** | si toglie una condizione per volta e la corsa si rifiuta, dicendo quale |

---

## 4. Regola d'ordine

**Nessuna corsa fino a A1+A2+A3.** Sono le tre che, oggi, rendono possibile un danno
irreparabile. B e C rendono il risultato affidabile; D e E lo rendono sostenibile — ma un
risultato inaffidabile è un problema, un database di produzione perso è un'altra cosa.

## 5. Cosa questa analisi NON dice

Non ho verificato se un lavoratore **abbia effettivamente** tentato una di queste azioni: il
diario esiste da un'ora e le corse sono avvenute prima. Le sei righe sparite nella quarta
corsa restano **non attribuite** — e resteranno tali, perché non esisteva un registro.
