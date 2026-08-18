# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-18 (S1069).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`.

⚠ **IL MOTORE HA COSTRUITO DAVVERO, E COSTRUISCE ANCORA UNA BANCA.** `#198` T9a è fatto: due
aziende create sul gemello dall'archetipo `RETAIL_BANK_REFERENCE`, ogni riga con la sua origine.
Ma la sorgente resta l'archetipo — **7 unità e 11 posizioni** contro le **158** di RTL vera, e la
copertura del metro misurata è **7,6%**. Un fascicolo di qualunque settore produrrebbe quella
banca: è la ragione di `#132`, e ora è un numero e non più un'impressione.

## Last session brief (S1069 «tre difetti che nessun test vedeva, e tre voci invisibili al menu»)

Il filo della sessione: **ciò che nessuno esegue non è verificato**. Tre difetti veri sono
emersi solo costruendo e deployando per davvero, e tre voci del backlog erano invisibili al menu
per tre cause diverse.

**Chiuse**: `#216` (il menu ora spiega e l'avanzamento si deriva) · `#215` (le 29 classificazioni
riclassificate, tre copie morte rimosse) · `#197` (il controllo incrociato esiste e trova la
differenza). **Avanzate**: `#198` T9a · `#211` F2. **Aperta**: `#217`, la riprogettazione del
flusso di chiusura, con I1/I2 già fatti.

⚠ **TRE DIFETTI DEL TENANT BUILDER, invisibili ai test perché nessuno costruiva** — per esteso
nel referto in `.programmi/198-tenant-builder-p3-costruzione.md`. Il peggiore: le competenze
nascevano senza categoria, e a romperlo era il **deploy successivo**. Un difetto che non rompe
ciò che lo produce è il più difficile da attribuire.

⚠ **TRE MODI DI SPARIRE DAL MENU, tutti curati** (cancelli `S5`, `S3`, `T3`): la parentetica dopo
il titolo · la voce fuori dalla sezione taggata · e `priority` col grassetto, che rendeva
invisibili tre voci P1.

⚠ **LE PROVE SONO NATE FALSE QUATTRO VOLTE**, ogni volta per una ragione diversa, e tutte trovate
**sabotando** invece che rileggendo. È il metodo, non un incidente.

## Top priorities (prossima sessione)

1. **`#217` I3 e I4 — il flusso di chiusura.** Il piano è scritto e ordinato
   (`.programmi/217-flusso-di-chiusura.md`). I3 toglie l'attesa della CI dalla chiusura — è il
   guadagno grosso, e la contraddizione è **una riga**: `vm-deploy.sh:81` usa `ci-gate`
   bloccante mentre `deploy-watch` usa lo stesso gate in modalità non bloccante, **verificato
   sul campo** dal journal del gemello. I4 toglie il buco per cui `refs/heads/prod` resta
   indietro quando si usa `align-clones` direttamente.
2. **`#198` T9b — la costruzione in produzione (E20).** Non è più bloccata: il push è stato
   autorizzato, la produzione gira il codice corretto, la catena è verde. ⚠ Va lanciata **dopo**
   aver verificato che il commit della categoria sia in produzione, o si ricrea lo stato che ha
   fermato la catena.
3. **`#211` F3 — le famiglie ②③④⑤⑥ della suite E2E** (18 casi). La domanda sugli 80 non eseguiti
   ha risposta: 74 sono strumenti a comando, 6 si dichiarano ciechi, e nessuno dei sei nasconde
   un dato che dovrebbe esserci.

## Open questions

- **Il residuo che la suite E2E lascia in produzione.** Una «Famiglia di collaudo» creata da un
  test e mai ripulita ha **fatto fallire un deploy** (post-condizione della `000255`). L'ho
  rimossa, ma la suite non ha un controllo di drift come quella API: è una voce da aprire, o un
  capitolo di `#181`.
- **`sys_compensation_bands` ospita 29 righe che non sono bande** (contratti e sigle senza
  importi): una tabella che porta due specie. Nominato in `#215`, non bonificato di passaggio.
- ~~**`apps/web/next-env.d.ts`** oscilla fra build di sviluppo e produzione~~ — **CHIUSA S1070**:
  il file e' generato da Next e cambia con la modalita' di build, quindi non va tracciato. Ignorato
  in `.gitignore` e tolto dall'indice in entrambi i workspace, dopo aver misurato che il typecheck
  di `web` **e** di `showcase` esce 0 senza di lui e senza `.next/` — e che la stessa prova esce 2
  con un errore deliberato, quindi vede.

## Stato delle macchine (misurato a fine S1069)

`main` == `refs/heads/prod` == **`e51d5b17`** · produzione **deployata e verde**
(`api /readyz OK`, `web /login 200`) · timer di deploy **attivi** su VM e linux-pc, che si
allineano da sé al tick successivo. La chiusura ha **armato e basta**, senza aspettare la CI:
è la prima applicazione della dottrina che Enzo ha scelto il 2026-08-18.

## Verification

I numeri non si scrivono qui: si scrive il comando che li produce (⭐ PUNTO FISSO).

```bash
python docs/kb/tools/session_start.py        # menu + salute, un solo giro
python docs/kb/tools/guardiano.py            # contesto e finestra 5h, misurati
python docs/kb/tools/handoff_lint.py         # coerenza di stato e register (bloccante)
python docs/kb/tools/programmi.py --verifica # integrità dei piani multi-sessione
bash scripts/test/run-shell-tests.sh         # la batteria degli script di servizio
bash scripts/verifica-deploy.sh              # cosa gira DAVVERO sulle macchine
```

Ultima corsa della batteria degli script: **165 ok / 0 failed** (erano 141 a inizio sessione;
24 controlli nuovi, fra cui `S5`, `T3` e le due prove del marcatore).
