# STATE — vista rapida

*Ultimo aggiornamento: chiusura S1088 (2026-09-06). I numeri stanno in `docs/kb/SOT_STATE.md`, non qui.*

## Last session brief — l'ultima sessione, in breve

Una sola voce, `#219` F5e, e il filo conduttore è che **la firma di un errore non è la sua
causa**: quarantadue casi rossi che tre sessioni avevano attribuito ai permessi erano in
realtà l'API che rifiutava l'**indirizzo da cui il browser dei test le parlava**. Le due
cose rispondono con lo stesso codice, e per questo nessuno le aveva distinte.

La prova è venuta da una richiesta che non ha permessi da controllare: se anche quella
viene rifiutata, il colpevole non può essere un permesso. Corretta la configurazione,
la corsa integrale è passata **da 42 falliti a 6**, e la famiglia che ne produceva più di
un terzo è sparita del tutto.

⚠ Sono cadute **quattro** spiegazioni precedenti, tutte plausibili e tutte sbagliate: il
lavoro notturno della VM, il tunnel, l'API spenta, il bundle vecchio. Ognuna era stata
scritta come conclusione.

## Top priorities — le priorità

1. **`#219` F5e — i sei residui** (~1 sessione). Nessuno è una scrittura negata, quindi
   sono guasti di natura diversa fra loro. ⚠ **`session-refresh` per primo**: prova il
   rinnovo silenzioso della sessione, cioè la stessa rotta al centro della diagnosi di
   ieri — che fallisse anche prima non lo assolve. Triage pronto in
   `.programmi/219-triage-2026-09-06-dopo-correzione.txt`. Solo a zero falliti la suite
   entra in CI, che è ciò che chiude la voce.
2. **`#54` F3 — le quattro fette che restano** (~2 sessioni). Pattern rodato, le prossime
   costano meno della prima.
3. **`#246` — i contratti a termine** (~1 sessione). La regola l'ha già decisa Enzo: niente
   contratto a termine sopra i 12 mesi di anzianità, a 16 si passa a indeterminato.

## Open questions — le domande aperte

- ⭐ **Da quali fonti la piattaforma accetta di imparare com'è fatta un'azienda?** — unità
  organizzative, posizioni, competenze, indicatori. Il registro delle fonti ne porta **una
  sola**, sul dominio dei processi. Tre voci ferme qui (`#198`, `#205`, il ponte di `#132`).
  Non è una misura: è cosa Heuresys accetta come sapere, e i piani vietano di scriverlo a mano.
- **Chi ha pushato il 26 agosto alle 18:47?** Invariata da S1082.
- *Nuova*: **`/v1/auth/refresh` è protetto dal presidio che serve a rinnovare.** Se il token
  si disallinea, il rimedio è chiuso a chiave dal problema che dovrebbe curare. Ieri non era
  questo il guasto, ma il disegno resta così — vale la pena deciderlo prima che lo diventi.

## Verification — come si controlla

```bash
python docs/kb/tools/session_start.py       # menu + salute, un solo giro
bash scripts/verifica-deploy.sh             # DEPLOYATO · IN-VOLO · CI-ROSSA · DISALLINEATO · NON-VERIFICATO
ssh linux-pc 'cat /proc/loadavg'            # prima di ogni corsa E2E: sotto 2, o i rossi non sono attribuibili
cd apps/web && node scripts/e2e-blocchi.mjs --solo-preflight   # 0 = l'ambiente e' quello che la suite presume
cd apps/web && node scripts/e2e-triage.mjs --dettaglio 1       # i falliti raggruppati per firma
```
