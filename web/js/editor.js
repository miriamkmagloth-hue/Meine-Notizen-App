// Der Text-Editor: Überschriften, Formatierung, Textmarker, Kontrollkästchen, Bilder, Sticker.
import { icon, toast, colorRow } from './ui.js';
import { TEXT_COLORS } from './theme.js';
import { fileToDataUrl, pickImageFile, cropDialog } from './imagetools.js';
import { pickSticker, addCustomSticker } from './stickers.js';

export const SIZES = [
  { name: 'Klein', value: '0.8em' },
  { name: 'Normal', value: '' },
  { name: 'Groß', value: '1.3em' },
  { name: 'Sehr groß', value: '1.7em' },
  { name: 'Riesig', value: '2.3em' },
];

export const HIGHLIGHTS = [
  { name: 'Gelb', color: '#fff0a0' },
  { name: 'Grün', color: '#c9f2c4' },
  { name: 'Rosa', color: '#ffd0e1' },
  { name: 'Blau', color: '#cfe5ff' },
  { name: 'Orange', color: '#ffdcb5' },
];

const ALLOWED = new Set(['P', 'DIV', 'BR', 'H1', 'H2', 'H3', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'UL', 'OL', 'LI', 'SPAN', 'MARK', 'IMG', 'BLOCKQUOTE']);

/** Bereinigt eingefügtes HTML auf das, was der Editor versteht. */
export function sanitize(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const walk = node => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) continue;
      if (child.nodeType !== 1) { child.remove(); continue; }
      let tag = child.tagName;
      if (['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'IFRAME', 'OBJECT', 'SVG'].includes(tag)) { child.remove(); continue; }
      walk(child);
      if (!ALLOWED.has(tag)) {
        if (/^H[4-6]$/.test(tag)) { const h = document.createElement('h3'); h.append(...child.childNodes); child.replaceWith(h); continue; }
        child.replaceWith(...child.childNodes);
        continue;
      }
      const keep = {};
      if (tag === 'IMG') {
        const src = child.getAttribute('src') || '';
        if (!src.startsWith('data:image/')) { child.remove(); continue; }
        keep.src = src;
        const cls = child.getAttribute('class') || '';
        keep.class = /sticker/.test(cls) ? cls.replace(/\bis-selected\b/, '').trim() : (/note-img/.test(cls) ? cls : 'note-img size-m');
      }
      if (tag === 'UL' && child.classList.contains('checklist')) keep.class = 'checklist';
      if (tag === 'LI' && child.hasAttribute('data-checked')) keep['data-checked'] = child.getAttribute('data-checked');
      if (tag === 'SPAN' || tag === 'MARK') {
        const st = [];
        const bg = child.style.backgroundColor;
        if (bg && bg !== 'transparent' && !/rgba\(0, 0, 0, 0\)/.test(bg)) st.push(`background-color: ${bg};`);
        if (child.style.color) st.push(`color: ${child.style.color};`);
        if (/^[\d.]+em$/.test(child.style.fontSize)) st.push(`font-size: ${child.style.fontSize};`);
        if (st.length) keep.style = st.join(' ');
      }
      for (const a of [...child.attributes]) child.removeAttribute(a.name);
      for (const [k, v] of Object.entries(keep)) child.setAttribute(k, v);
      if ((tag === 'SPAN') && !child.getAttribute('style')) child.replaceWith(...child.childNodes);
    }
  };
  walk(doc.body);
  return doc.body.innerHTML;
}

export class Editor {
  constructor(container, { onChange } = {}) {
    this.onChange = onChange || (() => {});
    this.root = container;
    this.root.innerHTML = `
      <div class="toolbar" role="toolbar">
        <button data-cmd="block" title="Absatzformat" class="tb-block">${icon('heading')}<span class="tb-label">Text</span></button>
        <span class="sep"></span>
        <button data-cmd="bold" title="Fett">${icon('bold')}</button>
        <button data-cmd="italic" title="Kursiv">${icon('italic')}</button>
        <button data-cmd="underline" title="Unterstreichen">${icon('underline')}</button>
        <button data-cmd="strikeThrough" title="Durchstreichen">${icon('strike')}</button>
        <button data-cmd="highlight" title="Markieren" class="tb-hl">${icon('highlight')}<span class="hl-swatch"></span></button>
        <button data-cmd="color" title="Schriftfarbe" class="tb-hl">${icon('textColor')}<span class="fc-swatch"></span></button>
        <button data-cmd="size" title="Schriftgröße">${icon('textSize')}</button>
        <span class="sep"></span>
        <button data-cmd="checklist" title="Kontrollkästchen">${icon('check')}</button>
        <button data-cmd="bullets" title="Aufzählung">${icon('bullets')}</button>
        <button data-cmd="numbers" title="Nummerierung">${icon('numbers')}</button>
        <span class="sep"></span>
        <button data-cmd="image" title="Bild einfügen">${icon('image')}</button>
        <button data-cmd="sticker" title="Sticker einfügen">${icon('sticker')}</button>
        <span class="sep"></span>
        <button data-cmd="undo" title="Rückgängig">${icon('undo')}</button>
        <button data-cmd="redo" title="Wiederholen">${icon('redo')}</button>
      </div>
      <div class="hl-pop hidden"></div>
      <div class="fc-pop hidden"></div>
      <div class="size-pop hidden">${SIZES.map(x => `<button data-size="${x.value}"><span style="font-size:${x.value ? `calc(15px * ${parseFloat(x.value)})` : '15px'}">${x.name}</span></button>`).join('')}</div>
      <div class="block-pop hidden">
        <button data-block="h1"><span class="bp-h1">Titel</span></button>
        <button data-block="h2"><span class="bp-h2">Überschrift</span></button>
        <button data-block="h3"><span class="bp-h3">Zwischenüberschrift</span></button>
        <button data-block="p"><span>Text</span></button>
      </div>
      <div class="content" contenteditable="true" spellcheck="true" lang="de"></div>
      <div class="img-pop hidden"></div>`;
    this.toolbar = this.root.querySelector('.toolbar');
    this.content = this.root.querySelector('.content');
    this.hlPop = this.root.querySelector('.hl-pop');
    this.blockPop = this.root.querySelector('.block-pop');
    this.imgPop = this.root.querySelector('.img-pop');
    this.fcPop = this.root.querySelector('.fc-pop');
    this.sizePop = this.root.querySelector('.size-pop');
    this.pops = [this.hlPop, this.blockPop, this.fcPop, this.sizePop];
    this.fcColor = localStorage.getItem('fcColor') || '#d6453d';
    this.root.querySelector('.fc-swatch').style.background = this.fcColor;
    this.fcPop.append(colorRow(TEXT_COLORS, null, (c, how) => { this.applyInline('color', c); if (how === 'swatch') this.fcPop.classList.add('hidden'); }, { noneLabel: 'Standard' }));
    this.savedRange = null;
    this.selectedImg = null;
    this.hlColor = localStorage.getItem('hlColor') || HIGHLIGHTS[0].color;
    this.root.querySelector('.hl-swatch').style.background = this.hlColor;

    this.hlPop.innerHTML = HIGHLIGHTS.map(h => `<button data-hl="${h.color}" title="${h.name}" style="background:${h.color}"></button>`).join('') +
      `<button data-hl="none" title="Markierung entfernen" class="hl-none">${icon('close')}</button>`;

    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* egal */ }
    this.bind();
  }

  // ---------- Inhalt ----------
  setHTML(html) {
    this.deselectImage();
    this.content.innerHTML = html && html.trim() ? html : '<p><br></p>';
    this.normalize();
  }

  getHTML() {
    const clone = this.content.cloneNode(true);
    clone.querySelectorAll('.is-selected').forEach(n => n.classList.remove('is-selected'));
    clone.querySelectorAll('[class=""]').forEach(n => n.removeAttribute('class'));
    return clone.innerHTML;
  }

  /** Lesemodus (nur lesen und abhaken) oder Bearbeitungsmodus. */
  setReadOnly(ro) {
    this.readOnly = !!ro;
    this.content.contentEditable = ro ? 'false' : 'true';
    this.root.classList.toggle('read-only', this.readOnly);
    if (ro) {
      this.deselectImage();
      this.pops.forEach(p => p.classList.add('hidden'));
      if (document.activeElement === this.content) this.content.blur();
    }
  }

  focus(atEnd = true) {
    this.content.focus();
    if (atEnd) {
      const r = document.createRange();
      r.selectNodeContents(this.content);
      r.collapse(false);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    }
  }

  changed() {
    this.normalize();
    this.onChange(this.getHTML());
  }

  /** Lose Textstücke in Absätze packen, leeren Editor mit einem Absatz füllen. */
  normalize() {
    const c = this.content;
    for (const n of [...c.childNodes]) {
      if (n.nodeType === 3 && n.textContent.trim() === '' && !n.textContent.includes(' ')) { n.remove(); continue; }
      if (n.nodeType === 3 || (n.nodeType === 1 && ['B', 'I', 'U', 'S', 'SPAN', 'STRONG', 'EM', 'IMG', 'BR'].includes(n.tagName))) {
        const p = document.createElement('p');
        c.insertBefore(p, n);
        p.append(n);
        while (p.nextSibling && (p.nextSibling.nodeType === 3 || ['B', 'I', 'U', 'S', 'SPAN', 'STRONG', 'EM', 'IMG'].includes(p.nextSibling.tagName))) p.append(p.nextSibling);
      } else if (n.nodeType === 1 && n.tagName === 'DIV' && !n.className) {
        const p = document.createElement('p');
        p.append(...n.childNodes);
        n.replaceWith(p);
      }
    }
    if (!c.firstChild) c.innerHTML = '<p><br></p>';
    // Nach einer Liste am Ende immer eine Zeile zum Weiterschreiben lassen
    const last = c.lastElementChild;
    if (last && (last.tagName === 'UL' || last.tagName === 'OL')) {
      /* bewusst nichts tun: Enter in leerem Punkt beendet die Liste */
    }
    c.querySelectorAll('ol.checklist').forEach(ol => ol.classList.remove('checklist'));
    c.querySelectorAll('ul:not(.checklist) > li[data-checked], ol > li[data-checked]').forEach(li => li.removeAttribute('data-checked'));
    c.querySelectorAll('ul.checklist > li:not([data-checked])').forEach(li => li.setAttribute('data-checked', 'false'));
  }

  // ---------- Auswahl ----------
  saveSelection() {
    const s = getSelection();
    if (s.rangeCount && this.content.contains(s.getRangeAt(0).commonAncestorContainer)) this.savedRange = s.getRangeAt(0).cloneRange();
  }

  restoreSelection() {
    if (document.activeElement !== this.content) this.content.focus({ preventScroll: true });
    const s = getSelection();
    if (this.savedRange && (!s.rangeCount || !this.content.contains(s.getRangeAt(0).commonAncestorContainer))) {
      s.removeAllRanges();
      s.addRange(this.savedRange);
    }
  }

  currentBlock(node) {
    if (!node) {
      const s = getSelection();
      if (!s.rangeCount) return null;
      node = s.getRangeAt(0).startContainer;
    }
    while (node && node !== this.content) {
      if (node.nodeType === 1 && (node.tagName === 'LI' || node.parentNode === this.content)) return node;
      node = node.parentNode;
    }
    return null;
  }

  /** Alle Blöcke (Absätze bzw. Listenpunkte), die von der Auswahl berührt werden. */
  selectedBlocks() {
    const s = getSelection();
    if (!s.rangeCount) return [];
    const range = s.getRangeAt(0);
    const out = [];
    for (const child of this.content.children) {
      if (!range.intersectsNode(child)) continue;
      if (child.tagName === 'UL' || child.tagName === 'OL') {
        for (const li of child.children) if (range.intersectsNode(li)) out.push(li);
      } else out.push(child);
    }
    if (!out.length) { const b = this.currentBlock(); if (b) out.push(b); }
    return out;
  }

  placeCaret(node, atEnd = true) {
    const r = document.createRange();
    r.selectNodeContents(node);
    r.collapse(!atEnd);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }

  // ---------- Befehle ----------
  exec(cmd, value = null) {
    this.restoreSelection();
    document.execCommand(cmd, false, value);
    this.changed();
    this.updateToolbar();
  }

  setBlock(tag) {
    this.restoreSelection();
    for (const li of this.selectedBlocks().filter(b => b.tagName === 'LI')) this.liftLi(li);
    document.execCommand('formatBlock', false, tag);
    this.changed();
    this.updateToolbar();
  }

  liftLi(li) {
    const list = li.parentNode;
    const p = document.createElement('p');
    p.innerHTML = li.innerHTML || '<br>';
    const after = [];
    for (let n = li.nextSibling; n; n = n.nextSibling) after.push(n);
    list.after(p);
    if (after.length) {
      const rest = list.cloneNode(false);
      after.forEach(n => rest.append(n));
      p.after(rest);
    }
    li.remove();
    if (!list.children.length) list.remove();
    return p;
  }

  toggleChecklist() {
    this.restoreSelection();
    const blocks = this.selectedBlocks();
    if (!blocks.length) return;
    const allChecks = blocks.every(b => b.tagName === 'LI' && b.parentNode.classList.contains('checklist'));
    let last;
    if (allChecks) {
      for (const li of blocks) last = this.liftLi(li);
    } else {
      // Normale Listen umwandeln
      const lists = new Set(blocks.filter(b => b.tagName === 'LI').map(b => b.parentNode));
      for (const list of lists) {
        let ul = list;
        if (list.tagName === 'OL') { ul = document.createElement('ul'); ul.append(...list.childNodes); list.replaceWith(ul); }
        ul.classList.add('checklist');
        ul.querySelectorAll(':scope > li').forEach(li => { if (!li.hasAttribute('data-checked')) li.setAttribute('data-checked', 'false'); });
        last = ul.lastElementChild;
      }
      // Absätze in Kontrollkästchen umwandeln
      const paras = blocks.filter(b => b.tagName !== 'LI');
      if (paras.length) {
        const ul = document.createElement('ul');
        ul.className = 'checklist';
        paras[0].before(ul);
        for (const p of paras) {
          const li = document.createElement('li');
          li.setAttribute('data-checked', 'false');
          li.innerHTML = p.innerHTML || '<br>';
          ul.append(li);
          p.remove();
          last = li;
        }
        this.mergeLists(ul);
      }
    }
    if (last) this.placeCaret(last);
    this.changed();
    this.updateToolbar();
  }

  mergeLists(ul) {
    const prev = ul.previousElementSibling;
    if (prev && prev.tagName === 'UL' && prev.classList.contains('checklist')) { prev.append(...ul.childNodes); ul.remove(); ul = prev; }
    const next = ul.nextElementSibling;
    if (next && next.tagName === 'UL' && next.classList.contains('checklist')) { ul.append(...next.childNodes); next.remove(); }
  }

  toggleList(ordered) {
    this.restoreSelection();
    const blocks = this.selectedBlocks();
    const checkLists = new Set(blocks.filter(b => b.tagName === 'LI' && b.parentNode.classList.contains('checklist')).map(b => b.parentNode));
    if (checkLists.size && !ordered) {
      for (const ul of checkLists) { ul.classList.remove('checklist'); ul.querySelectorAll('li').forEach(li => li.removeAttribute('data-checked')); }
      this.changed();
      return;
    }
    document.execCommand(ordered ? 'insertOrderedList' : 'insertUnorderedList');
    this.changed();
    this.updateToolbar();
  }

  highlight(color) {
    this.restoreSelection();
    const s = getSelection();
    if (s.isCollapsed) { toast('Erst Text auswählen, dann markieren'); return; }
    document.execCommand('styleWithCSS', false, true);
    document.execCommand('hiliteColor', false, color === 'none' ? 'transparent' : color);
    document.execCommand('styleWithCSS', false, false);
    if (color === 'none') {
      this.content.querySelectorAll('span[style]').forEach(sp => {
        const bg = sp.style.backgroundColor;
        if (bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') { sp.style.backgroundColor = ''; if (!sp.getAttribute('style')) sp.replaceWith(...sp.childNodes); }
      });
    } else {
      this.hlColor = color;
      localStorage.setItem('hlColor', color);
      this.root.querySelector('.hl-swatch').style.background = color;
    }
    this.changed();
  }

  /** Farbe oder Größe auf den markierten Text anwenden (value leer = zurücksetzen). */
  applyInline(prop, value) {
    this.restoreSelection();
    const sel = getSelection();
    if (!sel.rangeCount || sel.isCollapsed) { toast('Erst Text auswählen'); return; }
    document.execCommand('styleWithCSS', false, false);
    document.execCommand('fontSize', false, '7');
    const fonts = [...this.content.querySelectorAll('font[size="7"]')];
    const made = [];
    for (const f of fonts) {
      f.querySelectorAll('span').forEach(sp => {
        sp.style[prop] = '';
        if (!sp.getAttribute('style')) sp.replaceWith(...sp.childNodes);
      });
      const parent = f.parentElement;
      if (!value && parent && parent.tagName === 'SPAN' && parent.childNodes.length === 1) {
        parent.style[prop] = '';
        if (!parent.getAttribute('style')) { parent.replaceWith(...parent.childNodes); }
      }
      if (value) {
        const span = document.createElement('span');
        span.style[prop] = value;
        span.append(...f.childNodes);
        f.replaceWith(span);
        made.push(span);
      } else {
        f.replaceWith(...f.childNodes);
      }
    }
    if (made.length) {
      const r = document.createRange();
      r.setStartBefore(made[0]);
      r.setEndAfter(made[made.length - 1]);
      sel.removeAllRanges();
      sel.addRange(r);
      this.saveSelection();
    }
    if (prop === 'color' && value) {
      this.fcColor = value;
      localStorage.setItem('fcColor', value);
      this.root.querySelector('.fc-swatch').style.background = value;
    }
    this.changed();
  }

  insertHTMLAtCaret(html) {
    this.restoreSelection();
    document.execCommand('insertHTML', false, html);
    this.changed();
  }

  async insertImageFromFile(file) {
    try {
      const url = await fileToDataUrl(file);
      this.insertHTMLAtCaret(`<img class="note-img size-m" src="${url}" alt=""><br>`);
    } catch (e) { toast(e.message); }
  }

  async insertImage() {
    this.saveSelection();
    const file = await pickImageFile();
    if (!file) return;
    toast('Bild wird eingefügt …');
    await this.insertImageFromFile(file);
  }

  async insertSticker() {
    this.saveSelection();
    const src = await pickSticker();
    if (src) this.insertHTMLAtCaret(`<img class="sticker size-m" src="${src}" alt="">`);
  }

  updateToolbar() {
    const q = c => { try { return document.queryCommandState(c); } catch { return false; } };
    for (const c of ['bold', 'italic', 'underline', 'strikeThrough']) {
      this.toolbar.querySelector(`[data-cmd=${c}]`)?.classList.toggle('on', q(c));
    }
    const b = this.currentBlock();
    const inCheck = b && b.tagName === 'LI' && b.parentNode.classList.contains('checklist');
    this.toolbar.querySelector('[data-cmd=checklist]').classList.toggle('on', !!inCheck);
    this.toolbar.querySelector('[data-cmd=bullets]').classList.toggle('on', !!(b && b.tagName === 'LI' && b.parentNode.tagName === 'UL' && !inCheck));
    this.toolbar.querySelector('[data-cmd=numbers]').classList.toggle('on', !!(b && b.tagName === 'LI' && b.parentNode.tagName === 'OL'));
    const label = { H1: 'Titel', H2: 'Überschrift', H3: 'Zwischen­überschrift' }[b?.tagName] || 'Text';
    this.toolbar.querySelector('.tb-label').innerHTML = label;
  }

  // ---------- Bilder & Sticker auswählen ----------
  selectImage(img) {
    this.deselectImage();
    this.selectedImg = img;
    img.classList.add('is-selected');
    const isSticker = img.classList.contains('sticker');
    this.imgPop.innerHTML = `
      ${isSticker ? '' : `<button data-img="crop">${icon('crop')}<span>Zuschneiden</span></button>`}
      <button data-img="size-s" class="${img.classList.contains('size-s') ? 'on' : ''}">S</button>
      <button data-img="size-m" class="${img.classList.contains('size-m') ? 'on' : ''}">M</button>
      <button data-img="size-l" class="${img.classList.contains('size-l') ? 'on' : ''}">L</button>
      ${isSticker ? '' : `<button data-img="sticker">${icon('sticker')}<span>Als Sticker</span></button>`}
      <button data-img="delete" class="danger">${icon('trash')}</button>`;
    this.imgPop.classList.remove('hidden');
    this.positionImgPop();
  }

  positionImgPop() {
    if (!this.selectedImg) return;
    const r = this.selectedImg.getBoundingClientRect();
    const host = this.root.getBoundingClientRect();
    const popW = this.imgPop.offsetWidth;
    let left = r.left - host.left + r.width / 2 - popW / 2;
    left = Math.max(8, Math.min(left, host.width - popW - 8));
    let top = r.top - host.top - this.imgPop.offsetHeight - 8;
    if (r.top - this.imgPop.offsetHeight < 70) top = r.bottom - host.top + 8;
    this.imgPop.style.left = left + 'px';
    this.imgPop.style.top = top + 'px';
  }

  deselectImage() {
    if (this.selectedImg) this.selectedImg.classList.remove('is-selected');
    this.selectedImg = null;
    this.imgPop?.classList.add('hidden');
  }

  async imageAction(act) {
    const img = this.selectedImg;
    if (!img) return;
    if (act.startsWith('size-')) {
      img.classList.remove('size-s', 'size-m', 'size-l');
      img.classList.add(act);
      this.changed();
      this.selectImage(img);
    } else if (act === 'delete') {
      this.deselectImage();
      img.remove();
      this.changed();
    } else if (act === 'crop') {
      const out = await cropDialog(img.src);
      if (out && out !== img.src) { img.src = out; this.changed(); }
      this.selectImage(img);
    } else if (act === 'sticker') {
      const out = await cropDialog(img.src, { title: 'Sticker erstellen', applyLabel: 'Als Sticker speichern' });
      if (out) { await addCustomSticker(out); toast('In „Meine Sticker“ gespeichert'); }
    }
  }

  // ---------- Ereignisse ----------
  bind() {
    const c = this.content;
    // Toolbar-Klicks sollen die Textauswahl nicht verlieren
    for (const pop of [this.toolbar, this.hlPop, this.blockPop, this.imgPop, this.sizePop]) {
      pop.addEventListener('mousedown', e => e.preventDefault());
    }
    this.fcPop.addEventListener('mousedown', e => { if (!e.target.closest('label')) e.preventDefault(); });
    this.sizePop.addEventListener('click', e => {
      const b = e.target.closest('[data-size]');
      if (!b) return;
      this.applyInline('fontSize', b.dataset.size);
      this.sizePop.classList.add('hidden');
    });
    document.addEventListener('selectionchange', () => {
      if (document.activeElement === c) { this.saveSelection(); this.updateToolbar(); }
    });

    this.toolbar.addEventListener('click', e => {
      const b = e.target.closest('button[data-cmd]');
      if (!b) return;
      const cmd = b.dataset.cmd;
      const popFor = { highlight: this.hlPop, block: this.blockPop, color: this.fcPop, size: this.sizePop };
      this.pops.forEach(p => { if (p !== popFor[cmd]) p.classList.add('hidden'); });
      switch (cmd) {
        case 'bold': case 'italic': case 'underline': case 'strikeThrough': case 'undo': case 'redo':
          this.exec(cmd); break;
        case 'checklist': this.toggleChecklist(); break;
        case 'bullets': this.toggleList(false); break;
        case 'numbers': this.toggleList(true); break;
        case 'image': this.insertImage(); break;
        case 'sticker': this.insertSticker(); break;
        case 'highlight': {
          const s = getSelection();
          const hasSel = s.rangeCount && !s.isCollapsed && c.contains(s.anchorNode);
          // Mit Auswahl: sofort in der zuletzt verwendeten Farbe markieren und Farben zur Wahl zeigen
          if (hasSel && this.hlPop.classList.contains('hidden')) {
            this.highlight(this.hlColor);
            this.togglePop(this.hlPop, b, true);
          } else {
            this.togglePop(this.hlPop, b);
          }
          break;
        }
        case 'block': this.togglePop(this.blockPop, b); break;
        case 'color': this.togglePop(this.fcPop, b); break;
        case 'size': this.togglePop(this.sizePop, b); break;
      }
    });
    // Langes Drücken / Rechtsklick auf den Marker öffnet die Farbauswahl
    const hlBtn = this.toolbar.querySelector('[data-cmd=highlight]');
    hlBtn.addEventListener('contextmenu', e => { e.preventDefault(); this.togglePop(this.hlPop, hlBtn, true); });

    this.hlPop.addEventListener('click', e => {
      const b = e.target.closest('[data-hl]');
      if (!b) return;
      this.highlight(b.dataset.hl);
      this.hlPop.classList.add('hidden');
    });
    this.blockPop.addEventListener('click', e => {
      const b = e.target.closest('[data-block]');
      if (!b) return;
      this.setBlock(b.dataset.block);
      this.blockPop.classList.add('hidden');
    });
    this.imgPop.addEventListener('click', e => {
      const b = e.target.closest('[data-img]');
      if (b) this.imageAction(b.dataset.img);
    });

    // Kontrollkästchen abhaken
    const checkHit = e => {
      const t = e.target.nodeType === 1 ? e.target : e.target.parentElement;
      let li = t?.closest?.('ul.checklist > li');
      // Tipp knapp neben den Punkt: passenden Eintrag über die Höhe finden
      if (!li && t?.matches?.('ul.checklist')) li = [...t.children].find(x => { const r = x.getBoundingClientRect(); return e.clientY >= r.top && e.clientY <= r.bottom; });
      if (!li) return null;
      if (this.readOnly) return li; // im Lesemodus hakt ein Tipp auf die ganze Zeile ab
      const r = li.getBoundingClientRect();
      return e.clientX - r.left < 40 ? li : null;
    };
    c.addEventListener('mousedown', e => { if (checkHit(e)) e.preventDefault(); });
    c.addEventListener('click', e => {
      const li = checkHit(e);
      if (li) {
        e.preventDefault();
        li.setAttribute('data-checked', li.getAttribute('data-checked') === 'true' ? 'false' : 'true');
        this.changed();
        return;
      }
      if (this.readOnly) return;
      if (e.target.tagName === 'IMG') { this.selectImage(e.target); return; }
      this.deselectImage();
    });

    c.addEventListener('input', e => {
      if (e.inputType === 'insertParagraph') {
        const b = this.currentBlock();
        if (b && b.tagName === 'LI' && b.parentNode.classList.contains('checklist')) b.setAttribute('data-checked', 'false');
        // Neue Zeile nach Überschrift wird wieder normaler Text
        if (b && /^H[1-3]$/.test(b.tagName) && b.textContent === '') document.execCommand('formatBlock', false, 'p');
      }
      this.changed();
    });

    c.addEventListener('keydown', e => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'u') { e.preventDefault(); this.exec('underline'); }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'h') { e.preventDefault(); this.highlight(this.hlColor); }
      if (mod && e.key === 'Enter') { e.preventDefault(); this.toggleChecklist(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedImg) { e.preventDefault(); this.imageAction('delete'); }
      // Markdown-Kürzel am Zeilenanfang: "[] " → Kontrollkästchen, "# " → Überschrift
      if (e.key === ' ') {
        const b = this.currentBlock();
        if (b && b.tagName === 'P') {
          const t = b.textContent;
          const map = { '#': 'h1', '##': 'h2', '###': 'h3' };
          if (t === '[]' || t === '[ ]') { e.preventDefault(); b.innerHTML = '<br>'; this.placeCaret(b); this.toggleChecklist(); }
          else if (map[t]) { e.preventDefault(); b.innerHTML = '<br>'; this.placeCaret(b); this.setBlock(map[t]); }
          else if (t === '-' || t === '*') { e.preventDefault(); b.innerHTML = '<br>'; this.placeCaret(b); this.toggleList(false); }
        }
      }
    });

    c.addEventListener('paste', async e => {
      const items = [...(e.clipboardData?.items || [])];
      const imgItem = items.find(i => i.type.startsWith('image/'));
      if (imgItem) {
        e.preventDefault();
        this.saveSelection();
        await this.insertImageFromFile(imgItem.getAsFile());
        return;
      }
      const html = e.clipboardData?.getData('text/html');
      e.preventDefault();
      if (html) document.execCommand('insertHTML', false, sanitize(html));
      else document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
      this.changed();
    });

    c.addEventListener('drop', async e => {
      const file = [...(e.dataTransfer?.files || [])].find(f => f.type.startsWith('image/'));
      if (!file) return;
      e.preventDefault();
      const r = document.caretRangeFromPoint?.(e.clientX, e.clientY);
      if (r) { const s = getSelection(); s.removeAllRanges(); s.addRange(r); this.saveSelection(); }
      await this.insertImageFromFile(file);
    });

    document.addEventListener('click', e => {
      if (!this.root.contains(e.target) || !e.target.closest('.toolbar, .hl-pop, .block-pop, .fc-pop, .size-pop')) {
        this.pops.forEach(p => p.classList.add('hidden'));
      }
    });
    window.addEventListener('resize', () => this.positionImgPop());
    this.root.closest('.scroll-host')?.addEventListener('scroll', () => this.positionImgPop(), { passive: true });
  }

  togglePop(pop, anchor, forceOpen = false) {
    const willOpen = forceOpen || pop.classList.contains('hidden');
    this.pops.forEach(p => p.classList.add('hidden'));
    if (!willOpen) return;
    pop.classList.remove('hidden');
    const r = anchor.getBoundingClientRect();
    const host = this.root.getBoundingClientRect();
    let left = r.left - host.left;
    left = Math.max(4, Math.min(left, host.width - pop.offsetWidth - 4));
    pop.style.left = left + 'px';
    pop.style.top = (r.bottom - host.top + 6) + 'px';
  }
}
