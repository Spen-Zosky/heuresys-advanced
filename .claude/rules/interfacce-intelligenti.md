---
paths:
  - "apps/web/**"
  - "apps/api/src/modules/**"
  - "packages/shared/**"
---

# Interfacce intelligenti — regole permanenti (Enzo, 2026-11-10)

Ogni tabella, elenco e casella di scelta, nuova o toccata, rispetta il repertorio in `docs/kb/xtras/INTERFACCE_INTELLIGENTI.md`. In una riga:

- R1 persone in ordine di cognome, scritte «Cognome, Nome» (`cognomeNome()`), ordine fatto dall'API;
- R2 colonne scelte per il lavoro di chi guarda (per una persona: ruolo nell'organizzazione e sede, non l'email); il codice tecnico non è mai la prima colonna;
- R3 lo stato è l'ultima colonna di dati;
- R4 mai codici di lavoro a video (`HR_MANAGER`, `STANDARD`, `MEDIUM`): descrizioni leggibili da `useEnumLabel` o dal nome del dato;
- R5 un solo numero coerente con perimetro e filtri, niente elenchi troncati in silenzio; un mandato di piattaforma vede tutti i tenant con colonna e filtro Tenant che parte da «Tutti»;
- R6 caselle di scelta con descrizioni e «Tutti» in testa; R7 un termine per concetto.

Il controllo `apps/web/tests/e2e/interfacce-intelligenti.spec.ts` è un cricchetto sul registro `interfacce-intelligenti.debiti.json`: chi corregge una pagina toglie il suo debito nella stessa PR, chi aggiunge una pagina con tabelle la registra con l'elenco vuoto.
