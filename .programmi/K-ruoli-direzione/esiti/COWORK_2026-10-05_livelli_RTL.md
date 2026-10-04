# Esito lettura Cowork 2026-10-05 — livelli e gerarchia di RTL_BANK

Sola lettura sul gemello (linux-pc, clone del database), 2026-10-05. Il tunnel :5433 da Windows risultava in ascolto ma senza risposta (timeout), quindi la misura non è sulla produzione. Nessuna scrittura.

## Principio gerarchia-livelli (voce 2026-10-05)

Regola applicata: ordine 3A1L < 3A2L < 3A3L < 3A4L < QD1 < QD2 < QD3 < QD4 < Dirigente. Per ogni unità il responsabile (`organization_unit_manager_user_id`) è confrontato con le persone in posizioni dell'unità e dei suoi discendenti (assegnazioni attive) e con i responsabili delle unità sotto.

- Violazioni (capo con livello inferiore a un sottoposto): **0 unità su 42**.
- Prova che la misura può fallire: coppie capo-sottoposto con sottoposto di livello più basso 598, di pari livello 30, di livello più alto 0. 158 persone con livello su 160 contratti attivi; nessun responsabile senza livello; nessun livello «Quadro» generico fra i 160 attivi.
- Ordine dei livelli QD: assunto crescente (QD4 più alto), come nella voce di Cowork. Va confermato da Enzo.

## Livelli dichiarati (`org_level` nei metadati) contro profondità reale (radice = 1)

42 unità: 23 con livello dichiarato, 19 senza. Dei 23, 3 coincidono con la profondità e 20 no (Cowork scrive 22: differenza di 2, da riconciliare nel confronto riga per riga).

| tipo | profondità | dichiarato | unità |
|---|---|---|---|
| HEADQUARTERS | 1 | 1 | 1 |
| GENERAL_MANAGEMENT | 2 | senza | 1 |
| DEPARTMENT | 2 | 2 / 3 / senza | 1 / 2 / 2 |
| DIVISION | 2 | 2 | 1 |
| DIVISION | 3 | 2 | 7 |
| DEPARTMENT | 4 | 3 / senza | 6 / 5 |
| AREA | 4 | senza | 2 |
| OFFICE | 4 | senza | 2 |
| BRANCH | 5 | 4 / senza | 3 / 7 |
| OFFICE | 5 | 4 | 2 |

Conferma la segnalazione: 7 Divisioni su 8 dichiarano 2 e stanno a profondità 3 (sotto la Direzione Generale); 3 filiali dichiarano 4 e stanno a 5.

## Non fatto, serve Enzo

Allineare i livelli di RTL_BANK (scrittura sui dati reali), posizione delle Direzioni di controllo, Divisione Risk & Compliance vuota: attende il sì di Enzo. Se `org_level` sia letto dall'applicazione non è verificato.
