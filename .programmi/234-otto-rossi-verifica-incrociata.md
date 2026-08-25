# 234 — Gli otto rossi di `verifica_incrociata`: cura o riclassificazione, mai il silenzio

> **item**: #234
> **stato**: APERTO
> **aperto**: S1081 (2026-08-25) — emersi togliendo X9c/X8a/X7a e correggendo il display
> della batteria (mostrava l'ultimo allarme come sintesi; ora mostra la riga ESITO)

## La misura di apertura (2026-08-25 — si RIESEGUE alla presa in carico, mai si ricopia)

`python docs/kb/tools/verifica_incrociata.py` → ESITO: 8 verifiche con difetti.

| check | cosa dice | misura | sospetto |
|---|---|---|---|
| X3b | retribuzione anomala vs pari livello | 5/160 | misura statistica, non incoerenza? |
| X3c | contratto attivo senza busta recente | 2/160 | marciume vero (freschezza storia36?) |
| X4a | requisito di competenza non coperto | 667/1434 | misura di business (i gap ESISTONO — è il territorio di #227) |
| X5d | posizione ricoperta senza requisiti formativi | 8/161 | da capire dal file che crea |
| X6a | OKR su reparto inesistente | 5/9 | marciume vero |
| X6b | KPI assegnato non previsto dalla posizione | 42/78 | misura di copertura? |
| X6c | obiettivo senza titolare | 2/2206 | marciume vero |
| X6d | catalogo KPI copre una frazione delle posizioni | 1 | misura di copertura? |

## Regole

Per ogni firma: **misura → leggi il file che crea l'oggetto → causa → cura o
riclassificazione con la ragione scritta accanto al check**. Una riclassificazione a
`tipo="misura"` corregge lo strumento solo se la ragione regge da sé; una cura ai dati
porta le quattro cose di `db-migrations.md`. Mai spegnere per far tornare verde il cancello.

## Fasi

- [ ] **F1 Le probabili riclassificazioni** (X3b, X4a, X6b, X6d) — verificare il sospetto
  leggendo il check e il modello; se regge, `tipo="misura"` con ragione scritta; se non
  regge, la firma passa a F2. **fatto =** ognuna delle quattro o è `[i ]` motivata o è in F2
- [ ] **F2 Il marciume vero** (X6a, X6c, X3c, X5d + ciò che F1 rimanda) — per ognuna:
  file che crea, causa, cura con guardia/post-condizione/rollback, `ci-rehearsal` se tocca
  `db/**`. **fatto =** conteggio a zero o eccezione dichiarata nel check con data e ragione
- [ ] **F3 La corsa che chiude** — `verifica_incrociata` esce **0 o 4** (cieco dichiarato),
  la batteria del cancello mostra il verde, e una chiusura reale non porta più
  `marciume: fallito`. **fatto =** output allegato della corsa e della chiusura
