# 92 — Ciclo di valutazione completo (autovalutazione + calibrazione)

> **item**: #92 · **priorità**: P1 · **stima register**: ~2-3 sessioni (restano i passi 4-7)
> **stato**: IN CORSO
> **fonti**: `D:\heuresys-design-lab\2026-08-03--decisioni-workflow-valutazione-e-presenze.md` righe 84-95 (i 7 passi INTEGRALI) · `docs/superpowers/specs/2026-08-03-consegna-lab-esecuzione.md` §V6 (solo la simulazione R24, **non** i passi)

## Decisioni vincolanti (non si ri-chiedono)

- **Enzo, 2026-08-03: SÌ, si costruisce.**
- Commit **atomici separati per fase**: un passo = un commit.
- Le transizioni di stato si validano **lato servizio, non lato UI**, con un test per ogni
  transizione illegale.
- I passi 1-3 chiudono su dati reali; dal passo 4 si introducono scritture, e la dimostrazione
  live è un ciclo di prova reale.
- Numeri corretti, già rettificati: le review sono **548** (470 ANNUAL + 78 MID_YEAR), **non**
  550/79 — mig `000263` ha tolto 2 gusci vuoti. Le calibrazioni RTL 35/20/40 sono il
  sottoinsieme di 86/30/60 totali (verificato sul legacy in VM).

## Fasi

- [x] **F1 — Migrazione DDL** — 4 tabelle + FK `review_cycle_id` + 4 permessi + mapping RBAC — FATTO (mig `000256`) · commit `8f5112c8` · verificato in produzione 2026-08-10 (S1053)
- [x] **F2 — Ingestione calibrazione** — 35/20/40 righe legacy con lineage e filtro tenant anti-contaminazione — FATTO (mig `000257`) · commit `421b5bc2` · verificato in produzione 2026-08-10 (S1053)
- [x] **F3 — API lettura** — moduli `review-cycles` + `performance-reviews` + `calibration-sessions`, 7 endpoint, `orgGate` service/catalog, mask ADR-0032 sui giudizi, 13 integration test — FATTO 2026-08-10 (S1053) · prova live: federica 548 review reali + 35 sessioni + empty-state reale sui cicli; capo di linea confinato al sotto-albero con oracolo unità; platform senza giudizio
- [ ] **F4 — API scrittura + macchina a stati** — transizioni validate lato servizio; un test per **ogni** transizione illegale. ⚠ **Rilievo aperto da sciogliere PRIMA di scrivere**: il mapping RBAC è più largo del disegno del lab — `calibration:manage` e `review-cycle:manage` sono su **6 ruoli** (inclusi MANAGER / BLUEPRINT_MANAGER / PROCESS_OWNER). Va riesaminato, con eventuale migrazione correttiva, altrimenti si costruiscono scritture su un perimetro che il disegno non prevedeva · budget ~250k
- [ ] **F5 — ESS `/v1/me/performance-reviews/*`** — self-scope. Si integra con `me/repository.ts:388-391,593`, che **già** legge review self-scope: non duplicare, estendere · budget ~150k
- [ ] **F6 — Frontend** — pagina manageriale + pagina ESS, primitive `@heuresys/ui`, hook TanStack, i18n it/en **in parità** · budget ~200k
- [ ] **F7 — Playwright E2E con login reale** — `federica.marchetti@rtl-bank.org` per il ramo manager; **una persona senza deleghe** per l'ESS · budget ~120k

## Da dove si riprende

**F4**, e la prima mossa non è codice: è misurare il mapping RBAC reale dei due permessi
`calibration:manage` / `review-cycle:manage` contro il disegno del lab, e decidere se serve la
migrazione correttiva. Costruire le scritture prima di quella decisione significa consegnarle
su un perimetro sbagliato.
