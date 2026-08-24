# STATE — vista rapida

> Priorità e domande aperte. I numeri stanno in `docs/kb/SOT_STATE.md`, l'altra metà.

## Last session brief — l'ultima sessione, in breve

**S1078 — cinque voci chiuse, e il filo che le lega: nove volte su nove, la diagnosi scritta
nel registro indicava il bersaglio sbagliato.** Chiusi i due debiti che mordevano a ogni
chiusura (D-87 il cancello del deploy, D-86 il clone che non rifletteva i ritiri), la voce
`#224` sul fuso, le prove live dei quattro perimetri dell'agente con la sua fase F4, e tre
delle cinque fasi di `#219`.

Il filo non è il numero di voci: è **quante volte una firma d'errore ha nascosto un'altra
causa**. Il rosso «il clone diverge» nascondeva un censimento **cieco per privilegi**, che una
tabella ritirata senza indici avrebbe superato indisturbato. Il rosso «la spiegabilità non
rende» nascondeva **una pagina che si rompeva** per chi ha il profilo tecnico. Il rosso
«l'editor non si apre» era «il pulsante non c'è», perché la tabella è paginata da mesi. E il
caso di accessibilità **era verde per vuoto**: gli ho iniettato di proposito una violazione
grave ed è rimasto verde, perché esaminava 17 elementi di una pagina ferma su «Caricamento…».

La regola che ha pagato ogni volta è già scritta nel piano di `#219`: **sono firme, non cause —
si riproduce prima di correggere.** Due volte ha smascherato un difetto dei miei stessi
strumenti, non del prodotto.

## Top priorities — le priorità

1. **`#219` F5 — la corsa che chiude la voce.** Quattro fasi su cinque sono fatte e tutte
   verificate live; resta **la corsa integrale** della suite (100 spec, build di produzione) che
   deve riportare **zero falliti**, e solo allora la suite entra in CI secondo il criterio di
   `#211`. Non è lavoro di correzione: è tempo di macchina, e va aperta con spazio davanti.
   ⚠ Due casi *rovesciati* di F2 (su `platformAdmin`) non sono stati verificati live e cadono
   qui, insieme al caso `E` di F1.
   → `.programmi/219-otto-guasti-suite-e2e.md` · ~20k, in gran parte attesa
2. **`#132` F7 — ✅ l'input è arrivato (E30, 2026-08-24), e ha allargato la fase.** Enzo ha
   approvato Banca d'Italia **a condizione che il tenant sia di tipologia Banca**. Misurato:
   `sys_research_sources` è vuota e **non ha alcun campo che leghi una fonte a un settore** —
   quindi F7 non è più «approva e applica», è *approva, **costruisci il vincolo di
   pertinenza**, applica*. Inserire la riga senza il vincolo tradirebbe la decisione.
   **Sblocca `#198` T9b**, ferma per misura: le tabelle di contenuto sono vuote.
   → `.programmi/132-ricerca-genera-il-modello.md` · ~1 sessione
3. **`#222` F6-07 — le 4.467 competenze isolate vogliono un piano proprio.** Il dossier ne
   contava 84: sono un terzo del catalogo senza alcun arco tassonomico. Non è una fase dentro
   un'altra voce, è curatela che va pianificata per sé.
   → `.programmi/222-remediation-w3-integrita-contenuti.md` · da decomporre

## Open questions — le domande aperte

1. **Il fornitore di proposte non è configurato in produzione.** Le due variabili
   (`RESEARCH_GATEWAY_URL` / `RESEARCH_GATEWAY_TOKEN`) vanno nel `.env` — che è tuo. Finché
   mancano, l'API dice «non c'è chi propone», ed è il comportamento voluto.
2. **Sulla VM c'è una vecchia unit di servizio lasciata accanto a quella viva**
   (`heuresys-advanced-web.service.dev.bak`, in modalità *sviluppo*). È **inerte** — verificato,
   il sistema non la carica — ma è configurazione di un servizio di produzione e non l'ho
   toccata. Si sposta, si tiene, o si lascia dov'è?
3. **Vuoi che i moduli-catalogo prendano un permesso di lettura proprio?** Le tassonomie
   (competenze, famiglie professionali, alias, livelli) sono leggibili da **chiunque sia
   autenticato**: misurato, `skill_taxonomy:read` e `job_family:read` **non esistono**, mentre
   le scritture hanno il loro. Ho deciso di **non** crearli — un permesso che nessuno può non
   avere non discrimina niente, e l'apertura è coerente con I21 e I17 — ma se la vuoi diversa
   si fa.

## Verification — la verifica

```bash
python docs/kb/tools/session_start.py          # menu + salute, un giro solo
python docs/kb/tools/guardiano.py              # contesto e finestra 5h, misurati
python docs/kb/tools/db_health.py              # le sentinelle, che devono stare a zero
bash scripts/verifica-deploy.sh                # com'è finita in produzione
bash db/scripts/storia36.sh custodia           # ora verde ovunque, e a qualunque fuso (#224)
```
