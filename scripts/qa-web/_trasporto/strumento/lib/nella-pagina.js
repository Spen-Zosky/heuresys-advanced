// Codice che gira DENTRO la pagina (page.evaluate). Nessuna dipendenza.
// censisci(opz) restituisce: nodi interattivi, testi con i rilievi automatici, tabelle, grafici, immagini, misure di layout.
window.__qaWeb = {
  percorso(el) {
    const parti = [];
    while (el && el.nodeType === 1 && el !== document.documentElement) {
      let i = 1, s = el;
      while ((s = s.previousElementSibling)) if (s.tagName === el.tagName) i++;
      parti.unshift(el.tagName.toLowerCase() + ':nth-of-type(' + i + ')');
      el = el.parentElement;
    }
    return 'html>' + parti.join('>');
  },
  visibile(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.01;
  },
  nome(el) {
    const a = el.getAttribute('aria-label') || el.getAttribute('title') || '';
    const lab = (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')) || (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && el.closest('label'));
    return (a || (lab && lab.innerText) || el.innerText || el.value || el.getAttribute('placeholder') || el.getAttribute('alt') || '').trim().replace(/\s+/g, ' ').slice(0, 160);
  },
  tipo(el) {
    const t = el.tagName.toLowerCase(), r = (el.getAttribute('role') || '').toLowerCase(), ty = (el.getAttribute('type') || '').toLowerCase();
    if (r) return r;
    if (t === 'a') return 'link';
    if (t === 'select') return 'select';
    if (t === 'textarea') return 'textarea';
    if (t === 'input') return ['checkbox', 'radio', 'submit', 'button', 'reset', 'file', 'range', 'date', 'search'].includes(ty) ? ty : 'input';
    if (t === 'summary') return 'summary';
    if (t === 'th') return 'intestazione';
    if (t === 'tr') return 'riga';
    return t === 'button' ? 'button' : 'cliccabile';
  },
  censisci(opz) {
    const Q = this, out = { interattivi: [], testi: [], tabelle: [], grafici: [], immagini: [], layout: {}, dialoghi: 0, lingua: document.documentElement.lang || '' };
    const SEL = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab],[role=link],[role=menuitem],[role=menuitemcheckbox],[role=menuitemradio],[role=checkbox],[role=switch],[role=radio],[role=combobox],[role=option],[role=treeitem],[role=slider],[tabindex]:not([tabindex="-1"]),th[aria-sort],[onclick]';
    const visti = new Set();
    const aggiungi = (el, forzaTipo) => {
      if (visti.has(el) || !Q.visibile(el)) return;
      if (el.closest('[data-qa-web-ignora]')) return;
      visti.add(el);
      const r = el.getBoundingClientRect();
      out.interattivi.push({
        percorso: Q.percorso(el), tipo: forzaTipo || Q.tipo(el), nome: Q.nome(el), guscio: !!el.closest('nav,header,aside,[role=navigation],[role=banner],[role=complementary]'),
        href: el.getAttribute('href') || '', disabilitato: !!(el.disabled || el.getAttribute('aria-disabled') === 'true'),
        stato: el.getAttribute('aria-checked') || el.getAttribute('aria-selected') || el.getAttribute('aria-expanded') || (el.checked === true ? 'true' : el.checked === false ? 'false' : ''),
        opzioni: el.tagName === 'SELECT' ? [...el.options].map(o => o.value) : [],
        rett: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      });
    };
    document.querySelectorAll(SEL).forEach(el => aggiungi(el));
    // elementi resi cliccabili solo dal cursore (righe di tabella, schede, card)
    document.querySelectorAll('tr,li,div,span,td,article,section,svg g').forEach(el => {
      if (visti.has(el)) return;
      const cs = getComputedStyle(el);
      if (cs.cursor === 'pointer' && (!el.parentElement || getComputedStyle(el.parentElement).cursor !== 'pointer')) aggiungi(el, el.tagName === 'TR' ? 'riga' : 'cliccabile');
    });
    // testi: ogni elemento foglia con testo proprio
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const perEl = new Map();
    let n;
    while ((n = tw.nextNode())) {
      const t = n.nodeValue.replace(/\s+/g, ' ').trim();
      if (!t) continue;
      const el = n.parentElement;
      if (!el || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName) || !Q.visibile(el)) continue;
      perEl.set(el, ((perEl.get(el) || '') + ' ' + t).trim());
    }
    // attributi che l'utente legge: title, placeholder, aria-label, alt
    document.querySelectorAll('[title],[placeholder],[aria-label],img[alt]').forEach(el => {
      if (!Q.visibile(el)) return;
      for (const a of ['title', 'placeholder', 'aria-label', 'alt']) { const v = el.getAttribute(a); if (v && v.trim()) out.testi.push({ percorso: Q.percorso(el), testo: v.trim().slice(0, 300), attributo: a, troncato: false, fuori: false }); }
    });
    for (const [el, t] of perEl) {
      const cs = getComputedStyle(el);
      const troncato = (el.scrollWidth > el.clientWidth + 1 && (cs.overflow + cs.overflowX).includes('hidden')) || cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1 || (cs.webkitLineClamp && cs.webkitLineClamp !== 'none' && el.scrollHeight > el.clientHeight + 1);
      const r = el.getBoundingClientRect();
      const fuori = r.right > document.documentElement.clientWidth + 1 || r.left < -1;
      out.testi.push({ percorso: Q.percorso(el), testo: t.slice(0, 300), attributo: '', guscio: !!el.closest('nav,header,aside,[role=navigation],[role=banner],[role=complementary]'), troncato: !!troncato, haTitolo: !!(el.getAttribute('title') || el.closest('[title]')), fuori, colore: cs.color, sfondo: cs.backgroundColor, corpo: cs.fontSize });
    }
    document.querySelectorAll('table,[role=table],[role=grid]').forEach(tb => {
      if (!Q.visibile(tb)) return;
      const righe = [...tb.querySelectorAll('tr,[role=row]')];
      const intest = [...tb.querySelectorAll('th,[role=columnheader]')].map(h => Q.nome(h));
      let vuote = 0, celle = 0;
      righe.forEach(r => r.querySelectorAll('td,[role=cell],[role=gridcell]').forEach(c => { celle++; if (!c.innerText.trim() && !c.querySelector('svg,img,input,button')) vuote++; }));
      out.tabelle.push({ percorso: Q.percorso(tb), righe: righe.length, intestazioni: intest, celle, vuote });
    });
    document.querySelectorAll('.recharts-wrapper,canvas,svg[role=img],svg.recharts-surface,[data-chart],.apexcharts-canvas,.echarts,[class*=chart i]').forEach(g => {
      if (!Q.visibile(g) || g.closest('.recharts-wrapper') && g !== g.closest('.recharts-wrapper')) return;
      if (g.tagName !== 'CANVAS' && !g.querySelector('svg,canvas') && g.tagName.toLowerCase() !== 'svg') return;
      const r = g.getBoundingClientRect();
      if (r.width < 60 || r.height < 40) return;
      out.grafici.push({ percorso: Q.percorso(g), rett: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], etichetta: g.getAttribute('aria-label') || '' });
    });
    document.querySelectorAll('img').forEach(im => { if (Q.visibile(im)) out.immagini.push({ percorso: Q.percorso(im), rotta: im.complete && im.naturalWidth === 0, alt: im.getAttribute('alt') }); });
    out.testoPagina = document.body.innerText.slice(0, 200000);
    out.layout = { scorrimentoOrizzontale: document.documentElement.scrollWidth > window.innerWidth + 1, larghezza: window.innerWidth, titolo: document.title };
    out.dialoghi = document.querySelectorAll('[role=dialog],[role=alertdialog],dialog[open]').length;
    return out;
  },
  firma() {
    // impronta dello stato visibile: insieme dei controlli (tipo+nome) e dialoghi aperti; i numeri si tolgono
    const c = this.censisci();
    const s = c.interattivi.map(i => i.tipo + ':' + i.nome.replace(/\d+/g, '#')).sort().join('|') + '#dlg' + c.dialoghi;
    let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return String(h >>> 0);
  },
  tooltip() {
    const t = document.querySelector('.recharts-tooltip-wrapper,[role=tooltip],.apexcharts-tooltip,[data-radix-popper-content-wrapper]');
    if (!t || !this.visibile(t)) return '';
    return t.innerText.trim().slice(0, 200);
  },
};
