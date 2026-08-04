# I test di perimetro dopo la ricostruzione dell'organigramma — consegna a una sessione dedicata

**Aperto**: 2026-08-04 (S1043) · **Stato**: SOSPESO da Enzo · **Motivo della sospensione**: il ciclo
verifica → correzione → verifica non convergeva dentro questa sessione, e i test di autorizzazione
sono l'ultimo posto dove ha senso essere sbrigativi.

---

## 1. Che cosa è successo, in una frase

La ricostruzione dell'organigramma di RTL Bank (migrazioni `000244`→`000263`) ha cambiato **chi
comanda chi**. Decine di test di autorizzazione descrivevano l'organigramma *precedente* nominando
tre persone a mano — un capo, un suo sottoposto, un estraneo — e quei ruoli oggi sono diversi.

**I test non stanno segnalando un difetto del prodotto.** Stanno segnalando di essere stati scritti
quando l'azienda era organizzata in un altro modo.

## 2. La prova che il comportamento nuovo è corretto, non una fuga

Verificato sul database prima di toccare qualunque test, perché «un manager legge dati che prima non
vedeva» è un'affermazione che va guardata e non adeguata:

| Persona | Prima | Oggi |
|---|---|---|
| `paolo.caputo` | MANAGER generico | **Direttore della Divisione Crediti** |
| `antonio.parisi` | «estraneo» a paolo | **Analista Crediti nell'Ufficio Crediti Retail**, dentro quella divisione |
| `tommaso.fiore` | «sottoposto» di paolo | **Responsabile della Filiale di Varese**, altro ramo |

Il perimetro di `paolo.caputo` è di **19 persone**, tutte dentro la sua divisione. Non è un
allargamento indebito: è l'accesso che l'organigramma rotto negava. I due ruoli si sono **invertiti**.

## 3. Inventario misurato (esecuzione parziale, ~2/3 della suite)

- **24 file di test** hanno prodotto rossi · **81 test** falliti
- **19 di quei 24** nominano `tommaso.fiore` / `antonio.parisi` / `paolo.caputo` a mano
- Output grezzo conservato: `.zp/suite-parziale-S1043.txt` (5.971 righe)
- La suite **non è arrivata in fondo**: il numero finale può solo crescere

I 24 file (dall'esecuzione parziale):

```
b3-time-off-approval · dashboard · goals-scope · insights-scope · kpi-metrology
learning-gaps-scope · mentorship-scope · okrs-scope
organization-unit-processes-raci-demo · predictions-scope
rbac-tenant-admin-allowlist · scope-audit · scope-functional-axis
scope-peer-isolation · scope-resolver · sdbi-perf-feedback
semantic-matching-scope · semantic-matching-self-only
succession-pools-scope · successor-candidates-scope  (+4 non ancora identificati)
```

## 4. La soluzione ESISTE, è provata, e va solo applicata

`apps/api/test/helpers/org-actors.ts` — già scritto, già in uso su **9 file, tutti verdi**.

```ts
const paoloId   = await idDi(pool, "paolo.caputo@rtl-bank.org");
const sottoposto = await unSottopostoOrganizzativo(pool, paoloId);  // {userId, email}
const estraneo   = await unEstraneoOrganizzativo(pool, paoloId);
```

**Perché non è tautologico**: l'atteso si deriva dall'albero delle **unità organizzative**, che è una
struttura *indipendente* da quella che il resolver percorre (l'albero delle **posizioni**). Il test
non chiede al resolver di confermare sé stesso: gli chiede di concordare con l'organigramma. È un
confronto che **può fallire**, e falliva davvero prima della `000258`.

### Le due trappole già pagate — non ripagarle

1. **L'attore deve poter entrare davvero.** «Ha le credenziali» non basta: serve anche un fattore
   MFA, altrimenti il login si ferma sull'iscrizione e il test fallisce per una ragione che non
   stava misurando. Il vincolo è già dentro l'helper (`PUO_ENTRARE`).
2. **Due assi, non uno.** ADR-0027 tiene separati l'asse **gerarchico** (unità) e quello
   **funzionale** (squadre, processi). Le approvazioni vivono sul secondo: usare la derivazione
   organizzativa lì produce un test che passa o cade per il motivo sbagliato — è successo. Per
   quell'asse ci sono `unMembroDiSquadra` / `unFuoriSquadra`.

### File già convertiti (modello da copiare)

`scope-org` · `evidence` · `gap-closure` · `assessments-scope` · `assessment-results-scope` ·
`compensation-scope` · `goals-life` · `capability-composition-scope` ·
`approvals-functional-scope` *(quest'ultimo sull'asse funzionale)*

## 5. Perché il ciclo non si chiudeva — e come non ricascarci

Il vero ostacolo **non è la difficoltà tecnica**, è la lunghezza del giro di verifica:

- il cancello di fine turno instrada su `test-api` appena si tocca `apps/api/**`
- `test-api` impiega **~31 minuti** e si ferma solo alla fine
- ogni correzione parziale fa ripartire i 31 minuti da capo
- il cancello resta rosso finché **tutti** i file sono a posto, quindi ogni turno finisce bloccato

**Come lavorare nella sessione dedicata:**

1. Converti **tutti** i file dell'inventario in un colpo solo (è meccanico, il modello c'è).
2. Verifica **per file** con `pnpm exec vitest run test/<nome>.integration.test.ts` — pochi secondi
   l'uno, invece di 31 minuti.
3. Lancia la suite intera **una volta sola**, alla fine.
4. Il freno del cancello è `.zp/verify-off` (documentato in `verify_gate.py`). **Tirarlo è una
   decisione di Enzo, non un'iniziativa**: serve a chiudere un turno intermedio, non a spedire codice
   non verificato.

## 6. Che cosa NON è in dubbio (già verificato e pushato)

- Catena completa di **263 migrazioni** rieseguita da capo: **zero errori**
- `fn_organization_integrity_violations()`: **sette regole strutturali su sette a zero**
- Sentinelle DBMS **11/11 a zero** · copertura i18n **senza lacune** · nessuna contaminazione
- Perimetro della CEO sull'albero delle posizioni: da **17** a **158** persone
- Prestazioni: catena **16m25s → 4m12s** · verifica incrociata **46,1s → 3,4s** · sentinelle
  **7,4s → 3,2s** (misure A/B, non stime)

## 7. Primo comando della prossima sessione

```bash
python docs/kb/tools/session_start.py
grep -rln "tommaso.fiore\|antonio.parisi" apps/api/test/*.ts     # l'inventario, ri-derivato
cat .zp/suite-parziale-S1043.txt | grep -c "×"                   # i rossi misurati qui
```
