// Dialog „Aussehen“: Hintergrund, Schriftgröße und Schriftfarbe einer Notiz (oder Standard für neue Notizen).
import { dialog, el, esc, icon, colorRow, segmented, toast } from './ui.js';
import { BG_COLORS, TEXT_COLORS, PATTERNS, measureLum, overlayCss } from './theme.js';
import { pickImageFile, fileToDataUrl, cropDialog } from './imagetools.js';

const clone = o => JSON.parse(JSON.stringify(o || {}));

/**
 * Öffnet die Einstellungen für das Aussehen. Änderungen werden sofort über onChange gemeldet (Live-Vorschau).
 * Gibt beim Schließen das endgültige Aussehen zurück.
 */
export function openNoteStyle(initial, { title = 'Aussehen der Notiz', onChange = () => {}, hint = '' } = {}) {
  return new Promise(resolve => {
    let style = clone(initial);
    style.bg = style.bg || { type: 'none' };
    const emit = () => onChange(clone(style));

    const body = el(`<div class="style-panel">
      ${hint ? `<p class="muted">${esc(hint)}</p>` : ''}
      <section>
        <h3>Hintergrund</h3>
        <div class="bg-type"></div>
        <div class="bg-panel"></div>
      </section>
      <section>
        <h3>Schriftgröße <span class="size-val"></span></h3>
        <div class="size-row">
          <span class="a-small">A</span>
          <input type="range" min="13" max="28" step="1" class="size-range">
          <span class="a-big">A</span>
          <button type="button" class="btn small size-reset">Standard</button>
        </div>
      </section>
      <section>
        <h3>Schriftfarbe</h3>
        <div class="ink-row"></div>
        <p class="muted small">„Automatisch“ wählt je nach Hintergrund dunkle oder helle Schrift. Einzelne Wörter färbst du in der Leiste mit dem Knopf <b>A</b>.</p>
      </section>
    </div>`);

    // --- Hintergrund ---
    const panel = body.querySelector('.bg-panel');
    const renderPanel = () => {
      panel.innerHTML = '';
      const bg = style.bg;
      if (bg.type === 'color' || bg.type === 'pattern') {
        if (bg.type === 'pattern') {
          panel.append(segmented(PATTERNS.map(p => ({ value: p.id, label: p.name })), bg.pattern || 'blank', v => { style.bg.pattern = v; emit(); }));
        }
        panel.append(colorRow(BG_COLORS, bg.color, c => { style.bg.color = c; emit(); }));
      } else if (bg.type === 'image') {
        const box = el(`<div class="bg-image-box">
          <div class="bg-thumb"></div>
          <div class="bg-image-tools">
            <button type="button" class="btn small pick">${icon('image')} ${bg.image ? 'Anderes Foto' : 'Foto wählen'}</button>
            <label class="dim-label">Abdunkeln <input type="range" min="-70" max="70" step="5" class="dim"> Aufhellen</label>
          </div>
        </div>`);
        const thumb = box.querySelector('.bg-thumb');
        const updThumb = () => {
          thumb.style.background = bg.image ? `linear-gradient(${overlayCss(bg.dim)}, ${overlayCss(bg.dim)}), url("${bg.image}") center / cover` : '';
          thumb.textContent = bg.image ? '' : 'Kein Foto';
        };
        updThumb();
        const dim = box.querySelector('.dim');
        dim.value = Math.round((bg.dim || 0) * 100);
        dim.disabled = !bg.image;
        dim.addEventListener('input', () => { style.bg.dim = Number(dim.value) / 100; updThumb(); emit(); });
        box.querySelector('.pick').onclick = async () => {
          const file = await pickImageFile();
          if (!file) return;
          try {
            const url = await fileToDataUrl(file, 1400);
            const cropped = await cropDialog(url, { title: 'Hintergrundbild zuschneiden', applyLabel: 'Verwenden' });
            if (!cropped) return;
            style.bg = { type: 'image', image: cropped, dim: style.bg.dim ?? 0, lum: await measureLum(cropped) };
            emit();
            renderPanel();
          } catch (e) { toast(e.message); }
        };
        panel.append(box);
        if (!bg.image) setTimeout(() => box.querySelector('.pick').click(), 50);
      }
    };
    body.querySelector('.bg-type').append(segmented([
      { value: 'none', label: 'Ohne' }, { value: 'color', label: 'Farbe' },
      { value: 'pattern', label: 'Papier' }, { value: 'image', label: 'Foto' },
    ], style.bg.type || 'none', v => {
      const old = style.bg;
      if (v === 'none') style.bg = { type: 'none' };
      else if (v === 'color') style.bg = { type: 'color', color: old.color || BG_COLORS[2] };
      else if (v === 'pattern') style.bg = { type: 'pattern', pattern: old.pattern || 'blank', color: old.color || BG_COLORS[0] };
      else style.bg = { type: 'image', image: old.image || '', dim: old.dim || 0, lum: old.lum };
      emit();
      renderPanel();
    }));
    renderPanel();

    // --- Schriftgröße ---
    const range = body.querySelector('.size-range');
    const val = body.querySelector('.size-val');
    const showSize = () => { range.value = style.size || 17; val.textContent = style.size ? `· ${style.size} px` : '· Standard'; };
    showSize();
    range.addEventListener('input', () => { style.size = Number(range.value); showSize(); emit(); });
    body.querySelector('.size-reset').onclick = () => { delete style.size; showSize(); emit(); };

    // --- Schriftfarbe ---
    body.querySelector('.ink-row').append(colorRow(TEXT_COLORS, style.color || null, c => {
      if (c) style.color = c; else delete style.color;
      emit();
    }, { noneLabel: 'Automatisch' }));

    dialog({
      title, body, wide: true, cls: 'sheet-compact',
      actions: [
        { label: 'Zurücksetzen', onClick: () => { style = { bg: { type: 'none' } }; emit(); } },
        { label: 'Fertig', primary: true },
      ],
      onClose: () => {
        if (style.bg?.type === 'image' && !style.bg.image) style.bg = { type: 'none' };
        resolve(clone(style));
      },
    });
  });
}
