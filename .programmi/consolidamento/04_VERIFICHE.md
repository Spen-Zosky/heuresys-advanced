# Consolidamento — verifiche e ripresa

Ogni verifica: comando o procedura, ambiente, data e ora (UTC), esito **PASS / FAIL / NON ESEGUITO**, evidenza. I problemi preesistenti stanno nella sezione «Preesistenti», separati dalle regressioni.

## Verifiche

| # | data | verifica | ambiente | comando | esito | evidenza |
|---|---|---|---|---|---|---|
| V-01 | 2026-10-23 | Revisione indipendente della Fase B (11 rilievi ricontrollati nel codice: 8 confermati, 3 parziali, 0 smentiti) | container, sola lettura | revisore Opus | PASS con correzioni | `lavoro/G_revisione_indipendente.md` |
| V-02 | 2026-10-23 | Post-condizione di 000400 sul conteggio globale delle PUBLISHED (R-50) | container, lettura del file | `sed -n 238,247p db/migrations/000400_*.sql` | confermato nel codice; prova rossa su copia NON ESEGUITA (manca un gemello: il linux-pc non esiste più) | questo registro |

## Preesistenti (non introdotti da questo programma)

Tutti i rilievi di `01_RILIEVI.md` sono preesistenti al programma.

## Ripresa

- **Ramo**: `claude/project-thread-adoo53` in entrambi i repository.
- **Fatto**: Fasi A e B; approvazione del piano (vedi `00_INDICE.md`).
- **In corso**: baseline della VM; incrementi senza scrittura in produzione.
- **Bloccato**: le prove su database di advanced (C3a, C3, C4, C5, C11) chiedono una copia usa-e-getta dello schema di produzione: il gemello storico (linux-pc) non esiste più e sulla VM l'unico cluster di advanced è la produzione.
- **Prossima azione eseguibile**: vedi l'ultima riga del registro qui sopra e la tabella di `03_PIANO.md`.
