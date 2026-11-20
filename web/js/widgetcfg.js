// Einrichtung eines Widgets (nur Android): Notiz wählen, Hintergrund, Transparenz, Schriftfarbe.
import * as model from './model.js';
import * as db from './db.js';
import { el, esc, icon, colorRow, segmented, toast } from './ui.js';
import { call } from './native.js';
import { BG_COLORS, TEXT_COLORS, luminance, inkFor, measureLum, overlayCss, imageLum, hexToRgb } from './theme.js';
import { pickImageFile, fileToDataUrl, cropDialog, loadImage } from './imagetools.js';
import { pushNote, noteToBlocks } from './widget.js';

const WIDGET_IMG_MAX = 900;

async function bake(src, dim) {
  const img = await loadImage(src);
  const scale = Math.min(1, WIDGET_IMG_MAX / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0, c.width, c.height);
  x.fillStyle = overlayCss(dim);
  x.fillRect(0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.86);
}

export async function openWidgetConfig() {
  let cfg = {};
  try { cfg = JSON.parse(call('getWidgetConfig') || '{}'); } catch { cfg = {}; }
  const widgetId = cfg.widgetId;
  const stored = (await db.get('kv', 'widgetbg_' + widgetId)) || null; // Originalfoto zum erneuten Bearbeiten
  const st = {
    noteId: cfg.noteId || '',
    bgType: cfg.bgType || 'default',
    color: cfg.color || BG_COLORS[3],
    alpha: typeof cfg.alpha === 'number' ? cfg.alpha : 100,
    dim: typeof cfg.dim === 'number' ? cfg.dim : 0,
    lum: cfg.lum,
    text: cfg.text || null,
    image: stored?.image || '',
  };
  const originalDim = st.dim;
  let imageChanged = false;

  const notes = model.active('note').sort((a, b) => (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt));
  const books = Object.fromEntries(model.active('notebook').map(b => [b.id, b]));

  const root = el(`<div class="wcfg">
    <div class="wcfg-card">
      <header class="wcfg-head"><h2>Widget einrichten</h2></header>
      <div class="wcfg-scroll">
        <div class="wcfg-preview-wrap"><div class="wcfg-preview"><div class="wp-bg"></div><div class="wp-body"><div class="wp-title"></div><div class="wp-rows"></div></div></div></div>
        <section><h3>Notiz</h3>
          <div class="search-box small-search"><span>${icon('search')}</span><input type="search" placeholder="Notiz suchen"></div>
          <div class="wcfg-notes"></div>
        </section>
        <section><h3>Hintergrund</h3><div class="wb-type"></div><div class="wb-panel"></div>
          <label class="dim-label alpha-label">Deckkraft <input type="range" min="0" max="100" step="5" class="alpha"> <span class="alpha-val"></span></label>
        </section>
        <section><h3>Schriftfarbe</h3><div class="wt-row"></div></section>
      </div>
      <footer class="wcfg-foot"><button class="btn" data-a="cancel">Abbrechen</button><button class="btn primary" data-a="save">Fertig</button></footer>
    </div>
  </div>`);
  document.body.append(root);

  const preview = root.querySelector('.wcfg-preview');
  const textColor = () => {
    if (st.text) return st.text;
    if (st.bgType === 'color') return inkFor(luminance(st.color));
    if (st.bgType === 'image' && st.image) return inkFor(imageLum({ lum: st.lum, dim: st.dim }));
    return '';
  };
  const renderPreview = () => {
    const bgEl = preview.querySelector('.wp-bg');
    bgEl.style.background = '';
    bgEl.style.opacity = st.alpha / 100;
    if (st.bgType === 'color') bgEl.style.background = st.color;
    else if (st.bgType === 'image' && st.image) bgEl.style.background = `linear-gradient(${overlayCss(st.dim)}, ${overlayCss(st.dim)}), url("${st.image}") center / cover`;
    else bgEl.style.background = 'var(--card)';
    const ink = textColor();
    preview.style.color = ink || '';
    const note = model.find('note', st.noteId);
    preview.querySelector('.wp-title').textContent = note ? model.noteTitle(note) : 'Notiz auswählen';
    const blocks = note ? noteToBlocks(note.html).slice(0, 5) : [];
    preview.querySelector('.wp-rows').innerHTML = blocks.map(b => b.t === 'c'
      ? `<div class="wp-row ${b.c ? 'done' : ''}"><span class="wp-chk"></span>${esc(b.x)}</div>`
      : `<div class="wp-row ${b.t === 'h' ? 'h' : ''}">${esc(b.x)}</div>`).join('') || '<div class="wp-row muted">Leere Notiz</div>';
    root.querySelector('.alpha').value = st.alpha;
    root.querySelector('.alpha-val').textContent = st.alpha + ' %';
  };

  // Notizliste
  const list = root.querySelector('.wcfg-notes');
  const renderNotes = q => {
    q = (q || '').toLowerCase();
    const shown = notes.filter(n => !q || model.noteTitle(n).toLowerCase().includes(q) || (n.text || '').toLowerCase().includes(q));
    list.innerHTML = shown.map(n => {
      const b = books[n.notebookId];
      return `<button class="wcfg-note ${n.id === st.noteId ? 'on' : ''}" data-id="${esc(n.id)}"><span class="radio"></span><span class="wn-text"><b>${esc(model.noteTitle(n))}</b><small>${b ? `<span class="dot" style="background:${esc(b.color)}"></span>${esc(b.name)}` : ''}</small></span></button>`;
    }).join('') || '<p class="muted">Noch keine Notizen. Öffne zuerst die App und lege eine Notiz an.</p>';
  };
  renderNotes();
  list.addEventListener('click', e => {
    const b = e.target.closest('.wcfg-note');
    if (!b) return;
    st.noteId = b.dataset.id;
    list.querySelectorAll('.wcfg-note').forEach(x => x.classList.toggle('on', x === b));
    renderPreview();
  });
  root.querySelector('.small-search input').addEventListener('input', e => renderNotes(e.target.value));

  // Hintergrund
  const panel = root.querySelector('.wb-panel');
  const renderPanel = () => {
    panel.innerHTML = '';
    if (st.bgType === 'color') panel.append(colorRow(BG_COLORS, st.color, c => { st.color = c; renderPreview(); }));
    if (st.bgType === 'image') {
      const box = el(`<div class="bg-image-tools">
        <button type="button" class="btn small pick">${icon('image')} ${st.image ? 'Anderes Foto' : 'Foto wählen'}</button>
        <label class="dim-label">Abdunkeln <input type="range" min="-70" max="70" step="5" class="dim"> Aufhellen</label></div>`);
      const dim = box.querySelector('.dim');
      dim.value = Math.round(st.dim * 100);
      dim.addEventListener('input', () => { st.dim = Number(dim.value) / 100; renderPreview(); });
      box.querySelector('.pick').onclick = async () => {
        const file = await pickImageFile();
        if (!file) return;
        const url = await fileToDataUrl(file, 1400);
        const cropped = await cropDialog(url, { title: 'Widget-Hintergrund zuschneiden', applyLabel: 'Verwenden' });
        if (!cropped) return;
        st.image = cropped;
        st.lum = await measureLum(cropped);
        imageChanged = true;
        renderPanel();
        renderPreview();
      };
      panel.append(box);
    }
  };
  root.querySelector('.wb-type').append(segmented([
    { value: 'default', label: 'Standard' }, { value: 'color', label: 'Farbe' }, { value: 'image', label: 'Foto' },
  ], st.bgType, v => { st.bgType = v; renderPanel(); renderPreview(); }));
  renderPanel();
  root.querySelector('.alpha').addEventListener('input', e => { st.alpha = Number(e.target.value); renderPreview(); });

  root.querySelector('.wt-row').append(colorRow(TEXT_COLORS, st.text, c => { st.text = c; renderPreview(); }, { noneLabel: 'Automatisch' }));
  renderPreview();

  root.querySelector('.wcfg-foot').addEventListener('click', async e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'cancel') { call('cancelWidgetConfig'); return; }
    if (a !== 'save') return;
    if (!st.noteId) { toast('Bitte eine Notiz auswählen'); return; }
    if (st.bgType === 'image' && !st.image) { toast('Bitte ein Foto wählen'); return; }
    const note = model.find('note', st.noteId);
    pushNote(note);
    let image = '';
    if (st.bgType === 'image') {
      if (imageChanged || st.dim !== originalDim || !cfg.hasImage) image = await bake(st.image, st.dim);
      await db.put('kv', { image: st.image }, 'widgetbg_' + widgetId);
    } else if (cfg.hasImage) {
      image = 'none';
    }
    const tc = textColor();
    const out = {
      noteId: st.noteId, bgType: st.bgType, color: st.color, alpha: st.alpha, dim: st.dim, lum: st.lum,
      text: st.text || '', textColor: tc && st.bgType !== 'default' ? tc : (st.text || ''),
    };
    if (out.textColor) { const { r, g, b } = hexToRgb(out.textColor); out.textColor = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join(''); }
    call('saveWidgetConfig', JSON.stringify(out), image);
  });
}
