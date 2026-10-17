# Mandato O2-07 — perimetro S4, parte 1: il risolutore, il cancello, le prime risorse

Modello: `claude-sonnet-5-5`. Tetto di spesa: 10 USD. Onda 2, sessione 7 di 10 (`.programmi/onda2/README.md`, regole comuni 1-11).

## Precondizione

ADR-0046 approvato dall'Amministratore di Sistema (status `ACCETTATO` nel file). Se non lo è: stato `WAIT-INPUT: approvazione ADR-0046`, e la sessione non parte.

## Leggi

`CLAUDE.md`, memoria, `.claude/rules/security-auth.md`, `.claude/rules/api-module-pattern.md`; `docs/architecture/adr/0046_perimetro_del_tenant.md` per intero, ADR-0043, ADR-0039; `apps/api/src/lib/scope/gate.ts`, `profilo.ts`, i loro test; l'esito di O2-01 (tabella dei perimetri, `perimeter_status`).

## Consegna

1. `apps/api/src/lib/scope/perimetro.ts` (ADR-0046 §3): mappa chiusa dei cataloghi, risoluzione per chiave naturale lungo la catena delle attivazioni, i tre esiti `tutto` / `transitorio` / `perimetro`, il ramo transitorio dichiarato con la data di fine (passo S5).
2. Il cancello (§4): `perimeter` al posto di `profile` (con `profile` accettato come sinonimo per una versione), `RISORSE_DI_CATALOGO` esteso alle risorse delle rotte di lettura di `skills`, `kpi-definitions`, `job-roles`; prima di estendere, misura le risorse RBAC vere di quelle rotte (`requirePermission` nei `routes.ts`) e scrivile nell'esito. La dichiarazione `platform` è accettata solo su rotte ristrette a `PLATFORM_ADMIN`.
3. I repository di quelle tre risorse usano il risolutore con la forma unica della query (§3). Le rotte di scrittura che citano una competenza, un indicatore o un ruolo validano il riferimento: `422 FUORI_PERIMETRO` fuori perimetro, nessun cambio per un tenant `TRANSITORIO`.
4. Test di integrazione con un tenant di prova a cui il test carica un perimetro dichiarato (mai dati scritti a mano fuori dal test).

## Prova di chiusura

- Prove 1, 3 e 4 di ADR-0046 per le tre risorse, ognuna rossa sul codice di prima e verde dopo; mutazione del cancello (una rotta di catalogo senza dichiarazione fa fallire l'avvio nel test).
- RTL Bank, che oggi è `TRANSITORIO`: le risposte delle tre rotte per una persona reale di RTL Bank sono identiche prima e dopo (confronto delle risposte su copia, salvato nell'esito).
- `pnpm test:api:vm` verde; `pnpm typecheck:test` verde.

## Non fare

Le altre risorse, la ricerca per significato, l'agente e le liste di scelta sono di O2-08. Nessun perimetro scritto nei dati di RTL Bank (è S5, onda 3).
