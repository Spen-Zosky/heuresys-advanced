# 238 — `verifica-deploy` chiama guasto un clone in corso

> **item**: #238 · **priorità**: P2 · **stima**: ~30min
> **stato**: NON AVVIATO
> **nasce-da**: la chiusura di S1084 (2026-08-29) — il **primo giro vero** dell'armamento del clone
> introdotto da `#236` F2. Trovato eseguendo, non ragionando.

## Il fatto, misurato

L'ultimo atto della chiusura ha dato:

```
VERDETTO: DISALLINEATO — servizi non attivi su: linux-pc
  linux-pc      fermo su 1f39b87d (atteso c43a12de) · servizi inactive/inactive
```

**Non era un guasto.** In quell'istante stava girando `heuresys-advanced-clonedb.service`, che
ferma `api` e `web` **di proposito** prima del ripristino del database e li riaccende con
`ExecStopPost`. Misurato subito dopo:

| | |
|---|---|
| clone concluso | `16:02:37` · `Result=success` |
| API ripartita | `16:02:41` — **quattro secondi dopo** |
| lettura rifatta | `deploy IN-VOLO · clone FRESCO · ecosistema ALLINEATO`, exit 0 |

## Perché conta più di quanto sembri

È **la specie di falso allarme che S1084 ha passato la giornata a togliere**: il rendiconto delle
chiusure che restava rosso su un guasto riparato, `settings.json` che avrebbe reso l'ecosistema
`INDIETRO` per sempre, `DISALLINEATO` sugli stamp diversi. Ogni volta la stessa forma — *un allarme
acceso su una condizione normale insegna a non guardarlo*.

E qui sta nel posto peggiore: `verifica-deploy` è **l'ultimo atto di ogni chiusura**, la riga su cui
si decide se si può chiudere sereni.

⚠ **E diventerà più frequente, non meno.** Da `#236` F2 la chiusura **arma** il clone invece di
eseguirlo appeso alla sessione: la finestra in cui i servizi del gemello sono giù cade adesso
proprio dove `verifica-deploy` guarda. Prima capitava di rado, ora capiterà a ogni chiusura che
tocca `db/migrations` o `db/seeds`.

## Cura proposta — da verificare, non ancora decisa

`verifica-deploy.sh` interroga `systemctl is-active heuresys-advanced-clonedb.service` **prima** di
giudicare i servizi di un host: se un clone è in corso, `IN-VOLO` invece di `DISALLINEATO`.

**Non c'è un criterio nuovo da inventare**: `verifica-cloni.sh` ha già il verdetto `IN-CORSO` per
esattamente questo stato. Il difetto è che due strumenti dicono cose diverse sullo stesso fatto —
uno lo chiama «in corso», l'altro «guasto».

## Fasi

- [ ] **F1 — La domanda in più, e una sola fonte per il fatto** — `verifica-deploy.sh` chiede lo
      stato dell'unità del clone prima di giudicare i servizi. La logica non si duplica: si legge
      dove già vive (`verifica-cloni.sh`), o si estrae in un punto solo.
      **fatto =** i due strumenti non possono più dare verdetti opposti sullo stesso host

## Le prove che devono poter fallire

- **Mentre il clone gira**: armare un clone e leggere il verdetto **durante** — deve dire `IN-VOLO`,
  non `DISALLINEATO`. È il caso che oggi sbaglia.
- **Il caso opposto, che è quello che conta**: a clone **finito**, con un servizio davvero giù, deve
  tornare `DISALLINEATO`. Una cura che spegnesse l'allarme in entrambi i casi sarebbe peggio del
  difetto — renderebbe cieco l'unico controllo che guarda la produzione a fine chiusura.

## Chiuso quando

Il verdetto di fine chiusura distingue «i servizi sono giù perché stiamo rifacendo il clone» da «i
servizi sono giù», e le due frasi non arrivano più dallo stesso vocabolario.
