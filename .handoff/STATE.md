# STATE — vista rapida

> Priorità e domande aperte. I numeri (versioni, conteggi, architettura) stanno in
> `docs/kb/SOT_STATE.md`, che è l'altra metà e non ripete niente di quanto è scritto qui.

## Last session brief — l'ultima sessione, in breve

**S1075 — il dossier forense è diventato un programma.** Il dossier di heuresys-datastore
(88 rilievi sul governo dei dati esterni) è stato letto, verificato nei punti portanti e
trasformato in quattro ondate nel register (`#220`–`#223`, programma in
`.programmi/220-remediation-dossier-forense.md`). La verifica ha già pagato: due rilievi
ridimensionati (le purghe del catalogo formativo erano deliberate e versionate; il timer di
deploy non si sovrappone) e uno smentito a metà (la copia fuori sede dei backup **esiste**:
il pull notturno su linux-pc è attivo, con 7 dump misurati). Enzo ha deciso: NACE e crosswalk
rientrano, il PITR resta status quo (RPO 24h accettato), il registro datastore lo aggiorna la
CLI — le prime emende sono già applicate e il check del vault è verde.

## Top priorities — le priorità

1. **`#220` W1 remediation — messa in sicurezza.** Le 4 FK `CASCADE` che possono ri-azzerare
   il crosswalk, i ruoli read-only che leggono i segreti, logging e audit spenti. Sessione
   dedicata, metodo di bonifica per ogni voce.
   → `.programmi/220-remediation-dossier-forense.md` · ~1 sessione
2. **`#132` F7 — le due prove.** ⏸ **Aspetta te, e per una cosa sola**: approvare la prima
   fonte. La corsa di F4h ha già lasciato una proposta `PASSED` — Banca d'Italia. Decisa e
   applicata, i domini diventano ricercabili e F7 può girare.
   → `.programmi/132-ricerca-genera-il-modello.md` · ~1 sessione dopo lo sblocco
3. **`#221` W2 remediation — i recuperi approvati.** NACE + crosswalk rientrano (decisione
   2026-08-20), ma **solo dopo** W1.1: ripristinare sopra le FK `CASCADE` sarebbe rimettere
   il vaso sullo stesso bordo. Poi `#219` F1 (le due firme E2E, corta) fra le secondarie.

## Open questions — le domande aperte

1. **Il fornitore di proposte non è configurato in produzione.** Le due variabili
   (`RESEARCH_GATEWAY_URL` / `RESEARCH_GATEWAY_TOKEN`) vanno nel `.env` — che è tuo. Finché
   mancano, l'API dice «non c'è chi propone», ed è il comportamento voluto.
2. **`BACKUP_OFFHOST_SSH` nei due `.env`** (PC e VM): la lettura del `.env` PC è stata negata
   in sessione — il check va fatto in W1.7, o dimmi tu il valore. Non blocca: il pull da
   linux-pc copre già l'offsite.
3. **La suite E2E non entra in CI** (criterio `#211` F4: ~25 min). Entra quando `#219` porta
   i falliti a zero.

## Verification — la verifica

```bash
python docs/kb/tools/session_start.py          # menu + salute, un giro solo
python docs/kb/tools/guardiano.py              # contesto e finestra 5h, misurati
python docs/kb/tools/db_health.py              # le sentinelle, che devono stare a zero
bash scripts/verifica-deploy.sh                # com'è finita in produzione
```
