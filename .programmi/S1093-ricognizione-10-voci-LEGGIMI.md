# S1093 — ricognizione misurata delle 10 voci P1/P2/P3/GATED

**Cos'è**: il risultato grezzo di una ricognizione delegata a 13 agenti in parallelo il
2026-09-08, che hanno misurato **sul campo** (codice, database di produzione via tunnel, git)
lo stato reale di `#149 #143 #169 #214 #159 #79 #54 #205 #198 #41`, più una verifica
indipendente dei tre gate dichiarati.

**Dove**: `S1093-ricognizione-10-voci.json` accanto a questo file — **318 KB**, non è materiale
da aprire per intero. Ogni voce porta: fase viva · stato misurato (con i comandi) · **smentite**
(dove la misura contraddice register o piano) · decomposizione fino al comando · precondizioni
verificate · chi la può completare · costo stimato · prova di chiusura secondo la DoD.

**Costo**: 2,27 milioni di token di subagent, 940 chiamate di strumento, ~2h30 di orologio.
Rileggerlo costa una frazione di ri-produrlo.

---

## ⚠ Il reperto che vale da solo il lavoro — e riguarda il presidio `#149`

**`#149` F4 è stato dichiarato «nessun bersaglio» CINQUE volte misurando metà del proprio
innesco.** L'innesco è *«la prossima consegna che arriva, **o la prossima ingerita che qualcuno
cita**»*. In S1077, S1083, S1087, S1091 e S1092 è stato misurato solo il primo ramo
(`lab_inbox.py` + `ls inbox/`, entrambi vuoti). Il secondo **non è mai stato misurato**.

Misurato adesso: **5 documenti del design-lab sono citati dal register come fonte eseguibile**
(`#205` riga 44 · `#206` riga 72 · `#198` righe 112, 159, 162) e **nessuno dei cinque** porta un
segno di verifica canonica.

È **DIF-4** — la frase più larga della misura — applicata *al presidio che esiste per
intercettare DIF-4*. Ed è la seconda volta oggi che quella famiglia si presenta.

## Le altre smentite, in ordine di gravità

1. **`#205` risulta «VERIFICATA-AVVERSARIALMENTE-S1066» ma il documento non lo sa.** S1066
   scrisse la ritrattazione nel *biglietto di consegna*, non nel **dossier** che la voce fa
   aprire: alla riga 87 di quel dossier l'affermazione respinta come falsa **sopravvive
   intatta**. La regola 3 del piano di `#149` lo prevedeva alla lettera.
2. **Due delle quattro conferme di S1066 oggi sono false**: `sys_research_sources` **esiste con
   5 righe** (fu confermato «non esiste, la dipendenza dura regge»), e le tabelle di `sys` non
   sono più 225 → **240**. ⚠ Il confronto va rifatto **con lo stesso strumento** che produsse il
   225 (`completezza_tenant.py`), non con una conta diversa: altrimenti si smentisce un numero
   con un numero che misura un'altra cosa.
3. **Il register di `#149` è indietro di due sessioni rispetto al proprio piano** (fermo a
   S1087). Chi avvia con `session_start.py` — che distilla il register, e il `CLAUDE.md` **vieta**
   di leggere il backlog grezzo al boot — vede un presidio fermo al 5 settembre.
4. **Numeri portanti di `#206` scaduti**: `sys_position_skill_requirements` 1.439 → **1.434**;
   `_learning_requirements` 1.733 → **1.886**. La conclusione che motivano regge, i numeri no.
5. **La conformità al presidio non è misurabile a macchina**: il marker di verifica esiste in due
   grafie diverse e nessuno strumento lo cerca. Su 64 consegne ingerite, **3** portano un marker
   inequivocabile.
6. **Il gate di `#198` è confermato vero**: `sys_blueprint_content_{units,positions,skills,kpis}`
   = 0 · 0 · 0 · 0.

## Come si usa

Non è una lista di cose da fare: è la **base misurata** su cui costruire il prossimo piano. Le
decomposizioni dentro il JSON sono scritte per una sessione che **non ha questo contesto**.
⭐ Ma vale la regola di `#149` **anche su questo file**: è una consegna, ed è **non verificata**
finché qualcuno non la misura. Le smentite qui sopra sono affermazioni di 13 agenti, non fatti
acquisiti — vanno ri-misurate prima di agire, esattamente come si sarebbe fatto con un documento
del lab.
