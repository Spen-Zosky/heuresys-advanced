# 169 — La password e il secondo fattore nascono dalla stessa chiave: chi ha una ha l'altro

> **item**: #169
> **stato**: NON AVVIATO
> **sbloccata**: S1079 (2026-08-24) — era `GATED` su `#147`, che risulta `DONE`. Il gate era
> sciolto e nessuno se n'era accorto: il cancello locale guarda il **diff**, e la chiusura di
> un'altra voce non produce alcun diff sui file che instradano questa.

## Il difetto, misurato in S1050

La **stessa** chiave madre genera la password (`derivePassword`) **e** il segreto
dell'authenticator (`deriveTotpSecret`). Chi possiede la chiave possiede già entrambi: per quel
soggetto **l'MFA non è un secondo fattore**, è lo stesso fattore contato due volte. Vale per tutte
le 158 utenze.

**Non è una rotazione.** Il segreto è derivato in modo deterministico da chiave + email:
«rigenerarlo» restituisce lo stesso valore. Una rotazione vera passerebbe dalla chiave madre, che
cambierebbe tutte le 158 password — e il codice lo vieta esplicitamente.

## Il pezzo difficile, nominato subito

La forma proposta è: **password derivata** (i test devono poter entrare) + **segreto authenticator
non derivato**, casuale, cifrato, consegnato alla sola persona. Il costo vero non è scriverla: è
che **i test e le prove sul browser devono superare l'MFA in un altro modo**, e oggi ci passano
proprio perché il segreto è derivabile. Questa è la fase che decide se la voce è da un'ora o da
una sessione.

## Fasi

- [ ] **F1 Censire chi deriva il segreto, e da dove** — ogni punto che chiama `deriveTotpSecret`: codice di produzione, seed, test, prove sul browser, script di servizio. **fatto =** l'elenco completo con file:riga, e per ognuno se serve il *valore* o solo un accesso riuscito
- [ ] **F2 La via d'ingresso per le prove, prima di togliere quella vecchia** — le prove hanno bisogno di superare l'MFA senza conoscere il segreto della persona. Le strade sono almeno due (un fattore di prova dedicato per le sole utenze di collaudo; oppure un'esenzione dichiarata e circoscritta) e **la scelta va fatta qui**, non scoperta a metà di F3. ⚠ Se questa fase non chiude, F3 non si apre: togliere la derivazione senza una via per le prove rende rossa l'intera suite. **fatto =** una via che funziona, provata su un accesso reale, con la vecchia ancora al suo posto
- [ ] **F3 Il segreto smette di essere derivato** — casuale, cifrato a riposo, consegnato una volta sola. **fatto =** un segreto nuovo non è più ricostruibile dalla chiave madre, misurato provando a ricostruirlo
- [ ] **F4 La prova che deve poter fallire** — con la chiave madre in mano, **completare** un accesso come amministratore deve risultare **impossibile**, e la suite deve continuare a girare. Le due cose insieme, o la voce non è chiusa: passare la prima rompendo la seconda è il modo ovvio di barare. **fatto =** tentativo eseguito e fallito con evidenza, suite verde

## Chiuso quando

Chi ha la chiave madre **non può completare** un accesso come l'amministratore, e la suite continua
a girare.
