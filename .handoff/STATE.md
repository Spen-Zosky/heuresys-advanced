# STATE — vista rapida

> Priorità e domande aperte. I numeri stanno in `docs/kb/SOT_STATE.md`, l'altra metà.

## Last session brief — l'ultima sessione, in breve

**S1079 — due consegne del lab eseguite, e in entrambe il controllo ha trovato più di quanto
la consegna dichiarasse.** `#225` (il `CLAUDE.md` diceva corrente un difetto risolto) e `#226`
(`D-STORIA-B`: la storia di RTL Bank diventa scorrevole) sono chiuse.

Il filo: **la prova che doveva chiudere la voce l'ha invece allargata, due volte su due.** Su
`#225` la ricerca dei numeri cristallizzati doveva confermare che ne restasse zero, e ne ha
trovati **tre** — il peggiore: il file dichiarava i tre documenti di stato `156+206+65 KB`,
misurati **837+390+132 KB**, e quel numero esiste per dire «non aprirli all'avvio». Su `#226`
la prova della potatura è uscita **rossa**: cancellava un rapporto di troppo, in silenzio.

Tre scelte della consegna `#226` sono state **rifiutate con la misura accanto**: l'orario (le
04:00 collidono con la prova di ripristino domenicale, che confronta i conteggi con la produzione
viva), dove mettere la protezione (sul comando, non solo sull'automatismo), e come leggere
l'interruttore (senza valore di scorta il lavoro notturno **fallirebbe** invece di fermarsi).

Le presenze di RTL Bank erano ferme al 14 agosto — l'unico allarme del sistema. Ora arrivano a
venerdì 21, il controllo di salute è verde, e da domani si aggiornano da sole.

## Top priorities — le priorità

1. **`#219` F5 — la corsa che chiude la voce.** Quattro fasi su cinque sono fatte e tutte
   verificate live; resta **la corsa integrale** della suite (100 spec, build di produzione) che
   deve riportare **zero falliti**, e solo allora la suite entra in CI secondo il criterio di
   `#211`. Non è lavoro di correzione: è tempo di macchina, e va aperta con spazio davanti.
   ⚠ Due casi *rovesciati* di F2 (su `platformAdmin`) non sono stati verificati live e cadono
   qui, insieme al caso `E` di F1.
   → `.programmi/219-otto-guasti-suite-e2e.md` · ~20k, in gran parte attesa
2. **`#132` F7 — l'input è arrivato (E30, 2026-08-24), e ha allargato la fase.** Enzo ha
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
ssh oracle-vm-default 'systemctl list-timers --all | grep storia36'   # devono essere DUE (#226)
```
