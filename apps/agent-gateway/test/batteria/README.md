# La batteria della qualità (ADR-0063 E11, piano AI-driven voce F6a)

Domande vere per dominio, poste all'assistente con l'identità di persone di RTL Bank, con la risposta attesa ricavata da una query SQL riproducibile. Un dominio è pronto con almeno 9 risposte giuste su 10.

## I pezzi

- `modelli/`: i modelli di domanda parametrici, un file per dominio (`talenti.ts` = D1), elencati in `modelli/indice.ts`. Un dominio nuovo è un file di modelli, la riga nell'indice e, se servono, nuove voci in `vocabolari.ts` e `profili.ts`.
- `domande.json`: le domande generate, con query, risposta attesa, impronta, data e database della misura.
- `confronto.ts`: il confronto deterministico (numeri it-IT, nomi, insiemi, ordine, sì/no, etichette, rifiuti).
- `batteria.test.ts`: i controlli statici, in CI. La corsa vera chiama il modello e non è in CI.
- `../../scripts/batteria-*.ts` e `batteria-corsa.sh`: generazione, verifica, corsa, campione.

## I comandi

Da `apps/agent-gateway`, su una macchina con il database (il database si legge in una transazione di sola lettura):

```bash
pnpm exec tsx scripts/batteria-genera.ts      # riscrive domande.json
pnpm exec tsx scripts/batteria-verifica.ts    # uscita 1 se una risposta attesa è diventata vecchia
```

La corsa, dalla radice del repo, sulla copia del database (il gemello): avvia un gateway proprio sulla porta 8791, genera le domande nella cartella di uscita se mancano, le verifica, le pone, salva `registro.jsonl` e stampa l'esito per categoria e profilo. Rilanciata sulla stessa cartella riprende.

```bash
bash apps/agent-gateway/scripts/batteria-corsa.sh <cartella-uscita> --insieme 4
pnpm --filter @heuresys/agent-gateway exec tsx scripts/batteria-campione.ts --domande <cartella>/domande.json --registro <cartella>/registro.jsonl --esci <file.md>
```

Ogni domanda apre una conversazione della persona e scrive nel diario del gateway: per questo la corsa non si fa sulla produzione. Il corridore concede le sole conferme di lettura (la soglia delle persone) e nega ogni scrittura.

## Come si scrive una domanda

La query dà la risposta con colonne fisse: `n` (numero), `vero` (sì o no), `etichetta` (un codice del vocabolario), righe `nome` + `dentro` (insieme, ordine, primo: `dentro` falso = nome che renderebbe sbagliata la risposta), `nome` + `etichetta` (coppie), righe `nome` = dati che non devono trapelare (rifiuto, fuori perimetro). Una domanda senza risposta univoca (nessun fatto, un pareggio in classifica) viene scartata dal generatore. Il perimetro di un responsabile è quello di `orgSubtreeUserIds` (`apps/api/src/lib/scope/org.ts`).
