/**
 * apps/web/tests/giro/misure.cjs — le misure delle classi di difetto C1-C14
 * (docs/piani/PIANO_interfaccia-sistematica_20261111.md, §1).
 *
 * `misuraPagina()` gira DENTRO il browser (page.evaluate): non importa niente e non chiude su
 * variabili esterne. Restituisce, per classe, quante occorrenze ha trovato e qualche esempio.
 *
 * Il principio: una misura che sbaglia per eccesso si corregge restringendo il dizionario; una che
 * sbaglia per difetto non si vede mai. Per questo i dizionari sono chiusi e scritti qui, e ogni
 * esempio riporta il testo vero che lo ha fatto scattare, così chi legge il rapporto giudica.
 */

/* eslint-disable */
function misuraPagina() {
  const main = document.querySelector("main") || document.body;
  const esito = {};
  const segna = (classe, esempio) => {
    const e = (esito[classe] = esito[classe] || { n: 0, esempi: [] });
    e.n++;
    if (e.esempi.length < 8 && esempio && !e.esempi.includes(esempio)) e.esempi.push(esempio.slice(0, 140));
  };

  /* I testi visibili, nodo per nodo: un nodo di testo è un'unità di significato. */
  const visibile = (el) => {
    if (!el) return false;
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const testi = [];
  const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = (n.textContent || "").replace(/\s+/g, " ").trim();
    if (!t) continue;
    const p = n.parentElement;
    if (!p || p.closest("script,style,code,pre,textarea,[data-giro-ignora]")) continue;
    if (!visibile(p)) continue;
    testi.push({ t, el: p });
  }
  /* le opzioni delle caselle di scelta non sono nodi visibili ma si leggono quando si aprono */
  for (const o of Array.from(main.querySelectorAll("option"))) {
    const t = (o.textContent || "").trim();
    if (t) testi.push({ t, el: o });
  }

  /* C1 — lingua. Parole inglesi che in italiano non esistono, e codici di macchina. */
  const INGLESE = new Set(("the of and or to from with without for by is are was were be been this that these those " +
    "policy accrual adjustment taken previous year monthly yearly weekly daily leave request requests long short term " +
    "approved rejected pending completed cancelled canceled draft active inactive archived submitted review reviews " +
    "open closed done failed success error warning unknown none other total average count high low medium critical " +
    "manager employee employees user users team teams role roles position positions unit units department " +
    "goal goals target targets score rating level levels grade band bands salary pay payroll bonus benefit benefits " +
    "start end date time hours days week month status type name description notes note comment comments owner " +
    "created updated deleted by at on in out yes no true false n/a carryover sick bereavement parental personal " +
    "vacation holiday holidays overtime shift shifts training course courses skill skills learning path paths " +
    "career succession readiness ready now later candidate candidates hiring interview offer job jobs posting " +
    "dashboard overview summary details detail settings search filter filters clear apply save cancel submit " +
    "edit delete add new view show hide more less next previous back home loading empty").split(" "));
  /* parole che coincidono con l'italiano o sono entrate nell'uso: non contano */
  /* (le parentesi contano: senza, `split` tagliava solo la seconda riga e l'insieme era fatto di lettere) */
  const AMMESSE = new Set(("dashboard team manager skill budget performance feedback coaching mentor mentoring report " +
    "online offline email badge ok no in a di da e o per con su tra fra il la le lo gli un una").split(" "));
  const CODICE = /\b[A-Z][A-Z0-9]*_[A-Z0-9_]*[A-Z0-9]\b|\b[a-z]+_[a-z_]+\b|\b(?:ACTIVE|INACTIVE|PENDING|DRAFT|STANDARD|MEDIUM|HIGH|LOW|CRITICAL|APPROVED|REJECTED|COMPLETED|CANCELLED|ARCHIVED|SUBMITTED|OPEN|CLOSED|IN_PROGRESS|TENANT|PLATFORM)\b/g;
  for (const { t } of testi) {
    for (const m of t.match(CODICE) || []) segna("C1-codice", `${m} — «${t}»`);
    /* le lettere accentate fanno parte della parola: «unità» non è «unit» */
    const parole = t.toLowerCase().match(/[a-zà-ÿ]+(?:'[a-zà-ÿ]+)?/g) || [];
    const ing = parole.filter((p) => INGLESE.has(p) && !AMMESSE.has(p));
    /* due parole inglesi nello stesso nodo, o una sola se il nodo è una parola sola */
    if (ing.length >= 2 || (ing.length === 1 && parole.length === 1)) segna("C1-inglese", t);
  }

  /* C2 — persone: email e UUID a video. */
  const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
  const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
  for (const { t, el } of testi) {
    if (el.closest("[data-giro-email-ammessa], header, aside, footer")) continue;
    if (EMAIL.test(t)) segna("C2-email", t);
    if (UUID.test(t)) segna("C2-uuid", t);
  }

  /* C3 — sigle e codici soli in una cella: la cella contiene soltanto un codice. */
  const SOLO_CODICE = /^(?:[A-Z]{2,}[A-Z0-9]*(?:[-_.][A-Z0-9]+)+|[A-Z]{2,5}-?\d{2,}|\d{1,4}(?:\.\d+)*)$/;
  for (const td of Array.from(main.querySelectorAll("td"))) {
    const t = (td.textContent || "").trim();
    if (t && SOLO_CODICE.test(t) && !/^\d+([.,]\d+)?$/.test(t.replace(/\./g, ""))) segna("C3-codice-solo", t);
  }
  /* una prima colonna fatta di codici */
  for (const table of Array.from(main.querySelectorAll("table"))) {
    const prime = Array.from(table.querySelectorAll("tbody tr")).slice(0, 10).map((tr) => (tr.querySelector("td")?.textContent || "").trim());
    if (prime.length >= 3 && prime.filter((x) => /^[A-Z0-9][A-Z0-9_.-]{1,}$/.test(x) && /[A-Z_-]|\d/.test(x)).length >= Math.ceil(prime.length * 0.8)) {
      segna("C3-codice-prima-colonna", prime.slice(0, 3).join(" | "));
    }
  }

  /* C4 — numeri. Cifre ≥ 1000 senza separatore (non anni, non codici), decimali col punto,
     migliaia all'inglese. */
  for (const { t, el } of testi) {
    if (el.closest("[data-giro-numero-libero], [data-grezzo], input, textarea, code, pre")) continue;
    const pulito = t.replace(/\b[0-9a-f]{8}-[0-9a-f-]{27}\b/gi, "").replace(/\b(19|20)\d{2}\b/g, "").replace(/[A-Z]+-?\d+/g, "").replace(/\d{2}\/\d{2}\/\d{4}/g, "");
    if (/(?<![\d.,/:-])\d{4,}(?![\d.,/:-])/.test(pulito)) segna("C4-senza-separatore", t);
    if (/(?<![\d.])\d+\.\d{1,2}(?![\d.])/.test(pulito) && !/\d+\.\d{3}/.test(pulito)) segna("C4-decimale-col-punto", t);
    if (/\d{1,3},\d{3}(?![\d])/.test(pulito)) segna("C4-migliaia-inglesi", t);
  }
  /* anche nelle etichette dei grafici SVG, che non stanno sempre dentro `main` */
  for (const tx of Array.from(document.querySelectorAll("svg text"))) {
    const t = (tx.textContent || "").trim();
    if (/\d{1,3},\d{3}/.test(t)) segna("C8-asse-numeri-inglesi", t);
    if (/(?<![\d.,])\d{5,}(?![\d.,])/.test(t)) segna("C8-asse-senza-separatore", t);
  }

  /* C5 — pagina lunga senza schede. */
  const altezza = main.scrollHeight;
  const schermo = window.innerHeight;
  const schede = main.querySelector("[role=tablist]");
  if (altezza > schermo * 3 && !schede) segna("C5-pagina-lunga", `${Math.round(altezza / schermo)} schermate`);

  /* C7 — intestazione: dimensione del titolo e spazio vuoto dopo l'intestazione. */
  const h1 = main.querySelector("h1");
  if (!h1) segna("C7-senza-titolo", location.pathname);
  else {
    const fs = parseFloat(getComputedStyle(h1).fontSize);
    const corpo = parseFloat(getComputedStyle(main).fontSize) || 14;
    if (fs < corpo * 1.5) segna("C7-titolo-poco-distinto", `${h1.textContent?.trim()} (${fs}px)`);
    const header = h1.closest("header") || h1.parentElement;
    const dopo = header?.nextElementSibling;
    if (header && dopo) {
      const vuoto = dopo.getBoundingClientRect().top - header.getBoundingClientRect().bottom;
      if (vuoto > 32) segna("C7-spazio-dopo-intestazione", `${Math.round(vuoto)} px`);
    }
    /* il quadro degli insight sta nell'intestazione per scelta (C15): non conta nell'altezza */
    const quadro = header?.querySelector("[data-testid=quadro-insight]");
    const hRect = (header || h1).getBoundingClientRect();
    const alta = hRect.height - (quadro ? quadro.getBoundingClientRect().height : 0);
    if (alta > 140) segna("C7-intestazione-alta", `${Math.round(alta)} px`);
  }

  /* C8 — grafici: legenda a scorrimento (frecce, «3/6»), grafico senza assi né legenda. */
  for (const t of testi) if (/^\d+\/\d+$/.test(t.t) && t.el.closest(".recharts-legend-wrapper, [class*=legend]")) segna("C8-legenda-a-pagine", t.t);
  for (const c of Array.from(main.querySelectorAll("canvas"))) {
    /* un grafico su canvas è leggibile se accanto ha la sua lettura in parole o la tabella */
    let box = c.parentElement;
    for (let i = 0; i < 4 && box && !box.querySelector("[data-grafico-lettura], [data-testid=chart-table]"); i++) box = box.parentElement;
    if (!box || !box.querySelector("[data-grafico-lettura], [data-testid=chart-table]")) segna("C8-canvas-senza-testo", "grafico su canvas");
  }

  /* C9 — righe vuote o incomplete. */
  const VUOTO = /^(—|-|–|n\/d|null|undefined|nan|)$/i;
  for (const tr of Array.from(main.querySelectorAll("tbody tr"))) {
    /* la tabella dei numeri di un grafico ripete il disegno: un trattino lì è un punto che il
       grafico non ha, non una riga del dato rimasta a metà */
    if (tr.closest("[data-testid=chart-table]")) continue;
    const celle = Array.from(tr.querySelectorAll("td"));
    if (celle.length < 3) continue;
    const vuote = celle.filter((td) => VUOTO.test((td.textContent || "").trim())).length;
    if (vuote / celle.length >= 0.5) segna("C9-riga-vuota", celle.map((c) => (c.textContent || "").trim() || "∅").join(" | "));
  }
  for (const { t } of testi) if (/\b(NaN|undefined|null|Invalid Date|\[object Object\])\b/.test(t)) segna("C9-valore-rotto", t);

  /* C12 — sembra cliccabile ma non è un comando: sottolineato o puntatore senza ruolo. */
  for (const el of Array.from(main.querySelectorAll("span, div, td, p"))) {
    const s = getComputedStyle(el);
    const sottolineato = s.textDecorationLine.includes("underline");
    if (!(sottolineato || s.cursor === "pointer")) continue;
    if (el.closest("a, button, [role=button], [role=link], [role=tab], label, summary, [title], [aria-describedby]")) continue;
    if (el.querySelector("a, button")) continue;
    const t = (el.textContent || "").trim();
    if (t) segna("C12-finto-collegamento", t);
  }
  /* righe di tabella con puntatore: devono aprire qualcosa (ruolo di comando) */
  let righeCliccabili = 0;
  /* la tabella dei numeri di un grafico è già il dettaglio del grafico: non conta */
  const righeDati = Array.from(main.querySelectorAll("tbody tr")).filter((tr) => !tr.closest("[data-testid=chart-table]"));
  for (const tr of righeDati) if (tr.getAttribute("role") === "button" || tr.querySelector("a, button")) righeCliccabili++;
  const righe = righeDati.length;
  if (righe >= 5 && righeCliccabili === 0) segna("C12-tabella-senza-dettaglio", `${righe} righe`);

  /* C13 — aiuti: quanti indicatori e intestazioni hanno una spiegazione. */
  const aiuti = main.querySelectorAll("[data-info], [aria-describedby], [data-glossario], [data-spiegazione]").length;
  /* un'intestazione che si spiega da sé (Nome, Stato, Data…) non chiede aiuto: conta solo quella
     che porta un concetto del dominio */
  const OVVIE = /^(nome|titolo|stato|tipo|data|inizio|fine|creat[ao]|aggiornat[ao]|categoria|codice|azioni|descrizione|paese|attiv[ao]|email|telefono|sede|unità|persona|ruolo|posizione|note|valore|voce|quando|chi|da|a|origine)$/i;
  /* le intestazioni della tabella di un grafico sono le voci del grafico, già lette dalla sua frase */
  const thDati = Array.from(main.querySelectorAll("th")).filter((th) => !th.closest("[data-testid=chart-table]"));
  const intestazioni = thDati.filter((th) => !OVVIE.test((th.textContent || "").trim())).length + main.querySelectorAll("[data-kpi], .stats-card").length;
  if (intestazioni >= 4 && aiuti === 0) {
    const nomi = thDati.map((th) => (th.textContent || "").trim()).filter(Boolean);
    segna("C13-senza-spiegazioni", `${intestazioni} intestazioni, 0 aiuti: ${[...new Set(nomi)].slice(0, 12).join(" | ")}`);
  }

  /* C10 — dati di un'industria diversa: RTL è una banca, un CCNL di altro settore è un'incoerenza
     (per il mandato di piattaforma, che vede il catalogo, il rapporto lo legge per persona). */
  for (const { t } of testi) {
    if (/\b(commercio|terziario|metalmeccanic\w*|edil\w*|turismo|chimic\w*|tessil\w*|alimentar\w*)\b/i.test(t)) segna("C10-industria-diversa", t);
  }

  /* C15 — la pagina apre con gli insight */
  if (h1 && !document.querySelector("[data-testid=quadro-insight], [data-testid=page-no-access]")) segna("C15-senza-insight", (h1.textContent || "").trim());

  return {
    titolo: (h1?.textContent || "").trim(),
    altezzaSchermate: Math.round((altezza / schermo) * 10) / 10,
    tabelle: main.querySelectorAll("table").length,
    righe,
    esito,
  };
}

module.exports = { misuraPagina };
